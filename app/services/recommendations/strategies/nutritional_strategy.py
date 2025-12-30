"""
Nutritional Preference Personalization Strategy

Enhances recipe generation requests by applying the user's preferred calorie targets
from their taste profile.

Task: Phase 2 Tarea 4 - Recommendation Engine Refactoring
"""

import logging
from typing import Dict, Any

from app.services.recipe_ai_engine import RecipeGenerationRequest
from app.services.recommendations.base_strategy import PersonalizationStrategy

logger = logging.getLogger(__name__)


class NutritionalPreferenceStrategy(PersonalizationStrategy):
    """
    Strategy for enhancing nutritional preferences in recipe generation requests.

    If the user hasn't specified target calories per serving, this strategy applies
    their preferred calorie target from their taste profile.

    Extracted from: recommendation_engine.py lines 144-151
    """

    async def apply(
        self,
        request: RecipeGenerationRequest,
        profile: Dict[str, Any]
    ) -> tuple[RecipeGenerationRequest, Dict[str, Any]]:
        """Apply nutritional preferences to the request."""

        # Create enhanced request copy
        enhanced_request = RecipeGenerationRequest(
            user_id=request.user_id,
            cuisine_preferences=request.cuisine_preferences.copy() if request.cuisine_preferences else [],
            dietary_restrictions=request.dietary_restrictions.copy() if request.dietary_restrictions else [],
            difficulty_preference=request.difficulty_preference,
            meal_type=request.meal_type,
            target_calories_per_serving=request.target_calories_per_serving,
            target_protein_g=request.target_protein_g,
            target_carbs_g=request.target_carbs_g,
            target_fat_g=request.target_fat_g,
            servings=request.servings,
            max_prep_time_minutes=request.max_prep_time_minutes,
            max_cook_time_minutes=request.max_cook_time_minutes,
            available_ingredients=getattr(request, 'available_ingredients', []),
            excluded_ingredients=request.excluded_ingredients.copy() if request.excluded_ingredients else []
        )

        metadata = {
            'applied': False,
            'strategy_type': self.get_strategy_type(),
            'strategy_name': self.get_strategy_name(),
            'enhancements': []
        }

        # Only apply if user hasn't specified calorie target
        if enhanced_request.target_calories_per_serving:
            metadata['reason'] = 'user_specified_calories'
            return enhanced_request, metadata

        # Get preferred calories from profile
        preferred_calories = profile.get('preferred_calories_per_serving')
        if not preferred_calories:
            metadata['reason'] = 'no_nutrition_profile_data'
            return enhanced_request, metadata

        # Apply preference
        enhanced_request.target_calories_per_serving = preferred_calories
        metadata['applied'] = True
        metadata['enhancements'].append({
            'type': 'calories',
            'value': preferred_calories,
            'reason': 'learned_preference'
        })

        return enhanced_request, metadata

    def get_strategy_name(self) -> str:
        """Get human-readable strategy name."""
        return "Nutritional Preference Enhancement"

    def get_strategy_type(self) -> str:
        """Get strategy type/category."""
        return "nutrition"
