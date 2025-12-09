import pytest
from unittest.mock import patch, AsyncMock
from datetime import datetime
from fastapi.testclient import TestClient
from main import app
from app.models.meal_plan import (
    MealPlanResponse, Meal, MealItem, MealItemMacros, DailyMacros,
    SwapOperation, RemoveOperation, ManualAddition, MealCalorieAdjustment,
    PlanCustomizationRequest
)
from app.models.product import ProductResponse, Nutriments
from app.services.plan_customizer import PlanCustomizerService


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_meal_item():
    return MealItem(
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


@pytest.fixture
def sample_meal(sample_meal_item):
    return Meal(
        name="Breakfast",
        target_calories=500.0,
        actual_calories=175.0,
        items=[sample_meal_item]
    )


@pytest.fixture
def sample_meal_plan(sample_meal):
    return MealPlanResponse(
        bmr=1730.0,
        tdee=2681.5,
        daily_calorie_target=2681.5,
        meals=[sample_meal],
        metrics=DailyMacros(
            total_calories=175.0,
            protein_g=8.5,
            fat_g=3.0,
            carbs_g=30.0,
            sugars_g=1.0,
            salt_g=0.0,
            protein_percent=19.4,
            fat_percent=15.4,
            carbs_percent=68.6
        ),
        flexibility_used=False,
        optional_products_used=0
    )


@pytest.fixture
def replacement_product():
    return ProductResponse(
        source="Test",
        barcode="000000000002",
        name="Test Banana",
        brand="TestBrand",
        image_url=None,
        serving_size="120g",
        nutriments=Nutriments(
            energy_kcal_per_100g=89.0,
            protein_g_per_100g=1.1,
            fat_g_per_100g=0.3,
            carbs_g_per_100g=22.8,
            sugars_g_per_100g=12.2,
            salt_g_per_100g=0.0
        ),
        fetched_at=datetime.now()
    )


class TestPlanCustomizerService:
    """Test the plan customization service directly"""
    
    @pytest.mark.asyncio
    async def test_swap_operation_success(self, sample_meal_plan, replacement_product):
        """Test successful item swap"""
        customizer = PlanCustomizerService()
        
        swap_request = PlanCustomizationRequest(
            swap=SwapOperation(
                old_barcode="000000000001",
                new_barcode="000000000002"
            )
        )
        
        # Mock the product cache lookup
        with patch.object(customizer, '_get_product_from_cache', return_value=replacement_product):
            updated_plan, change_log = await customizer.customize_plan(sample_meal_plan, swap_request)
            
            # Verify swap occurred
            assert len(updated_plan.meals[0].items) == 1
            assert updated_plan.meals[0].items[0].barcode == "000000000002"
            assert updated_plan.meals[0].items[0].name == "Test Banana"
            
            # Verify change log
            assert len(change_log) == 1
            assert change_log[0].change_type == "swap"
            assert "Swapped" in change_log[0].description
            assert change_log[0].meal_affected == "Breakfast"
    
    @pytest.mark.asyncio
    async def test_swap_operation_item_not_found(self, sample_meal_plan, replacement_product):
        """Test swap operation when original item not found"""
        customizer = PlanCustomizerService()
        
        swap_request = PlanCustomizationRequest(
            swap=SwapOperation(
                old_barcode="999999999999",  # Non-existent barcode
                new_barcode="000000000002"
            )
        )
        
        with patch.object(customizer, '_get_product_from_cache', return_value=replacement_product):
            updated_plan, change_log = await customizer.customize_plan(sample_meal_plan, swap_request)
            
            # Plan should be unchanged
            assert updated_plan.meals[0].items[0].barcode == "000000000001"
            
            # Should have failure log
            assert len(change_log) == 1
            assert change_log[0].change_type == "swap_failed"
    
    @pytest.mark.asyncio
    async def test_swap_operation_replacement_not_found(self, sample_meal_plan):
        """Test swap operation when replacement product not found"""
        customizer = PlanCustomizerService()
        
        swap_request = PlanCustomizationRequest(
            swap=SwapOperation(
                old_barcode="000000000001",
                new_barcode="999999999999"  # Non-existent replacement
            )
        )
        
        with patch.object(customizer, '_get_product_from_cache', return_value=None):
            updated_plan, change_log = await customizer.customize_plan(sample_meal_plan, swap_request)
            
            # Plan should be unchanged
            assert updated_plan.meals[0].items[0].barcode == "000000000001"
            
            # Should have failure log
            assert len(change_log) == 1
            assert change_log[0].change_type == "swap_failed"
    
    @pytest.mark.asyncio
    async def test_remove_operation_success(self, sample_meal_plan):
        """Test successful item removal"""
        customizer = PlanCustomizerService()
        
        remove_request = PlanCustomizationRequest(
            remove=RemoveOperation(barcode="000000000001")
        )
        
        updated_plan, change_log = await customizer.customize_plan(sample_meal_plan, remove_request)
        
        # Item should be removed
        assert len(updated_plan.meals[0].items) == 0
        assert updated_plan.meals[0].actual_calories == 0.0
        
        # Verify change log
        assert len(change_log) == 1
        assert change_log[0].change_type == "remove"
        assert "Removed" in change_log[0].description
        assert change_log[0].meal_affected == "Breakfast"
    
    @pytest.mark.asyncio
    async def test_remove_operation_item_not_found(self, sample_meal_plan):
        """Test remove operation when item not found"""
        customizer = PlanCustomizerService()
        
        remove_request = PlanCustomizationRequest(
            remove=RemoveOperation(barcode="999999999999")
        )
        
        updated_plan, change_log = await customizer.customize_plan(sample_meal_plan, remove_request)
        
        # Plan should be unchanged
        assert len(updated_plan.meals[0].items) == 1
        
        # Should have failure log
        assert len(change_log) == 1
        assert change_log[0].change_type == "remove_failed"
    
    @pytest.mark.asyncio
    async def test_manual_addition_success(self, sample_meal_plan):
        """Test successful manual item addition"""
        customizer = PlanCustomizerService()
        
        manual_item = ManualAddition(
            name="Custom Protein Bar",
            calories=200.0,
            protein_g=20.0,
            fat_g=8.0,
            carbs_g=15.0,
            serving="1 bar"
        )
        
        add_request = PlanCustomizationRequest(add_manual=manual_item)
        
        updated_plan, change_log = await customizer.customize_plan(sample_meal_plan, add_request)
        
        # Item should be added
        assert len(updated_plan.meals[0].items) == 2
        new_item = updated_plan.meals[0].items[1]
        assert new_item.name == "Custom Protein Bar"
        assert new_item.calories == 200.0
        assert new_item.macros.protein_g == 20.0
        assert new_item.barcode.startswith("manual_")
        
        # Meal calories should be updated
        assert updated_plan.meals[0].actual_calories == 375.0  # 175 + 200
        
        # Verify change log
        assert len(change_log) == 1
        assert change_log[0].change_type == "add_manual"
        assert "Added manual item" in change_log[0].description
    
    @pytest.mark.asyncio
    async def test_calorie_adjustment_success(self, sample_meal_plan):
        """Test successful meal calorie adjustment"""
        customizer = PlanCustomizerService()
        
        adjustment = MealCalorieAdjustment(
            meal_name="Breakfast",
            new_target=600.0
        )
        
        adjust_request = PlanCustomizationRequest(adjust_meal_calories=adjustment)
        
        updated_plan, change_log = await customizer.customize_plan(sample_meal_plan, adjust_request)
        
        # Target should be updated
        assert updated_plan.meals[0].target_calories == 600.0
        
        # Daily target should be adjusted
        assert updated_plan.daily_calorie_target == 2781.5  # 2681.5 + 100
        
        # Verify change log
        assert len(change_log) == 1
        assert change_log[0].change_type == "adjust_calories"
        assert "Adjusted Breakfast target" in change_log[0].description
    
    @pytest.mark.asyncio
    async def test_calorie_adjustment_meal_not_found(self, sample_meal_plan):
        """Test calorie adjustment when meal not found"""
        customizer = PlanCustomizerService()
        
        adjustment = MealCalorieAdjustment(
            meal_name="NonExistentMeal",
            new_target=600.0
        )
        
        adjust_request = PlanCustomizationRequest(adjust_meal_calories=adjustment)
        
        updated_plan, change_log = await customizer.customize_plan(sample_meal_plan, adjust_request)
        
        # Plan should be unchanged
        assert updated_plan.meals[0].target_calories == 500.0
        assert updated_plan.daily_calorie_target == 2681.5
        
        # Should have failure log
        assert len(change_log) == 1
        assert change_log[0].change_type == "adjust_calories_failed"
    
    @pytest.mark.asyncio
    async def test_multiple_operations(self, sample_meal_plan, replacement_product):
        """Test applying multiple operations in sequence"""
        customizer = PlanCustomizerService()
        
        # Create a plan with two items for testing
        second_item = MealItem(
            barcode="000000000003",
            name="Test Rice",
            serving="100g",
            calories=130.0,
            macros=MealItemMacros(protein_g=2.7, fat_g=0.3, carbs_g=28.0, sugars_g=0.1, salt_g=0.0)
        )
        sample_meal_plan.meals[0].items.append(second_item)
        sample_meal_plan.meals[0].actual_calories = 305.0
        
        multi_request = PlanCustomizationRequest(
            swap=SwapOperation(old_barcode="000000000001", new_barcode="000000000002"),
            remove=RemoveOperation(barcode="000000000003"),
            add_manual=ManualAddition(name="Custom Snack", calories=150.0, serving="1 pack")
        )
        
        with patch.object(customizer, '_get_product_from_cache', return_value=replacement_product):
            updated_plan, change_log = await customizer.customize_plan(sample_meal_plan, multi_request)
            
            # Should have 2 items: swapped item + manual item (original second item removed)
            assert len(updated_plan.meals[0].items) == 2
            
            # Verify all operations in change log
            assert len(change_log) == 3
            change_types = [log.change_type for log in change_log]
            assert "swap" in change_types
            assert "remove" in change_types
            assert "add_manual" in change_types
    
    def test_idempotency_check_swap_self(self, sample_meal_plan):
        """Test idempotency check for swapping item with itself"""
        customizer = PlanCustomizerService()
        
        swap_request = PlanCustomizationRequest(
            swap=SwapOperation(
                old_barcode="000000000001",
                new_barcode="000000000001"  # Same as old
            )
        )
        
        is_idempotent = customizer.check_idempotency(sample_meal_plan, swap_request)
        assert is_idempotent is True
    
    def test_idempotency_check_remove_nonexistent(self, sample_meal_plan):
        """Test idempotency check for removing non-existent item"""
        customizer = PlanCustomizerService()
        
        remove_request = PlanCustomizationRequest(
            remove=RemoveOperation(barcode="999999999999")
        )
        
        is_idempotent = customizer.check_idempotency(sample_meal_plan, remove_request)
        assert is_idempotent is True


class TestCustomizationEndpoint:
    """Test the customization endpoint"""
    
    def test_customize_missing_plan(self, client):
        """Test customization with non-existent plan ID"""
        customization = {
            "remove": {"barcode": "000000000001"}
        }
        
        response = client.put("/plan/customize/non-existent-id", json=customization)
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    def test_customize_no_operations(self, client):
        """Test customization with no operations specified"""
        customization = {}  # Empty request
        
        response = client.put("/plan/customize/some-id", json=customization)
        
        assert response.status_code == 400
        assert "at least one" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_customize_swap_success(self, client, sample_meal_plan, replacement_product):
        """Test successful swap via endpoint"""
        plan_id = "test-plan-123"
        
        customization = {
            "swap": {
                "old_barcode": "000000000001",
                "new_barcode": "000000000002"
            }
        }
        
        with patch('app.services.plan_storage.plan_storage.get_plan', return_value=sample_meal_plan), \
             patch('app.services.plan_storage.plan_storage.update_plan', return_value=True), \
             patch('app.services.plan_customizer.plan_customizer._get_product_from_cache', return_value=replacement_product):
            
            response = client.put(f"/plan/customize/{plan_id}", json=customization)
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify response structure
            assert "plan" in data
            assert "change_log" in data
            assert "plan_id" in data
            assert data["plan_id"] == plan_id
            
            # Verify change log
            assert len(data["change_log"]) == 1
            assert data["change_log"][0]["change_type"] == "swap"
            assert "meal_affected" in data["change_log"][0]
    
    @pytest.mark.asyncio
    async def test_customize_remove_success(self, client, sample_meal_plan):
        """Test successful remove via endpoint"""
        plan_id = "test-plan-456"
        
        customization = {
            "remove": {"barcode": "000000000001"}
        }
        
        with patch('app.services.plan_storage.plan_storage.get_plan', return_value=sample_meal_plan), \
             patch('app.services.plan_storage.plan_storage.update_plan', return_value=True):
            
            response = client.put(f"/plan/customize/{plan_id}", json=customization)
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify change log
            assert len(data["change_log"]) == 1
            assert data["change_log"][0]["change_type"] == "remove"
    
    @pytest.mark.asyncio
    async def test_customize_add_manual_success(self, client, sample_meal_plan):
        """Test successful manual addition via endpoint"""
        plan_id = "test-plan-789"
        
        customization = {
            "add_manual": {
                "name": "Custom Energy Bar",
                "calories": 250.0,
                "protein_g": 15.0,
                "fat_g": 10.0,
                "carbs_g": 20.0,
                "serving": "1 bar"
            }
        }
        
        with patch('app.services.plan_storage.plan_storage.get_plan', return_value=sample_meal_plan), \
             patch('app.services.plan_storage.plan_storage.update_plan', return_value=True):
            
            response = client.put(f"/plan/customize/{plan_id}", json=customization)
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify change log
            assert len(data["change_log"]) == 1
            assert data["change_log"][0]["change_type"] == "add_manual"
    
    @pytest.mark.asyncio
    async def test_customize_idempotent_request(self, client, sample_meal_plan):
        """Test idempotent customization request"""
        plan_id = "test-plan-idem"
        
        # Try to remove an item that doesn't exist
        customization = {
            "remove": {"barcode": "999999999999"}
        }
        
        with patch('app.services.plan_storage.plan_storage.get_plan', return_value=sample_meal_plan):
            response = client.put(f"/plan/customize/{plan_id}", json=customization)
            
            assert response.status_code == 200
            data = response.json()
            
            # Should have empty change log for idempotent request
            assert len(data["change_log"]) == 0
    
    def test_customize_storage_failure(self, client, sample_meal_plan):
        """Test customization when storage update fails"""
        plan_id = "test-plan-fail"
        
        customization = {
            "remove": {"barcode": "000000000001"}
        }
        
        with patch('app.services.plan_storage.plan_storage.get_plan', return_value=sample_meal_plan), \
             patch('app.services.plan_storage.plan_storage.update_plan', return_value=False):
            
            response = client.put(f"/plan/customize/{plan_id}", json=customization)
            
            assert response.status_code == 500
            assert "save plan updates" in response.json()["detail"]


class TestPlanStorageEndpoints:
    """Test plan storage CRUD endpoints"""
    
    @pytest.mark.asyncio
    async def test_get_plan_success(self, client, sample_meal_plan):
        """Test successful plan retrieval"""
        plan_id = "test-get-123"
        
        with patch('app.services.plan_storage.plan_storage.get_plan', return_value=sample_meal_plan):
            response = client.get(f"/plan/{plan_id}")
            
            assert response.status_code == 200
            data = response.json()
            assert data["bmr"] == 1730.0
            assert data["tdee"] == 2681.5
    
    def test_get_plan_not_found(self, client):
        """Test plan retrieval when plan doesn't exist"""
        plan_id = "non-existent"
        
        with patch('app.services.plan_storage.plan_storage.get_plan', return_value=None):
            response = client.get(f"/plan/{plan_id}")
            
            assert response.status_code == 404
            assert "not found" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_delete_plan_success(self, client):
        """Test successful plan deletion"""
        plan_id = "test-delete-123"
        
        with patch('app.services.plan_storage.plan_storage.delete_plan', return_value=True):
            response = client.delete(f"/plan/{plan_id}")
            
            assert response.status_code == 200
            assert "deleted successfully" in response.json()["message"]
    
    def test_delete_plan_not_found(self, client):
        """Test plan deletion when plan doesn't exist"""
        plan_id = "non-existent"
        
        with patch('app.services.plan_storage.plan_storage.delete_plan', return_value=False):
            response = client.delete(f"/plan/{plan_id}")
            
            assert response.status_code == 404
            assert "not found" in response.json()["detail"]


def test_metrics_recalculation():
    """Test that metrics are properly recalculated after modifications"""
    from app.services.plan_customizer import PlanCustomizerService
    
    # Create a sample plan
    item1 = MealItem(
        barcode="001", name="Item1", serving="100g", calories=200,
        macros=MealItemMacros(protein_g=10, fat_g=5, carbs_g=30, sugars_g=2, salt_g=0.5)
    )
    item2 = MealItem(
        barcode="002", name="Item2", serving="50g", calories=150,
        macros=MealItemMacros(protein_g=8, fat_g=3, carbs_g=25, sugars_g=1, salt_g=0.3)
    )
    
    meal = Meal(name="Test", target_calories=400, actual_calories=350, items=[item1, item2])
    
    plan = MealPlanResponse(
        bmr=1500, tdee=2000, daily_calorie_target=2000,
        meals=[meal], metrics=DailyMacros(
            total_calories=0, protein_g=0, fat_g=0, carbs_g=0,
            sugars_g=0, salt_g=0, protein_percent=0, fat_percent=0, carbs_percent=0
        ),
        flexibility_used=False, optional_products_used=0
    )
    
    customizer = PlanCustomizerService()
    customizer._recalculate_metrics(plan)
    
    # Verify totals
    assert plan.metrics.total_calories == 350.0  # 200 + 150
    assert plan.metrics.protein_g == 18.0        # 10 + 8
    assert plan.metrics.fat_g == 8.0             # 5 + 3
    assert plan.metrics.carbs_g == 55.0          # 30 + 25
    
    # Verify percentages are reasonable
    assert plan.metrics.protein_percent > 0
    assert plan.metrics.fat_percent > 0
    assert plan.metrics.carbs_percent > 0