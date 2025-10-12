"""
Post Read Service - Stub implementation for EPIC_A.A1

Returns empty list for recent posts until implemented in future epics.
"""

import logging
from typing import List
from app.models.social.profile import PostPreview

logger = logging.getLogger(__name__)


class PostReadService:
    """Service for reading user posts - stub implementation for A1"""

    def list_recent_posts(self, user_id: str, limit: int = 10) -> List[PostPreview]:
        """
        Return empty list and log warning for A1 - posts not yet implemented

        Args:
            user_id: User identifier
            limit: Maximum posts to return

        Returns:
            Empty list
        """
        logger.warning(f"PostReadService.list_recent_posts not implemented - returning empty list for user {user_id}")
        return []


# Singleton instance
post_read_service = PostReadService()
