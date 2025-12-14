"""
Comprehensive Authentication Routes Integration Tests

This test suite covers:
- FastAPI route integration testing
- HTTP endpoint request/response validation
- Authentication middleware testing  
- Error handling and status codes
- FastAPI dependency injection
- Role-based access control

Target: 20 lines coverage improvement
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import status

from main import app
from app.models.user import User, UserCreate, UserLogin, UserRole, Token, RefreshToken, UserUpdate, ChangePassword
from app.services.auth import auth_service, session_service
from app.services.database import db_service
from app.services.session_service import SessionService


@pytest.fixture
def client():
    """Test client for FastAPI application"""
    return TestClient(app)


@pytest.fixture
def test_user():
    """Test user fixture"""
    return User(
        id="1",
        email="test@example.com",
        full_name="Test User",
        role=UserRole.STANDARD,
        is_developer=False,
        is_active=True,
        email_verified=True,
        created_at=datetime.utcnow()
    )


@pytest.fixture
def developer_user():
    """Test developer user fixture"""
    return User(
        id="2",
        email="dev@example.com",
        full_name="Developer User",
        role=UserRole.DEVELOPER,
        is_developer=True,
        is_active=True,
        email_verified=True,
        created_at=datetime.utcnow()
    )


class TestRegistrationEndpoint:
    """Test /auth/register endpoint"""
    
    def test_register_success(self, client):
        """Test successful user registration"""
        registration_data = {
            "email": "newuser@example.com",
            "password": "password123",
            "full_name": "New User"
        }
        
        mock_token = Token(
            access_token="access_token_123",
            refresh_token="refresh_token_123",
            token_type="bearer",
            expires_in=900
        )
        
        with patch.object(auth_service, 'register_user', new_callable=AsyncMock, return_value=mock_token):
            response = client.post("/auth/register", json=registration_data)
            
            assert response.status_code == status.HTTP_201_CREATED
            data = response.json()
            assert data["access_token"] == "access_token_123"
            assert data["refresh_token"] == "refresh_token_123"
            assert data["token_type"] == "bearer"
            assert data["expires_in"] == 900
    
    def test_register_duplicate_email(self, client):
        """Test registration with duplicate email"""
        registration_data = {
            "email": "existing@example.com",
            "password": "password123",
            "full_name": "User"
        }
        
        from fastapi import HTTPException
        
        with patch.object(auth_service, 'register_user', new_callable=AsyncMock) as mock_register:
            mock_register.side_effect = HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists"
            )
            
            response = client.post("/auth/register", json=registration_data)
            
            assert response.status_code == status.HTTP_409_CONFLICT
            assert "already exists" in response.json()["detail"]
    
    def test_register_invalid_data(self, client):
        """Test registration with invalid data"""
        invalid_data = {
            "email": "invalid-email",  # Invalid email format
            "password": "123",  # Too short
            "full_name": ""  # Empty name
        }
        
        response = client.post("/auth/register", json=invalid_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_register_developer_code(self, client):
        """Test registration with developer code"""
        registration_data = {
            "email": "developer@example.com",
            "password": "password123",
            "full_name": "Developer User",
            "developer_code": "DIETINTEL_DEV_2024"
        }
        
        mock_token = Token(
            access_token="dev_access_token",
            refresh_token="dev_refresh_token",
            token_type="bearer",
            expires_in=900
        )
        
        with patch.object(auth_service, 'register_user', new_callable=AsyncMock, return_value=mock_token):
            response = client.post("/auth/register", json=registration_data)
            
            assert response.status_code == status.HTTP_201_CREATED
            assert response.json()["access_token"] == "dev_access_token"
    
    def test_register_internal_error(self, client):
        """Test registration handles internal errors"""
        registration_data = {
            "email": "test@example.com",
            "password": "password123",
            "full_name": "Test User"
        }
        
        with patch.object(auth_service, 'register_user', new_callable=AsyncMock) as mock_register:
            mock_register.side_effect = Exception("Database connection failed")
            
            response = client.post("/auth/register", json=registration_data)
            
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            assert "Registration failed" in response.json()["detail"]


class TestLoginEndpoint:
    """Test /auth/login endpoint"""
    
    def test_login_success(self, client):
        """Test successful user login"""
        login_data = {
            "email": "test@example.com",
            "password": "password123"
        }
        
        mock_token = Token(
            access_token="login_access_token",
            refresh_token="login_refresh_token",
            token_type="bearer",
            expires_in=900
        )
        
        with patch.object(auth_service, 'login_user', new_callable=AsyncMock, return_value=mock_token):
            response = client.post("/auth/login", json=login_data)
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["access_token"] == "login_access_token"
            assert data["refresh_token"] == "login_refresh_token"
    
    def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials"""
        login_data = {
            "email": "test@example.com",
            "password": "wrong_password"
        }
        
        from fastapi import HTTPException
        
        with patch.object(auth_service, 'login_user', new_callable=AsyncMock) as mock_login:
            mock_login.side_effect = HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
            
            response = client.post("/auth/login", json=login_data)
            
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Invalid email or password" in response.json()["detail"]
    
    def test_login_inactive_account(self, client):
        """Test login with inactive account"""
        login_data = {
            "email": "inactive@example.com",
            "password": "password123"
        }
        
        from fastapi import HTTPException
        
        with patch.object(auth_service, 'login_user', new_callable=AsyncMock) as mock_login:
            mock_login.side_effect = HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is deactivated"
            )
            
            response = client.post("/auth/login", json=login_data)
            
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            assert "deactivated" in response.json()["detail"]
    
    def test_login_internal_error(self, client):
        """Test login handles internal errors"""
        login_data = {
            "email": "test@example.com",
            "password": "password123"
        }
        
        with patch.object(auth_service, 'login_user', new_callable=AsyncMock) as mock_login:
            mock_login.side_effect = Exception("Authentication service failed")
            
            response = client.post("/auth/login", json=login_data)
            
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            assert "Login failed" in response.json()["detail"]


