"""Session Service - Handles user session management.

Task: Phase 2 Batch 7 - Database refactoring (extracted from database.py)
Coverage Goal: 88%+ (target: 80%+)
"""

from typing import Optional
from datetime import datetime
import uuid
import logging
from app.services.database import DatabaseService
from app.models.user import UserSession


logger = logging.getLogger(__name__)


class SessionService:
    """Service for managing user sessions and authentication tokens.

    Handles:
    - Session creation with access/refresh tokens
    - Session retrieval by token type
    - Token refresh and rotation
    - Session deletion (logout, revocation)
    - Cleanup of expired sessions
    """

    def __init__(self, db_service: DatabaseService):
        """Initialize SessionService with database dependency.

        Args:
            db_service: DatabaseService instance for database operations

        Task: Phase 2 Batch 7 - Session Service Extraction
        """
        self.db = db_service

    async def create_session(self, session: UserSession) -> str:
        """Create a new user session with tokens.

        Args:
            session: UserSession object with user_id, tokens, expiration

        Returns:
            Created session ID (UUID)

        Coverage Goal: Test successful creation, UUID generation, token storage

        Task: Phase 2 Batch 7 - Session Service Extraction
        """
        session_id = str(uuid.uuid4())

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO user_sessions
                (id, user_id, access_token, refresh_token, expires_at, device_info)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
                (
                    session_id,
                    session.user_id,
                    session.access_token,
                    session.refresh_token,
                    session.expires_at.isoformat() if session.expires_at else None,
                    session.device_info,
                ),
            )
            conn.commit()

        logger.info(
            f"Created session {session_id} for user {session.user_id}"
        )
        return session_id

    async def get_session_by_refresh_token(
        self, refresh_token: str
    ) -> Optional[UserSession]:
        """Get session by refresh token.

        Args:
            refresh_token: The refresh token to look up

        Returns:
            UserSession object if found, None otherwise

        Coverage Goal: Test retrieval, datetime parsing, session reconstruction

        Task: Phase 2 Batch 7 - Session Service Extraction
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM user_sessions WHERE refresh_token = ?",
                (refresh_token,),
            )
            row = cursor.fetchone()

            if row:
                return self._row_to_session(row)

        return None

    async def get_session_by_access_token(
        self, access_token: str
    ) -> Optional[UserSession]:
        """Get session by access token.

        Args:
            access_token: The access token to look up

        Returns:
            UserSession object if found, None otherwise

        Coverage Goal: Test retrieval, access token matching, session data parsing

        Task: Phase 2 Batch 7 - Session Service Extraction
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM user_sessions WHERE access_token = ?",
                (access_token,),
            )
            row = cursor.fetchone()

            if row:
                return self._row_to_session(row)

        return None

    async def update_session(
        self,
        session_id: str,
        access_token: str,
        refresh_token: str,
        expires_at: datetime,
    ) -> bool:
        """Update session tokens and expiration (token refresh/rotation).

        Args:
            session_id: Session ID to update
            access_token: New access token
            refresh_token: New refresh token
            expires_at: New expiration datetime

        Returns:
            True if update successful, False otherwise

        Coverage Goal: Test token rotation, expiration update, database write

        Task: Phase 2 Batch 7 - Session Service Extraction
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    """
                    UPDATE user_sessions
                    SET access_token = ?, refresh_token = ?, expires_at = ?
                    WHERE id = ?
                """,
                    (
                        access_token,
                        refresh_token,
                        expires_at.isoformat() if expires_at else None,
                        session_id,
                    ),
                )
                conn.commit()

                logger.info(f"Updated tokens for session {session_id}")
                return True
            except Exception as e:
                logger.error(f"Failed to update session {session_id}: {e}")
                return False

    async def delete_session(self, session_id: str) -> bool:
        """Delete a session by ID (logout single session).

        Args:
            session_id: Session ID to delete

        Returns:
            True if deletion successful, False otherwise

        Coverage Goal: Test session deletion, single session logout

        Task: Phase 2 Batch 7 - Session Service Extraction
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute("DELETE FROM user_sessions WHERE id = ?", (session_id,))
                conn.commit()

                logger.info(f"Deleted session {session_id}")
                return True
            except Exception as e:
                logger.error(f"Failed to delete session {session_id}: {e}")
                return False

    async def delete_user_sessions(self, user_id: str) -> int:
        """Delete all sessions for a user (force logout from all devices).

        Args:
            user_id: User ID whose sessions to delete

        Returns:
            Number of sessions deleted

        Coverage Goal: Test user session cascade deletion, multi-device logout

        Task: Phase 2 Batch 7 - Session Service Extraction
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute("DELETE FROM user_sessions WHERE user_id = ?", (user_id,))
                conn.commit()

                deleted = cursor.rowcount
                if deleted > 0:
                    logger.info(f"Deleted {deleted} sessions for user {user_id}")

                return deleted
            except Exception as e:
                logger.error(f"Failed to delete sessions for user {user_id}: {e}")
                return 0

    async def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions (housekeeping task).

        Returns:
            Number of sessions deleted

        Coverage Goal: Test expiration detection, bulk cleanup, timestamp comparison

        Task: Phase 2 Batch 7 - Session Service Extraction
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                now = datetime.utcnow().isoformat()
                cursor.execute(
                    "DELETE FROM user_sessions WHERE expires_at < ?", (now,)
                )
                conn.commit()

                deleted = cursor.rowcount
                if deleted > 0:
                    logger.info(f"Cleaned up {deleted} expired sessions")

                return deleted
            except Exception as e:
                logger.error(f"Failed to cleanup expired sessions: {e}")
                return 0

    def _row_to_session(self, row) -> UserSession:
        """Convert database row to UserSession object.

        Args:
            row: sqlite3.Row from user_sessions table

        Returns:
            UserSession object

        Task: Phase 2 Batch 7 - Session Service Extraction
        """
        expires_at = None
        if row["expires_at"]:
            try:
                expires_at = datetime.fromisoformat(row["expires_at"])
            except (ValueError, TypeError):
                logger.warning(f"Invalid expires_at format for session {row['id']}")

        # Handle device_info which might not be in all row types
        device_info = None
        try:
            device_info = row["device_info"]
        except (IndexError, KeyError):
            pass

        return UserSession(
            user_id=row["user_id"],
            access_token=row["access_token"],
            refresh_token=row["refresh_token"],
            expires_at=expires_at,
            device_info=device_info,
        )
