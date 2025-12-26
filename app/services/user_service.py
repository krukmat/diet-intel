"""
User Service - Phase 2 Batch 9 + Phase 3 (Repository Pattern)

Extracted from DatabaseService to handle user management operations:
- User creation with developer role detection
- User lookup by email or ID
- Password hash retrieval for authentication
- User profile updates

This service now uses UserRepository for all database operations instead of DatabaseService,
following the Repository Pattern for better separation of concerns.
"""

from typing import Optional, Dict, Any
from datetime import datetime

from app.models.user import User, UserCreate, UserRole
from app.repositories.user_repository import UserRepository


class UserService:
    """
    Manages all user-related database operations using Repository Pattern.

    Handles:
    - User registration and creation
    - User lookups (by email or ID)
    - Password hash management for authentication
    - User profile updates

    Depends on: UserRepository for data access (Phase 3 refactoring)
    """

    def __init__(self, user_repo: UserRepository):
        """
        Initialize UserService with repository dependency.

        Args:
            user_repo: UserRepository instance for user data access
        """
        self.user_repo = user_repo

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
        # Repository handles user creation with developer code detection
        user = await self.user_repo.create(user_data, password_hash)
        return user

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """
        Retrieve a user by email address.

        Args:
            email: User's email address

        Returns:
            User: User object if found, None otherwise
        """
        return await self.user_repo.get_by_email(email)

    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """
        Retrieve a user by ID.

        Args:
            user_id: User's unique identifier (UUID)

        Returns:
            User: User object if found, None otherwise
        """
        return await self.user_repo.get_by_id(user_id)

    async def get_password_hash(self, user_id: str) -> Optional[str]:
        """
        Retrieve the password hash for a user.

        Used during authentication to verify passwords via bcrypt.compare().

        Args:
            user_id: User's unique identifier

        Returns:
            str: Bcrypt password hash if user exists, None otherwise
        """
        return await self.user_repo.get_password_hash(user_id)

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

        return await self.user_repo.update(user_id, updates)
