"""Test suite for TrackingService

Task: Phase 2 Batch 8 - Tracking Service Extraction
Target Coverage: 85%+
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock, patch
from uuid import uuid4
import json

from app.services.tracking_service import TrackingService
from app.services.database import DatabaseService
from app.models.tracking import MealTrackingRequest, WeightTrackingRequest, MealItem


class TestMealTracking:
    """Test meal tracking operations"""

    @pytest.fixture
    def mock_db_service(self):
        """Create mock database service"""
        mock = MagicMock(spec=DatabaseService)
        mock.get_connection = MagicMock()
        return mock

    @pytest.fixture
    def tracking_service(self, mock_db_service):
        """Create tracking service with mocked database"""
        return TrackingService(mock_db_service)

    def _mock_row(self, data: dict):
        """Helper to create mock sqlite3.Row-like object"""
        row = MagicMock()
        for key, value in data.items():
            row.__getitem__.side_effect = lambda k, d=data: d.get(k)
            row.get = lambda k, default=None, d=data: d.get(k, default)
        # Make it dict-like
        row.__getitem__ = lambda self, k: data[k]
        return row

    @pytest.mark.asyncio
    async def test_create_meal_success(self, tracking_service, mock_db_service):
        """Test successful meal creation"""
        user_id = "user_123"
        meal_name = "Breakfast"

        item = MealItem(
            barcode="123456", name="Apple", serving="1", calories=95,
            macros={"protein": 0.5, "carbs": 25, "fat": 0.3}
        )
        meal_data = MealTrackingRequest(
            meal_name=meal_name,
            items=[item],
            timestamp=datetime.now().isoformat()
        )

        # Mock database connection
        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=None)
        mock_db_service.get_connection.return_value = mock_conn

        # Execute
        meal_id = await tracking_service.create_meal(user_id, meal_data, photo_url=None)

        # Verify
        assert meal_id is not None
        assert len(meal_id) > 0
        mock_conn.commit.assert_called()
        assert mock_cursor.execute.call_count >= 2  # meal + items

    @pytest.mark.asyncio
    async def test_create_meal_with_multiple_items(self, tracking_service, mock_db_service):
        """Test meal creation with multiple items"""
        user_id = "user_123"

        items = [
            MealItem(barcode="111", name="Apple", serving="1", calories=95,
                    macros={"protein": 0.5, "carbs": 25, "fat": 0.3}),
            MealItem(barcode="222", name="Banana", serving="1", calories=105,
                    macros={"protein": 1.3, "carbs": 27, "fat": 0.3})
        ]
        meal_data = MealTrackingRequest(
            meal_name="Fruit Salad",
            items=items,
            timestamp=datetime.now().isoformat()
        )

        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=None)
        mock_db_service.get_connection.return_value = mock_conn

        meal_id = await tracking_service.create_meal(user_id, meal_data)

        assert meal_id is not None
        # Should call execute for meal + 2 items
        assert mock_cursor.execute.call_count >= 3

    @pytest.mark.asyncio
    async def test_create_meal_with_zero_items(self, tracking_service, mock_db_service):
        """Test meal creation with no items (edge case)"""
        user_id = "user_123"
        meal_data = MealTrackingRequest(
            meal_name="Empty Meal",
            items=[],
            timestamp=datetime.now().isoformat()
        )

        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=None)
        mock_db_service.get_connection.return_value = mock_conn

        meal_id = await tracking_service.create_meal(user_id, meal_data)

        assert meal_id is not None
        # Should at least insert meal record
        assert mock_cursor.execute.call_count >= 1

    @pytest.mark.asyncio
    async def test_get_meal_by_id_success(self, tracking_service, mock_db_service):
        """Test successful meal retrieval"""
        meal_id = "meal_123"
        timestamp = datetime.now()

        meal_row = self._mock_row({
            "id": meal_id,
            "user_id": "user_123",
            "meal_name": "Breakfast",
            "total_calories": 500,
            "photo_url": "http://example.com/meal.jpg",
            "timestamp": timestamp.isoformat(),
            "created_at": timestamp.isoformat()
        })

        item_row = self._mock_row({
            "barcode": "123",
            "name": "Oatmeal",
            "serving": "1 cup",
            "calories": 150,
            "macros": json.dumps({"protein": 5, "carbs": 27, "fat": 3})
        })

        mock_cursor = MagicMock()
        mock_cursor.fetchone.side_effect = [meal_row, None]  # meal found, items query next
        mock_cursor.fetchall.return_value = [item_row]

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=None)
        mock_db_service.get_connection.return_value = mock_conn

        result = await tracking_service.get_meal_by_id(meal_id)

        assert result is not None
        assert result["id"] == meal_id
        assert result["meal_name"] == "Breakfast"
        assert len(result["items"]) == 1

    @pytest.mark.asyncio
    async def test_get_meal_by_id_not_found(self, tracking_service, mock_db_service):
        """Test meal retrieval when meal doesn't exist"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=None)
        mock_db_service.get_connection.return_value = mock_conn

        result = await tracking_service.get_meal_by_id("nonexistent_meal")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_meals(self, tracking_service, mock_db_service):
        """Test user meal history retrieval"""
        user_id = "user_123"
        timestamp = datetime.now()

        meal_row = self._mock_row({
            "id": "meal_1",
            "user_id": user_id,
            "meal_name": "Breakfast",
            "total_calories": 400,
            "photo_url": None,
            "timestamp": timestamp.isoformat(),
            "created_at": timestamp.isoformat()
        })

        item_row = self._mock_row({
            "barcode": "123",
            "name": "Toast",
            "serving": "2 slices",
            "calories": 160,
            "macros": json.dumps({"protein": 6, "carbs": 30, "fat": 1})
        })

        mock_cursor = MagicMock()
        mock_cursor.fetchall.side_effect = [[meal_row], [item_row]]

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=None)
        mock_db_service.get_connection.return_value = mock_conn

        result = await tracking_service.get_user_meals(user_id, limit=10)

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["meal_name"] == "Breakfast"

    @pytest.mark.asyncio
    async def test_track_meal_full_flow(self, tracking_service, mock_db_service):
        """Test track_meal wrapper (create + retrieve)"""
        user_id = "user_123"
        timestamp = datetime.now()

        meal_data = MealTrackingRequest(
            meal_name="Lunch",
            items=[MealItem(barcode="456", name="Sandwich", serving="1", calories=350,
                           macros={"protein": 15, "carbs": 40, "fat": 10})],
            timestamp=timestamp.isoformat()
        )

        meal_row = self._mock_row({
            "id": "meal_new",
            "user_id": user_id,
            "meal_name": "Lunch",
            "total_calories": 350,
            "photo_url": None,
            "timestamp": timestamp.isoformat(),
            "created_at": timestamp.isoformat()
        })

        item_row = self._mock_row({
            "barcode": "456",
            "name": "Sandwich",
            "serving": "1",
            "calories": 350,
            "macros": json.dumps({"protein": 15, "carbs": 40, "fat": 10})
        })

        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = meal_row
        mock_cursor.fetchall.return_value = [item_row]

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=None)
        mock_db_service.get_connection.return_value = mock_conn

        result = await tracking_service.track_meal(user_id, meal_data)

        assert result is not None
        assert result["meal_name"] == "Lunch"
        assert "items" in result