class TestRefreshTokenEndpoint:
    """Test /auth/refresh endpoint"""
    
    def test_refresh_token_success(self, client):
        """Test successful token refresh"""
        refresh_data = {
            "refresh_token": "valid_refresh_token"
        }
        
        mock_new_token = Token(
            access_token="new_access_token",
            refresh_token="new_refresh_token", 
            token_type="bearer",
            expires_in=900
        )
        
        with patch.object(auth_service, 'refresh_access_token', new_callable=AsyncMock, return_value=mock_new_token):
            response = client.post("/auth/refresh", json=refresh_data)
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["access_token"] == "new_access_token"
            assert data["refresh_token"] == "new_refresh_token"
    
    def test_refresh_token_invalid(self, client):
        """Test token refresh with invalid refresh token"""
        refresh_data = {
            "refresh_token": "invalid_refresh_token"
        }
        
        from fastapi import HTTPException
        
        with patch.object(auth_service, 'refresh_access_token', new_callable=AsyncMock) as mock_refresh:
            mock_refresh.side_effect = HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
            
            response = client.post("/auth/refresh", json=refresh_data)
            
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Invalid refresh token" in response.json()["detail"]
    
    def test_refresh_token_expired(self, client):
        """Test token refresh with expired token"""
        refresh_data = {
            "refresh_token": "expired_refresh_token"
        }
        
        from fastapi import HTTPException
        
        with patch.object(auth_service, 'refresh_access_token', new_callable=AsyncMock) as mock_refresh:
            mock_refresh.side_effect = HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired"
            )
            
            response = client.post("/auth/refresh", json=refresh_data)
            
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            assert "expired" in response.json()["detail"]


