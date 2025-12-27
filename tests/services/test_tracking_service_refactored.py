"""
Test suite for TrackingService with TrackingRepository
Task 2.1.3: Refactor TrackingService to use Repository Pattern
Target Coverage: 85%+
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock, MagicMock
from uuid import uuid4
import json

from app.models.tracking import MealTrackingRequest, WeightTrackingRequest, MealItem
from app.repositories.tracking_repository import TrackingRepository, MealTrackingEntity, WeightTrackingEntity
from app.services.tracking_service import TrackingService


@pytest.fixture
def mock_tracking_repository():
    """Create mock TrackingRepository"""
    return AsyncMock(spec=TrackingRepository)


@pytest.fixture
def sample_meal_request():
    """Create sample MealTrackingRequest - Task 2.1.3"""
    return MealTrackingRequest(
        meal_name="Lunch",
        timestamp=datetime.now().isoformat(),
        items=[
            MealItem(
                barcode="123456",
                name="Chicken Breast",
                serving="150g",
                calories=250,
                macros={"protein_g": 45, "fat_g": 5, "carbs_g": 0}
            ),
            MealItem(
                barcode="789012",
                name="Brown Rice",
                serving="150g",
                calories=195,
                macros={"protein_g": 4, "fat_g": 1.5, "carbs_g": 43}
            )
        ]
    )


@pytest.fixture
def sample_weight_request():
    """Create sample WeightTrackingRequest"""
    return WeightTrackingRequest(
        weight=75.5,
        date=datetime.now().isoformat()
    )


class TestTrackingServiceWithRepository:
    """Test TrackingService using TrackingRepository"""

    @pytest.mark.asyncio
    async def test_create_meal_success(self, mock_tracking_repository, sample_meal_request):
        """Test creating a meal - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            meal_id = str(uuid4())
            created_meal = MealTrackingEntity(
                meal_id=meal_id,
                user_id="user_123",
                meal_name="Lunch",
                total_calories=445,
                items=[],
                timestamp=datetime.now().isoformat(),
                created_at=datetime.now()
            )
            mock_tracking_repository.create_meal = AsyncMock(return_value=created_meal)

            # Execute
            result_id = await service.create_meal("user_123", sample_meal_request)

            # Verify
            assert result_id == meal_id
            mock_tracking_repository.create_meal.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_meal_by_id(self, mock_tracking_repository):
        """Test retrieving meal by ID - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            meal_id = str(uuid4())
            meal = MealTrackingEntity(
                meal_id=meal_id,
                user_id="user_123",
                meal_name="Breakfast",
                total_calories=300,
                items=[],
                timestamp=datetime.now().isoformat(),
                created_at=datetime.now()
            )
            mock_tracking_repository.get_meal_by_id = AsyncMock(return_value=meal)

            # Execute
            result = await service.get_meal_by_id(meal_id)

            # Verify
            assert result is not None
            assert result["id"] == meal_id
            mock_tracking_repository.get_meal_by_id.assert_called_once_with(meal_id)

    @pytest.mark.asyncio
    async def test_get_meal_not_found(self, mock_tracking_repository):
        """Test retrieving non-existent meal returns None - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            mock_tracking_repository.get_meal_by_id = AsyncMock(return_value=None)

            # Execute
            result = await service.get_meal_by_id(str(uuid4()))

            # Verify
            assert result is None

    @pytest.mark.asyncio
    async def test_get_user_meals(self, mock_tracking_repository):
        """Test retrieving user meals - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            user_id = "user_123"
            meals = [
                MealTrackingEntity(
                    meal_id=str(uuid4()),
                    user_id=user_id,
                    meal_name="Breakfast",
                    total_calories=300,
                    items=[],
                    timestamp=datetime.now().isoformat(),
                    created_at=datetime.now()
                ),
                MealTrackingEntity(
                    meal_id=str(uuid4()),
                    user_id=user_id,
                    meal_name="Lunch",
                    total_calories=500,
                    items=[],
                    timestamp=datetime.now().isoformat(),
                    created_at=datetime.now()
                )
            ]
            mock_tracking_repository.get_user_meals = AsyncMock(return_value=meals)

            # Execute
            result = await service.get_user_meals(user_id)

            # Verify
            assert len(result) == 2
            mock_tracking_repository.get_user_meals.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_weight_entry(self, mock_tracking_repository, sample_weight_request):
        """Test creating weight entry - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            weight_id = str(uuid4())
            created_weight = WeightTrackingEntity(
                entry_id=weight_id,
                user_id="user_123",
                weight=75.5,
                date=datetime.now(),
                created_at=datetime.now()
            )
            mock_tracking_repository.create_weight_entry = AsyncMock(return_value=created_weight)

            # Execute
            result_id = await service.create_weight_entry("user_123", sample_weight_request)

            # Verify
            assert result_id == weight_id
            mock_tracking_repository.create_weight_entry.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_weight_entry_by_id(self, mock_tracking_repository):
        """Test retrieving weight entry - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            weight_id = str(uuid4())
            weight = WeightTrackingEntity(
                entry_id=weight_id,
                user_id="user_123",
                weight=75.5,
                date=datetime.now(),
                created_at=datetime.now()
            )
            mock_tracking_repository.get_weight_entry_by_id = AsyncMock(return_value=weight)

            # Execute
            result = await service.get_weight_entry_by_id(weight_id)

            # Verify
            assert result is not None
            assert result["id"] == weight_id
            mock_tracking_repository.get_weight_entry_by_id.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_weight_entry_not_found(self, mock_tracking_repository):
        """Test retrieving non-existent weight entry - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            mock_tracking_repository.get_weight_entry_by_id = AsyncMock(return_value=None)

            # Execute
            result = await service.get_weight_entry_by_id(str(uuid4()))

            # Verify
            assert result is None

    @pytest.mark.asyncio
    async def test_get_user_weight_history(self, mock_tracking_repository):
        """Test retrieving user weight history - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            user_id = "user_123"
            weights = [
                WeightTrackingEntity(
                    entry_id=str(uuid4()),
                    user_id=user_id,
                    weight=75.5,
                    date=datetime.now(),
                    created_at=datetime.now()
                ),
                WeightTrackingEntity(
                    entry_id=str(uuid4()),
                    user_id=user_id,
                    weight=74.8,
                    date=datetime.now() - timedelta(days=1),
                    created_at=datetime.now()
                )
            ]
            mock_tracking_repository.get_user_weight_history = AsyncMock(return_value=weights)

            # Execute
            result = await service.get_user_weight_history(user_id)

            # Verify
            assert len(result) == 2
            mock_tracking_repository.get_user_weight_history.assert_called_once()

    @pytest.mark.asyncio
    async def test_track_meal_full_flow(self, mock_tracking_repository, sample_meal_request):
        """Test full meal tracking flow - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            meal_id = str(uuid4())
            created_meal = MealTrackingEntity(
                meal_id=meal_id,
                user_id="user_123",
                meal_name="Lunch",
                total_calories=445,
                items=[],
                timestamp=datetime.now().isoformat(),
                created_at=datetime.now()
            )

            mock_tracking_repository.create_meal = AsyncMock(return_value=created_meal)
            mock_tracking_repository.get_meal_by_id = AsyncMock(return_value=created_meal)

            # Execute
            result = await service.track_meal("user_123", sample_meal_request)

            # Verify
            assert result is not None
            assert result["id"] == meal_id
            mock_tracking_repository.create_meal.assert_called_once()

    @pytest.mark.asyncio
    async def test_track_weight_full_flow(self, mock_tracking_repository, sample_weight_request):
        """Test full weight tracking flow - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            weight_id = str(uuid4())
            created_weight = WeightTrackingEntity(
                entry_id=weight_id,
                user_id="user_123",
                weight=75.5,
                date=datetime.now(),
                created_at=datetime.now()
            )

            mock_tracking_repository.create_weight_entry = AsyncMock(return_value=created_weight)
            mock_tracking_repository.get_weight_entry_by_id = AsyncMock(return_value=created_weight)

            # Execute
            result = await service.track_weight("user_123", sample_weight_request)

            # Verify
            assert result is not None
            assert result["id"] == weight_id
            mock_tracking_repository.create_weight_entry.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_weight_history_alias(self, mock_tracking_repository):
        """Test get_weight_history backward compatibility - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            user_id = "user_123"
            weights = [
                WeightTrackingEntity(
                    entry_id=str(uuid4()),
                    user_id=user_id,
                    weight=75.5,
                    date=datetime.now(),
                    created_at=datetime.now()
                )
            ]
            mock_tracking_repository.get_user_weight_history = AsyncMock(return_value=weights)

            # Execute
            result = await service.get_weight_history(user_id)

            # Verify
            assert len(result) == 1

    @pytest.mark.asyncio
    async def test_get_photo_logs_combined(self, mock_tracking_repository):
        """Test getting combined photo logs - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            user_id = "user_123"

            meals = [
                MealTrackingEntity(
                    meal_id="meal_1",
                    user_id=user_id,
                    meal_name="Lunch",
                    total_calories=500,
                    items=[],
                    photo_url="photo1.jpg",
                    timestamp=datetime.now().isoformat(),
                    created_at=datetime.now()
                )
            ]

            weights = [
                WeightTrackingEntity(
                    entry_id="weight_1",
                    user_id=user_id,
                    weight=75.5,
                    photo_url="photo2.jpg",
                    date=datetime.now(),
                    created_at=datetime.now()
                )
            ]

            mock_tracking_repository.get_user_meals = AsyncMock(return_value=meals)
            mock_tracking_repository.get_user_weight_history = AsyncMock(return_value=weights)

            # Execute
            result = await service.get_photo_logs(user_id)

            # Verify - should have entries from both meals and weights
            assert len(result) == 2
            types = [entry["type"] for entry in result]
            assert "meal" in types
            assert "weigh-in" in types

    @pytest.mark.asyncio
    async def test_get_photo_logs_empty(self, mock_tracking_repository):
        """Test getting photo logs when none exist - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            user_id = "user_456"

            mock_tracking_repository.get_user_meals = AsyncMock(return_value=[])
            mock_tracking_repository.get_user_weight_history = AsyncMock(return_value=[])

            # Execute
            result = await service.get_photo_logs(user_id)

            # Verify
            assert len(result) == 0

    @pytest.mark.asyncio
    async def test_get_user_meals_empty(self, mock_tracking_repository):
        """Test retrieving meals when none exist - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            user_id = "user_456"
            mock_tracking_repository.get_user_meals = AsyncMock(return_value=[])

            # Execute
            result = await service.get_user_meals(user_id)

            # Verify
            assert len(result) == 0

    @pytest.mark.asyncio
    async def test_get_user_weight_history_empty(self, mock_tracking_repository):
        """Test retrieving weight history when none exist - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            user_id = "user_456"
            mock_tracking_repository.get_user_weight_history = AsyncMock(return_value=[])

            # Execute
            result = await service.get_user_weight_history(user_id)

            # Verify
            assert len(result) == 0

    @pytest.mark.asyncio
    async def test_create_meal_error_handling(self, mock_tracking_repository, sample_meal_request):
        """Test meal creation error handling - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            mock_tracking_repository.create_meal = AsyncMock(side_effect=Exception("DB error"))

            # Execute & Verify
            with pytest.raises(RuntimeError):
                await service.create_meal("user_123", sample_meal_request)

    @pytest.mark.asyncio
    async def test_create_weight_error_handling(self, mock_tracking_repository, sample_weight_request):
        """Test weight creation error handling - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            mock_tracking_repository.create_weight_entry = AsyncMock(side_effect=Exception("DB error"))

            # Execute & Verify
            with pytest.raises(RuntimeError):
                await service.create_weight_entry("user_123", sample_weight_request)

    @pytest.mark.asyncio
    async def test_track_meal_not_found_error(self, mock_tracking_repository, sample_meal_request):
        """Test track_meal when created meal not found - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            meal_id = str(uuid4())
            created_meal = MealTrackingEntity(
                meal_id=meal_id,
                user_id="user_123",
                meal_name="Lunch",
                total_calories=445,
                items=[],
                timestamp=datetime.now().isoformat(),
                created_at=datetime.now()
            )

            mock_tracking_repository.create_meal = AsyncMock(return_value=created_meal)
            mock_tracking_repository.get_meal_by_id = AsyncMock(return_value=None)

            # Execute & Verify
            with pytest.raises(RuntimeError, match="Failed to retrieve persisted meal"):
                await service.track_meal("user_123", sample_meal_request)

    @pytest.mark.asyncio
    async def test_track_weight_not_found_error(self, mock_tracking_repository, sample_weight_request):
        """Test track_weight when created weight not found - Task 2.1.3"""
        with patch('app.services.tracking_service.TrackingRepository', return_value=mock_tracking_repository):
            service = TrackingService(mock_tracking_repository)

            weight_id = str(uuid4())
            created_weight = WeightTrackingEntity(
                entry_id=weight_id,
                user_id="user_123",
                weight=75.5,
                date=datetime.now(),
                created_at=datetime.now()
            )

            mock_tracking_repository.create_weight_entry = AsyncMock(return_value=created_weight)
            mock_tracking_repository.get_weight_entry_by_id = AsyncMock(return_value=None)

            # Execute & Verify
            with pytest.raises(RuntimeError, match="Failed to retrieve persisted weight"):
                await service.track_weight("user_123", sample_weight_request)
