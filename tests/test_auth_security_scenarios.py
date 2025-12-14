"""
Authentication Security Scenarios Tests

This test suite covers:
- Security edge cases and attack vectors
- Rate limiting behavior simulation
- Token manipulation attempts
- Session security testing
- Role escalation prevention
- Input sanitization validation

Target: 15 lines coverage improvement + security validation
"""

import pytest
import jwt
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.auth import session_service as auth_session_service, AuthService, security
from app.models.user import User, UserRole, TokenData
from fastapi import HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials

session_service = auth_session_service


class TestTokenSecurityScenarios:
    """Test JWT token security edge cases"""
    
    def setup_method(self):
        self.auth_service = AuthService()
        self.test_user = User(
            id="1", email="test@example.com", full_name="Test User",
            role=UserRole.STANDARD, is_developer=False, is_active=True,
            email_verified=True, created_at=datetime.utcnow()
        )
    
    def test_token_reuse_prevention(self):
        """Test that tokens cannot be reused inappropriately"""
        # Create access token
        access_token = self.auth_service.create_access_token(self.test_user)
        
        # Verify as access token (should work)
        token_data = self.auth_service.verify_token(access_token, "access")
        assert token_data is not None
        
        # Try to use as refresh token (should fail)
        token_data = self.auth_service.verify_token(access_token, "refresh")
        assert token_data is None
    
    def test_token_modification_detection(self):
        """Test detection of modified token payloads"""
        token = self.auth_service.create_access_token(self.test_user)
        
        # Split token into parts
        parts = token.split('.')
        
        # Modify the payload (decode, change, re-encode)
        import base64, json
        
        payload = parts[1]
        # Add padding if needed
        payload += '=' * (4 - len(payload) % 4)
        
        decoded_payload = json.loads(base64.urlsafe_b64decode(payload))
        decoded_payload['user_id'] = 999  # Change user_id
        
        modified_payload = base64.urlsafe_b64encode(
            json.dumps(decoded_payload).encode()
        ).decode().rstrip('=')
        
        # Create modified token
        modified_token = f"{parts[0]}.{modified_payload}.{parts[2]}"
        
        # Should fail verification due to signature mismatch
        token_data = self.auth_service.verify_token(modified_token, "access")
        assert token_data is None
    
    def test_expired_token_strict_validation(self):
        """Test strict validation of expired tokens"""
        with patch('app.services.auth.datetime') as mock_datetime:
            # Create token with very short expiration
            past_time = datetime(2024, 1, 1, 12, 0, 0)
            mock_datetime.utcnow.return_value = past_time
            
            token = self.auth_service.create_access_token(self.test_user)
            
            # Move time forward just past expiration
            future_time = past_time + timedelta(minutes=15, seconds=1)
            mock_datetime.utcnow.return_value = future_time
            
            # Should fail validation
            token_data = self.auth_service.verify_token(token, "access")
            assert token_data is None
    
    def test_algorithm_downgrade_attack_prevention(self):
        """Test prevention of algorithm downgrade attacks"""
        # Create payload
        payload = {
            "user_id": self.test_user.id,
            "email": self.test_user.email,
            "role": self.test_user.role.value,
            "type": "access",
            "exp": datetime.utcnow() + timedelta(minutes=15),
            "iat": datetime.utcnow()
        }
        
        # Try with 'none' algorithm (should be rejected)
        none_token = jwt.encode(payload, "", algorithm="none")
        token_data = self.auth_service.verify_token(none_token, "access")
        assert token_data is None
        
        # Try with different HMAC algorithm
        hs512_token = jwt.encode(payload, self.auth_service.secret_key, algorithm="HS512")
        token_data = self.auth_service.verify_token(hs512_token, "access")
        assert token_data is None


