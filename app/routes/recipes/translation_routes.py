"""
Translation Routes

Handles recipe translation to other languages.
- POST /recipes/translate - Translate single recipe
- POST /recipes/translate-batch - Batch translate recipes
- GET /recipes/languages - Get supported languages

Task: Phase 2 Tarea 7 - Recipe AI Routes Refactoring
Subtask: 7.5 - Implement translation routes
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List
import logging

from app.models.recipe import (
    RecipeTranslationRequest, RecipeTranslationResponse,
    BatchRecipeTranslationRequest, BatchRecipeTranslationResponse
)
from app.services.recipe_database import recipe_db_service
from app.routes.recipes.dependencies import current_user_dependency
from app.models.user import User


logger = logging.getLogger(__name__)
router = APIRouter(tags=["Translation"])


@router.post(
    "/recipes/translate",
    response_model=RecipeTranslationResponse,
    summary="Translate Recipe",
    description="Translate a recipe to Spanish"
)
async def translate_recipe_to_spanish(
    request: RecipeTranslationRequest,
    user: User = Depends(current_user_dependency)
):
    """Translate recipe to Spanish"""
    # Placeholder - to be implemented from recipe_ai.py
    raise HTTPException(status_code=501, detail="Not implemented yet - moving from recipe_ai.py")


@router.post(
    "/recipes/translate-batch",
    response_model=BatchRecipeTranslationResponse,
    summary="Batch Translate Recipes",
    description="Translate multiple recipes to Spanish"
)
async def batch_translate_recipes_to_spanish(
    request: BatchRecipeTranslationRequest,
    user: User = Depends(current_user_dependency)
):
    """Batch translate recipes to Spanish"""
    # Placeholder - to be implemented from recipe_ai.py
    raise HTTPException(status_code=501, detail="Not implemented yet - moving from recipe_ai.py")


@router.get(
    "/recipes/languages",
    response_model=dict,
    summary="Get Supported Languages",
    description="Get list of supported translation languages"
)
async def get_supported_languages(
    user: User = Depends(current_user_dependency)
):
    """Get supported translation languages"""
    # Placeholder - to be implemented from recipe_ai.py
    raise HTTPException(status_code=501, detail="Not implemented yet - moving from recipe_ai.py")
