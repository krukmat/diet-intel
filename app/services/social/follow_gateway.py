"""
Follow Gateway - Stub implementation for EPIC_A.A1

Always returns False - follow functionality to be implemented in A2.
"""

import logging

logger = logging.getLogger(__name__)


class FollowGateway:
    """Gateway for follow relationships - stub implementation for A1"""

    def is_following(self, follower_id: str, followee_id: str) -> bool:
        """
        Stub implementation - always returns False for A1

        TODO: Implement real follow relationship logic in A2

        Args:
            follower_id: The user doing the following
            followee_id: The user being followed

        Returns:
            Always False for A1
        """
        logger.warning(f"FollowGateway.is_following stub - returning False (follower: {follower_id}, followee: {followee_id})")
        return False


# Singleton instance
follow_gateway = FollowGateway()
