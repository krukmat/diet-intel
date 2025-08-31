import sqlite3
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
from app.models.user import User, UserCreate, UserSession, UserRole
from app.config import config
import logging

logger = logging.getLogger(__name__)


class DatabaseService:
    """SQLite database service for user management"""
    
    def __init__(self, db_path: str = "dietintel.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database with required tables"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    avatar_url TEXT,
                    is_developer BOOLEAN DEFAULT FALSE,
                    role TEXT DEFAULT 'standard',
                    is_active BOOLEAN DEFAULT TRUE,
                    email_verified BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # User sessions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    device_info TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            """)
            
            # Index for better performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON user_sessions(refresh_token)")
            
            conn.commit()
            logger.info("Database initialized successfully")
    
    @contextmanager
    def get_connection(self):
        """Get database connection with automatic cleanup"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable column access by name
        try:
            yield conn
        finally:
            conn.close()
    
    async def create_user(self, user_data: UserCreate, password_hash: str) -> User:
        """Create a new user in the database"""
        user_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        # Check for developer code
        is_developer = user_data.developer_code == "DIETINTEL_DEV_2024"
        role = UserRole.DEVELOPER if is_developer else UserRole.STANDARD
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO users (id, email, password_hash, full_name, is_developer, role, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, user_data.email, password_hash, user_data.full_name, is_developer, role.value, now, now))
            conn.commit()
        
        return await self.get_user_by_id(user_id)
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email address"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()
            
            if row:
                return self._row_to_user(row)
            return None
    
    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            
            if row:
                return self._row_to_user(row)
            return None
    
    async def get_password_hash(self, user_id: str) -> Optional[str]:
        """Get password hash for user"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            
            if row:
                return row['password_hash']
            return None
    
    async def update_user(self, user_id: str, updates: Dict[str, Any]) -> Optional[User]:
        """Update user information"""
        if not updates:
            return await self.get_user_by_id(user_id)
        
        updates['updated_at'] = datetime.utcnow().isoformat()
        
        # Build dynamic update query
        set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values()) + [user_id]
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
            conn.commit()
        
        return await self.get_user_by_id(user_id)
    
    async def create_session(self, session: UserSession) -> str:
        """Create a new user session"""
        session_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO user_sessions (id, user_id, access_token, refresh_token, expires_at, device_info, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (session_id, session.user_id, session.access_token, session.refresh_token, 
                  session.expires_at.isoformat(), session.device_info, now))
            conn.commit()
        
        return session_id
    
    async def get_session_by_refresh_token(self, refresh_token: str) -> Optional[UserSession]:
        """Get session by refresh token"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM user_sessions WHERE refresh_token = ?", (refresh_token,))
            row = cursor.fetchone()
            
            if row:
                return UserSession(
                    id=row['id'],
                    user_id=row['user_id'],
                    access_token=row['access_token'],
                    refresh_token=row['refresh_token'],
                    expires_at=datetime.fromisoformat(row['expires_at']),
                    device_info=row['device_info'],
                    created_at=datetime.fromisoformat(row['created_at'])
                )
            return None
    
    async def update_session(self, session_id: str, access_token: str, refresh_token: str, expires_at: datetime):
        """Update session tokens"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE user_sessions 
                SET access_token = ?, refresh_token = ?, expires_at = ?
                WHERE id = ?
            """, (access_token, refresh_token, expires_at.isoformat(), session_id))
            conn.commit()
    
    async def delete_session(self, session_id: str):
        """Delete a session"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_sessions WHERE id = ?", (session_id,))
            conn.commit()
    
    async def delete_user_sessions(self, user_id: str):
        """Delete all sessions for a user"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_sessions WHERE user_id = ?", (user_id,))
            conn.commit()
    
    async def cleanup_expired_sessions(self):
        """Remove expired sessions"""
        now = datetime.utcnow().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_sessions WHERE expires_at < ?", (now,))
            deleted = cursor.rowcount
            conn.commit()
            
        if deleted > 0:
            logger.info(f"Cleaned up {deleted} expired sessions")
    
    def _row_to_user(self, row) -> User:
        """Convert database row to User model"""
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


# Global database service instance
db_service = DatabaseService()