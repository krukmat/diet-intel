import pytest
from unittest.mock import AsyncMock
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


def _plan_payload(sample_plan: MealPlanResponse) -> dict:
    data = sample_plan.model_dump()
    data["plan_id"] = sample_plan.plan_id
    return data


@pytest.mark.asyncio
async def test_store_plan_returns_custom_id_and_caches(monkeypatch):
    sample_plan = _build_sample_plan()
    store_mock = AsyncMock(return_value="db-plan")
    cache_set = AsyncMock()

    monkeypatch.setattr(plan_storage_module.db_service, "store_meal_plan", store_mock)
    monkeypatch.setattr(plan_storage_module.cache_service, "set", cache_set)

    service = PlanStorageService(default_ttl_hours=1)
    result = await service.store_plan(sample_plan, plan_id="custom", user_id="user-1")

    assert result == "custom"
    store_mock.assert_awaited_once_with("user-1", sample_plan)
    cache_set.assert_awaited_once()
    assert cache_set.call_args[0][0] == "meal_plan:custom"


@pytest.mark.asyncio
async def test_store_plan_handles_cache_failure(monkeypatch):
    sample_plan = _build_sample_plan()
    store_mock = AsyncMock(return_value="db-plan")
    cache_set = AsyncMock(side_effect=RuntimeError("cache down"))

    monkeypatch.setattr(plan_storage_module.db_service, "store_meal_plan", store_mock)
    monkeypatch.setattr(plan_storage_module.cache_service, "set", cache_set)

    service = PlanStorageService(default_ttl_hours=1)
    result = await service.store_plan(sample_plan, user_id="user-1")

    assert result == "db-plan"
    cache_set.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_plan_reads_from_cache(monkeypatch):
    sample_plan = _build_sample_plan()
    payload = _plan_payload(sample_plan)
    payload["_storage_metadata"] = {"plan_id": sample_plan.plan_id}
    cache_get = AsyncMock(return_value=payload)
    db_get = AsyncMock()

    monkeypatch.setattr(plan_storage_module.cache_service, "get", cache_get)
    monkeypatch.setattr(plan_storage_module.db_service, "get_meal_plan", db_get)

    service = PlanStorageService()
    plan = await service.get_plan(sample_plan.plan_id)

    assert plan is not None
    assert plan.meals[0].name == sample_plan.meals[0].name
    assert plan.metrics.total_calories == sample_plan.metrics.total_calories
    db_get.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_plan_falls_back_to_db_and_refreshes_cache(monkeypatch):
    sample_plan = _build_sample_plan()
    payload = _plan_payload(sample_plan)
    cache_get = AsyncMock(return_value=None)
    db_get = AsyncMock(return_value=payload)
    cache_set = AsyncMock()

    monkeypatch.setattr(plan_storage_module.cache_service, "get", cache_get)
    monkeypatch.setattr(plan_storage_module.db_service, "get_meal_plan", db_get)
    monkeypatch.setattr(plan_storage_module.cache_service, "set", cache_set)

    service = PlanStorageService(default_ttl_hours=2)
    plan = await service.get_plan(sample_plan.plan_id)

    assert plan is not None
    assert plan.plan_id == sample_plan.plan_id
    cache_set.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_plan_returns_none_on_missing(monkeypatch):
    cache_get = AsyncMock(return_value=None)
    db_get = AsyncMock(return_value=None)

    monkeypatch.setattr(plan_storage_module.cache_service, "get", cache_get)
    monkeypatch.setattr(plan_storage_module.db_service, "get_meal_plan", db_get)

    service = PlanStorageService()
    plan = await service.get_plan("unknown")

    assert plan is None


