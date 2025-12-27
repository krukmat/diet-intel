"""
Cuisine Preference Personalization Strategy

Enhances recipe generation requests by applying the user's preferred cuisines
learned from their historical ratings.

Task: Phase 2 Tarea 4 - Recommendation Engine Refactoring
"""

import logging
from typing import Dict, Any

from app.services.recipe_ai_engine import RecipeGenerationRequest
from app.services.recommendations.base_strategy import PersonalizationStrategy

logger = logging.getLogger(__name__)


class CuisinePreferenceStrategy(PersonalizationStrategy):
    """
    Strategy for enhancing cuisine preferences in recipe generation requests.

    If the user hasn't specified cuisine preferences, this strategy injects their
    top 3 preferred cuisines (with score > 0.2) from their taste profile.

    Extracted from: recommendation_engine.py lines 112-125
    """

    async def apply(
        self,
        request: RecipeGenerationRequest,
        profile: Dict[str, Any]
    ) -> tuple[RecipeGenerationRequest, Dict[str, Any]]:
        """Apply cuisine preferences to the request."""

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

        # Only apply if user hasn't specified cuisine preferences
        if enhanced_request.cuisine_preferences:
            metadata['reason'] = 'user_specified_preferences'
            return enhanced_request, metadata

        # Get user's top cuisines
        cuisine_preferences = profile.get('cuisine_preferences', [])
        if not cuisine_preferences:
            metadata['reason'] = 'no_cuisine_profile_data'
            return enhanced_request, metadata

        # Sort by score and take top 3
        top_cuisines = sorted(
            cuisine_preferences,
            key=lambda x: x['score'],
            reverse=True
        )[:3]

        # Filter by score > 0.2 and apply
        preferred_cuisines = [c['cuisine'] for c in top_cuisines if c['score'] > 0.2]

        if preferred_cuisines:
            enhanced_request.cuisine_preferences = preferred_cuisines
            metadata['applied'] = True
            metadata['enhancements'].append({
                'type': 'cuisine_preferences',
                'added': preferred_cuisines,
                'reason': 'learned_from_ratings',
                'source_scores': [c['score'] for c in top_cuisines if c['score'] > 0.2]
            })

        return enhanced_request, metadata

    def get_strategy_name(self) -> str:
        """Get human-readable strategy name."""
        return "Cuisine Preference Enhancement"

    def get_strategy_type(self) -> str:
        """Get strategy type/category."""
        return "cuisine"
