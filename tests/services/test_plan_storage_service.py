"""
Test suite for PlanStorageService with Repository Pattern
Task 2.1.2: Refactored to use MealPlanRepository mocks
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime
from app.models.meal_plan import (
    MealPlanResponse,
    Meal,
    MealItem,
    MealItemMacros,
    DailyMacros
)
from app.services.plan_storage import PlanStorageService
from app.services import plan_storage as plan_storage_module
from app.repositories.meal_plan_repository import MealPlan, MealPlanRepository


class _FakeRedis:
    def __init__(self, exists_value=1):
        self.exists_value = exists_value
        self.deleted_keys = []
        self.expire_calls = []

    async def delete(self, key: str):
        self.deleted_keys.append(key)
        return 1

    async def exists(self, key: str):
        return self.exists_value

    async def expire(self, key: str, seconds: int):
        self.expire_calls.append((key, seconds))
        return True


def _build_sample_plan(plan_id: str = "plan-123") -> MealPlanResponse:
    item = MealItem(
        barcode="000000000001",
        name="Test Oatmeal",
        serving="50g",
        calories=175.0,
        macros=MealItemMacros(
            protein_g=8.5,
            fat_g=3.0,
            carbs_g=30.0,
            sugars_g=1.0,
            salt_g=0.0
        )
    )
    meal = Meal(
        name="Breakfast",
        target_calories=500.0,
        actual_calories=175.0,
        items=[item]
    )
    metrics = DailyMacros(
        total_calories=175.0,
        protein_g=8.5,
        fat_g=3.0,
        carbs_g=30.0,
        sugars_g=1.0,
        salt_g=0.0,
        protein_percent=19.4,
        fat_percent=15.4,
        carbs_percent=68.6
    )
    return MealPlanResponse(
        plan_id=plan_id,
        bmr=1730.0,
        tdee=2681.5,
        daily_calorie_target=2681.5,
        meals=[meal],
        metrics=metrics,
        flexibility_used=False,
        optional_products_used=0,
        created_at=datetime(2025, 1, 1)
    )


def _build_meal_plan_entity(plan_id: str = "plan-123", user_id: str = "user-1") -> MealPlan:
    """Create MealPlan entity for repository mock returns - Task 2.1.2"""
    sample_plan = _build_sample_plan(plan_id)
    return MealPlan(
        id=plan_id,
        user_id=user_id,
        plan_data=sample_plan.model_dump(),
        bmr=sample_plan.bmr,
        tdee=sample_plan.tdee,
        daily_calorie_target=sample_plan.daily_calorie_target,
        flexibility_used=sample_plan.flexibility_used,
        optional_products_used=sample_plan.optional_products_used,
        created_at=datetime.now()
    )


def _plan_payload(sample_plan: MealPlanResponse) -> dict:
    data = sample_plan.model_dump()
    data["plan_id"] = sample_plan.plan_id
    return data


@pytest.fixture
def mock_repository():
    """Create mock MealPlanRepository - Task 2.1.2"""
    return AsyncMock(spec=MealPlanRepository)


@pytest.mark.asyncio
async def test_store_plan_returns_custom_id_and_caches(mock_repository, monkeypatch):
    """Test store_plan with custom ID - Task 2.1.2: Uses Repository mock"""
    sample_plan = _build_sample_plan()
    plan_entity = _build_meal_plan_entity("custom", "user-1")

    mock_repository.create = AsyncMock(return_value=plan_entity)
    cache_set = AsyncMock()
    monkeypatch.setattr(plan_storage_module.cache_service, "set", cache_set)

    service = PlanStorageService(repository=mock_repository, default_ttl_hours=1)
    result = await service.store_plan(sample_plan, plan_id="custom", user_id="user-1")

    assert result == "custom"
    mock_repository.create.assert_awaited_once()
    cache_set.assert_awaited_once()
    assert cache_set.call_args[0][0] == "meal_plan:custom"


@pytest.mark.asyncio
async def test_store_plan_handles_cache_failure(mock_repository, monkeypatch):
    """Test store_plan handles cache failure gracefully - Task 2.1.2"""
    sample_plan = _build_sample_plan()
    plan_entity = _build_meal_plan_entity("generated-id", "user-1")

    mock_repository.create = AsyncMock(return_value=plan_entity)
    cache_set = AsyncMock(side_effect=RuntimeError("cache down"))
    monkeypatch.setattr(plan_storage_module.cache_service, "set", cache_set)

    service = PlanStorageService(repository=mock_repository, default_ttl_hours=1)
    result = await service.store_plan(sample_plan, plan_id="generated-id", user_id="user-1")

    # Should return the plan_id despite cache failure
    assert result == "generated-id"
    cache_set.assert_awaited_once()


@pytest.mark.asyncio
async def test_store_plan_activating_deactivates_others_and_handles_error(mock_repository, monkeypatch):
    """Test store_plan activates plan and propagates repository errors."""
    sample_plan = _build_sample_plan()
    mock_repository.create = AsyncMock(side_effect=RuntimeError("db down"))
    mock_repository.deactivate_plans_for_user = AsyncMock()
    cache_set = AsyncMock()
    monkeypatch.setattr(plan_storage_module.cache_service, "set", cache_set)

    service = PlanStorageService(repository=mock_repository)
    with pytest.raises(RuntimeError):
        await service.store_plan(sample_plan, plan_id="active-plan", user_id="user-1", activate=True)

    mock_repository.deactivate_plans_for_user.assert_awaited_once()
    cache_set.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_plan_reads_from_cache(monkeypatch):
    """Test get_plan reads from cache first"""
    sample_plan = _build_sample_plan()
    payload = _plan_payload(sample_plan)
    payload["_storage_metadata"] = {"plan_id": sample_plan.plan_id}
    cache_get = AsyncMock(return_value=payload)

    monkeypatch.setattr(plan_storage_module.cache_service, "get", cache_get)

    mock_repo = AsyncMock(spec=MealPlanRepository)
    service = PlanStorageService(repository=mock_repo)
    plan = await service.get_plan(sample_plan.plan_id)

    assert plan is not None
    assert plan.meals[0].name == sample_plan.meals[0].name
    assert plan.metrics.total_calories == sample_plan.metrics.total_calories
    mock_repo.get_by_id.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_plan_falls_back_to_db_and_refreshes_cache(mock_repository, monkeypatch):
    """Test get_plan falls back to repository when cache miss - Task 2.1.2"""
    sample_plan = _build_sample_plan()
    plan_entity = _build_meal_plan_entity(sample_plan.plan_id)

    cache_get = AsyncMock(return_value=None)
    cache_set = AsyncMock()
    mock_repository.get_by_id = AsyncMock(return_value=plan_entity)

    monkeypatch.setattr(plan_storage_module.cache_service, "get", cache_get)
    monkeypatch.setattr(plan_storage_module.cache_service, "set", cache_set)

    service = PlanStorageService(repository=mock_repository, default_ttl_hours=2)
    plan = await service.get_plan(sample_plan.plan_id)

    assert plan is not None
    assert plan.plan_id == sample_plan.plan_id
    cache_set.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_plan_handles_cache_get_error(mock_repository, monkeypatch):
    """Test get_plan continues when cache get raises an error."""
    sample_plan = _build_sample_plan()
    plan_entity = _build_meal_plan_entity(sample_plan.plan_id)

    cache_get = AsyncMock(side_effect=RuntimeError("cache read failed"))
    cache_set = AsyncMock()
    mock_repository.get_by_id = AsyncMock(return_value=plan_entity)

    monkeypatch.setattr(plan_storage_module.cache_service, "get", cache_get)
    monkeypatch.setattr(plan_storage_module.cache_service, "set", cache_set)

    service = PlanStorageService(repository=mock_repository)
    plan = await service.get_plan(sample_plan.plan_id)

    assert plan is not None
    cache_set.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_plan_handles_cache_set_error(mock_repository, monkeypatch):
    """Test get_plan logs when cache set fails after repo read."""
    sample_plan = _build_sample_plan()
    plan_entity = _build_meal_plan_entity(sample_plan.plan_id)

    cache_get = AsyncMock(return_value=None)
    cache_set = AsyncMock(side_effect=RuntimeError("cache write failed"))
    mock_repository.get_by_id = AsyncMock(return_value=plan_entity)

    monkeypatch.setattr(plan_storage_module.cache_service, "get", cache_get)
    monkeypatch.setattr(plan_storage_module.cache_service, "set", cache_set)

    service = PlanStorageService(repository=mock_repository)
    plan = await service.get_plan(sample_plan.plan_id)

    assert plan is not None
    cache_set.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_plan_returns_none_on_missing(mock_repository, monkeypatch):
    """Test get_plan returns None when plan not found - Task 2.1.2"""
    cache_get = AsyncMock(return_value=None)
    mock_repository.get_by_id = AsyncMock(return_value=None)

    monkeypatch.setattr(plan_storage_module.cache_service, "get", cache_get)

    service = PlanStorageService(repository=mock_repository)
    plan = await service.get_plan("unknown")

    assert plan is None


@pytest.mark.asyncio
async def test_set_plan_active_state_activates_plan(mock_repository):
    """Test activating a plan sets is_active and deactivates others."""
    sample_plan = _build_meal_plan_entity("plan-1", "user-1")
    mock_repository.get_by_id = AsyncMock(return_value=sample_plan)
    mock_repository.update = AsyncMock(return_value=sample_plan)
    mock_repository.deactivate_plans_for_user = AsyncMock()

    service = PlanStorageService(repository=mock_repository)
    result = await service.set_plan_active_state("user-1", "plan-1", True)

    assert result is not None
    assert result.plan_id == "plan-1"
    mock_repository.deactivate_plans_for_user.assert_awaited_once()
    mock_repository.update.assert_awaited_once()


@pytest.mark.asyncio
async def test_set_plan_active_state_invalid_user(mock_repository):
    """Test activation returns None when plan is missing or mismatched."""
    sample_plan = _build_meal_plan_entity("plan-1", "other-user")
    mock_repository.get_by_id = AsyncMock(return_value=sample_plan)

    service = PlanStorageService(repository=mock_repository)
    result = await service.set_plan_active_state("user-1", "plan-1", True)

    assert result is None


@pytest.mark.asyncio
async def test_get_user_plans_returns_list(mock_repository):
    """Test get_user_plans returns MealPlanResponse list with active flag."""
    plan_entity = _build_meal_plan_entity("plan-1", "user-1")
    plan_entity.is_active = True
    mock_repository.get_by_user_id = AsyncMock(return_value=[plan_entity])

    service = PlanStorageService(repository=mock_repository)
    plans = await service.get_user_plans("user-1", limit=5, offset=0)

    assert len(plans) == 1
    assert plans[0].plan_id == "plan-1"
    assert plans[0].is_active


@pytest.mark.asyncio
async def test_get_active_plan_for_user_returns_active_plan(mock_repository):
    """Test retrieving only the active plan through plan_storage."""
    sample_plan = _build_sample_plan()
    plan_entity = _build_meal_plan_entity(sample_plan.plan_id)
    plan_entity.is_active = True

    mock_repository.get_active_plan_for_user = AsyncMock(return_value=plan_entity)

    service = PlanStorageService(repository=mock_repository)
    plan = await service.get_active_plan_for_user("user-1")

    assert plan is not None
    assert plan.plan_id == sample_plan.plan_id
    assert plan.is_active

@pytest.mark.asyncio
async def test_update_plan_refreshes_cache_on_success(mock_repository, monkeypatch):
    """Test update_plan refreshes cache on success - Task 2.1.2"""
    sample_plan = _build_sample_plan()
    plan_entity = _build_meal_plan_entity(sample_plan.plan_id)

    mock_repository.update = AsyncMock(return_value=plan_entity)
    cache_set = AsyncMock()
    monkeypatch.setattr(plan_storage_module.cache_service, "set", cache_set)

    service = PlanStorageService(repository=mock_repository, default_ttl_hours=1)
    result = await service.update_plan(sample_plan.plan_id, sample_plan)

    # update_plan returns the updated plan or None
    assert result is not None
    cache_set.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_plan_returns_none_when_missing(mock_repository, monkeypatch):
    """Test update_plan returns None when plan not found - Task 2.1.2"""
    sample_plan = _build_sample_plan()

    mock_repository.update = AsyncMock(return_value=None)
    cache_set = AsyncMock()
    monkeypatch.setattr(plan_storage_module.cache_service, "set", cache_set)

    service = PlanStorageService(repository=mock_repository)
    result = await service.update_plan(sample_plan.plan_id, sample_plan)

    assert result is None
    cache_set.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_plan_removes_cache(mock_repository, monkeypatch):
    """Test delete_plan removes from cache - Task 2.1.2"""
    mock_repository.delete = AsyncMock(return_value=True)
    fake_redis = _FakeRedis()
    redis_get = AsyncMock(return_value=fake_redis)

    monkeypatch.setattr(plan_storage_module.cache_service, "get_redis", redis_get)

    service = PlanStorageService(repository=mock_repository)
    result = await service.delete_plan("plan-123")

    assert result is True
    assert fake_redis.deleted_keys == ["meal_plan:plan-123"]


@pytest.mark.asyncio
async def test_delete_plan_returns_false_when_db_fails(mock_repository, monkeypatch):
    """Test delete_plan returns False on failure - Task 2.1.2"""
    mock_repository.delete = AsyncMock(return_value=False)
    fake_redis = _FakeRedis()
    redis_get = AsyncMock(return_value=fake_redis)

    monkeypatch.setattr(plan_storage_module.cache_service, "get_redis", redis_get)

    service = PlanStorageService(repository=mock_repository)
    result = await service.delete_plan("plan-999")

    assert result is False
    assert fake_redis.deleted_keys == ["meal_plan:plan-999"]


@pytest.mark.asyncio
async def test_extend_ttl_extends_when_cache_exists(mock_repository, monkeypatch):
    """Test extend_ttl extends TTL when cache exists - Task 2.1.2"""
    sample_plan = _build_sample_plan()
    plan_entity = _build_meal_plan_entity(sample_plan.plan_id)

    mock_repository.get_by_id = AsyncMock(return_value=plan_entity)
    fake_redis = _FakeRedis(exists_value=1)
    redis_get = AsyncMock(return_value=fake_redis)

    monkeypatch.setattr(plan_storage_module.cache_service, "get_redis", redis_get)

    service = PlanStorageService(repository=mock_repository)
    result = await service.extend_ttl(sample_plan.plan_id, additional_hours=2)

    assert result is True
    assert fake_redis.expire_calls
    assert fake_redis.expire_calls[0][0] == f"meal_plan:{sample_plan.plan_id}"


@pytest.mark.asyncio
async def test_extend_ttl_handles_missing_cache(mock_repository, monkeypatch):
    """Test extend_ttl handles missing cache - Task 2.1.2"""
    sample_plan = _build_sample_plan()
    plan_entity = _build_meal_plan_entity(sample_plan.plan_id)

    mock_repository.get_by_id = AsyncMock(return_value=plan_entity)
    fake_redis = _FakeRedis(exists_value=0)
    redis_get = AsyncMock(return_value=fake_redis)

    monkeypatch.setattr(plan_storage_module.cache_service, "get_redis", redis_get)

    service = PlanStorageService(repository=mock_repository)
    result = await service.extend_ttl(sample_plan.plan_id)

    assert result is True
    assert not fake_redis.expire_calls


@pytest.mark.asyncio
async def test_extend_ttl_returns_false_on_db_error(mock_repository, monkeypatch):
    """Test extend_ttl returns False on error - Task 2.1.2"""
    mock_repository.get_by_id = AsyncMock(side_effect=RuntimeError("db down"))
    redis_get = AsyncMock()

    monkeypatch.setattr(plan_storage_module.cache_service, "get_redis", redis_get)

    service = PlanStorageService(repository=mock_repository)
    result = await service.extend_ttl("plan-bad")

    assert result is False
