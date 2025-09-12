import bcrypt
import jwt
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.user import User, UserCreate, UserLogin, Token, TokenData, UserSession, UserRole
from app.services.database import db_service
from app.config import config
import logging

logger = logging.getLogger(__name__)

# Security configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30

security = HTTPBearer()


class AuthService:
    """Authentication service for user management and JWT tokens"""
    
    def __init__(self):
        self.secret_key = config.secret_key
        self.algorithm = ALGORITHM
        self.access_token_expire_minutes = config.access_token_expire_minutes
        self.refresh_token_expire_days = REFRESH_TOKEN_EXPIRE_DAYS
    
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
        now_timestamp = time.time()
        expire_timestamp = now_timestamp + (self.access_token_expire_minutes * 60)
        
        payload = {
            "user_id": user.id,
            "email": user.email,
            "role": user.role.value,
            "is_developer": user.is_developer,
            "exp": expire_timestamp,
            "iat": now_timestamp,
            "type": "access"
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def create_refresh_token(self, user: User) -> str:
        """Create JWT refresh token"""
        now_timestamp = time.time()
        expire_timestamp = now_timestamp + (self.refresh_token_expire_days * 24 * 60 * 60)
        
        payload = {
            "user_id": user.id,
            "email": user.email,
            "exp": expire_timestamp,
            "iat": now_timestamp,
            "type": "refresh"
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def verify_token(self, token: str, token_type: str = "access") -> Optional[TokenData]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            # Check token type
            if payload.get("type") != token_type:
                return None
            
            # Check expiration
            if datetime.utcnow().timestamp() > payload.get("exp", 0):
                return None
            
            return TokenData(
                user_id=payload.get("user_id"),
                email=payload.get("email"),
                role=UserRole(payload.get("role", UserRole.STANDARD.value)),
                is_developer=payload.get("is_developer", False)
            )
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None
    
    async def register_user(self, user_data: UserCreate) -> Token:
        """Register a new user"""
        # Check if user already exists
        existing_user = await db_service.get_user_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists"
            )
        
        # Hash password
        password_hash = self.hash_password(user_data.password)
        
        # Create user
        user = await db_service.create_user(user_data, password_hash)
        
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
        
        await db_service.create_session(session)
        
        logger.info(f"User registered: {user.email}")
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=self.access_token_expire_minutes * 60
        )
    
    async def login_user(self, login_data: UserLogin) -> Token:
        """Authenticate user and return tokens"""
        # Get user by email
        user = await db_service.get_user_by_email(login_data.email)
        if not user:
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
        password_hash = await db_service.get_password_hash(user.id)
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
        
        await db_service.create_session(session)
        
        logger.info(f"User logged in: {user.email}")
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=self.access_token_expire_minutes * 60
        )
    
    async def refresh_access_token(self, refresh_token: str) -> Token:
        """Refresh access token using refresh token"""
        # Verify refresh token
        token_data = self.verify_token(refresh_token, "refresh")
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Get session from database
        session = await db_service.get_session_by_refresh_token(refresh_token)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session not found"
            )
        
        # Check if session is expired
        if datetime.utcnow() > session.expires_at:
            await db_service.delete_session(session.id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired"
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
        
        # Update session
        new_expires_at = datetime.utcnow() + timedelta(days=self.refresh_token_expire_days)
        await db_service.update_session(session.id, new_access_token, new_refresh_token, new_expires_at)
        
        logger.info(f"Token refreshed for user: {user.email}")
        
        return Token(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=self.access_token_expire_minutes * 60
        )
    
    async def logout_user(self, refresh_token: str):
        """Logout user by invalidating session"""
        session = await db_service.get_session_by_refresh_token(refresh_token)
        if session:
            await db_service.delete_session(session.id)
            logger.info(f"User logged out: session {session.id}")
    
    async def get_current_user_from_token(self, token: str) -> User:
        """Get current user from access token"""
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


# Global auth service instance
auth_service = AuthService()


# FastAPI dependency for getting current user
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """FastAPI dependency to get current authenticated user"""
    return await auth_service.get_current_user_from_token(credentials.credentials)


# FastAPI dependency for optional user (allows anonymous access)
async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))) -> Optional[User]:
    """FastAPI dependency to optionally get current user (allows anonymous access)"""
    if not credentials:
        return None
    
    try:
        return await auth_service.get_current_user_from_token(credentials.credentials)
    except HTTPException:
        # Invalid token, but allow anonymous access
        return None


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