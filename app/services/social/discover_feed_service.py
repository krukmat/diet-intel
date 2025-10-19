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
from uuid import uuid4
from app.services.experimentation.feed_experiments import feed_experiments

logger = logging.getLogger(__name__)

# Cache simple en memoria (usuario, superficie) -> (expira, respuesta)
_discover_cache: Dict[Tuple[str, str], Dict[str, Any]] = {}


def _get_config() -> Dict[str, Any]:
    return config.discover_feed


def _fetch_candidate_posts(user_id: str, limit: int) -> List[Dict[str, Any]]:
    """Query candidate posts from the database with engagement metrics."""
    horizon_days = int(_get_config().get("fresh_days", 7))
    trending_hours = 48  # Last 48 hours for trending content
    query_limit = max(limit * 5, 50)  # Oversample candidates for ranking

    # Get user's following for 2nd-degree posts
    following_users = _get_user_following(user_id)

    with db_service.get_connection() as conn:
        cursor = conn.cursor()

        # First query: Regular fresh posts
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
                COALESCE(c.comments_count, 0) AS comments_count,
                'fresh' AS source,
                DATETIME('now') as source_timestamp
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
            (query_limit // 2,),  # Split quota between sources
        )
        fresh_posts = [dict(row) for row in cursor.fetchall()]

        # Second query: Trending posts (high engagement in last 48h)
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
                COALESCE(c.comments_count, 0) AS comments_count,
                'trending' AS source,
                MAX(GREATEST(COALESCE(lr.created_at, p.created_at),
                           COALESCE(cr.created_at, p.created_at))) AS source_timestamp
            FROM posts p
            LEFT JOIN user_profiles up ON p.author_id = up.user_id
            LEFT JOIN (
                SELECT post_id, COUNT(*) AS likes_count
                FROM post_reactions
                WHERE reaction_type = 'like'
                  AND created_at >= datetime('now', '-{trending_hours} hours')
                GROUP BY post_id
            ) l ON l.post_id = p.id
            LEFT JOIN (
                SELECT post_id, COUNT(*) AS comments_count,
                       MAX(created_at) AS created_at
                FROM post_comments
                WHERE created_at >= datetime('now', '-{trending_hours} hours')
                GROUP BY post_id
            ) c ON c.post_id = p.id
            LEFT JOIN post_reactions lr ON lr.post_id = p.id
                                      AND lr.reaction_type = 'like'
                                      AND lr.created_at >= datetime('now', '-{trending_hours} hours')
            LEFT JOIN post_comments cr ON cr.post_id = p.id
                                       AND cr.created_at >= datetime('now', '-{trending_hours} hours')
            WHERE p.created_at >= datetime('now', '-{horizon_days} days')
              AND (COALESCE(l.likes_count, 0) + COALESCE(c.comments_count, 0)) >= 3  -- Min activity
            GROUP BY p.id, p.author_id, p.text, p.visibility, p.created_at, p.updated_at
            ORDER BY (COALESCE(l.likes_count, 0) + COALESCE(c.comments_count, 0)) DESC
            LIMIT ?
            """,
            (query_limit // 4,),  # 25% of quota for trending
        )
        trending_posts = [dict(row) for row in cursor.fetchall()]

        # Third query: 2nd-degree posts (followers of people I follow)
        if following_users:
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
                    COALESCE(c.comments_count, 0) AS comments_count,
                    '2nd_degree' AS source,
                    p.created_at AS source_timestamp
                FROM posts p
                INNER JOIN user_follows uf ON p.author_id = uf.follower_id  -- 2nd-degree connections
                                            AND uf.target_id IN ({','.join('?' for _ in following_users)})
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
                  AND p.author_id != ?  -- Exclude own posts
                ORDER BY p.created_at DESC
                LIMIT ?
                """,
                following_users + [user_id, query_limit // 4],  # 25% of quota for 2nd-degree
            )
            second_degree_posts = [dict(row) for row in cursor.fetchall()]
        else:
            second_degree_posts = []

        # Combine all sources
        all_posts = fresh_posts + trending_posts + second_degree_posts

        # Deduplicate by post ID (trending might overlap with fresh)
        seen_ids = set()
        unique_posts = []
        for post in all_posts:
            post_id = post.get('id')
            if post_id and post_id not in seen_ids:
                seen_ids.add(post_id)
                unique_posts.append(post)

        # Return top candidates
        return unique_posts[:query_limit]


