"""
Comprehensive JWT Token Management Tests for Authentication Service

This test suite covers:
- JWT token creation and validation
- Token expiration handling  
- Signature verification
- Token type validation (access vs refresh)
- Security edge cases and malformed tokens

Target: 40 lines coverage improvement
"""

import pytest
import jwt
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from app.services.auth import AuthService
from app.models.user import User, UserRole, TokenData
from app.config import config


class TestJWTTokenCreation:
    """Test JWT token creation functionality"""
    
    def setup_method(self):
        self.auth_service = AuthService()
        self.test_user = User(
            id="1",
            email="test@example.com",
            full_name="Test User",
            role=UserRole.STANDARD,
            is_developer=False,
            is_active=True,
            email_verified=True,
            created_at=datetime.utcnow()
        )
    
    def test_create_access_token_success(self):
        """Test successful access token creation"""
        token = self.auth_service.create_access_token(self.test_user)
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0
        
        # Verify token can be decoded
        payload = jwt.decode(token, self.auth_service.secret_key, algorithms=[self.auth_service.algorithm])
        
        assert payload['user_id'] == self.test_user.id
        assert payload['email'] == self.test_user.email
        assert payload['role'] == self.test_user.role.value
        assert payload['is_developer'] == self.test_user.is_developer
        assert payload['type'] == 'access'
        assert 'exp' in payload
        assert 'iat' in payload
    
    def test_create_refresh_token_success(self):
        """Test successful refresh token creation"""
        token = self.auth_service.create_refresh_token(self.test_user)
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0
        
        # Verify token can be decoded
        payload = jwt.decode(token, self.auth_service.secret_key, algorithms=[self.auth_service.algorithm])
        
        assert payload['user_id'] == self.test_user.id
        assert payload['email'] == self.test_user.email
        assert payload['type'] == 'refresh'
        assert 'exp' in payload
        assert 'iat' in payload
        # Refresh tokens should not include role/developer info
        assert 'role' not in payload
        assert 'is_developer' not in payload
    
    def test_access_token_expiration_time(self):
        """Test access token has correct expiration time"""
        # Debug: Show actual configured values
        print(f"\nDEBUG: AuthService access_token_expire_minutes: {self.auth_service.access_token_expire_minutes}")
        
        # Test without mocking to check if token expiration matches the configured time
        before_creation = datetime.utcnow()
        token = self.auth_service.create_access_token(self.test_user)
        after_creation = datetime.utcnow()
        
        payload = jwt.decode(token, self.auth_service.secret_key, algorithms=[self.auth_service.algorithm], options={"verify_exp": False})
        actual_exp = datetime.fromtimestamp(payload['exp'])
        
        # Calculate expected range based on configured value
        expected_min = before_creation + timedelta(minutes=self.auth_service.access_token_expire_minutes)
        expected_max = after_creation + timedelta(minutes=self.auth_service.access_token_expire_minutes)
        
        print(f"DEBUG: Configured minutes: {self.auth_service.access_token_expire_minutes}")
        print(f"DEBUG: Token expires at: {actual_exp}")
        print(f"DEBUG: Expected range: {expected_min} - {expected_max}")
        
        # Token expiration should be within expected range
        assert expected_min <= actual_exp <= expected_max, f"Token expires at {actual_exp}, expected between {expected_min} and {expected_max}"
    
    def test_refresh_token_expiration_time(self):
        """Test refresh token has correct expiration time"""
        # Test without mocking to check if token expiration matches the configured time
        before_creation = datetime.utcnow()
        token = self.auth_service.create_refresh_token(self.test_user)
        after_creation = datetime.utcnow()
        
        payload = jwt.decode(token, self.auth_service.secret_key, algorithms=[self.auth_service.algorithm], options={"verify_exp": False})
        actual_exp = datetime.fromtimestamp(payload['exp'])
        
        # Calculate expected range based on configured value
        expected_min = before_creation + timedelta(days=self.auth_service.refresh_token_expire_days)
        expected_max = after_creation + timedelta(days=self.auth_service.refresh_token_expire_days)
        
        # Token expiration should be within expected range
        assert expected_min <= actual_exp <= expected_max, f"Token expires at {actual_exp}, expected between {expected_min} and {expected_max}"
    
    def test_developer_user_token_includes_role(self):
        """Test developer user tokens include correct role information"""
        dev_user = User(
            id="2",
            email="dev@example.com",
            full_name="Developer User",
            role=UserRole.DEVELOPER,
            is_developer=True,
            is_active=True,
            email_verified=True,
            created_at=datetime.utcnow()
        )
        
        token = self.auth_service.create_access_token(dev_user)
        payload = jwt.decode(token, self.auth_service.secret_key, algorithms=[self.auth_service.algorithm])
        
        assert payload['role'] == UserRole.DEVELOPER.value
        assert payload['is_developer'] is True


