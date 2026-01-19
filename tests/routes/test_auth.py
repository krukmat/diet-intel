from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from app.models.user import User
from app.services import auth as auth_module
from app.routes import auth as auth_routes


def _override_current_user(user):
    async def _override(credentials=None):
        return user
    return _override


@pytest.fixture
def client():
    return TestClient(app)


def test_register_user_ok(client):
    token_payload = {
        "access_token": "access",
        "refresh_token": "refresh",
        "token_type": "bearer",
        "expires_in": 3600,
        "user": {
            "id": "user-1",
            "email": "user@example.com",
            "full_name": "User Example",
            "avatar_url": None,
            "is_developer": False,
            "role": "standard",
            "is_active": True,
            "email_verified": False,
            "created_at": "2024-01-01T00:00:00Z",
        },
    }
    with patch("app.routes.auth.auth_service", autospec=True) as mock_auth:
        mock_auth.register_user = AsyncMock(return_value=token_payload)
        response = client.post("/auth/register", json={
            "email": "user@example.com",
            "password": "Password123",
            "full_name": "User Example",
        })

    assert response.status_code == 201
    assert response.json()["access_token"] == "access"


def test_login_user_ok(client):
    token_payload = {
        "access_token": "access",
        "refresh_token": "refresh",
        "token_type": "bearer",
        "expires_in": 3600,
        "user": {
            "id": "user-1",
            "email": "user@example.com",
            "full_name": "User Example",
            "avatar_url": None,
            "is_developer": False,
            "role": "standard",
            "is_active": True,
            "email_verified": False,
            "created_at": "2024-01-01T00:00:00Z",
        },
    }
    with patch("app.routes.auth.auth_service", autospec=True) as mock_auth:
        mock_auth.login_user = AsyncMock(return_value=token_payload)
        response = client.post("/auth/login", json={
            "email": "user@example.com",
            "password": "Password123",
        })

    assert response.status_code == 200
    assert response.json()["refresh_token"] == "refresh"


def test_refresh_token_ok(client):
    token_payload = {
        "access_token": "new_access",
        "refresh_token": "new_refresh",
        "token_type": "bearer",
        "expires_in": 3600,
        "user": {
            "id": "user-1",
            "email": "user@example.com",
            "full_name": "User Example",
            "avatar_url": None,
            "is_developer": False,
            "role": "standard",
            "is_active": True,
            "email_verified": False,
            "created_at": "2024-01-01T00:00:00Z",
        },
    }
    with patch("app.routes.auth.auth_service", autospec=True) as mock_auth:
        mock_auth.refresh_access_token = AsyncMock(return_value=token_payload)
        response = client.post("/auth/refresh", json={"refresh_token": "refresh"})

    assert response.status_code == 200
    assert response.json()["access_token"] == "new_access"


def test_logout_user_ok(client):
    with patch("app.routes.auth.auth_service", autospec=True) as mock_auth:
        mock_auth.logout_user = AsyncMock(return_value=None)
        response = client.post("/auth/logout", json={"refresh_token": "refresh"})

    assert response.status_code == 204


def test_get_current_user_profile_ok(client):
    user = User(
        id="user-1",
        email="user@example.com",
        full_name="User Example",
        avatar_url=None,
        is_developer=False,
        role="standard",
        is_active=True,
        email_verified=False,
        created_at=datetime.utcnow(),
    )
    app.dependency_overrides[auth_routes._get_current_user_dependency] = _override_current_user(user)
    try:
        response = client.get("/auth/me")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"


def test_update_user_profile_no_changes(client):
    user = User(
        id="user-1",
        email="user@example.com",
        full_name="User Example",
        avatar_url=None,
        is_developer=False,
        role="standard",
        is_active=True,
        email_verified=False,
        created_at=datetime.utcnow(),
    )
    app.dependency_overrides[auth_routes._get_current_user_dependency] = _override_current_user(user)
    try:
        response = client.put("/auth/me", json={})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["full_name"] == "User Example"


def test_update_user_profile_ok(client):
    user = User(
        id="user-1",
        email="user@example.com",
        full_name="User Example",
        avatar_url=None,
        is_developer=False,
        role="standard",
        is_active=True,
        email_verified=False,
        created_at=datetime.utcnow(),
    )
    updated = User(
        id="user-1",
        email="user@example.com",
        full_name="Updated",
        avatar_url="https://example.com/avatar.png",
        is_developer=False,
        role="standard",
        is_active=True,
        email_verified=False,
        created_at=datetime.utcnow(),
    )
    app.dependency_overrides[auth_routes._get_current_user_dependency] = _override_current_user(user)
    with patch("app.routes.auth.user_service", autospec=True) as mock_user_service:
        mock_user_service.update_user = AsyncMock(return_value=updated)
        try:
            response = client.put("/auth/me", json={"full_name": "Updated", "avatar_url": "https://example.com/avatar.png"})
        finally:
            app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["full_name"] == "Updated"


def test_change_password_invalid_current(client):
    user = User(
        id="user-1",
        email="user@example.com",
        full_name="User Example",
        avatar_url=None,
        is_developer=False,
        role="standard",
        is_active=True,
        email_verified=False,
        created_at=datetime.utcnow(),
    )
    app.dependency_overrides[auth_routes._get_current_user_dependency] = _override_current_user(user)
    with patch("app.routes.auth.user_service", autospec=True) as mock_user_service, \
         patch("app.routes.auth.auth_service", autospec=True) as mock_auth, \
         patch("app.routes.auth.session_service", autospec=True) as mock_session:
        mock_user_service.get_password_hash = AsyncMock(return_value="hash")
        mock_auth.verify_password.return_value = False
        response = client.post("/auth/change-password", json={
            "current_password": "wrong",
            "new_password": "Password123",
        })
    app.dependency_overrides.clear()

    assert response.status_code == 400
