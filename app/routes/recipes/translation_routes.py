"""
Translation Routes

Handles recipe translation to other languages.
- POST /recipes/translate/{recipe_id} - Translate single recipe
- POST /recipes/translate/batch - Batch translate recipes
- GET /recipes/languages - Get supported languages

Task: Phase 2 Tarea 7 - Recipe AI Routes Refactoring
Subtask: 7.5 - Implement translation routes
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Any
from datetime import datetime
import logging

from app.models.recipe import (
    BatchRecipeTranslationRequest, GeneratedRecipeResponse
)
from app.services.recipe_ai_engine import RecipeAIEngine
from app.services.recipe_database import recipe_db_service
from app.routes.recipes.dependencies import current_user_dependency
from app.models.user import User


logger = logging.getLogger(__name__)
router = APIRouter(tags=["Translation"])

# Initialize Recipe AI Engine
recipe_engine = RecipeAIEngine()


def _build_recipe_response(recipe: Any) -> GeneratedRecipeResponse:
    """Convert recipe object to API response format."""
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
        tags=recipe.tags,
        created_at=datetime.now()
    )


@router.post(
    "/recipes/translate/{recipe_id}",
    response_model=GeneratedRecipeResponse,
    summary="Translate Recipe",
    description="Translate an existing recipe to a target language"
)
async def translate_recipe(
    recipe_id: str,
    target_language: str = "es",
    user: User = Depends(current_user_dependency)
):
    """
    Translate an existing recipe to a target language.

    Takes an existing recipe ID and returns the recipe translated
    with ingredients, instructions, and descriptions in target language.
    """
    try:
        logger.info(f"Translating recipe {recipe_id} to {target_language} for user {user.id}")

        # Get the existing recipe from database
        existing_recipe = await recipe_db_service.get_recipe(recipe_id)
        if not existing_recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")

        # Translate the recipe
        translated_recipe = await recipe_engine.translate_existing_recipe(
            existing_recipe, target_language=target_language
        )

        # Store the translated recipe in database
        await recipe_db_service.create_recipe(translated_recipe, user.id)

        logger.info(f"Successfully translated recipe {recipe_id} to {target_language}: {translated_recipe.name}")
        return _build_recipe_response(translated_recipe)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to translate recipe {recipe_id} to {target_language}: {e}")
        raise HTTPException(status_code=500, detail="Failed to translate recipe")


@router.post(
    "/recipes/translate-batch",
    summary="Batch Translate Recipes",
    description="Translate multiple recipes to a target language"
)
async def batch_translate_recipes(
    request: BatchRecipeTranslationRequest,
    user: User = Depends(current_user_dependency)
):
    """
    Translate multiple recipes to a target language in a batch operation.

    Efficiently translates multiple recipes at once, useful for
    translating entire recipe collections.
    """
    try:
        logger.info(f"Batch translating {len(request.recipe_ids)} recipes to {request.target_language} for user {user.id}")

        # Get existing recipes from database
        recipes = []
        for recipe_id in request.recipe_ids:
            recipe = await recipe_db_service.get_recipe(recipe_id)
            if recipe:
                recipes.append(recipe)

        # Translate all recipes
        translations = await recipe_engine.batch_translate_recipes(
            recipes, target_language=request.target_language
        )

        # Store translated recipes in database
        successful_translations = {}
        for original_recipe_id, translated_recipe in translations.items():
            if translated_recipe:
                try:
                    await recipe_db_service.create_recipe(translated_recipe, user.id)
                    successful_translations[original_recipe_id] = translated_recipe.id
                except Exception as e:
                    logger.error(f"Failed to store translated recipe {original_recipe_id}: {e}")

        # Prepare response
        total_count = len(request.recipe_ids)
        successful_count = len([t for t in translations.values() if t is not None])
        failed_count = total_count - successful_count

        response = {
            "translations": successful_translations,
            "target_language": request.target_language,
            "total_count": total_count,
            "successful_count": successful_count,
            "failed_count": failed_count,
            "cached_count": 0  # Would be implemented with caching logic
        }

        logger.info(f"Batch translation completed: {successful_count}/{total_count} successful")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to batch translate recipes to {request.target_language}: {e}")
        raise HTTPException(status_code=500, detail="Failed to batch translate recipes")


@router.get(
    "/recipes/languages",
    summary="Get Supported Languages",
    description="Get list of supported translation languages"
)
async def get_supported_languages():
    """
    Get supported languages for Recipe AI translation.

    Currently supports English (en) and Spanish (es).
    """
    return {
        "supported_languages": {
            "en": "English",
            "es": "Español"
        },
        "default_language": "en",
        "translation_features": [
            "Recipe names and descriptions",
            "Ingredient names and preparation notes",
            "Step-by-step cooking instructions",
            "Recipe tags and categories"
        ]
    }
