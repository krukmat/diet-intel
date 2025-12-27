"""
Core Recipe Routes

Handles recipe search, ratings, analytics, feedback, and retrieval.
- GET /recipes/search - Search recipes by criteria
- POST /recipes/{id}/rate - Rate a recipe
- GET /recipes/{id}/ratings - Get recipe ratings
- GET /recipes/{id}/nutrition - Analyze nutrition
- GET /recipes/{id}/analytics - Get analytics
- POST /recipes/{id}/feedback - Submit feedback
- GET /recipes/{id} - Get recipe details

Task: Phase 2 Tarea 7 - Recipe AI Routes Refactoring
Subtask: 7.6 - Implement core routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime

from app.models.recipe import (
    RecipeSearchResponse,
    RecipeRatingRequest, RecipeRatingResponse,
    RecipeAnalyticsResponse, GeneratedRecipeResponse
)
from app.services.recipe_database import recipe_db_service
from app.routes.recipes.dependencies import optional_user_dependency, current_user_dependency
from app.models.user import User


logger = logging.getLogger(__name__)
router = APIRouter(tags=["Recipes"])


@router.get(
    "/recipes/search",
    response_model=RecipeSearchResponse,
    summary="Search Recipes",
    description="Search for recipes by various criteria"
)
async def search_recipes(
    query: Optional[str] = Query(None, description="Search query"),
    cuisine_type: Optional[str] = Query(None, description="Filter by cuisine type"),
    difficulty_level: Optional[str] = Query(None, description="Filter by difficulty"),
    max_prep_time: Optional[int] = Query(None, description="Maximum prep time in minutes"),
    dietary_restrictions: List[str] = Query(default=[], description="Dietary restrictions"),
    tags: List[str] = Query(default=[], description="Recipe tags"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: Optional[User] = Depends(optional_user_dependency)
):
    """
    Search recipes with advanced filtering options.
    """
    try:
        # Calculate offset for pagination
        offset = (page - 1) * page_size

        # Search recipes
        recipes = await recipe_db_service.search_recipes(
            cuisine_type=cuisine_type,
            difficulty_level=difficulty_level,
            max_prep_time=max_prep_time,
            tags=tags,
            limit=page_size
        )

        # For simplicity, return all results (in production, implement proper pagination)
        total_count = len(recipes)
        has_more = len(recipes) == page_size

        return RecipeSearchResponse(
            recipes=recipes,
            total_count=total_count,
            page=page,
            page_size=page_size,
            has_more=has_more
        )

    except Exception as e:
        logger.error(f"Recipe search failed: {e}")
        raise HTTPException(status_code=500, detail="Recipe search failed")


@router.post(
    "/recipes/{recipe_id}/rate",
    summary="Rate Recipe",
    description="Rate and review a recipe"
)
async def rate_recipe(
    recipe_id: str,
    rating_request: RecipeRatingRequest,
    user: User = Depends(current_user_dependency)
):
    """
    Rate and review a recipe.
    """
    try:
        # Check if recipe exists
        recipe = await recipe_db_service.get_recipe(recipe_id)
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")

        # Submit rating
        rating_id = await recipe_db_service.rate_recipe(
            user_id=user.id,
            recipe_id=recipe_id,
            rating=rating_request.rating,
            review=rating_request.review,
            made_modifications=rating_request.made_modifications,
            would_make_again=rating_request.would_make_again
        )

        return {
            "rating_id": rating_id,
            "recipe_id": recipe_id,
            "rating": rating_request.rating,
            "message": "Rating submitted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to rate recipe {recipe_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit rating")


@router.get(
    "/recipes/{recipe_id}/ratings",
    response_model=RecipeRatingResponse,
    summary="Get Recipe Ratings",
    description="Get rating statistics for a recipe"
)
async def get_recipe_ratings(
    recipe_id: str,
    user: Optional[User] = Depends(optional_user_dependency)
):
    """
    Get rating statistics for a recipe.
    """
    try:
        # Get rating statistics
        stats = await recipe_db_service.get_recipe_ratings(recipe_id)

        return RecipeRatingResponse(
            recipe_id=recipe_id,
            total_ratings=stats["total_ratings"],
            average_rating=stats["average_rating"],
            would_make_again_percentage=stats["would_make_again_percentage"]
        )

    except Exception as e:
        logger.error(f"Failed to get ratings for recipe {recipe_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get recipe ratings")


@router.get(
    "/recipes/{recipe_id}/nutrition",
    summary="Analyze Recipe Nutrition",
    description="Analyze nutritional content of a recipe"
)
async def analyze_recipe_nutrition(
    recipe_id: str,
    user: Optional[User] = Depends(optional_user_dependency)
):
    """
    Analyze the nutritional content of a recipe.
    """
    try:
        # Get recipe from database
        recipe = await recipe_db_service.get_recipe(recipe_id)
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")

        # Extract nutrition data
        nutrition_analysis = {
            "recipe_id": recipe_id,
            "recipe_name": recipe.get('name', ''),
            "nutrition": recipe.get('nutrition', {}),
            "servings": recipe.get('servings', 1),
            "message": "Nutrition analysis for recipe"
        }

        return nutrition_analysis

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Nutrition analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze recipe nutrition")


@router.get(
    "/recipes/analytics",
    response_model=RecipeAnalyticsResponse,
    summary="Get Recipe Analytics",
    description="Get recipe generation analytics and insights"
)
async def get_recipe_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    user: User = Depends(current_user_dependency)
):
    """
    Get recipe generation analytics and insights.
    """
    try:
        # Check if user has access to analytics (could be role-based)
        if not user.is_developer:
            raise HTTPException(status_code=403, detail="Access denied to analytics")

        # Get analytics data
        analytics = await recipe_db_service.get_recipe_analytics(days=days)

        return RecipeAnalyticsResponse(
            period_days=analytics["period_days"],
            generation_stats=analytics["generation_stats"],
            popular_cuisines=analytics["popular_cuisines"],
            rating_stats=analytics["rating_stats"]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analytics retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics")


@router.post(
    "/recipes/{recipe_id}/feedback",
    summary="Submit Recipe Feedback",
    description="Submit feedback on a recipe"
)
async def submit_recipe_feedback(
    recipe_id: str,
    feedback: Dict[str, Any],
    user: User = Depends(current_user_dependency)
):
    """
    Submit feedback for recipe AI improvement.
    """
    try:
        # Log feedback for AI learning
        feedback_id = f"feedback_{user.id}_{datetime.now().timestamp()}"

        # In a real implementation, this would feed into the AI training pipeline
        logger.info(f"Received recipe feedback from user {user.id}: {feedback}")

        return {
            "feedback_id": feedback_id,
            "message": "Feedback submitted successfully",
            "status": "received"
        }

    except Exception as e:
        logger.error(f"Failed to submit feedback for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit feedback")


@router.get(
    "/recipes/{recipe_id}",
    response_model=GeneratedRecipeResponse,
    summary="Get Recipe",
    description="Get details of a specific recipe"
)
async def get_recipe(
    recipe_id: str,
    user: Optional[User] = Depends(optional_user_dependency)
):
    """
    Get detailed information about a specific recipe.
    """
    try:
        recipe = await recipe_db_service.get_recipe(recipe_id)

        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")

        return GeneratedRecipeResponse(
            id=recipe.id,
            name=recipe.name,
            description=recipe.description,
            cuisine_type=recipe.cuisine_type,
            difficulty_level=recipe.difficulty_level,
            prep_time_minutes=recipe.prep_time_minutes,
            cook_time_minutes=recipe.cook_time_minutes,
            servings=recipe.servings,
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
                for ing in recipe.ingredients
            ],
            instructions=[
                {
                    "step_number": inst.step_number,
                    "instruction": inst.instruction,
                    "cooking_method": inst.cooking_method,
                    "duration_minutes": inst.duration_minutes,
                    "temperature_celsius": inst.temperature_celsius
                }
                for inst in recipe.instructions
            ],
            nutrition={
                "calories_per_serving": recipe.nutrition.calories_per_serving,
                "protein_g_per_serving": recipe.nutrition.protein_g_per_serving,
                "fat_g_per_serving": recipe.nutrition.fat_g_per_serving,
                "carbs_g_per_serving": recipe.nutrition.carbs_g_per_serving,
                "fiber_g_per_serving": recipe.nutrition.fiber_g_per_serving,
                "sugar_g_per_serving": recipe.nutrition.sugar_g_per_serving,
                "sodium_mg_per_serving": recipe.nutrition.sodium_mg_per_serving,
                "recipe_score": recipe.nutrition.recipe_score
            } if recipe.nutrition else None,
            created_by=recipe.created_by,
            confidence_score=recipe.confidence_score,
            generation_time_ms=recipe.generation_time_ms,
            tags=recipe.tags
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get recipe {recipe_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve recipe")
