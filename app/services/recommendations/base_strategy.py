"""
Base Strategy Interface for Personalization

Defines the contract for personalization strategies that enhance recipe generation requests
based on user taste profiles, dietary restrictions, and preferences.

Task: Phase 2 Tarea 4 - Recommendation Engine Refactoring
"""

from abc import ABC, abstractmethod
from typing import Dict, Any

from app.services.recipe_ai_engine import RecipeGenerationRequest


class PersonalizationStrategy(ABC):
    """
    Abstract base class for personalization strategies.

    Each strategy encapsulates a single aspect of personalizing recipe requests based on
    user taste profiles. Strategies are applied sequentially by the RecommendationEngine
    orchestrator to build up a personalized request.

    Contract:
    - apply() must be idempotent
    - apply() should not modify the input request object
    - enhancement_metadata should clearly document what was changed
    """

    @abstractmethod
    async def apply(
        self,
        request: RecipeGenerationRequest,
        profile: Dict[str, Any]
    ) -> tuple[RecipeGenerationRequest, Dict[str, Any]]:
        """
        Apply personalization strategy to a recipe generation request.

        Args:
            request: Original recipe generation request
            profile: User taste profile data from database

        Returns:
            Tuple of:
            - Enhanced request with personalization applied
            - Enhancement metadata documenting changes made

        Enhancement metadata should include:
            'applied': bool - Whether strategy was applied
            'reason': str - Why strategy was/wasn't applied (optional)
            'enhancements': list - List of specific enhancements made
            'changes': dict - Detailed change information
        """
        pass

    @abstractmethod
    def get_strategy_name(self) -> str:
        """
        Get human-readable name of this strategy.

        Returns:
            Strategy name (e.g., 'Cuisine Preference Enhancement')
        """
        pass

    @abstractmethod
    def get_strategy_type(self) -> str:
        """
        Get type/category of this strategy.

        Returns:
            Strategy type (e.g., 'cuisine', 'ingredient', 'time', etc.)
        """
        pass
