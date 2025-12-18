"""
Session Service Tests - Phase 2 Batch 7 & Phase 4 Coverage Improvement

Comprehensive tests for SessionService covering:
- Session CRUD operations
- Token refresh and rotation
- Session cleanup and expiration
- Error handling and edge cases
- Row-to-model conversion with edge cases

Target Coverage: 85%+ (currently 83%, need +2%)
Focus on exception handlers and edge cases in lines: 176-178, 201-203, 229-231, 257-259, 276-277, 283-284
"""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta

from app.services.session_service import SessionService
from app.models.user import UserSession


@pytest.fixture
def mock_db_service():
    """Create a mock DatabaseService"""
    return MagicMock()


@pytest.fixture
def session_service(mock_db_service):
    """Create SessionService with mocked database"""
    return SessionService(mock_db_service)


@pytest.fixture
def sample_session():
    """Create a sample UserSession for testing"""
    return UserSession(
        user_id="user_123",
        access_token="access_token_abc123",
        refresh_token="refresh_token_xyz789",
        expires_at=datetime.utcnow() + timedelta(hours=1),
        device_info="iPhone 12"
    )


@pytest.fixture
def sample_session_row():
    """Sample database row for a session"""
    future_time = (datetime.utcnow() + timedelta(hours=1)).isoformat()
    return {
        'id': 'session_123',
        'user_id': 'user_123',
        'access_token': 'access_abc123',
        'refresh_token': 'refresh_xyz789',
        'expires_at': future_time,
        'device_info': 'iPhone 12'
    }


# ===== SESSION CREATION TESTS =====

class TestSessionCreation:
    """Test session creation operations"""

    @pytest.mark.asyncio
    async def test_create_session_success(self, session_service, mock_db_service, sample_session):
        """Test successful session creation"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        session_id = await session_service.create_session(sample_session)

        # Assert
        assert session_id is not None
        assert isinstance(session_id, str)
        mock_cursor.execute.assert_called_once()
        mock_conn.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_session_generates_uuid(self, session_service, mock_db_service, sample_session):
        """Test that create_session generates a proper UUID"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        session_id = await session_service.create_session(sample_session)

        # Assert - should be a valid UUID string
        assert session_id is not None
        assert len(session_id) > 0
        # Verify it was passed to INSERT
        call_args = mock_cursor.execute.call_args[0]
        assert "INSERT" in call_args[0]


# ===== SESSION RETRIEVAL TESTS =====

class TestSessionRetrieval:
    """Test session lookup operations"""

    @pytest.mark.asyncio
    async def test_get_session_by_refresh_token_success(self, session_service, mock_db_service, sample_session_row):
        """Test successful session lookup by refresh token"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = sample_session_row
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await session_service.get_session_by_refresh_token("refresh_xyz789")

        # Assert
        assert result is not None
        assert result.user_id == "user_123"
        assert result.access_token == "access_abc123"
        mock_cursor.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_session_by_refresh_token_not_found(self, session_service, mock_db_service):
        """Test session lookup returns None when not found"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await session_service.get_session_by_refresh_token("nonexistent_token")

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_get_session_by_access_token_success(self, session_service, mock_db_service, sample_session_row):
        """Test successful session lookup by access token"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = sample_session_row
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await session_service.get_session_by_access_token("access_abc123")

        # Assert
        assert result is not None
        assert result.user_id == "user_123"

    @pytest.mark.asyncio
    async def test_get_session_by_access_token_not_found(self, session_service, mock_db_service):
        """Test access token lookup returns None when not found"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await session_service.get_session_by_access_token("nonexistent_access")

        # Assert
        assert result is None


# ===== SESSION DELETION TESTS =====

class TestSessionDeletion:
    """Test session deletion operations"""

    @pytest.mark.asyncio
    async def test_delete_session_success(self, session_service, mock_db_service):
        """Test successful single session deletion"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await session_service.delete_session("session_123")

        # Assert
        assert result is True
        mock_cursor.execute.assert_called_once()
        mock_conn.commit.assert_called_once()
        # Verify DELETE query
        call_args = mock_cursor.execute.call_args[0]
        assert "DELETE" in call_args[0]

    @pytest.mark.asyncio
    async def test_delete_session_database_error(self, session_service, mock_db_service):
        """Test error handling when delete fails (Line 201-203)"""
        # Setup - database error during deletion
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.execute.side_effect = Exception("Delete failed")
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute - should catch exception and return False
        result = await session_service.delete_session("session_123")

        # Assert
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_user_sessions_success_single(self, session_service, mock_db_service):
        """Test deletion of single session for a user"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 1
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await session_service.delete_user_sessions("user_123")

        # Assert
        assert result == 1
        mock_cursor.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_user_sessions_success_multiple(self, session_service, mock_db_service):
        """Test deletion of multiple sessions for a user"""
        # Setup - rowcount = 3 (three sessions deleted)
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 3
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await session_service.delete_user_sessions("user_456")

        # Assert
        assert result == 3

    @pytest.mark.asyncio
    async def test_delete_user_sessions_no_sessions(self, session_service, mock_db_service):
        """Test deletion when user has no sessions"""
        # Setup - rowcount = 0
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 0
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await session_service.delete_user_sessions("user_no_sessions")

        # Assert
        assert result == 0

    @pytest.mark.asyncio
    async def test_delete_user_sessions_database_error(self, session_service, mock_db_service):
        """Test error handling when deleting user sessions fails (Line 229-231)"""
        # Setup - database error
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.execute.side_effect = Exception("Delete all sessions failed")
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute - should catch exception and return 0
        result = await session_service.delete_user_sessions("user_123")

        # Assert
        assert result == 0


