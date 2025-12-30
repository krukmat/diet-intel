"""
Shopping Table Service Coverage Tests - Phase 1
Task 1.3: Improve coverage from 61% to 80%

Tests for ShoppingTableService CRUD operations
"""

import pytest
import json
from unittest.mock import patch, MagicMock
from app.services.recipes.shopping_table_service import ShoppingTableService


@pytest.fixture
def shopping_service():
    """Create ShoppingTableService with mocked DB"""
    with patch('app.services.recipes.shopping_table_service.DatabaseService'):
        return ShoppingTableService()


@pytest.fixture
def mock_db_service():
    """Mock database service"""
    mock_db = MagicMock()
    mock_conn = MagicMock()
    mock_cursor = MagicMock()

    mock_db.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_db.get_connection.return_value.__exit__ = MagicMock(return_value=None)
    mock_conn.cursor.return_value = mock_cursor

    return mock_db, mock_conn, mock_cursor


# ==================== Initialization Tests ====================

@patch('app.services.recipes.shopping_table_service.DatabaseService')
def test_shopping_service_init(mock_db_class):
    """Test ShoppingTableService initialization"""
    service = ShoppingTableService()
    assert service is not None
    assert service.db_service is not None


def test_shopping_service_init_with_custom_db(mock_db_service):
    """Test ShoppingTableService init with custom DB"""
    mock_db, _, _ = mock_db_service
    service = ShoppingTableService(db_service=mock_db)
    assert service.db_service == mock_db


# ==================== Table Initialization Tests ====================

def test_init_shopping_tables_sync(shopping_service, mock_db_service):
    """Test synchronous table initialization"""
    mock_db, mock_conn, mock_cursor = mock_db_service
    shopping_service.db_service = mock_db

    shopping_service.init_shopping_optimization_tables_sync()

    # Verify CREATE TABLE statements were executed
    assert mock_cursor.execute.call_count >= 5  # 5 tables created


@pytest.mark.asyncio
async def test_init_shopping_tables_async(shopping_service, mock_db_service):
    """Test asynchronous table initialization"""
    mock_db, mock_conn, mock_cursor = mock_db_service
    shopping_service.db_service = mock_db

    await shopping_service.init_shopping_optimization_tables()

    # Verify it delegated to sync method
    assert mock_cursor.execute.call_count >= 5


# ==================== Create Shopping Optimization Tests ====================

@pytest.mark.asyncio
async def test_create_shopping_optimization(shopping_service, mock_db_service):
    """Test creating shopping optimization"""
    mock_db, mock_conn, mock_cursor = mock_db_service
    shopping_service.db_service = mock_db

    optimization_data = {'items': ['item1', 'item2'], 'total': 50.0}
    user_id = 'user123'

    optimization_id = await shopping_service.create_shopping_optimization(
        optimization_data, user_id
    )

    assert optimization_id is not None
    assert isinstance(optimization_id, str)
    assert len(optimization_id) > 0
    assert mock_conn.commit.called


@pytest.mark.asyncio
async def test_create_shopping_optimization_db_error(shopping_service, mock_db_service):
    """Test create_shopping_optimization handles database errors"""
    mock_db, _, _ = mock_db_service
    mock_db.get_connection.return_value.__enter__ = MagicMock(
        side_effect=Exception("DB Error")
    )
    shopping_service.db_service = mock_db

    with pytest.raises(RuntimeError):
        await shopping_service.create_shopping_optimization({}, 'user123')


# ==================== Get Shopping Optimization Tests ====================

@pytest.mark.asyncio
async def test_get_shopping_optimization_found(shopping_service, mock_db_service):
    """Test retrieving existing optimization"""
    mock_db, mock_conn, mock_cursor = mock_db_service
    shopping_service.db_service = mock_db

    # Mock database response
    mock_row = {
        'id': 'opt123',
        'user_id': 'user123',
        'status': 'completed',
        'optimization_data': json.dumps({'items': ['item1']}),
        'total_cost': 100.0
    }
    mock_cursor.fetchone.return_value = mock_row

    result = await shopping_service.get_shopping_optimization('opt123', 'user123')

    assert result is not None
    assert result['id'] == 'opt123'
    assert result['status'] == 'completed'


@pytest.mark.asyncio
async def test_get_shopping_optimization_not_found(shopping_service, mock_db_service):
    """Test retrieving non-existent optimization"""
    mock_db, mock_conn, mock_cursor = mock_db_service
    shopping_service.db_service = mock_db
    mock_cursor.fetchone.return_value = None

    result = await shopping_service.get_shopping_optimization('nonexistent', 'user123')

    assert result is None


@pytest.mark.asyncio
async def test_get_shopping_optimization_db_error(shopping_service, mock_db_service):
    """Test get handles database errors"""
    mock_db, _, _ = mock_db_service
    mock_db.get_connection.return_value.__enter__ = MagicMock(
        side_effect=Exception("DB Error")
    )
    shopping_service.db_service = mock_db

    result = await shopping_service.get_shopping_optimization('opt123')

    assert result is None


# ==================== Get User Optimizations Tests ====================

@pytest.mark.asyncio
async def test_get_user_shopping_optimizations_empty(shopping_service, mock_db_service):
    """Test getting user optimizations when none exist"""
    mock_db, mock_conn, mock_cursor = mock_db_service
    shopping_service.db_service = mock_db
    mock_cursor.fetchall.return_value = []

    result = await shopping_service.get_user_shopping_optimizations('user123')

    assert result == []


