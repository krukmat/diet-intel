"""Progress Builder - Builder Pattern for constructing DayProgressSummary.

FASE 2.b: Refactorización de TrackingService
Patrón Builder: Construye objetos DayProgressSummary de forma fluida.
"""

from app.models.tracking import DayProgressSummary, DayProgress
from app.services.progress.progress_calculator import ProgressCalculator
from app.services.progress.nutrition_targets import (
    NutritionTargetsProvider,
    NutritionTargets
)
from typing import Dict, Any, Optional


class ProgressBuilder:
    """Builder for creating DayProgressSummary objects.
    
    FASE 2.b: Provides a fluent interface for building progress summaries.
    Encapsulates the complexity of calculating progress for all nutrients.
    
    Usage:
        builder = ProgressBuilder()
        progress = builder.with_consumed(calories=850, protein=35)
                      .with_targets(calories=2000, protein=120)
                      .build()
    """
    
    def __init__(
        self,
        calculator: Optional[ProgressCalculator] = None,
        targets_provider: Optional[NutritionTargetsProvider] = None
    ):
        """Initialize builder with optional dependencies.
        
        Args:
            calculator: Progress calculator instance
            targets_provider: Nutrition targets provider
        """
        self._calculator = calculator or ProgressCalculator()
        self._targets_provider = targets_provider or NutritionTargetsProvider()
        
        # Initialize with empty values
        self._consumed: Dict[str, float] = {}
        self._planned: Dict[str, float] = {}
    
    def reset(self) -> 'ProgressBuilder':
        """Reset builder to initial state.
        
        Returns:
            Self for chaining
        """
        self._consumed = {}
        self._planned = {}
        return self
    
    def with_consumed(
        self,
        calories: float = 0,
        protein: float = 0,
        fat: float = 0,
        carbs: float = 0
    ) -> 'ProgressBuilder':
        """Set consumed amounts for all nutrients.
        
        Args:
            calories: Calories consumed
            protein: Protein consumed
            fat: Fat consumed
            carbs: Carbs consumed
            
        Returns:
            Self for chaining
        """
        self._consumed = {
            "calories": calories,
            "protein": protein,
            "fat": fat,
            "carbs": carbs
        }
        return self
    
    def with_consumed_dict(self, consumed: Dict[str, float]) -> 'ProgressBuilder':
        """Set consumed amounts from dictionary.
        
        Args:
            consumed: Dict with nutrient names as keys
            
        Returns:
            Self for chaining
        """
        self._consumed = consumed.copy()
        return self
    
    def with_planned(
        self,
        calories: float = 2000,
        protein: float = 120,
        fat: float = 65,
        carbs: float = 250
    ) -> 'ProgressBuilder':
        """Set planned/target amounts for all nutrients.
        
        Args:
            calories: Daily calorie target
            protein: Daily protein target
            fat: Daily fat target
            carbs: Daily carbs target
            
        Returns:
            Self for chaining
        """
        self._planned = {
            "calories": calories,
            "protein": protein,
            "fat": fat,
            "carbs": carbs
        }
        return self
    
    def with_planned_dict(self, planned: Dict[str, float]) -> 'ProgressBuilder':
        """Set planned amounts from dictionary.
        
        Args:
            planned: Dict with nutrient names as keys
            
        Returns:
            Self for chaining
        """
        self._planned = planned.copy()
        return self
    
    async def with_user_targets(self, user_id: str) -> 'ProgressBuilder':
        """Load planned amounts from user's nutrition targets.
        
        Args:
            user_id: User ID to get targets for
            
        Returns:
            Self for chaining
        """
        targets = await self._targets_provider.get_targets(user_id)
        self._planned = targets.to_dict()
        return self
    
    def add_consumed(
        self,
        calories: float = 0,
        protein: float = 0,
        fat: float = 0,
        carbs: float = 0
    ) -> 'ProgressBuilder':
        """Add to consumed amounts.
        
        Useful for incrementing progress.
        
        Args:
            calories: Calories to add
            protein: Protein to add
            fat: Fat to add
            carbs: Carbs to add
            
        Returns:
            Self for chaining
        """
        self._consumed["calories"] = self._consumed.get("calories", 0) + calories
        self._consumed["protein"] = self._consumed.get("protein", 0) + protein
        self._consumed["fat"] = self._consumed.get("fat", 0) + fat
        self._consumed["carbs"] = self._consumed.get("carbs", 0) + carbs
        return self
    
    def build(self) -> DayProgressSummary:
        """Build the DayProgressSummary object.
        
        Returns:
            Complete progress summary with all nutrients
            
        Raises:
            ValueError: If required data is missing
        """
        # Ensure all nutrients have values
        nutrients = ["calories", "protein", "fat", "carbs"]
        
        for nutrient in nutrients:
            if nutrient not in self._consumed:
                self._consumed[nutrient] = 0
            if nutrient not in self._planned:
                self._planned[nutrient] = 0
        
        # Calculate progress for each nutrient
        calories_progress = self._calculator.calculate(
            self._consumed["calories"],
            self._planned["calories"]
        )
        
        protein_progress = self._calculator.calculate(
            self._consumed["protein"],
            self._planned["protein"]
        )
        
        fat_progress = self._calculator.calculate(
            self._consumed["fat"],
            self._planned["fat"]
        )
        
        carbs_progress = self._calculator.calculate(
            self._consumed["carbs"],
            self._planned["carbs"]
        )
        
        return DayProgressSummary(
            calories=calories_progress,
            protein=protein_progress,
            fat=fat_progress,
            carbs=carbs_progress
        )
    
    def build_from_meals(self, meals: list[Dict[str, Any]]) -> DayProgressSummary:
        """Build progress from list of meal records.
        
        Extracts nutritional data from meals and calculates progress.
        
        Args:
            meals: List of meal dictionaries with items
            
        Returns:
            Complete progress summary
        """
        total_consumed = {
            "calories": 0,
            "protein": 0,
            "fat": 0,
            "carbs": 0
        }
        
        for meal in meals:
            items = meal.get("items", [])
            for item in items:
                total_consumed["calories"] += item.get("calories", 0)
                macros = item.get("macros", {})
                total_consumed["protein"] += macros.get("protein", macros.get("protein_g", 0))
                total_consumed["fat"] += macros.get("fat", macros.get("fat_g", 0))
                total_consumed["carbs"] += macros.get("carbs", macros.get("carbs_g", 0))
        
        return (
            self.reset()
            .with_consumed_dict(total_consumed)
            .build()
        )


