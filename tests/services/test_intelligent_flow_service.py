import base64
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, ANY

import pytest

from app.models.food_vision import IdentifiedIngredient, NutritionalAnalysis, VisionLogResponse
from app.models.intelligent_flow import (
    IntelligentFlowRequest,
    IntelligentFlowRecipePreferences,
    FlowExecutionStatus,
    FlowStepStatus,
)
from app.models.smart_diet import (
    SmartDietContext,
    SmartDietResponse,
    SmartSuggestion,
    SuggestionType,
    SuggestionCategory,
)
from app.services.intelligent_flow import IntelligentFlowService, IntelligentFlowValidationError
from app.services.recipe_ai_engine import (
    GeneratedRecipe,
    RecipeIngredient,
    RecipeInstruction,
    RecipeNutrition,
)


def _build_vision_response() -> VisionLogResponse:
    identified = [
        IdentifiedIngredient(
            name="Chicken Breast",
            category="protein",
            estimated_grams=150,
            confidence_score=0.92,
            visual_markers=["texture"],
            nutrition_per_100g={"protein": 31},
        )
    ]

    nutritional_analysis = NutritionalAnalysis(
        total_calories=450,
        macro_distribution={"protein_percent": 40, "fat_percent": 30, "carbs_percent": 30},
        food_quality_score=0.8,
        health_benefits=["high_protein"],
    )

    return VisionLogResponse(
        id="vision-1",
        user_id="user-123",
        image_url="https://example.com/image.jpg",
        meal_type="lunch",
        identified_ingredients=identified,
        estimated_portions={"calories": 450},
        nutritional_analysis=nutritional_analysis,
        exercise_suggestions=[],
        created_at=datetime.utcnow(),
        processing_time_ms=1200,
    )


def _build_generated_recipe() -> GeneratedRecipe:
    ingredients = [
        RecipeIngredient(
            name="Chicken Breast",
            quantity=2,
            unit="pieces",
            calories_per_unit=165,
            protein_g_per_unit=31,
            fat_g_per_unit=3.6,
            carbs_g_per_unit=0,
        ),
    ]

    instructions = [
        RecipeInstruction(step_number=1, instruction="Season chicken.", cooking_method="pan_fry"),
        RecipeInstruction(step_number=2, instruction="Cook until done.", cooking_method="pan_fry"),
    ]

    nutrition = RecipeNutrition(
        calories_per_serving=400,
        protein_g_per_serving=40,
        fat_g_per_serving=12,
        carbs_g_per_serving=10,
    )

    return GeneratedRecipe(
        id="recipe-1",
        name="High Protein Chicken",
        description="Lean chicken breast recipe",
        cuisine_type="mediterranean",
        difficulty_level="easy",
        prep_time_minutes=15,
        cook_time_minutes=20,
        servings=2,
        ingredients=ingredients,
        instructions=instructions,
        nutrition=nutrition,
        confidence_score=0.85,
        generation_time_ms=2500,
        tags=["high_protein"],
    )


def _build_smart_diet_response(user_id: str) -> SmartDietResponse:
    suggestion = SmartSuggestion(
        id="suggestion-1",
        user_id=user_id,
        suggestion_type=SuggestionType.RECOMMENDATION,
        category=SuggestionCategory.DISCOVERY,
        title="Add steamed veggies",
        description="Balance the meal with greens",
        reasoning="Improve fiber intake",
        suggested_item={"name": "Broccoli"},
        nutritional_benefit={"fiber": 8},
        calorie_impact=50,
        macro_impact={"fiber_percent": 15},
        confidence_score=0.74,
        planning_context=SmartDietContext.TODAY,
        implementation_complexity="simple",
        created_at=datetime.utcnow(),
    )

    return SmartDietResponse(
        user_id=user_id,
        context_type=SmartDietContext.TODAY,
        suggestions=[suggestion],
        today_highlights=[suggestion],
        discoveries=[suggestion],
        optimizations=[],
        insights=[],
        nutritional_summary={"fiber_gain": 8},
        personalization_factors=[],
        total_suggestions=1,
        avg_confidence=0.74,
        generation_time_ms=1500,
    )


