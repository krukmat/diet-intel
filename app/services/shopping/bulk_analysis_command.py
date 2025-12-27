"""
Bulk Analysis Command for Shopping Optimization

Analyzes ingredients for bulk buying opportunities.
Uses existing BulkBuyingDetector logic wrapped as a Command.

Task: Phase 2 Tarea 6 - Shopping Optimization Refactoring
"""

import logging

from app.services.shopping_optimization import BulkBuyingDetector
from .base_command import OptimizationCommand
from .optimization_context import OptimizationContext, BulkOpportunity

logger = logging.getLogger(__name__)


class BulkAnalysisCommand(OptimizationCommand):
    """Command to analyze bulk buying opportunities.

    Examines consolidated ingredients for bulk buying potential,
    considering pricing, storage, and usage patterns.
    """

    def __init__(self):
        """Initialize bulk analysis command with detector."""
        self.detector = BulkBuyingDetector()

    async def execute(self, context: OptimizationContext) -> None:
        """Execute bulk opportunity analysis.

        Analyzes consolidated ingredients for bulk buying potential.
        Populates context with bulk_opportunities and updates metrics.

        Args:
            context: OptimizationContext with consolidated_ingredients
        """
        try:
            if not context.consolidated_ingredients:
                logger.warning("No consolidated ingredients for bulk analysis")
                return

            # Prepare ingredients for detector
            detector_input = [
                {
                    'ingredient_name': ing.name,
                    'quantity': ing.quantity,
                    'unit': ing.unit,
                }
                for ing in context.consolidated_ingredients
            ]

            # Detect bulk opportunities using existing detector
            opportunities = self.detector.detect_bulk_opportunities(detector_input)

            # Convert results to BulkOpportunity objects
            for opp in opportunities:
                bulk_opp = BulkOpportunity(
                    ingredient_name=opp.get('ingredient_name', ''),
                    standard_quantity=opp.get('standard_quantity', 0),
                    standard_unit=opp.get('standard_unit', ''),
                    bulk_quantity=opp.get('bulk_quantity', 0),
                    bulk_unit=opp.get('bulk_unit', ''),
                    standard_unit_cost=opp.get('standard_unit_cost', 0),
                    bulk_unit_cost=opp.get('bulk_unit_cost', 0),
                    savings_ratio=opp.get('savings_ratio', 0),
                    confidence_score=opp.get('confidence_score', 0),
                    storage_requirements=opp.get('storage_requirements', {})
                )
                context.bulk_opportunities.append(bulk_opp)

            # Update metrics
            context.metrics['bulk_analysis'] = {
                'analyzed_ingredients': len(detector_input),
                'bulk_opportunities': len(context.bulk_opportunities),
                'avg_savings_ratio': (
                    sum(opp.savings_ratio for opp in context.bulk_opportunities) /
                    max(len(context.bulk_opportunities), 1)
                ),
                'high_confidence_opportunities': sum(
                    1 for opp in context.bulk_opportunities
                    if opp.confidence_score >= 0.8
                )
            }

            logger.info(
                f"Found {len(context.bulk_opportunities)} bulk opportunities "
                f"from {len(detector_input)} ingredients"
            )

        except Exception as e:
            logger.error(f"Error in bulk analysis command: {e}")
            context.add_error(f"Bulk analysis failed: {str(e)}")
            raise

    def get_command_name(self) -> str:
        """Get command name for logging."""
        return "Bulk Opportunity Analysis"
