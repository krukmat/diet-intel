from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import app.routes.feed as feed_routes
import pytest

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.models.social.discover_feed import (
    DiscoverFeedItem,
    DiscoverFeedResponse,
    RankReason,
)


class TestDiscoverFeedRoutes:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.fixture
    def auth_headers(self):
        return {"Authorization": "Bearer mock_token"}

    def _mock_response(self):
        return DiscoverFeedResponse(
            items=[
                DiscoverFeedItem(
                    id="post-1",
                    author_id="author-1",
                    text="Sample discover post",
                    rank_score=0.95,
                    reason=RankReason.FRESH,
                    created_at=datetime.utcnow(),
                    surface="web",
                    metadata={"likes_count": 3, "comments_count": 1},
                )
            ],
            next_cursor="cursor-xyz",
        )

    def test_discover_feed_requires_auth(self, client):
        response = client.get("/feed/discover")
        assert response.status_code == 401

    def test_discover_feed_success(self, client, auth_headers):
        response_model = self._mock_response()

        with patch(
            "app.services.auth.auth_service.get_current_user_from_token",
            AsyncMock(return_value=MagicMock(id="user-123")),
        ), patch.object(
            feed_routes.discover_rate_limiter, "allow", return_value=True
        ) as mock_allow, patch(
            "app.routes.feed.get_discover_feed", return_value=response_model
        ) as mock_service:
            response = client.get(
                "/feed/discover?limit=10&surface=mobile", headers=auth_headers
            )

        assert response.status_code == 200
        data = response.json()
        assert data["items"][0]["id"] == "post-1"
        mock_allow.assert_called_once_with("user-123")
        mock_service.assert_called_once_with(
            user_id="user-123", limit=10, cursor=None, surface="mobile"
        )

    def test_discover_feed_rate_limited(self, client, auth_headers):
        with patch(
            "app.services.auth.auth_service.get_current_user_from_token",
            AsyncMock(return_value=MagicMock(id="user-123")),
        ), patch.object(feed_routes.discover_rate_limiter, "allow", return_value=False):
            response = client.get("/feed/discover", headers=auth_headers)

        assert response.status_code == 429

    def test_discover_feed_invalid_params(self, client, auth_headers):
        response = client.get("/feed/discover?limit=0", headers=auth_headers)
        assert response.status_code == 422

        response = client.get("/feed/discover?surface=desktop", headers=auth_headers)
        assert response.status_code == 422

    def test_discover_feed_service_error_returns_empty(self, client, auth_headers):
        with patch(
            "app.services.auth.auth_service.get_current_user_from_token",
            AsyncMock(return_value=MagicMock(id="user-123")),
        ), patch.object(
            feed_routes.discover_rate_limiter, "allow", return_value=True
        ), patch(
            "app.routes.feed.get_discover_feed", side_effect=RuntimeError("boom")
        ):
            response = client.get("/feed/discover", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["next_cursor"] is None

    def test_discover_feed_feature_disabled(self, client, auth_headers):
        with patch(
            "app.services.auth.auth_service.get_current_user_from_token",
            AsyncMock(return_value=MagicMock(id="user-123")),
        ), patch.object(
            feed_routes.discover_rate_limiter, "allow", return_value=True
        ), patch(
            "app.routes.feed.assert_feature_enabled",
            side_effect=[None, HTTPException(status_code=404, detail="disabled")],
        ):
            response = client.get("/feed/discover", headers=auth_headers)

        assert response.status_code == 404
