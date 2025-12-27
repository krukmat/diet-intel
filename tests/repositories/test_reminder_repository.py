"""
Test suite for ReminderRepository
Task 2.1.1.1: Repository tests for reminder CRUD operations
Target Coverage: 100% of ReminderRepository methods
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import uuid4
from app.repositories.reminder_repository import (
    ReminderRepository,
    ReminderEntity
)


class TestReminderRepository:
    """Test ReminderRepository CRUD operations"""

    @pytest.fixture
    def reminder_repo(self, mock_connection_manager):
        """Create repository with mocked connection manager"""
        with patch('app.repositories.reminder_repository.connection_manager', mock_connection_manager):
            repo = ReminderRepository()
            return repo, mock_connection_manager

    @pytest.mark.asyncio
    async def test_create_reminder(self, reminder_repo):
        """Test creating a reminder - Task 2.1.1.1"""
        repo, conn_mgr = reminder_repo

        reminder = ReminderEntity(
            reminder_id=str(uuid4()),
            user_id="user_123",
            title="Drink Water",
            reminder_time=datetime.now(),
            frequency="daily",
            description="Remind to drink water",
            is_active=True
        )

        created = await repo.create(reminder)

        assert created is not None
        assert created.user_id == "user_123"
        assert created.title == "Drink Water"
        assert created.is_active is True

    @pytest.mark.asyncio
    async def test_get_reminder_by_id(self, reminder_repo):
        """Test retrieving reminder by ID - Task 2.1.1.1"""
        repo, conn_mgr = reminder_repo

        reminder_id = str(uuid4())
        reminder = ReminderEntity(
            reminder_id=reminder_id,
            user_id="user_456",
            title="Exercise",
            reminder_time=datetime(2025, 1, 15, 10, 30),
            frequency="daily",
            description="Do 30 minutes exercise",
            is_active=True
        )
        await repo.create(reminder)

        retrieved = await repo.get_by_id(reminder_id)

        assert retrieved is not None
        assert retrieved.id == reminder_id
        assert retrieved.title == "Exercise"

    @pytest.mark.asyncio
    async def test_get_non_existent_reminder(self, reminder_repo):
        """Test retrieving non-existent reminder returns None - Task 2.1.1.1"""
        repo, conn_mgr = reminder_repo

        result = await repo.get_by_id(str(uuid4()))

        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_reminders_active_only(self, reminder_repo):
        """Test retrieving active reminders for a user - Task 2.1.1.1"""
        repo, conn_mgr = reminder_repo

        user_id = str(uuid4())  # Use unique user ID

        # Create active reminders
        for i in range(2):
            reminder = ReminderEntity(
                reminder_id=str(uuid4()),
                user_id=user_id,
                title=f"Reminder {i}",
                reminder_time=datetime.now() + timedelta(hours=i),
                frequency="daily",
                is_active=True
            )
            await repo.create(reminder)

        # Create inactive reminder
        inactive = ReminderEntity(
            reminder_id=str(uuid4()),
            user_id=user_id,
            title="Inactive",
            reminder_time=datetime.now(),
            frequency="daily",
            is_active=False
        )
        await repo.create(inactive)

        active_reminders = await repo.get_by_user_id(user_id, active_only=True)

        # Verify: should have exactly 2 active reminders
        assert len(active_reminders) == 2
        assert all(r.is_active for r in active_reminders)

    @pytest.mark.asyncio
    async def test_update_reminder(self, reminder_repo):
        """Test updating a reminder - Task 2.1.1.1"""
        repo, conn_mgr = reminder_repo

        reminder_id = str(uuid4())
        reminder = ReminderEntity(
            reminder_id=reminder_id,
            user_id="user_update",
            title="Original Title",
            reminder_time=datetime(2025, 1, 15, 9, 0),
            frequency="daily",
            is_active=True
        )
        await repo.create(reminder)

        updates = {"title": "Updated Title", "frequency": "weekly"}
        updated = await repo.update(reminder_id, updates)

        assert updated is not None
        assert updated.title == "Updated Title"
        assert updated.frequency == "weekly"

    @pytest.mark.asyncio
    async def test_delete_reminder_soft_delete(self, reminder_repo):
        """Test soft deleting a reminder sets is_active=0 - Task 2.1.1.1"""
        repo, conn_mgr = reminder_repo

        reminder_id = str(uuid4())
        reminder = ReminderEntity(
            reminder_id=reminder_id,
            user_id="user_delete",
            title="To Delete",
            reminder_time=datetime.now(),
            frequency="daily",
            is_active=True
        )
        await repo.create(reminder)

        result = await repo.delete(reminder_id)

        assert result is True

        retrieved = await repo.get_by_id(reminder_id)
        assert retrieved is not None
        assert retrieved.is_active is False

    @pytest.mark.asyncio
    async def test_hard_delete_reminder(self, reminder_repo):
        """Test hard deleting a reminder from database - Task 2.1.1.1"""
        repo, conn_mgr = reminder_repo

        reminder_id = str(uuid4())
        reminder = ReminderEntity(
            reminder_id=reminder_id,
            user_id="user_hard_delete",
            title="To Hard Delete",
            reminder_time=datetime.now(),
            frequency="daily",
            is_active=True
        )
        await repo.create(reminder)

        result = await repo.hard_delete(reminder_id)

        assert result is True

        retrieved = await repo.get_by_id(reminder_id)
        assert retrieved is None

    @pytest.mark.asyncio
    async def test_count_user_reminders_active(self, reminder_repo):
        """Test counting active reminders for user - Task 2.1.1.1"""
        repo, conn_mgr = reminder_repo

        user_id = str(uuid4())

        for i in range(2):
            reminder = ReminderEntity(
                reminder_id=str(uuid4()),
                user_id=user_id,
                title=f"Reminder {i}",
                reminder_time=datetime.now() + timedelta(hours=i),
                frequency="daily",
                is_active=True
            )
            await repo.create(reminder)

        inactive = ReminderEntity(
            reminder_id=str(uuid4()),
            user_id=user_id,
            title="Inactive",
            reminder_time=datetime.now(),
            frequency="daily",
            is_active=False
        )
        await repo.create(inactive)

        count = await repo.count_user_reminders(user_id, active_only=True)

        assert count == 2

    @pytest.mark.asyncio
    async def test_reminder_with_different_frequencies(self, reminder_repo):
        """Test creating reminders with different frequencies - Task 2.1.1.1"""
        repo, conn_mgr = reminder_repo

        frequencies = ["once", "daily", "weekly", "monthly"]

        for freq in frequencies:
            reminder = ReminderEntity(
                reminder_id=str(uuid4()),
                user_id="user_freq",
                title=f"Test {freq}",
                reminder_time=datetime.now(),
                frequency=freq,
                is_active=True
            )
            created = await repo.create(reminder)
            assert created.frequency == freq
