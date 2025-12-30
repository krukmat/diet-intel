"""
Recipe AI Backward Compatibility Routes

Legacy endpoint aliases for mobile app compatibility during refactoring.
These endpoints redirect to the new refactored route structure.

Task: Mobile API Compatibility - Backend Refactoring (2025-12-28)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks
from typing import Optional, List
import logging

# Import handlers from refactored routes
from app.routes.recipes.generation_routes import (
    generate_recipe, optimize_recipe, get_recipe_suggestions
)
from app.routes.recipes.personalization_routes import (
    learn_user_preferences, get_user_taste_profile, get_user_learning_progress,
    generate_personalized_recipe
)
from app.routes.recipes.shopping_list_routes import (
    optimize_shopping_list, generate_shopping_list, get_shopping_optimization
)
from app.routes.recipes.translation_routes import (
    translate_recipe, batch_translate_recipes
)

# Import models and dependencies
from app.models.recipe import (
    RecipeGenerationRequest, GeneratedRecipeResponse,
    RecipeOptimizationRequest, PersonalizedRecipeRequest,
    UserTasteProfileResponse, UserLearningProgressResponse,
    BatchRecipeTranslationRequest
)
from app.models.shopping import (
    ShoppingOptimizationRequest, ShoppingOptimizationResponse
)
from app.routes.recipes.dependencies import current_user_dependency, optional_user_dependency
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Recipe AI - Legacy Compatibility"])


# ===== GENERATION ENDPOINTS =====

@router.post(
    "/generate",
    response_model=GeneratedRecipeResponse,
    deprecated=True,
    summary="Generate Recipe (Legacy)",
    description="Legacy endpoint for recipe generation. Use /recipes/generate instead."
)
async def generate_recipe_legacy(
    request: RecipeGenerationRequest,
    current_user: User = Depends(current_user_dependency),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Legacy alias for /recipes/generate"""
    logger.info(f"Legacy /generate endpoint called - redirecting to /recipes/generate (User: {current_user.id})")
    return await generate_recipe(request, current_user, background_tasks)


@router.post(
    "/optimize",
    response_model=GeneratedRecipeResponse,
    deprecated=True,
    summary="Optimize Recipe (Legacy)",
    description="Legacy endpoint for recipe optimization. Use /recipes/optimize instead."
)
async def optimize_recipe_legacy(
    request: RecipeOptimizationRequest,
    current_user: User = Depends(current_user_dependency)
):
    """Legacy alias for /recipes/optimize"""
    logger.info(f"Legacy /optimize endpoint called - redirecting to /recipes/optimize (User: {current_user.id})")
    return await optimize_recipe(request, current_user)


# ===== PERSONALIZATION ENDPOINTS =====

@router.post(
    "/learn-preferences",
    response_model=UserTasteProfileResponse,
    deprecated=True,
    summary="Learn User Preferences (Legacy)",
    description="Legacy endpoint for preference learning. Use /users/preferences instead."
)
async def learn_preferences_legacy(
    user: User = Depends(current_user_dependency)
):
    """Legacy alias for /users/preferences"""
    logger.info(f"Legacy /learn-preferences endpoint called - redirecting to /users/preferences (User: {user.id})")
    return await learn_user_preferences(user)


@router.get(
    "/preferences/{user_id}",
    response_model=UserTasteProfileResponse,
    deprecated=True,
    summary="Get User Taste Profile (Legacy)",
    description="Legacy endpoint for taste profile. Use /users/taste-profile instead."
)
async def get_taste_profile_legacy(
    user_id: str,
    user: User = Depends(optional_user_dependency)
):
    """Legacy alias for /users/taste-profile"""
    logger.info(f"Legacy /preferences/{user_id} endpoint called - redirecting to /users/taste-profile")
    # Note: Original endpoint doesn't use user_id param, gets from current_user
    # For compatibility, we require authentication
    if not user or user.id != user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return await get_user_taste_profile(user)


