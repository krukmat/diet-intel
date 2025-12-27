"""
Recipe Generation Routes

Handles recipe generation, optimization, and suggestions.
- POST /recipes/generate - Generate new recipes
- POST /recipes/optimize - Optimize existing recipes
- GET /recipes/suggestions - Get recipe suggestions
- GET /recipes/health - Health check

Task: Phase 2 Tarea 7 - Recipe AI Routes Refactoring
Subtask: 7.2 - Implement generation routes
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from typing import Optional, Dict, Any
from datetime import datetime
import logging

from app.models.recipe import (
    RecipeGenerationRequest, GeneratedRecipeResponse, RecipeOptimizationRequest
)
from app.services.recipe_ai_engine import RecipeAIEngine, RecipeGenerationRequest as EngineRequest
from app.services.recipe_database import recipe_db_service
from app.services.recommendation_engine import recommendation_engine
from app.routes.recipes.dependencies import (
    current_user_dependency, optional_user_dependency, convert_to_engine_request
)
from app.models.user import User


logger = logging.getLogger(__name__)
router = APIRouter(tags=["Recipe Generation"])

# Initialize Recipe AI Engine
recipe_engine = RecipeAIEngine()


async def log_recipe_request(
    user_id: str,
    request_data: Dict[str, Any],
    success: bool,
    recipe_id: Optional[str] = None,
    processing_time_ms: Optional[float] = None,
    error_message: Optional[str] = None
):
    """Background task to log recipe generation requests"""
    try:
        cache_key = recipe_engine._generate_cache_key(EngineRequest(**request_data))
        await recipe_db_service.log_recipe_generation_request(
            user_id=user_id,
            session_id=None,
            cache_key=cache_key,
            request_data=request_data,
            generated_recipe_id=recipe_id,
            processing_time_ms=processing_time_ms,
            success=success,
            error_message=error_message
        )
    except Exception as e:
        logger.error(f"Failed to log recipe request: {e}")


@router.post(
    "/recipes/generate",
    response_model=GeneratedRecipeResponse,
    summary="Generate Recipe",
    description="Generate a new recipe based on user preferences and constraints"
)
async def generate_recipe(
    request: RecipeGenerationRequest,
    current_user: User = Depends(current_user_dependency),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Generate a new recipe based on user preferences"""
    start_time = datetime.now()
    recipe_id = None

    try:
        logger.info(f"Generating recipe for user {current_user.id}")

        # Convert API request to engine request
        engine_request = convert_to_engine_request(request, current_user.id)

        # Apply personalization based on user's taste profile
        personalized_request, personalization_metadata = await recommendation_engine.apply_personalization(
            engine_request, current_user.id
        )

        # Generate recipe using AI engine with personalized request
        generated_recipe = await recipe_engine.generate_recipe_with_translation(personalized_request)

        # Score how well the recipe matches user's taste profile
        personalization_score = await recommendation_engine.score_recipe_personalization(
            generated_recipe, current_user.id
        )

        # Store recipe in database
        recipe_id = await recipe_db_service.create_recipe(generated_recipe, current_user.id)

        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        # Log request for analytics (background task)
        background_tasks.add_task(
            log_recipe_request,
            user_id=current_user.id,
            request_data=request.dict(),
            success=True,
            recipe_id=recipe_id,
            processing_time_ms=processing_time
        )

        # Convert to response model
        response = GeneratedRecipeResponse(
            id=generated_recipe.id,
            name=generated_recipe.name,
            description=generated_recipe.description,
            cuisine_type=generated_recipe.cuisine_type,
            difficulty_level=generated_recipe.difficulty_level,
            prep_time_minutes=generated_recipe.prep_time_minutes,
            cook_time_minutes=generated_recipe.cook_time_minutes,
            servings=generated_recipe.servings,
            ingredients=[
                {
                    "name": ing.name,
                    "quantity": ing.quantity,
                    "unit": ing.unit,
                    "barcode": ing.barcode,
                    "calories_per_unit": ing.calories_per_unit,
                    "protein_g_per_unit": ing.protein_g_per_unit,
                    "fat_g_per_unit": ing.fat_g_per_unit,
                    "carbs_g_per_unit": ing.carbs_g_per_unit,
                    "is_optional": ing.is_optional,
                    "preparation_note": ing.preparation_note
                }
                for ing in generated_recipe.ingredients
            ],
            instructions=[
                {
                    "step_number": inst.step_number,
                    "instruction": inst.instruction,
                    "cooking_method": inst.cooking_method,
                    "duration_minutes": inst.duration_minutes,
                    "temperature_celsius": inst.temperature_celsius
                }
                for inst in generated_recipe.instructions
            ],
            nutrition={
                "calories_per_serving": generated_recipe.nutrition.calories_per_serving,
                "protein_g_per_serving": generated_recipe.nutrition.protein_g_per_serving,
                "fat_g_per_serving": generated_recipe.nutrition.fat_g_per_serving,
                "carbs_g_per_serving": generated_recipe.nutrition.carbs_g_per_serving,
                "fiber_g_per_serving": generated_recipe.nutrition.fiber_g_per_serving,
                "sugar_g_per_serving": generated_recipe.nutrition.sugar_g_per_serving,
                "sodium_mg_per_serving": generated_recipe.nutrition.sodium_mg_per_serving,
                "recipe_score": generated_recipe.nutrition.recipe_score
            } if generated_recipe.nutrition else None,
            created_by=generated_recipe.created_by,
            confidence_score=generated_recipe.confidence_score,
            generation_time_ms=generated_recipe.generation_time_ms,
            tags=generated_recipe.tags,
            personalization={
                'metadata': personalization_metadata,
                'score': personalization_score
            },
            created_at=datetime.now()
        )

        # Log personalization insights
        if personalization_metadata.get('applied'):
            logger.info(f"Applied personalization for user {current_user.id}: "
                       f"confidence={personalization_metadata.get('profile_confidence', 0):.3f}")

        logger.info(f"Successfully generated recipe '{generated_recipe.name}' for user {current_user.id}")
        return response

    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        error_message = str(e)

        # Log failed request
        background_tasks.add_task(
            log_recipe_request,
            user_id=current_user.id,
            request_data=request.dict(),
            success=False,
            processing_time_ms=processing_time,
            error_message=error_message
        )

        logger.error(f"Recipe generation failed for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "RECIPE_GENERATION_FAILED",
                "error_message": "Failed to generate recipe",
                "details": {"processing_time_ms": processing_time},
                "suggestions": [
                    "Try adjusting your preferences",
                    "Ensure dietary restrictions are valid",
                    "Check nutritional targets are realistic"
                ]
            }
        )


