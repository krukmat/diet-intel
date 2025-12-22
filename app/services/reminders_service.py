"""Reminders Service - Handles reminder operations.

Task: Phase 2 Batch 5 - Database refactoring (extracted from database.py)
Coverage Goal: 80%+ (currently 20% in database.py)
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import uuid
from app.services.database import DatabaseService


class RemindersService:
    """Service for managing user reminders.

    Handles:
    - Reminder creation, retrieval, update, deletion
    - Frequency/scheduling management
    - Time parsing and datetime handling
    - JSON serialization for days array
    """

    def __init__(self, db_service: DatabaseService):
        """Initialize RemindersService with database dependency.

        Args:
            db_service: DatabaseService instance for database operations
        """
        self.db = db_service

    async def create_reminder(self, user_id: str, reminder_data: 'ReminderRequest') -> str:
        """Create a new reminder.

        Args:
            user_id: User identifier
            reminder_data: ReminderRequest model with reminder details

        Returns:
            Created reminder ID

        Coverage Goal: Test successful creation, UUID generation, time parsing
        """
        from app.models.reminder import ReminderRequest
        import logging

        logger = logging.getLogger(__name__)
        reminder_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        # Convert reminder time and days to storage format
        reminder_time = f"{reminder_data.time}:00"  # Add seconds for time format
        frequency = json.dumps(reminder_data.days)  # Store days array as JSON

        # Create a proper timestamp for reminder_time (next occurrence)
        next_reminder_time = datetime.now().replace(
            hour=int(reminder_data.time.split(':')[0]),
            minute=int(reminder_data.time.split(':')[1]),
            second=0,
            microsecond=0
        )

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO reminders (id, user_id, title, description, reminder_time, frequency, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (reminder_id, user_id, reminder_data.label, reminder_data.type.value,
                  next_reminder_time.isoformat(), frequency, reminder_data.enabled, now))
            conn.commit()

        logger.info(f"Created reminder {reminder_id} for user {user_id}: {reminder_data.label}")
        return reminder_id

    async def get_reminder_by_id(self, reminder_id: str) -> Optional[Dict]:
        """Get a reminder by ID.

        Args:
            reminder_id: The reminder ID to retrieve

        Returns:
            Dictionary with reminder data if found, None otherwise

        Coverage Goal: Test retrieval, datetime parsing, JSON deserialization
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM reminders WHERE id = ?", (reminder_id,))
            row = cursor.fetchone()

            if row:
                # Extract time from reminder_time timestamp
                try:
                    reminder_dt = datetime.fromisoformat(row['reminder_time'])
                    time_str = f"{reminder_dt.hour:02d}:{reminder_dt.minute:02d}"
                except (ValueError, TypeError):
                    time_str = "00:00"

                try:
                    days = json.loads(row['frequency']) if row['frequency'] else []
                except (json.JSONDecodeError, TypeError):
                    days = []

                return {
                    "id": row['id'],
                    "type": row['description'],  # We stored type in description
                    "label": row['title'],
                    "time": time_str,
                    "days": days,
                    "enabled": bool(row['is_active']),
                    "created_at": datetime.fromisoformat(row['created_at']),
                    "updated_at": datetime.fromisoformat(row['created_at'])
                }
            return None

    async def get_user_reminders(self, user_id: str) -> List[Dict]:
        """Get all reminders for a user.

        Args:
            user_id: User identifier to retrieve reminders for

        Returns:
            List of reminder dictionaries

        Coverage Goal: Test iteration, datetime parsing, JSON handling
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM reminders
                WHERE user_id = ?
                ORDER BY reminder_time ASC
            """, (user_id,))
            rows = cursor.fetchall()

            reminders = []
            for row in rows:
                # Extract time from reminder_time timestamp
                try:
                    reminder_dt = datetime.fromisoformat(row['reminder_time'])
                    time_str = f"{reminder_dt.hour:02d}:{reminder_dt.minute:02d}"
                except (ValueError, TypeError):
                    time_str = "00:00"

                try:
                    days = json.loads(row['frequency']) if row['frequency'] else []
                except (json.JSONDecodeError, TypeError):
                    days = []

                reminders.append({
                    "id": row['id'],
                    "type": row['description'],  # We stored type in description
                    "label": row['title'],
                    "time": time_str,
                    "days": days,
                    "enabled": bool(row['is_active']),
                    "created_at": datetime.fromisoformat(row['created_at']),
                    "updated_at": datetime.fromisoformat(row['created_at'])
                })

            return reminders

    async def update_reminder(self, reminder_id: str, updates: Dict[str, Any]) -> bool:
        """Update a reminder with partial or full updates.

        Args:
            reminder_id: The reminder ID to update
            updates: Dictionary with fields to update (label, type, time, days, enabled)

        Returns:
            True if updated, False if reminder not found

        Coverage Goal: Test partial updates, time parsing, dynamic query building
        """
        import logging

        logger = logging.getLogger(__name__)

        if not updates:
            return True

        # Build dynamic update query
        set_clauses = []
        values = []

        if 'label' in updates:
            set_clauses.append("title = ?")
            values.append(updates['label'])

        if 'type' in updates:
            set_clauses.append("description = ?")
            values.append(updates['type'])

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
                set_clauses.append("reminder_time = ?")
                values.append(next_reminder_time.isoformat())
            except (ValueError, IndexError):
                pass  # Skip invalid time format

        if 'days' in updates:
            set_clauses.append("frequency = ?")
            values.append(json.dumps(updates['days']))

        if 'enabled' in updates:
            set_clauses.append("is_active = ?")
            values.append(updates['enabled'])

        if not set_clauses:
            return True

        values.append(reminder_id)

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            query = f"UPDATE reminders SET {', '.join(set_clauses)} WHERE id = ?"
            cursor.execute(query, values)
            updated = cursor.rowcount > 0
            conn.commit()

        if updated:
            logger.info(f"Updated reminder {reminder_id}")

        return updated

    async def delete_reminder(self, reminder_id: str) -> bool:
        """Delete a reminder.

        Args:
            reminder_id: The reminder ID to delete

        Returns:
            True if deleted, False if reminder not found

        Coverage Goal: Test deletion, rowcount checking
        """
        import logging

        logger = logging.getLogger(__name__)

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM reminders WHERE id = ?", (reminder_id,))
            deleted = cursor.rowcount > 0
            conn.commit()

        if deleted:
            logger.info(f"Deleted reminder {reminder_id}")

        return deleted
