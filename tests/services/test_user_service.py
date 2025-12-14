"""
User Service Test Suite - Phase 2 Batch 9

Comprehensive tests for UserService extraction covering:
- User CRUD operations
- Password hash handling
- Developer role detection
- Row-to-model conversion
- Error handling and edge cases

Target Coverage: 85%+
"""

import pytest
import uuid
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime

from app.services.user_service import UserService
from app.models.user import User, UserCreate, UserRole


@pytest.fixture
def mock_db_service():
    """Create a mock DatabaseService for testing"""
    return MagicMock()


@pytest.fixture
def user_service(mock_db_service):
    """Create UserService with mocked DatabaseService"""
    return UserService(mock_db_service)


@pytest.fixture
def sample_user_row():
    """Sample database row for a user"""
    return {
        'id': 'user_123',
        'email': 'test@example.com',
        'password_hash': '$2b$12$hashedpassword123',
        'full_name': 'Test User',
        'avatar_url': None,
        'is_developer': 0,
        'role': 'standard',
        'is_active': 1,
        'email_verified': 0,
        'created_at': '2025-12-14T10:00:00',
        'updated_at': '2025-12-14T10:00:00'
    }


@pytest.fixture
def sample_developer_row():
    """Sample database row for a developer user"""
    return {
        'id': 'dev_456',
        'email': 'dev@dietintel.com',
        'password_hash': '$2b$12$devhashedpassword456',
        'full_name': 'Developer User',
        'avatar_url': None,
        'is_developer': 1,
        'role': 'developer',
        'is_active': 1,
        'email_verified': 1,
        'created_at': '2025-12-14T09:00:00',
        'updated_at': '2025-12-14T09:00:00'
    }


