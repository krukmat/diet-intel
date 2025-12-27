"""
Test suite for TrackingRepository
Task 2.1.1.1: Repository tests for meal and weight tracking CRUD operations
Target Coverage: 100% of TrackingRepository methods
"""
import pytest
from datetime import datetime
from unittest.mock import patch
from uuid import uuid4
from app.repositories.tracking_repository import (
    TrackingRepository,
    MealTrackingEntity,
    WeightTrackingEntity
)


class TestMealTracking:
    """Test meal tracking operations"""

    @pytest.fixture
    def tracking_repo(self, mock_connection_manager):
        """Create repository with mocked connection manager"""
        with patch('app.repositories.tracking_repository.connection_manager', mock_connection_manager):
            repo = TrackingRepository()
            return repo, mock_connection_manager

    @pytest.mark.asyncio
    async def test_create_meal(self, tracking_repo):
        """Test creating a meal with items - Task 2.1.1.1"""
        repo, conn_mgr = tracking_repo

        meal = MealTrackingEntity(
            meal_id=str(uuid4()),
            user_id="user_456",
            meal_name="Breakfast",
            total_calories=500.0,
            items=[
                {
                    "id": str(uuid4()),
                    "barcode": "123456",
                    "name": "Apple",
                    "serving": "1 medium",
                    "calories": 95.0,
                    "macros": {"protein": 0.5, "carbs": 25, "fat": 0.3}
                }
            ]
        )

        created = await repo.create_meal(meal)

        assert created is not None
        assert created.meal_name == "Breakfast"
        assert len(created.items) == 1

    @pytest.mark.asyncio
    async def test_get_meal_by_id(self, tracking_repo):
        """Test retrieving meal by ID - Task 2.1.1.1"""
        repo, conn_mgr = tracking_repo

        meal_id = str(uuid4())
        meal = MealTrackingEntity(
            meal_id=meal_id,
            user_id="user_123",
            meal_name="Lunch",
            total_calories=600.0,
            items=[{
                "id": str(uuid4()),
                "barcode": "555555",
                "name": "Chicken",
                "serving": "100g",
                "calories": 300.0,
                "macros": {}
            }]
        )
        await repo.create_meal(meal)

        retrieved = await repo.get_meal_by_id(meal_id)

        assert retrieved is not None
        assert retrieved.meal_name == "Lunch"
        assert len(retrieved.items) == 1

    @pytest.mark.asyncio
    async def test_get_non_existent_meal(self, tracking_repo):
        """Test retrieving non-existent meal returns None - Task 2.1.1.1"""
        repo, conn_mgr = tracking_repo

        result = await repo.get_meal_by_id(str(uuid4()))

        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_meals(self, tracking_repo):
        """Test retrieving all meals for a user - Task 2.1.1.1"""
        repo, conn_mgr = tracking_repo

        user_id = str(uuid4())

        for i in range(2):
            meal = MealTrackingEntity(
                meal_id=str(uuid4()),
                user_id=user_id,
                meal_name=f"Meal {i}",
                total_calories=500.0 + (i * 100),
                items=[]
            )
            await repo.create_meal(meal)

        meals = await repo.get_user_meals(user_id, limit=10, offset=0)

        assert len(meals) == 2
        assert all(m.user_id == user_id for m in meals)

    @pytest.mark.asyncio
    async def test_delete_meal(self, tracking_repo):
        """Test deleting a meal - Task 2.1.1.1"""
        repo, conn_mgr = tracking_repo

        meal_id = str(uuid4())
        meal = MealTrackingEntity(
            meal_id=meal_id,
            user_id="user_delete",
            meal_name="To Delete",
            total_calories=400.0,
            items=[]
        )
        await repo.create_meal(meal)

        result = await repo.delete_meal(meal_id)

        assert result is True

        retrieved = await repo.get_meal_by_id(meal_id)
        assert retrieved is None

    @pytest.mark.asyncio
    async def test_count_user_meals(self, tracking_repo):
        """Test counting user's meals - Task 2.1.1.1"""
        repo, conn_mgr = tracking_repo

        user_id = str(uuid4())

        for i in range(2):
            meal = MealTrackingEntity(
                meal_id=str(uuid4()),
                user_id=user_id,
                meal_name=f"Meal {i}",
                total_calories=500.0,
                items=[]
            )
            await repo.create_meal(meal)

        count = await repo.count_user_meals(user_id)

        assert count == 2


