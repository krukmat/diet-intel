import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from fastapi.security import HTTPAuthorizationCredentials

from app.models.user import UserCreate, UserSession
from app.services.auth import session_service, auth_service, get_optional_request_context
from app.services.database import db_service
from app.services.user_service import UserService
from app.services.session_service import SessionService
from app.repositories.user_repository import UserRepository


@pytest.mark.asyncio
async def test_optional_request_context_returns_user_and_session():
    email = f"test_user_{uuid4().hex[:8]}@example.com"
    password = "SecurePass123!"
    user_data = UserCreate(
        email=email,
        password=password,
        full_name="Auth Context Tester",
        developer_code=None
    )

    password_hash = auth_service.hash_password(password)
    user_repo = UserRepository()
    user_service = UserService(user_repo)
    user = await user_service.create_user(user_data, password_hash)

    access_token = auth_service.create_access_token(user)
    refresh_token = auth_service.create_refresh_token(user)
    session = UserSession(
        user_id=user.id,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=1),
        device_info="pytest"
    )
    # Phase 2 Batch 7: Using SessionService
    session_id = await session_service.create_session(session)

    # Verify session was created before retrieving by access token
    verify_session = await session_service.get_session_by_access_token(access_token)
    assert verify_session is not None, "Session should exist after creation"

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=access_token)
    context = await get_optional_request_context(creds)

    assert context.user_id == user.id
    assert context.session_id == session_id
    assert context.is_authenticated

    await session_service.delete_session(session_id)
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?", (user.id,))
        conn.commit()


@pytest.mark.asyncio
async def test_optional_request_context_handles_invalid_token():
    invalid_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid.token.value")
    context = await get_optional_request_context(invalid_creds)

    assert context.user is None
    assert context.session_id is None
    assert not context.is_authenticated


@pytest.mark.asyncio
async def test_optional_request_context_without_credentials():
    context = await get_optional_request_context(None)

    assert context.user is None
    assert context.session_id is None
    assert not context.is_authenticated
