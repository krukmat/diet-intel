"""
EPIC_B.B5: Feed Experimentation Stub
Handles A/B testing for discover feed ranking weights.
Ready for future integration with actual experiment service.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class FeedExperiments:
    """
    Stub for feed experiment management.
    Currently returns static config, ready for A/B testing integration.
    """

    def __init__(self):
        # Static weights config for now
        self.default_weights = {
            "fresh": 0.5,
            "engagement": 0.5,
            "likes": 0.6,
            "comments": 0.4,
        }

        # Feature flag for experimentation (always enabled for now)
        self.experimentation_enabled = True

    def get_feed_weights(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get feed ranking weights for a user.
        Currently returns static weights, ready for A/B testing variants.

        Args:
            user_id: User ID for experiment bucketing (future use)

        Returns:
            Dict with feed weights and variant metadata
        """
        if not self.experimentation_enabled:
            return {"weights": self.default_weights.copy(), "variant": "control"}

        try:
            # TODO: Integrate with actual experiment service
            weights = self.default_weights.copy()
            variant = "control"

            logger.info(
                "feed_experiment_weights_served",
                extra={
                    "user_id": user_id or "anonymous",
                    "variant": variant,
                    "weights": weights,
                }
            )

            return {"weights": weights, "variant": variant}

        except Exception as exc:
            logger.warning(
                "feed_experiment_fallback",
                extra={
                    "user_id": user_id,
                    "error": str(exc),
                    "fallback_weights": self.default_weights,
                }
            )
            return {"weights": self.default_weights.copy(), "variant": "control"}

    def is_experimentation_enabled(self) -> bool:
        """Check if experimentation is enabled."""
        return self.experimentation_enabled

    def get_experiment_id(self) -> Optional[str]:
        """Get current experiment ID (stub)."""
        return None  # No active experiment yet


# Global instance (follows app pattern)
feed_experiments = FeedExperiments()
