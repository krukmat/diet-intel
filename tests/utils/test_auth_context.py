from types import SimpleNamespace
import pytest
import jwt

from app.config import config
from app.utils import auth_context

object.__setattr__(config, "JWT_SECRET", config.secret_key)


class DummyClient:
    def __init__(self, host="127.0.0.1"):
        self.host = host


class DummyRequest:
    def __init__(self, headers=None, client=None):
        self.headers = headers or {}
        self.client = client or DummyClient()


def _make_token(subject: str) -> str:
    return jwt.encode({"sub": subject}, config.JWT_SECRET, algorithm="HS256")


@pytest.mark.asyncio
async def test_get_user_context_returns_anonymous_without_header():
    request = DummyRequest()
    assert await auth_context.get_user_context(request) == "anonymous"


@pytest.mark.asyncio
async def test_get_user_context_ingests_valid_bearer_token():
    token = _make_token("user-123")
    request = DummyRequest(headers={"Authorization": f"Bearer {token}"})
    assert await auth_context.get_user_context(request) == "user-123"


@pytest.mark.asyncio
async def test_get_user_context_handles_invalid_token_gracefully():
    request = DummyRequest(headers={"Authorization": "Bearer invalid"})
    assert await auth_context.get_user_context(request) == "anonymous"


@pytest.mark.asyncio
async def test_get_authenticated_user_id_requires_token():
    request = DummyRequest()
    with pytest.raises(auth_context.HTTPException):
        await auth_context.get_authenticated_user_id(request)


@pytest.mark.asyncio
async def test_get_session_user_id_returns_session_for_anonymous():
    request = DummyRequest()
    session_id = await auth_context.get_session_user_id(request)
    assert session_id.startswith("anon_")


@pytest.mark.asyncio
async def test_get_session_user_id_prefers_authenticated_id():
    token = _make_token("auth-user-1")
    request = DummyRequest(headers={"Authorization": f"Bearer {token}"})
    result = await auth_context.get_session_user_id(request)
    assert result == "auth-user-1"
