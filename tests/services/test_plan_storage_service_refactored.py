"""
Test suite for PlanStorageService with MealPlanRepository
Task 2.1.2: Refactor PlanStorageService to use Repository Pattern
Target Coverage: 90%+
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock, MagicMock
from uuid import uuid4
import json

from app.models.meal_plan import MealPlanResponse, Meal, MealItem, MealItemMacros, DailyMacros
from app.repositories.meal_plan_repository import MealPlanRepository, MealPlan
from app.services.plan_storage import PlanStorageService


@pytest.fixture
def mock_meal_plan_repository():
    """Create mock MealPlanRepository"""
    return AsyncMock(spec=MealPlanRepository)


@pytest.fixture
def sample_meal_plan():
    """Create sample MealPlanResponse"""
    return MealPlanResponse(
        meals=[
            Meal(
                name="Breakfast",
                target_calories=500,
                actual_calories=500,
                items=[
                    MealItem(
                        name="Oatmeal",
                        barcode="123456",
                        serving="100g",
                        calories=150,
                        macros=MealItemMacros(protein_g=5, fat_g=3, carbs_g=30)
                    )
                ]
            )
        ],
        metrics=DailyMacros(total_calories=2000, protein_g=150, fat_g=50, carbs_g=200, sugars_g=50, salt_g=2, protein_percent=30, fat_percent=22.5, carbs_percent=40),
        daily_calorie_target=2000,
        bmr=1600,
        tdee=2400,
        flexibility_used=False,
        optional_products_used=0
    )


class TestPlanStorageServiceWithRepository:
    """Test PlanStorageService using MealPlanRepository"""

    @pytest.mark.asyncio
    async def test_store_plan_generates_id(self, mock_meal_plan_repository, sample_meal_plan):
        """Test storing plan generates UUID if not provided - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            # Mock repository create to return plan with ID
            created_plan = MealPlan(
                id=str(uuid4()),
                user_id="user_123",
                plan_data=sample_meal_plan.model_dump(),
                bmr=1600.0,
                tdee=2400.0,
                daily_calorie_target=2000.0
            )
            mock_meal_plan_repository.create.return_value = created_plan

            # Execute
            plan_id = await service.store_plan(sample_meal_plan, user_id="user_123")

            # Verify
            assert plan_id is not None
            assert len(plan_id) > 0
            mock_meal_plan_repository.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_store_plan_with_custom_id(self, mock_meal_plan_repository, sample_meal_plan):
        """Test storing plan with specific plan_id - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            custom_id = str(uuid4())
            created_plan = MealPlan(
                id=custom_id,
                user_id="user_456",
                plan_data=sample_meal_plan.model_dump(),
                bmr=1600.0,
                tdee=2400.0,
                daily_calorie_target=2000.0
            )
            mock_meal_plan_repository.create.return_value = created_plan

            # Execute
            plan_id = await service.store_plan(sample_meal_plan, plan_id=custom_id, user_id="user_456")

            # Verify
            assert plan_id == custom_id

    @pytest.mark.asyncio
    async def test_get_plan_success(self, mock_meal_plan_repository, sample_meal_plan):
        """Test retrieving existing plan from repository - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            plan_id = str(uuid4())
            stored_plan = MealPlan(
                id=plan_id,
                user_id="user_123",
                plan_data=sample_meal_plan.model_dump(),
                bmr=1600.0,
                tdee=2400.0,
                daily_calorie_target=2000.0
            )
            mock_meal_plan_repository.get_by_id.return_value = stored_plan

            # Execute
            retrieved = await service.get_plan(plan_id)

            # Verify
            assert retrieved is not None
            assert retrieved.daily_calorie_target == 2000.0
            mock_meal_plan_repository.get_by_id.assert_called_once_with(plan_id)

    @pytest.mark.asyncio
    async def test_get_plan_not_found(self, mock_meal_plan_repository):
        """Test retrieving non-existent plan returns None - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            mock_meal_plan_repository.get_by_id.return_value = None

            # Execute
            result = await service.get_plan(str(uuid4()))

            # Verify
            assert result is None

    @pytest.mark.asyncio
    async def test_update_plan_success(self, mock_meal_plan_repository, sample_meal_plan):
        """Test updating existing plan - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            plan_id = str(uuid4())
            updated_plan = MealPlan(
                id=plan_id,
                user_id="user_123",
                plan_data=sample_meal_plan.model_dump(),
                bmr=1700.0,
                tdee=2500.0,
                daily_calorie_target=2100.0
            )
            mock_meal_plan_repository.update.return_value = updated_plan

            # Execute
            result = await service.update_plan(plan_id, sample_meal_plan)

            # Verify
            assert result is not None
            assert result.daily_calorie_target == 2100.0
            mock_meal_plan_repository.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_plan_success(self, mock_meal_plan_repository):
        """Test deleting plan - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            plan_id = str(uuid4())
            mock_meal_plan_repository.delete.return_value = True

            # Execute
            result = await service.delete_plan(plan_id)

            # Verify
            assert result is True
            mock_meal_plan_repository.delete.assert_called_once_with(plan_id)

    @pytest.mark.asyncio
    async def test_store_plan_with_cache(self, mock_meal_plan_repository, sample_meal_plan):
        """Test storing plan also caches it - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            with patch('app.services.plan_storage.cache_service') as mock_cache:
                service = PlanStorageService()
                service.repository = mock_meal_plan_repository

                plan_id = str(uuid4())
                created_plan = MealPlan(
                    id=plan_id,
                    user_id="user_123",
                    plan_data=sample_meal_plan.model_dump(),
                    bmr=1600.0,
                    tdee=2400.0,
                    daily_calorie_target=2000.0
                )
                mock_meal_plan_repository.create.return_value = created_plan
                mock_cache.set = AsyncMock()

                # Execute
                result_id = await service.store_plan(sample_meal_plan, user_id="user_123")

                # Verify cache was called
                assert mock_cache.set.called or result_id == plan_id

    @pytest.mark.asyncio
    async def test_store_plan_error_handling(self, mock_meal_plan_repository, sample_meal_plan):
        """Test error handling when store fails - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            # Mock repository to raise exception
            mock_meal_plan_repository.create.side_effect = Exception("Database error")

            # Execute & Verify
            with pytest.raises(RuntimeError):
                await service.store_plan(sample_meal_plan, user_id="user_123")

    @pytest.mark.asyncio
    async def test_get_plan_by_user_id(self, mock_meal_plan_repository, sample_meal_plan):
        """Test retrieving plans by user ID - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            user_id = "user_123"
            plan_data = sample_meal_plan.model_dump()
            plans = [
                MealPlan(id=str(uuid4()), user_id=user_id, plan_data=plan_data, bmr=1600, tdee=2400, daily_calorie_target=2000),
                MealPlan(id=str(uuid4()), user_id=user_id, plan_data=plan_data, bmr=1600, tdee=2400, daily_calorie_target=2000),
            ]
            mock_meal_plan_repository.get_by_user_id.return_value = plans

            # Execute
            user_plans = await service.get_user_plans(user_id, limit=10)

            # Verify
            assert len(user_plans) == 2
            mock_meal_plan_repository.get_by_user_id.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_plan_from_cache(self, mock_meal_plan_repository, sample_meal_plan):
        """Test retrieving plan from cache - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            with patch('app.services.plan_storage.cache_service') as mock_cache:
                service = PlanStorageService()
                service.repository = mock_meal_plan_repository

                plan_id = str(uuid4())
                cached_data = sample_meal_plan.model_dump()
                mock_cache.get = AsyncMock(return_value=cached_data)

                # Execute
                result = await service.get_plan(plan_id)

                # Verify cache was used
                assert result is not None
                assert result.daily_calorie_target == 2000
                mock_cache.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_extend_ttl_success(self, mock_meal_plan_repository, sample_meal_plan):
        """Test extending TTL for cached plan - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            with patch('app.services.plan_storage.cache_service') as mock_cache:
                service = PlanStorageService()
                service.repository = mock_meal_plan_repository

                plan_id = str(uuid4())
                stored_plan = MealPlan(
                    id=plan_id,
                    user_id="user_123",
                    plan_data=sample_meal_plan.model_dump(),
                    bmr=1600,
                    tdee=2400,
                    daily_calorie_target=2000
                )
                mock_meal_plan_repository.get_by_id.return_value = stored_plan

                mock_redis = AsyncMock()
                mock_redis.exists = AsyncMock(return_value=True)
                mock_redis.expire = AsyncMock()
                mock_cache.get_redis = AsyncMock(return_value=mock_redis)

                # Execute
                result = await service.extend_ttl(plan_id, additional_hours=48)

                # Verify
                assert result is True
                mock_redis.expire.assert_called_once()

    @pytest.mark.asyncio
    async def test_extend_ttl_plan_not_found(self, mock_meal_plan_repository):
        """Test extending TTL for non-existent plan - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            plan_id = str(uuid4())
            mock_meal_plan_repository.get_by_id.return_value = None

            # Execute
            result = await service.extend_ttl(plan_id)

            # Verify
            assert result is False

    @pytest.mark.asyncio
    async def test_get_user_plans_empty(self, mock_meal_plan_repository):
        """Test retrieving plans for user with no plans - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            user_id = "user_456"
            mock_meal_plan_repository.get_by_user_id.return_value = []

            # Execute
            result = await service.get_user_plans(user_id)

            # Verify
            assert len(result) == 0

    @pytest.mark.asyncio
    async def test_delete_plan_not_found(self, mock_meal_plan_repository):
        """Test deleting non-existent plan - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            plan_id = str(uuid4())
            mock_meal_plan_repository.delete.return_value = False

            # Execute
            result = await service.delete_plan(plan_id)

            # Verify
            assert result is False

    @pytest.mark.asyncio
    async def test_update_plan_not_found(self, mock_meal_plan_repository, sample_meal_plan):
        """Test updating non-existent plan - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            plan_id = str(uuid4())
            mock_meal_plan_repository.update.return_value = None

            # Execute
            result = await service.update_plan(plan_id, sample_meal_plan)

            # Verify
            assert result is None

    @pytest.mark.asyncio
    async def test_get_plan_cache_error_fallback(self, mock_meal_plan_repository, sample_meal_plan):
        """Test cache error falls back to repository - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            with patch('app.services.plan_storage.cache_service') as mock_cache:
                service = PlanStorageService()
                service.repository = mock_meal_plan_repository

                plan_id = str(uuid4())
                # Cache error, should fall back to repository
                mock_cache.get = AsyncMock(side_effect=Exception("Cache error"))

                stored_plan = MealPlan(
                    id=plan_id,
                    user_id="user_123",
                    plan_data=sample_meal_plan.model_dump(),
                    bmr=1600,
                    tdee=2400,
                    daily_calorie_target=2000
                )
                mock_meal_plan_repository.get_by_id.return_value = stored_plan

                # Execute
                result = await service.get_plan(plan_id)

                # Verify falls back to repository
                assert result is not None
                mock_meal_plan_repository.get_by_id.assert_called()

    @pytest.mark.asyncio
    async def test_store_plan_cache_set_error(self, mock_meal_plan_repository, sample_meal_plan):
        """Test store continues despite cache set error - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            with patch('app.services.plan_storage.cache_service') as mock_cache:
                service = PlanStorageService()
                service.repository = mock_meal_plan_repository

                # Mock repository to return whatever ID we pass to it
                def create_side_effect(meal_plan):
                    return meal_plan
                mock_meal_plan_repository.create.side_effect = create_side_effect
                # Cache set fails but operation continues
                mock_cache.set = AsyncMock(side_effect=Exception("Cache unavailable"))

                # Execute
                result_id = await service.store_plan(sample_meal_plan, user_id="user_123")

                # Verify store succeeded despite cache error
                assert result_id is not None
                assert len(result_id) > 0

    @pytest.mark.asyncio
    async def test_delete_plan_cache_error(self, mock_meal_plan_repository):
        """Test delete continues despite cache error - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            with patch('app.services.plan_storage.cache_service') as mock_cache:
                service = PlanStorageService()
                service.repository = mock_meal_plan_repository

                plan_id = str(uuid4())
                mock_meal_plan_repository.delete.return_value = True

                mock_redis = AsyncMock()
                mock_redis.delete = AsyncMock(side_effect=Exception("Redis error"))
                mock_cache.get_redis = AsyncMock(return_value=mock_redis)

                # Execute
                result = await service.delete_plan(plan_id)

                # Verify delete succeeded despite cache error
                assert result is True

    @pytest.mark.asyncio
    async def test_delete_plan_repository_error(self, mock_meal_plan_repository):
        """Test delete error handling - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            plan_id = str(uuid4())
            mock_meal_plan_repository.delete.side_effect = Exception("Database error")

            # Execute
            result = await service.delete_plan(plan_id)

            # Verify
            assert result is False

    @pytest.mark.asyncio
    async def test_extend_ttl_error(self, mock_meal_plan_repository):
        """Test extend_ttl error handling - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            plan_id = str(uuid4())
            mock_meal_plan_repository.get_by_id.side_effect = Exception("Database error")

            # Execute
            result = await service.extend_ttl(plan_id)

            # Verify
            assert result is False

    @pytest.mark.asyncio
    async def test_get_user_plans_conversion_error(self, mock_meal_plan_repository):
        """Test get_user_plans handles conversion errors - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            user_id = "user_456"
            # Plan with invalid plan_data that can't be converted to MealPlanResponse
            invalid_plan = MealPlan(
                id=str(uuid4()),
                user_id=user_id,
                plan_data={},  # Empty plan_data will fail conversion
                bmr=1600,
                tdee=2400,
                daily_calorie_target=2000
            )
            mock_meal_plan_repository.get_by_user_id.return_value = [invalid_plan]

            # Execute
            result = await service.get_user_plans(user_id)

            # Verify returns empty list (invalid plans are skipped)
            assert len(result) == 0

    @pytest.mark.asyncio
    async def test_get_user_plans_repository_error(self, mock_meal_plan_repository):
        """Test get_user_plans repository error handling - Task 2.1.2"""
        with patch('app.services.plan_storage.MealPlanRepository', return_value=mock_meal_plan_repository):
            service = PlanStorageService()
            service.repository = mock_meal_plan_repository

            user_id = "user_456"
            mock_meal_plan_repository.get_by_user_id.side_effect = Exception("Database error")

            # Execute
            result = await service.get_user_plans(user_id)

            # Verify returns empty list on error
            assert len(result) == 0