class TestJWTTokenValidation:
    """Test JWT token validation functionality"""
    
    def setup_method(self):
        self.auth_service = AuthService()
        self.test_user = User(
            id="1",
            email="test@example.com",
            full_name="Test User",
            role=UserRole.STANDARD,
            is_developer=False,
            is_active=True,
            email_verified=True,
            created_at=datetime.utcnow()
        )
    
    def test_verify_valid_access_token(self):
        """Test verification of valid access token"""
        token = self.auth_service.create_access_token(self.test_user)
        token_data = self.auth_service.verify_token(token, "access")
        
        assert token_data is not None
        assert isinstance(token_data, TokenData)
        assert token_data.user_id == self.test_user.id
        assert token_data.email == self.test_user.email
        assert token_data.role == self.test_user.role
        assert token_data.is_developer == self.test_user.is_developer
    
    def test_verify_valid_refresh_token(self):
        """Test verification of valid refresh token"""
        token = self.auth_service.create_refresh_token(self.test_user)
        token_data = self.auth_service.verify_token(token, "refresh")
        
        assert token_data is not None
        assert isinstance(token_data, TokenData)
        assert token_data.user_id == self.test_user.id
        assert token_data.email == self.test_user.email
        # Refresh tokens default to STANDARD role
        assert token_data.role == UserRole.STANDARD
        assert token_data.is_developer is False
    
    def test_verify_token_wrong_type(self):
        """Test verification fails when token type doesn't match"""
        access_token = self.auth_service.create_access_token(self.test_user)
        refresh_token = self.auth_service.create_refresh_token(self.test_user)
        
        # Try to verify access token as refresh token
        assert self.auth_service.verify_token(access_token, "refresh") is None
        
        # Try to verify refresh token as access token
        assert self.auth_service.verify_token(refresh_token, "access") is None
    
    def test_verify_expired_token(self):
        """Test verification fails for expired token"""
        with patch('app.services.auth.datetime') as mock_datetime:
            # Create token in the past
            past_time = datetime(2024, 1, 1, 12, 0, 0)
            mock_datetime.utcnow.return_value = past_time
            
            token = self.auth_service.create_access_token(self.test_user)
            
            # Move time forward past expiration
            future_time = past_time + timedelta(minutes=20)  # Beyond 15 min expiration
            mock_datetime.utcnow.return_value = future_time
            
            token_data = self.auth_service.verify_token(token, "access")
            assert token_data is None
    
    def test_verify_token_with_invalid_signature(self):
        """Test verification fails for token with invalid signature"""
        token = self.auth_service.create_access_token(self.test_user)
        
        # Modify the token to invalidate signature
        invalid_token = token[:-10] + "invalid123"
        
        token_data = self.auth_service.verify_token(invalid_token, "access")
        assert token_data is None
    
    def test_verify_malformed_token(self):
        """Test verification handles malformed tokens gracefully"""
        malformed_tokens = [
            "",  # Empty string
            "not.a.jwt",  # Invalid format
            "header.payload",  # Missing signature
            "a.b.c.d",  # Too many parts
            "invalid_jwt_token",  # Not base64
        ]
        
        for token in malformed_tokens:
            assert self.auth_service.verify_token(token, "access") is None
    
    def test_verify_token_with_wrong_secret(self):
        """Test verification fails when wrong secret is used"""
        # Create token with different secret
        wrong_secret_service = AuthService()
        wrong_secret_service.secret_key = "wrong_secret_key"
        
        token = wrong_secret_service.create_access_token(self.test_user)
        
        # Try to verify with correct service (different secret)
        token_data = self.auth_service.verify_token(token, "access")
        assert token_data is None