class TestLogoutEndpoint:
    """Test /auth/logout endpoint"""
    
    def test_logout_success(self, client):
        """Test successful logout"""
        logout_data = {
            "refresh_token": "valid_refresh_token"
        }
        
        with patch.object(auth_service, 'logout_user', new_callable=AsyncMock):
            response = client.post("/auth/logout", json=logout_data)
            
            assert response.status_code == status.HTTP_204_NO_CONTENT
            assert response.content == b''  # No content for 204 response
    
    def test_logout_handles_errors_gracefully(self, client):
        """Test logout handles errors gracefully (doesn't fail)"""
        logout_data = {
            "refresh_token": "invalid_refresh_token"
        }
        
        with patch.object(auth_service, 'logout_user', new_callable=AsyncMock) as mock_logout:
            mock_logout.side_effect = Exception("Database error")
            
            # Should still return 204 (best effort logout)
            response = client.post("/auth/logout", json=logout_data)
            
            assert response.status_code == status.HTTP_204_NO_CONTENT


class TestProtectedEndpoints:
    """Test protected endpoints requiring authentication"""
    
    def test_get_current_user_success(self, client, test_user):
        """Test getting current user profile"""
        access_token = "valid_access_token"
        
        with patch('app.services.auth.get_current_user', return_value=test_user):
            response = client.get(
                "/auth/me",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["id"] == test_user.id
            assert data["email"] == test_user.email
            assert data["full_name"] == test_user.full_name
            assert data["is_developer"] == test_user.is_developer
            assert data["role"] == test_user.role.value
    
    def test_get_current_user_unauthorized(self, client):
        """Test getting current user without token"""
        response = client.get("/auth/me")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_get_current_user_invalid_token(self, client):
        """Test getting current user with invalid token"""
        from fastapi import HTTPException
        
        with patch('app.services.auth.get_current_user') as mock_get_user:
            mock_get_user.side_effect = HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )
            
            response = client.get(
                "/auth/me",
                headers={"Authorization": "Bearer invalid_token"}
            )
            
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_update_user_profile_success(self, client, test_user):
        """Test updating user profile"""
        update_data = {
            "full_name": "Updated Name",
            "avatar_url": "https://example.com/avatar.jpg"
        }
        
        updated_user = User(
            id=test_user.id,
            email=test_user.email,
            full_name="Updated Name",
            avatar_url="https://example.com/avatar.jpg",
            role=test_user.role,
            is_developer=test_user.is_developer,
            is_active=test_user.is_active,
            email_verified=test_user.email_verified,
            created_at=test_user.created_at
        )
        
        with patch('app.services.auth.get_current_user', return_value=test_user), \
             patch.object(db_service, 'update_user', new_callable=AsyncMock, return_value=updated_user):
            
            response = client.put(
                "/auth/me",
                json=update_data,
                headers={"Authorization": "Bearer valid_token"}
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["full_name"] == "Updated Name"
            assert data["avatar_url"] == "https://example.com/avatar.jpg"
    
    def test_update_user_profile_no_changes(self, client, test_user):
        """Test updating user profile with no changes"""
        update_data = {}
        
        with patch('app.services.auth.get_current_user', return_value=test_user):
            response = client.put(
                "/auth/me",
                json=update_data,
                headers={"Authorization": "Bearer valid_token"}
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["full_name"] == test_user.full_name
    
    def test_change_password_success(self, client, test_user):
        """Test changing user password"""
        password_data = {
            "current_password": "old_password",
            "new_password": "new_password123"
        }
        
        current_hash = "hashed_old_password"
        
        with patch('app.services.auth.get_current_user', return_value=test_user), \
             patch.object(db_service, 'get_password_hash', new_callable=AsyncMock, return_value=current_hash), \
             patch.object(auth_service, 'verify_password', return_value=True), \
             patch.object(auth_service, 'hash_password', return_value="hashed_new_password"), \
             patch.object(db_service, 'update_user', new_callable=AsyncMock), \
             patch.object(session_service, 'delete_user_sessions', new_callable=AsyncMock):
            
            response = client.post(
                "/auth/change-password",
                json=password_data,
                headers={"Authorization": "Bearer valid_token"}
            )
            
            assert response.status_code == status.HTTP_204_NO_CONTENT
    
    def test_change_password_wrong_current_password(self, client, test_user):
        """Test changing password with wrong current password"""
        password_data = {
            "current_password": "wrong_password",
            "new_password": "new_password123"
        }
        
        current_hash = "hashed_old_password"
        
        with patch('app.services.auth.get_current_user', return_value=test_user), \
             patch.object(db_service, 'get_password_hash', new_callable=AsyncMock, return_value=current_hash), \
             patch.object(auth_service, 'verify_password', return_value=False):
            
            response = client.post(
                "/auth/change-password",
                json=password_data,
                headers={"Authorization": "Bearer valid_token"}
            )
            
            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert "incorrect" in response.json()["detail"]


class TestFastAPIDependencies:
    """Test FastAPI authentication dependencies"""
    
    def test_get_current_user_dependency(self, test_user):
        """Test get_current_user FastAPI dependency"""
        from app.services.auth import get_current_user
        from fastapi.security import HTTPAuthorizationCredentials
        
        # Mock credentials
        mock_credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="valid_access_token"
        )
        
        async def test_dependency():
            with patch.object(auth_service, 'get_current_user_from_token', new_callable=AsyncMock, return_value=test_user):
                user = await get_current_user(mock_credentials)
                assert user == test_user
        
        import asyncio
        asyncio.run(test_dependency())
    
    def test_get_current_developer_user_dependency(self, developer_user):
        """Test get_current_developer_user dependency"""
        from app.services.auth import get_current_developer_user
        
        async def test_dependency():
            user = await get_current_developer_user(developer_user)
            assert user == developer_user
        
        import asyncio
        asyncio.run(test_dependency())
    
    def test_get_current_developer_user_access_denied(self, test_user):
        """Test developer dependency denies non-developer users"""
        from app.services.auth import get_current_developer_user
        from fastapi import HTTPException
        
        async def test_dependency():
            with pytest.raises(HTTPException) as exc_info:
                await get_current_developer_user(test_user)  # Standard user, not developer
            
            assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
            assert "Developer access required" in str(exc_info.value.detail)
        
        import asyncio
        asyncio.run(test_dependency())
    
    def test_get_current_admin_user_dependency(self, developer_user):
        """Test get_current_admin_user dependency"""
        from app.services.auth import get_current_admin_user
        
        async def test_dependency():
            user = await get_current_admin_user(developer_user)
            assert user == developer_user
        
        import asyncio
        asyncio.run(test_dependency())
    
    def test_get_current_admin_user_access_denied(self, test_user):
        """Test admin dependency denies non-admin users"""
        from app.services.auth import get_current_admin_user
        from fastapi import HTTPException
        
        async def test_dependency():
            with pytest.raises(HTTPException) as exc_info:
                await get_current_admin_user(test_user)  # Standard user, not admin
            
            assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
            assert "Admin access required" in str(exc_info.value.detail)
        
        import asyncio
        asyncio.run(test_dependency())


class TestRouteErrorHandling:
    """Test route-level error handling"""
    
    def test_route_handles_validation_errors(self, client):
        """Test routes handle Pydantic validation errors"""
        # Send invalid JSON structure
        invalid_data = {
            "email": 123,  # Should be string
            "password": None,  # Should be string
        }
        
        response = client.post("/auth/register", json=invalid_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "validation error" in response.json()["detail"][0]["type"]
    
    def test_route_handles_missing_fields(self, client):
        """Test routes handle missing required fields"""
        incomplete_data = {
            "email": "test@example.com"
            # Missing password and full_name
        }
        
        response = client.post("/auth/register", json=incomplete_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_route_handles_malformed_json(self, client):
        """Test routes handle malformed JSON"""
        response = client.post(
            "/auth/register",
            data="{invalid json}",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY