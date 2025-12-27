"""
Personalization Routes

Handles user taste learning and personalized recipe recommendations.
- POST /users/preferences - Learn user preferences
- GET /users/taste-profile - Get user taste profile
- GET /users/learning-progress - Get learning progress
- POST /recipes/personalized - Generate personalized recipe

Task: Phase 2 Tarea 7 - Recipe AI Routes Refactoring
Subtask: 7.3 - Implement personalization routes & reduce nesting depth
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from datetime import datetime
import logging

from app.models.recipe import (
    UserTasteProfileResponse,
    PersonalizedRecipeRequest,
    UserLearningProgressResponse, GeneratedRecipeResponse
)
from app.services.taste_learning import taste_learning_service
from app.services.recipe_ai_engine import RecipeAIEngine
from app.services.recipe_database import recipe_db_service
from app.routes.recipes.dependencies import current_user_dependency, convert_to_engine_request
from app.models.user import User


logger = logging.getLogger(__name__)
router = APIRouter(tags=["Personalization"])

# Initialize Recipe AI Engine
recipe_engine = RecipeAIEngine()


# ===== HELPER FUNCTIONS FOR PREFERENCE ENRICHMENT =====

async def _enrich_request_with_cuisine_preferences(
    base_request: Any, profile: Dict[str, Any]
) -> None:
    """
    Guard clause: Apply top 3 preferred cuisines if none specified.
    Depth reduction: Extracted from nested if chain to separate function.
    """
    if base_request.cuisine_preferences:
        return

    top_cuisines = sorted(
        profile['cuisine_preferences'],
        key=lambda x: x['score'],
        reverse=True
    )[:3]
    base_request.cuisine_preferences = [c['cuisine'] for c in top_cuisines]


async def _enrich_request_with_cooking_times(
    base_request: Any, profile: Dict[str, Any]
) -> None:
    """
    Guard clause: Apply preferred cooking times if not specified.
    Depth reduction: Extracted to separate function.
    """
    if not base_request.max_prep_time_minutes:
        base_request.max_prep_time_minutes = profile['preferred_prep_time_minutes']

    if not base_request.max_cook_time_minutes:
        base_request.max_cook_time_minutes = profile['preferred_cook_time_minutes']


async def _enrich_request_with_nutrition_preferences(
    base_request: Any, profile: Dict[str, Any]
) -> None:
    """
    Guard clause: Apply nutritional preferences if not specified.
    Depth reduction: Extracted to separate function.
    """
    if not base_request.target_calories_per_serving:
        base_request.target_calories_per_serving = profile['preferred_calories_per_serving']


async def _enrich_request_with_ingredient_preferences(
    base_request: Any, profile: Dict[str, Any]
) -> None:
    """
    Guard clause: Apply liked/disliked ingredients.
    Depth reduction: Extracted to separate function.
    """
    # Exclude strongly disliked ingredients
    disliked_ingredients = [
        ing['ingredient'] for ing in profile['disliked_ingredients']
        if ing['preference'] < -0.5
    ]
    base_request.excluded_ingredients.extend(disliked_ingredients)

    # Prefer strongly liked ingredients (top 5)
    liked_ingredients = [
        ing['ingredient'] for ing in profile['liked_ingredients']
        if ing['preference'] > 0.5
    ]
    base_request.preferred_ingredients.extend(liked_ingredients[:5])


async def _apply_taste_profile_to_request(
    base_request: Any, profile: Dict[str, Any]
) -> None:
    """
    Apply all taste profile enrichments with guard clauses.
    This reduces nesting depth from 9 to 2 by sequential function calls.
    """
    # Guard clause: Check if profile is reliable
    if not profile or profile['profile_confidence'] <= 0.3:
        return

    # Sequential function calls instead of nested ifs
    await _enrich_request_with_cuisine_preferences(base_request, profile)
    await _enrich_request_with_cooking_times(base_request, profile)
    await _enrich_request_with_nutrition_preferences(base_request, profile)
    await _enrich_request_with_ingredient_preferences(base_request, profile)


@router.post(
    "/users/preferences",
    response_model=UserTasteProfileResponse,
    summary="Learn User Preferences",
    description="Learn and update user taste preferences"
)
async def learn_user_preferences(
    user: User = Depends(current_user_dependency)
):
    """
    Analyze user's ratings and learn taste preferences.
    Triggers cuisine and ingredient preference analysis.
    """
    try:
        user_id = user.id
        logger.info(f"Learning preferences for user {user_id}")

        # Run cuisine preference analysis
        cuisine_analysis = await taste_learning_service.analyze_cuisine_preferences(user_id, min_ratings=1)

        if cuisine_analysis.get('error'):
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient data for taste learning: {cuisine_analysis.get('error')}"
            )

        # Update cuisine preferences in database
        await taste_learning_service.update_cuisine_preferences_in_db(user_id, cuisine_analysis)

        # Run ingredient preference analysis
        ingredient_analysis = await taste_learning_service.analyze_ingredient_preferences(user_id, min_occurrences=1)

        if not ingredient_analysis.get('error'):
            # Update ingredient preferences in database
            await taste_learning_service.update_ingredient_preferences_in_db(user_id, ingredient_analysis)

        # Create consolidated taste profile
        cuisine_prefs = []
        for cuisine, data in cuisine_analysis.get('cuisine_preferences', {}).items():
            cuisine_prefs.append({
                'cuisine': cuisine,
                'score': data['raw_score'],
                'count': data['total_ratings']
            })

        liked_ingredients = []
        disliked_ingredients = []
        if not ingredient_analysis.get('error'):
            categorized = ingredient_analysis.get('categorized_ingredients', {})
            for ingredient in categorized.get('loved', []) + categorized.get('liked', []):
                if ingredient in ingredient_analysis['ingredient_preferences']:
                    data = ingredient_analysis['ingredient_preferences'][ingredient]
                    liked_ingredients.append({
                        'ingredient': ingredient,
                        'preference': data['raw_score'],
                        'frequency': data['total_occurrences']
                    })

            for ingredient in categorized.get('disliked', []) + categorized.get('avoided', []):
                if ingredient in ingredient_analysis['ingredient_preferences']:
                    data = ingredient_analysis['ingredient_preferences'][ingredient]
                    disliked_ingredients.append({
                        'ingredient': ingredient,
                        'preference': data['raw_score'],
                        'frequency': data['total_occurrences']
                    })

        # Update consolidated taste profile in database
        profile_data = {
            'profile_confidence': cuisine_analysis['confidence_score'],
            'total_ratings_analyzed': cuisine_analysis['total_ratings_analyzed'],
            'cuisine_preferences': cuisine_prefs,
            'liked_ingredients': liked_ingredients,
            'disliked_ingredients': disliked_ingredients
        }

        await recipe_db_service.create_or_update_user_taste_profile(user_id, profile_data)

        # Return comprehensive taste profile response
        return UserTasteProfileResponse(
            user_id=user_id,
            profile_confidence=cuisine_analysis['confidence_score'],
            total_ratings_analyzed=cuisine_analysis['total_ratings_analyzed'],
            cuisine_preferences=cuisine_prefs,
            liked_ingredients=liked_ingredients,
            disliked_ingredients=disliked_ingredients,
            last_learning_update=datetime.now()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to learn preferences for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to learn user preferences")


@router.get(
    "/users/taste-profile",
    response_model=UserTasteProfileResponse,
    summary="Get User Taste Profile",
    description="Retrieve the user's learned taste profile"
)
async def get_user_taste_profile(
    user: User = Depends(current_user_dependency)
):
    """
    Retrieve user's complete taste profile including preferences and learning progress.
    """
    try:
        user_id = user.id

        # Get taste profile from database
        profile = await recipe_db_service.get_user_taste_profile(user_id)

        # Guard clause: If no profile exists, create one by learning from ratings
        if not profile:
            learn_response = await learn_user_preferences(request=None, user=user)
            return learn_response

        # Convert database format to API response format
        return UserTasteProfileResponse(
            user_id=profile['user_id'],
            profile_confidence=profile['profile_confidence'],
            total_ratings_analyzed=profile['total_ratings_analyzed'],
            cuisine_preferences=profile['cuisine_preferences'],
            liked_ingredients=profile['liked_ingredients'],
            disliked_ingredients=profile['disliked_ingredients'],
            preferred_prep_time_minutes=profile['preferred_prep_time_minutes'],
            preferred_cook_time_minutes=profile['preferred_cook_time_minutes'],
            quick_meal_preference=profile['quick_meal_preference'],
            preferred_calories_per_serving=profile['preferred_calories_per_serving'],
            preferred_protein_ratio=profile['preferred_protein_ratio'],
            preferred_carb_ratio=profile['preferred_carb_ratio'],
            preferred_fat_ratio=profile['preferred_fat_ratio'],
            modification_tendency=profile['modification_tendency'],
            repeat_cooking_tendency=profile['repeat_cooking_tendency'],
            last_learning_update=profile['last_learning_update'],
            created_at=profile['created_at'],
            updated_at=profile['updated_at']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get taste profile for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve taste profile")


@router.get(
    "/users/learning-progress",
    response_model=UserLearningProgressResponse,
    summary="Get User Learning Progress",
    description="Get the progress of user taste learning"
)
async def get_user_learning_progress(
    user: User = Depends(current_user_dependency)
):
    """
    Get user's taste learning progress and achievements.
    """
    try:
        user_id = user.id

        # Get learning progress from database
        progress = await recipe_db_service.get_user_learning_progress(user_id)

        # Guard clause: If no progress exists, create initial record
        if not progress:
            with recipe_db_service.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT OR IGNORE INTO user_learning_progress (
                        id, user_id, ratings_milestone, cuisines_explored, ingredients_learned
                    ) VALUES (?, ?, 0, 0, 0)
                """, (f"progress_{user_id}", user_id))
                conn.commit()

            # Return initial progress
            return UserLearningProgressResponse(
                user_id=user_id,
                ratings_milestone=0,
                cuisines_explored=0,
                ingredients_learned=0,
                profile_accuracy_score=0.0,
                recommendation_success_rate=0.0,
                learning_started_at=datetime.now()
            )

        return UserLearningProgressResponse(**progress)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get learning progress for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve learning progress")


