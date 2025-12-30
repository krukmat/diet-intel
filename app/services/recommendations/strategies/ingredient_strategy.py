"""
Ingredient Preference Personalization Strategy

Enhances recipe generation requests by applying the user's liked and disliked ingredients
from their taste profile.

Task: Phase 2 Tarea 4 - Recommendation Engine Refactoring
"""

import logging
from typing import Dict, Any

from app.services.recipe_ai_engine import RecipeGenerationRequest
from app.services.recommendations.base_strategy import PersonalizationStrategy

logger = logging.getLogger(__name__)


class IngredientPreferenceStrategy(PersonalizationStrategy):
    """
    Strategy for enhancing ingredient preferences in recipe generation requests.

    This strategy handles both:
    1. Excluding strongly disliked ingredients (preference < -0.5)
    2. Preferring highly liked ingredients (preference > 0.5)

    Extracted from: recommendation_engine.py lines 153-185
    """

    def __init__(
        self,
        dislike_threshold: float = -0.5,
        like_threshold: float = 0.5,
        max_liked_ingredients: int = 5
    ):
        """
        Initialize the ingredient preference strategy.

        Args:
            dislike_threshold: Preference score below which to exclude (default -0.5)
            like_threshold: Preference score above which to prefer (default 0.5)
            max_liked_ingredients: Max liked ingredients to add (default 5)
        """
        self.dislike_threshold = dislike_threshold
        self.like_threshold = like_threshold
        self.max_liked_ingredients = max_liked_ingredients

    async def apply(
        self,
        request: RecipeGenerationRequest,
        profile: Dict[str, Any]
    ) -> tuple[RecipeGenerationRequest, Dict[str, Any]]:
        """Apply ingredient preferences to the request."""

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

        # Process disliked ingredients (exclusions)
        disliked_ingredients = [
            ing['ingredient'] for ing in profile.get('disliked_ingredients', [])
            if ing['preference'] < self.dislike_threshold
        ]

        if disliked_ingredients:
            # Add to excluded ingredients, avoiding duplicates
            new_excluded = list(set(enhanced_request.excluded_ingredients + disliked_ingredients))
            if len(new_excluded) > len(enhanced_request.excluded_ingredients):
                newly_added = [ing for ing in disliked_ingredients
                               if ing not in enhanced_request.excluded_ingredients]
                enhanced_request.excluded_ingredients = new_excluded
                metadata['applied'] = True
                metadata['enhancements'].append({
                    'type': 'excluded_ingredients',
                    'added': newly_added,
                    'reason': 'strongly_disliked',
                    'threshold': self.dislike_threshold,
                    'total_excluded': len(new_excluded)
                })

        # Process liked ingredients (preferences)
        liked_ingredients = [
            ing['ingredient'] for ing in profile.get('liked_ingredients', [])
            if ing['preference'] > self.like_threshold
        ]

        if liked_ingredients:
            # Add top N liked ingredients to available ingredients list
            top_liked = liked_ingredients[:self.max_liked_ingredients]
            new_available = list(set(enhanced_request.available_ingredients + top_liked))
            if len(new_available) > len(enhanced_request.available_ingredients):
                newly_added = [ing for ing in top_liked
                               if ing not in enhanced_request.available_ingredients]
                enhanced_request.available_ingredients = new_available
                metadata['applied'] = True
                metadata['enhancements'].append({
                    'type': 'available_ingredients',
                    'added': newly_added,
                    'reason': 'highly_rated',
                    'threshold': self.like_threshold,
                    'total_available': len(new_available),
                    'limited_to': self.max_liked_ingredients
                })

        if not metadata['applied']:
            metadata['reason'] = 'no_ingredient_profile_data'

        return enhanced_request, metadata

    def get_strategy_name(self) -> str:
        """Get human-readable strategy name."""
        return "Ingredient Preference Enhancement"

    def get_strategy_type(self) -> str:
        """Get strategy type/category."""
        return "ingredients"
