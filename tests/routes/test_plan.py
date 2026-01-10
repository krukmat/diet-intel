from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from main import app
from app.routes.plan import (
    _validate_user_profile,
    _validate_plan_quality,
    _extract_error_message_from_log,
    _get_user_meal_plan,
)
from app.models.meal_plan import (
    MealPlanRequest,
    UserProfile,
    Preferences,
    MealPlanResponse,
    Meal,
    MealItem,
    MealItemMacros,
    DailyMacros,
    PlanCustomizationRequest,
    ChangeLogEntry,
    AddProductRequest,
)
from app.models.product import Nutriments, ProductResponse


@pytest.fixture
def client():
    return TestClient(app)


def build_plan() -> MealPlanResponse:
    macros = MealItemMacros(protein_g=10, fat_g=5, carbs_g=20, sugars_g=2, salt_g=0.5)
    item = MealItem(barcode="123", name="Item", serving="100g", calories=200, macros=macros)
    meal = Meal(name="Breakfast", target_calories=300, actual_calories=200, items=[item])
    totals = DailyMacros(
        total_calories=600,
        protein_g=20,
        fat_g=10,
        carbs_g=40,
        sugars_g=4,
        salt_g=1,
        protein_percent=20,
        fat_percent=30,
        carbs_percent=50,
    )
    return MealPlanResponse(
        bmr=1500,
        tdee=2000,
        daily_calorie_target=1800,
        meals=[meal],
        metrics=totals,
        plan_id=None,
        created_at=datetime.utcnow(),
        flexibility_used=False,
        optional_products_used=0,
    )


def build_request() -> MealPlanRequest:
    profile = UserProfile(
        age=30,
        sex="male",
        height_cm=175,
        weight_kg=70,
        activity_level="moderately_active",
        goal="maintain",
    )
    return MealPlanRequest(user_profile=profile, preferences=Preferences())


def test_generate_meal_plan_ok(client):
    plan = build_plan()
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.meal_planner", autospec=True) as mock_planner, \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage:
        mock_planner.generate_plan = AsyncMock(return_value=plan)
        mock_storage.store_plan = AsyncMock(return_value="plan-1")

        response = client.post("/plan/generate", json=build_request().model_dump())

    assert response.status_code == 200
    data = response.json()
    assert data["plan_id"] == "plan-1"


def test_generate_meal_plan_invalid_age(client):
    request = build_request().model_dump()
    request["user_profile"]["age"] = 9
    response = client.post("/plan/generate", json=request)
    assert response.status_code == 422


def test_generate_meal_plan_invalid_height(client):
    request = build_request().model_dump()
    request["user_profile"]["height_cm"] = 99
    response = client.post("/plan/generate", json=request)
    assert response.status_code == 422


def test_generate_meal_plan_value_error(client):
    plan = build_plan()
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.meal_planner", autospec=True) as mock_planner:
        mock_planner.generate_plan = AsyncMock(side_effect=ValueError("bad input"))
        response = client.post("/plan/generate", json=build_request().model_dump())

    assert response.status_code == 400


def test_generate_meal_plan_optional_products(client):
    plan = build_plan()
    request = build_request().model_dump()
    request["optional_products"] = ["123"]
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.meal_planner", autospec=True) as mock_planner, \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage:
        mock_planner.generate_plan = AsyncMock(return_value=plan)
        mock_storage.store_plan = AsyncMock(return_value="plan-1")
        response = client.post("/plan/generate", json=request)

    assert response.status_code == 200


def test_generate_meal_plan_http_exception(client):
    request = build_request().model_dump()
    with patch("app.routes.plan.get_session_user_id",
               AsyncMock(side_effect=HTTPException(status_code=401, detail="Unauthorized"))):
        response = client.post("/plan/generate", json=request)

    assert response.status_code == 401


