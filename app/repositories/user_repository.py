"""
User Repository for CRUD operations
Replaces user-related functions from database.py
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.repositories.base import Repository
from app.repositories.connection import connection_manager
from app.models.user import User, UserCreate

logger = logging.getLogger(__name__)


class UserRepository(Repository[User]):
    """Repository for User entity"""

    def get_table_name(self) -> str:
        """Return table name"""
        return "users"

    def row_to_entity(self, row: Dict[str, Any]) -> User:
        """Convert database row to User model"""
        return User(
            id=row["id"],
            email=row["email"],
            hashed_password=row["hashed_password"],
            is_active=bool(row["is_active"]),
            created_at=row.get("created_at"),
            role=row.get("role", "user")
        )

    def entity_to_dict(self, entity: User) -> Dict[str, Any]:
        """Convert User to dict for database"""
        return {
            "email": entity.email,
            "hashed_password": entity.hashed_password,
            "is_active": int(entity.is_active),
            "created_at": entity.created_at or datetime.utcnow().isoformat(),
            "role": entity.role
        }

    async def get_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM users WHERE id = ?",
                (user_id,)
            )
            row = cursor.fetchone()
            return self.row_to_entity(dict(row)) if row else None

    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM users WHERE email = ?",
                (email,)
            )
            row = cursor.fetchone()
            return self.row_to_entity(dict(row)) if row else None

    async def create(self, user_data: UserCreate, hashed_password: str) -> User:
        """Create new user"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO users (email, hashed_password, is_active, created_at, role)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    user_data.email,
                    hashed_password,
                    1,
                    datetime.utcnow().isoformat(),
                    "user"
                )
            )
            user_id = cursor.lastrowid
            user = await self.get_by_id(user_id)
            self.logger.info(f"User created: {user_id}")
            return user

    async def update(self, user_id: int, updates: Dict[str, Any]) -> Optional[User]:
        """Update user fields"""
        if not updates:
            return await self.get_by_id(user_id)

        # Build dynamic UPDATE query
        set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
        values = list(updates.values()) + [user_id]

        async with connection_manager.get_connection() as conn:
            conn.execute(
                f"UPDATE users SET {set_clause} WHERE id = ?",
                values
            )
            self.logger.info(f"User updated: {user_id}")

        return await self.get_by_id(user_id)

    async def delete(self, user_id: int) -> bool:
        """Soft delete user (set is_active = 0)"""
        result = await self.update(user_id, {"is_active": 0})
        self.logger.info(f"User deleted (soft): {user_id}")
        return result is not None

    async def get_all(self, limit: int = 100, offset: int = 0) -> List[User]:
        """Get all active users with pagination"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM users WHERE is_active = 1 LIMIT ? OFFSET ?",
                (limit, offset)
            )
            rows = cursor.fetchall()
            return [self.row_to_entity(dict(row)) for row in rows]

    async def count(self) -> int:
        """Count active users"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM users WHERE is_active = 1")
            return cursor.fetchone()[0]
