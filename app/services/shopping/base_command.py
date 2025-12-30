"""
Base Command for Shopping Optimization

Defines the abstract interface for all optimization commands.
Implements Command Pattern for shopping optimization workflow.

Task: Phase 2 Tarea 6 - Shopping Optimization Refactoring
"""

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .optimization_context import OptimizationContext


class OptimizationCommand(ABC):
    """Abstract base class for all shopping optimization commands.

    Each command encapsulates a specific optimization operation.
    Commands share state through OptimizationContext and execute in sequence.
    """

    @abstractmethod
    async def execute(self, context: "OptimizationContext") -> None:
        """Execute the optimization command with shared context.

        Args:
            context: OptimizationContext containing shared state for all commands

        Raises:
            Exception: Subclasses may raise specific exceptions on failure
        """
        pass

    @abstractmethod
    def get_command_name(self) -> str:
        """Get human-readable name for this command.

        Returns:
            Command name for logging and debugging
        """
        pass

    def __repr__(self) -> str:
        """String representation of command."""
        return f"{self.__class__.__name__}({self.get_command_name()})"
