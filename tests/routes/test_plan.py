from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from main import app
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


def test_customize_plan_no_operations(client):
    response = client.put("/plan/customize/plan-1", json={})
    assert response.status_code == 400


def test_customize_plan_idempotent(client):
    plan = build_plan()
    customization = PlanCustomizationRequest(add_manual=None)
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage, \
         patch("app.routes.plan.plan_customizer", autospec=True) as mock_customizer:
        mock_storage.get_plan = AsyncMock(return_value=plan)
        mock_customizer.check_idempotency.return_value = True
        response = client.put("/plan/customize/plan-1", json=customization.model_dump())

    assert response.status_code == 400


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


def test_get_meal_plan_not_found(client):
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage:
        mock_storage.get_plan = AsyncMock(return_value=None)
        response = client.get("/plan/plan-404")

    assert response.status_code == 404


def test_delete_meal_plan_not_found(client):
    with patch("app.routes.plan.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.plan.plan_storage", autospec=True) as mock_storage:
        mock_storage.delete_plan = AsyncMock(return_value=False)
        response = client.delete("/plan/plan-404")

    assert response.status_code == 404


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
