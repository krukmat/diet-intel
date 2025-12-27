"""
Shopping Optimization Services

Command Pattern implementation for shopping optimization workflow.
Each optimization step is encapsulated as a command.

Task: Phase 2 Tarea 6 - Shopping Optimization Refactoring
"""

from .base_command import OptimizationCommand
from .optimization_context import (
    OptimizationContext,
    RecipeIngredient,
    ConsolidatedIngredient,
    BulkOpportunity,
)
from .consolidation_command import ConsolidationCommand
from .bulk_analysis_command import BulkAnalysisCommand

__all__ = [
    "OptimizationCommand",
    "OptimizationContext",
    "RecipeIngredient",
    "ConsolidatedIngredient",
    "BulkOpportunity",
    "ConsolidationCommand",
    "BulkAnalysisCommand",
]
