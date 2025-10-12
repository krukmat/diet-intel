"""
Profile routes for EPIC_A.A1 - View Profile

Provides profile viewing and editing endpoints.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from app.models.user import User
from app.services.auth import get_current_user
from app.models.social import ProfileUpdateRequest
from app.services.social.profile_service import profile_service
from app.utils.feature_flags import assert_feature_enabled

router = APIRouter(prefix="/profiles", tags=["profiles"])


async def get_current_user_optional(
    token: Optional[str] = Query(None, alias="token")
) -> Optional[User]:
    """
    Optional authentication dependency that returns None if no valid auth.
    Captures HTTPException and returns None instead.
    """
    try:
        # Try to get current user - if it fails, return None
        return await get_current_user(token)
    except HTTPException:
        return None


@router.get("/me", description="Get current user's profile")
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """
    Get current user's own profile with full visibility.

    Since current_user.id == viewer_id, this always shows own posts.
    """
    assert_feature_enabled("social_enabled")

    profile = await profile_service.get_profile(current_user.id, current_user.id)
    return profile.dict()


@router.get("/{user_id}", description="Get user profile by ID")
async def get_user_profile(
    user_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get another user's profile with visibility filtering.

    viewer_id is set from authentication if present.
    """
    assert_feature_enabled("social_enabled")

    viewer_id = current_user.id if current_user else None
    profile = await profile_service.get_profile(user_id, viewer_id)
    return profile.dict()


@router.patch("/me", description="Update current user's profile")
async def update_my_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Update current user's profile with validation.

    Returns updated profile after changes.
    """
    assert_feature_enabled("social_enabled")

    await profile_service.update_profile(current_user.id, payload)
    # Return updated profile
    updated_profile = await profile_service.get_profile(current_user.id, current_user.id)
    return updated_profile.dict()


@router.get("/{user_id}/followers", description="Get user followers")
async def get_user_followers(user_id: str):
    """
    Get followers for a user - stub for A1.

    TODO: Implement in A2 with real follow relationships.
    """
    assert_feature_enabled("social_enabled")

    return {
        "items": [],
        "next_cursor": None
    }


@router.get("/{user_id}/following", description="Get users followed by user")
async def get_user_following(user_id: str):
    """
    Get users followed by this user - stub for A1.

    TODO: Implement in A2 with real follow relationships.
    """
    assert_feature_enabled("social_enabled")

    return {
        "items": [],
        "next_cursor": None
    }
