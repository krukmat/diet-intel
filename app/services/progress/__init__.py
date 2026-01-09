"""Progress Services - Modular progress calculation components.

FASE 2.b: Refactorización de TrackingService
Patrones: Strategy, Builder para cálculos de progreso nutricional.

Modules:
    progress_calculator: Strategy Pattern para cálculos de progreso
    nutrition_targets: Strategy Pattern para metas nutricionales
    progress_builder: Builder Pattern para construir DayProgressSummary

Usage:
    from app.services.progress import ProgressBuilder, ProgressCalculator
    
    builder = ProgressBuilder()
    progress = builder.with_consumed(calories=850)
                   .with_planned(calories=2000)
                   .build()
"""

from app.services.progress.progress_calculator import (
    ProgressCalculator,
    BasicProgressCalculator,
    CappedProgressCalculator,
    default_calculator
)

from app.services.progress.nutrition_targets import (
    NutritionTargets,
    NutritionTargetsStrategy,
    DefaultNutritionTargetsStrategy,
    UserProfileNutritionTargetsStrategy,
    NutritionTargetsProvider,
    default_targets_provider
)

from app.services.progress.progress_builder import (
    ProgressBuilder,
    ProgressSummaryFactory,
    default_builder,
    default_factory
)

__all__ = [
    # Calculator
    "ProgressCalculator",
    "BasicProgressCalculator", 
    "CappedProgressCalculator",
    "default_calculator",
    
    # Targets
    "NutritionTargets",
    "NutritionTargetsStrategy",
    "DefaultNutritionTargetsStrategy",
    "UserProfileNutritionTargetsStrategy",
    "NutritionTargetsProvider",
    "default_targets_provider",
    
    # Builder
    "ProgressBuilder",
    "ProgressSummaryFactory",
    "default_builder",
    "default_factory",
]
