"""
Difficulty Adjustment Personalization Strategy

Enhances recipe generation requests by adjusting difficulty based on the user's
modification tendency (propensity to modify recipes).

Task: Phase 2 Tarea 4 - Recommendation Engine Refactoring
"""

import logging
from typing import Dict, Any

from app.services.recipe_ai_engine import RecipeGenerationRequest
from app.services.recommendations.base_strategy import PersonalizationStrategy

logger = logging.getLogger(__name__)


class DifficultyAdjustmentStrategy(PersonalizationStrategy):
    """
    Strategy for adjusting recipe difficulty based on user behavior patterns.

    If the user has a high modification tendency (>0.7), suggesting they prefer to
    customize recipes, this strategy downgrades hard difficulty recipes to medium
    to better match their preferences.

    Extracted from: recommendation_engine.py lines 187-197
    """

    def __init__(self, modification_tendency_threshold: float = 0.7):
        """
        Initialize the difficulty adjustment strategy.

        Args:
            modification_tendency_threshold: Threshold above which to adjust difficulty
        """
        self.modification_tendency_threshold = modification_tendency_threshold

    async def apply(
        self,
        request: RecipeGenerationRequest,
        profile: Dict[str, Any]
    ) -> tuple[RecipeGenerationRequest, Dict[str, Any]]:
        """Apply difficulty adjustment to the request."""

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

        # Check modification tendency
        modification_tendency = profile.get('modification_tendency', 0.0)
        if modification_tendency < self.modification_tendency_threshold:
            metadata['reason'] = 'low_modification_tendency'
            return enhanced_request, metadata

        # Only adjust if user requested hard difficulty
        if enhanced_request.difficulty_preference != 'hard':
            metadata['reason'] = 'not_hard_difficulty'
            return enhanced_request, metadata

        # Downgrade to medium
        enhanced_request.difficulty_preference = 'medium'
        metadata['applied'] = True
        metadata['enhancements'].append({
            'type': 'difficulty',
            'from': 'hard',
            'to': 'medium',
            'reason': 'high_modification_tendency',
            'modification_tendency': modification_tendency,
            'threshold': self.modification_tendency_threshold
        })

        return enhanced_request, metadata

    def get_strategy_name(self) -> str:
        """Get human-readable strategy name."""
        return "Difficulty Adjustment"

    def get_strategy_type(self) -> str:
        """Get strategy type/category."""
        return "difficulty"