@router.get(
    "/preferences/{user_id}/progress",
    response_model=UserLearningProgressResponse,
    deprecated=True,
    summary="Get User Learning Progress (Legacy)",
    description="Legacy endpoint for learning progress. Use /users/learning-progress instead."
)
async def get_learning_progress_legacy(
    user_id: str,
    user: User = Depends(optional_user_dependency)
):
    """Legacy alias for /users/learning-progress"""
    logger.info(f"Legacy /preferences/{user_id}/progress endpoint called - redirecting to /users/learning-progress")
    if not user or user.id != user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return await get_user_learning_progress(user)


@router.post(
    "/generate-personalized",
    response_model=GeneratedRecipeResponse,
    deprecated=True,
    summary="Generate Personalized Recipe (Legacy)",
    description="Legacy endpoint for personalized recipe generation. Use /recipes/personalized instead."
)
async def generate_personalized_legacy(
    request: PersonalizedRecipeRequest,
    user: User = Depends(current_user_dependency)
):
    """Legacy alias for /recipes/personalized"""
    logger.info(f"Legacy /generate-personalized endpoint called - redirecting to /recipes/personalized (User: {user.id})")
    return await generate_personalized_recipe(request, user)


# ===== SHOPPING OPTIMIZATION ENDPOINTS =====

@router.get(
    "/shopping/{optimization_id}",
    response_model=ShoppingOptimizationResponse,
    deprecated=True,
    summary="Get Shopping Optimization (Legacy)",
    description="Legacy endpoint for shopping optimization. Use /shopping/optimization/{id} instead."
)
async def get_shopping_optimization_legacy(
    optimization_id: str,
    user: User = Depends(current_user_dependency)
):
    """Legacy alias for /shopping/optimization/{optimization_id}"""
    logger.info(f"Legacy /shopping/{optimization_id} endpoint called - redirecting to /shopping/optimization/{optimization_id}")
    return await get_shopping_optimization(optimization_id, user)


# ===== TRANSLATION ENDPOINTS =====

@router.post(
    "/translate/{recipe_id}",
    response_model=GeneratedRecipeResponse,
    deprecated=True,
    summary="Translate Recipe (Legacy)",
    description="Legacy endpoint for recipe translation. Use /recipes/translate/{recipe_id} instead."
)
async def translate_recipe_legacy(
    recipe_id: str,
    target_language: str = "es",
    user: User = Depends(current_user_dependency)
):
    """Legacy alias for /recipes/translate/{recipe_id}"""
    logger.info(f"Legacy /translate/{recipe_id} endpoint called - redirecting to /recipes/translate/{recipe_id}")
    return await translate_recipe(recipe_id, target_language, user)


@router.post(
    "/translate/batch",
    deprecated=True,
    summary="Batch Translate Recipes (Legacy)",
    description="Legacy endpoint for batch translation. Use /recipes/translate-batch instead."
)
async def batch_translate_legacy(
    request: BatchRecipeTranslationRequest,
    user: User = Depends(current_user_dependency)
):
    """Legacy alias for /recipes/translate-batch"""
    logger.info(f"Legacy /translate/batch endpoint called - redirecting to /recipes/translate-batch")
    return await batch_translate_recipes(request, user)


@router.get(
    "/languages",
    deprecated=True,
    summary="Get Supported Languages (Legacy)",
    description="Legacy endpoint for language support. Use /recipes/languages instead."
)
async def get_languages_legacy():
    """Legacy alias for /recipes/languages"""
    logger.info("Legacy /languages endpoint called - redirecting to /recipes/languages")
    # Import here to avoid circular imports
    from app.routes.recipes.translation_routes import get_supported_languages
    return await get_supported_languages()


# Note: /recipe-ai/suggestions legacy endpoint is handled in smart_diet.py
# as it's a specific legacy mapping for the old recommendation system