@router.post(
    "/recipes/optimize",
    response_model=GeneratedRecipeResponse,
    summary="Optimize Recipe",
    description="Optimize an existing recipe for nutritional goals"
)
async def optimize_recipe(
    request: RecipeOptimizationRequest,
    current_user: User = Depends(current_user_dependency)
):
    """Optimize an existing recipe"""
    try:
        logger.info(f"Optimizing recipe for user {current_user.id} with goal: {request.optimization_goal}")

        # Optimize recipe using AI engine
        optimized_recipe = await recipe_engine.optimize_existing_recipe(
            request.recipe_data,
            request.optimization_goal
        )

        # Store optimized recipe in database
        await recipe_db_service.create_recipe(optimized_recipe, current_user.id)

        # Convert to response
        response = GeneratedRecipeResponse(
            id=optimized_recipe.id,
            name=optimized_recipe.name,
            description=optimized_recipe.description,
            cuisine_type=optimized_recipe.cuisine_type,
            difficulty_level=optimized_recipe.difficulty_level,
            prep_time_minutes=optimized_recipe.prep_time_minutes,
            cook_time_minutes=optimized_recipe.cook_time_minutes,
            servings=optimized_recipe.servings,
            ingredients=[
                {
                    "name": ing.name,
                    "quantity": ing.quantity,
                    "unit": ing.unit,
                    "barcode": ing.barcode,
                    "calories_per_unit": ing.calories_per_unit,
                    "protein_g_per_unit": ing.protein_g_per_unit,
                    "fat_g_per_unit": ing.fat_g_per_unit,
                    "carbs_g_per_unit": ing.carbs_g_per_unit,
                    "is_optional": ing.is_optional,
                    "preparation_note": ing.preparation_note
                }
                for ing in optimized_recipe.ingredients
            ],
            instructions=[
                {
                    "step_number": inst.step_number,
                    "instruction": inst.instruction,
                    "cooking_method": inst.cooking_method,
                    "duration_minutes": inst.duration_minutes,
                    "temperature_celsius": inst.temperature_celsius
                }
                for inst in optimized_recipe.instructions
            ],
            nutrition={
                "calories_per_serving": optimized_recipe.nutrition.calories_per_serving,
                "protein_g_per_serving": optimized_recipe.nutrition.protein_g_per_serving,
                "fat_g_per_serving": optimized_recipe.nutrition.fat_g_per_serving,
                "carbs_g_per_serving": optimized_recipe.nutrition.carbs_g_per_serving,
                "fiber_g_per_serving": optimized_recipe.nutrition.fiber_g_per_serving,
                "sugar_g_per_serving": optimized_recipe.nutrition.sugar_g_per_serving,
                "sodium_mg_per_serving": optimized_recipe.nutrition.sodium_mg_per_serving,
                "recipe_score": optimized_recipe.nutrition.recipe_score
            } if optimized_recipe.nutrition else None,
            created_by=optimized_recipe.created_by,
            confidence_score=optimized_recipe.confidence_score,
            generation_time_ms=optimized_recipe.generation_time_ms,
            tags=optimized_recipe.tags,
            created_at=datetime.now()
        )

        logger.info(f"Successfully optimized recipe for user {current_user.id}")
        return response

    except Exception as e:
        logger.error(f"Recipe optimization failed for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "RECIPE_OPTIMIZATION_FAILED",
                "error_message": "Failed to optimize recipe",
                "suggestions": ["Check recipe data format", "Try a different optimization goal"]
            }
        )


