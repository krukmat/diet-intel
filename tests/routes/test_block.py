from datetime import datetime
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from main import app
from app.models.user import User
from app.models.social.block import BlockActionResponse, BlockListResponse, BlockListItem
from app.services.auth import get_current_user


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def current_user():
    return User(id="user-1", email="user1@example.com", full_name="User One")


@pytest.fixture
def override_current_user(current_user):
    app.dependency_overrides[get_current_user] = lambda: current_user
    yield current_user
    app.dependency_overrides.clear()


def test_block_user_ok(client, override_current_user):
    response_payload = BlockActionResponse(
        ok=True,
        blocker_id=override_current_user.id,
        blocked_id="target-1",
        status="active",
        blocked_at=datetime.utcnow(),
    )
    with patch("app.routes.block.block_service", autospec=True) as mock_service:
        mock_service.block_user.return_value = response_payload
        response = client.post("/blocks/target-1", json={"action": "block", "reason": "spam"})

    assert response.status_code == 200
    data = response.json()
    assert data["blocked_id"] == "target-1"
    mock_service.block_user.assert_called_once_with(
        blocker_id=override_current_user.id,
        blocked_id="target-1",
        reason="spam",
    )


def test_unblock_user_ok(client, override_current_user):
    response_payload = BlockActionResponse(
        ok=True,
        blocker_id=override_current_user.id,
        blocked_id="target-2",
        status="revoked",
        blocked_at=datetime.utcnow(),
    )
    with patch("app.routes.block.block_service", autospec=True) as mock_service:
        mock_service.unblock_user.return_value = response_payload
        response = client.post("/blocks/target-2", json={"action": "unblock"})

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "revoked"
    mock_service.unblock_user.assert_called_once_with(
        blocker_id=override_current_user.id,
        blocked_id="target-2",
    )


def test_block_self_rejected(client, override_current_user):
    response = client.post(f"/blocks/{override_current_user.id}", json={"action": "block"})
    assert response.status_code == 400


def test_block_invalid_action(client, override_current_user):
    response = client.post("/blocks/target-3", json={"action": "hide"})
    assert response.status_code == 422


def test_list_blocked_ok(client, override_current_user):
    response_payload = BlockListResponse(
        items=[
            BlockListItem(
                user_id="blocked-1",
                handle="blocked",
                avatar_url=None,
                since=datetime.utcnow(),
                reason="spam",
            )
        ],
        next_cursor=None,
    )
    with patch("app.routes.block.block_service", autospec=True) as mock_service:
        mock_service.list_blocked.return_value = response_payload
        response = client.get(f"/profiles/{override_current_user.id}/blocked?limit=5")

    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["user_id"] == "blocked-1"
    mock_service.list_blocked.assert_called_once_with(
        blocker_id=override_current_user.id,
        limit=5,
        cursor=None,
    )


def test_list_blocked_forbidden(client, override_current_user):
    response = client.get("/profiles/other-user/blocked")
    assert response.status_code == 403


def test_list_blockers_ok(client, override_current_user):
    response_payload = BlockListResponse(
        items=[
            BlockListItem(
                user_id="blocker-1",
                handle="blocker",
                avatar_url=None,
                since=datetime.utcnow(),
                reason=None,
            )
        ],
        next_cursor=None,
    )
    with patch("app.routes.block.block_service", autospec=True) as mock_service:
        mock_service.list_blockers.return_value = response_payload
        response = client.get(f"/profiles/{override_current_user.id}/blockers?limit=3&cursor=abc")

    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["user_id"] == "blocker-1"
    mock_service.list_blockers.assert_called_once_with(
        blocked_id=override_current_user.id,
        limit=3,
        cursor="abc",
    )


def test_list_blockers_forbidden(client, override_current_user):
    response = client.get("/profiles/other-user/blockers")
    assert response.status_code == 403