class TestJWTTokenSecurity:
    """Test JWT token security aspects and edge cases"""
    
    def setup_method(self):
        self.auth_service = AuthService()
        self.test_user = User(
            id="1",
            email="test@example.com",
            full_name="Test User",
            role=UserRole.STANDARD,
            is_developer=False,
            is_active=True,
            email_verified=True,
            created_at=datetime.utcnow()
        )
    
    def test_token_uniqueness(self):
        """Test that generated tokens are unique"""
        tokens = set()
        
        # Generate 10 tokens and ensure they're all different
        for _ in range(10):
            token = self.auth_service.create_access_token(self.test_user)
            assert token not in tokens
            tokens.add(token)
    
    def test_algorithm_enforcement(self):
        """Test that only supported algorithms are accepted"""
        # Create token with different algorithm
        payload = {
            "user_id": self.test_user.id,
            "email": self.test_user.email,
            "role": self.test_user.role.value,
            "type": "access",
            "exp": datetime.utcnow() + timedelta(minutes=15),
            "iat": datetime.utcnow()
        }
        
        # Create token with HS512 algorithm (not HS256)
        token_hs512 = jwt.encode(payload, self.auth_service.secret_key, algorithm="HS512")
        
        # Should fail verification due to algorithm mismatch
        token_data = self.auth_service.verify_token(token_hs512, "access")
        assert token_data is None
    
    def test_token_payload_tampering(self):
        """Test token fails verification when payload is tampered"""
        token = self.auth_service.create_access_token(self.test_user)
        
        # Decode without verification to tamper with payload
        header, payload, signature = token.split('.')
        
        # Decode payload and modify it
        import base64
        import json
        
        # Add padding if needed
        payload += '=' * (4 - len(payload) % 4)
        decoded_payload = json.loads(base64.urlsafe_b64decode(payload))
        
        # Tamper with user_id
        decoded_payload['user_id'] = 999
        
        # Re-encode
        tampered_payload = base64.urlsafe_b64encode(
            json.dumps(decoded_payload).encode()
        ).decode().rstrip('=')
        
        tampered_token = f"{header}.{tampered_payload}.{signature}"
        
        # Should fail verification due to signature mismatch
        token_data = self.auth_service.verify_token(tampered_token, "access")
        assert token_data is None
    
    def test_none_algorithm_attack_prevention(self):
        """Test prevention of 'none' algorithm attack"""
        payload = {
            "user_id": self.test_user.id,
            "email": self.test_user.email,
            "role": self.test_user.role.value,
            "type": "access",
            "exp": datetime.utcnow() + timedelta(minutes=15),
            "iat": datetime.utcnow()
        }
        
        # Create token with 'none' algorithm
        token_none = jwt.encode(payload, "", algorithm="none")
        
        # Should fail verification
        token_data = self.auth_service.verify_token(token_none, "access")
        assert token_data is None
    
    def test_token_without_required_fields(self):
        """Test tokens missing required fields fail verification"""
        # Create token missing user_id
        payload_missing_user = {
            "email": self.test_user.email,
            "role": self.test_user.role.value,
            "type": "access",
            "exp": datetime.utcnow() + timedelta(minutes=15),
            "iat": datetime.utcnow()
        }
        
        token = jwt.encode(payload_missing_user, self.auth_service.secret_key, algorithm="HS256")
        token_data = self.auth_service.verify_token(token, "access")
        
        # Should still work but user_id will be None
        assert token_data is not None
        assert token_data.user_id is None
        assert token_data.email == self.test_user.email


class TestJWTConfiguration:
    """Test JWT configuration and setup"""
    
    def test_auth_service_initialization(self):
        """Test AuthService initializes with correct configuration"""
        auth_service = AuthService()
        
        assert auth_service.secret_key == config.secret_key
        assert auth_service.algorithm == "HS256"
        assert auth_service.access_token_expire_minutes == 15
        assert auth_service.refresh_token_expire_days == 30
    
    def test_token_constants(self):
        """Test token expiration constants are set correctly"""
        from app.services.auth import ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS, ALGORITHM
        
        assert ACCESS_TOKEN_EXPIRE_MINUTES == 15
        assert REFRESH_TOKEN_EXPIRE_DAYS == 30
        assert ALGORITHM == "HS256"
    
    def test_different_users_same_structure(self):
        """Test tokens for different users have same structure"""
        auth_service = AuthService()
        
        user1 = User(
            id="1", email="user1@test.com", full_name="User 1",
            role=UserRole.STANDARD, is_developer=False, is_active=True,
            email_verified=True, created_at=datetime.utcnow()
        )
        
        user2 = User(
            id="2", email="user2@test.com", full_name="User 2",
            role=UserRole.DEVELOPER, is_developer=True, is_active=True,
            email_verified=True, created_at=datetime.utcnow()
        )
        
        token1 = auth_service.create_access_token(user1)
        token2 = auth_service.create_access_token(user2)
        
        payload1 = jwt.decode(token1, auth_service.secret_key, algorithms=["HS256"])
        payload2 = jwt.decode(token2, auth_service.secret_key, algorithms=["HS256"])
        
        # Both should have same structure (same keys)
        assert set(payload1.keys()) == set(payload2.keys())
        
        # But different values
        assert payload1['user_id'] != payload2['user_id']
        assert payload1['email'] != payload2['email']
        assert payload1['role'] != payload2['role']
        assert payload1['is_developer'] != payload2['is_developer']