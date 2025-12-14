"""
Comprehensive Authentication Flow Tests

This test suite covers:
- User registration workflows
- Password hashing and verification
- User login processes  
- Token refresh mechanisms
- Session management
- Account security flows

Target: 30 lines coverage improvement
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException, status

from app.services.auth import AuthService, auth_service, session_service as auth_session_service, user_service
from app.models.user import User, UserCreate, UserLogin, UserRole, Token, UserSession
from app.services.database import db_service
from app.services.session_service import SessionService

# Phase 2 Batch 7: Use the global session_service instance from auth module
session_service = auth_session_service


class TestPasswordSecurity:
    """Test password hashing and verification functionality"""

    def setup_method(self):
        # Use global auth_service with SessionService dependency
        self.auth_service = auth_service
    
    def test_hash_password_creates_valid_hash(self):
        """Test password hashing creates valid bcrypt hash"""
        password = "test_password123"
        hashed = self.auth_service.hash_password(password)
        
        assert hashed is not None
        assert isinstance(hashed, str)
        assert len(hashed) > 0
        assert hashed != password  # Hash should be different from original
        assert hashed.startswith('$2b$')  # bcrypt format
    
    def test_hash_password_unique_salts(self):
        """Test that password hashing generates unique salts"""
        password = "same_password"
        
        hash1 = self.auth_service.hash_password(password)
        hash2 = self.auth_service.hash_password(password)
        
        assert hash1 != hash2  # Different salts should produce different hashes
    
    def test_verify_password_success(self):
        """Test successful password verification"""
        password = "test_password123"
        hashed = self.auth_service.hash_password(password)
        
        assert self.auth_service.verify_password(password, hashed) is True
    
    def test_verify_password_failure(self):
        """Test password verification fails with wrong password"""
        password = "correct_password"
        wrong_password = "wrong_password"
        hashed = self.auth_service.hash_password(password)
        
        assert self.auth_service.verify_password(wrong_password, hashed) is False
    
    def test_verify_password_empty_strings(self):
        """Test password verification handles empty strings"""
        assert self.auth_service.verify_password("", "") is False
        assert self.auth_service.verify_password("password", "") is False
        assert self.auth_service.verify_password("", "hashed") is False
    
    def test_verify_password_special_characters(self):
        """Test password verification with special characters"""
        special_password = "p@ssw0rd!#$%^&*()"
        hashed = self.auth_service.hash_password(special_password)
        
        assert self.auth_service.verify_password(special_password, hashed) is True
        assert self.auth_service.verify_password("different", hashed) is False


class TestUserRegistration:
    """Test user registration workflow"""
    
    def setup_method(self):
        # Use global auth_service with SessionService dependency
        self.auth_service = auth_service
        self.valid_user_data = UserCreate(
            email="test@example.com",
            password="password123",
            full_name="Test User"
        )
    
    @pytest.mark.asyncio
    async def test_register_user_success(self):
        """Test successful user registration"""
        # Mock database operations
        with patch.object(user_service, 'get_user_by_email', new_callable=AsyncMock, return_value=None), \
             patch.object(user_service, 'create_user', new_callable=AsyncMock) as mock_create_user, \
             patch.object(session_service, 'create_session', new_callable=AsyncMock) as mock_create_session:
            
            # Mock created user
            created_user = User(
                id="1",
                email=self.valid_user_data.email,
                full_name=self.valid_user_data.full_name,
                role=UserRole.STANDARD,
                is_developer=False,
                is_active=True,
                email_verified=False,
                created_at=datetime.utcnow()
            )
            mock_create_user.return_value = created_user
            
            # Execute registration
            result = await self.auth_service.register_user(self.valid_user_data)
            
            # Verify result
            assert isinstance(result, Token)
            assert result.access_token is not None
            assert result.refresh_token is not None
            assert result.token_type == "bearer"
            assert result.expires_in == 15 * 60  # 15 minutes in seconds
            
            # Verify database calls
            mock_create_user.assert_called_once()
            mock_create_session.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_register_user_duplicate_email(self):
        """Test registration fails with duplicate email"""
        existing_user = User(
            id="1",
            email=self.valid_user_data.email,
            full_name="Existing User",
            role=UserRole.STANDARD,
            is_developer=False,
            is_active=True,
            email_verified=True,
            created_at=datetime.utcnow()
        )
        
        with patch.object(user_service, 'get_user_by_email', new_callable=AsyncMock, return_value=existing_user):
            with pytest.raises(HTTPException) as exc_info:
                await self.auth_service.register_user(self.valid_user_data)
            
            assert exc_info.value.status_code == status.HTTP_409_CONFLICT
            assert "already exists" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_register_developer_user(self):
        """Test registration with developer code creates developer user"""
        dev_user_data = UserCreate(
            email="dev@example.com",
            password="password123",
            full_name="Developer User",
            developer_code="DIETINTEL_DEV_2024"
        )
        
        with patch.object(user_service, 'get_user_by_email', new_callable=AsyncMock, return_value=None), \
             patch.object(user_service, 'create_user', new_callable=AsyncMock) as mock_create_user, \
             patch.object(session_service, 'create_session', new_callable=AsyncMock):
            
            created_user = User(
                id="1",
                email=dev_user_data.email,
                full_name=dev_user_data.full_name,
                role=UserRole.DEVELOPER,
                is_developer=True,
                is_active=True,
                email_verified=False,
                created_at=datetime.utcnow()
            )
            mock_create_user.return_value = created_user
            
            result = await self.auth_service.register_user(dev_user_data)
            
            assert isinstance(result, Token)
            # Verify developer status in token
            import jwt
            payload = jwt.decode(result.access_token, self.auth_service.secret_key, algorithms=["HS256"])
            assert payload['is_developer'] is True
            assert payload['role'] == UserRole.DEVELOPER.value
    
    @pytest.mark.asyncio
    async def test_register_user_password_hashing(self):
        """Test that password is properly hashed during registration"""
        with patch.object(user_service, 'get_user_by_email', new_callable=AsyncMock, return_value=None), \
             patch.object(user_service, 'create_user', new_callable=AsyncMock) as mock_create_user, \
             patch.object(session_service, 'create_session', new_callable=AsyncMock):
            
            created_user = User(
                id="1", email=self.valid_user_data.email, full_name=self.valid_user_data.full_name,
                role=UserRole.STANDARD, is_developer=False, is_active=True,
                email_verified=False, created_at=datetime.utcnow()
            )
            mock_create_user.return_value = created_user
            
            await self.auth_service.register_user(self.valid_user_data)
            
            # Verify create_user was called with hashed password
            call_args = mock_create_user.call_args
            assert len(call_args[0]) == 2  # user_data and password_hash
            password_hash = call_args[0][1]
            
            # Verify it's a bcrypt hash
            assert password_hash.startswith('$2b$')
            assert password_hash != self.valid_user_data.password
            
            # Verify hash can verify the original password
            assert self.auth_service.verify_password(self.valid_user_data.password, password_hash)


class TestUserLogin:
    """Test user login workflow"""
    
    def setup_method(self):
        # Use global auth_service with SessionService dependency
        self.auth_service = auth_service
        self.login_data = UserLogin(
            email="test@example.com",
            password="password123"
        )
        self.test_user = User(
            id="1",
            email=self.login_data.email,
            full_name="Test User",
            role=UserRole.STANDARD,
            is_developer=False,
            is_active=True,
            email_verified=True,
            created_at=datetime.utcnow()
        )
    
    @pytest.mark.asyncio
    async def test_login_user_success(self):
        """Test successful user login"""
        password_hash = self.auth_service.hash_password(self.login_data.password)
        
        with patch.object(user_service, 'get_user_by_email', new_callable=AsyncMock, return_value=self.test_user), \
             patch.object(user_service, 'get_password_hash', new_callable=AsyncMock, return_value=password_hash), \
             patch.object(session_service, 'create_session', new_callable=AsyncMock):
            
            result = await self.auth_service.login_user(self.login_data)
            
            assert isinstance(result, Token)
            assert result.access_token is not None
            assert result.refresh_token is not None
            assert result.token_type == "bearer"
            assert result.expires_in == 15 * 60
    
    @pytest.mark.asyncio
    async def test_login_user_not_found(self):
        """Test login fails when user doesn't exist"""
        with patch.object(user_service, 'get_user_by_email', new_callable=AsyncMock, return_value=None):
            with pytest.raises(HTTPException) as exc_info:
                await self.auth_service.login_user(self.login_data)
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Invalid email or password" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_login_inactive_user(self):
        """Test login fails for inactive user"""
        inactive_user = User(
            id="1", email=self.login_data.email, full_name="Test User",
            role=UserRole.STANDARD, is_developer=False, is_active=False,
            email_verified=True, created_at=datetime.utcnow()
        )
        
        with patch.object(user_service, 'get_user_by_email', new_callable=AsyncMock, return_value=inactive_user):
            with pytest.raises(HTTPException) as exc_info:
                await self.auth_service.login_user(self.login_data)
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "deactivated" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_login_wrong_password(self):
        """Test login fails with wrong password"""
        wrong_password_hash = self.auth_service.hash_password("wrong_password")
        
        with patch.object(user_service, 'get_user_by_email', new_callable=AsyncMock, return_value=self.test_user), \
             patch.object(user_service, 'get_password_hash', new_callable=AsyncMock, return_value=wrong_password_hash):
            
            with pytest.raises(HTTPException) as exc_info:
                await self.auth_service.login_user(self.login_data)
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Invalid email or password" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_login_no_password_hash(self):
        """Test login fails when password hash is missing"""
        with patch.object(user_service, 'get_user_by_email', new_callable=AsyncMock, return_value=self.test_user), \
             patch.object(user_service, 'get_password_hash', new_callable=AsyncMock, return_value=None):
            
            with pytest.raises(HTTPException) as exc_info:
                await self.auth_service.login_user(self.login_data)
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Invalid email or password" in str(exc_info.value.detail)


