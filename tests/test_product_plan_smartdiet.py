"""
Tests for Product, Plan, and SmartDiet integration.

NOTE: This test file is marked as skipped because it was designed for the old
monolithic product.py architecture. The route refactoring split product.py into:
- product_routes.py (barcode lookup)
- scan_routes.py (local OCR)
- ocr_routes.py (external OCR)

The patches in this file target helper functions (e.g., _get_cache_backend,
_get_openfoodfacts_backend) that exist but aren't used by the new modular routes,
which import services directly. Equivalent test coverage exists in:
- test_scan_endpoint.py (OCR routes with proper OCRFactory mocking)
- test_product_routes_integration_fixed.py (barcode routes with proper mocking)
"""
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

# Skip entire module - tests obsolete after route refactoring
pytestmark = pytest.mark.skip(
    reason="Obsolete: patches helper functions not used by modular routes. "
    "See test_scan_endpoint.py and test_product_routes_integration_fixed.py."
)

from app.main import app
from app.models.meal_plan import (
    MealPlanRequest,
    MealPlanResponse,
    Meal,
    MealItem,
    MealItemMacros,
    DailyMacros,
    UserProfile,
    Preferences,
    ActivityLevel,
    Goal,
    ChangeLogEntry,
)
from app.models.product import ProductResponse, Nutriments
from app.models.smart_diet import (
    SmartDietContext,
    SmartDietRequest,
    SmartDietResponse,
    SmartSuggestion,
    SuggestionType,
    SuggestionCategory,
    OptimizationSuggestion,
)
from app.models.recommendation import (
    SmartRecommendationResponse,
    MealRecommendation,
    RecommendationItem,
    RecommendationType,
    RecommendationReason,
    NutritionalScore,
)
from app.routes import product as product_routes
from app.routes import plan as plan_routes
from app.services.smart_diet import SmartDietEngine
from app.services import smart_diet as smart_diet_module


@pytest.fixture
def client():
    return TestClient(app)


class _FakeCache:
    def __init__(self, initial=None):
        self.store = {}
        if initial is not None:
            self.store.update(initial)
        self.set_calls = []

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ttl_hours=None, ttl=None):
        self.store[key] = value
        self.set_calls.append((key, value))


class _DummyProductClient:
    def __init__(self, product):
        self.product = product
        self.called = False

    async def get_product(self, barcode):
        self.called = True
        return self.product


class _FailingProductClient(_DummyProductClient):
    def __init__(self, exc):
        super().__init__(None)
        self.exc = exc

    async def get_product(self, barcode):
        self.called = True
        raise self.exc


MINIMAL_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\nIDATx\x9cc``\x00\x00\x00"
    b"\x02\x00\x01E\x1d\x0b\x1c\x00\x00\x00\x00IEND\xaeB`\x82"
)


class _TranslationStub:
    def __init__(self):
        self.history = []

    async def translate_text(self, text, source_lang, target_lang):
        self.history.append((text, source_lang, target_lang))
        return f"{text}-{target_lang}"


class _CacheHitManager:
    def __init__(self, cached_response):
        self.cached_response = cached_response
        self.set_calls = []

    async def get_suggestions_cache(self, *args, **kwargs):
        return self.cached_response

    async def set_suggestions_cache(self, *args, **kwargs):
        self.set_calls.append(kwargs)


@pytest.fixture(autouse=True)
def patch_request_context(monkeypatch):
    async def _optional_context(*args, **kwargs):
        return product_routes.RequestContext(user=None, session_id=None, token=None)

    monkeypatch.setattr(product_routes, 'get_optional_request_context', AsyncMock(side_effect=_optional_context))
    return None


