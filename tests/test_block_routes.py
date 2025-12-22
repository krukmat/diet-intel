from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import pytest
from pydantic import ValidationError

from app.models.social.block import (
    BlockActionRequest,
    BlockActionResponse,
    BlockListItem,
    BlockListResponse,
)
from app.routes import block as block_routes


class _FakeUser:
    def __init__(self, id: str, role: str = "standard"):
        self.id = id
        self.role = role


class _FakeService:
    def __init__(self):
        self.blocked_pairs = []

    def block_user(self, blocker_id, blocked_id, reason=None):
        self.blocked_pairs.append((blocker_id, blocked_id))
        return BlockActionResponse(
            ok=True,
            blocker_id=blocker_id,
            blocked_id=blocked_id,
            status="active",
            blocked_at=datetime.utcnow(),
        )

    def unblock_user(self, blocker_id, blocked_id):
        self.blocked_pairs = [
            pair for pair in self.blocked_pairs if pair != (blocker_id, blocked_id)
        ]
        return BlockActionResponse(
            ok=True,
            blocker_id=blocker_id,
            blocked_id=blocked_id,
            status="revoked",
            blocked_at=datetime.utcnow(),
        )

    def list_blocked(self, blocker_id, limit, cursor):
        return BlockListResponse(
            items=[
                BlockListItem(
                    user_id=blocker_id,
                    handle="test-handle",
                    avatar_url=None,
                    since=datetime.utcnow(),
                    reason="test",
                )
            ],
            next_cursor=cursor or "cursor_1",
        )

    def list_blockers(self, blocked_id, limit, cursor):
        return BlockListResponse(
            items=[
                BlockListItem(
                    user_id=blocked_id,
                    handle="blocked-handle",
                    avatar_url=None,
                    since=datetime.utcnow(),
                    reason="test-blocker",
                )
            ],
            next_cursor=cursor or "cursor_2",
        )


@pytest.fixture
def block_client_factory(monkeypatch):
    fake_service = _FakeService()
    monkeypatch.setattr(block_routes, "block_service", fake_service)

    def _build(user=None, feature_enabled=True, moderation_enabled=True):
        if user is None:
            user = _FakeUser(id="user1")
        monkeypatch.setattr(block_routes, "is_social_feature_enabled", lambda: feature_enabled)
        monkeypatch.setattr(block_routes, "MODERATION_ENABLED", moderation_enabled)

        app = FastAPI()
        app.include_router(block_routes.router)
        app.dependency_overrides[block_routes.get_current_user] = lambda: user
        return TestClient(app), fake_service

    return _build


def test_block_user_success(block_client_factory):
    client, fake_service = block_client_factory()
    response = client.post("/blocks/user2", json={"action": "block"})
    assert response.status_code == 200
    body = response.json()
    assert body["blocked_id"] == "user2"
    assert fake_service.blocked_pairs == [("user1", "user2")]


def test_block_with_social_disabled(block_client_factory):
    client, _ = block_client_factory(feature_enabled=False)
    response = client.post("/blocks/user2", json={"action": "block"})
    assert response.status_code == 403
    assert "social features disabled" in response.json()["detail"].lower()


def test_block_self_forbidden(block_client_factory):
    client, _ = block_client_factory()
    response = client.post("/blocks/user1", json={"action": "block"})
    assert response.status_code == 400
    assert "cannot block self" in response.json()["detail"].lower()


def test_block_invalid_action_returns_422(block_client_factory):
    client, _ = block_client_factory()
    response = client.post("/blocks/user2", json={"action": "jump"})
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert isinstance(detail, list)
    assert any("action" in err.get("loc", []) for err in detail)


def test_list_blocked_forbidden_when_not_owner(block_client_factory):
    client, _ = block_client_factory()
    response = client.get("/profiles/other/blocked")
    assert response.status_code == 403


def test_list_blocked_owner_allowed(block_client_factory):
    client, _ = block_client_factory()
    response = client.get("/profiles/user1/blocked")
    assert response.status_code == 200
    assert response.json()["items"][0]["user_id"] == "user1"


def test_list_blockers_admin_allowed(block_client_factory):
    admin_user = _FakeUser(id="admin", role="admin")
    client, _ = block_client_factory(user=admin_user)
    response = client.get("/profiles/any/blockers")
    assert response.status_code == 200


def test_list_blockers_forbidden_for_other_user(block_client_factory):
    client, _ = block_client_factory()
    response = client.get("/profiles/other/blockers")
    assert response.status_code == 403


def test_unblock_user_success(block_client_factory):
    client, fake_service = block_client_factory()
    response = client.post("/blocks/user2", json={"action": "unblock"})
    assert response.status_code == 200
    assert fake_service.blocked_pairs == []


def test_block_validation_error_returns_422(block_client_factory):
    client, fake_service = block_client_factory()

    def _invalid(*args, **kwargs):
        try:
            BlockActionRequest.parse_obj({"action": "jump"})
        except ValidationError as exc:
            raise exc

    fake_service.block_user = _invalid
    response = client.post("/blocks/user2", json={"action": "block"})
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert isinstance(detail, str)
    assert "block" in detail.lower()


def test_block_internal_error_returns_500(block_client_factory):
    client, fake_service = block_client_factory()

    def _boom(*args, **kwargs):
        raise RuntimeError("boom")

    fake_service.block_user = _boom
    response = client.post("/blocks/user2", json={"action": "block"})
    assert response.status_code == 500


def test_list_blocked_http_exception_propagates(block_client_factory):
    client, fake_service = block_client_factory()

    def _raise(*args, **kwargs):
        raise HTTPException(status_code=400, detail="bad cursor")

    fake_service.list_blocked = _raise
    response = client.get("/profiles/user1/blocked")
    assert response.status_code == 400


def test_list_blocked_exception_returns_500(block_client_factory):
    client, fake_service = block_client_factory()

    def _boom(*args, **kwargs):
        raise RuntimeError("boom")

    fake_service.list_blocked = _boom
    response = client.get("/profiles/user1/blocked")
    assert response.status_code == 500


def test_list_blockers_exception_returns_500(block_client_factory):
    client, fake_service = block_client_factory()

    def _boom(*args, **kwargs):
        raise RuntimeError("boom")

    fake_service.list_blockers = _boom
    response = client.get("/profiles/user1/blockers")
    assert response.status_code == 500