class TestUserCreation:
    """Test user creation and registration"""

    @pytest.mark.asyncio
    async def test_create_user_success(self, user_service, mock_db_service):
        """Test successful user creation"""
        # Setup
        user_data = UserCreate(
            email="newuser@example.com",
            password="plaintext_password",
            full_name="New User",
            developer_code=""
        )
        password_hash = "$2b$12$hashedpassword"

        # Mock database connection and created user
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Mock get_user_by_id to return created user
        user_id = str(uuid.uuid4())
        created_user = User(
            id=user_id,
            email="newuser@example.com",
            full_name="New User",
            avatar_url=None,
            is_developer=False,
            role=UserRole.STANDARD,
            is_active=True,
            email_verified=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        user_service.get_user_by_id = AsyncMock(return_value=created_user)

        # Execute
        result = await user_service.create_user(user_data, password_hash)

        # Assert
        assert result is not None
        assert result.email == "newuser@example.com"
        assert result.full_name == "New User"
        assert result.is_developer is False
        assert result.role == UserRole.STANDARD
        mock_cursor.execute.assert_called_once()
        mock_conn.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_user_with_developer_code(self, user_service, mock_db_service):
        """Test user creation with developer code sets correct role"""
        # Setup
        user_data = UserCreate(
            email="dev@example.com",
            password="plaintext_password",
            full_name="Developer",
            developer_code="DIETINTEL_DEV_2024"
        )
        password_hash = "$2b$12$hashedpassword"

        # Mock database
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Mock get_user_by_id
        dev_user = User(
            id=str(uuid.uuid4()),
            email="dev@example.com",
            full_name="Developer",
            avatar_url=None,
            is_developer=True,
            role=UserRole.DEVELOPER,
            is_active=True,
            email_verified=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        user_service.get_user_by_id = AsyncMock(return_value=dev_user)

        # Execute
        result = await user_service.create_user(user_data, password_hash)

        # Assert
        assert result.is_developer is True
        assert result.role == UserRole.DEVELOPER
        # Verify developer role was passed to INSERT
        call_args = mock_cursor.execute.call_args
        assert 'developer' in str(call_args).lower() or UserRole.DEVELOPER.value in str(call_args)

    @pytest.mark.asyncio
    async def test_create_user_duplicate_email_raises_error(self, user_service, mock_db_service):
        """Test that duplicate email raises IntegrityError"""
        import sqlite3

        # Setup
        user_data = UserCreate(
            email="duplicate@example.com",
            password="password",
            full_name="Duplicate",
            developer_code=""
        )

        # Mock database to raise IntegrityError
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.execute.side_effect = sqlite3.IntegrityError("UNIQUE constraint failed")
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute and Assert
        with pytest.raises(sqlite3.IntegrityError):
            await user_service.create_user(user_data, "$2b$12$hash")


class TestUserRetrieval:
    """Test user lookup operations"""

    @pytest.mark.asyncio
    async def test_get_user_by_email_success(self, user_service, mock_db_service, sample_user_row):
        """Test successful user lookup by email"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = sample_user_row
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await user_service.get_user_by_email("test@example.com")

        # Assert
        assert result is not None
        assert result.email == "test@example.com"
        assert result.full_name == "Test User"
        assert result.is_developer is False
        mock_cursor.execute.assert_called_once_with(
            "SELECT * FROM users WHERE email = ?",
            ("test@example.com",)
        )

    @pytest.mark.asyncio
    async def test_get_user_by_email_not_found(self, user_service, mock_db_service):
        """Test user lookup by email returns None when not found"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await user_service.get_user_by_email("nonexistent@example.com")

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_by_id_success(self, user_service, mock_db_service, sample_user_row):
        """Test successful user lookup by ID"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = sample_user_row
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await user_service.get_user_by_id("user_123")

        # Assert
        assert result is not None
        assert result.id == "user_123"
        assert result.email == "test@example.com"
        mock_cursor.execute.assert_called_once_with(
            "SELECT * FROM users WHERE id = ?",
            ("user_123",)
        )

    @pytest.mark.asyncio
    async def test_get_user_by_id_not_found(self, user_service, mock_db_service):
        """Test user lookup by ID returns None when not found"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await user_service.get_user_by_id("nonexistent_id")

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_get_developer_user(self, user_service, mock_db_service, sample_developer_row):
        """Test retrieval of developer user with correct role"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = sample_developer_row
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await user_service.get_user_by_id("dev_456")

        # Assert
        assert result is not None
        assert result.is_developer is True
        assert result.role == UserRole.DEVELOPER
        assert result.email_verified is True


class TestPasswordManagement:
    """Test password hash retrieval for authentication"""

    @pytest.mark.asyncio
    async def test_get_password_hash_success(self, user_service, mock_db_service):
        """Test successful password hash retrieval"""
        # Setup
        expected_hash = "$2b$12$hashedpassword123"
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {'password_hash': expected_hash}
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await user_service.get_password_hash("user_123")

        # Assert
        assert result == expected_hash
        mock_cursor.execute.assert_called_once_with(
            "SELECT password_hash FROM users WHERE id = ?",
            ("user_123",)
        )

    @pytest.mark.asyncio
    async def test_get_password_hash_not_found(self, user_service, mock_db_service):
        """Test password hash returns None for non-existent user"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await user_service.get_password_hash("nonexistent_id")

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_password_never_exposed_in_user_model(self, user_service, mock_db_service, sample_user_row):
        """Test that password hash is never exposed in User model responses"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = sample_user_row
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = await user_service.get_user_by_id("user_123")

        # Assert - User model should not have password_hash attribute
        assert not hasattr(result, 'password_hash')


class TestUserUpdates:
    """Test user profile updates"""

    @pytest.mark.asyncio
    async def test_update_user_success(self, user_service, mock_db_service, sample_user_row):
        """Test successful user profile update"""
        # Setup
        updates = {'full_name': 'Updated Name', 'avatar_url': 'https://example.com/avatar.jpg'}

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Mock get_user_by_id to return updated user
        updated_row = sample_user_row.copy()
        updated_row['full_name'] = 'Updated Name'
        updated_row['avatar_url'] = 'https://example.com/avatar.jpg'

        user_service.get_user_by_id = AsyncMock(return_value=User(
            id='user_123',
            email='test@example.com',
            full_name='Updated Name',
            avatar_url='https://example.com/avatar.jpg',
            is_developer=False,
            role=UserRole.STANDARD,
            is_active=True,
            email_verified=False,
            created_at=datetime.fromisoformat(sample_user_row['created_at']),
            updated_at=datetime.utcnow()
        ))

        # Execute
        result = await user_service.update_user('user_123', updates)

        # Assert
        assert result is not None
        assert result.full_name == 'Updated Name'
        assert result.avatar_url == 'https://example.com/avatar.jpg'
        mock_cursor.execute.assert_called_once()
        call_args = mock_cursor.execute.call_args[0]
        assert "UPDATE users SET" in call_args[0]
        mock_conn.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_user_partial_fields(self, user_service, mock_db_service, sample_user_row):
        """Test that update_user only updates specified fields"""
        # Setup
        updates = {'full_name': 'New Name'}  # Only update one field

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Mock get_user_by_id
        user_service.get_user_by_id = AsyncMock(return_value=User(
            id='user_123',
            email='test@example.com',
            full_name='New Name',
            avatar_url=None,
            is_developer=False,
            role=UserRole.STANDARD,
            is_active=True,
            email_verified=False,
            created_at=datetime.fromisoformat(sample_user_row['created_at']),
            updated_at=datetime.utcnow()
        ))

        # Execute
        result = await user_service.update_user('user_123', updates)

        # Assert
        assert result is not None
        # Verify update query includes both original field and updated_at
        call_args = mock_cursor.execute.call_args[0]
        query = call_args[0]
        assert "full_name" in query
        assert "updated_at" in query

    @pytest.mark.asyncio
    async def test_update_user_empty_updates(self, user_service, mock_db_service, sample_user_row):
        """Test update_user with empty updates returns user unchanged"""
        # Setup
        expected_user = User(
            id='user_123',
            email='test@example.com',
            full_name='Test User',
            avatar_url=None,
            is_developer=False,
            role=UserRole.STANDARD,
            is_active=True,
            email_verified=False,
            created_at=datetime.fromisoformat(sample_user_row['created_at']),
            updated_at=datetime.fromisoformat(sample_user_row['updated_at'])
        )
        user_service.get_user_by_id = AsyncMock(return_value=expected_user)

        # Execute
        result = await user_service.update_user('user_123', {})

        # Assert
        assert result is not None
        assert result.email == 'test@example.com'
        # Should just call get_user_by_id without executing update query
        user_service.get_user_by_id.assert_called_once_with('user_123')

    @pytest.mark.asyncio
    async def test_update_user_not_found(self, user_service, mock_db_service):
        """Test update_user returns None if user doesn't exist"""
        # Setup
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__.return_value = mock_conn

        # Mock get_user_by_id to return None
        user_service.get_user_by_id = AsyncMock(return_value=None)

        # Execute
        result = await user_service.update_user('nonexistent_id', {'full_name': 'New'})

        # Assert
        assert result is None


class TestRowConversion:
    """Test database row to User model conversion"""

    def test_row_to_user_conversion(self, user_service, sample_user_row):
        """Test conversion of database row to User model"""
        # Execute
        result = user_service._row_to_user(sample_user_row)

        # Assert
        assert isinstance(result, User)
        assert result.id == 'user_123'
        assert result.email == 'test@example.com'
        assert result.full_name == 'Test User'
        assert result.is_developer is False
        assert result.role == UserRole.STANDARD
        assert result.is_active is True
        assert result.email_verified is False

    def test_row_to_user_developer_role(self, user_service, sample_developer_row):
        """Test row conversion with developer role"""
        # Execute
        result = user_service._row_to_user(sample_developer_row)

        # Assert
        assert result.is_developer is True
        assert result.role == UserRole.DEVELOPER
        assert result.email_verified is True

    def test_row_to_user_boolean_handling(self, user_service):
        """Test that row_to_user properly converts integer booleans"""
        # Setup - Database stores booleans as 0/1
        row = {
            'id': 'test_id',
            'email': 'test@example.com',
            'password_hash': 'hash',
            'full_name': 'Test',
            'avatar_url': None,
            'is_developer': 0,  # Integer boolean
            'role': 'standard',
            'is_active': 1,     # Integer boolean
            'email_verified': 0,  # Integer boolean
            'created_at': '2025-12-14T10:00:00',
            'updated_at': '2025-12-14T10:00:00'
        }

        # Execute
        result = user_service._row_to_user(row)

        # Assert
        assert result.is_developer is False
        assert result.is_active is True
        assert result.email_verified is False

    def test_row_to_user_datetime_parsing(self, user_service):
        """Test that row_to_user properly parses ISO format datetime strings"""
        # Setup
        row = {
            'id': 'test_id',
            'email': 'test@example.com',
            'password_hash': 'hash',
            'full_name': 'Test',
            'avatar_url': None,
            'is_developer': 0,
            'role': 'standard',
            'is_active': 1,
            'email_verified': 0,
            'created_at': '2025-12-14T10:30:45.123456',
            'updated_at': '2025-12-14T11:45:30.654321'
        }

        # Execute
        result = user_service._row_to_user(row)

        # Assert
        assert isinstance(result.created_at, datetime)
        assert isinstance(result.updated_at, datetime)
        assert result.created_at.year == 2025
        assert result.updated_at.month == 12
