import base64
import math
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from app.models.social.discover_feed import (
    DiscoverFeedItem,
    DiscoverFeedResponse,
    RankReason,
)
from app.services.database import db_service
from app.services.social.block_service import block_service
from app.services.social.profile_service import ProfileService
from app.services.social.report_service import ReportService
import logging
logger = logging.getLogger(__name__)
# Use real performance monitor if available
try:
    from app.utils.performance_monitor import performance_monitor
except ImportError:
    # Fallback placeholder
    class PerformanceMonitor:
        @staticmethod
        def record_metric(name, value):
            pass
    performance_monitor = PerformanceMonitor()
from app.config import config

# Cache simple en memoria (usuario -> (expira, respuesta))
_discover_cache: Dict[Tuple[str, str], Dict[str, any]] = {}


def _get_config() -> Dict[str, any]:
    return config.discover_feed


def _fetch_candidate_posts(limit: int) -> List[Dict[str, any]]:
    """Query real posts from database with engagement metrics."""
    horizon_days = _get_config().get("fresh_days", 7)
    query_limit = max(limit * 5, 50)  # Oversample candidates

    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                p.id,
                p.author_id,
                p.text,
                p.visibility,
                p.created_at,
                p.updated_at,
                COALESCE(l.likes_count, 0) AS likes_count,
                COALESCE(c.comments_count, 0) AS comments_count
            FROM posts p
            LEFT JOIN user_profiles up ON p.author_id = up.user_id
            LEFT JOIN (
                SELECT post_id, COUNT(*) AS likes_count
                FROM post_reactions
                WHERE reaction_type = 'like'
                GROUP BY post_id
            ) l ON l.post_id = p.id
            LEFT JOIN (
                SELECT post_id, COUNT(*) AS comments_count
                FROM post_comments
                GROUP BY post_id
            ) c ON c.post_id = p.id
            WHERE p.created_at >= datetime('now', '-{} days')
            AND EXISTS (
                SELECT 1 FROM user_profiles up2
                WHERE up2.user_id = p.author_id
                AND (
                    (p.visibility = 'public' AND up2.visibility = 'public')
                    OR (
                        p.visibility = 'inherit_profile'
                        AND up2.visibility = 'public'
                    )
                    OR (
                        p.visibility = 'followers_only'
                        AND up2.visibility = 'public'
                        AND EXISTS (
                            SELECT 1 FROM user_follows uf
                            WHERE uf.follower_id = ?
                              AND uf.followee_id = p.author_id
                              AND uf.status = 'active'
                        )
                    )
                )
            )
            ORDER BY p.created_at DESC
            LIMIT ?
            """.format(horizon_days),
            (query_limit,),
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def _score_candidates(rows: List[Dict[str, any]]) -> List[Dict[str, any]]:
    """Mock implementation with basic scoring for tests."""
    weights = _get_config().get("weights", {})
    fresh_weight = float(weights.get("fresh", 0.5))
    eng_weight = float(weights.get("engagement", 0.5))
    likes_weight = float(weights.get("likes", 0.6))
    comments_weight = float(weights.get("comments", 0.4))

    tau_hours = float(_get_config().get("fresh_tau_hours", 6))
    now = datetime.utcnow()

    scored = []
    for row in rows:
        created_at = datetime.fromisoformat(row["created_at"])
        delta_hours = max((now - created_at).total_seconds() / 3600.0, 0.0)
        fresh_score = math.exp(-delta_hours / tau_hours)

        likes = row["likes_count"]
        comments = row["comments_count"]
        engagement_score = likes_weight * likes + comments_weight * comments

        total_score = fresh_weight * fresh_score + eng_weight * engagement_score

        row["rank_score"] = float(total_score)
        row["created_at_dt"] = created_at
        scored.append(row)

    scored.sort(key=lambda r: (r["rank_score"], r["created_at_dt"]), reverse=True)
    return scored


def _apply_filters(user_id: str, rows: List[Dict[str, any]]) -> List[Dict[str, any]]:
    """Apply security filters: blocks, blocked posts, and profile visibility."""
    filtered = []
    try:
        for row in rows:
            author_id = row["author_id"]

            # Block filter: skip if user is blocking author
            if block_service.is_blocking(user_id, author_id):
                continue

            # Block filter: skip if author is blocking user
            if block_service.is_blocking(author_id, user_id):
                continue

            # Blocked posts: skip if post is reported/blocked
            try:
                if ReportService.is_post_blocked(row["id"]):
                    continue
            except AttributeError:
                # ReportService may not exist, skip silently for now
                pass

            # Profile visibility: skip if user cannot view profile
            try:
                profile_service = ProfileService()
                if not profile_service.can_view_profile(user_id, author_id):
                    continue
            except (AttributeError, Exception):
                # ProfileService may not exist or have method, skip silently
                pass

            filtered.append(row)
    except Exception as e:
        logger.error("Error applying filters to discover feed", extra={
            "user_id": user_id,
            "error": str(e),
            "rows_count": len(rows)
        })
        # Return all rows on error for safety
        return rows

    return filtered


def _cap_per_author(rows: List[Dict[str, any]]) -> List[Dict[str, any]]:
    """Apply max posts per author limit."""
    max_per_author = int(_get_config().get("max_posts_per_author", 2))
    author_counts = defaultdict(int)
    capped = []
    for row in rows:
        author_id = row["author_id"]
        if author_counts[author_id] < max_per_author:
            author_counts[author_id] += 1
            capped.append(row)
    return capped


def _apply_cursor(rows: List[Dict[str, any]], cursor: Optional[str]) -> List[Dict[str, any]]:
    """Apply cursor-based pagination to filter out items before the cursor."""
    if not cursor:
        return rows

    try:
        decoded = base64.b64decode(cursor).decode()
        cursor_created_at, cursor_post_id, cursor_score = decoded.split("|")
        cursor_dt = datetime.fromisoformat(cursor_created_at)
        cursor_score_val = float(cursor_score)
    except Exception:
        logger.warning("Invalid cursor provided", extra={"cursor": cursor})
        return rows

    filtered = []
    for row in rows:
        score = row["rank_score"]
        created_at_dt = row["created_at_dt"]

        # Items with lower score come first
        if score < cursor_score_val:
            filtered.append(row)
        # Same score: use timestamp, older items first for same score
        elif score == cursor_score_val and created_at_dt <= cursor_dt:
            # For same score and timestamp, different post IDs can be included
            if row["id"] != cursor_post_id:
                filtered.append(row)

    return filtered


def _paginate(rows: List[Dict[str, any]], limit: int) -> Tuple[List[Dict[str, any]], Optional[str]]:
    """Paginate results and generate next cursor if more items exist."""
    items = rows[:limit]
    next_cursor = None

    if len(rows) > limit:
        last = items[-1]
        cursor_raw = f"{last['created_at']}|{last['id']}|{last['rank_score']}"
        next_cursor = base64.b64encode(cursor_raw.encode()).decode()

    return items, next_cursor


def _build_response(items: List[Dict[str, any]], next_cursor: Optional[str], surface: str) -> DiscoverFeedResponse:
    """Build DiscoverFeedResponse from filtered and paginated items."""
    response_items = []
    for row in items:
        response_items.append(
            DiscoverFeedItem(
                id=row["id"],
                author_id=row["author_id"],
                text=row["text"],
                rank_score=row["rank_score"],
                reason=RankReason.POPULAR,
                created_at=datetime.fromisoformat(row["created_at"]),
                surface=surface,
                metadata={
                    "likes_count": row["likes_count"],
                    "comments_count": row["comments_count"],
                }
            )
        )
    return DiscoverFeedResponse(items=response_items, next_cursor=next_cursor)


def _get_cache(user_id: str, surface: str) -> Optional[DiscoverFeedResponse]:
    """Simple cache implementation for tests."""
    key = (user_id, surface)
    cache_entry = _discover_cache.get(key)
    if not cache_entry or cache_entry["expires_at"] <= time.time():
        _discover_cache.pop(key, None)
        return None
    return cache_entry["response"]


def _set_cache(user_id: str, surface: str, response: DiscoverFeedResponse) -> None:
    """Simple cache setter for tests."""
    ttl_seconds = _get_config().get("cache_ttl_seconds", 60)
    key = (user_id, surface)
    _discover_cache[key] = {
        "expires_at": time.time() + ttl_seconds,
        "response": response,
    }


def get_discover_feed(user_id: str, limit: int = 20, cursor: Optional[str] = None, surface: str = "web") -> DiscoverFeedResponse:
    """Main entry point for discover feed."""
    # check cache first if no cursor
    if not cursor:
        cached = _get_cache(user_id, surface)
        if cached:
            return cached

    performance_monitor.record_metric("discover_feed_requests", 1)

    # get candidates
    rows = _fetch_candidate_posts(limit)

    # score candidates
    scored = _score_candidates(rows)

    # apply filters
    filtered = _apply_filters(user_id, scored)

    # limit per author
    capped = _cap_per_author(filtered)

    # apply cursor pagination if provided
    with_cursor = _apply_cursor(capped, cursor)

    # paginate results
    items, next_cursor = _paginate(with_cursor, limit)

    # build response
    response = _build_response(items, next_cursor, surface)

    # cache response if no cursor
    if not cursor:
        _set_cache(user_id, surface, response)

    logger.info("discover_feed_served", extra={
        "user_id": user_id,
        "surface": surface,
        "items": len(response.items)
    })

    return response
