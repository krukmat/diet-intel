"""Track routes module - Refactored for lower cyclomatic complexity."""

from app.routes.track.router import router, tracking_service

__all__ = ["router", "tracking_service"]
