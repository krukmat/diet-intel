# EPIC_A.A5: Post service for UGC content management

import uuid
from datetime import datetime, date
from typing import List, Optional, Tuple

from app.services.database import db_service
from app.models.social.post import (
    PostCreate, PostDetail, PostStats, PostMedia,
    CommentCreate, CommentDetail, ReactionType
)


class PostService:
    """Service for managing UGC posts, reactions, and comments"""

    @staticmethod
    def create_post(author_id: str, post: PostCreate) -> PostDetail:
        """Create a new post with rate limiting"""
        # Check rate limits (10 posts/day)
        if not PostService._check_rate_limit(author_id, 'post_create', 10):
            raise ValueError("Post rate limit exceeded (10/day)")

        # Track activity
        PostService._log_activity(author_id, 'post_create')

        post_id = str(uuid.uuid4())

        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                # Insert post
                cursor.execute("""
                    INSERT INTO posts (id, author_id, text, visibility, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    post_id, author_id, post.text, 'inherit_profile',
                    datetime.utcnow().isoformat(), datetime.utcnow().isoformat()
                ))

                # Insert media if provided
                for order, media_url in enumerate(post.media_urls or []):
                    media_id = str(uuid.uuid4())
                    media_type = 'image' if not media_url.startswith('video') else 'video'
                    cursor.execute("""
                        INSERT INTO post_media (id, post_id, type, url, order_position)
                        VALUES (?, ?, ?, ?, ?)
                    """, (media_id, post_id, media_type, media_url, order))

                # Update user stats
                cursor.execute("""
                    UPDATE user_profiles SET posts_count = posts_count + 1 WHERE user_id = ?
                """, (author_id,))

                conn.commit()

        except Exception as e:
            raise ValueError(f"Failed to create post: {e}")

        # Award points (EPIC_A.A5 gamification)
        try:
            from app.services.gamification.points_service import add_points
            add_points(author_id, 'post_create')
        except ImportError:
            pass  # Optional gamification

        # Award points (EPIC_A.A5 gamification)
        try:
            from app.services.gamification.points_service import PointsService
            from app.services.notifications.notification_service import NotificationService

            PointsService.add_points(author_id, 'post_create')

            # Trigger badge evaluation
            try:
                from app.services.gamification.badge_service import BadgeService
                earned_badges = BadgeService.evaluate_badges(author_id, 'post_create')
                if earned_badges:
                    for badge in earned_badges:
                        NotificationService.enqueue_notification(
                            author_id, 'badge_earned',
                            {'badge': badge, 'earned_at': datetime.utcnow().isoformat()}
                        )
            except ImportError:
                pass

        except ImportError:
            pass  # Optional gamification

        # Award points (EPIC_A.A5 gamification)
        try:
            from app.services.gamification.points_service import PointsService
            from app.services.notifications.notification_service import NotificationService

            PointsService.add_points(author_id, 'post_create')

            # Trigger badge evaluation
            try:
                from app.services.gamification.badge_service import BadgeService
                earned_badges = BadgeService.evaluate_badges(author_id, 'post_create')
                if earned_badges:
                    for badge in earned_badges:
                        NotificationService.enqueue_notification(
                            author_id, 'badge_earned',
                            {'badge': badge, 'earned_at': datetime.utcnow().isoformat()}
                        )
            except ImportError:
                pass

        except ImportError:
            pass  # Optional gamification

        try:
            return PostService.get_post(post_id, author_id)
        except ValueError:
            return PostDetail(
                id=post_id,
                author_id=author_id,
                text=post.text,
                media=[],
                stats=PostStats(likes_count=0, comments_count=0),
                visibility='inherit_profile',
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                is_liked_by_user=False
            )

    @staticmethod
    def get_post(post_id: str, user_id: str = None) -> PostDetail:
        """Get a single post with stats"""
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                # Get post data
                cursor.execute("""
                    SELECT p.id, p.author_id, p.text, p.visibility, p.created_at, p.updated_at
                    FROM posts p WHERE p.id = ?
                """, (post_id,))

                row = cursor.fetchone()
                if not row:
                    raise ValueError("Post not found")

                # Get media
                cursor.execute("""
                    SELECT id, type, url, order_position, created_at
                    FROM post_media
                    WHERE post_id = ?
                    ORDER BY order_position
                """, (post_id,))

                media_rows = cursor.fetchall()
                media = [PostMedia(
                    id=r['id'], type=r['type'], url=r['url'],
                    order_position=r['order_position'], created_at=r['created_at']
                ) for r in media_rows]

                # Get stats
                stats = PostService._get_post_stats(post_id)

                # Check if user liked
                is_liked_by_user = False
                if user_id:
                    cursor.execute(
                        "SELECT 1 FROM post_reactions WHERE post_id = ? AND user_id = ?",
                        (post_id, user_id)
                    )
                    is_liked_by_user = cursor.fetchone() is not None

                return PostDetail(
                    id=post_id,
                    author_id=row['author_id'],
                    text=row['text'],
                    media=media,
                    stats=stats,
                    visibility=row['visibility'],
                    created_at=row['created_at'],
                    updated_at=row['updated_at'],
                    is_liked_by_user=is_liked_by_user
                )

        except Exception as e:
            raise ValueError(f"Failed to get post: {e}")

    @staticmethod
    def toggle_reaction(post_id: str, user_id: str, reaction_type: ReactionType = ReactionType.LIKE) -> bool:
        """Toggle like/unlike on a post"""
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                # Check if reaction exists
                cursor.execute(
                    "SELECT 1 FROM post_reactions WHERE post_id = ? AND user_id = ?",
                    (post_id, user_id)
                )

                exists = cursor.fetchone() is not None

                if exists:
                    # Unlike - remove reaction
                    cursor.execute(
                        "DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?",
                        (post_id, user_id)
                    )
                    action = 'unlike'
                else:
                    # Like - add reaction
                    if not PostService._check_rate_limit(user_id, 'reaction', 200):
                        raise ValueError("Reaction rate limit exceeded (200/day)")

                    cursor.execute("""
                        INSERT INTO post_reactions (post_id, user_id, reaction_type, created_at)
                        VALUES (?, ?, ?, ?)
                    """, (post_id, user_id, reaction_type.value, datetime.utcnow()))

                    # Track activity
                    PostService._log_activity(user_id, 'reaction')

                    action = 'like'

                conn.commit()

                # Award points (EPIC_A.A5 gamification) - only for post author
                if action == 'like':
                    try:
                        # Get post author
                        cursor.execute("SELECT author_id FROM posts WHERE id = ?", (post_id,))
                        author_row = cursor.fetchone()
                        if author_row:
                            author_id = author_row['author_id']
                            # Points for person whose post gets liked
                            from app.services.gamification.points_service import PointsService
                            PointsService.add_points(author_id, 'like_received')
                    except ImportError:
                        pass

                return action == 'like'

        except Exception as e:
            raise ValueError(f"Failed to toggle reaction: {e}")

    @staticmethod
    def create_comment(post_id: str, author_id: str, comment: CommentCreate) -> CommentDetail:
        """Create a comment on a post"""
        if not PostService._check_rate_limit(author_id, 'comment_create', 30):
            raise ValueError("Comment rate limit exceeded (30/day)")

        comment_id = str(uuid.uuid4())

        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                # Insert comment
                cursor.execute("""
                    INSERT INTO post_comments (id, post_id, author_id, text, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    comment_id, post_id, author_id, comment.text,
                    datetime.utcnow(), datetime.utcnow()
                ))

                # Update comment count on post
                cursor.execute(
                    "UPDATE posts SET updated_at = ? WHERE id = ?",
                    (datetime.utcnow(), post_id)
                )

                conn.commit()

        except Exception as e:
            raise ValueError(f"Failed to create comment: {e}")

        # Track activity
        PostService._log_activity(author_id, 'comment_create')

        # Award points (EPIC_A.A5 gamification)
        try:
            from app.services.gamification.points_service import add_points
            add_points(author_id, 'comment_made')
        except ImportError:
            pass

        # Get the created comment
        return CommentDetail(
            id=comment_id,
            post_id=post_id,
            author_id=author_id,
            text=comment.text,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

    @staticmethod
    def get_comments(post_id: str, limit: int = 20, cursor: Optional[str] = None) -> List[CommentDetail]:
        """Get paginated comments for a post"""
        try:
            with db_service.get_connection() as conn:
                cursor_obj = conn.cursor()

                # Decode cursor if provided
                where_clause = "WHERE post_id = ?"
                params = [post_id]

                if cursor:
                    try:
                        cursor_data = base64.b64decode(cursor).decode('utf-8')
                        cursor_created_at, comment_id = cursor_data.split('|')
                        cursor_created_at = datetime.fromisoformat(cursor_created_at)
                        where_clause += " AND created_at > ? OR (created_at = ? AND id > ?)"
                        params.extend([cursor_created_at.isoformat(), cursor_created_at.isoformat(), comment_id])
                    except:
                        pass  # Invalid cursor, continue without

                # Get comments with limit+1
                query = f"""
                    SELECT id, post_id, author_id, text, created_at, updated_at
                    FROM post_comments
                    {where_clause}
                    ORDER BY created_at ASC, id ASC
                    LIMIT ?
                """

                params.append(limit + 1)
                cursor_obj.execute(query, params)

                rows = cursor_obj.fetchall()
                comments = []

                for row in rows[:limit]:  # Take only up to limit
                    comments.append(CommentDetail(
                        id=row['id'],
                        post_id=row['post_id'],
                        author_id=row['author_id'],
                        text=row['text'],
                        created_at=row['created_at'],
                        updated_at=row['updated_at']
                    ))

                return comments

        except Exception as e:
            raise ValueError(f"Failed to get comments: {e}")

    @staticmethod
    def _get_post_stats(post_id: str) -> PostStats:
        """Get post statistics"""
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute(
                    "SELECT COUNT(*) as likes FROM post_reactions WHERE post_id = ?",
                    (post_id,)
                )
                likes_count = cursor.fetchone()['likes']

                cursor.execute(
                    "SELECT COUNT(*) as comments FROM post_comments WHERE post_id = ?",
                    (post_id,)
                )
                comments_count = cursor.fetchone()['comments']

                return PostStats(likes_count=likes_count, comments_count=comments_count)

        except Exception:
            return PostStats(likes_count=0, comments_count=0)

    @staticmethod
    def _check_rate_limit(user_id: str, activity_type: str, daily_limit: int) -> bool:
        """Check if user has exceeded daily activity limit"""
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                today = date.today().isoformat()

                cursor.execute("""
                    SELECT COALESCE(SUM(count), 0) as total
                    FROM post_activity_log
                    WHERE user_id = ? AND activity_type = ? AND activity_date = ?
                """, (user_id, activity_type, today))

                row = cursor.fetchone()
                return (row['total'] or 0) < daily_limit

        except Exception:
            # Allow on DB error to avoid blocking users
            return True

    @staticmethod
    def _log_activity(user_id: str, activity_type: str):
        """Log user activity for rate limiting"""
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                log_id = str(uuid.uuid4())
                today = date.today().isoformat()

                cursor.execute("""
                    INSERT OR REPLACE INTO post_activity_log
                    (id, user_id, activity_type, activity_date, count, updated_at)
                    VALUES (?, ?, ?, ?,
                        COALESCE((SELECT count + 1 FROM post_activity_log
                                 WHERE user_id = ? AND activity_type = ? AND activity_date = ?), 1),
                        ?
                    )
                """, (log_id, user_id, activity_type, today, user_id, activity_type, today, datetime.utcnow()))

                conn.commit()

        except Exception as e:
            # Log error but don't fail the operation
            print(f"Warning: Failed to log activity: {e}")

    @staticmethod
    def list_user_posts(user_id: str, limit: int = 20, cursor: Optional[str] = None) -> List[PostDetail]:
        """Get paginated posts by a user (for profile view)"""
        try:
            with db_service.get_connection() as conn:
                cursor_obj = conn.cursor()

                # Basic query with visibility filter
                where_clause = "WHERE author_id = ?"
                params = [user_id]

                if cursor:
                    try:
                        cursor_data = base64.b64decode(cursor).decode('utf-8')
                        cursor_created_at, post_id = cursor_data.split('|')
                        cursor_created_at = datetime.fromisoformat(cursor_created_at)
                        where_clause += " AND created_at < ? OR (created_at = ? AND id < ?)"
                        params.extend([cursor_created_at.isoformat(), cursor_created_at.isoformat(), post_id])
                    except:
                        pass

                query = f"""
                    SELECT id, author_id, text, visibility, created_at, updated_at
                    FROM posts
                    {where_clause}
                    ORDER BY created_at DESC, id DESC
                    LIMIT ?
                """

                params.append(limit + 1)
                cursor_obj.execute(query, params)

                rows = cursor_obj.fetchall()
                posts = []

                for row in rows[:limit]:
                    post_id = row['id']
                    stats = PostService._get_post_stats(post_id)
                    media = []  # Could be expanded to get media here

                    posts.append(PostDetail(
                        id=post_id,
                        author_id=row['author_id'],
                        text=row['text'],
                        media=media,
                        stats=stats,
                        visibility=row['visibility'],
                        created_at=row['created_at'],
                        updated_at=row['updated_at'],
                        is_liked_by_user=False  # Not needed for profile view
                    ))

                return posts

        except Exception as e:
            raise ValueError(f"Failed to list user posts: {e}")


# Import needed for rate limiting
import base64
