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
from unittest.mock import AsyncMock
from datetime import datetime

from app.services.user_service import UserService
from app.models.user import User, UserCreate, UserRole


@pytest.fixture
def mock_user_repository():
    """Create a mock UserRepository for testing (Phase 3 Repository Pattern)"""
    repo = AsyncMock()
    # Set default return values for async methods
    repo.create = AsyncMock()
    repo.get_by_id = AsyncMock()
    repo.get_by_email = AsyncMock()
    repo.get_password_hash = AsyncMock()
    repo.update = AsyncMock()
    repo.delete = AsyncMock()
    return repo


@pytest.fixture
def user_service(mock_user_repository):
    """Create UserService with mocked UserRepository (Phase 3 Repository Pattern)"""
    return UserService(mock_user_repository)


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
    async def test_create_user_success(self, user_service, mock_user_repository):
        """Test successful user creation (Phase 3 Repository Pattern)"""
        # Setup
        user_data = UserCreate(
            email="newuser@example.com",
            password="plaintext_password",
            full_name="New User",
            developer_code=""
        )
        password_hash = "$2b$12$hashedpassword"

        # Mock repository response
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
        mock_user_repository.create.return_value = created_user

        # Execute
        result = await user_service.create_user(user_data, password_hash)

        # Assert
        assert result is not None
        assert result.email == "newuser@example.com"
        assert result.full_name == "New User"
        assert result.is_developer is False
        # Verify repository was called
        mock_user_repository.create.assert_called_once()
        assert result.role == UserRole.STANDARD

    @pytest.mark.asyncio
    async def test_create_user_with_developer_code(self, user_service, mock_user_repository):
        """Test user creation with developer code sets correct role"""
        # Setup
        user_data = UserCreate(
            email="dev@example.com",
            password="plaintext_password",
            full_name="Developer",
            developer_code="DIETINTEL_DEV_2024"
        )
        password_hash = "$2b$12$hashedpassword"

        # Mock repository response
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
        mock_user_repository.create.return_value = dev_user

        # Execute
        result = await user_service.create_user(user_data, password_hash)

        # Assert
        assert result.is_developer is True
        assert result.role == UserRole.DEVELOPER
        # Verify repository was called with correct data
        mock_user_repository.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_user_duplicate_email_raises_error(self, user_service, mock_user_repository):
        """Test that duplicate email raises IntegrityError"""
        import sqlite3

        # Setup
        user_data = UserCreate(
            email="duplicate@example.com",
            password="password",
            full_name="Duplicate",
            developer_code=""
        )

        # Mock repository to raise IntegrityError
        mock_user_repository.create.side_effect = sqlite3.IntegrityError("UNIQUE constraint failed")

        # Execute and Assert
        with pytest.raises(sqlite3.IntegrityError):
            await user_service.create_user(user_data, "$2b$12$hash")


