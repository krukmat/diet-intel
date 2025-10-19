"""
EPIC_B.B6: Feed Experimentation Engine
Handles A/B testing for discover feed ranking weights with bucketing and surface awareness.
"""

import logging
import hashlib
from typing import Dict, Any, Optional, List

from app.config import config

logger = logging.getLogger(__name__)


class FeedExperiments:
    """
    Real experimentation engine with hash-based bucketing and surface awareness.
    Supports multiple variants with distinct weights per surface.
    """

    def __init__(self):
        # Experiment configuration from app config
        self.experiments_config = config.discover_feed.get("experiments", {})
        self.experiment_id = self.experiments_config.get("experiment_id", "multisource_discovery_v1")
        self.enabled = self.experiments_config.get("enabled", True)

        # Default weights as fallback
        self.default_weights = {
            "fresh": 0.5,
            "engagement": 0.5,
            "likes": 0.6,
            "comments": 0.4,
        }

        # Define experiment variants with weights
        self.variants = self.experiments_config.get("variants", {
            "control": {
                "web": self.default_weights,
                "mobile": self.default_weights
            },
            "variant_a": {
                "web": {  # Variant A: Heavy on interaction
                    "fresh": 0.3,
                    "engagement": 0.7,
                    "likes": 0.8,
                    "comments": 0.2,
                },
                "mobile": {  # Same for mobile
                    "fresh": 0.3,
                    "engagement": 0.7,
                    "likes": 0.8,
                    "comments": 0.2,
                }
            },
            "variant_b": {
                "web": {  # Variant B: Heavy on freshness
                    "fresh": 0.8,
                    "engagement": 0.2,
                    "likes": 0.4,
                    "comments": 0.6,
                },
                "mobile": {  # Adjusted for mobile browsing_patterns
                    "fresh": 0.6,
                    "engagement": 0.4,
                    "likes": 0.5,
                    "comments": 0.5,
                }
            }
        })

        # Traffic allocation percentages
        self.allocation = self.experiments_config.get("allocation", {
            "control": 30,    # 30% control
            "variant_a": 35,  # 35% variant A
            "variant_b": 35   # 35% variant B
        })

        # Bucketing salt for deterministic assignment
        self.bucket_salt = self.experiments_config.get("bucket_salt", "dietintel_discovery_2025")

    def get_feed_weights(self, user_id: Optional[str] = None, surface: str = "web") -> Dict[str, Any]:
        """
        Get feed ranking weights for a user and surface.

        Args:
            user_id: User ID for experiment bucketing (deterministic assignment)
            surface: Platform surface ('web' or 'mobile')

        Returns:
            Dict with weights, variant, and experiment metadata
        """
        if not self.enabled:
            return {
                "weights": self.default_weights.copy(),
                "variant": "control",
                "experiment_id": None
            }

        try:
            # Get variant for this user
            variant = self._assign_variant(user_id)

            # Get weights for this variant and surface
            weights = self.variants.get(variant, {}).get(surface, self.default_weights)

            # Return result with metadata
            result = {
                "weights": weights.copy(),
                "variant": variant,
                "experiment_id": self.experiment_id,
                "surface": surface
            }

            logger.info(
                "feed_experiment_variant_served",
                extra={
                    "user_id": user_id or "anonymous",
                    "variant": variant,
                    "experiment_id": self.experiment_id,
                    "surface": surface,
                    "weights": weights,
                }
            )

            return result

        except Exception as exc:
            logger.warning(
                "feed_experiment_fallback",
                extra={
                    "user_id": user_id,
                    "surface": surface,
                    "error": str(exc),
                    "fallback_weights": self.default_weights,
                }
            )
            return {
                "weights": self.default_weights.copy(),
                "variant": "control",
                "experiment_id": None,
                "surface": surface
            }

    def _assign_variant(self, user_id: Optional[str]) -> str:
        """
        Deterministically assign a variant to a user using stable hash bucketing.

        Args:
            user_id: User ID for bucketing

        Returns:
            Variant name string
        """
        if not user_id:
            # Use deterministic anonymous ID (not random time-based)
            user_id = "anonymous_default_user"

        # Create stable hash for deterministic assignment
        hash_input = f"{self.bucket_salt}:{user_id}:{self.experiment_id}"
        hash_value = hashlib.md5(hash_input.encode()).hexdigest()
        hash_int = int(hash_value[:8], 16)  # First 8 hex chars as int
        percentage = hash_int % 100  # 0-99

        # Assign variant based on allocation percentages
        cumulative = 0
        for variant, allocation in self.allocation.items():
            cumulative += allocation
            if percentage < cumulative:
                return variant

        # Fallback to control (shouldn't reach here if allocations sum to 100)
        return "control"

    def get_experiment_stats(self) -> Dict[str, Any]:
        """Get current experiment configuration for monitoring."""
        return {
            "experiment_id": self.experiment_id,
            "enabled": self.enabled,
            "variants": list(self.variants.keys()),
            "allocation": self.allocation,
            "total_allocation": sum(self.allocation.values()),
        }

    def is_experimentation_enabled(self) -> bool:
        """Check if experimentation is enabled."""
        return self.enabled

    def get_experiment_id(self) -> Optional[str]:
        """Get current experiment ID."""
        return self.experiment_id if self.enabled else None


# Global instance (follows app pattern)
feed_experiments = FeedExperiments()