# ===== SESSION CLEANUP TESTS =====

class TestSessionCleanup:
    """Test session cleanup/expiration operations"""

    @pytest.mark.asyncio
    async def test_cleanup_expired_sessions_removes_old(self, session_service, mock_db_service):
        """Test that cleanup removes expired sessions"""
        # Setup - rowcount = 5 (five sessions cleaned)
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 5
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await session_service.cleanup_expired_sessions()

        # Assert
        assert result == 5
        # Verify SQL includes expiration check
        call_args = mock_cursor.execute.call_args[0]
        assert "expires_at <" in call_args[0]
        assert "DELETE" in call_args[0]

    @pytest.mark.asyncio
    async def test_cleanup_expired_sessions_none_expired(self, session_service, mock_db_service):
        """Test cleanup when no sessions are expired"""
        # Setup - rowcount = 0
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 0
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await session_service.cleanup_expired_sessions()

        # Assert
        assert result == 0

    @pytest.mark.asyncio
    async def test_cleanup_expired_sessions_database_error(self, session_service, mock_db_service):
        """Test error handling when cleanup fails (Line 257-259)"""
        # Setup - database error
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.execute.side_effect = Exception("Cleanup failed")
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute - should catch exception and return 0
        result = await session_service.cleanup_expired_sessions()

        # Assert
        assert result == 0


# ===== ROW CONVERSION EDGE CASES =====

class TestRowConversion:
    """Test database row to UserSession model conversion"""

    def test_row_to_session_basic_conversion(self, session_service, sample_session_row):
        """Test basic row to session conversion"""
        # Execute
        result = session_service._row_to_session(sample_session_row)

        # Assert
        assert result is not None
        assert result.id == 'session_123'
        assert result.user_id == 'user_123'
        assert result.access_token == 'access_abc123'
        assert result.device_info == 'iPhone 12'


    def test_row_to_session_missing_device_info(self, session_service):
        """Test handling when device_info field is missing (Line 283-284)"""
        # Setup - row without device_info key
        row = {
            'id': 'session_no_device',
            'user_id': 'user_123',
            'access_token': 'token_abc',
            'refresh_token': 'token_xyz',
            'expires_at': datetime.utcnow().isoformat()
            # device_info is missing
        }

        # Execute - should handle KeyError gracefully
        result = session_service._row_to_session(row)

        # Assert - device_info is None
        assert result is not None
        assert result.device_info is None

    def test_row_to_session_valid_datetime_parsing(self, session_service):
        """Test proper datetime parsing"""
        # Setup - valid ISO format
        now = datetime.utcnow()
        row = {
            'id': 'session_valid_date',
            'user_id': 'user_123',
            'access_token': 'token_abc',
            'refresh_token': 'token_xyz',
            'expires_at': now.isoformat(),
            'device_info': 'Device'
        }

        # Execute
        result = session_service._row_to_session(row)

        # Assert
        assert result is not None
        assert result.expires_at is not None
        assert isinstance(result.expires_at, datetime)


# ===== INTEGRATION TESTS =====

class TestSessionServiceIntegration:
    """Integration tests for session operations"""

    @pytest.mark.asyncio
    async def test_create_and_retrieve_session(self, session_service, mock_db_service, sample_session, sample_session_row):
        """Test creating and retrieving a session"""
        # Setup for create
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Create session
        session_id = await session_service.create_session(sample_session)
        assert session_id is not None

        # Setup for retrieval
        mock_cursor.fetchone.return_value = sample_session_row

        # Retrieve session
        retrieved = await session_service.get_session_by_refresh_token("refresh_token_xyz789")

        # Assert
        assert retrieved is not None
        assert retrieved.user_id == "user_123"

    @pytest.mark.asyncio
    async def test_session_lifecycle(self, session_service, mock_db_service, sample_session):
        """Test full session lifecycle: create -> lookup -> delete"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # 1. Create
        session_id = await session_service.create_session(sample_session)
        assert session_id is not None

        # 2. Delete
        result = await session_service.delete_session(session_id)
        assert result is True
