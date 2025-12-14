"""Session Service Tests - Phase 2 Batch 7 refactoring.

Coverage Goal: 88%+ on session_service.py
Task: Phase 2 Batch 7 - Database refactoring
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timedelta
from typing import Dict, Any

from app.services.session_service import SessionService
from app.services.database import DatabaseService
from app.models.user import UserSession


@pytest.mark.asyncio
class TestSessionService:
    """Test suite for SessionService."""

    @pytest.fixture
    def mock_db_service(self):
        """Create a mock DatabaseService."""
        mock = MagicMock(spec=DatabaseService)
        mock.get_connection = MagicMock()
        return mock

    @pytest.fixture
    def session_service(self, mock_db_service):
        """Create a SessionService instance with mocked database."""
        return SessionService(mock_db_service)

    @pytest.fixture
    def sample_session(self):
        """Sample UserSession for testing."""
        return UserSession(
            user_id="user_123",
            access_token="access_token_abc",
            refresh_token="refresh_token_xyz",
            expires_at=datetime.utcnow() + timedelta(hours=1),
            device_info="test-device",
        )

    def _mock_row(self, data: Dict[str, Any]) -> Dict:
        """Create a dict-like mock row."""
        class MockRow(dict):
            pass
        return MockRow(data)

    # ===== CREATE SESSION TESTS =====

    async def test_create_session_success(self, session_service, mock_db_service, sample_session):
        """Test successful session creation."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await session_service.create_session(sample_session)

        assert result is not None
        assert len(result) == 36  # UUID4 length
        assert mock_cursor.execute.called
        assert mock_conn.commit.called

    async def test_create_session_generates_uuid(self, session_service, mock_db_service, sample_session):
        """Test that UUID is generated for session."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await session_service.create_session(sample_session)

        assert len(result) == 36

    async def test_create_session_stores_tokens(self, session_service, mock_db_service, sample_session):
        """Test that access and refresh tokens are stored."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        await session_service.create_session(sample_session)

        args, kwargs = mock_cursor.execute.call_args
        # Verify tokens are in the SQL parameters
        assert "access_token_abc" in args[1] or any(
            arg == "access_token_abc" for arg in args[1] if arg is not None
        )

    # ===== GET SESSION BY REFRESH TOKEN TESTS =====

    async def test_get_session_by_refresh_token_found(self, session_service, mock_db_service, sample_session):
        """Test retrieval of existing session by refresh token."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        row_data = {
            "id": "session_123",
            "user_id": "user_123",
            "access_token": "access_token_abc",
            "refresh_token": "refresh_token_xyz",
            "expires_at": sample_session.expires_at.isoformat(),
            "device_info": "test-device",
        }

        mock_row = self._mock_row(row_data)
        mock_cursor.fetchone.return_value = mock_row
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await session_service.get_session_by_refresh_token("refresh_token_xyz")

        assert result is not None
        assert result.user_id == "user_123"
        assert result.refresh_token == "refresh_token_xyz"

    async def test_get_session_by_refresh_token_not_found(self, session_service, mock_db_service):
        """Test retrieval when refresh token doesn't exist."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await session_service.get_session_by_refresh_token("invalid_token")

        assert result is None

    # ===== GET SESSION BY ACCESS TOKEN TESTS =====

    async def test_get_session_by_access_token_found(self, session_service, mock_db_service, sample_session):
        """Test retrieval of existing session by access token."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        row_data = {
            "id": "session_123",
            "user_id": "user_123",
            "access_token": "access_token_abc",
            "refresh_token": "refresh_token_xyz",
            "expires_at": sample_session.expires_at.isoformat(),
            "device_info": "test-device",
        }

        mock_row = self._mock_row(row_data)
        mock_cursor.fetchone.return_value = mock_row
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await session_service.get_session_by_access_token("access_token_abc")

        assert result is not None
        assert result.user_id == "user_123"
        assert result.access_token == "access_token_abc"

    async def test_get_session_by_access_token_not_found(self, session_service, mock_db_service):
        """Test retrieval when access token doesn't exist."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await session_service.get_session_by_access_token("invalid_token")

        assert result is None

    # ===== UPDATE SESSION TESTS =====

    async def test_update_session_success(self, session_service, mock_db_service):
        """Test successful session update (token refresh)."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        new_expiry = datetime.utcnow() + timedelta(hours=2)
        result = await session_service.update_session(
            session_id="session_123",
            access_token="new_access_token",
            refresh_token="new_refresh_token",
            expires_at=new_expiry,
        )

        assert result is True
        assert mock_cursor.execute.called
        assert mock_conn.commit.called

    async def test_update_session_token_rotation(self, session_service, mock_db_service):
        """Test token rotation during update."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        new_expiry = datetime.utcnow() + timedelta(hours=2)
        await session_service.update_session(
            session_id="session_123",
            access_token="rotated_access",
            refresh_token="rotated_refresh",
            expires_at=new_expiry,
        )

        args, kwargs = mock_cursor.execute.call_args
        assert "rotated_access" in args[1] or any(
            arg == "rotated_access" for arg in args[1] if arg is not None
        )

    # ===== DELETE SESSION TESTS =====

    async def test_delete_session_success(self, session_service, mock_db_service):
        """Test successful single session deletion (logout)."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await session_service.delete_session("session_123")

        assert result is True
        assert mock_cursor.execute.called
        assert mock_conn.commit.called

    async def test_delete_session_not_found(self, session_service, mock_db_service):
        """Test deletion of non-existent session."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await session_service.delete_session("nonexistent_session")

        assert result is True  # Still returns True (no error)

    # ===== DELETE USER SESSIONS TESTS =====

    async def test_delete_user_sessions_success(self, session_service, mock_db_service):
        """Test deletion of all sessions for a user."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 3
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await session_service.delete_user_sessions("user_123")

        assert result == 3
        assert mock_cursor.execute.called
        assert mock_conn.commit.called

    async def test_delete_user_sessions_no_sessions(self, session_service, mock_db_service):
        """Test deletion when user has no sessions."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 0
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await session_service.delete_user_sessions("user_with_no_sessions")

        assert result == 0

    # ===== CLEANUP EXPIRED SESSIONS TESTS =====

    async def test_cleanup_expired_sessions_success(self, session_service, mock_db_service):
        """Test cleanup of expired sessions."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 5
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await session_service.cleanup_expired_sessions()

        assert result == 5
        assert mock_cursor.execute.called
        assert mock_conn.commit.called

    async def test_cleanup_expired_sessions_none_expired(self, session_service, mock_db_service):
        """Test cleanup when no sessions are expired."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 0
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await session_service.cleanup_expired_sessions()

        assert result == 0

    async def test_cleanup_expired_sessions_timestamp_comparison(self, session_service, mock_db_service):
        """Test that cleanup uses timestamp comparison."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 2
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await session_service.cleanup_expired_sessions()

        # Verify timestamp comparison is in SQL
        args, kwargs = mock_cursor.execute.call_args
        assert "expires_at <" in args[0] or "expires_at<" in args[0]
        assert result == 2
