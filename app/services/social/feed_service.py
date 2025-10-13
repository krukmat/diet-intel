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
from app.models.social.post import PostDetail

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


def list_following_posts(user_id: str, limit: int = 20, cursor: Optional[str] = None) -> FeedResponse:
    """
    EPIC_A.A5: Get paginated feed of posts from users that the given user follows.

    This creates a social timeline showing UGC content from followed users.
    Respects post visibility rules and follows relationships.

    Args:
        user_id: User ID to get posts feed for
        limit: Maximum number of posts to return
        cursor: Base64 encoded cursor for pagination (created_at|id format)

    Returns:
        FeedResponse containing posts as items
    """
    try:
        with db_service.get_connection() as conn:
            cursor_obj = conn.cursor()

            # Build WHERE clause with following relationships
            where_clause = """
                WHERE uf.follower_id = ?
                  AND uf.status = 'active'
                  AND p.author_id = uf.followee_id
                  AND (p.visibility = 'inherit_profile' AND up.visibility = 'public')
            """
            params = [user_id]

            # Handle cursor pagination
            if cursor:
                try:
                    cursor_data = base64.b64decode(cursor).decode('utf-8')
                    cursor_created_at_str, post_id = cursor_data.split('|')
                    cursor_created_at = datetime.fromisoformat(cursor_created_at_str)

                    where_clause += " AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))"
                    params.extend([cursor_created_at.isoformat(), cursor_created_at.isoformat(), post_id])
                except Exception as e:
                    logger.warning(f"Invalid cursor format: {cursor}, error: {e}")

            # Complex JOIN query for following feed
            posts_query = f"""
                SELECT
                    p.id, p.author_id, p.text, p.visibility, p.created_at, p.updated_at,
                    COUNT(DISTINCT pr.post_id) as likes_count,
                    COUNT(DISTINCT pc.id) as comments_count,
                    GROUP_CONCAT(DISTINCT m.url) as media_urls,
                    GROUP_CONCAT(DISTINCT m.type || ':' || m.url) as media_types_urls
                FROM user_follows uf
                JOIN posts p ON uf.followee_id = p.author_id
                LEFT JOIN user_profiles up ON p.author_id = up.user_id
                LEFT JOIN post_reactions pr ON p.id = pr.post_id
                LEFT JOIN post_comments pc ON p.id = pc.post_id
                LEFT JOIN post_media m ON p.id = m.post_id
                {where_clause}
                GROUP BY p.id, p.author_id, p.text, p.visibility, p.created_at, p.updated_at
                ORDER BY p.created_at DESC, p.id DESC
                LIMIT ?
            """

            params.append(limit + 1)  # +1 to check for next page
            cursor_obj.execute(posts_query, params)

            rows = cursor_obj.fetchall()
            has_more = len(rows) > limit
            posts_data = []

            for row in rows[:limit]:
                try:
                    # Parse media if present
                    media = []
                    if row['media_urls']:
                        media_urls = row['media_urls'].split(',')
                        media_types_urls = row['media_types_urls'].split(',') if row['media_types_urls'] else []

                        for i, url in enumerate(media_urls):
                            media_type = 'image'  # default
                            if i < len(media_types_urls):
                                type_and_url = media_types_urls[i]
                                if ':' in type_and_url:
                                    media_type = type_and_url.split(':', 1)[0]
                                    url = type_and_url.split(':', 1)[1]

                            media.append({
                                'id': f"media_{row['id']}_{i}",
                                'type': media_type,
                                'url': url,
                                'order_position': i
                            })

                    # Check if current user liked the post
                    cursor_obj.execute(
                        "SELECT 1 FROM post_reactions WHERE post_id = ? AND user_id = ?",
                        (row['id'], user_id)
                    )
                    is_liked_by_user = cursor_obj.fetchone() is not None

                    post_detail = PostDetail(
                        id=row['id'],
                        author_id=row['author_id'],
                        text=row['text'],
                        media=media[:4],  # Respect max 4 media limit
                        stats={
                            'likes_count': row['likes_count'] or 0,
                            'comments_count': row['comments_count'] or 0
                        },
                        visibility=row['visibility'],
                        created_at=row['created_at'],
                        updated_at=row['updated_at'],
                        is_liked_by_user=is_liked_by_user
                    )
                    posts_data.append(post_detail)

                except Exception as e:
                    logger.error(f"Failed to process post {row['id']}: {e}")
                    continue

            # Generate next cursor if more items exist
            next_cursor = None
            if has_more and posts_data:
                last_post = posts_data[-1]
                cursor_data = f"{last_post.created_at.isoformat()}|{last_post.id}"
                next_cursor = base64.b64encode(cursor_data.encode('utf-8')).decode('utf-8')

            # Convert posts to FeedItems for consistent response format
            feed_items = []
            for post in posts_data:
                feed_item = FeedItem(
                    id=post.id,
                    user_id=user_id,  # The user viewing the feed
                    actor_id=post.author_id,  # The post author (who acted)
                    event_name="UserAction.PostCreated",
                    payload={
                        'post_id': post.id,
                        'author_id': post.author_id,
                        'text': post.text,
                        'likes_count': post.stats['likes_count'],
                        'comments_count': post.stats['comments_count']
                    },
                    created_at=post.created_at
                )
                feed_items.append(feed_item)

            return FeedResponse(items=feed_items, next_cursor=next_cursor)

    except Exception as e:
        logger.error(f"Failed to get following posts feed for user {user_id}: {e}")
        return FeedResponse(items=[], next_cursor=None)