class TestTokenRefresh:
    """Test token refresh workflow"""
    
    def setup_method(self):
        # Use global auth_service with SessionService dependency
        self.auth_service = auth_service
        self.test_user = User(
            id="1", email="test@example.com", full_name="Test User",
            role=UserRole.STANDARD, is_developer=False, is_active=True,
            email_verified=True, created_at=datetime.utcnow()
        )
    
    @pytest.mark.asyncio
    async def test_refresh_access_token_success(self):
        """Test successful token refresh"""
        refresh_token = self.auth_service.create_refresh_token(self.test_user)
        
        session = UserSession(
            id="1",
            user_id=self.test_user.id,
            access_token="old_access_token",
            refresh_token=refresh_token,
            expires_at=datetime.utcnow() + timedelta(days=30),
            device_info=None
        )
        
        with patch.object(session_service, 'get_session_by_refresh_token', new_callable=AsyncMock, return_value=session), \
             patch.object(user_service, 'get_user_by_id', new_callable=AsyncMock, return_value=self.test_user), \
             patch.object(session_service, 'update_session', new_callable=AsyncMock):
            
            result = await self.auth_service.refresh_access_token(refresh_token)
            
            assert isinstance(result, Token)
            assert result.access_token != "old_access_token"
            assert result.refresh_token != refresh_token
            assert result.token_type == "bearer"
    
    @pytest.mark.asyncio
    async def test_refresh_token_invalid(self):
        """Test token refresh fails with invalid refresh token"""
        invalid_token = "invalid.refresh.token"
        
        with pytest.raises(HTTPException) as exc_info:
            await self.auth_service.refresh_access_token(invalid_token)
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Invalid refresh token" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_refresh_token_session_not_found(self):
        """Test token refresh fails when session doesn't exist"""
        refresh_token = self.auth_service.create_refresh_token(self.test_user)
        
        with patch.object(session_service, 'get_session_by_refresh_token', new_callable=AsyncMock, return_value=None):
            with pytest.raises(HTTPException) as exc_info:
                await self.auth_service.refresh_access_token(refresh_token)
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Session not found" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_refresh_token_session_expired(self):
        """Test token refresh fails with expired session"""
        refresh_token = self.auth_service.create_refresh_token(self.test_user)
        
        expired_session = UserSession(
            id="1", user_id=self.test_user.id, access_token="token", refresh_token=refresh_token,
            expires_at=datetime.utcnow() - timedelta(days=1),  # Expired
            device_info=None
        )
        
        with patch.object(session_service, 'get_session_by_refresh_token', new_callable=AsyncMock, return_value=expired_session), \
             patch.object(session_service, 'delete_session', new_callable=AsyncMock) as mock_delete:
            
            with pytest.raises(HTTPException) as exc_info:
                await self.auth_service.refresh_access_token(refresh_token)
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Session expired" in str(exc_info.value.detail)
            mock_delete.assert_called_once_with(int(expired_session.id))
    
    @pytest.mark.asyncio
    async def test_refresh_token_inactive_user(self):
        """Test token refresh fails for inactive user"""
        refresh_token = self.auth_service.create_refresh_token(self.test_user)
        
        inactive_user = User(
            id="1", email="test@example.com", full_name="Test User",
            role=UserRole.STANDARD, is_developer=False, is_active=False,
            email_verified=True, created_at=datetime.utcnow()
        )
        
        session = UserSession(
            id="1", user_id=self.test_user.id, access_token="token", refresh_token=refresh_token,
            expires_at=datetime.utcnow() + timedelta(days=30), device_info=None
        )
        
        with patch.object(session_service, 'get_session_by_refresh_token', new_callable=AsyncMock, return_value=session), \
             patch.object(user_service, 'get_user_by_id', new_callable=AsyncMock, return_value=inactive_user):
            
            with pytest.raises(HTTPException) as exc_info:
                await self.auth_service.refresh_access_token(refresh_token)
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "not found or inactive" in str(exc_info.value.detail)


