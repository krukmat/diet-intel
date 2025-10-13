"""
Feed service for social activity feed management.

EPIC_A.A4: Service layer for feed operations with pagination.
"""

import logging
import base64
import json
from typing import Optional, List
from datetime import datetime

from app.services.database import db_service
from app.models.social.feed import FeedItem, FeedResponse

logger = logging.getLogger(__name__)


def list_feed(user_id: str, limit: int = 20, cursor: Optional[str] = None) -> FeedResponse:
    """
    Get paginated feed for a user.

    Args:
        user_id: User ID to get feed for
        limit: Maximum number of items to return
        cursor: Base64 encoded cursor for pagination (created_at|id)

    Returns:
        FeedResponse with items and optional next_cursor
    """
    try:
        with db_service.get_connection() as conn:
            cursor_obj = conn.cursor()

            # Decode cursor if provided
            where_clause = "WHERE user_id = ?"
            params = [user_id]

            if cursor:
                try:
                    cursor_data = base64.b64decode(cursor).decode('utf-8')
                    created_at_str, item_id = cursor_data.split('|')

                    # Convert back to datetime for comparison
                    cursor_created_at = datetime.fromisoformat(created_at_str)

                    where_clause += " AND (created_at < ? OR (created_at = ? AND id < ?))"
                    params.extend([cursor_created_at.isoformat(), cursor_created_at.isoformat(), item_id])

                except (ValueError, UnicodeDecodeError) as e:
                    logger.warning(f"Invalid cursor format: {cursor}, error: {e}")
                    # Continue without cursor filtering

            # Get items with one extra to determine if there are more
            query = f"""
                SELECT id, user_id, actor_id, event_name, payload, created_at
                FROM social_feed
                {where_clause}
                ORDER BY created_at DESC, id DESC
                LIMIT ?
            """

            params.append(limit + 1)  # +1 to detect next page
            cursor_obj.execute(query, params)

            rows = cursor_obj.fetchall()

            # Convert rows to FeedItem objects
            items = []
            has_more = len(rows) > limit

            for row in rows[:limit]:  # Take only up to limit
                try:
                    payload = json.loads(row['payload'])
                    created_at = datetime.fromisoformat(row['created_at'])

                    item = FeedItem(
                        id=row['id'],
                        user_id=row['user_id'],
                        actor_id=row['actor_id'],
                        event_name=row['event_name'],
                        payload=payload,
                        created_at=created_at
                    )
                    items.append(item)

                except (json.JSONDecodeError, ValueError, KeyError) as e:
                    logger.error(f"Failed to parse feed item {row['id']}: {e}")
                    continue

            # Generate next cursor if there are more items
            next_cursor = None
            if has_more and items:
                last_item = items[-1]
                cursor_data = f"{last_item.created_at.isoformat()}|{last_item.id}"
                next_cursor = base64.b64encode(cursor_data.encode('utf-8')).decode('utf-8')

            return FeedResponse(items=items, next_cursor=next_cursor)

    except Exception as e:
        logger.error(f"Failed to get feed for user {user_id}: {e}")
        # Return empty feed on error
        return FeedResponse(items=[], next_cursor=None)
