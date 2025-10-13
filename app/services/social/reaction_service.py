# EPIC_A.A5: Reaction service for handling post reactions

from app.services.social.post_service import PostService
from app.models.social.post import ReactionType


class ReactionService:
    """Service for managing post reactions"""

    @staticmethod
    def toggle_reaction(post_id: str, user_id: str, reaction_type: ReactionType = ReactionType.LIKE) -> dict:
        """
        Toggle like/unlike on a post

        Returns:
            {
                'liked': bool,  # True if liked, False if unliked
                'likes_count': int  # Updated total likes count
            }
        """
        liked = PostService.toggle_reaction(post_id, user_id, reaction_type)
        stats = PostService._get_post_stats(post_id)

        # Send notification to post author if someone liked their post (and it's not self-like)
        if liked and stats.likes_count == 1:  # First like
            try:
                with PostService._db_conn() as conn:  # Need to get post author
                    cursor = conn.cursor()
                    cursor.execute("SELECT author_id FROM posts WHERE id = ?", (post_id,))
                    row = cursor.fetchone()
                    if row and row['author_id'] != user_id:  # Don't notify self-likes
                        try:
                            from app.services.notifications.notification_service import NotificationService
                            NotificationService.enqueue_notification(
                                row['author_id'], 'post_liked',
                                {'post_id': post_id, 'actor_id': user_id}
                            )
                        except ImportError:
                            pass
            except Exception as e:
                print(f"Warning: Failed to send like notification: {e}")

        return {
            'liked': liked,
            'likes_count': stats.likes_count
        }
