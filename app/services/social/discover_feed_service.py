"""Discover feed service with algorithmic ranking, instrumentation, and analytics."""

from __future__ import annotations

import base64
import math
import time
import logging
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.config import config
from app.models.social.discover_feed import (
    DiscoverFeedItem,
    DiscoverFeedResponse,
    RankReason,
)
from app.services.database import db_service
from app.services.performance_monitor import PerformanceMetric, performance_monitor
from app.services.social.block_service import block_service
from app.services.social.event_names import FeedEvent
from app.services.social.event_publisher import publish_event
from app.services.social.profile_service import ProfileService
from app.services.social.report_service import ReportService

logger = logging.getLogger(__name__)

# Cache simple en memoria (usuario, superficie) -> (expira, respuesta)
_discover_cache: Dict[Tuple[str, str], Dict[str, Any]] = {}


def _get_config() -> Dict[str, Any]:
    return config.discover_feed


def _fetch_candidate_posts(user_id: str, limit: int) -> List[Dict[str, Any]]:
    """Query candidate posts from the database with engagement metrics."""
    horizon_days = int(_get_config().get("fresh_days", 7))
    query_limit = max(limit * 5, 50)  # Oversample candidates for ranking

    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"""
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
            WHERE p.created_at >= datetime('now', '-{horizon_days} days')
            ORDER BY p.created_at DESC
            LIMIT ?
            """,
            (query_limit,),
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def _score_candidates(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    weights = _get_config().get("weights", {})
    fresh_weight = float(weights.get("fresh", 0.5))
    engagement_weight = float(weights.get("engagement", 0.5))
    likes_weight = float(weights.get("likes", 0.6))
    comments_weight = float(weights.get("comments", 0.4))

    tau_hours = float(_get_config().get("fresh_tau_hours", 6))
    now = datetime.utcnow()

    scored: List[Dict[str, Any]] = []
    for row in rows:
        created_at_str = row.get("created_at")
        if not created_at_str:
            continue

        created_at = datetime.fromisoformat(created_at_str)
        delta_hours = max((now - created_at).total_seconds() / 3600.0, 0.0)
        fresh_score = math.exp(-delta_hours / tau_hours)

        likes = float(row.get("likes_count", 0))
        comments = float(row.get("comments_count", 0))
        engagement_score = likes_weight * likes + comments_weight * comments

        total_score = fresh_weight * fresh_score + engagement_weight * engagement_score

        row["rank_score"] = float(total_score)
        row["created_at_dt"] = created_at
        scored.append(row)

    scored.sort(key=lambda r: (r["rank_score"], r["created_at_dt"]), reverse=True)
    return scored


def _apply_filters(user_id: str, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Apply moderation and visibility filters."""
    filtered: List[Dict[str, Any]] = []
    profile_service = ProfileService()

    for row in rows:
        author_id = row.get("author_id")
        if not author_id:
            continue

        # Mutual blocks
        if block_service.is_blocking(user_id, author_id):
            continue
        if block_service.is_blocking(author_id, user_id):
            continue

        # Reported content
        try:
            if ReportService.is_post_blocked(row["id"]):
                continue
        except Exception as exc:  # pragma: no cover - defensivo
            logger.debug(
                "report_service_check_failed",
                extra={"post_id": row.get("id"), "error": str(exc)},
            )

        # Profile visibility
        try:
            if not profile_service.can_view_profile(user_id, author_id):
                continue
        except Exception as exc:  # pragma: no cover - defensivo
            logger.debug(
                "profile_visibility_check_failed",
                extra={"viewer_id": user_id, "author_id": author_id, "error": str(exc)},
            )
            continue

        filtered.append(row)

    return filtered


def _cap_per_author(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    max_per_author = int(_get_config().get("max_posts_per_author", 2))
    counts: Dict[str, int] = defaultdict(int)
    capped: List[Dict[str, Any]] = []

    for row in rows:
        author_id = row.get("author_id")
        if not author_id:
            continue

        if counts[author_id] < max_per_author:
            counts[author_id] += 1
            capped.append(row)

    return capped


def _apply_cursor(
    rows: List[Dict[str, Any]], cursor: Optional[str]
) -> List[Dict[str, Any]]:
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

    filtered: List[Dict[str, Any]] = []
    for row in rows:
        score = row.get("rank_score", 0.0)
        created_at_dt = row.get("created_at_dt")

        if row.get("id") == cursor_post_id:
            continue

        if score < cursor_score_val:
            filtered.append(row)
        elif score == cursor_score_val and created_at_dt and created_at_dt <= cursor_dt:
            filtered.append(row)

    return filtered


def _paginate(
    rows: List[Dict[str, Any]], limit: int
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    items = rows[:limit]
    next_cursor = None

    if len(rows) > limit and items:
        last = items[-1]
        cursor_raw = f"{last['created_at']}|{last['id']}|{last['rank_score']}"
        next_cursor = base64.b64encode(cursor_raw.encode()).decode()

    return items, next_cursor


def _build_response(
    items: List[Dict[str, Any]],
    next_cursor: Optional[str],
    surface: str,
) -> DiscoverFeedResponse:
    response_items: List[DiscoverFeedItem] = []
    for row in items:
        response_items.append(
            DiscoverFeedItem(
                id=row["id"],
                author_id=row["author_id"],
                text=row.get("text", ""),
                rank_score=row.get("rank_score", 0.0),
                reason=RankReason.POPULAR,
                created_at=datetime.fromisoformat(row["created_at"]),
                surface=surface,
                metadata={
                    "likes_count": row.get("likes_count", 0),
                    "comments_count": row.get("comments_count", 0),
                },
            )
        )

    return DiscoverFeedResponse(items=response_items, next_cursor=next_cursor)


def _get_cache(user_id: str, surface: str) -> Optional[DiscoverFeedResponse]:
    key = (user_id, surface)
    cache_entry = _discover_cache.get(key)
    if not cache_entry:
        return None

    if cache_entry["expires_at"] <= time.time():
        _discover_cache.pop(key, None)
        return None

    return cache_entry["response"]


def _set_cache(user_id: str, surface: str, response: DiscoverFeedResponse) -> None:
    ttl_seconds = int(_get_config().get("cache_ttl_seconds", 60))
    key = (user_id, surface)
    _discover_cache[key] = {
        "expires_at": time.time() + ttl_seconds,
        "response": response,
    }


def get_discover_feed(
    user_id: str,
    limit: int = 20,
    cursor: Optional[str] = None,
    surface: str = "web",
) -> DiscoverFeedResponse:
    """Main entry point for discover feed."""
    start_time = time.perf_counter()
    response = DiscoverFeedResponse(items=[], next_cursor=None)
    success = True
    cache_hit = False

    try:
        if not cursor:
            cached = _get_cache(user_id, surface)
            if cached:
                cache_hit = True
                response = cached

        if not cache_hit:
            rows = _fetch_candidate_posts(user_id, limit)
            scored = _score_candidates(rows)
            filtered = _apply_filters(user_id, scored)
            capped = _cap_per_author(filtered)
            with_cursor = _apply_cursor(capped, cursor)
            items, next_cursor = _paginate(with_cursor, limit)
            response = _build_response(items, next_cursor, surface)

            if not cursor:
                _set_cache(user_id, surface, response)

        if response.items:
            _publish_served_event(user_id, surface, response, cache_hit)

        logger.info(
            "discover_feed_served",
            extra={
                "user_id": user_id,
                "surface": surface,
                "items": len(response.items),
                "cache_hit": cache_hit,
            },
        )

        return response

    except Exception as exc:
        success = False
        logger.exception(
            "discover_feed_failed",
            extra={"user_id": user_id, "surface": surface, "error": str(exc)},
        )
        return response

    finally:
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        try:
            performance_monitor.record_metric(
                PerformanceMetric(
                    timestamp=datetime.utcnow(),
                    metric_type="api_call",
                    operation="discover_feed",
                    duration_ms=duration_ms,
                    success=success,
                    metadata={
                        "surface": surface,
                        "cache_hit": cache_hit,
                        "item_count": len(response.items),
                        "has_cursor": bool(cursor),
                    },
                )
            )
        except Exception as exc:  # pragma: no cover - defensivo
            logger.debug(
                "discover_feed_metric_failed",
                extra={"error": str(exc)},
            )


def _publish_served_event(
    user_id: str,
    surface: str,
    response: DiscoverFeedResponse,
    cache_hit: bool,
) -> None:
    """Publish analytics events for each served discover feed item."""
    for item in response.items:
        try:
            publish_event(
                FeedEvent.DISCOVER_FEED_SERVED.value,
                {
                    "viewer_id": user_id,
                    "post_id": item.id,
                    "author_id": item.author_id,
                    "rank_score": item.rank_score,
                    "reason": item.reason.value,
                    "surface": surface,
                    "cache_hit": cache_hit,
                    "served_at": datetime.utcnow().isoformat(),
                },
            )
        except Exception as exc:  # pragma: no cover - defensivo
            logger.warning(
                "discover_feed_event_failed",
                extra={"user_id": user_id, "post_id": item.id, "error": str(exc)},
            )