class TestLogoutFlow:
    """Test user logout workflow"""
    
    def setup_method(self):
        # Use global auth_service with SessionService dependency
        self.auth_service = auth_service
    
    @pytest.mark.asyncio
    async def test_logout_user_success(self):
        """Test successful user logout"""
        refresh_token = "test.refresh.token"
        session = UserSession(
            id="1", user_id="1", access_token="access", refresh_token=refresh_token,
            expires_at=datetime.utcnow() + timedelta(days=30), device_info=None
        )
        
        with patch.object(session_service, 'get_session_by_refresh_token', new_callable=AsyncMock, return_value=session), \
             patch.object(session_service, 'delete_session', new_callable=AsyncMock) as mock_delete:
            
            await self.auth_service.logout_user(refresh_token)
            
            mock_delete.assert_called_once_with(int(session.id))
    
    @pytest.mark.asyncio
    async def test_logout_user_session_not_found(self):
        """Test logout handles missing session gracefully"""
        refresh_token = "nonexistent.refresh.token"
        
        with patch.object(session_service, 'get_session_by_refresh_token', new_callable=AsyncMock, return_value=None), \
             patch.object(session_service, 'delete_session', new_callable=AsyncMock) as mock_delete:
            
            # Should not raise exception
            await self.auth_service.logout_user(refresh_token)
            
            # Should not try to delete anything
            mock_delete.assert_not_called()


