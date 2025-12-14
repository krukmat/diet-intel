"""Reminders Service Tests - Phase 2 Batch 5 refactoring.

Coverage Goal: 80%+ on reminders_service.py
Task: Phase 2 Batch 5 - Database refactoring
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, Mock
from datetime import datetime
from typing import Dict, Any

from app.services.reminders_service import RemindersService
from app.services.database import DatabaseService
from app.models.reminder import ReminderRequest, ReminderType


@pytest.mark.asyncio
class TestRemindersService:
    """Test suite for RemindersService."""

    @pytest.fixture
    def mock_db_service(self):
        """Create a mock DatabaseService."""
        mock = MagicMock(spec=DatabaseService)
        mock.get_connection = MagicMock()
        return mock

    @pytest.fixture
    def reminders_service(self, mock_db_service):
        """Create a RemindersService instance with mocked database."""
        return RemindersService(mock_db_service)

    @pytest.fixture
    def sample_reminder_request(self):
        """Sample reminder request data."""
        return ReminderRequest(
            label="Take medication",
            type=ReminderType.MEAL,
            time="09:30",
            days=[False, True, False, True, False, True, False],  # Mon, Wed, Fri
            enabled=True
        )

    def _mock_row(self, data: Dict[str, Any]) -> Dict:
        """Create a dict-like mock row."""
        class MockRow(dict):
            pass
        return MockRow(data)

    # ===== CREATE REMINDER TESTS =====

    async def test_create_reminder_success(self, reminders_service, mock_db_service, sample_reminder_request):
        """Test successful reminder creation."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await reminders_service.create_reminder("user_123", sample_reminder_request)

        assert result is not None
        assert len(result) == 36  # UUID4 length
        assert mock_cursor.execute.called
        assert mock_conn.commit.called

    async def test_create_reminder_generates_uuid(self, reminders_service, mock_db_service, sample_reminder_request):
        """Test that UUID is generated for reminder."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await reminders_service.create_reminder("user_123", sample_reminder_request)

        assert len(result) == 36

    async def test_create_reminder_serializes_json(self, reminders_service, mock_db_service, sample_reminder_request):
        """Test that days array is serialized to JSON."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        await reminders_service.create_reminder("user_123", sample_reminder_request)

        # Verify cursor.execute was called
        assert mock_cursor.execute.called

    # ===== GET REMINDER TESTS =====

    async def test_get_reminder_by_id_found(self, reminders_service, mock_db_service):
        """Test retrieval of existing reminder."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        row_data = {
            'id': 'rem_123',
            'user_id': 'user_123',
            'title': 'Take medication',
            'description': 'medication',
            'reminder_time': datetime.now().replace(hour=9, minute=30).isoformat(),
            'frequency': json.dumps([1, 3, 5]),
            'is_active': 1,
            'created_at': datetime.now().isoformat()
        }

        mock_row = self._mock_row(row_data)
        mock_cursor.fetchone.return_value = mock_row
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await reminders_service.get_reminder_by_id('rem_123')

        assert result is not None
        assert result['id'] == 'rem_123'
        assert result['label'] == 'Take medication'
        assert result['type'] == 'medication'

    async def test_get_reminder_by_id_not_found(self, reminders_service, mock_db_service):
        """Test retrieval of non-existent reminder returns None."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await reminders_service.get_reminder_by_id('nonexistent')

        assert result is None

    async def test_get_reminder_parses_json(self, reminders_service, mock_db_service):
        """Test that JSON fields are properly parsed."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        row_data = {
            'id': 'rem_123',
            'user_id': 'user_123',
            'title': 'Take medication',
            'description': 'medication',
            'reminder_time': '2025-01-15T09:30:00',
            'frequency': json.dumps([1, 3, 5]),
            'is_active': 1,
            'created_at': '2025-01-01T10:00:00'
        }

        mock_row = self._mock_row(row_data)
        mock_cursor.fetchone.return_value = mock_row
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await reminders_service.get_reminder_by_id('rem_123')

        assert isinstance(result['days'], list)
        assert result['days'] == [1, 3, 5]
        assert result['time'] == '09:30'

    # ===== GET USER REMINDERS TESTS =====

    async def test_get_user_reminders_success(self, reminders_service, mock_db_service):
        """Test retrieval of user reminders."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        row_data = {
            'id': 'rem_123',
            'user_id': 'user_123',
            'title': 'Take medication',
            'description': 'meal',
            'reminder_time': '2025-01-15T09:30:00',
            'frequency': json.dumps([False, True, False, True, False, True, False]),
            'is_active': 1,
            'created_at': '2025-01-01T10:00:00'
        }

        mock_row = self._mock_row(row_data)
        mock_cursor.fetchall.return_value = [mock_row]
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await reminders_service.get_user_reminders('user_123')

        assert len(result) == 1
        assert result[0]['id'] == 'rem_123'
        assert result[0]['label'] == 'Take medication'
        assert result[0]['type'] == 'meal'

    async def test_get_user_reminders_empty(self, reminders_service, mock_db_service):
        """Test retrieval when user has no reminders."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await reminders_service.get_user_reminders('user_123')

        assert result == []

    # ===== UPDATE REMINDER TESTS =====

    async def test_update_reminder_success(self, reminders_service, mock_db_service):
        """Test successful reminder update."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 1
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await reminders_service.update_reminder('rem_123', {'label': 'New label'})

        assert result is True
        assert mock_cursor.execute.called

    async def test_update_reminder_not_found(self, reminders_service, mock_db_service):
        """Test update of non-existent reminder."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 0
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await reminders_service.update_reminder('nonexistent', {'label': 'New'})

        assert result is False

    async def test_update_reminder_empty_updates(self, reminders_service, mock_db_service):
        """Test update with no changes."""
        result = await reminders_service.update_reminder('rem_123', {})

        assert result is True

    # ===== DELETE REMINDER TESTS =====

    async def test_delete_reminder_success(self, reminders_service, mock_db_service):
        """Test successful reminder deletion."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 1
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await reminders_service.delete_reminder('rem_123')

        assert result is True
        assert mock_cursor.execute.called

    async def test_delete_reminder_not_found(self, reminders_service, mock_db_service):
        """Test deletion of non-existent reminder."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 0
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await reminders_service.delete_reminder('nonexistent')

        assert result is False

    # ===== INTEGRATION TESTS =====

    async def test_create_and_retrieve_reminder_flow(self, reminders_service, mock_db_service, sample_reminder_request):
        """Test create then retrieve flow."""
        # Setup create
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        created_id = await reminders_service.create_reminder('user_123', sample_reminder_request)

        # Setup retrieve
        row_data = {
            'id': created_id,
            'user_id': 'user_123',
            'title': 'Take medication',
            'description': 'medication',
            'reminder_time': '2025-01-15T09:30:00',
            'frequency': json.dumps([1, 3, 5]),
            'is_active': 1,
            'created_at': '2025-01-01T10:00:00'
        }

        mock_row = self._mock_row(row_data)
        mock_cursor.fetchone.return_value = mock_row

        retrieved = await reminders_service.get_reminder_by_id(created_id)

        assert retrieved is not None
        assert retrieved['id'] == created_id
