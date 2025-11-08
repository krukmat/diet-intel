"""
Intelligent Flow Service

Orchestrates the IA pipeline that combines Food Vision, Recipe AI and Smart Diet.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import time
from datetime import datetime
from typing import Optional, Dict, Any, Callable, Awaitable

from app.models.food_vision import VisionLogResponse
from app.models.intelligent_flow import (
    IntelligentFlowRequest,
    IntelligentFlowResponse,
    IntelligentFlowRecipePreferences,
    IntelligentFlowSmartDietConfig,
    FlowStepTiming,
    FlowStepStatus,
    FlowExecutionStatus,
    FlowMetadata,
)
from app.models.recipe import GeneratedRecipeResponse, DifficultyLevel, RecipeNutritionResponse
from app.models.smart_diet import SmartDietRequest, SmartDietResponse
from app.services.food_vision_service import food_vision_service, FoodVisionService
from app.services.performance_monitor import performance_monitor
from app.services.recipe_ai_engine import (
    recipe_ai_engine,
    RecipeAIEngine,
    RecipeGenerationRequest as EngineRecipeRequest,
    GeneratedRecipe,
)
from app.services.smart_diet import smart_diet_engine, SmartDietEngine
from app.services.gamification.points_service import PointsService
from app.config import config

logger = logging.getLogger(__name__)


class IntelligentFlowError(Exception):
    """Base class for flow errors."""


class IntelligentFlowValidationError(IntelligentFlowError):
    """Raised when incoming data is invalid."""


class IntelligentFlowService:
    """Coordinates the intelligent nutrition flow across existing services."""

    def __init__(
        self,
        food_service: FoodVisionService = food_vision_service,
        recipe_service: RecipeAIEngine = recipe_ai_engine,
        smart_diet_service: SmartDietEngine = smart_diet_engine,
        points_service: Optional[PointsService] = None,
    ) -> None:
        self.food_service = food_service
        self.recipe_service = recipe_service
        self.smart_diet_service = smart_diet_service
        self.points_service = points_service or PointsService
        self.monitor = performance_monitor
        self._logger = logger

    async def run_flow(self, request: IntelligentFlowRequest) -> IntelligentFlowResponse:
        """
        Execute the intelligent pipeline end-to-end.

        Raises:
            IntelligentFlowValidationError: when image decoding fails.
            IntelligentFlowError: for unexpected failures in the vision step.
        """
        start_time = time.time()
        timings: Dict[str, FlowStepTiming] = {}
        warnings: list[str] = []

        # Decode image once for downstream services
        image_bytes = self._decode_image(request.image_base64)

        self._logger.info(
            "Running intelligent flow | user=%s meal=%s",
            request.user_id,
            request.meal_type,
        )

        # Food Vision is the entry point and required for downstream steps.
        vision_result = await self._run_step(
            step_name="vision",
            timings=timings,
            operation="intelligent_flow_vision",
            executor=lambda: self.food_service.analyze_food_image(
                image_data=image_bytes,
                user_id=request.user_id,
                meal_type=request.meal_type,
                user_context=request.user_context,
            ),
            continue_on_error=False,
        )

        # Recipe AI and Smart Diet can fail independently without cancelling the flow.
        recipe_result, smart_diet_result = await asyncio.gather(
            self._run_recipe_step(
                request=request,
                vision_result=vision_result,
                timings=timings,
                warnings=warnings,
            ),
            self._run_smart_diet_step(
                request=request,
                timings=timings,
                warnings=warnings,
            ),
        )

        total_duration = (time.time() - start_time) * 1000
        status = self._calculate_status(recipe_result, smart_diet_result, timings)

        self._dispatch_gamification_event(request, status, warnings)

        metadata = FlowMetadata(
            user_id=request.user_id,
            meal_type=request.meal_type,
            total_duration_ms=total_duration,
            warnings=warnings,
        )

        response = IntelligentFlowResponse(
            status=status,
            vision_result=vision_result,
            recipe_result=recipe_result,
            smart_diet_result=smart_diet_result,
            timings=timings,
            metadata=metadata,
        )

        self._logger.info(
            "Intelligent flow completed | user=%s status=%s duration=%.2fms",
            request.user_id,
            status.value,
            total_duration,
        )

        return response

    async def _run_recipe_step(
        self,
        request: IntelligentFlowRequest,
        vision_result: VisionLogResponse,
        timings: Dict[str, FlowStepTiming],
        warnings: list[str],
    ) -> Optional[GeneratedRecipeResponse]:
        """Execute the recipe step and capture errors as flow warnings."""
        recipe_preferences = request.recipe_preferences or IntelligentFlowRecipePreferences()
        engine_request = self._build_recipe_engine_request(
            recipe_preferences,
            request,
            vision_result,
        )

        try:
            generated_recipe = await self._run_step(
                step_name="recipe",
                timings=timings,
                operation="intelligent_flow_recipe",
                executor=lambda: self.recipe_service.generate_recipe(engine_request),
                continue_on_error=True,
            )

            if generated_recipe is None:
                return None

            return self._convert_recipe_to_response(generated_recipe)

        except Exception as exc:  # pragma: no cover - guarded by continue_on_error
            warnings.append(f"Recipe generation failed: {exc}")
            return None

    async def _run_smart_diet_step(
        self,
        request: IntelligentFlowRequest,
        timings: Dict[str, FlowStepTiming],
        warnings: list[str],
    ) -> Optional[SmartDietResponse]:
        """Execute the smart diet step and capture non-critical failures."""
        smart_config: IntelligentFlowSmartDietConfig = request.smart_diet_config
        smart_diet_request = SmartDietRequest(
            user_id=request.user_id,
            context_type=smart_config.context_type,
            meal_context=smart_config.meal_context or request.meal_type,
            dietary_restrictions=smart_config.dietary_restrictions,
            cuisine_preferences=smart_config.cuisine_preferences,
            excluded_ingredients=smart_config.excluded_ingredients,
            calorie_budget=smart_config.calorie_budget,
            max_suggestions=smart_config.max_suggestions,
            min_confidence=smart_config.min_confidence,
            include_optimizations=smart_config.include_optimizations,
            include_recommendations=smart_config.include_recommendations,
            lang=smart_config.lang,
        )

        try:
            response = await self._run_step(
                step_name="smart_diet",
                timings=timings,
                operation="intelligent_flow_smart_diet",
                executor=lambda: self.smart_diet_service.get_smart_suggestions(
                    request.user_id,
                    smart_diet_request,
                ),
                continue_on_error=True,
            )
            return response
        except Exception as exc:  # pragma: no cover - guarded by continue_on_error
            warnings.append(f"Smart Diet suggestions failed: {exc}")
            return None

    def _build_recipe_engine_request(
        self,
        preferences: IntelligentFlowRecipePreferences,
        flow_request: IntelligentFlowRequest,
        vision_result: VisionLogResponse,
    ) -> EngineRecipeRequest:
        """Convert flow preferences and vision output into an engine request."""
        available_ingredients = preferences.build_available_ingredients(
            vision_result.identified_ingredients
        )

        engine_request = EngineRecipeRequest(
            user_id=flow_request.user_id,
            cuisine_preferences=preferences.cuisine_preferences,
            dietary_restrictions=preferences.dietary_restrictions,
            difficulty_preference=preferences.difficulty_preference,
            meal_type=preferences.meal_type or flow_request.meal_type,
            target_calories_per_serving=preferences.target_calories_per_serving,
            target_protein_g=preferences.target_protein_g,
            target_carbs_g=preferences.target_carbs_g,
            target_fat_g=preferences.target_fat_g,
            servings=preferences.servings,
            max_prep_time_minutes=preferences.max_prep_time_minutes,
            max_cook_time_minutes=preferences.max_cook_time_minutes,
            available_ingredients=available_ingredients,
            excluded_ingredients=preferences.excluded_ingredients,
        )
        return engine_request

    async def _run_step(
        self,
        step_name: str,
        timings: Dict[str, FlowStepTiming],
        operation: str,
        executor: Callable[[], Awaitable[Any]],
        continue_on_error: bool,
    ):
        """Run a step with performance measurement and timing metadata."""
        step_start = datetime.utcnow()
        timer_start = time.time()
        try:
            async with self.monitor.measure_api_call(operation, {"step": step_name}):
                result = await executor()
            duration_ms = (time.time() - timer_start) * 1000
            timings[step_name] = FlowStepTiming(
                started_at=step_start,
                duration_ms=duration_ms,
                status=FlowStepStatus.SUCCESS,
            )
            return result
        except Exception as exc:
            duration_ms = (time.time() - timer_start) * 1000
            timings[step_name] = FlowStepTiming(
                started_at=step_start,
                duration_ms=duration_ms,
                status=FlowStepStatus.ERROR,
                error_message=str(exc),
            )

            self._logger.error(
                "Step %s failed after %.2fms: %s",
                step_name,
                duration_ms,
                exc,
                exc_info=True,
            )

            if continue_on_error:
                return None
            raise IntelligentFlowError(f"{step_name} step failed") from exc

    @staticmethod
    def _convert_recipe_to_response(recipe: GeneratedRecipe) -> GeneratedRecipeResponse:
        """Map engine dataclass into API response model."""
        nutrition = None
        if recipe.nutrition:
            nutrition = RecipeNutritionResponse(
                calories_per_serving=recipe.nutrition.calories_per_serving,
                protein_g_per_serving=recipe.nutrition.protein_g_per_serving,
                fat_g_per_serving=recipe.nutrition.fat_g_per_serving,
                carbs_g_per_serving=recipe.nutrition.carbs_g_per_serving,
                fiber_g_per_serving=recipe.nutrition.fiber_g_per_serving,
                sugar_g_per_serving=recipe.nutrition.sugar_g_per_serving,
                sodium_mg_per_serving=recipe.nutrition.sodium_mg_per_serving,
                recipe_score=recipe.nutrition.recipe_score,
            )

        return GeneratedRecipeResponse(
            id=recipe.id,
            name=recipe.name,
            description=recipe.description,
            cuisine_type=recipe.cuisine_type,
            difficulty_level=DifficultyLevel(recipe.difficulty_level)
            if recipe.difficulty_level in DifficultyLevel._value2member_map_
            else DifficultyLevel.EASY,
            prep_time_minutes=recipe.prep_time_minutes,
            cook_time_minutes=recipe.cook_time_minutes,
            servings=recipe.servings,
            ingredients=[
                {
                    "name": ingredient.name,
                    "quantity": ingredient.quantity,
                    "unit": ingredient.unit,
                    "barcode": ingredient.barcode,
                    "calories_per_unit": ingredient.calories_per_unit,
                    "protein_g_per_unit": ingredient.protein_g_per_unit,
                    "fat_g_per_unit": ingredient.fat_g_per_unit,
                    "carbs_g_per_unit": ingredient.carbs_g_per_unit,
                    "is_optional": ingredient.is_optional,
                    "preparation_note": ingredient.preparation_note,
                }
                for ingredient in recipe.ingredients
            ],
            instructions=[
                {
                    "step_number": instruction.step_number,
                    "instruction": instruction.instruction,
                    "cooking_method": instruction.cooking_method,
                    "duration_minutes": instruction.duration_minutes,
                    "temperature_celsius": instruction.temperature_celsius,
                }
                for instruction in recipe.instructions
            ],
            nutrition=nutrition,
            created_by=recipe.created_by,
            confidence_score=recipe.confidence_score,
            generation_time_ms=recipe.generation_time_ms,
            tags=recipe.tags,
            personalization=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

    @staticmethod
    def _decode_image(image_base64: str) -> bytes:
        """Decode base64 image data and raise validation errors if invalid."""
        try:
            return base64.b64decode(image_base64, validate=True)
        except Exception as exc:
            raise IntelligentFlowValidationError("Invalid image_base64 payload") from exc

    @staticmethod
    def _calculate_status(
        recipe_result: Optional[GeneratedRecipeResponse],
        smart_diet_result: Optional[SmartDietResponse],
        timings: Dict[str, FlowStepTiming],
    ) -> FlowExecutionStatus:
        """Determine overall status based on step outcomes."""
        if timings["vision"].status != FlowStepStatus.SUCCESS:
            return FlowExecutionStatus.FAILED

        optional_steps = [
            step
            for step in ("recipe", "smart_diet")
            if step in timings and timings[step].status == FlowStepStatus.ERROR
        ]

        if optional_steps:
            return FlowExecutionStatus.PARTIAL

        if recipe_result or smart_diet_result:
            return FlowExecutionStatus.COMPLETE

        return FlowExecutionStatus.PARTIAL

    def _dispatch_gamification_event(
        self,
        request: IntelligentFlowRequest,
        status: FlowExecutionStatus,
        warnings: list[str],
    ) -> None:
        """Award gamification points when the flow completes successfully."""
        if status != FlowExecutionStatus.COMPLETE:
            return

        if not getattr(config, "gamification_enabled", False):
            return

        dispatcher = getattr(self.points_service, "add_points", None)
        if dispatcher is None:
            return

        try:
            dispatcher(
                request.user_id,
                "intelligent_flow_complete",
                {
                    "meal_type": request.meal_type,
                    "timestamp": datetime.utcnow().isoformat(),
                },
            )
        except Exception as exc:  # pragma: no cover - defensive logging
            self._logger.warning(
                "Failed to award intelligent flow points for user %s: %s",
                request.user_id,
                exc,
            )
            warnings.append("Gamification reward could not be recorded")


intelligent_flow_service = IntelligentFlowService()