def test_generate_meal_plan_unexpected_error(client):
    request = build_request().model_dump()
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.meal_planner", autospec=True) as mock_planner:
        mock_planner.generate_plan = AsyncMock(side_effect=Exception("boom"))
        response = client.post("/plan/generate", json=request)

    assert response.status_code == 500


def test_customize_plan_no_operations(client):
    response = client.put("/plan/customize/plan-1", json={})
    assert response.status_code == 400


def test_customize_plan_idempotent(client):
    plan = build_plan()
    customization = PlanCustomizationRequest(add_manual={
        "name": "Manual",
        "calories": 100,
        "protein_g": 1,
        "fat_g": 1,
        "carbs_g": 10,
        "serving": "1 serving",
    })
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage, \
         patch("app.routes.plan.plan_customizer", autospec=True) as mock_customizer:
        mock_storage.get_plan = AsyncMock(return_value=plan)
        mock_customizer.check_idempotency.return_value = True
        response = client.put("/plan/customize/plan-1", json=customization.model_dump())

    assert response.status_code == 200
    data = response.json()
    assert data["change_log"] == []


def test_customize_plan_not_found(client):
    customization = PlanCustomizationRequest(add_manual={
        "name": "Manual",
        "calories": 100,
        "protein_g": 1,
        "fat_g": 1,
        "carbs_g": 10,
        "serving": "1 serving",
    })
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage:
        mock_storage.get_plan = AsyncMock(return_value=None)
        response = client.put("/plan/customize/plan-404", json=customization.model_dump())

    assert response.status_code == 404


def test_customize_plan_ok(client):
    plan = build_plan()
    updated_plan = build_plan()
    log_entry = ChangeLogEntry(
        change_type="add_manual",
        description="added",
        meal_affected="Breakfast",
    )
    customization = PlanCustomizationRequest(add_manual={
        "name": "Manual",
        "calories": 100,
        "protein_g": 1,
        "fat_g": 1,
        "carbs_g": 10,
        "serving": "1 serving",
    })
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage, \
         patch("app.routes.plan.plan_customizer", autospec=True) as mock_customizer:
        mock_storage.get_plan = AsyncMock(return_value=plan)
        mock_customizer.check_idempotency.return_value = False
        mock_customizer.customize_plan = AsyncMock(return_value=(updated_plan, [log_entry]))
        mock_storage.update_plan = AsyncMock(return_value=True)
        response = client.put("/plan/customize/plan-1", json=customization.model_dump())

    assert response.status_code == 200
    data = response.json()
    assert data["plan_id"] == "plan-1"
    assert data["change_log"][0]["change_type"] == "add_manual"


def test_customize_plan_update_failure(client):
    plan = build_plan()
    customization = PlanCustomizationRequest(add_manual={
        "name": "Manual",
        "calories": 100,
        "protein_g": 1,
        "fat_g": 1,
        "carbs_g": 10,
        "serving": "1 serving",
    })
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage, \
         patch("app.routes.plan.plan_customizer", autospec=True) as mock_customizer:
        mock_storage.get_plan = AsyncMock(return_value=plan)
        mock_customizer.check_idempotency.return_value = False
        mock_customizer.customize_plan = AsyncMock(return_value=(plan, []))
        mock_storage.update_plan = AsyncMock(return_value=False)
        response = client.put("/plan/customize/plan-1", json=customization.model_dump())

    assert response.status_code == 500


def test_customize_plan_unexpected_error(client):
    plan = build_plan()
    customization = PlanCustomizationRequest(add_manual={
        "name": "Manual",
        "calories": 100,
        "protein_g": 1,
        "fat_g": 1,
        "carbs_g": 10,
        "serving": "1 serving",
    })
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage, \
         patch("app.routes.plan.plan_customizer", autospec=True) as mock_customizer:
        mock_storage.get_plan = AsyncMock(return_value=plan)
        mock_customizer.check_idempotency.return_value = False
        mock_customizer.customize_plan = AsyncMock(side_effect=Exception("boom"))
        response = client.put("/plan/customize/plan-1", json=customization.model_dump())

    assert response.status_code == 500