class TestWeightTracking:
    """Test weight tracking operations"""

    @pytest.fixture
    def tracking_repo(self, mock_connection_manager):
        """Create repository with mocked connection manager"""
        with patch('app.repositories.tracking_repository.connection_manager', mock_connection_manager):
            repo = TrackingRepository()
            return repo, mock_connection_manager

    @pytest.mark.asyncio
    async def test_create_weight_entry(self, tracking_repo):
        """Test creating a weight entry - Task 2.1.1.1"""
        repo, conn_mgr = tracking_repo

        entry = WeightTrackingEntity(
            entry_id=str(uuid4()),
            user_id="user_weight",
            weight=75.5,
            date=datetime(2025, 1, 15)
        )

        created = await repo.create_weight_entry(entry)

        assert created is not None
        assert created.weight == 75.5
        assert created.user_id == "user_weight"

    @pytest.mark.asyncio
    async def test_get_weight_entry_by_id(self, tracking_repo):
        """Test retrieving weight entry by ID - Task 2.1.1.1"""
        repo, conn_mgr = tracking_repo

        entry_id = str(uuid4())
        entry = WeightTrackingEntity(
            entry_id=entry_id,
            user_id="user_123",
            weight=72.0,
            date=datetime(2025, 1, 20)
        )
        await repo.create_weight_entry(entry)

        retrieved = await repo.get_weight_entry_by_id(entry_id)

        assert retrieved is not None
        assert retrieved.weight == 72.0

    @pytest.mark.asyncio
    async def test_get_non_existent_weight_entry(self, tracking_repo):
        """Test retrieving non-existent weight entry returns None - Task 2.1.1.1"""
        repo, conn_mgr = tracking_repo

        result = await repo.get_weight_entry_by_id(str(uuid4()))

        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_weight_entries(self, tracking_repo):
        """Test retrieving all weight entries for a user - Task 2.1.1.1"""
        repo, conn_mgr = tracking_repo

        user_id = str(uuid4())

        for i in range(2):
            entry = WeightTrackingEntity(
                entry_id=str(uuid4()),
                user_id=user_id,
                weight=70.0 + (i * 0.5),
                date=datetime(2025, 1, 15 + i)
            )
            await repo.create_weight_entry(entry)

        entries = await repo.get_user_weight_entries(user_id, limit=10, offset=0)

        assert len(entries) == 2
        assert all(e.user_id == user_id for e in entries)

    @pytest.mark.asyncio
    async def test_delete_weight_entry(self, tracking_repo):
        """Test deleting a weight entry - Task 2.1.1.1"""
        repo, conn_mgr = tracking_repo

        entry_id = str(uuid4())
        entry = WeightTrackingEntity(
            entry_id=entry_id,
            user_id="user_delete",
            weight=75.0,
            date=datetime(2025, 1, 10)
        )
        await repo.create_weight_entry(entry)

        result = await repo.delete_weight_entry(entry_id)

        assert result is True

        retrieved = await repo.get_weight_entry_by_id(entry_id)
        assert retrieved is None

    @pytest.mark.asyncio
    async def test_count_user_weight_entries(self, tracking_repo):
        """Test counting user's weight entries - Task 2.1.1.1"""
        repo, conn_mgr = tracking_repo

        user_id = str(uuid4())

        for i in range(3):
            entry = WeightTrackingEntity(
                entry_id=str(uuid4()),
                user_id=user_id,
                weight=70.0 + i,
                date=datetime(2025, 1, 15 + i)
            )
            await repo.create_weight_entry(entry)

        count = await repo.count_user_weight_entries(user_id)

        assert count == 3
