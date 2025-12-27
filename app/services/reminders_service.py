"""Reminders Service - Handles reminder operations.

Task: Phase 2 Batch 5 - Database refactoring (extracted from database.py)
Task 2.1.3: Refactored to use Repository Pattern
Coverage Goal: 85%+ (target: 80%+)
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import uuid
import logging
from app.repositories.reminder_repository import ReminderRepository, ReminderEntity

logger = logging.getLogger(__name__)


class RemindersService:
    """Service for managing user reminders.

    Handles:
    - Reminder creation, retrieval, update, deletion
    - Frequency/scheduling management
    - Time parsing and datetime handling
    - JSON serialization for days array

    Task 2.1.3: Refactored to use Repository Pattern
    """

    def __init__(self, repository: Optional[ReminderRepository] = None):
        """Initialize RemindersService with repository dependency.

        Args:
            repository: ReminderRepository instance for data access

        Task 2.1.3: Uses ReminderRepository instead of DatabaseService
        """
        self.repository = repository or ReminderRepository()

    async def create_reminder(self, user_id: str, reminder_data: 'ReminderRequest') -> str:
        """Create a new reminder.

        Args:
            user_id: User identifier
            reminder_data: ReminderRequest model with reminder details

        Returns:
            Created reminder ID

        Coverage Goal: Test successful creation, UUID generation, time parsing

        Task 2.1.3: Uses ReminderRepository
        """
        from app.models.reminder import ReminderRequest

        try:
            reminder_id = str(uuid.uuid4())

            # Convert reminder time and days to storage format
            frequency = json.dumps(reminder_data.days)  # Store days array as JSON

            # Create a proper timestamp for reminder_time (next occurrence)
            next_reminder_time = datetime.now().replace(
                hour=int(reminder_data.time.split(':')[0]),
                minute=int(reminder_data.time.split(':')[1]),
                second=0,
                microsecond=0
            )

            # Create reminder entity - Task 2.1.3
            reminder = ReminderEntity(
                reminder_id=reminder_id,
                user_id=user_id,
                title=reminder_data.label,
                description=reminder_data.type.value,
                reminder_time=next_reminder_time,
                frequency=frequency,
                is_active=reminder_data.enabled
            )

            # Create via repository - Task 2.1.3
            created = await self.repository.create(reminder)

            logger.info(f"Created reminder {created.id} for user {user_id}: {reminder_data.label}")
            return created.id

        except Exception as e:
            logger.error(f"Error creating reminder for user {user_id}: {e}")
            raise RuntimeError(f"Failed to create reminder: {str(e)}")

    async def get_reminder_by_id(self, reminder_id: str) -> Optional[Dict]:
        """Get a reminder by ID.

        Args:
            reminder_id: The reminder ID to retrieve

        Returns:
            Dictionary with reminder data if found, None otherwise

        Coverage Goal: Test retrieval, datetime parsing, JSON deserialization

        Task 2.1.3: Uses ReminderRepository
        """
        try:
            reminder = await self.repository.get_by_id(reminder_id)

            if not reminder:
                return None

            # Extract time from reminder_time timestamp
            try:
                time_str = f"{reminder.reminder_time.hour:02d}:{reminder.reminder_time.minute:02d}"
            except (ValueError, TypeError, AttributeError):
                time_str = "00:00"

            try:
                days = json.loads(reminder.frequency) if reminder.frequency else []
            except (json.JSONDecodeError, TypeError):
                days = []

            return {
                "id": reminder.id,
                "type": reminder.description,
                "label": reminder.title,
                "time": time_str,
                "days": days,
                "enabled": bool(reminder.is_active),
                "created_at": reminder.created_at if isinstance(reminder.created_at, datetime) else datetime.fromisoformat(reminder.created_at),
                "updated_at": reminder.created_at if isinstance(reminder.created_at, datetime) else datetime.fromisoformat(reminder.created_at)
            }
        except Exception as e:
            logger.error(f"Error retrieving reminder {reminder_id}: {e}")
            return None

    async def get_user_reminders(self, user_id: str) -> List[Dict]:
        """Get all reminders for a user.

        Args:
            user_id: User identifier to retrieve reminders for

        Returns:
            List of reminder dictionaries

        Coverage Goal: Test iteration, datetime parsing, JSON handling

        Task 2.1.3: Uses ReminderRepository
        """
        try:
            reminders_data = await self.repository.get_by_user_id(user_id)

            reminders = []
            for reminder in reminders_data:
                # Extract time from reminder_time timestamp
                try:
                    time_str = f"{reminder.reminder_time.hour:02d}:{reminder.reminder_time.minute:02d}"
                except (ValueError, TypeError, AttributeError):
                    time_str = "00:00"

                try:
                    days = json.loads(reminder.frequency) if reminder.frequency else []
                except (json.JSONDecodeError, TypeError):
                    days = []

                reminders.append({
                    "id": reminder.id,
                    "type": reminder.description,
                    "label": reminder.title,
                    "time": time_str,
                    "days": days,
                    "enabled": bool(reminder.is_active),
                    "created_at": reminder.created_at if isinstance(reminder.created_at, datetime) else datetime.fromisoformat(reminder.created_at),
                    "updated_at": reminder.created_at if isinstance(reminder.created_at, datetime) else datetime.fromisoformat(reminder.created_at)
                })

            return reminders
        except Exception as e:
            logger.error(f"Error retrieving reminders for user {user_id}: {e}")
            return []

    async def update_reminder(self, reminder_id: str, updates: Dict[str, Any]) -> Optional[Dict]:
        """Update a reminder with partial or full updates.

        Args:
            reminder_id: The reminder ID to update
            updates: Dictionary with fields to update (label, type, time, days, enabled)

        Returns:
            Updated reminder dict if successful, None if reminder not found

        Coverage Goal: Test partial updates, time parsing, dynamic query building

        Task 2.1.3: Uses ReminderRepository
        """
        if not updates:
            return None

        try:
            # Transform updates to repository format
            repo_updates = {}

            if 'label' in updates:
                repo_updates['title'] = updates['label']

            if 'type' in updates:
                repo_updates['description'] = updates['type']

            if 'time' in updates:
                # Convert time to full timestamp
                try:
                    time_parts = updates['time'].split(':')
                    next_reminder_time = datetime.now().replace(
                        hour=int(time_parts[0]),
                        minute=int(time_parts[1]),
                        second=0,
                        microsecond=0
                    )
                    repo_updates['reminder_time'] = next_reminder_time
                except (ValueError, IndexError):
                    pass  # Skip invalid time format

            if 'days' in updates:
                repo_updates['frequency'] = json.dumps(updates['days'])

            if 'enabled' in updates:
                repo_updates['is_active'] = updates['enabled']

            # Update via repository - Task 2.1.3
            updated_reminder = await self.repository.update(reminder_id, repo_updates)

            if updated_reminder:
                logger.info(f"Updated reminder {reminder_id}")
                # Convert back to response format
                return self._reminder_to_dict(updated_reminder)
            else:
                return None

        except Exception as e:
            logger.error(f"Error updating reminder {reminder_id}: {e}")
            return None

    def _reminder_to_dict(self, reminder: ReminderEntity) -> Dict[str, Any]:
        """Convert ReminderEntity to dictionary response format - Task 2.1.3"""
        try:
            time_str = f"{reminder.reminder_time.hour:02d}:{reminder.reminder_time.minute:02d}"
        except (ValueError, TypeError, AttributeError):
            time_str = "00:00"

        try:
            days = json.loads(reminder.frequency) if reminder.frequency else []
        except (json.JSONDecodeError, TypeError):
            days = []

        return {
            "id": reminder.id,
            "type": reminder.description,
            "label": reminder.title,
            "time": time_str,
            "days": days,
            "enabled": bool(reminder.is_active),
            "created_at": reminder.created_at if isinstance(reminder.created_at, datetime) else datetime.fromisoformat(reminder.created_at),
            "updated_at": reminder.created_at if isinstance(reminder.created_at, datetime) else datetime.fromisoformat(reminder.created_at)
        }

    async def delete_reminder(self, reminder_id: str) -> bool:
        """Delete a reminder.

        Args:
            reminder_id: The reminder ID to delete

        Returns:
            True if deleted, False if reminder not found

        Coverage Goal: Test deletion, rowcount checking

        Task 2.1.3: Uses ReminderRepository
        """
        try:
            deleted = await self.repository.delete(reminder_id)

            if deleted:
                logger.info(f"Deleted reminder {reminder_id}")

            return deleted
        except Exception as e:
            logger.error(f"Error deleting reminder {reminder_id}: {e}")
            return False


# Global service instance - Task 2.1.3: RemindersService
# Task 2.1.3: Now uses ReminderRepository instead of DatabaseService
reminders_service = RemindersService()
