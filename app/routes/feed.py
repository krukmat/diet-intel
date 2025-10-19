"""
Feed routes for social activity feed.

EPIC_A.A4: Original activity feed
EPIC_A.A5: Extended with UGC posts feed
EPIC_B.B2: Discover feed endpoint with rate limiting and instrumentation
"""

from typing import Optional, Literal
import logging
from fastapi import APIRouter, Depends, Query, HTTPException
from app.models.user import User
from app.services.auth import get_current_user
from app.utils.feature_flags import assert_feature_enabled
from app.models.social.feed import FeedResponse
from app.models.social.discover_feed import (
    DiscoverFeedResponse,
    DiscoverFeedInteraction,
)
from app.services.social.feed_service import list_feed, list_following_posts
from app.services.social.discover_feed_service import (
    get_discover_feed,
    publish_discover_interaction_event,
)
from app.utils.rate_limiter import RateLimiter
from app.config import config

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/feed", response_model=FeedResponse)
async def get_feed(
    cursor: Optional[str] = Query(
        default=None, description="Base64 encoded cursor for pagination"
    ),
    limit: int = Query(
        default=20, ge=1, le=100, description="Maximum number of items to return"
    ),
    current_user: User = Depends(get_current_user),
):
    """
    Get social activity feed for the authenticated user.

    Returns recent social events like follows, blocks, etc. that are relevant to the user.
    """
    assert_feature_enabled("social_enabled")
    try:
        return list_feed(current_user.id, limit, cursor)
    except Exception as exc:
        logger.error("Failed to load feed", exc_info=exc)
        return FeedResponse(items=[], next_cursor=None)


@router.get("/feed/following", response_model=FeedResponse)
async def get_following_posts_feed(
    cursor: Optional[str] = Query(
        default=None, description="Base64 encoded cursor for pagination"
    ),
    limit: int = Query(
        default=20, ge=1, le=100, description="Maximum number of posts to return"
    ),
    current_user: User = Depends(get_current_user),
):
    """
    EPIC_A.A5: Get UGC posts feed from users that the authenticated user follows.

    Returns timeline of posts from followed users, respecting visibility rules.
    This is the main social content feed for browsing UGC.
    """
    assert_feature_enabled("social_enabled")
    try:
        return list_following_posts(current_user.id, limit, cursor)
    except Exception as exc:
        logger.error("Failed to load following feed", exc_info=exc)
        return FeedResponse(items=[], next_cursor=None)


# EPIC_B.B2: Rate limiter module-global for discover feed
discover_rate_limiter = RateLimiter(
    max_requests=config.discover_feed_rate_per_min,
    window_seconds=60,
)


@router.get("/feed/discover", response_model=DiscoverFeedResponse)
async def get_discover_feed_endpoint(
    limit: int = Query(
        default=20, ge=1, le=50, description="Cantidad de posts a retornar"
    ),
    cursor: Optional[str] = Query(
        default=None, description="Cursor opaco para paginado"
    ),
    surface: Literal["web", "mobile"] = Query(
        default="web", description="Superficie solicitante"
    ),
    current_user: User = Depends(get_current_user),
):
    """
    EPIC_B.B2: Get discover feed with rate limiting and instrumentation.

    Returns algorithmically ranked posts from all users for discovery.
    Implements rate limiting per user and full instrumentation for analytics.
    """
    assert_feature_enabled("social_enabled")
    assert_feature_enabled("discover_feed_enabled")

    if not discover_rate_limiter.allow(current_user.id):
        raise HTTPException(status_code=429, detail="Discover feed rate limit exceeded")

    try:
        response = get_discover_feed(
            user_id=current_user.id,
            limit=limit,
            cursor=cursor,
            surface=surface,
        )
        return response
    except Exception as exc:
        logger.error(
            "discover_feed_route_failed",
            extra={
                "user_id": current_user.id,
                "surface": surface,
                "error": str(exc),
            },
        )
        return DiscoverFeedResponse(items=[], next_cursor=None)


@router.post("/feed/discover/interactions")
async def record_discover_interaction(
    payload: DiscoverFeedInteraction,
    current_user: User = Depends(get_current_user),
):
    """
    EPIC_B.B6: Register discover feed interactions for analytics.
    """
    assert_feature_enabled("social_enabled")
    assert_feature_enabled("discover_feed_enabled")

    try:
        publish_discover_interaction_event(
            user_id=current_user.id,
            post_id=payload.post_id,
            action=payload.action,
            surface=payload.surface,
            variant=payload.variant or "control",
            request_id=payload.request_id or "",
            rank_score=payload.rank_score or 0.0,
            reason=payload.reason or "unknown",
        )
        logger.info(
            "discover_feed_interaction_recorded",
            extra={
                "user_id": current_user.id,
                "post_id": payload.post_id,
                "action": payload.action,
                "surface": payload.surface,
                "variant": payload.variant or "control",
            },
        )
        return {"ok": True}
    except Exception as exc:
        logger.error(
            "discover_feed_interaction_failed",
            extra={
                "user_id": current_user.id,
                "post_id": payload.post_id,
                "action": payload.action,
                "error": str(exc),
            },
        )
        raise HTTPException(status_code=500, detail="Unable to record interaction")
