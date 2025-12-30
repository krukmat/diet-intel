"""
Test suite for RemindersService with ReminderRepository
Task 2.1.3: Refactor RemindersService to use Repository Pattern
Target Coverage: 85%+
"""
import pytest
from datetime import datetime
from unittest.mock import patch, AsyncMock, MagicMock
from uuid import uuid4

from app.models.reminder import ReminderRequest, ReminderType
from app.repositories.reminder_repository import ReminderRepository, ReminderEntity
from app.services.reminders_service import RemindersService


@pytest.fixture
def mock_reminder_repository():
    """Create mock ReminderRepository"""
    return AsyncMock(spec=ReminderRepository)


@pytest.fixture
def sample_reminder_request():
    """Create sample ReminderRequest - Task 2.1.3"""
    return ReminderRequest(
        label="Morning Meal",
        type=ReminderType.MEAL,
        time="08:30",
        days=[True, True, True, True, True, False, False],  # Mon-Fri
        enabled=True
    )


@pytest.fixture
def sample_reminder_entity():
    """Create sample ReminderEntity for testing"""
    reminder_id = str(uuid4())
    return ReminderEntity(
        reminder_id=reminder_id,
        user_id="user_123",
        title="Morning Meal",
        description="meal",
        reminder_time=datetime.now(),
        frequency='[true, true, true, true, true, false, false]',
        is_active=True
    )