class ProgressSummaryFactory:
    """Factory for creating ProgressBuilder instances.
    
    FASE 2.b: Provides convenience methods for common scenarios.
    """
    
    def __init__(
        self,
        calculator: Optional[ProgressCalculator] = None,
        targets_provider: Optional[NutritionTargetsProvider] = None
    ):
        """Initialize factory with dependencies."""
        self._calculator = calculator
        self._targets_provider = targets_provider
    
    def create_builder(self) -> ProgressBuilder:
        """Create a new ProgressBuilder instance.
        
        Returns:
            New ProgressBuilder configured with dependencies
        """
        return ProgressBuilder(
            calculator=self._calculator,
            targets_provider=self._targets_provider
        )
    
    async def create_from_user(
        self,
        user_id: str,
        meals: list[Dict[str, Any]]
    ) -> DayProgressSummary:
        """Create progress summary for a user.
        
        Combines user targets with meal consumption.
        
        Args:
            user_id: User ID
            meals: List of consumed meals
            
        Returns:
            Complete progress summary
        """
        builder = self.create_builder()
        
        # Load user targets
        await builder.with_user_targets(user_id)
        
        # Calculate consumed from meals
        consumed = self._calculate_consumed_from_meals(meals)
        
        return builder.with_consumed_dict(consumed).build()
    
    def _calculate_consumed_from_meals(
        self,
        meals: list[Dict[str, Any]]
    ) -> Dict[str, float]:
        """Calculate total consumed from meals list."""
        total = {"calories": 0, "protein": 0, "fat": 0, "carbs": 0}
        
        for meal in meals:
            items = meal.get("items", [])
            for item in items:
                total["calories"] += item.get("calories", 0)
                macros = item.get("macros", {})
                total["protein"] += macros.get("protein", macros.get("protein_g", 0))
                total["fat"] += macros.get("fat", macros.get("fat_g", 0))
                total["carbs"] += macros.get("carbs", macros.get("carbs_g", 0))
        
        return total


# Default instances for easy imports
default_builder = ProgressBuilder()
default_factory = ProgressSummaryFactory()
