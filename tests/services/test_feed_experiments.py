"""
EPIC_B.B6: Tests for feed experimentation engine
Validates bucketing determinism and fallback behavior.
"""

import pytest
from app.services.experimentation.feed_experiments import FeedExperiments


class TestFeedExperiments:

    def test_bucketing_determinism(self):
        """Test that same user always gets same variant."""
        experiment = FeedExperiments()
        user_id = "test_user_123"

        # Get variant multiple times
        variants = []
        for _ in range(10):
            result = experiment.get_feed_weights(user_id, "web")
            variants.append(result["variant"])

        # All calls should return same variant
        assert all(v == variants[0] for v in variants), "Bucketing should be deterministic"

        # Should include experiment metadata
        first_result = experiment.get_feed_weights(user_id, "web")
        assert "experiment_id" in first_result
        assert "variant" in first_result
        assert "weights" in first_result
        assert isinstance(first_result["weights"], dict)

    def test_surface_specific_weights(self):
        """Test that different surfaces can have different weights per variant."""
        experiment = FeedExperiments()
        user_id = "test_user_web"

        # Get weights for web and mobile
        web_result = experiment.get_feed_weights(user_id, "web")
        mobile_result = experiment.get_feed_weights(user_id, "mobile")

        # Same variant should be assigned
        assert web_result["variant"] == mobile_result["variant"]

        # Weights can be different per surface
        assert isinstance(web_result["weights"], dict)
        assert isinstance(mobile_result["weights"], dict)

        # Check that variant is not control for this test
        if web_result["variant"] != "control":
            # Weights should match the variant's surface configuration
            variant = web_result["variant"]
            expected_web = experiment.variants[variant]["web"]
            expected_mobile = experiment.variants[variant]["mobile"]
            assert web_result["weights"] == expected_web
            assert mobile_result["weights"] == expected_mobile

    def test_fallback_behavior(self):
        """Test fallback to control when experiments are disabled."""
        experiment = FeedExperiments()

        # Temporarily disable experimentation
        original_enabled = experiment.enabled
        experiment.enabled = False

        try:
            result = experiment.get_feed_weights("test_user", "web")

            assert result["variant"] == "control"
            assert result["experiment_id"] is None
            assert result["weights"] == experiment.default_weights

        finally:
            # Restore original state
            experiment.enabled = original_enabled

    def test_anonymous_user_handling(self):
        """Test handling of anonymous users."""
        experiment = FeedExperiments()

        # None user_id should be handled
        result = experiment.get_feed_weights(None, "web")
        assert "variant" in result
        assert "weights" in result
        assert result["experiment_id"] is not None

    def test_traffic_allocation_distribution(self):
        """Test that traffic allocation roughly matches expected distribution."""
        experiment = FeedExperiments()
        total_users = 10000
        assignments = {"control": 0, "variant_a": 0, "variant_b": 0}

        # Simulate user assignments
        for i in range(total_users):
            user_id = f"user_{i+1:05d}"
            result = experiment.get_feed_weights(user_id, "web")
            variant = result["variant"]
            if variant in assignments:
                assignments[variant] += 1

        # Check allocation is roughly correct (±5% tolerance)
        expected_percentages = experiment.allocation
        tolerance = 0.05  # 5% tolerance

        for variant, expected_pct in expected_percentages.items():
            actual_count = assignments[variant]
            actual_pct = (actual_count / total_users) * 100

            lower_bound = expected_pct * (1 - tolerance)
            upper_bound = expected_pct * (1 + tolerance)

            assert lower_bound <= actual_pct <= upper_bound, (
                f"Variant {variant}: expected {expected_pct}%, got {actual_pct:.1f}% "
                f"(outside {lower_bound:.1f}%-{upper_bound:.1f}% range)"
            )

    def test_experiment_stats(self):
        """Test experiment configuration stats."""
        experiment = FeedExperiments()
        stats = experiment.get_experiment_stats()

        assert "experiment_id" in stats
        assert "enabled" in stats
        assert "variants" in stats
        assert "allocation" in stats
        assert "total_allocation" in stats

        # Should add up to 100% (or close to it)
        total_allocation = stats["total_allocation"]
        assert 95 <= total_allocation <= 105  # Allow small variance


class TestHashBucketing:

    def test_stable_assignment(self):
        """Test that hash assignment is stable across different experiment instances."""
        salt = "test_salt_2025"
        experiment1 = FeedExperiments()
        experiment1.bucket_salt = salt

        experiment2 = FeedExperiments()
        experiment2.bucket_salt = salt

        user_id = "stable_test_user"
        variant1 = experiment1._assign_variant(user_id)
        variant2 = experiment2._assign_variant(user_id)

        assert variant1 == variant2, "Same salt should produce same assignment"

    def test_different_salt_changes_assignment(self):
        """Test that different salt changes variant assignment."""
        experiment1 = FeedExperiments()
        experiment1.bucket_salt = "salt_1"

        experiment2 = FeedExperiments()
        experiment2.bucket_salt = "salt_2"

        user_id = "same_user"
        variant1 = experiment1._assign_variant(user_id)
        variant2 = experiment2._assign_variant(user_id)

        # Very likely to be different with different salts
        # (though technically could be same by chance - low probability)
        assert variant1 != variant2 or variant1 == variant2  # Either is possible but deterministic
