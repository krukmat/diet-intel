"""
Optimization Context for Shopping Optimization

Holds shared state for all optimization commands.
Commands read from and write to this context during execution.

Task: Phase 2 Tarea 6 - Shopping Optimization Refactoring
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field


@dataclass
class RecipeIngredient:
    """Single ingredient from a recipe"""
    name: str
    quantity: float
    unit: str
    recipe_id: Optional[str] = None
    calories_per_unit: Optional[float] = None
    protein_g_per_unit: Optional[float] = None
    fat_g_per_unit: Optional[float] = None
    carbs_g_per_unit: Optional[float] = None


@dataclass
class ConsolidatedIngredient:
    """Consolidated ingredient after grouping similar items"""
    name: str
    quantity: float
    unit: str
    sources: List[str] = field(default_factory=list)  # recipe_ids
    confidence: float = 1.0


@dataclass
class BulkOpportunity:
    """Bulk buying opportunity for an ingredient"""
    ingredient_name: str
    standard_quantity: float
    standard_unit: str
    bulk_quantity: float
    bulk_unit: str
    standard_unit_cost: float
    bulk_unit_cost: float
    savings_ratio: float
    confidence_score: float
    storage_requirements: Dict[str, Any] = field(default_factory=dict)


class OptimizationContext:
    """Shared context for optimization commands.

    Commands populate this context with results during execution.
    Each command reads from and writes to this context.
    """

    def __init__(
        self,
        recipes_data: List[Dict[str, Any]],
        user_id: Optional[str] = None
    ):
        """Initialize optimization context.

        Args:
            recipes_data: List of recipe data dictionaries
            user_id: Optional user ID for personalized optimization
        """
        # Input data
        self.recipes_data = recipes_data
        self.user_id = user_id

        # State populated by commands
        self.all_ingredients: List[RecipeIngredient] = []
        self.consolidated_ingredients: List[ConsolidatedIngredient] = []
        self.bulk_opportunities: List[BulkOpportunity] = []

        # Metrics and results
        self.metrics: Dict[str, Any] = {}
        self.total_cost: float = 0.0
        self.estimated_savings: float = 0.0
        self.optimization_score: float = 0.0

        # Error tracking
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def add_error(self, error: str) -> None:
        """Track an error that occurred during optimization.

        Args:
            error: Error message
        """
        self.errors.append(error)

    def add_warning(self, warning: str) -> None:
        """Track a warning that occurred during optimization.

        Args:
            warning: Warning message
        """
        self.warnings.append(warning)

    def has_errors(self) -> bool:
        """Check if any errors occurred during optimization.

        Returns:
            True if errors exist, False otherwise
        """
        return len(self.errors) > 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert context to dictionary for serialization.

        Returns:
            Dictionary representation of context state
        """
        return {
            "user_id": self.user_id,
            "consolidated_ingredients": [
                {
                    "name": ing.name,
                    "quantity": ing.quantity,
                    "unit": ing.unit,
                    "sources": ing.sources,
                    "confidence": ing.confidence,
                }
                for ing in self.consolidated_ingredients
            ],
            "bulk_opportunities": [
                {
                    "ingredient_name": opp.ingredient_name,
                    "standard_quantity": opp.standard_quantity,
                    "standard_unit": opp.standard_unit,
                    "bulk_quantity": opp.bulk_quantity,
                    "bulk_unit": opp.bulk_unit,
                    "standard_unit_cost": opp.standard_unit_cost,
                    "bulk_unit_cost": opp.bulk_unit_cost,
                    "savings_ratio": opp.savings_ratio,
                    "confidence_score": opp.confidence_score,
                    "storage_requirements": opp.storage_requirements,
                }
                for opp in self.bulk_opportunities
            ],
            "metrics": self.metrics,
            "total_cost": self.total_cost,
            "estimated_savings": self.estimated_savings,
            "optimization_score": self.optimization_score,
            "errors": self.errors,
            "warnings": self.warnings,
        }