class TestUserRetrieval:
    """Test user lookup operations"""

    @pytest.mark.asyncio
    async def test_get_user_by_email_success(self, user_service, mock_user_repository, sample_user_row):
        """Test successful user lookup by email"""
        # Setup: Create User model
        user = User(
            id=sample_user_row['id'],
            email=sample_user_row['email'],
            full_name=sample_user_row['full_name'],
            avatar_url=sample_user_row['avatar_url'],
            is_developer=bool(sample_user_row['is_developer']),
            role=UserRole.STANDARD,
            is_active=bool(sample_user_row['is_active']),
            email_verified=bool(sample_user_row['email_verified']),
            created_at=datetime.fromisoformat(sample_user_row['created_at']),
            updated_at=datetime.fromisoformat(sample_user_row['updated_at'])
        )
        mock_user_repository.get_by_email.return_value = user

        # Execute
        result = await user_service.get_user_by_email("test@example.com")

        # Assert
        assert result is not None
        assert result.email == "test@example.com"
        assert result.full_name == "Test User"
        assert result.is_developer is False
        mock_user_repository.get_by_email.assert_called_once_with("test@example.com")

    @pytest.mark.asyncio
    async def test_get_user_by_email_not_found(self, user_service, mock_user_repository):
        """Test user lookup by email returns None when not found"""
        # Setup
        mock_user_repository.get_by_email.return_value = None

        # Execute
        result = await user_service.get_user_by_email("nonexistent@example.com")

        # Assert
        assert result is None
        mock_user_repository.get_by_email.assert_called_once_with("nonexistent@example.com")

    @pytest.mark.asyncio
    async def test_get_user_by_id_success(self, user_service, mock_user_repository, sample_user_row):
        """Test successful user lookup by ID"""
        # Setup: Create User model
        user = User(
            id=sample_user_row['id'],
            email=sample_user_row['email'],
            full_name=sample_user_row['full_name'],
            avatar_url=sample_user_row['avatar_url'],
            is_developer=bool(sample_user_row['is_developer']),
            role=UserRole.STANDARD,
            is_active=bool(sample_user_row['is_active']),
            email_verified=bool(sample_user_row['email_verified']),
            created_at=datetime.fromisoformat(sample_user_row['created_at']),
            updated_at=datetime.fromisoformat(sample_user_row['updated_at'])
        )
        mock_user_repository.get_by_id.return_value = user

        # Execute
        result = await user_service.get_user_by_id("user_123")

        # Assert
        assert result is not None
        assert result.id == "user_123"
        assert result.email == "test@example.com"
        mock_user_repository.get_by_id.assert_called_once_with("user_123")

    @pytest.mark.asyncio
    async def test_get_user_by_id_not_found(self, user_service, mock_user_repository):
        """Test user lookup by ID returns None when not found"""
        # Setup
        mock_user_repository.get_by_id.return_value = None

        # Execute
        result = await user_service.get_user_by_id("nonexistent_id")

        # Assert
        assert result is None
        mock_user_repository.get_by_id.assert_called_once_with("nonexistent_id")

    @pytest.mark.asyncio
    async def test_get_developer_user(self, user_service, mock_user_repository, sample_developer_row):
        """Test retrieval of developer user with correct role"""
        # Setup: Create User model for developer
        user = User(
            id=sample_developer_row['id'],
            email=sample_developer_row['email'],
            full_name=sample_developer_row['full_name'],
            avatar_url=sample_developer_row['avatar_url'],
            is_developer=bool(sample_developer_row['is_developer']),
            role=UserRole.DEVELOPER,
            is_active=bool(sample_developer_row['is_active']),
            email_verified=bool(sample_developer_row['email_verified']),
            created_at=datetime.fromisoformat(sample_developer_row['created_at']),
            updated_at=datetime.fromisoformat(sample_developer_row['updated_at'])
        )
        mock_user_repository.get_by_id.return_value = user

        # Execute
        result = await user_service.get_user_by_id("dev_456")

        # Assert
        assert result is not None
        assert result.is_developer is True
        assert result.role == UserRole.DEVELOPER
        assert result.email_verified is True
        mock_user_repository.get_by_id.assert_called_once_with("dev_456")


class TestPasswordManagement:
    """Test password hash retrieval for authentication"""

    @pytest.mark.asyncio
    async def test_get_password_hash_success(self, user_service, mock_user_repository):
        """Test successful password hash retrieval"""
        # Setup
        expected_hash = "$2b$12$hashedpassword123"
        mock_user_repository.get_password_hash.return_value = expected_hash

        # Execute
        result = await user_service.get_password_hash("user_123")

        # Assert
        assert result == expected_hash
        mock_user_repository.get_password_hash.assert_called_once_with("user_123")

    @pytest.mark.asyncio
    async def test_get_password_hash_not_found(self, user_service, mock_user_repository):
        """Test password hash returns None for non-existent user"""
        # Setup
        mock_user_repository.get_password_hash.return_value = None

        # Execute
        result = await user_service.get_password_hash("nonexistent_id")

        # Assert
        assert result is None
        mock_user_repository.get_password_hash.assert_called_once_with("nonexistent_id")

    @pytest.mark.asyncio
    async def test_password_never_exposed_in_user_model(self, user_service, mock_user_repository, sample_user_row):
        """Test that password hash is never exposed in User model responses"""
        # Setup: Create User model
        user = User(
            id=sample_user_row['id'],
            email=sample_user_row['email'],
            full_name=sample_user_row['full_name'],
            avatar_url=sample_user_row['avatar_url'],
            is_developer=bool(sample_user_row['is_developer']),
            role=UserRole.STANDARD,
            is_active=bool(sample_user_row['is_active']),
            email_verified=bool(sample_user_row['email_verified']),
            created_at=datetime.fromisoformat(sample_user_row['created_at']),
            updated_at=datetime.fromisoformat(sample_user_row['updated_at'])
        )
        mock_user_repository.get_by_id.return_value = user

        # Execute
        result = await user_service.get_user_by_id("user_123")

        # Assert - User model should not have password_hash attribute
        assert not hasattr(result, 'password_hash')


