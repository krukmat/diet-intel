from datetime import datetime

import pytest
from unittest.mock import AsyncMock

from app.models.product import ProductResponse, Nutriments
from app.services.product_discovery import ProductDiscoveryService


def _make_product(barcode: str, name: str, protein: float = 10.0, calories: float = 150.0, fat: float = 5.0, carbs: float = 20.0) -> ProductResponse:
    return ProductResponse(
        source="tests",
        barcode=barcode,
        name=name,
        brand="Test Brand",
        image_url=None,
        serving_size="100g",
        nutriments=Nutriments(
            energy_kcal_per_100g=calories,
            protein_g_per_100g=protein,
            fat_g_per_100g=fat,
            carbs_g_per_100g=carbs,
            sugars_g_per_100g=carbs * 0.3,
            salt_g_per_100g=0.1
        ),
        fetched_at=datetime.utcnow()
    )


@pytest.fixture
def discovery_service():
    return ProductDiscoveryService()


@pytest.mark.asyncio
async def test_recommendation_discovery_merges_sources(monkeypatch, discovery_service):
    service = discovery_service

    popular = [_make_product("001", "Popular Protein", protein=20.0)]
    user_pref = [_make_product("002", "User Favorite", calories=80.0)]
    diverse = [_make_product("003", "Balanced Snack", fat=12.0)]
    api_products = [_make_product("004", "API Surprise", carbs=65.0)]

    service._load_popular_cached_products = AsyncMock(return_value=popular)
    service._load_user_preferred_products = AsyncMock(return_value=user_pref)
    service._load_nutritionally_diverse_products = AsyncMock(return_value=diverse)
    service._discover_products_from_api = AsyncMock(return_value=api_products)
    service._get_emergency_fallback_products = AsyncMock()
    service._deduplicate_products = lambda products: products  # keep order, no duplicates

    result = await service.discover_products_for_recommendations(
        user_id="user123",
        dietary_restrictions=["vegan"],
        cuisine_preferences=["mediterranean"],
        max_products=10
    )

    expected = popular + user_pref + diverse + api_products
    assert result == expected[:10]
    service._load_popular_cached_products.assert_awaited_once()
    service._load_user_preferred_products.assert_awaited_once_with("user123", ["vegan"], 10 // 4)
    service._discover_products_from_api.assert_awaited_once()
    assert service._get_emergency_fallback_products.await_count == 0


@pytest.mark.asyncio
async def test_recommendation_discovery_reports_fallback(monkeypatch, discovery_service):
    service = discovery_service
    service._load_popular_cached_products = AsyncMock(side_effect=RuntimeError("boom"))
    fallback = [_make_product("FALLBACK", "Simple Fallback")]
    service._get_emergency_fallback_products = AsyncMock(return_value=fallback)

    result = await service.discover_products_for_recommendations(max_products=5)
    assert result == fallback
    service._get_emergency_fallback_products.assert_awaited_once()


@pytest.mark.asyncio
async def test_meal_planning_discovery_uses_optional_products(discovery_service):
    service = discovery_service
    optional = [_make_product("OPT", "Optional Boost")]
    meal_cached = [_make_product("MEAL", "Meal Focus")]
    balanced = [_make_product("BAL", "Balanced Finale")]

    service._load_specific_products = AsyncMock(return_value=optional)
    service._load_meal_appropriate_products = AsyncMock(return_value=meal_cached)
    service._ensure_nutritional_balance = AsyncMock(return_value=balanced)

    result = await service.discover_products_for_meal_planning(
        optional_products=["opt1", "opt2"],
        max_products=3
    )

    service._load_specific_products.assert_awaited_once_with(["opt1", "opt2"])
    service._ensure_nutritional_balance.assert_awaited_once()
    assert result == balanced


def _make_row(barcode: str):
    return {
        "source": "db",
        "barcode": barcode,
        "name": f"Product {barcode}",
        "brand": "DB",
        "image_url": None,
        "serving_size": "100g",
        "nutriments": '{"energy_kcal_per_100g":120,"protein_g_per_100g":8,"fat_g_per_100g":2,"carbs_g_per_100g":15,"sugars_g_per_100g":3,"salt_g_per_100g":0.2}',
        "last_updated": datetime.utcnow().isoformat()
    }


@pytest.mark.asyncio
async def test_convert_db_row_to_product_handles_parsing(monkeypatch, discovery_service):
    service = discovery_service
    row = _make_row("010101")
    product = await service._convert_db_row_to_product(row)
    assert product is not None
    assert product.barcode == "010101"
    assert product.nutriments.energy_kcal_per_100g == 120

    broken = dict(row)
    broken["nutriments"] = "not-a-json"
    invalid = await service._convert_db_row_to_product(broken)
    assert invalid is None


def test_meets_dietary_restrictions_blocks_meat(discovery_service):
    service = discovery_service
    chicken = _make_product("C1", "Chicken Breast")
    assert service._meets_dietary_restrictions(chicken, ["vegetarian"]) is False
    assert service._meets_dietary_restrictions(chicken, ["vegan"]) is False
    assert service._meets_dietary_restrictions(chicken, ["gluten-free"]) is True