class TestCurrentUserFromToken:
    """Test getting current user from token"""
    
    def setup_method(self):
        # Use global auth_service with SessionService dependency
        self.auth_service = auth_service
        self.test_user = User(
            id="1", email="test@example.com", full_name="Test User",
            role=UserRole.STANDARD, is_developer=False, is_active=True,
            email_verified=True, created_at=datetime.utcnow()
        )
    
    @pytest.mark.asyncio
    async def test_get_current_user_from_token_success(self):
        """Test successful user retrieval from token"""
        access_token = self.auth_service.create_access_token(self.test_user)

        with patch.object(user_service, 'get_user_by_id', new_callable=AsyncMock, return_value=self.test_user):
            user = await self.auth_service.get_current_user_from_token(access_token)
            
            assert user == self.test_user
            assert user.id == self.test_user.id
            assert user.email == self.test_user.email
    
    @pytest.mark.asyncio
    async def test_get_current_user_invalid_token(self):
        """Test user retrieval fails with invalid token"""
        invalid_token = "invalid.access.token"
        
        with pytest.raises(HTTPException) as exc_info:
            await self.auth_service.get_current_user_from_token(invalid_token)
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "validate credentials" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_get_current_user_not_found(self):
        """Test user retrieval fails when user doesn't exist"""
        access_token = self.auth_service.create_access_token(self.test_user)

        with patch.object(user_service, 'get_user_by_id', new_callable=AsyncMock, return_value=None):
            with pytest.raises(HTTPException) as exc_info:
                await self.auth_service.get_current_user_from_token(access_token)
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "User not found" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_get_current_user_inactive(self):
        """Test user retrieval fails for inactive user"""
        access_token = self.auth_service.create_access_token(self.test_user)

        inactive_user = User(
            id="1", email="test@example.com", full_name="Test User",
            role=UserRole.STANDARD, is_developer=False, is_active=False,
            email_verified=True, created_at=datetime.utcnow()
        )

        with patch.object(user_service, 'get_user_by_id', new_callable=AsyncMock, return_value=inactive_user):
            with pytest.raises(HTTPException) as exc_info:
                await self.auth_service.get_current_user_from_token(access_token)
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "deactivated" in str(exc_info.value.detail)
