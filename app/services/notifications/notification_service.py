# EPIC_A.A5: Notification service for user notifications

from typing import Dict, List, Optional
from app.services.database import db_service
import uuid
from datetime import datetime, timedelta
import json
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for managing user notifications"""

    NOTIFICATION_TYPES = {
        'post_liked': 'Algunos ha reaccionado a tu publicación',
        'post_commented': 'Han comentado en tu publicación',
        'user_followed': 'Han empezado a seguirte',
        'badge_earned': '¡Has ganado una nueva insignia!',
        'level_up': '¡Has subido de nivel!',
        'challenge_completed': '¡Has completado un desafío!'
    }

    @staticmethod
    def enqueue_notification(user_id: str, notification_type: str, payload: Dict) -> str:
        """
        Create a new notification for a user.

        Args:
            user_id: Target user for notification
            notification_type: Type of notification (key from NOTIFICATION_TYPES)
            payload: Notification data (post_id, actor_id, etc.)

        Returns:
            Notification ID if created successfully
        """
        if notification_type not in NotificationService.NOTIFICATION_TYPES:
            logger.warning(f"Unknown notification type: {notification_type}")
            return None

        try:
            notification_id = str(uuid.uuid4())

            # Add timestamp to payload
            payload['timestamp'] = datetime.utcnow().isoformat()
            payload_json = json.dumps(payload)

            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO notifications (id, user_id, type, payload, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    notification_id, user_id, notification_type,
                    payload_json, 'unread', datetime.utcnow().isoformat()
                ))
                conn.commit()

            logger.info(f"Created notification {notification_type} for user {user_id}")
            return notification_id

        except Exception as e:
            logger.error(f"Failed to create notification for {user_id}: {e}")
            return None

    @staticmethod
    def get_user_notifications(user_id: str, unread_only: bool = False, limit: int = 50) -> List[Dict]:
        """
        Get notifications for a user.

        Args:
            user_id: User ID to get notifications for
            unread_only: Show only unread notifications
            limit: Max notifications to return

        Returns:
            List of notification dictionaries
        """
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                # Build query based on unread_only flag
                where_clause = "WHERE user_id = ? AND status != 'deleted'"
                params = [user_id]

                if unread_only:
                    where_clause += " AND read_at IS NULL"

                query = f"""
                    SELECT id, type, payload, read_at, created_at
                    FROM notifications
                    {where_clause}
                    ORDER BY created_at DESC
                    LIMIT ?
                """
                params.append(limit)

                cursor.execute(query, params)
                rows = cursor.fetchall()

                notifications = []
                for row in rows:
                    try:
                        payload = json.loads(row['payload'])
                        title = NotificationService.NOTIFICATION_TYPES.get(row['type'], 'Notification')

                        notification = {
                            'id': row['id'],
                            'type': row['type'],
                            'title': title,
                            'payload': payload,
                            'read_at': row['read_at'],
                            'created_at': row['created_at'],
                            'is_read': row['read_at'] is not None
                        }
                        notifications.append(notification)
                    except (json.JSONDecodeError, KeyError) as e:
                        logger.error(f"Failed to parse notification {row['id']}: {e}")

                return notifications

        except Exception as e:
            logger.error(f"Failed to get notifications for {user_id}: {e}")
            return []

    @staticmethod
    def mark_as_read(notification_id: str, user_id: str = None) -> bool:
        """
        Mark a notification as read.

        Args:
            notification_id: Notification to mark read
            user_id: Optional, ensure user owns the notification

        Returns:
            True if successfully marked read
        """
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                query = "UPDATE notifications SET read_at = ? WHERE id = ?"
                params = [datetime.utcnow().isoformat(), notification_id]

                if user_id:
                    query += " AND user_id = ?"
                    params.append(user_id)

                cursor.execute(query, params)
                success = cursor.rowcount > 0
                conn.commit()

                if success:
                    logger.info(f"Marked notification {notification_id} as read")
                return success

        except Exception as e:
            logger.error(f"Failed to mark notification read: {e}")
            return False

    @staticmethod
    def get_unread_count(user_id: str) -> int:
        """Get count of unread notifications for user"""
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND read_at IS NULL",
                    (user_id,)
                )
                row = cursor.fetchone()
                return row['unread'] if row else 0

        except Exception as e:
            logger.error(f"Failed to get unread count for {user_id}: {e}")
            return 0

    @staticmethod
    def mark_all_read(user_id: str) -> int:
        """
        Mark all notifications as read for a user.

        Returns:
            Number of notifications marked read
        """
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE notifications SET read_at = ?
                    WHERE user_id = ? AND read_at IS NULL
                """, (datetime.utcnow().isoformat(), user_id))

                updated_count = cursor.rowcount
                conn.commit()

                logger.info(f"Marked {updated_count} notifications as read for user {user_id}")
                return updated_count

        except Exception as e:
            logger.error(f"Failed to mark all notifications read for {user_id}: {e}")
            return 0

    @staticmethod
    def cleanup_old_notifications(days_old: int = 30) -> int:
        """
        Delete notifications older than specified days.

        Returns:
            Number of notifications deleted
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)

            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "DELETE FROM notifications WHERE created_at < ? AND read_at IS NOT NULL",
                    (cutoff_date.isoformat(),)
                )
                deleted_count = cursor.rowcount
                conn.commit()

                logger.info(f"Cleaned up {deleted_count} old notifications")
                return deleted_count

        except Exception as e:
            logger.error(f"Failed to cleanup old notifications: {e}")
            return 0
