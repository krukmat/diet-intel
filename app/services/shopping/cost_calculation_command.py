"""
Cost Calculation Command for Shopping Optimization

Calculates shopping costs and savings from bulk opportunities.

Task: Phase 2 Tarea 6 - Shopping Optimization Refactoring
"""

import logging

from .base_command import OptimizationCommand
from .optimization_context import OptimizationContext

logger = logging.getLogger(__name__)


class CostCalculationCommand(OptimizationCommand):
    """Command to calculate shopping costs and savings.

    Computes total shopping costs, bulk savings, and generates
    financial metrics for the optimization.
    """

    async def execute(self, context: OptimizationContext) -> None:
        """Execute cost calculations.

        Calculates total costs, bulk savings, and optimization score.
        Updates context with financial metrics.

        Args:
            context: OptimizationContext with ingredients and bulk opportunities
        """
        try:
            # Calculate ingredient costs
            ingredient_cost = self._calculate_ingredient_costs(context)

            # Calculate bulk savings
            bulk_savings = self._calculate_bulk_savings(context)

            # Calculate total cost and estimated savings
            context.total_cost = ingredient_cost
            context.estimated_savings = bulk_savings

            # Calculate optimization score (0.0 to 1.0)
            context.optimization_score = self._calculate_optimization_score(
                ingredient_cost, bulk_savings, len(context.consolidated_ingredients)
            )

            # Update metrics
            context.metrics['cost_analysis'] = {
                'total_ingredient_cost': round(ingredient_cost, 2),
                'bulk_savings': round(bulk_savings, 2),
                'savings_percentage': (
                    (bulk_savings / ingredient_cost * 100) if ingredient_cost > 0 else 0
                ),
                'optimization_score': round(context.optimization_score, 2),
                'cost_per_ingredient': round(ingredient_cost / max(len(context.consolidated_ingredients), 1), 2),
            }

            logger.info(
                f"Cost calculation: Total=${ingredient_cost:.2f}, "
                f"Savings=${bulk_savings:.2f}, Score={context.optimization_score:.2f}"
            )

        except Exception as e:
            logger.error(f"Error in cost calculation command: {e}")
            context.add_error(f"Cost calculation failed: {str(e)}")
            # Don't raise - cost calculation is non-critical

    def get_command_name(self) -> str:
        """Get command name for logging."""
        return "Cost Calculation"

    def _calculate_ingredient_costs(self, context: OptimizationContext) -> float:
        """Calculate total cost of all consolidated ingredients.

        Args:
            context: OptimizationContext with consolidated_ingredients

        Returns:
            Total ingredient cost
        """
        total_cost = 0.0

        for ingredient in context.consolidated_ingredients:
            # Estimate unit cost (simplified - would use pricing data in production)
            unit_cost = self._estimate_unit_cost(ingredient.name)
            total_quantity = ingredient.quantity

            # Calculate ingredient cost
            ingredient_cost = unit_cost * total_quantity
            total_cost += ingredient_cost

        return total_cost

    def _calculate_bulk_savings(self, context: OptimizationContext) -> float:
        """Calculate savings from bulk buying opportunities.

        Args:
            context: OptimizationContext with bulk_opportunities

        Returns:
            Total savings from bulk opportunities
        """
        total_savings = 0.0

        for opportunity in context.bulk_opportunities:
            # Standard cost vs bulk cost
            standard_total = opportunity.standard_unit_cost * opportunity.standard_quantity
            bulk_total = opportunity.bulk_unit_cost * opportunity.bulk_quantity

            # Savings for this opportunity
            opportunity_savings = standard_total - bulk_total
            total_savings += max(opportunity_savings, 0)  # Only count positive savings

        return total_savings

    def _calculate_optimization_score(
        self, total_cost: float, bulk_savings: float, ingredient_count: int
    ) -> float:
        """Calculate overall optimization score (0.0 to 1.0).

        Factors:
        - Savings percentage
        - Cost consolidation (fewer ingredients = better)
        - Minimum cost threshold

        Args:
            total_cost: Total ingredient cost
            bulk_savings: Bulk opportunity savings
            ingredient_count: Number of consolidated ingredients

        Returns:
            Optimization score from 0.0 to 1.0
        """
        if total_cost == 0:
            return 0.0

        # Savings ratio factor (0.0 to 1.0)
        savings_ratio = min(bulk_savings / total_cost, 1.0) if total_cost > 0 else 0.0

        # Consolidation factor (fewer ingredients = better)
        consolidation_factor = min(1.0 / max(ingredient_count / 10, 1.0), 1.0)

        # Cost efficiency factor (lower cost is better, optimal around $50)
        optimal_cost = 50.0
        cost_efficiency = 1.0 - min(abs(total_cost - optimal_cost) / (optimal_cost * 2), 1.0)

        # Weighted combination
        score = (
            0.5 * savings_ratio +      # Savings are most important
            0.3 * consolidation_factor +  # Consolidation quality
            0.2 * cost_efficiency        # Cost efficiency
        )

        return min(max(score, 0.0), 1.0)  # Clamp between 0 and 1

    def _estimate_unit_cost(self, ingredient_name: str) -> float:
        """Estimate unit cost for an ingredient.

        In production, this would look up actual pricing data.
        For now, use reasonable estimates based on ingredient type.

        Args:
            ingredient_name: Name of ingredient

        Returns:
            Estimated cost per unit
        """
        # Simplified pricing - would use actual data source in production
        ingredient_lower = ingredient_name.lower()

        # Basic price estimates by category
        if any(x in ingredient_lower for x in ['oil', 'butter', 'cream']):
            return 0.50  # $0.50 per unit (mL)
        elif any(x in ingredient_lower for x in ['flour', 'sugar', 'salt', 'spice']):
            return 0.10  # $0.10 per unit (g)
        elif any(x in ingredient_lower for x in ['chicken', 'beef', 'meat', 'fish']):
            return 3.00  # $3.00 per unit (oz)
        elif any(x in ingredient_lower for x in ['vegetable', 'carrot', 'onion', 'garlic']):
            return 0.30  # $0.30 per unit
        elif any(x in ingredient_lower for x in ['dairy', 'milk', 'cheese']):
            return 0.75  # $0.75 per unit
        else:
            return 0.50  # Default estimate