class TestUserUpdates:
    """Test user profile updates"""

    @pytest.mark.asyncio
    async def test_update_user_success(self, user_service, mock_user_repository, sample_user_row):
        """Test successful user profile update"""
        # Setup
        updates = {'full_name': 'Updated Name', 'avatar_url': 'https://example.com/avatar.jpg'}

        updated_user = User(
            id='user_123',
            email='test@example.com',
            full_name='Updated Name',
            avatar_url='https://example.com/avatar.jpg',
            is_developer=False,
            role=UserRole.STANDARD,
            is_active=True,
            email_verified=False,
            created_at=datetime.fromisoformat(sample_user_row['created_at']),
            updated_at=datetime.now()
        )
        mock_user_repository.update.return_value = updated_user

        # Execute
        result = await user_service.update_user('user_123', updates)

        # Assert
        assert result is not None
        assert result.full_name == 'Updated Name'
        assert result.avatar_url == 'https://example.com/avatar.jpg'
        mock_user_repository.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_user_partial_fields(self, user_service, mock_user_repository, sample_user_row):
        """Test that update_user only updates specified fields"""
        # Setup
        updates = {'full_name': 'New Name'}

        updated_user = User(
            id='user_123',
            email='test@example.com',
            full_name='New Name',
            avatar_url=None,
            is_developer=False,
            role=UserRole.STANDARD,
            is_active=True,
            email_verified=False,
            created_at=datetime.fromisoformat(sample_user_row['created_at']),
            updated_at=datetime.now()
        )
        mock_user_repository.update.return_value = updated_user

        # Execute
        result = await user_service.update_user('user_123', updates)

        # Assert
        assert result is not None
        assert result.full_name == 'New Name'
        mock_user_repository.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_user_empty_updates(self, user_service, mock_user_repository, sample_user_row):
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
        mock_user_repository.get_by_id.return_value = expected_user

        # Execute
        result = await user_service.update_user('user_123', {})

        # Assert
        assert result is not None
        assert result.email == 'test@example.com'
        mock_user_repository.get_by_id.assert_called_once_with('user_123')

    @pytest.mark.asyncio
    async def test_update_user_not_found(self, user_service, mock_user_repository):
        """Test update_user returns None if user doesn't exist"""
        # Setup
        mock_user_repository.get_by_id.return_value = None
        mock_user_repository.update.return_value = None

        # Execute
        result = await user_service.update_user('nonexistent_id', {'full_name': 'New'})

        # Assert
        assert result is None


class TestRowConversion:
    """Test database row to User model conversion via Repository"""

    def test_row_to_user_conversion(self, sample_user_row):
        """Test conversion of database row to User model"""
        from app.repositories.user_repository import UserRepository
        repo = UserRepository()

        # Execute
        result = repo.row_to_entity(sample_user_row)

        # Assert
        assert isinstance(result, User)
        assert result.id == 'user_123'
        assert result.email == 'test@example.com'
        assert result.full_name == 'Test User'
        assert result.is_developer is False
        assert result.role == UserRole.STANDARD
        assert result.is_active is True
        assert result.email_verified is False

    def test_row_to_user_developer_role(self, sample_developer_row):
        """Test row conversion with developer role"""
        from app.repositories.user_repository import UserRepository
        repo = UserRepository()

        # Execute
        result = repo.row_to_entity(sample_developer_row)

        # Assert
        assert result.is_developer is True
        assert result.role == UserRole.DEVELOPER
        assert result.email_verified is True

    def test_row_to_user_boolean_handling(self):
        """Test that row_to_entity properly converts integer booleans"""
        from app.repositories.user_repository import UserRepository
        repo = UserRepository()

        # Setup - Database stores booleans as 0/1
        row = {
            'id': 'test_id',
            'email': 'test@example.com',
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
        result = repo.row_to_entity(row)

        # Assert
        assert result.is_developer is False
        assert result.is_active is True
        assert result.email_verified is False

    def test_row_to_user_datetime_parsing(self):
        """Test that row_to_entity properly parses ISO format datetime strings"""
        from app.repositories.user_repository import UserRepository
        repo = UserRepository()

        # Setup
        row = {
            'id': 'test_id',
            'email': 'test@example.com',
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
        result = repo.row_to_entity(row)

        # Assert
        assert isinstance(result.created_at, datetime)
        assert isinstance(result.updated_at, datetime)
        assert result.created_at.year == 2025
        assert result.updated_at.month == 12
