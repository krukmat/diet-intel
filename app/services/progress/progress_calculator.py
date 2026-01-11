"""Progress Calculator - Strategy Pattern for calculating nutritional progress.

FASE 2.b: Refactorización de TrackingService
Patrón Strategy: Encapsula algoritmos de cálculo de progreso.
"""

from app.models.tracking import DayProgress
from dataclasses import dataclass
from typing import Protocol, Optional


class ProgressCalculationStrategy(Protocol):
    """Protocol for progress calculation strategies."""
    
    def calculate(self, consumed: float, planned: float) -> DayProgress:
        """Calculate progress for a single nutrient."""
        ...


class BasicProgressCalculator:
    """Basic progress calculation without limits.
    
    Simple strategy that calculates percentage directly.
    Supports values > 100% for over-consuming scenarios.
    """
    
    def calculate(self, consumed: float, planned: float) -> DayProgress:
        """Calculate progress with basic formula.
        
        Args:
            consumed: Amount consumed
            planned: Planned amount (target)
            
        Returns:
            DayProgress with calculated percentage
        """
        # Handle edge case: no target set
        if planned <= 0:
            return DayProgress(
                consumed=round(consumed, 1),
                planned=0,
                percentage=0.0
            )
        
        percentage = (consumed / planned) * 100
        
        return DayProgress(
            consumed=round(consumed, 1),
            planned=round(planned, 1),
            percentage=round(percentage, 1)
        )


class CappedProgressCalculator:
    """Progress calculation with capped percentage.
    
    Strategy that limits percentage to 100%.
    Useful for UI displays where over-progress isn't shown.
    """
    
    def calculate(self, consumed: float, planned: float) -> DayProgress:
        """Calculate progress with capped percentage.
        
        Args:
            consumed: Amount consumed
            planned: Planned amount (target)
            
        Returns:
            DayProgress with percentage capped at 100
        """
        if planned <= 0:
            return DayProgress(
                consumed=round(consumed, 1),
                planned=0,
                percentage=0.0
            )
        
        raw_percentage = (consumed / planned) * 100
        capped_percentage = min(raw_percentage, 100.0)
        
        return DayProgress(
            consumed=round(consumed, 1),
            planned=round(planned, 1),
            percentage=round(capped_percentage, 1)
        )


class ProgressCalculator:
    """Context class that uses a progress calculation strategy.
    
    FASE 2.b: Main entry point for progress calculations.
    Uses Strategy Pattern to allow different calculation methods.
    """
    
    def __init__(self, strategy: Optional[ProgressCalculationStrategy] = None):
        """Initialize calculator with optional custom strategy.
        
        Args:
            strategy: Calculation strategy (defaults to BasicProgressCalculator)
        """
        self._strategy = strategy or BasicProgressCalculator()
    
    def set_strategy(self, strategy: ProgressCalculationStrategy) -> None:
        """Change the calculation strategy at runtime.
        
        Args:
            strategy: New calculation strategy to use
        """
        self._strategy = strategy
    
    def calculate(self, consumed: float, planned: float) -> DayProgress:
        """Calculate progress using current strategy.
        
        Args:
            consumed: Amount consumed
            planned: Planned amount (target)
            
        Returns:
            DayProgress with calculated percentage
        """
        return self._strategy.calculate(consumed, planned)
    
    def calculate_with_delta(
        self,
        base_consumed: float,
        additional_consumed: float,
        planned: float
    ) -> DayProgress:
        """Calculate progress after adding additional consumption.
        
        Useful when updating progress incrementally.
        
        Args:
            base_consumed: Previously consumed amount
            additional_consumed: Newly consumed amount
            planned: Planned amount (target)
            
        Returns:
            Updated DayProgress
        """
        new_total = base_consumed + additional_consumed
        return self.calculate(new_total, planned)


# Default calculator instance for easy imports
default_calculator = ProgressCalculator()
