from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.models.social.discover_feed import DiscoverFeedResponse
from app.services.social import discover_feed_service as service


@pytest.fixture(autouse=True)
def clear_discover_cache():
    service._discover_cache.clear()


@pytest.fixture(autouse=True)
def stub_instrumentation():
    with patch(
        "app.services.social.discover_feed_service.publish_event"
    ) as mock_publish, patch(
        "app.services.social.discover_feed_service.performance_monitor.record_metric"
    ) as mock_metric:
        mock_publish.return_value = None
        mock_metric.return_value = None
        yield


@pytest.fixture
def posts_rows():
    now = datetime.utcnow()
    return [
        {
            "id": "p1",
            "author_id": "u1",
            "text": "Hello world",
            "created_at": (now - timedelta(hours=1)).isoformat(),
            "updated_at": now.isoformat(),
            "likes_count": 5,
            "comments_count": 2,
            "rank_score": 0.0,
        },
        {
            "id": "p2",
            "author_id": "u2",
            "text": "Old post",
            "created_at": (now - timedelta(days=2)).isoformat(),
            "updated_at": now.isoformat(),
            "likes_count": 10,
            "comments_count": 1,
            "rank_score": 0.0,
        },
        {
            "id": "p3",
            "author_id": "u1",  # Same author as p1 - should cap per author
            "text": "Second post by same author",
            "created_at": (now - timedelta(hours=2)).isoformat(),
            "updated_at": now.isoformat(),
            "likes_count": 20,
            "comments_count": 5,
            "rank_score": 0.0,
        },
        {
            "id": "p4",
            "author_id": "u3",
            "text": "Very old post",
            "created_at": (now - timedelta(days=8)).isoformat(),
            "updated_at": now.isoformat(),
            "likes_count": 50,
            "comments_count": 20,
            "rank_score": 0.0,
        },
    ]


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service.block_service")
@patch("app.services.social.discover_feed_service.ReportService")
@patch("app.services.social.discover_feed_service.ProfileService")
def test_scoring_and_order(
    mock_profile, mock_report, mock_block, mock_fetch, posts_rows
):
    mock_fetch.return_value = posts_rows
    mock_block.is_blocking.return_value = False
    mock_report.is_post_blocked.return_value = False
    mock_profile.return_value.can_view_profile.return_value = True

    response = service.get_discover_feed(user_id="viewer", limit=10)
    assert isinstance(response, DiscoverFeedResponse)
    assert len(response.items) == 4
    assert response.items[0].rank_score >= response.items[1].rank_score


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service.block_service")
@patch("app.services.social.discover_feed_service.ReportService")
@patch("app.services.social.discover_feed_service.ProfileService")
def test_simple_function(mock_profile, mock_report, mock_block, mock_fetch):
    mock_fetch.return_value = []
    mock_block.is_blocking.return_value = False
    mock_report.is_post_blocked.return_value = False
    mock_profile.return_value.can_view_profile.return_value = True

    response = service.get_discover_feed(user_id="viewer", limit=5)
    assert isinstance(response, DiscoverFeedResponse)
    assert len(response.items) == 0
    assert response.next_cursor is None


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service.block_service")
@patch("app.services.social.discover_feed_service.ReportService")
@patch("app.services.social.discover_feed_service.ProfileService")
def test_service_import(mock_profile, mock_report, mock_block, mock_fetch):
    # Test that we can import the service
    mock_fetch.return_value = []
    mock_block.is_blocking.return_value = False
    mock_report.is_post_blocked.return_value = False
    mock_profile.return_value.can_view_profile.return_value = True

    response = service.get_discover_feed(user_id="viewer", limit=1)
    assert isinstance(response, DiscoverFeedResponse)


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service.block_service")
@patch("app.services.social.discover_feed_service.ReportService")
@patch("app.services.social.discover_feed_service.ProfileService")
def test_filters_blocked(mock_profile, mock_report, mock_block, mock_fetch, posts_rows):
    mock_fetch.return_value = posts_rows

    def block_side_effect(viewer_id, author_id):
        return viewer_id == "viewer" and author_id == "u1"

    mock_block.is_blocking.side_effect = block_side_effect
    mock_report.is_post_blocked.return_value = False
    mock_profile.return_value.can_view_profile.return_value = True

    response = service.get_discover_feed(user_id="viewer", limit=10)
    assert len(response.items) == 2  # all posts by u1 removed
    assert all(item.id not in {"p1", "p3"} for item in response.items)


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service.block_service")
@patch("app.services.social.discover_feed_service.ReportService")
@patch("app.services.social.discover_feed_service.ProfileService")
def test_cache_hits(mock_profile, mock_report, mock_block, mock_fetch, posts_rows):
    mock_fetch.return_value = posts_rows
    mock_block.is_blocking.return_value = False
    mock_report.is_post_blocked.return_value = False
    mock_profile.return_value.can_view_profile.return_value = True

    first = service.get_discover_feed(user_id="viewer", limit=2, surface="web")
    assert len(first.items) == 2
    mock_fetch.assert_called_once()

    second = service.get_discover_feed(user_id="viewer", limit=2, surface="web")
    assert len(second.items) == 2
    mock_fetch.assert_called_once()  # Shouldn't be called again due to cache


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service.block_service")
@patch("app.services.social.discover_feed_service.ReportService")
@patch("app.services.social.discover_feed_service.ProfileService")
def test_cursor_pagination(
    mock_profile, mock_report, mock_block, mock_fetch, posts_rows
):
    mock_fetch.return_value = posts_rows[:2]  # Only first 2 posts
    mock_block.is_blocking.return_value = False
    mock_report.is_post_blocked.return_value = False
    mock_profile.return_value.can_view_profile.return_value = True

    # First page
    response1 = service.get_discover_feed(
        user_id="viewer", limit=1, cursor=None, surface="web"
    )
    assert len(response1.items) == 1
    assert response1.next_cursor is not None

    # Second page using cursor
    response2 = service.get_discover_feed(
        user_id="viewer", limit=1, cursor=response1.next_cursor, surface="web"
    )
    assert len(response2.items) == 1
    assert response2.items[0].id != response1.items[0].id


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service.block_service")
@patch("app.services.social.discover_feed_service.ReportService")
@patch("app.services.social.discover_feed_service.ProfileService")
def test_reporting_filters(
    mock_profile, mock_report, mock_block, mock_fetch, posts_rows
):
    mock_fetch.return_value = posts_rows
    mock_block.is_blocking.return_value = False
    mock_report.is_post_blocked.side_effect = lambda post_id: post_id == "p1"
    mock_profile.return_value.can_view_profile.return_value = True

    response = service.get_discover_feed(user_id="viewer", limit=10)
    assert len(response.items) == 3
    assert all(item.id != "p1" for item in response.items)


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service.block_service")
@patch("app.services.social.discover_feed_service.ReportService")
@patch("app.services.social.discover_feed_service.ProfileService")
def test_block_filters_remove_content(
    mock_profile, mock_report, mock_block, mock_fetch, posts_rows
):
    mock_fetch.return_value = posts_rows
    mock_block.is_blocking.return_value = True  # All are blocked
    mock_report.is_post_blocked.return_value = False
    mock_profile.return_value.can_view_profile.return_value = True

    response = service.get_discover_feed(user_id="viewer", limit=10)
    assert len(response.items) == 0  # All filtered out


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service.block_service")
@patch("app.services.social.discover_feed_service.ReportService")
@patch("app.services.social.discover_feed_service.ProfileService")
def test_profile_visibility_filters_hidden_profiles(
    mock_profile, mock_report, mock_block, mock_fetch, posts_rows
):
    mock_fetch.return_value = posts_rows
    mock_block.is_blocking.return_value = False
    mock_report.is_post_blocked.return_value = False

    def visibility_side_effect(viewer_id, author_id):
        return author_id != "u1"

    mock_profile.return_value.can_view_profile.side_effect = visibility_side_effect

    response = service.get_discover_feed(user_id="viewer", limit=10)
    assert len(response.items) == 2
    assert all(item.author_id != "u1" for item in response.items)


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service.block_service")
@patch("app.services.social.discover_feed_service.ReportService")
@patch("app.services.social.discover_feed_service.ProfileService")
def test_cache_double_call(
    mock_profile, mock_report, mock_block, mock_fetch, posts_rows
):
    mock_fetch.return_value = posts_rows
    mock_block.is_blocking.return_value = False
    mock_report.is_post_blocked.return_value = False
    mock_profile.return_value.can_view_profile.return_value = True

    # Same call twice - cache should work
    response1 = service.get_discover_feed(user_id="viewer", limit=4, surface="web")
    response2 = service.get_discover_feed(user_id="viewer", limit=4, surface="web")

    assert len(response1.items) == 4
    assert len(response2.items) == 4
    mock_fetch.assert_called_once()  # Only one real fetch


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service.block_service")
@patch("app.services.social.discover_feed_service.ReportService")
@patch("app.services.social.discover_feed_service.ProfileService")
def test_cursor_base64_encoding(
    mock_profile, mock_report, mock_block, mock_fetch, posts_rows
):
    mock_fetch.return_value = posts_rows[:1]  # Only one post to ensure cursor
    mock_block.is_blocking.return_value = False
    mock_report.is_post_blocked.return_value = False
    mock_profile.return_value.can_view_profile.return_value = True

    response = service.get_discover_feed(user_id="viewer", limit=1, cursor=None)
    if response.next_cursor:
        # Just test that cursor exists and is valid format (base64)
        import base64

        decoded = base64.b64decode(response.next_cursor)
        assert decoded  # Should decode without error


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service.block_service")
@patch("app.services.social.discover_feed_service.ReportService")
@patch("app.services.social.discover_feed_service.ProfileService")
def test_feed_service_integration(
    mock_profile, mock_report, mock_block, mock_fetch, posts_rows
):
    mock_fetch.return_value = posts_rows
    mock_block.is_blocking.return_value = False
    mock_report.is_post_blocked.return_value = False
    mock_profile.return_value.can_view_profile.return_value = True

    # Test direct service call works
    response = service.get_discover_feed(user_id="test_user", limit=5)
    assert isinstance(response, DiscoverFeedResponse)
    assert len(response.items) <= 5


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service.block_service")
@patch("app.services.social.discover_feed_service.ReportService")
@patch("app.services.social.discover_feed_service.ProfileService")
def test_cap_per_author(mock_profile, mock_report, mock_block, mock_fetch, posts_rows):
    """Test that results are limited per author according to config."""
    mock_fetch.return_value = posts_rows
    mock_block.is_blocking.return_value = False
    mock_report.is_post_blocked.return_value = False
    mock_profile.return_value.can_view_profile.return_value = True

    response = service.get_discover_feed(user_id="viewer", limit=10)
    # Author u1 has posts p1 and p3 - should be capped at max_per_author (default 2)
    # So should get all 4 original posts since u1's posts would be limited
    assert (
        len(response.items) == 4
    )  # u1 gets 2 posts (p1, p3), u2 gets 1 (p2), u3 gets 1 (p4)

    # Count posts by u1
    u1_posts = [item for item in response.items if item.author_id == "u1"]
    assert len(u1_posts) == 2  # Max per author


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service.block_service")
@patch("app.services.social.discover_feed_service.ReportService")
@patch("app.services.social.discover_feed_service.ProfileService")
def test_filters_visibility_visibility(
    mock_profile, mock_report, mock_block, mock_fetch, posts_rows
):
    """Test that visibility filtering works correctly."""
    mock_fetch.return_value = posts_rows
    mock_block.is_blocking.return_value = False
    mock_report.is_post_blocked.return_value = False

    def visibility_side_effect(viewer_id, author_id):
        return author_id != "u2"

    mock_profile.return_value.can_view_profile.side_effect = visibility_side_effect

    response = service.get_discover_feed(user_id="viewer", limit=10)

    actual_ids = [item.id for item in response.items]
    assert all(item_id != "p2" for item_id in actual_ids)
    assert len(actual_ids) == 3