@pytest.mark.asyncio
async def test_update_plan_refreshes_cache_on_success(monkeypatch):
    sample_plan = _build_sample_plan()
    update_mock = AsyncMock(return_value=True)
    cache_set = AsyncMock()

    monkeypatch.setattr(plan_storage_module.db_service, "update_meal_plan", update_mock)
    monkeypatch.setattr(plan_storage_module.cache_service, "set", cache_set)

    service = PlanStorageService(default_ttl_hours=1)
    result = await service.update_plan(sample_plan.plan_id, sample_plan)

    assert result is True
    cache_set.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_plan_returns_false_when_missing(monkeypatch):
    sample_plan = _build_sample_plan()
    update_mock = AsyncMock(return_value=False)
    cache_set = AsyncMock()

    monkeypatch.setattr(plan_storage_module.db_service, "update_meal_plan", update_mock)
    monkeypatch.setattr(plan_storage_module.cache_service, "set", cache_set)

    service = PlanStorageService()
    result = await service.update_plan(sample_plan.plan_id, sample_plan)

    assert result is False
    cache_set.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_plan_removes_cache(monkeypatch):
    delete_mock = AsyncMock(return_value=True)
    fake_redis = _FakeRedis()
    redis_get = AsyncMock(return_value=fake_redis)

    monkeypatch.setattr(plan_storage_module.db_service, "delete_meal_plan", delete_mock)
    monkeypatch.setattr(plan_storage_module.cache_service, "get_redis", redis_get)

    service = PlanStorageService()
    result = await service.delete_plan("plan-123")

    assert result is True
    assert fake_redis.deleted_keys == ["meal_plan:plan-123"]


@pytest.mark.asyncio
async def test_delete_plan_returns_false_when_db_fails(monkeypatch):
    delete_mock = AsyncMock(return_value=False)
    fake_redis = _FakeRedis()
    redis_get = AsyncMock(return_value=fake_redis)

    monkeypatch.setattr(plan_storage_module.db_service, "delete_meal_plan", delete_mock)
    monkeypatch.setattr(plan_storage_module.cache_service, "get_redis", redis_get)

    service = PlanStorageService()
    result = await service.delete_plan("plan-999")

    assert result is False
    assert fake_redis.deleted_keys == ["meal_plan:plan-999"]


@pytest.mark.asyncio
async def test_extend_ttl_extends_when_cache_exists(monkeypatch):
    sample_plan = _build_sample_plan()
    db_get = AsyncMock(return_value=_plan_payload(sample_plan))
    fake_redis = _FakeRedis(exists_value=1)
    redis_get = AsyncMock(return_value=fake_redis)

    monkeypatch.setattr(plan_storage_module.db_service, "get_meal_plan", db_get)
    monkeypatch.setattr(plan_storage_module.cache_service, "get_redis", redis_get)

    service = PlanStorageService()
    result = await service.extend_ttl(sample_plan.plan_id, additional_hours=2)

    assert result is True
    assert fake_redis.expire_calls
    assert fake_redis.expire_calls[0][0] == f"meal_plan:{sample_plan.plan_id}"


@pytest.mark.asyncio
async def test_extend_ttl_handles_missing_cache(monkeypatch):
    sample_plan = _build_sample_plan()
    db_get = AsyncMock(return_value=_plan_payload(sample_plan))
    fake_redis = _FakeRedis(exists_value=0)
    redis_get = AsyncMock(return_value=fake_redis)

    monkeypatch.setattr(plan_storage_module.db_service, "get_meal_plan", db_get)
    monkeypatch.setattr(plan_storage_module.cache_service, "get_redis", redis_get)

    service = PlanStorageService()
    result = await service.extend_ttl(sample_plan.plan_id)

    assert result is True
    assert not fake_redis.expire_calls


@pytest.mark.asyncio
async def test_extend_ttl_returns_false_on_db_error(monkeypatch):
    db_get = AsyncMock(side_effect=RuntimeError("db down"))
    redis_get = AsyncMock()

    monkeypatch.setattr(plan_storage_module.db_service, "get_meal_plan", db_get)
    monkeypatch.setattr(plan_storage_module.cache_service, "get_redis", redis_get)

    service = PlanStorageService()
    result = await service.extend_ttl("plan-bad")

    assert result is False