class TestRemindersServiceWithRepository:
    """Test RemindersService using ReminderRepository"""

    @pytest.mark.asyncio
    async def test_create_reminder_success(self, mock_reminder_repository, sample_reminder_request):
        """Test creating a reminder - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        reminder_id = str(uuid4())
        created_reminder = ReminderEntity(
            reminder_id=reminder_id,
            user_id="user_123",
            title=sample_reminder_request.label,
            description=sample_reminder_request.type.value,
            reminder_time=datetime.now(),
            frequency='[true, true, true, true, true, false, false]',
            is_active=sample_reminder_request.enabled
        )
        mock_reminder_repository.create = AsyncMock(return_value=created_reminder)

        # Execute
        result_id = await service.create_reminder("user_123", sample_reminder_request)

        # Verify
        assert result_id == reminder_id
        mock_reminder_repository.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_reminder_with_different_days(self, mock_reminder_repository):
        """Test creating reminder with custom days - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        reminder_request = ReminderRequest(
            label="Weekend Reminder",
            type=ReminderType.MEAL,
            time="14:00",
            days=[False, False, False, False, False, True, True],  # Weekends only
            enabled=True
        )

        reminder_id = str(uuid4())
        created_reminder = ReminderEntity(
            reminder_id=reminder_id,
            user_id="user_123",
            title=reminder_request.label,
            description=reminder_request.type.value,
            reminder_time=datetime.now(),
            frequency='[false, false, false, false, false, true, true]',
            is_active=True
        )
        mock_reminder_repository.create = AsyncMock(return_value=created_reminder)

        # Execute
        result_id = await service.create_reminder("user_123", reminder_request)

        # Verify
        assert result_id == reminder_id

    @pytest.mark.asyncio
    async def test_get_reminder_by_id(self, mock_reminder_repository, sample_reminder_entity):
        """Test retrieving reminder by ID - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        mock_reminder_repository.get_by_id = AsyncMock(return_value=sample_reminder_entity)

        # Execute
        result = await service.get_reminder_by_id(sample_reminder_entity.id)

        # Verify
        assert result is not None
        assert result["id"] == sample_reminder_entity.id
        assert result["label"] == "Morning Meal"
        mock_reminder_repository.get_by_id.assert_called_once_with(sample_reminder_entity.id)

    @pytest.mark.asyncio
    async def test_get_reminder_not_found(self, mock_reminder_repository):
        """Test retrieving non-existent reminder - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        mock_reminder_repository.get_by_id = AsyncMock(return_value=None)

        # Execute
        result = await service.get_reminder_by_id(str(uuid4()))

        # Verify
        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_reminders(self, mock_reminder_repository):
        """Test retrieving user reminders - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        user_id = "user_123"
        reminders = [
            ReminderEntity(
                reminder_id=str(uuid4()),
                user_id=user_id,
                title="Morning Reminder",
                description="meal",
                reminder_time=datetime.now(),
                frequency='[true, true, true, true, true, false, false]',
                is_active=True
            ),
            ReminderEntity(
                reminder_id=str(uuid4()),
                user_id=user_id,
                title="Evening Reminder",
                description="weight",
                reminder_time=datetime.now(),
                frequency='[true, true, true, true, true, false, false]',
                is_active=True
            )
        ]
        mock_reminder_repository.get_by_user_id = AsyncMock(return_value=reminders)

        # Execute
        result = await service.get_user_reminders(user_id)

        # Verify
        assert len(result) == 2
        assert result[0]["label"] == "Morning Reminder"
        assert result[1]["label"] == "Evening Reminder"
        mock_reminder_repository.get_by_user_id.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_user_reminders_empty(self, mock_reminder_repository):
        """Test retrieving reminders when none exist - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        user_id = "user_456"
        mock_reminder_repository.get_by_user_id = AsyncMock(return_value=[])

        # Execute
        result = await service.get_user_reminders(user_id)

        # Verify
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_update_reminder_partial(self, mock_reminder_repository):
        """Test partial reminder update - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        reminder_id = str(uuid4())
        updates = {"label": "Updated Label", "enabled": False}

        updated_reminder = ReminderEntity(
            reminder_id=reminder_id,
            user_id="user_123",
            title="Updated Label",
            description="meal",
            reminder_time=datetime.now(),
            frequency='[true, true, true, true, true, false, false]',
            is_active=False
        )
        mock_reminder_repository.update = AsyncMock(return_value=updated_reminder)

        # Execute
        result = await service.update_reminder(reminder_id, updates)

        # Verify
        assert result is not None
        assert result["label"] == "Updated Label"
        assert result["enabled"] is False

    @pytest.mark.asyncio
    async def test_update_reminder_not_found(self, mock_reminder_repository):
        """Test updating non-existent reminder - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        mock_reminder_repository.update = AsyncMock(return_value=None)

        # Execute
        result = await service.update_reminder(str(uuid4()), {"label": "New Label"})

        # Verify
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_reminder_success(self, mock_reminder_repository):
        """Test deleting a reminder - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        reminder_id = str(uuid4())
        mock_reminder_repository.delete = AsyncMock(return_value=True)

        # Execute
        result = await service.delete_reminder(reminder_id)

        # Verify
        assert result is True
        mock_reminder_repository.delete.assert_called_once_with(reminder_id)

    @pytest.mark.asyncio
    async def test_delete_reminder_not_found(self, mock_reminder_repository):
        """Test deleting non-existent reminder - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        mock_reminder_repository.delete = AsyncMock(return_value=False)

        # Execute
        result = await service.delete_reminder(str(uuid4()))

        # Verify
        assert result is False

    @pytest.mark.asyncio
    async def test_update_reminder_time(self, mock_reminder_repository):
        """Test updating reminder time - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        reminder_id = str(uuid4())
        updates = {"time": "15:30"}

        updated_reminder = ReminderEntity(
            reminder_id=reminder_id,
            user_id="user_123",
            title="Morning Meal",
            description="meal",
            reminder_time=datetime.now().replace(hour=15, minute=30),
            frequency='[true, true, true, true, true, false, false]',
            is_active=True
        )
        mock_reminder_repository.update = AsyncMock(return_value=updated_reminder)

        # Execute
        result = await service.update_reminder(reminder_id, updates)

        # Verify
        assert result is not None
        assert result["time"] == "15:30"

    @pytest.mark.asyncio
    async def test_update_reminder_days(self, mock_reminder_repository):
        """Test updating reminder days - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        reminder_id = str(uuid4())
        new_days = [False, False, False, False, False, True, True]  # Weekends only
        updates = {"days": new_days}

        updated_reminder = ReminderEntity(
            reminder_id=reminder_id,
            user_id="user_123",
            title="Morning Meal",
            description="meal",
            reminder_time=datetime.now(),
            frequency='[false, false, false, false, false, true, true]',
            is_active=True
        )
        mock_reminder_repository.update = AsyncMock(return_value=updated_reminder)

        # Execute
        result = await service.update_reminder(reminder_id, updates)

        # Verify
        assert result is not None
        assert result["days"] == new_days

    @pytest.mark.asyncio
    async def test_create_reminder_error_handling(self, mock_reminder_repository, sample_reminder_request):
        """Test reminder creation error handling - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        mock_reminder_repository.create = AsyncMock(side_effect=Exception("DB error"))

        # Execute & Verify
        with pytest.raises(RuntimeError):
            await service.create_reminder("user_123", sample_reminder_request)

    @pytest.mark.asyncio
    async def test_get_user_reminders_error_handling(self, mock_reminder_repository):
        """Test getting user reminders with error - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        mock_reminder_repository.get_by_user_id = AsyncMock(side_effect=Exception("DB error"))

        # Execute & Verify - should return empty list on error
        result = await service.get_user_reminders("user_123")
        assert result == []

    @pytest.mark.asyncio
    async def test_update_reminder_empty_updates(self, mock_reminder_repository):
        """Test updating reminder with no changes - Task 2.1.3"""
        service = RemindersService(mock_reminder_repository)

        reminder_id = str(uuid4())

        # Execute - empty updates should be handled gracefully
        result = await service.update_reminder(reminder_id, {})

        # Verify - should return None or skip update
        assert result is None or result is True