@pytest.fixture
def base_request() -> IntelligentFlowRequest:
    image_bytes = b"fake-image-bytes"
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    preferences = IntelligentFlowRecipePreferences(
        cuisine_preferences=["mediterranean"],
        dietary_restrictions=["low_carb"],
        servings=2,
    )
    return IntelligentFlowRequest(
        user_id="user-123",
        image_base64=image_base64,
        meal_type="lunch",
        recipe_preferences=preferences,
    )


@pytest.mark.asyncio
async def test_run_flow_success(base_request: IntelligentFlowRequest):
    vision_service = SimpleNamespace(analyze_food_image=AsyncMock(return_value=_build_vision_response()))
    recipe_engine = SimpleNamespace(generate_recipe=AsyncMock(return_value=_build_generated_recipe()))
    smart_diet_engine_mock = SimpleNamespace(
        get_smart_suggestions=AsyncMock(return_value=_build_smart_diet_response(base_request.user_id))
    )
    points_stub = SimpleNamespace(add_points=MagicMock(return_value=12))

    service = IntelligentFlowService(vision_service, recipe_engine, smart_diet_engine_mock, points_service=points_stub)
    response = await service.run_flow(base_request)

    assert response.status == FlowExecutionStatus.COMPLETE
    assert response.recipe_result is not None
    assert response.smart_diet_result is not None
    assert "vision" in response.timings
    assert response.timings["vision"].status == FlowStepStatus.SUCCESS

    engine_call = recipe_engine.generate_recipe.await_args.args[0]
    assert "Chicken Breast" in engine_call.available_ingredients
    points_stub.add_points.assert_called_once_with(
        base_request.user_id,
        "intelligent_flow_complete",
        ANY,
    )


@pytest.mark.asyncio
async def test_run_flow_recipe_failure_marks_partial(base_request: IntelligentFlowRequest):
    vision_service = SimpleNamespace(analyze_food_image=AsyncMock(return_value=_build_vision_response()))
    recipe_engine = SimpleNamespace(generate_recipe=AsyncMock(side_effect=RuntimeError("model timeout")))
    smart_diet_engine_mock = SimpleNamespace(
        get_smart_suggestions=AsyncMock(return_value=_build_smart_diet_response(base_request.user_id))
    )
    points_stub = SimpleNamespace(add_points=MagicMock(return_value=12))

    service = IntelligentFlowService(vision_service, recipe_engine, smart_diet_engine_mock, points_service=points_stub)
    response = await service.run_flow(base_request)

    assert response.status == FlowExecutionStatus.PARTIAL
    assert response.recipe_result is None
    assert response.smart_diet_result is not None
    assert response.timings["recipe"].status == FlowStepStatus.ERROR
    points_stub.add_points.assert_not_called()


@pytest.mark.asyncio
async def test_run_flow_invalid_image_raises(base_request: IntelligentFlowRequest):
    invalid_request = IntelligentFlowRequest.construct(**base_request.dict())
    invalid_request.image_base64 = "not-base64"
    vision_service = SimpleNamespace(analyze_food_image=AsyncMock())
    recipe_engine = SimpleNamespace(generate_recipe=AsyncMock())
    smart_diet_engine_mock = SimpleNamespace(get_smart_suggestions=AsyncMock())
    points_stub = SimpleNamespace(add_points=MagicMock(return_value=12))

    service = IntelligentFlowService(vision_service, recipe_engine, smart_diet_engine_mock, points_service=points_stub)

    with pytest.raises(IntelligentFlowValidationError):
        await service.run_flow(invalid_request)
    points_stub.add_points.assert_not_called()
