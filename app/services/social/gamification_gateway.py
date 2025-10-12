"""
Gamification Gateway - Stub implementation for EPIC_A.A1

Returns default gamification values for user profiles.
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class GamificationGateway:
    """Gateway for gamification data - stub implementation for A1"""

    def get_profile_counters(self, user_id: str) -> Dict[str, int]:
        """
        Return default gamification counters for A1 - always zeros

        Args:
            user_id: User identifier

        Returns:
            Default gamification data
        """
        logger.warning(f"GamificationGateway.get_profile_counters not implemented - returning defaults for user {user_id}")
        return {
            "points_total": 0,
            "level": 0,
            "badges_count": 0
        }


# Singleton instance
gamification_gateway = GamificationGateway()