def _get_user_following(user_id: str) -> List[str]:
    """Get list of users that the given user is following."""
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT target_id
            FROM user_follows
            WHERE follower_id = ? AND status = 'accepted'
            """,
            (user_id,),
        )
        return [row['target_id'] for row in cursor.fetchall()]


def _score_candidates(rows: List[Dict[str, Any]], weights: Dict[str, Any]) -> List[Dict[str, Any]]:
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


def _determine_reason(source: str, likes_count: int, comments_count: int, suggestions_count: int = 0) -> RankReason:
    """Determine the RankReason based on post characteristics."""
    if source == "trending":
        return RankReason.POPULAR
    elif source == "2nd_degree":
        return RankReason.SUGGESTED
    elif likes_count + comments_count >= 5:  # Threshold for popular
        return RankReason.POPULAR
    elif suggestions_count > 0:
        return RankReason.DIVERSITY
    else:
        return RankReason.FRESH


def _get_author_handle(author_id: str) -> str:
    """Get author's handle for display."""
    try:
        with db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT handle FROM user_profiles WHERE user_id = ?",
                (author_id,),
            )
            row = cursor.fetchone()
            return row["handle"] if row else author_id[:10]  # Fallback to truncated ID
    except Exception:
        return author_id[:10]  # Safe fallback


