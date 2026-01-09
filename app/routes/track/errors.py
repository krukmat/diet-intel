"""Centralized error handlers for track routes."""

import logging
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


class TrackError(Exception):
    """Base exception for track errors."""
    
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class MealNotFoundError(TrackError):
    """Raised when a meal is not found."""
    
    def __init__(self, meal_id: str):
        super().__init__(
            message=f"Meal with id {meal_id} not found",
            status_code=status.HTTP_404_NOT_FOUND
        )


class MealTrackingError(TrackError):
    """Raised when meal tracking fails."""
    
    def __init__(self, message: str, is_validation: bool = False):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST if is_validation else status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class WeightTrackingError(TrackError):
    """Raised when weight tracking fails."""
    
    def __init__(self, message: str):
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def handle_track_error(operation: str, error: Exception) -> None:
    """Convert TrackError or other exceptions to HTTPException.
    
    Args:
        operation: Name of the operation for logging
        error: The exception to handle
        
    Raises:
        HTTPException: With appropriate status code
    """
    if isinstance(error, MealNotFoundError):
        logger.warning(f"Meal not found during {operation}: {error.message}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error.message)
    
    if isinstance(error, MealTrackingError):
        logger.error(f"Meal tracking error during {operation}: {error.message}")
        raise HTTPException(status_code=error.status_code, detail=error.message)
    
    if isinstance(error, WeightTrackingError):
        logger.error(f"Weight tracking error during {operation}: {error.message}")
        raise HTTPException(status_code=error.status_code, detail=error.message)
    
    if isinstance(error, HTTPException):
        raise error
    
    # Generic error handling
    logger.error(f"Unexpected error during {operation}: {str(error)}")
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Failed to {operation}: {str(error)}"
    )


def log_operation(operation: str, user_id: str, details: str = "") -> None:
    """Log an operation with consistent format."""
    msg = f"{operation} for user {user_id}"
    if details:
        msg += f": {details}"
    logger.info(msg)
