"""
Base Scorer Interface for Recipe Evaluation

Defines the contract for recipe scorers that evaluate how well recipes match user profiles
across different dimensions (cuisine, ingredients, time, nutrition).

Task: Phase 2 Tarea 4 - Recommendation Engine Refactoring
"""

from abc import ABC, abstractmethod
from typing import Dict, Any

from app.services.recipe_ai_engine import GeneratedRecipe


class RecipeScorer(ABC):
    """
    Abstract base class for recipe scoring strategies.

    Each scorer evaluates a recipe on a specific dimension (cuisine, ingredients, time, nutrition)
    and returns a score from 0.0 (poor match) to 1.0 (excellent match).

    Contract:
    - score() must return a float between 0.0 and 1.0
    - explain() should provide human-readable explanation of the score
    - Scorers should be stateless and reusable
    """

    @abstractmethod
    def score(
        self,
        recipe: GeneratedRecipe,
        profile: Dict[str, Any]
    ) -> float:
        """
        Score how well a recipe matches user profile on this dimension.

        Args:
            recipe: The recipe to score
            profile: User taste profile data from database

        Returns:
            Score between 0.0 (poor match) and 1.0 (excellent match)
        """
        pass

    @abstractmethod
    def explain(self, score: float) -> str:
        """
        Generate human-readable explanation for a score.

        Args:
            score: The score to explain (0.0 to 1.0)

        Returns:
            Human-readable explanation of what the score means
        """
        pass

    @abstractmethod
    def get_scorer_type(self) -> str:
        """
        Get type/category of this scorer.

        Returns:
            Scorer type (e.g., 'cuisine', 'ingredient', 'time', etc.)
        """
        pass

    @abstractmethod
    def get_scorer_name(self) -> str:
        """
        Get human-readable name of this scorer.

        Returns:
            Scorer name (e.g., 'Cuisine Match Scorer')
        """
        pass
