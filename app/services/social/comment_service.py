# EPIC_A.A5: Comment service for handling post comments

from typing import List
from app.services.social.post_service import PostService
from app.models.social.post import CommentCreate, CommentDetail


class CommentService:
    """Service for managing post comments"""

    @staticmethod
    def create_comment(post_id: str, author_id: str, comment: CommentCreate) -> dict:
        """
        Create a comment on a post

        Returns:
            {
                'comment': CommentDetail,
                'comments_count': int  # Updated total comments count
            }
        """
        comment_detail = PostService.create_comment(post_id, author_id, comment)
        stats = PostService._get_post_stats(post_id)

        return {
            'comment': comment_detail,
            'comments_count': stats.comments_count
        }

    @staticmethod
    def get_comments(post_id: str, limit: int = 20, cursor: str = None) -> List[CommentDetail]:
        """Get paginated comments for a post"""
        return PostService.get_comments(post_id, limit, cursor)
