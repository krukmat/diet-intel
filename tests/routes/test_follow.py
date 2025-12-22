from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from app.models.user import User
from app.models.social.follow import FollowActionResponse, FollowListResponse, FollowListItem
from app.services.auth import get_current_user, get_optional_user


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def current_user():
    return User(id="user-1", email="user1@example.com", full_name="User One")


@pytest.fixture
def optional_user():
    return User(id="user-2", email="user2@example.com", full_name="User Two")


@pytest.fixture
def override_current_user(current_user):
    app.dependency_overrides[get_current_user] = lambda: current_user
    yield current_user
    app.dependency_overrides.clear()


@pytest.fixture
def override_optional_user(optional_user):
    app.dependency_overrides[get_optional_user] = lambda: optional_user
    yield optional_user
    app.dependency_overrides.clear()


def test_follow_toggle_follow_ok(client, override_current_user):
    response_payload = FollowActionResponse(
        ok=True,
        follower_id=override_current_user.id,
        followee_id="target-1",
        status="active",
        followers_count=3,
        following_count=4,
        blocked=False,
    )
    with patch("app.routes.follow.follow_service", autospec=True) as mock_service:
        mock_service.follow_user = AsyncMock(return_value=response_payload)
        response = client.post("/follows/target-1", json={"action": "follow"})

    assert response.status_code == 200
    data = response.json()
    assert data["followee_id"] == "target-1"
    mock_service.follow_user.assert_awaited_once_with(override_current_user.id, "target-1")


def test_follow_toggle_unfollow_ok(client, override_current_user):
    response_payload = FollowActionResponse(
        ok=True,
        follower_id=override_current_user.id,
        followee_id="target-2",
        status="active",
        followers_count=2,
        following_count=3,
        blocked=False,
    )
    with patch("app.routes.follow.follow_service", autospec=True) as mock_service:
        mock_service.unfollow_user = AsyncMock(return_value=response_payload)
        response = client.post("/follows/target-2", json={"action": "unfollow"})

    assert response.status_code == 200
    data = response.json()
    assert data["followee_id"] == "target-2"
    mock_service.unfollow_user.assert_awaited_once_with(override_current_user.id, "target-2")


def test_follow_toggle_invalid_action(client, override_current_user):
    response = client.post("/follows/target-3", json={"action": "block"})
    assert response.status_code == 422


def test_get_followers_ok(client, override_current_user):
    response_payload = FollowListResponse(
        items=[
            FollowListItem(
                user_id="follower-1",
                handle="follower",
                avatar_url=None,
                since=datetime.utcnow(),
            )
        ],
        next_cursor=None,
    )
    with patch("app.routes.profile.follow_service", autospec=True) as mock_service:
        mock_service.list_followers = AsyncMock(return_value=response_payload)
        response = client.get("/profiles/target-4/followers?limit=10")

    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["user_id"] == "follower-1"
    mock_service.list_followers.assert_awaited_once_with("target-4", 10, None)


def test_get_following_ok(client, override_current_user):
    response_payload = FollowListResponse(
        items=[
            FollowListItem(
                user_id="following-1",
                handle="following",
                avatar_url=None,
                since=datetime.utcnow(),
            )
        ],
        next_cursor=None,
    )
    with patch("app.routes.profile.follow_service", autospec=True) as mock_service:
        mock_service.list_following = AsyncMock(return_value=response_payload)
        response = client.get("/profiles/target-5/following?limit=5&cursor=abc")

    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["user_id"] == "following-1"
    mock_service.list_following.assert_awaited_once_with("target-5", 5, "abc")


def test_followers_limit_validation(client, override_current_user):
    response_payload = FollowListResponse(items=[], next_cursor=None)
    with patch("app.routes.profile.follow_service", autospec=True) as mock_service:
        mock_service.list_followers = AsyncMock(return_value=response_payload)
        response = client.get("/profiles/target-6/followers?limit=101")
    assert response.status_code == 200
