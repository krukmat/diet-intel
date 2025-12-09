"""
EPIC_A.A2: Follow routes (skeleton)

POST /follows/{target_id} — follow/unfollow
GET  /profiles/{user_id}/followers
GET  /profiles/{user_id}/following
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.models.user import User
from app.services.auth import get_current_user, get_optional_user
from app.utils.feature_flags import assert_feature_enabled
from app.models.social.follow import FollowActionRequest, FollowListResponse, FollowActionResponse
from app.services.social.follow_service import follow_service

router = APIRouter()


@router.post("/follows/{target_id}", response_model=FollowActionResponse)
async def follow_toggle(target_id: str, req: FollowActionRequest, current_user: User = Depends(get_current_user)):
    assert_feature_enabled("social_enabled")
    # Skeleton: no-op response until service is implemented
    if req.action == 'follow':
        return await follow_service.follow_user(current_user.id, target_id)
    else:
        return await follow_service.unfollow_user(current_user.id, target_id)


@router.get("/profiles/{user_id}/followers", response_model=FollowListResponse)
async def get_followers(
    user_id: str,
    cursor: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: Optional[User] = Depends(get_optional_user)
):
    assert_feature_enabled("social_enabled")
    return await follow_service.list_followers(user_id, limit=limit, cursor=cursor)


@router.get("/profiles/{user_id}/following", response_model=FollowListResponse)
async def get_following(
    user_id: str,
    cursor: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: Optional[User] = Depends(get_optional_user)
):
    assert_feature_enabled("social_enabled")
    return await follow_service.list_following(user_id, limit=limit, cursor=cursor)
