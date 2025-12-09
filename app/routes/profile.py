"""
Profile routes for EPIC_A.A1 - View Profile

Provides profile viewing and editing endpoints.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from app.models.user import User
from app.services.auth import get_current_user, get_optional_user
from app.models.social import ProfileUpdateRequest
from app.models.social.follow import FollowActionRequest
from app.services.social.profile_service import profile_service
from app.services.social.follow_service import follow_service
from app.utils.feature_flags import assert_feature_enabled

router = APIRouter(prefix="/profiles", tags=["profiles"])


 # use optional auth dependency provided by auth service


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
    current_user: Optional[User] = Depends(get_optional_user)
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


@router.post("/{target_id}/follow", description="Follow or unfollow a user")
async def follow_user_action(
    target_id: str,
    payload: FollowActionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Follow or unfollow a user with business logic validation.

    Supported actions: 'follow', 'unfollow'
    Returns updated follow relationship status and counters.
    """
    assert_feature_enabled("social_enabled")

    if payload.action == "follow":
        result = await follow_service.follow_user(current_user.id, target_id)
    elif payload.action == "unfollow":
        result = await follow_service.unfollow_user(current_user.id, target_id)
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'follow' or 'unfollow'.")

    return result.dict()


@router.get("/{user_id}/followers", description="Get user followers")
async def get_user_followers(
    user_id: str,
    limit: int = 20,
    cursor: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get followers for a user with real follow relationships.

    Returns paginated list of users following this user,
    with their handle, avatar, and follow date.
    """
    assert_feature_enabled("social_enabled")

    result = await follow_service.list_followers(user_id, limit, cursor)
    return result.dict()


@router.get("/{user_id}/following", description="Get users followed by user")
async def get_user_following(
    user_id: str,
    limit: int = 20,
    cursor: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get users followed by this user with real follow relationships.

    Returns paginated list of users being followed,
    with their handle, avatar, and follow date.
    """
    assert_feature_enabled("social_enabled")

    result = await follow_service.list_following(user_id, limit, cursor)
    return result.dict()