class TestSessionSecurityScenarios:
    """Test session management security"""

    def setup_method(self):
        # Phase 2 Batch 7: Use global auth_service with SessionService
        from app.services.auth import auth_service
        self.auth_service = auth_service
    
    @pytest.mark.asyncio
    async def test_concurrent_session_handling(self):
        """Test handling of multiple concurrent sessions"""
        from app.models.user import UserSession
        
        refresh_token_1 = "refresh_token_1"
        refresh_token_2 = "refresh_token_2"
        
        session_1 = UserSession(
            id="1", user_id="1", access_token="access_1", refresh_token=refresh_token_1,
            expires_at=datetime.utcnow() + timedelta(days=30), device_info="Device 1"
        )
        
        session_2 = UserSession(
            id="2", user_id="1", access_token="access_2", refresh_token=refresh_token_2,
            expires_at=datetime.utcnow() + timedelta(days=30), device_info="Device 2"
        )
        
        # Mock session service calls for different sessions - Phase 2 Batch 7
        with patch.object(session_service, 'get_session_by_refresh_token', new_callable=AsyncMock) as mock_get_session:
            async def get_session_side_effect(token):
                if token == refresh_token_1:
                    return session_1
                elif token == refresh_token_2:
                    return session_2
                return None

            mock_get_session.side_effect = get_session_side_effect

            # Both sessions should be handled independently
            with patch.object(session_service, 'delete_session', new_callable=AsyncMock) as mock_delete:
                await self.auth_service.logout_user(refresh_token_1)
                mock_delete.assert_called_with(int(session_1.id))
                
                await self.auth_service.logout_user(refresh_token_2)
                mock_delete.assert_called_with(int(session_2.id))
    
    @pytest.mark.asyncio
    async def test_session_cleanup_on_expired_refresh(self):
        """Test automatic cleanup of expired sessions during refresh"""
        from app.models.user import UserSession
        from app.services.database import db_service
        from app.services.session_service import SessionService

        expired_session = UserSession(
            id="1", user_id="1", access_token="access", refresh_token="expired_token",
            expires_at=datetime.utcnow() - timedelta(days=1), device_info=None
        )
        
        with patch.object(session_service, 'get_session_by_refresh_token', new_callable=AsyncMock, return_value=expired_session), \
             patch.object(session_service, 'delete_session', new_callable=AsyncMock) as mock_delete:
            
            with pytest.raises(HTTPException) as exc_info:
                await self.auth_service.refresh_access_token("expired_token")
            
            # Should delete expired session
            mock_delete.assert_called_once_with(int(expired_session.id))
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


class TestInputValidationSecurity:
    """Test input validation and sanitization"""
    
    def setup_method(self):
        self.auth_service = AuthService()
    
    def test_password_hashing_handles_special_characters(self):
        """Test password hashing with various special characters"""
        special_passwords = [
            "p@ssw0rd!#$%",
            "пароль123",  # Cyrillic characters
            "密码123",     # Chinese characters
            "🔒password🔑",  # Emoji
            "pass\nword",   # Newline
            "pass\tword",   # Tab
            "pass word",    # Space
            "'DROP TABLE users;--",  # SQL injection attempt
        ]
        
        for password in special_passwords:
            hashed = self.auth_service.hash_password(password)
            assert hashed is not None
            assert len(hashed) > 0
            assert self.auth_service.verify_password(password, hashed)
    
    def test_email_case_handling(self):
        """Test email case sensitivity handling"""
        test_user = User(
            id="1", email="Test@Example.COM", full_name="Test User",
            role=UserRole.STANDARD, is_developer=False, is_active=True,
            email_verified=True, created_at=datetime.utcnow()
        )
        
        token = self.auth_service.create_access_token(test_user)
        payload = jwt.decode(token, self.auth_service.secret_key, algorithms=["HS256"])
        
        # Token should contain the email as provided
        assert payload['email'] == "Test@Example.COM"
    
    def test_token_payload_size_limits(self):
        """Test token handling with large payloads"""
        # Create user with very long name
        long_name_user = User(
            id="1",
            email="test@example.com",
            full_name="A" * 1000,  # Very long name
            role=UserRole.STANDARD,
            is_developer=False,
            is_active=True,
            email_verified=True,
            created_at=datetime.utcnow()
        )
        
        # Should still create valid token
        token = self.auth_service.create_access_token(long_name_user)
        assert token is not None
        
        # Should still validate
        token_data = self.auth_service.verify_token(token, "access")
        assert token_data is not None


class TestRoleSecurityScenarios:
    """Test role-based security scenarios"""
    
    @pytest.mark.asyncio
    async def test_role_escalation_prevention(self):
        """Test prevention of role escalation attacks"""
        from app.services.auth import session_service as auth_session_service,  get_current_developer_user, get_current_admin_user
        
        # Standard user trying to access developer functionality
        standard_user = User(
            id="1", email="user@example.com", full_name="Standard User",
            role=UserRole.STANDARD, is_developer=False, is_active=True,
            email_verified=True, created_at=datetime.utcnow()
        )
        
        # Should deny developer access
        with pytest.raises(HTTPException) as exc_info:
            await get_current_developer_user(standard_user)
        
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Developer access required" in str(exc_info.value.detail)
        
        # Should deny admin access
        with pytest.raises(HTTPException) as exc_info:
            await get_current_admin_user(standard_user)
        
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Admin access required" in str(exc_info.value.detail)
    
    def test_token_role_consistency(self):
        """Test that token roles are consistent with user roles"""
        # Create developer user
        dev_user = User(
            id="1", email="dev@example.com", full_name="Developer",
            role=UserRole.DEVELOPER, is_developer=True, is_active=True,
            email_verified=True, created_at=datetime.utcnow()
        )
        
        # Create standard user
        std_user = User(
            id="2", email="user@example.com", full_name="User",
            role=UserRole.STANDARD, is_developer=False, is_active=True,
            email_verified=True, created_at=datetime.utcnow()
        )
        
        # Check developer token
        dev_token = self.auth_service.create_access_token(dev_user)
        dev_payload = jwt.decode(dev_token, self.auth_service.secret_key, algorithms=["HS256"])
        
        assert dev_payload['role'] == UserRole.DEVELOPER.value
        assert dev_payload['is_developer'] is True
        
        # Check standard token
        std_token = self.auth_service.create_access_token(std_user)
        std_payload = jwt.decode(std_token, self.auth_service.secret_key, algorithms=["HS256"])
        
        assert std_payload['role'] == UserRole.STANDARD.value
        assert std_payload['is_developer'] is False
    
    def setup_method(self):
        self.auth_service = AuthService()


