"""
Cuisine Match Scorer

Scores how well a recipe's cuisine type matches the user's cuisine preferences.

Task: Phase 2 Tarea 4 - Recommendation Engine Refactoring
"""

import logging
import statistics
from typing import Dict, Any

from app.services.recipe_ai_engine import GeneratedRecipe
from app.services.recommendations.scorers.base_scorer import RecipeScorer

logger = logging.getLogger(__name__)


class CuisineScorer(RecipeScorer):
    """
    Scorer that evaluates cuisine match between recipe and user preferences.

    Looks for exact cuisine matches in user's preferred cuisines list.
    If found, uses the user's preference score for that cuisine.
    If not found, uses average of all cuisine preferences.

    Extracted from: recommendation_engine.py lines 265-281
    """

    def score(
        self,
        recipe: GeneratedRecipe,
        profile: Dict[str, Any]
    ) -> float:
        """Score how well recipe cuisine matches user preferences."""

        cuisine_preferences = profile.get('cuisine_preferences', [])

        # If no preferences, neutral score
        if not cuisine_preferences:
            return 0.5

        # Try to find exact cuisine match
        recipe_cuisine = recipe.cuisine_type.lower() if recipe.cuisine_type else ""
        for pref in cuisine_preferences:
            if pref.get('cuisine', '').lower() == recipe_cuisine:
                # Convert preference score (-1 to 1) to 0 to 1 scale
                score = pref.get('score', 0.0)
                return max(0.0, min(1.0, (score + 1.0) / 2.0))

        # If no exact match, use average preference for unknown cuisines
        try:
            avg_score = statistics.mean([pref.get('score', 0.0) for pref in cuisine_preferences])
        except (ValueError, ZeroDivisionError):
            return 0.5

        return max(0.0, min(1.0, (avg_score + 1.0) / 2.0))

    def explain(self, score: float) -> str:
        """Generate explanation for cuisine score."""
        if score >= 0.7:
            return "matches your favorite cuisines"
        elif score <= 0.3:
            return "cuisine doesn't match your usual preferences"
        else:
            return "cuisine is moderately aligned with your preferences"

    def get_scorer_type(self) -> str:
        """Get scorer type."""
        return "cuisine"

    def get_scorer_name(self) -> str:
        """Get scorer name."""
        return "Cuisine Match Scorer"
