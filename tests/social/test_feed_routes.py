import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from fastapi import HTTPException

from app.main import app
from app.models.social.feed import FeedItem, FeedResponse
class TestFeedRoutes:
    """Test cases for feed API routes"""

    @pytest.fixture
    def client(self):
        """Test client fixture"""
        return TestClient(app)

    @pytest.fixture
    def auth_headers(self):
        """Authentication headers fixture"""
        return {"Authorization": "Bearer mock_token"}

    def test_get_feed_success(self, client, auth_headers):
        """Test successful feed retrieval"""
        # Mock feed data
        mock_feed_response = FeedResponse(
            items=[
                FeedItem(
                    id="feed-1",
                    user_id="user2",
                    actor_id="test-user-123",
                    event_name="UserAction.UserFollowed",
                    payload={"follower_id": "test-user-123", "target_id": "user2", "action": "followed", "ts": "2025-01-01T10:00:00Z"},
                    created_at="2025-01-01T10:00:00Z"
                )
            ],
            next_cursor="next-cursor-token"
        )

        with patch('app.services.auth.auth_service.get_current_user_from_token', AsyncMock(return_value=MagicMock(id="test-user-123"))):
            with patch('app.routes.feed.list_feed') as mock_list_feed:
                mock_list_feed.return_value = mock_feed_response

                response = client.get("/feed", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()

            assert "items" in data
            assert "next_cursor" in data
            assert len(data["items"]) == 1

            item = data["items"][0]
            assert item["event_name"] == "UserAction.UserFollowed"
            assert item["payload"]["action"] == "followed"

            # Verify service was called with correct user ID
            mock_list_feed.assert_called_once()
            call_args = mock_list_feed.call_args[0]
            assert call_args[0] == "test-user-123"  # user_id extracted from token

    def test_get_feed_with_pagination(self, client, auth_headers):
        """Test feed retrieval with pagination parameters"""
        with patch('app.services.auth.auth_service.get_current_user_from_token', AsyncMock(return_value=MagicMock(id="test-user-123"))):
            with patch('app.routes.feed.list_feed') as mock_list_feed:
                mock_list_feed.return_value = FeedResponse(items=[], next_cursor=None)

                # Test with limit and cursor
                response = client.get("/feed?limit=50&cursor=pagination-token", headers=auth_headers)

            assert response.status_code == 200

            # Verify service was called with pagination parameters
            mock_list_feed.assert_called_once_with(
                "test-user-123",  # user_id
                50,                # limit
                "pagination-token" # cursor
            )

    def test_get_feed_limit_validation(self, client, auth_headers):
        """Test limit parameter validation"""
        # Test minimum limit
        response = client.get("/feed?limit=0", headers=auth_headers)
        assert response.status_code == 422  # Validation error

        # Test maximum limit
        response = client.get("/feed?limit=200", headers=auth_headers)
        assert response.status_code == 422  # Validation error

        # Test valid limit
        with patch('app.services.auth.auth_service.get_current_user_from_token', AsyncMock(return_value=MagicMock(id="test-user-123"))):
            with patch('app.routes.feed.list_feed') as mock_list_feed:
                mock_list_feed.return_value = FeedResponse(items=[], next_cursor=None)

                response = client.get("/feed?limit=50", headers=auth_headers)
            assert response.status_code == 200

    def test_get_feed_unauthenticated(self, client):
        """Test feed endpoint requires authentication"""
        response = client.get("/feed")
        assert response.status_code == 401

    def test_get_feed_empty_feed(self, client, auth_headers):
        """Test feed with no activity"""
        empty_response = FeedResponse(items=[], next_cursor=None)

        with patch('app.services.auth.auth_service.get_current_user_from_token', AsyncMock(return_value=MagicMock(id="test-user-123"))):
            with patch('app.routes.feed.list_feed') as mock_list_feed:
                mock_list_feed.return_value = empty_response

                response = client.get("/feed", headers=auth_headers)

            assert response.status_code == 200
            data = response.json()
            assert data["items"] == []
            assert data["next_cursor"] is None

    def test_get_feed_service_error(self, client, auth_headers):
        """Test handling of service errors"""
        with patch('app.services.auth.auth_service.get_current_user_from_token', AsyncMock(return_value=MagicMock(id="test-user-123"))):
            with patch('app.routes.feed.list_feed') as mock_list_feed:
                mock_list_feed.side_effect = Exception("Service error")

                response = client.get("/feed", headers=auth_headers)

                # Should still return 200 with empty feed on service errors
                assert response.status_code == 200
                data = response.json()
                assert data["items"] == []
                assert data["next_cursor"] is None

    def test_feed_disabled_feature_flag(self, client, auth_headers):
        """Test feed is disabled when feature flag is off"""
        with patch('app.services.auth.auth_service.get_current_user_from_token', AsyncMock(return_value=MagicMock(id="test-user-123"))):
            with patch('app.routes.feed.assert_feature_enabled') as mock_assert:
                mock_assert.side_effect = HTTPException(status_code=404, detail="Feature disabled")

                response = client.get("/feed", headers=auth_headers)

                assert response.status_code == 404
                assert "Feature disabled" in response.text