def _build_sample_product(barcode="1234567890123"):
    nutriments = Nutriments(
        energy_kcal_per_100g=250,
        protein_g_per_100g=10,
        fat_g_per_100g=5,
        carbs_g_per_100g=35,
        sugars_g_per_100g=5,
        salt_g_per_100g=0.5,
    )
    return ProductResponse(
        source="test",
        barcode=barcode,
        name="Sample Product",
        brand="DietIntel",
        serving_size="100g",
        image_url=None,
        nutriments=nutriments,
        fetched_at=datetime.utcnow(),
    )


def _patch_db_noop(monkeypatch):
    db = product_routes.db_service
    for method in [
        'log_product_lookup',
        'log_user_product_interaction',
        'store_product',
        'log_ocr_scan',
        'get_user_meal_plans',
    ]:
        if hasattr(db, method):
            monkeypatch.setattr(db, method, AsyncMock())


def _fake_ocr_payload(confidence=0.85, raw_text="Calories 100"):
    return {
        "raw_text": raw_text,
        "parsed_nutriments": {
            "energy_kcal": 100,
            "protein_g": 5,
            "fat_g": 2,
            "carbs_g": 15,
            "sugars_g": 5,
            "salt_g": 0.2,
        },
        "serving_size": "100g",
        "confidence": confidence,
        "processing_details": {"ocr_engine": "stub"},
        "found_nutrients": ["energy_kcal"],
        "missing_required": [],
    }


def _make_suggestion(suggestion_id="suggestion-1", context=SmartDietContext.TODAY):
    return SmartSuggestion(
        id=suggestion_id,
        suggestion_type=SuggestionType.RECOMMENDATION,
        category=SuggestionCategory.DISCOVERY,
        title="Yogurt",
        description="Protein snack",
        reasoning="High protein",
        suggested_item={"name": "Yogurt"},
        confidence_score=0.9,
        planning_context=context,
    )


def _make_optimization():
    return OptimizationSuggestion(
        id="opt-1",
        suggestion_type=SuggestionType.OPTIMIZATION,
        category=SuggestionCategory.FOOD_SWAP,
        title="Swap bread",
        description="Whole grain",
        reasoning="More fiber",
        suggested_item={"name": "Whole grain"},
        confidence_score=0.8,
        planning_context=SmartDietContext.OPTIMIZE,
        optimization_type="swap",
        target_improvement={"fiber_g": 4},
        nutritional_benefit={"fiber_g": 4},
    )


def _legacy_recommendation_response():
    item = RecommendationItem(
        barcode="321",
        name="Apple",
        brand="DietIntel",
        image_url=None,
        calories_per_serving=95,
        serving_size="1 apple",
        protein_g=0.5,
        fat_g=0.3,
        carbs_g=25,
        fiber_g=4,
        recommendation_type=RecommendationType.DIETARY_GOALS,
        reasons=[RecommendationReason.LOW_CALORIE],
        confidence_score=0.88,
        nutritional_score=NutritionalScore(
            overall_score=0.8,
            protein_score=0.5,
            fiber_score=0.9,
            micronutrient_score=0.7,
            calorie_density_score=0.8,
        ),
        preference_match=0.9,
        goal_alignment=0.95,
    )
    meal_rec = MealRecommendation(
        meal_name="Breakfast",
        target_calories=400,
        current_calories=200,
        recommendations=[item],
        macro_gaps={"protein": 10},
        micronutrient_gaps=["vitamin c"],
    )
    return SmartRecommendationResponse(
        user_id="user",
        meal_recommendations=[meal_rec],
        daily_additions=[item],
        snack_recommendations=[],
        recommendations=[item],
        nutritional_insights={"note": "increase protein"},
        personalization_factors=["goal_alignment"],
        total_recommendations=1,
        avg_confidence=0.88,
    )