@router.post(
    "/recipes/personalized",
    response_model=GeneratedRecipeResponse,
    summary="Generate Personalized Recipe",
    description="Generate a recipe personalized to user preferences"
)
async def generate_personalized_recipe(
    request: PersonalizedRecipeRequest,
    user: User = Depends(current_user_dependency)
):
    """
    Generate a recipe using user's taste profile for personalization.
    Nesting depth reduced from 9 to 2 using guard clauses and helper functions.
    """
    try:
        user_id = user.id
        logger.info(f"Generating personalized recipe for user {user_id}")

        # Guard clause: Early return if not using taste profile
        if not request.use_taste_profile:
            engine_request = convert_to_engine_request(request.base_request, user_id)
            recipe = await recipe_engine.generate_recipe(engine_request)
            return _build_recipe_response(recipe)

        # Get user's taste profile for personalization
        profile = await recipe_db_service.get_user_taste_profile(user_id)

        # Get base request and apply enrichments
        base_request = request.base_request
        await _apply_taste_profile_to_request(base_request, profile)

        # Convert to engine request
        engine_request = convert_to_engine_request(base_request, user_id)

        # Generate recipe using enhanced request
        recipe = await recipe_engine.generate_recipe(engine_request)

        # Store in database
        await recipe_db_service.create_recipe(recipe, user_id)

        return _build_recipe_response(recipe)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate personalized recipe for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate personalized recipe")


