"""
User Repository for CRUD operations
Replaces user-related functions from database.py
Handles user authentication and profile management with password hashing support
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.repositories.base import Repository
from app.repositories.connection import connection_manager
from app.models.user import User, UserCreate, UserRole

logger = logging.getLogger(__name__)


class UserRepository(Repository[User]):
    """Repository for User entity with password hash support"""

    def __init__(self):
        """Initialize UserRepository (uses connection_manager, not db_path)"""
        self.logger = logging.getLogger(self.__class__.__name__)

    def get_table_name(self) -> str:
        """Return table name"""
        return "users"

    def row_to_entity(self, row: Dict[str, Any]) -> User:
        """Convert database row to User model"""
        return User(
            id=row["id"],
            email=row["email"],
            full_name=row["full_name"],
            avatar_url=row.get("avatar_url"),
            is_developer=bool(row.get("is_developer", False)),
            role=UserRole(row.get("role", "standard")) if isinstance(row.get("role"), str) else UserRole.STANDARD,
            is_active=bool(row.get("is_active", True)),
            email_verified=bool(row.get("email_verified", False)),
            created_at=datetime.fromisoformat(row["created_at"]) if isinstance(row.get("created_at"), str) else row.get("created_at"),
            updated_at=datetime.fromisoformat(row["updated_at"]) if isinstance(row.get("updated_at"), str) else row.get("updated_at")
        )

    def entity_to_dict(self, entity: User) -> Dict[str, Any]:
        """Convert User to dict for database"""
        return {
            "email": entity.email,
            "full_name": entity.full_name,
            "avatar_url": entity.avatar_url or "",
            "is_developer": int(entity.is_developer),
            "role": entity.role.value if isinstance(entity.role, UserRole) else entity.role,
            "is_active": int(entity.is_active),
            "email_verified": int(entity.email_verified),
            "created_at": entity.created_at.isoformat() if isinstance(entity.created_at, datetime) else entity.created_at,
            "updated_at": entity.updated_at.isoformat() if isinstance(entity.updated_at, datetime) else entity.updated_at
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
        """Create new user with password hash"""
        import uuid
        user_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()

        # Check for developer code
        is_developer = getattr(user_data, 'developer_code', None) == "DIETINTEL_DEV_2024"
        role = UserRole.DEVELOPER if is_developer else UserRole.STANDARD

        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO users (id, email, password_hash, full_name, avatar_url,
                                   is_developer, role, is_active, email_verified, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    user_data.email,
                    hashed_password,
                    getattr(user_data, 'full_name', ''),
                    None,  # avatar_url
                    int(is_developer),
                    role.value,
                    1,  # is_active
                    0,  # email_verified
                    now,
                    now
                )
            )
            conn.commit()
            user = await self.get_by_id(user_id)
            self.logger.info(f"User created: {user_id}")
            return user

    async def get_password_hash(self, user_id: str) -> Optional[str]:
        """Get password hash for authentication"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT password_hash FROM users WHERE id = ?",
                (user_id,)
            )
            row = cursor.fetchone()
            return row["password_hash"] if row else None

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