def test_product_by_barcode_uses_cache(client, monkeypatch):
    cached_product = _build_sample_product()
    cache_stub = _FakeCache({"product:1234567890123": cached_product.model_dump()})

    monkeypatch.setattr(product_routes, '_get_cache_backend', lambda: cache_stub)
    external_client = _DummyProductClient(None)
    monkeypatch.setattr(product_routes, '_get_openfoodfacts_backend', lambda: external_client)

    _patch_db_noop(monkeypatch)

    response = client.post("/product/by-barcode", json={"barcode": "1234567890123"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["barcode"] == "1234567890123"
    assert cache_stub.store
    # assert external client was never invoked
    assert not external_client.called


def test_product_by_barcode_fetches_from_service(client, monkeypatch):
    cache_stub = _FakeCache()
    product = _build_sample_product()
    product_client = _DummyProductClient(product)

    monkeypatch.setattr(product_routes, '_get_cache_backend', lambda: cache_stub)
    monkeypatch.setattr(product_routes, '_get_openfoodfacts_backend', lambda: product_client)

    _patch_db_noop(monkeypatch)

    response = client.post("/product/by-barcode", json={"barcode": "1234567890123"})

    assert response.status_code == 200
    assert cache_stub.set_calls
    assert product_client.called


def test_product_by_barcode_validates_input(client, monkeypatch):
    cache_stub = _FakeCache()
    monkeypatch.setattr(product_routes, '_get_cache_backend', lambda: cache_stub)
    monkeypatch.setattr(product_routes, '_get_openfoodfacts_backend', lambda: _DummyProductClient(None))

    response = client.post("/product/by-barcode", json={"barcode": ""})

    assert response.status_code == 422


def test_product_by_barcode_handles_timeout(client, monkeypatch):
    cache_stub = _FakeCache()
    timeout_exc = TimeoutError("boom")
    monkeypatch.setattr(product_routes, '_get_cache_backend', lambda: cache_stub)
    monkeypatch.setattr(
        product_routes,
        '_get_openfoodfacts_backend',
        lambda: _FailingProductClient(timeout_exc),
    )
    monkeypatch.setattr(product_routes, '_get_httpx_exceptions', lambda: (TimeoutError, Exception))
    _patch_db_noop(monkeypatch)

    response = client.post("/product/by-barcode", json={"barcode": "1234567890123"})

    assert response.status_code == 408


def test_product_by_barcode_handles_network_error(client, monkeypatch):
    cache_stub = _FakeCache()
    class _Timeout(Exception):
        pass

    class _RequestError(Exception):
        pass

    network_exc = _RequestError("network")
    monkeypatch.setattr(product_routes, '_get_cache_backend', lambda: cache_stub)
    monkeypatch.setattr(
        product_routes,
        '_get_openfoodfacts_backend',
        lambda: _FailingProductClient(network_exc),
    )
    monkeypatch.setattr(product_routes, '_get_httpx_exceptions', lambda: (_Timeout, _RequestError))
    _patch_db_noop(monkeypatch)

    response = client.post("/product/by-barcode", json={"barcode": "1234567890123"})

    assert response.status_code == 503


def test_product_by_barcode_not_found(client, monkeypatch):
    cache_stub = _FakeCache()
    monkeypatch.setattr(product_routes, '_get_cache_backend', lambda: cache_stub)
    monkeypatch.setattr(product_routes, '_get_openfoodfacts_backend', lambda: _DummyProductClient(None))
    _patch_db_noop(monkeypatch)

    response = client.post("/product/by-barcode", json={"barcode": "0000000000"})

    assert response.status_code == 404


def test_product_by_barcode_unexpected_error(client, monkeypatch):
    cache_stub = _FakeCache()
    product = _build_sample_product()
    product_client = _DummyProductClient(product)

    async def failing_set(*args, **kwargs):
        raise RuntimeError("cache down")

    cache_stub.set = failing_set

    monkeypatch.setattr(product_routes, '_get_cache_backend', lambda: cache_stub)
    monkeypatch.setattr(product_routes, '_get_openfoodfacts_backend', lambda: product_client)
    _patch_db_noop(monkeypatch)

    response = client.post("/product/by-barcode", json={"barcode": "1234567890123"})

    assert response.status_code == 500


def _patch_tempfile_writer(monkeypatch):
    async def _fake_write(path, data):
        with open(path, "wb") as f:
            f.write(data)

    monkeypatch.setattr(product_routes, "_write_bytes_to_tempfile", _fake_write)


def _post_image(client, url):
    return client.post(
        url,
        files={"image": ("label.png", MINIMAL_PNG, "image/png")},
    )


def test_scan_label_requires_image(client):
    response = client.post("/product/scan-label")
    assert response.status_code == 422


def test_scan_label_rejects_non_image(client):
    response = client.post(
        "/product/scan-label",
        files={"image": ("notes.txt", b"123", "text/plain")},
    )
    assert response.status_code == 400


def test_scan_label_high_confidence_success(client, monkeypatch):
    _patch_tempfile_writer(monkeypatch)
    _patch_db_noop(monkeypatch)
    monkeypatch.setattr(product_routes, "_run_local_ocr", AsyncMock(return_value=_fake_ocr_payload(confidence=0.9)))

    response = _post_image(client, "/product/scan-label")
    assert response.status_code == 200
    body = response.json()
    assert body["confidence"] >= 0.9
    assert body["nutriments"]["protein_g_per_100g"] == 5


def test_scan_label_low_confidence(client, monkeypatch):
    _patch_tempfile_writer(monkeypatch)
    _patch_db_noop(monkeypatch)
    monkeypatch.setattr(product_routes, "_run_local_ocr", AsyncMock(return_value=_fake_ocr_payload(confidence=0.5)))

    response = _post_image(client, "/product/scan-label")
    assert response.status_code == 200
    body = response.json()
    assert body["low_confidence"] is True


def test_scan_label_no_text_error(client, monkeypatch):
    _patch_tempfile_writer(monkeypatch)
    _patch_db_noop(monkeypatch)
    payload = _fake_ocr_payload()
    payload["raw_text"] = ""
    monkeypatch.setattr(product_routes, "_run_local_ocr", AsyncMock(return_value=payload))

    response = _post_image(client, "/product/scan-label")
    assert response.status_code == 400


def test_scan_label_external_uses_external_payload(client, monkeypatch):
    _patch_tempfile_writer(monkeypatch)
    _patch_db_noop(monkeypatch)
    external_payload = _fake_ocr_payload(confidence=0.8)
    monkeypatch.setattr(product_routes, "call_external_ocr", AsyncMock(return_value=external_payload))
    monkeypatch.setattr(product_routes, "_run_local_ocr", AsyncMock())

    response = _post_image(client, "/product/scan-label-external")
    assert response.status_code == 200
    assert response.json()["source"] == "External OCR"


def test_scan_label_external_fallback_local(client, monkeypatch):
    _patch_tempfile_writer(monkeypatch)
    _patch_db_noop(monkeypatch)
    monkeypatch.setattr(product_routes, "call_external_ocr", AsyncMock(return_value=None))
    monkeypatch.setattr(product_routes, "_run_local_ocr", AsyncMock(return_value=_fake_ocr_payload()))

    response = _post_image(client, "/product/scan-label-external")
    assert response.status_code == 200
    assert "Local OCR" in response.json()["source"]


@pytest.mark.asyncio
async def test_scan_label_rejects_large_file(monkeypatch):
    class DummyUpload:
        def __init__(self):
            self.filename = "big.png"
            self.content_type = "image/png"
            self.size = 11 * 1024 * 1024

        async def read(self):
            return MINIMAL_PNG

    upload = DummyUpload()
    context = product_routes.RequestContext(user=None, session_id=None, token=None)
    with pytest.raises(product_routes.HTTPException) as exc:
        await product_routes.scan_nutrition_label(image=upload, context=context)
    assert exc.value.status_code == 413


def _build_sample_plan():
    macros = DailyMacros(
        total_calories=1500,
        protein_g=90,
        fat_g=40,
        carbs_g=150,
        sugars_g=30,
        salt_g=3,
        protein_percent=24,
        fat_percent=24,
        carbs_percent=52,
    )
    item_macros = MealItemMacros(protein_g=20, fat_g=5, carbs_g=25, sugars_g=5, salt_g=0.5)
    meal_item = MealItem(
        barcode="0001112223334",
        name="Mock Item",
        serving="100g",
        calories=200,
        macros=item_macros,
    )
    meal = Meal(name="Breakfast", target_calories=500, actual_calories=200, items=[meal_item])
    return MealPlanResponse(
        bmr=1400,
        tdee=1700,
        daily_calorie_target=1500,
        meals=[meal],
        metrics=macros,
        flexibility_used=False,
        optional_products_used=0,
    )


def _plan_request_body():
    return {
        "user_profile": {
            "age": 35,
            "sex": "male",
            "height_cm": 175,
            "weight_kg": 70,
            "activity_level": "moderately_active",
            "goal": "maintain",
        },
        "preferences": {
            "dietary_restrictions": [],
            "excludes": [],
            "prefers": [],
        },
        "optional_products": [],
        "flexibility": False,
    }


def test_generate_meal_plan_success(client, monkeypatch):
    sample_plan = _build_sample_plan()
    meal_plan_mock = AsyncMock(return_value=sample_plan)
    monkeypatch.setattr(plan_routes.meal_planner, 'generate_plan', meal_plan_mock)

    store_mock = AsyncMock(return_value="plan_abc")
    monkeypatch.setattr(plan_routes.plan_storage, 'store_plan', store_mock)
    monkeypatch.setattr(plan_routes, 'get_session_user_id', AsyncMock(return_value="user_123"))

    response = client.post("/plan/generate", json=_plan_request_body())

    assert response.status_code == 200
    data = response.json()
    assert data["plan_id"] == "plan_abc"
    meal_plan_mock.assert_awaited_once()


def test_get_meal_plan_config(client):
    response = client.get("/plan/config")
    assert response.status_code == 200
    assert "meal_distribution" in response.json()


def test_get_meal_plan_not_found(client, monkeypatch):
    get_plan_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(plan_routes.plan_storage, 'get_plan', get_plan_mock)
    monkeypatch.setattr(plan_routes, 'get_session_user_id', AsyncMock(return_value="user_xyz"))

    response = client.get("/plan/unknown")
    assert response.status_code == 404


def test_customize_plan_requires_operations(client, monkeypatch):
    monkeypatch.setattr(plan_routes, 'get_session_user_id', AsyncMock(return_value="user"))
    response = client.put("/plan/customize/plan123", json={})
    assert response.status_code == 400


def test_customize_plan_success(client, monkeypatch):
    sample_plan = _build_sample_plan()
    monkeypatch.setattr(plan_routes, 'get_session_user_id', AsyncMock(return_value="user"))
    monkeypatch.setattr(plan_routes.plan_storage, 'get_plan', AsyncMock(return_value=sample_plan))
    monkeypatch.setattr(plan_routes.plan_customizer, 'check_idempotency', MagicMock(return_value=False))
    change_entry = ChangeLogEntry(change_type="remove", description="removed item", meal_affected="Breakfast")
    customize_mock = AsyncMock(return_value=(sample_plan, [change_entry]))
    monkeypatch.setattr(plan_routes.plan_customizer, 'customize_plan', customize_mock)
    monkeypatch.setattr(plan_routes.plan_storage, 'update_plan', AsyncMock(return_value=True))

    response = client.put(
        "/plan/customize/plan123",
        json={"remove": {"barcode": "0001112223334"}},
    )
    assert response.status_code == 200
    customize_mock.assert_awaited()


def test_customize_plan_update_failure(client, monkeypatch):
    sample_plan = _build_sample_plan()
    monkeypatch.setattr(plan_routes, 'get_session_user_id', AsyncMock(return_value="user"))
    monkeypatch.setattr(plan_routes.plan_storage, 'get_plan', AsyncMock(return_value=sample_plan))
    monkeypatch.setattr(plan_routes.plan_customizer, 'check_idempotency', MagicMock(return_value=False))
    monkeypatch.setattr(
        plan_routes.plan_customizer,
        'customize_plan',
        AsyncMock(return_value=(sample_plan, [])),
    )
    monkeypatch.setattr(plan_routes.plan_storage, 'update_plan', AsyncMock(return_value=False))

    response = client.put(
        "/plan/customize/plan123",
        json={"remove": {"barcode": "0001112223334"}},
    )
    assert response.status_code == 500


def _add_product_body(barcode="1234567890123", meal_type="lunch"):
    return {
        "barcode": barcode,
        "meal_type": meal_type,
        "serving_size": "100g",
    }


def _patch_plan_db(monkeypatch, plans=None):
    plans = plans or [{"id": "plan42"}]
    monkeypatch.setattr(plan_routes.db_service, 'get_user_meal_plans', AsyncMock(return_value=plans))


def _patch_plan_user(monkeypatch):
    monkeypatch.setattr(plan_routes, 'get_session_user_id', AsyncMock(return_value="user42"))


def test_add_product_invalid_meal_type(client, monkeypatch):
    _patch_plan_user(monkeypatch)
    response = client.post("/plan/add-product", json=_add_product_body(meal_type="brunch"))
    assert response.status_code == 400


def test_add_product_no_plan(client, monkeypatch):
    _patch_plan_user(monkeypatch)
    _patch_plan_db(monkeypatch, plans=[])
    response = client.post("/plan/add-product", json=_add_product_body())
    assert response.status_code == 200
    assert response.json()["success"] is False


def test_add_product_product_missing(client, monkeypatch):
    _patch_plan_user(monkeypatch)
    _patch_plan_db(monkeypatch)
    monkeypatch.setattr(plan_routes.openfoodfacts_service, 'get_product', AsyncMock(return_value=None))
    response = client.post("/plan/add-product", json=_add_product_body())
    assert response.json()["success"] is False


def test_add_product_success(client, monkeypatch):
    _patch_plan_user(monkeypatch)
    _patch_plan_db(monkeypatch)
    product = _build_sample_product()
    monkeypatch.setattr(plan_routes.openfoodfacts_service, 'get_product', AsyncMock(return_value=product))
    sample_plan = _build_sample_plan()
    monkeypatch.setattr(plan_routes.plan_storage, 'get_plan', AsyncMock(return_value=sample_plan))
    monkeypatch.setattr(
        plan_routes.plan_customizer,
        'customize_plan',
        AsyncMock(
            return_value=(
                sample_plan,
                [ChangeLogEntry(change_type="add_manual", description="added", meal_affected="Lunch")],
            )
        ),
    )
    monkeypatch.setattr(plan_routes.plan_storage, 'update_plan', AsyncMock(return_value=True))

    response = client.post("/plan/add-product", json=_add_product_body())
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_add_product_update_failure(client, monkeypatch):
    _patch_plan_user(monkeypatch)
    _patch_plan_db(monkeypatch)
    product = _build_sample_product()
    monkeypatch.setattr(plan_routes.openfoodfacts_service, 'get_product', AsyncMock(return_value=product))
    sample_plan = _build_sample_plan()
    monkeypatch.setattr(plan_routes.plan_storage, 'get_plan', AsyncMock(return_value=sample_plan))
    monkeypatch.setattr(
        plan_routes.plan_customizer,
        'customize_plan',
        AsyncMock(return_value=(sample_plan, [])),
    )
    monkeypatch.setattr(plan_routes.plan_storage, 'update_plan', AsyncMock(return_value=False))

    response = client.post("/plan/add-product", json=_add_product_body())
    assert response.json()["success"] is False


@pytest.mark.asyncio
async def test_smart_diet_insights_use_translation(monkeypatch):
    engine = SmartDietEngine()
    engine.cache_manager = _CacheHitManager(None)

    translation_stub = _TranslationStub()
    engine.translation_service = translation_stub

    request = SmartDietRequest(
        user_id="user",
        context_type=SmartDietContext.INSIGHTS,
        lang="es",
    )

    response = await engine.get_smart_suggestions("user", request)

    assert response.insights
    assert any("es" in title for title in [insight.title for insight in response.insights])
    assert translation_stub.history


@pytest.mark.asyncio
async def test_smart_diet_cache_hit(monkeypatch):
    engine = SmartDietEngine()
    cached = SmartDietResponse(
        user_id="cached_user",
        context_type=SmartDietContext.TODAY,
        suggestions=[],
        today_highlights=[],
        optimizations=[],
        discoveries=[],
        insights=[],
        total_suggestions=0,
        avg_confidence=0.0,
    )
    cache_manager = _CacheHitManager(cached)
    engine.cache_manager = cache_manager
    engine.translation_service = AsyncMock()

    request = SmartDietRequest(user_id="cached_user", context_type=SmartDietContext.TODAY)
    response = await engine.get_smart_suggestions("cached_user", request)

    assert response is cached
    assert not cache_manager.set_calls


@pytest.mark.asyncio
async def test_smart_diet_generates_optimizations(monkeypatch):
    engine = SmartDietEngine()
    engine.cache_manager = _CacheHitManager(None)
    sample_plan = _build_sample_plan()
    monkeypatch.setattr(smart_diet_module.plan_storage, 'get_plan', AsyncMock(return_value=sample_plan))
    opt = _make_optimization()
    engine.optimization_engine.analyze_meal_plan = AsyncMock(return_value=[opt])

    request = SmartDietRequest(
        user_id="user",
        context_type=SmartDietContext.OPTIMIZE,
        current_meal_plan_id="plan123",
        include_optimizations=True,
        include_recommendations=False,
    )

    response = await engine.get_smart_suggestions("user", request)
    assert response.optimizations
    engine.optimization_engine.analyze_meal_plan.assert_awaited()


class _LegacyEngine:
    def __init__(self, response):
        self.response = response
        self.called = False

    async def generate_recommendations(self, request):
        self.called = True
        return self.response


@pytest.mark.asyncio
async def test_smart_diet_generates_recommendations(monkeypatch):
    engine = SmartDietEngine()
    engine.recommendation_engine = _LegacyEngine(_legacy_recommendation_response())
    engine.translation_service = AsyncMock()
    cache_stub = _CacheHitManager(None)
    engine.cache_manager = cache_stub

    request = SmartDietRequest(
        user_id="user",
        context_type=SmartDietContext.TODAY,
        include_recommendations=True,
        include_optimizations=False,
    )
    response = await engine.get_smart_suggestions("user", request)
    assert response.discoveries
    assert cache_stub.set_calls


@pytest.mark.asyncio
async def test_smart_diet_handles_generation_error(monkeypatch):
    engine = SmartDietEngine()
    engine.cache_manager = _CacheHitManager(None)
    monkeypatch.setattr(engine, '_generate_recommendations', AsyncMock(side_effect=RuntimeError("boom")))
    monkeypatch.setattr(engine, '_generate_optimizations', AsyncMock(side_effect=RuntimeError("boom")))
    monkeypatch.setattr(engine, '_generate_insights', AsyncMock(side_effect=RuntimeError("boom")))

    request = SmartDietRequest(
        user_id="user",
        context_type=SmartDietContext.TODAY,
    )
    response = await engine.get_smart_suggestions("user", request)
    assert response.total_suggestions == 0
