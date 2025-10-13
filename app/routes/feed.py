"""
Feed routes for social activity feed.

EPIC_A.A4: Original activity feed
EPIC_A.A5: Extended with UGC posts feed
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.models.user import User
from app.services.auth import get_current_user
from app.utils.feature_flags import assert_feature_enabled
from app.models.social.feed import FeedResponse
from app.services.social.feed_service import list_feed, list_following_posts

router = APIRouter()


@router.get("/feed", response_model=FeedResponse)
async def get_feed(
    cursor: Optional[str] = Query(default=None, description="Base64 encoded cursor for pagination"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum number of items to return"),
    current_user: User = Depends(get_current_user)
):
    """
    Get social activity feed for the authenticated user.

    Returns recent social events like follows, blocks, etc. that are relevant to the user.
    """
    assert_feature_enabled("social_enabled")
    return list_feed(current_user.id, limit=limit, cursor=cursor)


@router.get("/feed/following", response_model=FeedResponse)
async def get_following_posts_feed(
    cursor: Optional[str] = Query(default=None, description="Base64 encoded cursor for pagination"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum number of posts to return"),
    current_user: User = Depends(get_current_user)
):
    """
    EPIC_A.A5: Get UGC posts feed from users that the authenticated user follows.

    Returns timeline of posts from followed users, respecting visibility rules.
    This is the main social content feed for browsing UGC.
    """
    assert_feature_enabled("social_enabled")
    return list_following_posts(current_user.id, limit=limit, cursor=cursor)
