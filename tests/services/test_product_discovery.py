import asyncio
from datetime import datetime

import pytest

from app.models.product import ProductResponse, Nutriments
from app.services.product_discovery import ProductDiscoveryService


def _build_product(
    barcode: str,
    name: str,
    protein: float = 0.0,
    calories: float = 0.0,
    fat: float = 5.0,
    carbs: float = 30.0
):
    return ProductResponse(
        source="Test",
        barcode=barcode,
        name=name,
        brand="TestBrand",
        image_url=None,
        serving_size="100g",
        nutriments=Nutriments(
            energy_kcal_per_100g=calories,
            protein_g_per_100g=protein,
            fat_g_per_100g=fat,
            carbs_g_per_100g=carbs,
        ),
        fetched_at=datetime.utcnow()
    )


@pytest.mark.asyncio
async def test_discover_recommendations_deduplicates_products(monkeypatch):
    service = ProductDiscoveryService()

    async def stub_cached(*args, **kwargs):
        return [_build_product("p1", "Poduce", protein=16.0), _build_product("p1", "Duplicate", protein=16.0)]

    async def stub_user(*args, **kwargs):
        return []

    async def stub_diverse(*args, **kwargs):
        return []

    async def stub_api(*args, **kwargs):
        return []

    monkeypatch.setattr(service, "_load_popular_cached_products", stub_cached)
    monkeypatch.setattr(service, "_load_user_preferred_products", stub_user)
    monkeypatch.setattr(service, "_load_nutritionally_diverse_products", stub_diverse)
    monkeypatch.setattr(service, "_discover_products_from_api", stub_api)

    results = await service.discover_products_for_recommendations(user_id="u1", max_products=2)
    assert len(results) == 1
    assert results[0].barcode == "p1"
    assert service._categorize_product(results[0]) == "high_protein"


@pytest.mark.asyncio
async def test_discover_meal_planning_returns_fallback_on_error(monkeypatch):
    service = ProductDiscoveryService()

    async def raise_error(*args, **kwargs):
        raise RuntimeError("boom")

    async def fallback(*args, **kwargs):
        return [_build_product("fb1", "Fallback", calories=120.0)]

    monkeypatch.setattr(service, "_load_specific_products", raise_error)
    monkeypatch.setattr(service, "_load_meal_appropriate_products", raise_error)
    monkeypatch.setattr(service, "_ensure_nutritional_balance", raise_error)
    monkeypatch.setattr(service, "_get_emergency_fallback_products", fallback)

    results = await service.discover_products_for_meal_planning()
    assert len(results) == 1
    assert results[0].barcode == "fb1"


def test_categorize_product_handles_all_categories():
    service = ProductDiscoveryService()
    low_calorie = _build_product("low", "Light Snack", protein=5.0, calories=90.0)
    assert service._categorize_product(low_calorie) == "low_calorie"

    healthy_fat = _build_product("fat", "Nut Butter", fat=12.0)
    assert service._categorize_product(healthy_fat) == "healthy_fats"

    complex_carb = _build_product("carb", "Whole Grain", carbs=70.0)
    assert service._categorize_product(complex_carb) == "complex_carbs"

    other = _build_product("other", "Unknown")
    assert service._categorize_product(other) == "other"


def test_meets_nutritional_criteria_respects_thresholds():
    service = ProductDiscoveryService()
    product = _build_product("criteria", "Balanced", protein=18.0, calories=95.0, fat=15.0, carbs=65.0)
    criteria = {
        "min_protein_per_100g": 15.0,
        "max_calories_per_100g": 120.0,
        "min_fat_per_100g": 10.0,
        "min_carbs_per_100g": 60.0
    }

    assert service._meets_nutritional_criteria(product, criteria) is True

    missed = _build_product("criteria-miss", "Low Protein", protein=5.0)
    assert service._meets_nutritional_criteria(missed, criteria) is False


def test_deduplicate_products_removes_duplicates():
    service = ProductDiscoveryService()
    first = _build_product("dup", "Dup One")
    second = _build_product("dup", "Dup Two")

    deduped = service._deduplicate_products([first, second])
    assert len(deduped) == 1


@pytest.mark.asyncio
async def test_get_emergency_fallback_products_returns_core_items():
    service = ProductDiscoveryService()
    fallback = await service._get_emergency_fallback_products()
    assert len(fallback) >= 3
    barcodes = {product.barcode for product in fallback}
    assert "FALLBACK_001" in barcodes


@pytest.mark.asyncio
async def test_ensure_nutritional_balance_adds_missing_category(monkeypatch):
    service = ProductDiscoveryService()
    service.nutritional_categories = {
        "high_protein": {"min_protein_per_100g": 5.0}
    }

    high_protein = _build_product("hp", "Muscle Mix", protein=20.0)

    async def loader(*args, **kwargs):
        return [high_protein]

    monkeypatch.setattr(service, "_load_nutritionally_diverse_products", loader)
    result = await service._ensure_nutritional_balance([], dietary_restrictions=None, target_count=1)
    assert result == [high_protein]


@pytest.mark.asyncio
async def test_ensure_nutritional_balance_falls_back_on_error(monkeypatch):
    service = ProductDiscoveryService()

    async def raise_error(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(service, "_load_nutritionally_diverse_products", raise_error)
    existing = [_build_product("keep", "Keep It")]
    result = await service._ensure_nutritional_balance(existing, dietary_restrictions=None, target_count=5)
    assert result == existing
