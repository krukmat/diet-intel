"""
Reminders Service Coverage Tests - Phase 3
Task 3.3: Improve coverage from 77% to 85%

Tests for RemindersService with repository pattern and datetime handling
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime
import json
from app.services.reminders_service import RemindersService
from app.repositories.reminder_repository import ReminderRepository, ReminderEntity


@pytest.fixture
def mock_repository():
    """Create mock repository"""
    mock_repo = AsyncMock(spec=ReminderRepository)
    return mock_repo


@pytest.fixture
def reminders_service(mock_repository):
    """Create RemindersService with mocked repository"""
    return RemindersService(repository=mock_repository)


@pytest.fixture
def mock_reminder_request():
    """Create mock ReminderRequest"""
    mock_request = MagicMock()
    mock_request.label = "Take medication"
    mock_request.type = MagicMock()
    mock_request.type.value = "medication"
    mock_request.time = "09:30"
    mock_request.days = [True, False, True, False, True, False, False]  # M-W-F
    mock_request.enabled = True
    return mock_request


@pytest.fixture
def mock_reminder_entity():
    """Create mock ReminderEntity"""
    entity = MagicMock(spec=ReminderEntity)
    entity.id = "reminder-123"
    entity.reminder_id = "reminder-123"
    entity.user_id = "user-123"
    entity.title = "Take medication"
    entity.description = "medication"
    entity.reminder_time = datetime.now().replace(hour=9, minute=30, second=0, microsecond=0)
    entity.frequency = json.dumps([True, False, True, False, True, False, False])
    entity.is_active = True
    entity.created_at = datetime.now()
    return entity


# ==================== Initialization Tests ====================

def test_reminders_service_init_with_repository(mock_repository):
    """Test RemindersService initialization with repository"""
    service = RemindersService(repository=mock_repository)

    assert service is not None
    assert service.repository == mock_repository


def test_reminders_service_init_default_repository():
    """Test RemindersService creates default repository"""
    with patch('app.services.reminders_service.ReminderRepository'):
        service = RemindersService()

        assert service is not None
        assert service.repository is not None


# ==================== Create Reminder Tests ====================

@pytest.mark.asyncio
async def test_create_reminder_success(reminders_service, mock_repository, mock_reminder_request):
    """Test creating reminder successfully"""
    created_entity = MagicMock(spec=ReminderEntity)
    created_entity.id = "reminder-new-123"
    mock_repository.create = AsyncMock(return_value=created_entity)

    result = await reminders_service.create_reminder("user-123", mock_reminder_request)

    assert result == "reminder-new-123"
    assert mock_repository.create.called


@pytest.mark.asyncio
async def test_create_reminder_time_parsing(reminders_service, mock_repository, mock_reminder_request):
    """Test create_reminder parses time correctly"""
    created_entity = MagicMock(spec=ReminderEntity)
    created_entity.id = "reminder-123"
    mock_repository.create = AsyncMock(return_value=created_entity)

    await reminders_service.create_reminder("user-123", mock_reminder_request)

    # Verify repository.create was called with a ReminderEntity
    assert mock_repository.create.called
    call_args = mock_repository.create.call_args[0][0]
    assert call_args.reminder_time.hour == 9
    assert call_args.reminder_time.minute == 30


@pytest.mark.asyncio
async def test_create_reminder_frequency_json(reminders_service, mock_repository, mock_reminder_request):
    """Test create_reminder stores frequency as JSON"""
    created_entity = MagicMock(spec=ReminderEntity)
    created_entity.id = "reminder-123"
    mock_repository.create = AsyncMock(return_value=created_entity)

    await reminders_service.create_reminder("user-123", mock_reminder_request)

    call_args = mock_repository.create.call_args[0][0]
    frequency_dict = json.loads(call_args.frequency)
    assert isinstance(frequency_dict, list)
    assert len(frequency_dict) == 7


@pytest.mark.asyncio
async def test_create_reminder_error_handling(reminders_service, mock_repository):
    """Test create_reminder handles errors"""
    mock_repository.create = AsyncMock(side_effect=Exception("DB Error"))
    mock_request = MagicMock()
    mock_request.label = "Test"
    mock_request.type.value = "test"
    mock_request.time = "09:30"
    mock_request.days = [True] * 7
    mock_request.enabled = True

    with pytest.raises(RuntimeError):
        await reminders_service.create_reminder("user-123", mock_request)


# ==================== Get Reminder by ID Tests ====================

@pytest.mark.asyncio
async def test_get_reminder_by_id_found(reminders_service, mock_repository, mock_reminder_entity):
    """Test retrieving reminder by ID when found"""
    mock_repository.get_by_id = AsyncMock(return_value=mock_reminder_entity)

    result = await reminders_service.get_reminder_by_id("reminder-123")

    assert result is not None
    assert result["id"] == "reminder-123"
    assert result["label"] == "Take medication"
    assert result["time"] == "09:30"


@pytest.mark.asyncio
async def test_get_reminder_by_id_not_found(reminders_service, mock_repository):
    """Test retrieving reminder by ID when not found"""
    mock_repository.get_by_id = AsyncMock(return_value=None)

    result = await reminders_service.get_reminder_by_id("nonexistent")

    assert result is None


@pytest.mark.asyncio
async def test_get_reminder_by_id_time_parsing(reminders_service, mock_repository):
    """Test get_reminder_by_id parses time from datetime"""
    entity = MagicMock(spec=ReminderEntity)
    entity.id = "reminder-123"
    entity.reminder_time = datetime.now().replace(hour=14, minute=45, second=0, microsecond=0)
    entity.title = "Lunch"
    entity.description = "meal"
    entity.frequency = json.dumps([True] * 7)
    entity.is_active = True
    entity.created_at = datetime.now()

    mock_repository.get_by_id = AsyncMock(return_value=entity)

    result = await reminders_service.get_reminder_by_id("reminder-123")

    assert result["time"] == "14:45"


@pytest.mark.asyncio
async def test_get_reminder_by_id_invalid_time_format(reminders_service, mock_repository):
    """Test get_reminder_by_id handles invalid time format"""
    entity = MagicMock(spec=ReminderEntity)
    entity.id = "reminder-123"
    entity.reminder_time = None  # Invalid
    entity.title = "Test"
    entity.description = "test"
    entity.frequency = json.dumps([True] * 7)
    entity.is_active = True
    entity.created_at = datetime.now()

    mock_repository.get_by_id = AsyncMock(return_value=entity)

    result = await reminders_service.get_reminder_by_id("reminder-123")

    assert result["time"] == "00:00"  # Default fallback


@pytest.mark.asyncio
async def test_get_reminder_by_id_invalid_frequency(reminders_service, mock_repository):
    """Test get_reminder_by_id handles invalid JSON frequency"""
    entity = MagicMock(spec=ReminderEntity)
    entity.id = "reminder-123"
    entity.reminder_time = datetime.now().replace(hour=9, minute=30)
    entity.title = "Test"
    entity.description = "test"
    entity.frequency = "invalid json"  # Invalid JSON
    entity.is_active = True
    entity.created_at = datetime.now()

    mock_repository.get_by_id = AsyncMock(return_value=entity)

    result = await reminders_service.get_reminder_by_id("reminder-123")

    assert result["days"] == []  # Default to empty


@pytest.mark.asyncio
async def test_get_reminder_by_id_error_handling(reminders_service, mock_repository):
    """Test get_reminder_by_id returns None on error"""
    mock_repository.get_by_id = AsyncMock(side_effect=Exception("DB Error"))

    result = await reminders_service.get_reminder_by_id("reminder-123")

    assert result is None


# ==================== Get User Reminders Tests ====================

@pytest.mark.asyncio
async def test_get_user_reminders_empty(reminders_service, mock_repository):
    """Test getting user reminders when none exist"""
    mock_repository.get_by_user_id = AsyncMock(return_value=[])

    result = await reminders_service.get_user_reminders("user-123")

    assert result == []


@pytest.mark.asyncio
async def test_get_user_reminders_multiple(reminders_service, mock_repository):
    """Test getting multiple reminders for a user"""
    entity1 = MagicMock(spec=ReminderEntity)
    entity1.id = "reminder-1"
    entity1.reminder_time = datetime.now().replace(hour=9, minute=30)
    entity1.title = "Reminder 1"
    entity1.description = "type1"
    entity1.frequency = json.dumps([True] * 7)
    entity1.is_active = True
    entity1.created_at = datetime.now()

    entity2 = MagicMock(spec=ReminderEntity)
    entity2.id = "reminder-2"
    entity2.reminder_time = datetime.now().replace(hour=14, minute=45)
    entity2.title = "Reminder 2"
    entity2.description = "type2"
    entity2.frequency = json.dumps([False] * 7)
    entity2.is_active = False
    entity2.created_at = datetime.now()

    mock_repository.get_by_user_id = AsyncMock(return_value=[entity1, entity2])

    result = await reminders_service.get_user_reminders("user-123")

    assert len(result) == 2
    assert result[0]["id"] == "reminder-1"
    assert result[1]["id"] == "reminder-2"
    assert result[0]["enabled"] is True
    assert result[1]["enabled"] is False


@pytest.mark.asyncio
async def test_get_user_reminders_error_handling(reminders_service, mock_repository):
    """Test get_user_reminders returns empty list on error"""
    mock_repository.get_by_user_id = AsyncMock(side_effect=Exception("DB Error"))

    result = await reminders_service.get_user_reminders("user-123")

    assert result == []


# ==================== Update Reminder Tests ====================

@pytest.mark.asyncio
async def test_update_reminder_label(reminders_service, mock_repository, mock_reminder_entity):
    """Test updating reminder label"""
    mock_repository.update = AsyncMock(return_value=mock_reminder_entity)

    result = await reminders_service.update_reminder("reminder-123", {"label": "New Label"})

    assert result is not None
    assert mock_repository.update.called
    call_args = mock_repository.update.call_args
    assert call_args[0][0] == "reminder-123"
    assert "title" in call_args[0][1]
    assert call_args[0][1]["title"] == "New Label"


@pytest.mark.asyncio
async def test_update_reminder_time(reminders_service, mock_repository, mock_reminder_entity):
    """Test updating reminder time"""
    mock_repository.update = AsyncMock(return_value=mock_reminder_entity)

    result = await reminders_service.update_reminder("reminder-123", {"time": "14:45"})

    assert result is not None
    call_args = mock_repository.update.call_args
    assert "reminder_time" in call_args[0][1]
    updated_time = call_args[0][1]["reminder_time"]
    assert updated_time.hour == 14
    assert updated_time.minute == 45


@pytest.mark.asyncio
async def test_update_reminder_days(reminders_service, mock_repository, mock_reminder_entity):
    """Test updating reminder days"""
    new_days = [False, True, False, True, False, True, False]
    mock_repository.update = AsyncMock(return_value=mock_reminder_entity)

    result = await reminders_service.update_reminder("reminder-123", {"days": new_days})

    assert result is not None
    call_args = mock_repository.update.call_args
    assert "frequency" in call_args[0][1]
    frequency_dict = json.loads(call_args[0][1]["frequency"])
    assert frequency_dict == new_days


@pytest.mark.asyncio
async def test_update_reminder_enabled(reminders_service, mock_repository, mock_reminder_entity):
    """Test updating reminder enabled status"""
    mock_repository.update = AsyncMock(return_value=mock_reminder_entity)

    result = await reminders_service.update_reminder("reminder-123", {"enabled": False})

    assert result is not None
    call_args = mock_repository.update.call_args
    assert "is_active" in call_args[0][1]
    assert call_args[0][1]["is_active"] is False


@pytest.mark.asyncio
async def test_update_reminder_multiple_fields(reminders_service, mock_repository, mock_reminder_entity):
    """Test updating multiple reminder fields"""
    updates = {
        "label": "Updated Label",
        "time": "16:00",
        "enabled": False
    }
    mock_repository.update = AsyncMock(return_value=mock_reminder_entity)

    result = await reminders_service.update_reminder("reminder-123", updates)

    assert result is not None
    call_args = mock_repository.update.call_args
    update_dict = call_args[0][1]
    assert "title" in update_dict
    assert "reminder_time" in update_dict
    assert "is_active" in update_dict


@pytest.mark.asyncio
async def test_update_reminder_empty_updates(reminders_service, mock_repository):
    """Test update_reminder with empty updates"""
    result = await reminders_service.update_reminder("reminder-123", {})

    assert result is None
    assert not mock_repository.update.called


@pytest.mark.asyncio
async def test_update_reminder_invalid_time_format(reminders_service, mock_repository, mock_reminder_entity):
    """Test update_reminder handles invalid time format"""
    mock_repository.update = AsyncMock(return_value=mock_reminder_entity)

    result = await reminders_service.update_reminder("reminder-123", {"time": "invalid"})

    # Should still return updated reminder (invalid time skipped)
    assert result is not None


@pytest.mark.asyncio
async def test_update_reminder_not_found(reminders_service, mock_repository):
    """Test update_reminder returns None when reminder not found"""
    mock_repository.update = AsyncMock(return_value=None)

    result = await reminders_service.update_reminder("nonexistent", {"label": "New"})

    assert result is None


@pytest.mark.asyncio
async def test_update_reminder_error_handling(reminders_service, mock_repository):
    """Test update_reminder returns None on error"""
    mock_repository.update = AsyncMock(side_effect=Exception("DB Error"))

    result = await reminders_service.update_reminder("reminder-123", {"label": "New"})

    assert result is None


# ==================== Delete Reminder Tests ====================

@pytest.mark.asyncio
async def test_delete_reminder_success(reminders_service, mock_repository):
    """Test deleting reminder successfully"""
    mock_repository.delete = AsyncMock(return_value=True)

    result = await reminders_service.delete_reminder("reminder-123")

    assert result is True
    assert mock_repository.delete.called


@pytest.mark.asyncio
async def test_delete_reminder_not_found(reminders_service, mock_repository):
    """Test deleting non-existent reminder"""
    mock_repository.delete = AsyncMock(return_value=False)

    result = await reminders_service.delete_reminder("nonexistent")

    assert result is False


@pytest.mark.asyncio
async def test_delete_reminder_error_handling(reminders_service, mock_repository):
    """Test delete_reminder returns False on error"""
    mock_repository.delete = AsyncMock(side_effect=Exception("DB Error"))

    result = await reminders_service.delete_reminder("reminder-123")

    assert result is False


# ==================== Helper Method Tests ====================

def test_reminder_to_dict(reminders_service, mock_reminder_entity):
    """Test converting ReminderEntity to dict"""
    result = reminders_service._reminder_to_dict(mock_reminder_entity)

    assert isinstance(result, dict)
    assert result["id"] == "reminder-123"
    assert result["label"] == "Take medication"
    assert result["type"] == "medication"
    assert result["time"] == "09:30"
    assert isinstance(result["days"], list)
    assert result["enabled"] is True


def test_reminder_to_dict_invalid_time(reminders_service):
    """Test _reminder_to_dict handles invalid time"""
    entity = MagicMock(spec=ReminderEntity)
    entity.id = "reminder-123"
    entity.reminder_time = None
    entity.title = "Test"
    entity.description = "test"
    entity.frequency = json.dumps([True] * 7)
    entity.is_active = True
    entity.created_at = datetime.now()

    result = reminders_service._reminder_to_dict(entity)

    assert result["time"] == "00:00"


def test_reminder_to_dict_invalid_frequency(reminders_service):
    """Test _reminder_to_dict handles invalid frequency"""
    entity = MagicMock(spec=ReminderEntity)
    entity.id = "reminder-123"
    entity.reminder_time = datetime.now()
    entity.title = "Test"
    entity.description = "test"
    entity.frequency = "invalid"
    entity.is_active = True
    entity.created_at = datetime.now()

    result = reminders_service._reminder_to_dict(entity)

    assert result["days"] == []


# ==================== Global Instance Tests ====================

def test_reminders_service_global_instance():
    """Test global reminders_service instance exists"""
    from app.services.reminders_service import reminders_service

    assert reminders_service is not None
    assert isinstance(reminders_service, RemindersService)