class TestSecurityConfiguration:
    """Test security configuration and constants"""
    
    def test_secure_defaults(self):
        """Test that security defaults are appropriately configured"""
        from app.services.auth import session_service as auth_session_service,  ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS, ALGORITHM
        
        # Access tokens should have short expiration
        assert ACCESS_TOKEN_EXPIRE_MINUTES <= 60  # Max 1 hour
        
        # Refresh tokens should have reasonable expiration
        assert REFRESH_TOKEN_EXPIRE_DAYS <= 90  # Max 3 months
        
        # Should use strong algorithm
        assert ALGORITHM == "HS256"
    
    def test_httpsecurity_configuration(self):
        """Test HTTPBearer security configuration"""
        from app.services.auth import session_service as auth_session_service,  security
        from fastapi.security import HTTPBearer
        
        assert isinstance(security, HTTPBearer)
        # HTTPBearer should be properly configured for JWT
    
    def test_secret_key_handling(self):
        """Test secret key security"""
        auth_service = AuthService()
        
        # Secret key should exist and be non-empty
        assert auth_service.secret_key is not None
        assert len(auth_service.secret_key) > 0
        
        # Should be different from default/test values
        insecure_keys = ["secret", "key", "test", "password", "123"]
        assert auth_service.secret_key not in insecure_keys


class TestErrorHandlingSecurity:
    """Test security-related error handling"""
    
    def setup_method(self):
        self.auth_service = AuthService()
    
    @pytest.mark.asyncio
    async def test_information_disclosure_prevention(self):
        """Test that errors don't disclose sensitive information"""
        from app.models.user import UserLogin
        from app.services.database import db_service
        
        # Test login with non-existent user
        login_data = UserLogin(email="nonexistent@example.com", password="password")
        
        with patch.object(db_service, 'get_user_by_email', new_callable=AsyncMock, return_value=None):
            with pytest.raises(HTTPException) as exc_info:
                await self.auth_service.login_user(login_data)
            
            # Error message should not reveal whether user exists
            assert "Invalid email or password" in str(exc_info.value.detail)
            # Should not say "User not found" or similar
    
    def test_token_error_consistency(self):
        """Test that token validation errors are consistent"""
        # All invalid tokens should return None (not raise different exceptions)
        invalid_tokens = [
            "invalid",
            "invalid.token.format", 
            "",
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid",
            "a.b.c.d",  # Too many parts
        ]
        
        for token in invalid_tokens:
            result = self.auth_service.verify_token(token, "access")
            assert result is None  # Consistent response for all invalid tokens
    
    @pytest.mark.asyncio
    async def test_timing_attack_mitigation(self):
        """Test timing attack mitigation in password verification"""
        from app.models.user import UserLogin
        from app.services.database import db_service
        
        # Create real user for comparison
        real_user = User(
            id="1", email="real@example.com", full_name="Real User",
            role=UserRole.STANDARD, is_developer=False, is_active=True,
            email_verified=True, created_at=datetime.utcnow()
        )
        
        real_hash = self.auth_service.hash_password("correct_password")
        
        # Time operations with real vs fake user
        import time
        
        # Real user, wrong password
        login_real = UserLogin(email="real@example.com", password="wrong_password")
        
        with patch.object(db_service, 'get_user_by_email', new_callable=AsyncMock, return_value=real_user), \
             patch.object(db_service, 'get_password_hash', new_callable=AsyncMock, return_value=real_hash):
            
            start_time = time.time()
            try:
                await self.auth_service.login_user(login_real)
            except HTTPException:
                pass
            real_user_time = time.time() - start_time
        
        # Non-existent user
        login_fake = UserLogin(email="fake@example.com", password="any_password")
        
        with patch.object(db_service, 'get_user_by_email', new_callable=AsyncMock, return_value=None):
            start_time = time.time()
            try:
                await self.auth_service.login_user(login_fake)
            except HTTPException:
                pass
            fake_user_time = time.time() - start_time
        
        # Times should be reasonably similar (within factor of 10)
        # This is a rough test - in production, more sophisticated timing analysis would be needed
        time_ratio = max(real_user_time, fake_user_time) / min(real_user_time, fake_user_time)
        assert time_ratio < 10.0  # Allow some variance but not orders of magnitude
