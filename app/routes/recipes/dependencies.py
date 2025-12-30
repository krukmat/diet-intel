"""
Shared dependencies and utilities for Recipe AI routes

Contains common utilities used across all recipe route modules:
- User dependency functions
- Request/response converters
- Logging helpers

Task: Phase 2 Tarea 7 - Recipe AI Routes Refactoring
"""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

from app.models.recipe import RecipeGenerationRequest
from app.services.recipe_ai_engine import RecipeAIEngine, RecipeGenerationRequest as EngineRequest
from app.services.auth import get_current_user, get_optional_user
from app.models.user import User


security = HTTPBearer(auto_error=False)
optional_security = HTTPBearer(auto_error=False)


async def current_user_dependency(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> User:
    """
    Wrapper that allows patching get_current_user in tests.

    FastAPI stores the dependency callable at declaration time, so routing through
    this helper ensures we always look up the latest symbol when the request runs.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    dependency = get_current_user
    return await dependency(credentials)


async def optional_user_dependency(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
) -> Optional[User]:
    """
    Optional user dependency wrapper for public endpoints.

    Returns None if no credentials provided, otherwise returns authenticated user.
    """
    if credentials is None:
        return None
    dependency = get_optional_user
    return await dependency(credentials)


def convert_to_engine_request(
    api_request: RecipeGenerationRequest, user_id: str
) -> EngineRequest:
    """
    Convert API request model to RecipeAIEngine request model.

    Args:
        api_request: RecipeGenerationRequest from API
        user_id: User ID from authentication

    Returns:
        EngineRequest for RecipeAIEngine processing
    """
    return EngineRequest(
        cuisine_type=api_request.cuisine_type,
        difficulty_level=api_request.difficulty_level,
        prep_time_minutes=api_request.prep_time_minutes,
        dietary_restrictions=api_request.dietary_restrictions,
        cuisine_preferences=api_request.cuisine_preferences,
        disliked_ingredients=api_request.disliked_ingredients,
        target_calories=api_request.target_calories,
        nutritional_focus=api_request.nutritional_focus,
        servings=api_request.servings,
        use_pantry_items=api_request.use_pantry_items,
        pantry_items=api_request.pantry_items,
        user_id=user_id
    )
