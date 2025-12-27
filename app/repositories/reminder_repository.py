"""
Reminder Repository for CRUD operations on reminders
Replaces reminder-related functions from database.py
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.repositories.base import Repository
from app.repositories.connection import connection_manager

logger = logging.getLogger(__name__)


class ReminderEntity:
    """Data class for reminder"""
    def __init__(self, reminder_id: str, user_id: str, title: str,
                 reminder_time: datetime, frequency: str,
                 description: Optional[str] = None, is_active: bool = True,
                 last_triggered: Optional[datetime] = None,
                 created_at: Optional[datetime] = None):
        self.id = reminder_id
        self.user_id = user_id
        self.title = title
        self.description = description
        self.reminder_time = reminder_time
        self.frequency = frequency
        self.is_active = is_active
        self.last_triggered = last_triggered
        self.created_at = created_at or datetime.now()


class ReminderRepository:
    """
    Repository for reminder operations.
    Manages reminders table.
    """

    def __init__(self):
        """Initialize ReminderRepository (uses connection_manager, not db_path)"""
        self.logger = logging.getLogger(self.__class__.__name__)

    async def create(self, reminder: ReminderEntity) -> ReminderEntity:
        """Create new reminder"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()

            try:
                cursor.execute(
                    """
                    INSERT INTO reminders
                    (id, user_id, title, description, reminder_time, frequency, is_active, last_triggered, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        reminder.id,
                        reminder.user_id,
                        reminder.title,
                        reminder.description,
                        reminder.reminder_time.isoformat(),
                        reminder.frequency,
                        int(reminder.is_active),
                        reminder.last_triggered.isoformat() if reminder.last_triggered else None,
                        reminder.created_at.isoformat()
                    )
                )
                conn.commit()
                self.logger.info(f"Reminder created: {reminder.id}")
                return reminder
            except Exception as e:
                conn.rollback()
                self.logger.error(f"Failed to create reminder: {e}")
                raise

    async def get_by_id(self, reminder_id: str) -> Optional[ReminderEntity]:
        """Get reminder by ID"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, user_id, title, description, reminder_time, frequency, is_active, last_triggered, created_at
                FROM reminders WHERE id = ?
                """,
                (reminder_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None

            return ReminderEntity(
                reminder_id=row['id'],
                user_id=row['user_id'],
                title=row['title'],
                description=row['description'],
                reminder_time=datetime.fromisoformat(row['reminder_time']) if row['reminder_time'] else datetime.now(),
                frequency=row['frequency'],
                is_active=bool(row['is_active']),
                last_triggered=datetime.fromisoformat(row['last_triggered']) if row['last_triggered'] else None,
                created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else None
            )

    async def get_by_user_id(self, user_id: str, active_only: bool = True) -> List[ReminderEntity]:
        """Get all reminders for a user"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()

            if active_only:
                cursor.execute(
                    """
                    SELECT id, user_id, title, description, reminder_time, frequency, is_active, last_triggered, created_at
                    FROM reminders
                    WHERE user_id = ? AND is_active = 1
                    ORDER BY reminder_time ASC
                    """,
                    (user_id,)
                )
            else:
                cursor.execute(
                    """
                    SELECT id, user_id, title, description, reminder_time, frequency, is_active, last_triggered, created_at
                    FROM reminders
                    WHERE user_id = ?
                    ORDER BY reminder_time ASC
                    """,
                    (user_id,)
                )

            rows = cursor.fetchall()
            return [
                ReminderEntity(
                    reminder_id=row['id'],
                    user_id=row['user_id'],
                    title=row['title'],
                    description=row['description'],
                    reminder_time=datetime.fromisoformat(row['reminder_time']) if row['reminder_time'] else datetime.now(),
                    frequency=row['frequency'],
                    is_active=bool(row['is_active']),
                    last_triggered=datetime.fromisoformat(row['last_triggered']) if row['last_triggered'] else None,
                    created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else None
                )
                for row in rows
            ]

    async def update(self, reminder_id: str, updates: Dict[str, Any]) -> Optional[ReminderEntity]:
        """Update reminder fields"""
        if not updates:
            return await self.get_by_id(reminder_id)

        # Convert datetime fields to ISO format
        if 'reminder_time' in updates and isinstance(updates['reminder_time'], datetime):
            updates['reminder_time'] = updates['reminder_time'].isoformat()
        if 'last_triggered' in updates and isinstance(updates['last_triggered'], datetime):
            updates['last_triggered'] = updates['last_triggered'].isoformat()

        set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
        values = list(updates.values()) + [reminder_id]

        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()

            try:
                cursor.execute(
                    f"UPDATE reminders SET {set_clause} WHERE id = ?",
                    values
                )
                conn.commit()
                self.logger.info(f"Reminder updated: {reminder_id}")
            except Exception as e:
                conn.rollback()
                self.logger.error(f"Failed to update reminder: {e}")
                raise

        return await self.get_by_id(reminder_id)

    async def delete(self, reminder_id: str) -> bool:
        """Soft delete reminder (set is_active = 0)"""
        try:
            result = await self.update(reminder_id, {"is_active": 0})
            self.logger.info(f"Reminder soft deleted: {reminder_id}")
            return result is not None
        except Exception as e:
            self.logger.error(f"Failed to delete reminder: {e}")
            raise

    async def hard_delete(self, reminder_id: str) -> bool:
        """Hard delete reminder from database"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()

            try:
                cursor.execute("DELETE FROM reminders WHERE id = ?", (reminder_id,))
                conn.commit()
                self.logger.info(f"Reminder hard deleted: {reminder_id}")
                return True
            except Exception as e:
                conn.rollback()
                self.logger.error(f"Failed to hard delete reminder: {e}")
                raise

    async def count_user_reminders(self, user_id: str, active_only: bool = True) -> int:
        """Count reminders for user"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()

            if active_only:
                cursor.execute(
                    "SELECT COUNT(*) FROM reminders WHERE user_id = ? AND is_active = 1",
                    (user_id,)
                )
            else:
                cursor.execute(
                    "SELECT COUNT(*) FROM reminders WHERE user_id = ?",
                    (user_id,)
                )

            return cursor.fetchone()[0]
