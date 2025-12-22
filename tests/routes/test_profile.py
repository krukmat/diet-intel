from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from app.models.user import User
from app.models.social.profile import ProfileDetail, ProfileStats, PostPreview
from app.models.social.follow import FollowActionResponse, FollowListResponse, FollowListItem
from app.services.auth import get_current_user, get_optional_user


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def current_user():
    return User(id="user-123", email="user@example.com", full_name="Test User")


@pytest.fixture
def optional_user():
    return User(id="viewer-456", email="viewer@example.com", full_name="Viewer User")


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


def build_profile(user_id: str, handle: str) -> ProfileDetail:
    stats = ProfileStats(
        followers_count=3,
        following_count=2,
        posts_count=1,
        points_total=25,
        level=1,
        badges_count=0,
    )
    post = PostPreview(
        post_id="post-1",
        text="hello",
        media=[],
        created_at=datetime.utcnow(),
        counters={"likes": 1},
    )
    return ProfileDetail(
        user_id=user_id,
        handle=handle,
        bio="Bio",
        avatar_url=None,
        visibility="public",
        stats=stats,
        posts=[post],
        posts_notice=None,
        block_relation=None,
    )


def test_get_my_profile_ok(client, override_current_user):
    profile = build_profile(override_current_user.id, "me")
    with patch("app.routes.profile.profile_service", autospec=True) as mock_service:
        mock_service.get_profile = AsyncMock(return_value=profile)
        response = client.get("/profiles/me")

    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == override_current_user.id
    assert data["handle"] == "me"
    mock_service.get_profile.assert_awaited_once_with(override_current_user.id, override_current_user.id)


def test_get_user_profile_anonymous_ok(client):
    profile = build_profile("target-1", "target")
    with patch("app.routes.profile.profile_service", autospec=True) as mock_service:
        mock_service.get_profile = AsyncMock(return_value=profile)
        response = client.get("/profiles/target-1")

    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "target-1"
    mock_service.get_profile.assert_awaited_once_with("target-1", None)


def test_get_user_profile_with_viewer(client, override_optional_user):
    profile = build_profile("target-2", "target2")
    with patch("app.routes.profile.profile_service", autospec=True) as mock_service:
        mock_service.get_profile = AsyncMock(return_value=profile)
        response = client.get("/profiles/target-2")

    assert response.status_code == 200
    mock_service.get_profile.assert_awaited_once_with("target-2", override_optional_user.id)


def test_update_my_profile_ok(client, override_current_user):
    profile = build_profile(override_current_user.id, "updated")
    payload = {"handle": "updated", "bio": "New bio"}
    with patch("app.routes.profile.profile_service", autospec=True) as mock_service:
        mock_service.update_profile = AsyncMock(return_value=None)
        mock_service.get_profile = AsyncMock(return_value=profile)
        response = client.patch("/profiles/me", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["handle"] == "updated"
    mock_service.update_profile.assert_awaited_once()
    mock_service.get_profile.assert_awaited_once_with(override_current_user.id, override_current_user.id)


def test_update_my_profile_invalid_visibility(client, override_current_user):
    response = client.patch("/profiles/me", json={"visibility": "unknown"})
    assert response.status_code == 422


def test_follow_user_action_follow_ok(client, override_current_user):
    response_payload = FollowActionResponse(
        ok=True,
        follower_id=override_current_user.id,
        followee_id="target-3",
        status="active",
        followers_count=10,
        following_count=5,
        blocked=False,
    )
    with patch("app.routes.profile.follow_service", autospec=True) as mock_service:
        mock_service.follow_user = AsyncMock(return_value=response_payload)
        response = client.post("/profiles/target-3/follow", json={"action": "follow"})

    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["followee_id"] == "target-3"
    mock_service.follow_user.assert_awaited_once_with(override_current_user.id, "target-3")


def test_follow_user_action_invalid_action(client, override_current_user):
    response = client.post("/profiles/target-4/follow", json={"action": "block"})
    assert response.status_code == 422


def test_get_user_followers_ok(client, override_current_user):
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
        response = client.get("/profiles/user-9/followers")

    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["user_id"] == "follower-1"
    mock_service.list_followers.assert_awaited_once()


def test_get_user_following_ok(client, override_current_user):
    response_payload = FollowListResponse(
        items=[
            FollowListItem(
                user_id="followed-1",
                handle="followed",
                avatar_url=None,
                since=datetime.utcnow(),
            )
        ],
        next_cursor=None,
    )
    with patch("app.routes.profile.follow_service", autospec=True) as mock_service:
        mock_service.list_following = AsyncMock(return_value=response_payload)
        response = client.get("/profiles/user-9/following")

    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["user_id"] == "followed-1"
    mock_service.list_following.assert_awaited_once()
