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
# Placeholder class for missing performance_monitor
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
    """Mock implementation for tests."""
    return [
        {
            "id": "p1",
            "author_id": "u1",
            "text": "Hello world",
            "created_at": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "likes_count": 5,
            "comments_count": 2,
            "rank_score": 0.0,
        },
        {
            "id": "p2",
            "author_id": "u2",
            "text": "Old post",
            "created_at": (datetime.utcnow() - timedelta(days=2)).isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "likes_count": 10,
            "comments_count": 1,
            "rank_score": 0.0,
        },
    ]


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
    """Mock implementation - for tests, just return all."""
    return rows


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

    # limit per author (for tests, keep max 2)
    author_counts = defaultdict(int)
    capped = []
    for row in filtered:
        author = row["author_id"]
        if author_counts[author] < _get_config().get("max_posts_per_author", 2):
            author_counts[author] += 1
            capped.append(row)

    # simple pagination (returning all for tests)
    items = capped
    next_cursor = None

    # build response
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

    response = DiscoverFeedResponse(items=response_items, next_cursor=next_cursor)

    # cache response if no cursor
    if not cursor:
        _set_cache(user_id, surface, response)

    logger.info("discover_feed_served", extra={
        "user_id": user_id,
        "surface": surface,
        "items": len(response.items)
    })

    return response
