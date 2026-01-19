from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr, validator
from enum import Enum


class UserRole(str, Enum):
    STANDARD = "standard"
    PREMIUM = "premium"
    DEVELOPER = "developer"


class User(BaseModel):
    """User model for authentication and profile management"""
    id: Optional[str] = Field(None, description="User unique identifier")
    email: str = Field(..., description="User email address")
    full_name: str = Field(..., min_length=2, max_length=2048, description="User full name")
    avatar_url: Optional[str] = Field(None, description="User avatar image URL")
    is_developer: bool = Field(default=False, description="Developer access flag")
    role: UserRole = Field(default=UserRole.STANDARD, description="User role")
    is_active: bool = Field(default=True, description="User account status")
    email_verified: bool = Field(default=False, description="Email verification status")
    created_at: Optional[datetime] = Field(None, description="Account creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    @validator('email')
    def validate_email(cls, value: str) -> str:
        if not isinstance(value, str):
            raise TypeError('Email must be a string')
        if '@' not in value or value.count('@') != 1:
            raise ValueError('Invalid email address')
        local_part, domain = value.split('@')
        if not local_part or '.' not in domain:
            raise ValueError('Invalid email address')
        return value


class UserCreate(BaseModel):
    """User creation request model"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, max_length=128, description="User password")
    full_name: str = Field(..., min_length=2, max_length=100, description="User full name")
    developer_code: Optional[str] = Field(None, description="Optional developer access code")


class UserLogin(BaseModel):
    """User login request model"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class UserUpdate(BaseModel):
    """User profile update model"""
    full_name: Optional[str] = Field(None, min_length=2, max_length=100, description="User full name")
    avatar_url: Optional[str] = Field(None, description="User avatar image URL")


class ChangePassword(BaseModel):
    """Password change request model"""
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, max_length=128, description="New password")


class UserResponse(BaseModel):
    """User response model (excludes sensitive data)"""
    id: str = Field(..., description="User unique identifier")
    email: str = Field(..., description="User email address")
    full_name: str = Field(..., description="User full name")
    avatar_url: Optional[str] = Field(None, description="User avatar image URL")
    is_developer: bool = Field(..., description="Developer access flag")
    role: UserRole = Field(..., description="User role")
    is_active: bool = Field(..., description="User account status")
    email_verified: bool = Field(..., description="Email verification status")
    created_at: datetime = Field(..., description="Account creation timestamp")


class Token(BaseModel):
    """JWT token response model"""
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration in seconds")
    user: UserResponse = Field(..., description="Authenticated user")


class TokenData(BaseModel):
    """Token payload data model"""
    user_id: Optional[str] = Field(None, description="User ID from token")
    email: str = Field(..., description="User email from token")
    role: UserRole = Field(..., description="User role from token")
    is_developer: bool = Field(..., description="Developer flag from token")


class RefreshToken(BaseModel):
    """Refresh token request model"""
    refresh_token: str = Field(..., description="Refresh token to exchange")


class UserSession(BaseModel):
    """User session model"""
    id: Optional[str] = Field(None, description="Session unique identifier")
    user_id: str = Field(..., description="User ID")
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    expires_at: datetime = Field(..., description="Token expiration timestamp")
    device_info: Optional[str] = Field(None, description="Device information")
    created_at: Optional[datetime] = Field(None, description="Session creation timestamp")