def test_get_meal_plan_not_found(client):
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage:
        mock_storage.get_plan = AsyncMock(return_value=None)
        response = client.get("/plan/plan-404")

    assert response.status_code == 404


def test_get_meal_plan_success(client):
    plan = build_plan()
    plan.plan_id = "plan-1"
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage:
        mock_storage.get_plan = AsyncMock(return_value=plan)
        response = client.get("/plan/plan-1")

    assert response.status_code == 200
    assert response.json()["plan_id"] == "plan-1"


def test_delete_meal_plan_not_found(client):
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage:
        mock_storage.delete_plan = AsyncMock(return_value=False)
        response = client.delete("/plan/plan-404")

    assert response.status_code == 404


def test_delete_meal_plan_success(client):
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage:
        mock_storage.delete_plan = AsyncMock(return_value=True)
        response = client.delete("/plan/plan-1")

    assert response.status_code == 200
    assert "deleted" in response.json()["message"].lower()


def test_add_product_invalid_meal_type(client):
    request = AddProductRequest(barcode="123", meal_type="snack").model_dump()
    response = client.post("/plan/add-product", json=request)
    assert response.status_code == 400


def test_add_product_no_plan(client):
    request = AddProductRequest(barcode="123", meal_type="lunch").model_dump()
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.MealPlanRepository.get_by_user_id", new_callable=AsyncMock) as mock_get_plans:
        mock_get_plans.return_value = []
        response = client.post("/plan/add-product", json=request)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False


def test_add_product_plan_invalid_id(client):
    request = AddProductRequest(barcode="123", meal_type="lunch").model_dump()
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.MealPlanRepository.get_by_user_id", new_callable=AsyncMock) as mock_get_plans:
        mock_get_plans.return_value = [SimpleNamespace(id=None)]
        response = client.post("/plan/add-product", json=request)

    assert response.status_code == 500


def test_add_product_lookup_error(client):
    request = AddProductRequest(barcode="123", meal_type="lunch").model_dump()
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.MealPlanRepository.get_by_user_id", new_callable=AsyncMock) as mock_get_plans, \
         patch("app.routes.plan.openfoodfacts_service", autospec=True) as mock_off:
        mock_get_plans.return_value = [SimpleNamespace(id="plan-1")]
        mock_off.get_product = AsyncMock(side_effect=Exception("offline"))
        response = client.post("/plan/add-product", json=request)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False


def test_add_product_not_found(client):
    request = AddProductRequest(barcode="123", meal_type="lunch").model_dump()
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.MealPlanRepository.get_by_user_id", new_callable=AsyncMock) as mock_get_plans, \
         patch("app.routes.plan.openfoodfacts_service", autospec=True) as mock_off:
        mock_get_plans.return_value = [SimpleNamespace(id="plan-1")]
        mock_off.get_product = AsyncMock(return_value=None)
        response = client.post("/plan/add-product", json=request)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False


def test_add_product_plan_missing(client):
    request = AddProductRequest(barcode="123", meal_type="lunch").model_dump()
    product = SimpleNamespace(name="Product", nutriments=None)
    plan = build_plan()
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.MealPlanRepository.get_by_user_id", new_callable=AsyncMock) as mock_get_plans, \
         patch("app.routes.plan.openfoodfacts_service", autospec=True) as mock_off, \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage:
        mock_get_plans.return_value = [SimpleNamespace(id="plan-1")]
        mock_off.get_product = AsyncMock(return_value=product)
        mock_storage.get_plan = AsyncMock(return_value=None)
        response = client.post("/plan/add-product", json=request)

    assert response.status_code == 200
    assert response.json()["success"] is False


