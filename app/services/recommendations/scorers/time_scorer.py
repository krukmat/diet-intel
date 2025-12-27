"""
Cooking Time Match Scorer

Scores how well a recipe's cooking time matches the user's preferred cooking time.

Task: Phase 2 Tarea 4 - Recommendation Engine Refactoring
"""

import logging
from typing import Dict, Any

from app.services.recipe_ai_engine import GeneratedRecipe
from app.services.recommendations.scorers.base_scorer import RecipeScorer

logger = logging.getLogger(__name__)


class TimeScorer(RecipeScorer):
    """
    Scorer that evaluates cooking time match between recipe and user preferences.

    Evaluates both prep time and cook time preferences.
    Closer match = higher score, with maximum penalties of 30 minutes for prep
    and 45 minutes for cook time.

    Extracted from: recommendation_engine.py lines 318-331
    """

    def __init__(
        self,
        preferred_prep_minutes: float = 30.0,
        preferred_cook_minutes: float = 45.0,
        max_prep_penalty: float = 30.0,
        max_cook_penalty: float = 45.0
    ):
        """
        Initialize time scorer with preference windows.

        Args:
            preferred_prep_minutes: User's preferred prep time (default 30)
            preferred_cook_minutes: User's preferred cook time (default 45)
            max_prep_penalty: Max penalty for prep time deviation (default 30 min)
            max_cook_penalty: Max penalty for cook time deviation (default 45 min)
        """
        self.preferred_prep_minutes = preferred_prep_minutes
        self.preferred_cook_minutes = preferred_cook_minutes
        self.max_prep_penalty = max_prep_penalty
        self.max_cook_penalty = max_cook_penalty

    def score(
        self,
        recipe: GeneratedRecipe,
        profile: Dict[str, Any]
    ) -> float:
        """Score how well recipe timing matches user preferences."""

        # Get profile preferences or use defaults
        preferred_prep = profile.get('preferred_prep_time_minutes', self.preferred_prep_minutes)
        preferred_cook = profile.get('preferred_cook_time_minutes', self.preferred_cook_minutes)

        # Get recipe times (with safety checks)
        recipe_prep = recipe.prep_time_minutes or 0.0
        recipe_cook = recipe.cook_time_minutes or 0.0

        # Calculate time differences
        prep_diff = abs(recipe_prep - preferred_prep)
        cook_diff = abs(recipe_cook - preferred_cook)

        # Convert differences to scores (max penalty applied)
        prep_score = max(0.0, 1.0 - (prep_diff / self.max_prep_penalty))
        cook_score = max(0.0, 1.0 - (cook_diff / self.max_cook_penalty))

        # Average the two scores
        return (prep_score + cook_score) / 2.0

    def explain(self, score: float) -> str:
        """Generate explanation for time score."""
        if score >= 0.7:
            return "fits your preferred cooking time"
        elif score <= 0.3:
            return "requires more/less time than you typically prefer"
        else:
            return "cooking time is moderately aligned with your preferences"

    def get_scorer_type(self) -> str:
        """Get scorer type."""
        return "time"

    def get_scorer_name(self) -> str:
        """Get scorer name."""
        return "Cooking Time Match Scorer"