class TestWeightTracking:
    """Test weight tracking operations"""

    @pytest.fixture
    def mock_db_service(self):
        """Create mock database service"""
        mock = MagicMock(spec=DatabaseService)
        mock.get_connection = MagicMock()
        return mock

    @pytest.fixture
    def tracking_service(self, mock_db_service):
        """Create tracking service with mocked database"""
        return TrackingService(mock_db_service)

    def _mock_row(self, data: dict):
        """Helper to create mock sqlite3.Row-like object"""
        row = MagicMock()
        row.__getitem__ = lambda self, k: data[k]
        return row

    @pytest.mark.asyncio
    async def test_create_weight_entry_success(self, tracking_service, mock_db_service):
        """Test successful weight entry creation"""
        user_id = "user_123"
        weight_data = WeightTrackingRequest(
            weight=75.5,
            date=datetime.now().isoformat()
        )

        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=None)
        mock_db_service.get_connection.return_value = mock_conn

        weight_id = await tracking_service.create_weight_entry(user_id, weight_data)

        assert weight_id is not None
        assert len(weight_id) > 0
        mock_cursor.execute.assert_called()
        mock_conn.commit.assert_called()

    @pytest.mark.asyncio
    async def test_create_weight_entry_with_photo(self, tracking_service, mock_db_service):
        """Test weight entry creation with photo URL"""
        user_id = "user_123"
        weight_data = WeightTrackingRequest(
            weight=74.0,
            date=datetime.now().isoformat()
        )

        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=None)
        mock_db_service.get_connection.return_value = mock_conn

        weight_id = await tracking_service.create_weight_entry(
            user_id, weight_data, photo_url="http://example.com/weight.jpg"
        )

        assert weight_id is not None
        mock_cursor.execute.assert_called()

    @pytest.mark.asyncio
    async def test_get_weight_entry_by_id_success(self, tracking_service, mock_db_service):
        """Test successful weight entry retrieval"""
        weight_id = "weight_123"
        timestamp = datetime.now()

        weight_row = self._mock_row({
            "id": weight_id,
            "user_id": "user_123",
            "weight": 75.5,
            "date": timestamp.isoformat(),
            "photo_url": "http://example.com/photo.jpg",
            "created_at": timestamp.isoformat()
        })

        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = weight_row

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=None)
        mock_db_service.get_connection.return_value = mock_conn

        result = await tracking_service.get_weight_entry_by_id(weight_id)

        assert result is not None
        assert result["id"] == weight_id
        assert result["weight"] == 75.5

    @pytest.mark.asyncio
    async def test_get_weight_entry_not_found(self, tracking_service, mock_db_service):
        """Test weight entry retrieval when entry doesn't exist"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=None)
        mock_db_service.get_connection.return_value = mock_conn

        result = await tracking_service.get_weight_entry_by_id("nonexistent_weight")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_weight_history(self, tracking_service, mock_db_service):
        """Test user weight history retrieval"""
        user_id = "user_123"
        timestamp = datetime.now()

        weight_row = self._mock_row({
            "id": "weight_1",
            "user_id": user_id,
            "weight": 75.5,
            "date": timestamp.isoformat(),
            "photo_url": None,
            "created_at": timestamp.isoformat()
        })

        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [weight_row]

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=None)
        mock_db_service.get_connection.return_value = mock_conn

        result = await tracking_service.get_user_weight_history(user_id, limit=30)

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["weight"] == 75.5

    @pytest.mark.asyncio
    async def test_track_weight_full_flow(self, tracking_service, mock_db_service):
        """Test track_weight wrapper (create + retrieve)"""
        user_id = "user_123"
        timestamp = datetime.now()

        weight_data = WeightTrackingRequest(
            weight=73.0,
            date=timestamp.isoformat()
        )

        weight_row = self._mock_row({
            "id": "weight_new",
            "user_id": user_id,
            "weight": 73.0,
            "date": timestamp.isoformat(),
            "photo_url": None,
            "created_at": timestamp.isoformat()
        })

        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = weight_row

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=None)
        mock_db_service.get_connection.return_value = mock_conn

        result = await tracking_service.track_weight(user_id, weight_data)

        assert result is not None
        assert result["weight"] == 73.0

    @pytest.mark.asyncio
    async def test_get_weight_history_alias(self, tracking_service, mock_db_service):
        """Test get_weight_history alias method"""
        user_id = "user_123"
        timestamp = datetime.now()

        weight_row = self._mock_row({
            "id": "weight_1",
            "weight": 75.5,
            "date": timestamp.isoformat(),
            "photo_url": None,
            "created_at": timestamp.isoformat()
        })

        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [weight_row]

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=None)
        mock_db_service.get_connection.return_value = mock_conn

        result = await tracking_service.get_weight_history(user_id)

        assert isinstance(result, list)
        assert len(result) == 1


class TestPhotoLogs:
    """Test photo logs operations"""

    @pytest.fixture
    def mock_db_service(self):
        """Create mock database service"""
        mock = MagicMock(spec=DatabaseService)
        mock.get_connection = MagicMock()
        return mock

    @pytest.fixture
    def tracking_service(self, mock_db_service):
        """Create tracking service with mocked database"""
        return TrackingService(mock_db_service)

    def _mock_row(self, data: dict):
        """Helper to create mock sqlite3.Row-like object"""
        row = {}
        row.update(data)
        mock_row = MagicMock()
        mock_row.__getitem__ = lambda self, k: row[k]
        mock_row.get = lambda k, default=None: row.get(k, default)
        return mock_row

    @pytest.mark.asyncio
    async def test_get_photo_logs_meals_only(self, tracking_service):
        """Test photo logs with only meals"""
        user_id = "user_123"
        timestamp = datetime.now()

        # Mock the get_user_meals and get_user_weight_history methods directly
        async def mock_get_meals(uid, limit):
            return [{
                "id": "meal_1",
                "meal_name": "Breakfast",
                "total_calories": 400,
                "photo_url": "http://example.com/meal.jpg",
                "created_at": timestamp
            }]

        async def mock_get_weights(uid, limit):
            return []

        with patch.object(tracking_service, 'get_user_meals', side_effect=mock_get_meals):
            with patch.object(tracking_service, 'get_user_weight_history', side_effect=mock_get_weights):
                result = await tracking_service.get_photo_logs(user_id)

                assert isinstance(result, list)
                assert any(log["type"] == "meal" for log in result)

    @pytest.mark.asyncio
    async def test_get_photo_logs_weights_only(self, tracking_service):
        """Test photo logs with only weights"""
        user_id = "user_123"
        timestamp = datetime.now()

        # Mock the get_user_meals and get_user_weight_history methods directly
        async def mock_get_meals(uid, limit):
            return []

        async def mock_get_weights(uid, limit):
            return [{
                "id": "weight_1",
                "weight": 75.5,
                "photo_url": "http://example.com/weight.jpg",
                "created_at": timestamp
            }]

        with patch.object(tracking_service, 'get_user_meals', side_effect=mock_get_meals):
            with patch.object(tracking_service, 'get_user_weight_history', side_effect=mock_get_weights):
                result = await tracking_service.get_photo_logs(user_id)

                assert isinstance(result, list)
                assert any(log["type"] == "weigh-in" for log in result)

    @pytest.mark.asyncio
    async def test_get_photo_logs_merged_sorted(self, tracking_service):
        """Test photo logs merged and sorted by timestamp"""
        user_id = "user_123"
        base_time = datetime.now()
        meal_time = base_time
        weight_time = base_time + timedelta(hours=2)

        # Mock the get_user_meals and get_user_weight_history methods directly
        async def mock_get_meals(uid, limit):
            return [{
                "id": "meal_1",
                "meal_name": "Breakfast",
                "total_calories": 400,
                "photo_url": "http://example.com/meal.jpg",
                "created_at": meal_time
            }]

        async def mock_get_weights(uid, limit):
            return [{
                "id": "weight_1",
                "weight": 75.5,
                "photo_url": "http://example.com/weight.jpg",
                "created_at": weight_time
            }]

        with patch.object(tracking_service, 'get_user_meals', side_effect=mock_get_meals):
            with patch.object(tracking_service, 'get_user_weight_history', side_effect=mock_get_weights):
                result = await tracking_service.get_photo_logs(user_id)

                assert len(result) == 2
                # Most recent first (sorted reverse=True)
                assert result[0]["type"] == "weigh-in"
                assert result[1]["type"] == "meal"