def test_add_product_missing_nutriments(client):
    request = AddProductRequest(barcode="123", meal_type="lunch").model_dump()
    product = SimpleNamespace(name="Product", nutriments=None)
    plan = build_plan()
    change_log = [ChangeLogEntry(change_type="add_manual", description="added", meal_affected="Lunch")]
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.MealPlanRepository.get_by_user_id", new_callable=AsyncMock) as mock_get_plans, \
         patch("app.routes.plan.openfoodfacts_service", autospec=True) as mock_off, \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage, \
         patch("app.routes.plan.plan_customizer", autospec=True) as mock_customizer:
        mock_get_plans.return_value = [SimpleNamespace(id="plan-1")]
        mock_off.get_product = AsyncMock(return_value=product)
        mock_storage.get_plan = AsyncMock(return_value=plan)
        mock_customizer.customize_plan = AsyncMock(return_value=(plan, change_log))
        mock_storage.update_plan = AsyncMock(return_value=True)
        response = client.post("/plan/add-product", json=request)

    assert response.status_code == 200
    assert response.json()["success"] is True


def test_add_product_update_failure(client):
    request = AddProductRequest(barcode="123", meal_type="lunch").model_dump()
    product = SimpleNamespace(name="Product", nutriments=None)
    plan = build_plan()
    change_log = [ChangeLogEntry(change_type="add_manual", description="added", meal_affected="Lunch")]
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.MealPlanRepository.get_by_user_id", new_callable=AsyncMock) as mock_get_plans, \
         patch("app.routes.plan.openfoodfacts_service", autospec=True) as mock_off, \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage, \
         patch("app.routes.plan.plan_customizer", autospec=True) as mock_customizer:
        mock_get_plans.return_value = [SimpleNamespace(id="plan-1")]
        mock_off.get_product = AsyncMock(return_value=product)
        mock_storage.get_plan = AsyncMock(return_value=plan)
        mock_customizer.customize_plan = AsyncMock(return_value=(plan, change_log))
        mock_storage.update_plan = AsyncMock(return_value=False)
        response = client.post("/plan/add-product", json=request)

    assert response.status_code == 200
    assert response.json()["success"] is False


def test_add_product_change_log_failure(client):
    request = AddProductRequest(barcode="123", meal_type="lunch").model_dump()
    product = SimpleNamespace(name="Product", nutriments=None)
    plan = build_plan()
    change_log = [ChangeLogEntry(change_type="remove", description="failed", meal_affected="Lunch")]
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.MealPlanRepository.get_by_user_id", new_callable=AsyncMock) as mock_get_plans, \
         patch("app.routes.plan.openfoodfacts_service", autospec=True) as mock_off, \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage, \
         patch("app.routes.plan.plan_customizer", autospec=True) as mock_customizer:
        mock_get_plans.return_value = [SimpleNamespace(id="plan-1")]
        mock_off.get_product = AsyncMock(return_value=product)
        mock_storage.get_plan = AsyncMock(return_value=plan)
        mock_customizer.customize_plan = AsyncMock(return_value=(plan, change_log))
        mock_storage.update_plan = AsyncMock(return_value=True)
        response = client.post("/plan/add-product", json=request)

    assert response.status_code == 200
    assert response.json()["success"] is False


def test_add_product_unexpected_error(client):
    request = AddProductRequest(barcode="123", meal_type="lunch").model_dump()
    product = SimpleNamespace(name="Product", nutriments=None)
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.MealPlanRepository.get_by_user_id", new_callable=AsyncMock) as mock_get_plans, \
         patch("app.routes.plan.openfoodfacts_service", autospec=True) as mock_off, \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage:
        mock_get_plans.return_value = [SimpleNamespace(id="plan-1")]
        mock_off.get_product = AsyncMock(return_value=product)
        mock_storage.get_plan = AsyncMock(side_effect=Exception("boom"))
        response = client.post("/plan/add-product", json=request)

    assert response.status_code == 500