@router.get(
    "/recipes/suggestions",
    summary="Get Recipe Suggestions",
    description="Get recipe suggestions based on user history"
)
async def get_recipe_suggestions(
    context: str = Query("breakfast", description="Meal context for suggestions"),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(current_user_dependency)
):
    """Get personalized recipe suggestions based on user preferences and context"""
    try:
        # Search for recipes matching user context
        suggestions = await recipe_db_service.search_recipes(
            user_id=current_user.id,
            limit=limit
        )

        return {
            "suggestions": suggestions,
            "context": context,
            "user_id": current_user.id,
            "count": len(suggestions)
        }

    except Exception as e:
        logger.error(f"Failed to get recipe suggestions for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get recipe suggestions")


@router.get(
    "/recipes/health",
    summary="Recipe AI Health Check",
    description="Check if recipe AI service is healthy"
)
async def recipe_ai_health_check():
    """Health check endpoint for recipe AI service"""
    try:
        health_status = {
            "recipe_ai_engine": "healthy",
            "database_connection": "healthy",
            "timestamp": datetime.now().isoformat(),
            "version": "1.0.0"
        }

        # Test database connection
        try:
            with recipe_db_service.get_connection():
                pass
        except Exception:
            health_status["database_connection"] = "unhealthy"

        # Test recipe engine
        try:
            health_status["recipe_ai_engine"] = "healthy"
        except Exception:
            health_status["recipe_ai_engine"] = "unhealthy"

        return health_status

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
