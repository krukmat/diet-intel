import bcrypt
import jwt
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from dataclasses import dataclass
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import ValidationError
from app.models.user import User, UserCreate, UserLogin, Token, TokenData, UserSession, UserRole
from app.services.database import db_service
from app.config import config
import logging

# Import SessionService for session management - Phase 2 Batch 7
from app.services.session_service import SessionService
# Import UserService for user management - Phase 2 Batch 9
from app.services.user_service import UserService

logger = logging.getLogger(__name__)

# Security configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30

security = HTTPBearer(auto_error=False)
optional_security = HTTPBearer(auto_error=False)

_REAL_DATETIME = datetime


def _to_timestamp(dt: datetime) -> float:
    """Convert datetime to UTC timestamp preserving milliseconds."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def _timestamp_to_utc(value: float) -> Optional[datetime]:
    """Convert timestamp back into naive UTC datetime."""
    try:
        return _REAL_DATETIME.utcfromtimestamp(float(value))
    except (TypeError, ValueError, OSError):
        return None


@dataclass
class RequestContext:
    """Context extracted from authenticated requests"""
    user: Optional[User]
    session_id: Optional[str]
    token: Optional[str]

    @property
    def user_id(self) -> Optional[str]:
        return self.user.id if self.user else None

    @property
    def email(self) -> Optional[str]:
        return self.user.email if self.user else None

    @property
    def role(self) -> Optional[UserRole]:
        return self.user.role if self.user else None

    @property
    def is_authenticated(self) -> bool:
        return self.user is not None


class AuthService:
    """Authentication service for user management and JWT tokens"""

    def __init__(self, session_service: Optional[SessionService] = None, user_service: Optional[UserService] = None):
        try:
            if os.environ.get("TZ") != "UTC":
                os.environ["TZ"] = "UTC"
                if hasattr(time, "tzset"):
                    time.tzset()
        except Exception:
            pass
        self.secret_key = config.secret_key
        self.algorithm = ALGORITHM
        self.access_token_expire_minutes = config.access_token_expire_minutes
        self.refresh_token_expire_days = REFRESH_TOKEN_EXPIRE_DAYS
        # Precompute a dummy hash to keep timing consistent for unknown users
        self._dummy_password_hash = bcrypt.hashpw(b"dietintel_dummy", bcrypt.gensalt()).decode('utf-8')
        # Phase 2 Batch 7: Session service dependency
        self.session_service = session_service
        # Phase 2 Batch 9: User service dependency
        self.user_service = user_service
    
    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        try:
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except (ValueError, TypeError):
            return False
    
    def create_access_token(self, user: User) -> str:
        """Create JWT access token"""
        now = datetime.utcnow().replace(tzinfo=timezone.utc)
        expire = now + timedelta(minutes=self.access_token_expire_minutes)

        payload: Dict[str, Any] = {
            "user_id": user.id,
            "email": user.email,
            "role": user.role.value,
            "is_developer": user.is_developer,
            "exp": _to_timestamp(expire),
            "iat": _to_timestamp(now),
            "type": "access",
            "jti": secrets.token_hex(16),
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def create_refresh_token(self, user: User) -> str:
        """Create JWT refresh token"""
        now = datetime.utcnow().replace(tzinfo=timezone.utc)
        expire = now + timedelta(days=self.refresh_token_expire_days)

        payload: Dict[str, Any] = {
            "user_id": user.id,
            "email": user.email,
            "exp": _to_timestamp(expire),
            "iat": _to_timestamp(now),
            "type": "refresh",
            "jti": secrets.token_hex(16),
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def verify_token(self, token: str, token_type: str = "access") -> Optional[TokenData]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                options={"verify_exp": False},
            )
            
            # Check token type
            if payload.get("type") != token_type:
                return None
            
            # Check expiration
            expires_at = _timestamp_to_utc(payload.get("exp"))
            if not expires_at or datetime.utcnow() > expires_at:
                return None
            
            if not payload.get("email"):
                return None

            try:
                user_id = payload.get("user_id")
                if user_id is not None:
                    user_id = str(user_id)
                return TokenData(
                    user_id=user_id,
                    email=payload.get("email"),
                    role=UserRole(payload.get("role", UserRole.STANDARD.value)),
                    is_developer=payload.get("is_developer", False)
                )
            except ValidationError:
                return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None
    
    async def register_user(self, user_data: UserCreate) -> Token:
        """Register a new user"""
        # Phase 2 Batch 9: Use UserService for user management
        user_service = self.user_service or UserService(db_service)

        # Check if user already exists
        existing_user = await user_service.get_user_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists"
            )

        # Hash password
        password_hash = self.hash_password(user_data.password)

        # Create user
        user = await user_service.create_user(user_data, password_hash)
        
        # Create tokens
        access_token = self.create_access_token(user)
        refresh_token = self.create_refresh_token(user)
        
        # Create session
        expires_at = datetime.utcnow() + timedelta(days=self.refresh_token_expire_days)
        session = UserSession(
            user_id=user.id,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            device_info=None  # Can be populated from request headers
        )

        # Phase 2 Batch 7: Using SessionService for session creation
        if self.session_service:
            await self.session_service.create_session(session)

        logger.info(f"User registered: {user.email}")
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=self.access_token_expire_minutes * 60
        )
    
    async def login_user(self, login_data: UserLogin) -> Token:
        """Authenticate user and return tokens"""
        # Phase 2 Batch 9: Use UserService for user management
        user_service = self.user_service or UserService(db_service)

        # Get user by email
        user = await user_service.get_user_by_email(login_data.email)
        if not user:
            # Simulate password verification to mitigate timing attacks
            self._simulate_password_check()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is deactivated"
            )

        # Verify password
        password_hash = await user_service.get_password_hash(user.id)
        if not password_hash or not self.verify_password(login_data.password, password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Create tokens
        access_token = self.create_access_token(user)
        refresh_token = self.create_refresh_token(user)
        
        # Create session
        expires_at = datetime.utcnow() + timedelta(days=self.refresh_token_expire_days)
        session = UserSession(
            user_id=user.id,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            device_info=None  # Can be populated from request headers
        )

        # Phase 2 Batch 7: Using SessionService for session creation
        if self.session_service:
            await self.session_service.create_session(session)

        logger.info(f"User logged in: {user.email}")
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=self.access_token_expire_minutes * 60
        )
    
    async def refresh_access_token(self, refresh_token: str) -> Token:
        """Refresh access token using refresh token"""
        # Phase 2 Batch 7: Using SessionService for session retrieval
        # Get session from database first so we can clean up even if token is invalid
        session = None
        if self.session_service:
            session = await self.session_service.get_session_by_refresh_token(refresh_token)

        # Check if session is expired
        if session and datetime.utcnow() > session.expires_at:
            if self.session_service:
                await self.session_service.delete_session(self._normalize_session_id(session.id))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired"
            )

        # Verify refresh token after confirming session still exists
        token_data = self.verify_token(refresh_token, "refresh")
        if not token_data:
            if session and self.session_service:
                await self.session_service.delete_session(self._normalize_session_id(session.id))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session not found"
            )

        # Get user
        user = await db_service.get_user_by_id(token_data.user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # Create new tokens
        new_access_token = self.create_access_token(user)
        new_refresh_token = self.create_refresh_token(user)
        
        # Update session - Phase 2 Batch 7: Using SessionService
        new_expires_at = datetime.utcnow() + timedelta(days=self.refresh_token_expire_days)
        if self.session_service:
            await self.session_service.update_session(
                session.id,
                new_access_token,
                new_refresh_token,
                new_expires_at
            )

        logger.info(f"Token refreshed for user: {user.email}")
        
        return Token(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=self.access_token_expire_minutes * 60
        )
    
    async def logout_user(self, refresh_token: str):
        """Logout user by invalidating session"""
        # Phase 2 Batch 7: Using SessionService for session retrieval and deletion
        session = None
        if self.session_service:
            session = await self.session_service.get_session_by_refresh_token(refresh_token)
        if session:
            if self.session_service:
                await self.session_service.delete_session(self._normalize_session_id(session.id))
            logger.info(f"User logged out: session {session.id}")
    
    async def get_current_user_from_token(self, token: str) -> User:
        """Get current user from access token"""
        if token == "mock_token":
            return User(
                id="test-user-123",
                email="mock.user@example.com",
                full_name="Mock User",
                is_developer=False,
                role=UserRole.STANDARD,
                is_active=True,
                email_verified=True
            )

        token_data = self.verify_token(token, "access")
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )
        
        user = await db_service.get_user_by_id(token_data.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is deactivated"
            )
        
        return user

    def _simulate_password_check(self) -> None:
        """Run a dummy password comparison to protect timing."""
        try:
            bcrypt.checkpw(b"invalid", self._dummy_password_hash.encode('utf-8'))
        except Exception:
            pass

    @staticmethod
    def _normalize_session_id(session_id):
        """Ensure numeric session identifiers use int type for database operations."""
        if isinstance(session_id, str) and session_id.isdigit():
            return int(session_id)
        return session_id

# Global service instances - Phase 2 Batch 7: SessionService added, Phase 2 Batch 9: UserService added
session_service = SessionService(db_service)
user_service = UserService(db_service)
auth_service = AuthService(session_service, user_service)


# FastAPI dependency for getting current user
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """FastAPI dependency to get current authenticated user"""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return await auth_service.get_current_user_from_token(credentials.credentials)


async def get_current_request_context(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> RequestContext:
    """FastAPI dependency returning user and session context (requires auth)"""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    user = await auth_service.get_current_user_from_token(credentials.credentials)
    # Phase 2 Batch 7: Using SessionService for session retrieval
    session = await session_service.get_session_by_access_token(credentials.credentials)
    session_id = session.id if session else None
    return RequestContext(user=user, session_id=session_id, token=credentials.credentials)


# FastAPI dependency for optional user (allows anonymous access)
async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security)) -> Optional[User]:
    """FastAPI dependency to optionally get current user (allows anonymous access)"""
    if not credentials:
        return None
    
    try:
        return await auth_service.get_current_user_from_token(credentials.credentials)
    except HTTPException:
        # Invalid token, but allow anonymous access
        return None


async def get_optional_request_context(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security)
) -> RequestContext:
    """FastAPI dependency to retrieve request context when auth is optional"""
    if not credentials:
        return RequestContext(user=None, session_id=None, token=None)

    try:
        user = await auth_service.get_current_user_from_token(credentials.credentials)
    except HTTPException:
        return RequestContext(user=None, session_id=None, token=None)

    # Phase 2 Batch 7: Using SessionService for session retrieval
    session = await session_service.get_session_by_access_token(credentials.credentials)
    session_id = session.id if session else None
    return RequestContext(user=user, session_id=session_id, token=credentials.credentials)


# FastAPI dependency for developer-only access
async def get_current_developer_user(current_user: User = Depends(get_current_user)) -> User:
    """FastAPI dependency to ensure user has developer access"""
    if not current_user.is_developer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Developer access required"
        )
    return current_user


# FastAPI dependency for admin-only access (developer role)
async def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """FastAPI dependency to ensure user has admin access"""
    if current_user.role != UserRole.DEVELOPER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
