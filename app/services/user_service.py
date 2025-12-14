"""
User Service - Phase 2 Batch 9

Extracted from DatabaseService to handle user management operations:
- User creation with developer role detection
- User lookup by email or ID
- Password hash retrieval for authentication
- User profile updates

This service provides a cohesive interface for all user-related database operations.
"""

from typing import Optional, Dict, Any
from datetime import datetime
import uuid

from app.models.user import User, UserCreate, UserRole
from app.services.database import DatabaseService


class UserService:
    """
    Manages all user-related database operations.

    Handles:
    - User registration and creation
    - User lookups (by email or ID)
    - Password hash management for authentication
    - User profile updates

    Depends on: DatabaseService for connection management and row conversion
    """

    def __init__(self, db_service: DatabaseService):
        """
        Initialize UserService with database service dependency.

        Args:
            db_service: DatabaseService instance for database access
        """
        self.db_service = db_service

    async def create_user(self, user_data: UserCreate, password_hash: str) -> User:
        """
        Create a new user in the database.

        Automatically detects developer role based on developer_code.
        Developer code: "DIETINTEL_DEV_2024" grants DEVELOPER role.

        Args:
            user_data: UserCreate model with email, password, full_name, developer_code
            password_hash: Pre-hashed password (from bcrypt)

        Returns:
            User: Created user object with all fields populated

        Raises:
            sqlite3.IntegrityError: If email already exists (UNIQUE constraint)
        """
        user_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        # Check for developer code
        is_developer = user_data.developer_code == "DIETINTEL_DEV_2024"
        role = UserRole.DEVELOPER if is_developer else UserRole.STANDARD

        with self.db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO users (id, email, password_hash, full_name, is_developer, role, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, user_data.email, password_hash, user_data.full_name, is_developer, role.value, now, now))
            conn.commit()

        return await self.get_user_by_id(user_id)

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """
        Retrieve a user by email address.

        Args:
            email: User's email address

        Returns:
            User: User object if found, None otherwise
        """
        with self.db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()

            if row:
                return self._row_to_user(row)
            return None

    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """
        Retrieve a user by ID.

        Args:
            user_id: User's unique identifier (UUID)

        Returns:
            User: User object if found, None otherwise
        """
        with self.db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()

            if row:
                return self._row_to_user(row)
            return None

    async def get_password_hash(self, user_id: str) -> Optional[str]:
        """
        Retrieve the password hash for a user.

        Used during authentication to verify passwords via bcrypt.compare().

        Args:
            user_id: User's unique identifier

        Returns:
            str: Bcrypt password hash if user exists, None otherwise
        """
        with self.db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()

            if row:
                return row['password_hash']
            return None

    async def update_user(self, user_id: str, updates: Dict[str, Any]) -> Optional[User]:
        """
        Update user profile information.

        Dynamically builds UPDATE query from provided fields.
        Automatically updates 'updated_at' timestamp.

        Args:
            user_id: User's unique identifier
            updates: Dictionary of fields to update (e.g., {'full_name': 'New Name'})

        Returns:
            User: Updated user object if successful, None if user doesn't exist

        Note:
            Password updates should use separate password update flow (not implemented here)
        """
        if not updates:
            return await self.get_user_by_id(user_id)

        updates['updated_at'] = datetime.utcnow().isoformat()

        # Build dynamic update query
        set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values()) + [user_id]

        with self.db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
            conn.commit()

        return await self.get_user_by_id(user_id)

    def _row_to_user(self, row) -> User:
        """
        Convert a database row to a User model instance.

        Handles type conversions:
        - Boolean fields: is_developer, is_active, email_verified
        - Enum field: role (UserRole)
        - Datetime fields: created_at, updated_at

        Args:
            row: Database row (dict-like object from cursor)

        Returns:
            User: Fully populated User model
        """
        return User(
            id=row['id'],
            email=row['email'],
            full_name=row['full_name'],
            avatar_url=row['avatar_url'],
            is_developer=bool(row['is_developer']),
            role=UserRole(row['role']),
            is_active=bool(row['is_active']),
            email_verified=bool(row['email_verified']),
            created_at=datetime.fromisoformat(row['created_at']),
            updated_at=datetime.fromisoformat(row['updated_at'])
        )