def _get_post_media(post_id: str) -> List[Dict[str, Any]]:
    """Get media attachments for a post."""
    try:
        with db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT type, url, alt_text, width, height
                FROM post_attachments
                WHERE post_id = ?
                ORDER BY created_at ASC
                """,
                (post_id,),
            )
            return [dict(row) for row in cursor.fetchall()]
    except Exception:
        return []


def _build_response(
    items: List[Dict[str, Any]],
    next_cursor: Optional[str],
    surface: str,
    variant: str,
    request_id: str,
) -> DiscoverFeedResponse:
    response_items: List[DiscoverFeedItem] = []
    for row in items:
        likes_count = row.get("likes_count", 0)
        comments_count = row.get("comments_count", 0)

        # Determine correct reason based on source and signals
        source = row.get("source", "fresh")
        suggestions_count = 1 if source == "2nd_degree" else 0  # Could be expanded
        reason = _determine_reason(source, likes_count, comments_count, suggestions_count)

        # Enrich with author handle
        author_handle = _get_author_handle(row["author_id"])

        # Get media attachments if any
        media = _get_post_media(row["id"])

        response_items.append(
            DiscoverFeedItem(
                id=row["id"],
                author_id=row["author_id"],
                author_handle=author_handle,
                text=row.get("text", ""),
                rank_score=row.get("rank_score", 0.0),
                reason=reason,
                created_at=datetime.fromisoformat(row["created_at"]),
                surface=surface,
                media=media,  # Add media support
                metadata={
                    "likes_count": likes_count,
                    "comments_count": comments_count,
                    "source": source,
                    "engagement_signals": f"L{likes_count}C{comments_count}",
                },
            )
        )

    return DiscoverFeedResponse(
        items=response_items,
        next_cursor=next_cursor,
        variant=variant,
        request_id=request_id,
    )


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
    request_id = str(uuid4())
    weights_info = feed_experiments.get_feed_weights(user_id)
    weights = weights_info.get("weights", _get_config().get("weights", {}))
    variant = weights_info.get("variant", "control")

    response = DiscoverFeedResponse(items=[], next_cursor=None, variant=variant, request_id=request_id)
    success = True
    cache_hit = False

    try:
        if not cursor:
            cached = _get_cache(user_id, surface)
            if cached:
                cache_hit = True
                variant = cached.variant or variant
                response = DiscoverFeedResponse(
                    items=cached.items,
                    next_cursor=cached.next_cursor,
                    variant=variant,
                    request_id=request_id,
                )

        if not cache_hit:
            rows = _fetch_candidate_posts(user_id, limit)
            scored = _score_candidates(rows, weights)
            filtered = _apply_filters(user_id, scored)
            capped = _cap_per_author(filtered)
            with_cursor = _apply_cursor(capped, cursor)
            items, next_cursor = _paginate(with_cursor, limit)
            response = _build_response(items, next_cursor, surface, variant, request_id)

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
                "variant": response.variant,
                "request_id": response.request_id,
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
            # EPIC_B.B6: Prometheus metrics concretas
            # discover_feed_requests_total counter
            performance_monitor.record_metric(
                PerformanceMetric(
                    timestamp=datetime.utcnow(),
                    metric_type="counter",
                    operation="discover_feed_requests_total",
                    duration_ms=duration_ms,
                    success=success,
                    metadata={
                        "surface": surface,
                        "variant": response.variant,
                        "cache_hit": cache_hit,
                    },
                )
            )

            # discover_feed_variant_distribution counter per variant
            performance_monitor.record_metric(
                PerformanceMetric(
                    timestamp=datetime.utcnow(),
                    metric_type="counter",
                    operation="discover_feed_variant_distribution",
                    duration_ms=duration_ms,
                    success=success,
                    metadata={
                        "variant": response.variant,
                        "surface": surface,
                        "cache_hit": cache_hit,
                    },
                )
            )

            # discover_feed_cache_hit_ratio calculated gauge
            # Records individual requests for ratio calculation
            performance_monitor.record_metric(
                PerformanceMetric(
                    timestamp=datetime.utcnow(),
                    metric_type="gauge",
                    operation="discover_feed_cache_status",
                    duration_ms=duration_ms,
                    success=success,
                    metadata={
                        "cache_hit": 1 if cache_hit else 0,
                        "total_requests": 1,  # For aggregation
                        "surface": surface,
                    },
                )
            )

            # Original duration metrics
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
                        "variant": response.variant,
                        "request_id": response.request_id,
                    },
                )
            )
            performance_monitor.record_metric(
                PerformanceMetric(
                    timestamp=datetime.utcnow(),
                    metric_type="api_call",
                    operation=f"discover_feed_{surface}",
                    duration_ms=duration_ms,
                    success=success,
                    metadata={
                        "surface": surface,
                        "cache_hit": cache_hit,
                        "item_count": len(response.items),
                        "has_cursor": bool(cursor),
                        "variant": response.variant,
                        "request_id": response.request_id,
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
                    "cursor": response.next_cursor,
                    "variant": response.variant,
                    "request_id": response.request_id,
                    "served_at": datetime.utcnow().isoformat(),
                },
            )
        except Exception as exc:  # pragma: no cover - defensivo
            logger.warning(
                "discover_feed_event_failed",
                extra={"user_id": user_id, "post_id": item.id, "error": str(exc)},
            )


def publish_discover_interaction_event(
    user_id: str,
    post_id: str,
    action: str,
    surface: str,
    variant: str,
    request_id: str,
    rank_score: float = 0.0,
    reason: str = "unknown",
) -> None:
    """Publish discover feed interaction events (click/dismiss)."""
    if action not in ["click", "dismiss"]:
        logger.warning(
            "invalid_discover_action",
            extra={"user_id": user_id, "post_id": post_id, "action": action},
        )
        return

    event_type = (
        FeedEvent.DISCOVER_FEED_CLICKED
        if action == "click"
        else FeedEvent.DISCOVER_FEED_DISMISSED
    )

    try:
        publish_event(
            event_type.value,
            {
                "viewer_id": user_id,
                "post_id": post_id,
                "action": action,
                "surface": surface,
                "variant": variant,
                "request_id": request_id,
                "rank_score": rank_score,
                "reason": reason,
                "interacted_at": datetime.utcnow().isoformat(),
            },
        )
    except Exception as exc:
        logger.warning(
            "discover_interaction_event_failed",
            extra={"user_id": user_id, "post_id": post_id, "action": action, "error": str(exc)},
        )
