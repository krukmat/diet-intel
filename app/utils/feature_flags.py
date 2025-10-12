"""
Feature flags utility for DietIntel API.

Allows disabling/enabling major features at runtime via configuration.
"""

from fastapi import HTTPException
from app.config import config


def assert_feature_enabled(feature_name: str) -> None:
    """
    Assert that a specific feature is enabled.

    Args:
        feature_name: Name of the feature to check (e.g., "social_enabled")

    Raises:
        HTTPException: If the feature is disabled (404 - Feature Not Found)
    """
    if not getattr(config, feature_name, False):
        raise HTTPException(
            status_code=404,
            detail=f"Feature '{feature_name}' is not enabled"
        )