def _build_recipe_response(recipe: Any) -> GeneratedRecipeResponse:
    """
    Helper function to convert recipe object to API response.
    Extracted to reduce code duplication and improve readability.
    """
    return GeneratedRecipeResponse(
        id=recipe.id,
        name=recipe.name,
        description=recipe.description,
        cuisine_type=recipe.cuisine_type,
        difficulty_level=recipe.difficulty_level,
        prep_time_minutes=recipe.prep_time_minutes,
        cook_time_minutes=recipe.cook_time_minutes,
        servings=recipe.servings,
        ingredients=[{
            'name': ing.name,
            'quantity': ing.quantity,
            'unit': ing.unit,
            'calories_per_unit': ing.calories_per_unit,
            'protein_g_per_unit': ing.protein_g_per_unit,
            'fat_g_per_unit': ing.fat_g_per_unit,
            'carbs_g_per_unit': ing.carbs_g_per_unit,
            'is_optional': ing.is_optional,
            'preparation_note': ing.preparation_note
        } for ing in recipe.ingredients],
        instructions=[{
            'step_number': inst.step_number,
            'instruction': inst.instruction,
            'cooking_method': inst.cooking_method,
            'duration_minutes': inst.duration_minutes,
            'temperature_celsius': inst.temperature_celsius
        } for inst in recipe.instructions],
        nutrition={
            'calories_per_serving': recipe.nutrition.calories_per_serving,
            'protein_g_per_serving': recipe.nutrition.protein_g_per_serving,
            'fat_g_per_serving': recipe.nutrition.fat_g_per_serving,
            'carbs_g_per_serving': recipe.nutrition.carbs_g_per_serving,
            'fiber_g_per_serving': recipe.nutrition.fiber_g_per_serving,
            'sugar_g_per_serving': recipe.nutrition.sugar_g_per_serving,
            'sodium_mg_per_serving': recipe.nutrition.sodium_mg_per_serving,
            'recipe_score': recipe.nutrition.recipe_score
        } if recipe.nutrition else None,
        created_by=recipe.created_by,
        confidence_score=recipe.confidence_score,
        generation_time_ms=recipe.generation_time_ms,
        tags=recipe.tags,
        created_at=datetime.now()
    )