def test_add_product_success(client):
    request = AddProductRequest(barcode="123", meal_type="lunch").model_dump()
    product = ProductResponse(
        source="OpenFoodFacts",
        barcode="123",
        name="Product",
        brand="Brand",
        image_url=None,
        serving_size="100g",
        nutriments=Nutriments(
            energy_kcal_per_100g=250.0,
            protein_g_per_100g=10.0,
            fat_g_per_100g=5.0,
            carbs_g_per_100g=30.0,
            sugars_g_per_100g=3.0,
            salt_g_per_100g=0.4,
        ),
        fetched_at=datetime.utcnow(),
    )
    plan = build_plan()
    change_log = [ChangeLogEntry(change_type="add_manual", description="added", meal_affected="Lunch")]
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.MealPlanRepository.get_by_user_id", new_callable=AsyncMock) as mock_get_plans, \
         patch("app.routes.plan.openfoodfacts_service", autospec=True) as mock_off, \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage, \
         patch("app.routes.plan.plan_customizer", autospec=True) as mock_customizer:
        mock_get_plans.return_value = [SimpleNamespace(id="plan-1")]
        mock_off.get_product = AsyncMock(return_value=product)
        mock_storage.get_plan = AsyncMock(return_value=plan)
        mock_customizer.customize_plan = AsyncMock(return_value=(plan, change_log))
        mock_storage.update_plan = AsyncMock(return_value=True)
        response = client.post("/plan/add-product", json=request)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


def test_list_user_plans(client):
    plan = build_plan()
    plan.plan_id = "plan-1"
    plan.is_active = True

    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage:
        mock_storage.get_user_plans = AsyncMock(return_value=[plan])
        response = client.get("/plan/user?limit=5&offset=0")

    assert response.status_code == 200
    data = response.json()
    assert data[0]["plan_id"] == "plan-1"
    assert data[0]["is_active"] is True


def test_set_plan_activation_success(client):
    plan = build_plan()
    plan.plan_id = "plan-1"
    plan.is_active = True

    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage:
        mock_storage.set_plan_active_state = AsyncMock(return_value=plan)
        response = client.put("/plan/plan-1/activate", json={"is_active": True})

    assert response.status_code == 200
    assert response.json()["plan_id"] == "plan-1"


def test_set_plan_activation_not_found(client):
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage:
        mock_storage.set_plan_active_state = AsyncMock(return_value=None)
        response = client.put("/plan/plan-404/activate", json={"is_active": True})

    assert response.status_code == 404


def test_get_plan_config(client):
    response = client.get("/plan/config")
    assert response.status_code == 200
    data = response.json()
    assert "breakfast_percent" in data["meal_distribution"]


def test_validate_user_profile_invalid_values():
    with pytest.raises(HTTPException):
        _validate_user_profile(SimpleNamespace(age=9, height_cm=170, weight_kg=70))
    with pytest.raises(HTTPException):
        _validate_user_profile(SimpleNamespace(age=30, height_cm=99, weight_kg=70))
    with pytest.raises(HTTPException):
        _validate_user_profile(SimpleNamespace(age=30, height_cm=170, weight_kg=29))


def test_validate_plan_quality_within_tolerance():
    plan = build_plan()
    plan.daily_calorie_target = 600
    plan.metrics.total_calories = 600
    _validate_plan_quality(plan)


def test_extract_error_message_from_log():
    log = [ChangeLogEntry(change_type="remove", description="failed", meal_affected="Lunch")]
    assert _extract_error_message_from_log(log, "Product") == "Unknown error occurred"


@pytest.mark.asyncio
async def test_get_user_meal_plan_invalid_data():
    with patch("app.routes.plan.MealPlanRepository.get_by_user_id", new_callable=AsyncMock) as mock_get_plans:
        mock_get_plans.return_value = [SimpleNamespace(id=None)]
        with pytest.raises(HTTPException):
            await _get_user_meal_plan("user-1")
