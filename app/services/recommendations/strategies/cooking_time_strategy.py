"""
Cooking Time Personalization Strategy

Enhances recipe generation requests by applying the user's preferred cooking times
with a 20% buffer to accommodate variations.

Task: Phase 2 Tarea 4 - Recommendation Engine Refactoring
"""

import logging
from typing import Dict, Any

from app.services.recipe_ai_engine import RecipeGenerationRequest
from app.services.recommendations.base_strategy import PersonalizationStrategy

logger = logging.getLogger(__name__)


class CookingTimeStrategy(PersonalizationStrategy):
    """
    Strategy for enhancing cooking time preferences in recipe generation requests.

    If the user hasn't specified max prep/cook times, this strategy applies their
    preferred times from their taste profile with a 20% buffer for flexibility.

    Extracted from: recommendation_engine.py lines 127-142
    """

    def __init__(self, time_buffer_percent: float = 0.20):
        """
        Initialize the cooking time strategy.

        Args:
            time_buffer_percent: Buffer to add to preferred times (default 20%)
        """
        self.time_buffer_percent = time_buffer_percent

    async def apply(
        self,
        request: RecipeGenerationRequest,
        profile: Dict[str, Any]
    ) -> tuple[RecipeGenerationRequest, Dict[str, Any]]:
        """Apply cooking time preferences to the request."""

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

        # Apply preferred prep time if not specified
        if not enhanced_request.max_prep_time_minutes and profile.get('preferred_prep_time_minutes'):
            preferred_prep = profile['preferred_prep_time_minutes']
            enhanced_request.max_prep_time_minutes = int(preferred_prep * (1.0 + self.time_buffer_percent))
            metadata['applied'] = True
            metadata['enhancements'].append({
                'type': 'prep_time',
                'value': enhanced_request.max_prep_time_minutes,
                'learned_preference': preferred_prep,
                'buffer_applied': enhanced_request.max_prep_time_minutes - preferred_prep,
                'buffer_percent': self.time_buffer_percent
            })

        # Apply preferred cook time if not specified
        if not enhanced_request.max_cook_time_minutes and profile.get('preferred_cook_time_minutes'):
            preferred_cook = profile['preferred_cook_time_minutes']
            enhanced_request.max_cook_time_minutes = int(preferred_cook * (1.0 + self.time_buffer_percent))
            metadata['applied'] = True
            metadata['enhancements'].append({
                'type': 'cook_time',
                'value': enhanced_request.max_cook_time_minutes,
                'learned_preference': preferred_cook,
                'buffer_applied': enhanced_request.max_cook_time_minutes - preferred_cook,
                'buffer_percent': self.time_buffer_percent
            })

        if not metadata['applied']:
            metadata['reason'] = 'user_specified_times_or_no_profile_data'

        return enhanced_request, metadata

    def get_strategy_name(self) -> str:
        """Get human-readable strategy name."""
        return "Cooking Time Preference Enhancement"

    def get_strategy_type(self) -> str:
        """Get strategy type/category."""
        return "cooking_time"