@pytest.mark.asyncio
async def test_get_user_shopping_optimizations_with_status(shopping_service, mock_db_service):
    """Test getting user optimizations filtered by status"""
    mock_db, mock_conn, mock_cursor = mock_db_service
    shopping_service.db_service = mock_db

    mock_row = {
        'id': 'opt1',
        'user_id': 'user123',
        'status': 'pending',
        'optimization_data': None
    }
    mock_cursor.fetchall.return_value = [mock_row]

    result = await shopping_service.get_user_shopping_optimizations(
        'user123', status='pending', limit=10
    )

    assert len(result) == 1
    assert result[0]['status'] == 'pending'


@pytest.mark.asyncio
async def test_get_user_shopping_optimizations_db_error(shopping_service, mock_db_service):
    """Test get_user_shopping_optimizations handles errors"""
    mock_db, _, _ = mock_db_service
    mock_db.get_connection.return_value.__enter__ = MagicMock(
        side_effect=Exception("DB Error")
    )
    shopping_service.db_service = mock_db

    result = await shopping_service.get_user_shopping_optimizations('user123')

    assert result == []


# ==================== Update Status Tests ====================

@pytest.mark.asyncio
async def test_update_shopping_optimization_status_success(shopping_service, mock_db_service):
    """Test updating optimization status"""
    mock_db, mock_conn, mock_cursor = mock_db_service
    shopping_service.db_service = mock_db
    mock_cursor.rowcount = 1  # One row updated

    result = await shopping_service.update_shopping_optimization_status(
        'opt123', 'completed'
    )

    assert result is True
    assert mock_conn.commit.called


@pytest.mark.asyncio
async def test_update_shopping_optimization_status_not_found(shopping_service, mock_db_service):
    """Test updating non-existent optimization"""
    mock_db, mock_conn, mock_cursor = mock_db_service
    shopping_service.db_service = mock_db
    mock_cursor.rowcount = 0  # No rows updated

    result = await shopping_service.update_shopping_optimization_status(
        'nonexistent', 'completed'
    )

    assert result is False


@pytest.mark.asyncio
async def test_update_shopping_optimization_status_with_user(shopping_service, mock_db_service):
    """Test updating optimization status with user ID validation"""
    mock_db, mock_conn, mock_cursor = mock_db_service
    shopping_service.db_service = mock_db
    mock_cursor.rowcount = 1

    result = await shopping_service.update_shopping_optimization_status(
        'opt123', 'completed', user_id='user123'
    )

    assert result is True
    # Verify query was called with user_id parameter
    assert mock_cursor.execute.called


@pytest.mark.asyncio
async def test_update_shopping_optimization_status_db_error(shopping_service, mock_db_service):
    """Test update handles database errors"""
    mock_db, _, _ = mock_db_service
    mock_db.get_connection.return_value.__enter__ = MagicMock(
        side_effect=Exception("DB Error")
    )
    shopping_service.db_service = mock_db

    result = await shopping_service.update_shopping_optimization_status('opt123', 'completed')

    assert result is False


# ==================== Ingredient Consolidation Tests ====================

@pytest.mark.asyncio
async def test_create_ingredient_consolidation(shopping_service, mock_db_service):
    """Test creating ingredient consolidation"""
    mock_db, mock_conn, mock_cursor = mock_db_service
    shopping_service.db_service = mock_db

    consolidation_data = {'consolidated': True, 'items': 5}
    consolidation_id = await shopping_service.create_ingredient_consolidation(
        'opt123', consolidation_data
    )

    assert consolidation_id is not None
    assert isinstance(consolidation_id, str)


@pytest.mark.asyncio
async def test_get_ingredient_consolidations(shopping_service, mock_db_service):
    """Test getting ingredient consolidations"""
    mock_db, mock_conn, mock_cursor = mock_db_service
    shopping_service.db_service = mock_db

    mock_row = {
        'id': 'cons1',
        'optimization_id': 'opt123',
        'consolidation_data': json.dumps({'items': 5})
    }
    mock_cursor.fetchall.return_value = [mock_row]

    result = await shopping_service.get_ingredient_consolidations('opt123')

    assert len(result) == 1
    assert result[0]['id'] == 'cons1'


# ==================== Shopping Path Tests ====================

@pytest.mark.asyncio
async def test_create_shopping_path_segment(shopping_service, mock_db_service):
    """Test creating shopping path segment"""
    mock_db, mock_conn, mock_cursor = mock_db_service
    shopping_service.db_service = mock_db

    segment_data = {'store': 'Store A', 'items': ['item1', 'item2']}
    segment_id = await shopping_service.create_shopping_path_segment(
        'opt123', segment_data
    )

    assert segment_id is not None
    assert isinstance(segment_id, str)


@pytest.mark.asyncio
async def test_get_shopping_path_segments(shopping_service, mock_db_service):
    """Test getting shopping path segments"""
    mock_db, mock_conn, mock_cursor = mock_db_service
    shopping_service.db_service = mock_db

    mock_row = {
        'id': 'seg1',
        'optimization_id': 'opt123',
        'segment_data': json.dumps({'store': 'Store A'})
    }
    mock_cursor.fetchall.return_value = [mock_row]

    result = await shopping_service.get_shopping_path_segments('opt123')

    assert len(result) == 1
    assert 'segment_data' in result[0]


