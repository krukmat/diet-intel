"""
Add Product Endpoint Comprehensive Tests

Tests for the POST /plan/add-product endpoint covering:
- Successful product additions
- Error scenarios (no plan, product not found, API errors)
- Different meal types and serving sizes
- Integration with existing plan customization infrastructure
- Response structure validation
"""

import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
import uuid

from main import app
from app.models.meal_plan import (
    AddProductRequest, AddProductResponse,
    MealPlanResponse, Meal, MealItem, MealItemMacros, DailyMacros,
    UserProfile, Sex, ActivityLevel, Goal, ManualAddition,
    CustomizedPlanResponse, ChangeLogEntry
)
from app.models.product import ProductResponse, Nutriments


@pytest.fixture
def client():
    """Test client fixture"""
    return TestClient(app)


@pytest.fixture
def sample_product_data():
    """Sample ProductResponse data"""
    return ProductResponse(
        source="OpenFoodFacts",
        barcode="1234567890123",
        name="Greek Yogurt",
        brand="TestBrand",
        image_url="https://example.com/yogurt.jpg",
        serving_size="150g",
        nutriments=Nutriments(
            energy_kcal_per_100g=100,
            protein_g_per_100g=10.0,
            fat_g_per_100g=3.5,
            carbs_g_per_100g=8.0,
            sugars_g_per_100g=6.0,
            salt_g_per_100g=0.1
        ),
        fetched_at=datetime.now()
    )


@pytest.fixture
def sample_meal_plan():
    """Sample meal plan with existing items"""
    return MealPlanResponse(
        bmr=1800.0,
        tdee=2790.0,
        daily_calorie_target=2790.0,
        meals=[
            Meal(
                name="Breakfast",
                target_calories=697.5,
                actual_calories=400.0,
                items=[
                    MealItem(
                        barcode="existing_123",
                        name="Oatmeal",
                        serving="50g",
                        calories=200.0,
                        macros=MealItemMacros(
                            protein_g=6.0,
                            fat_g=3.0,
                            carbs_g=35.0,
                            sugars_g=1.0,
                            salt_g=0.1
                        )
                    )
                ]
            ),
            Meal(
                name="Lunch",
                target_calories=1116.0,
                actual_calories=600.0,
                items=[
                    MealItem(
                        barcode="lunch_456",
                        name="Chicken Salad",
                        serving="200g",
                        calories=300.0,
                        macros=MealItemMacros(
                            protein_g=25.0,
                            fat_g=15.0,
                            carbs_g=10.0,
                            sugars_g=5.0,
                            salt_g=0.5
                        )
                    )
                ]
            ),
            Meal(
                name="Dinner",
                target_calories=976.5,
                actual_calories=750.0,
                items=[]
            )
        ],
        metrics=DailyMacros(
            total_calories=1750.0,
            protein_g=80.0,
            fat_g=60.0,
            carbs_g=180.0,
            sugars_g=40.0,
            salt_g=2.0,
            protein_percent=18.3,
            fat_percent=30.9,
            carbs_percent=41.1
        ),
        flexibility_used=False,
        optional_products_used=0,
        plan_id="test-plan-123"
    )


class TestAddProductSuccess:
    """Test successful product addition scenarios"""
    
    def test_add_product_basic_success(self, client, sample_product_data, sample_meal_plan):
        """Test basic successful product addition to lunch"""
        request_data = {
            "barcode": "1234567890123",
            "meal_type": "lunch"
        }
        
        with patch('app.services.database.db_service.get_user_meal_plans', new_callable=AsyncMock) as mock_get_plans, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_get_product, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize, \
             patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get_plan, \
             patch('app.services.plan_storage.plan_storage.update_plan', new_callable=AsyncMock) as mock_update:
            
            # Mock getting user's most recent meal plan (db_service returns dict, not MealPlanResponse)
            mock_get_plans.return_value = [{"id": "test-plan-123", "plan_data": sample_meal_plan.model_dump()}]
            
            # Mock plan storage get_plan
            mock_get_plan.return_value = sample_meal_plan
            
            # Mock OpenFoodFacts API response
            mock_get_product.return_value = sample_product_data
            
            # Mock plan customization
            updated_plan = sample_meal_plan.model_copy()
            change_log = [
                ChangeLogEntry(
                    change_type="add_manual",
                    description="Added Greek Yogurt (100.0 kcal) to lunch",
                    meal_affected="lunch"
                )
            ]
            mock_customize.return_value = (updated_plan, change_log)
            mock_update.return_value = True
            
            response = client.post("/plan/add-product", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify response structure
            assert data["success"] is True
            assert "Greek Yogurt" in data["message"]
            assert "lunch" in data["message"].lower()
            assert data["meal_type"] == "lunch"
            assert data["product_name"] == "Greek Yogurt"
            assert data["calories_added"] == 100.0
            
            # Verify service calls
            mock_get_plans.assert_called_once()
            mock_get_product.assert_called_once_with("1234567890123")
            mock_get_plan.assert_called_once_with("test-plan-123")
            mock_customize.assert_called_once()
            mock_update.assert_called_once()
    
    def test_add_product_to_breakfast(self, client, sample_product_data, sample_meal_plan):
        """Test adding product to breakfast meal"""
        request_data = {
            "barcode": "1234567890123",
            "meal_type": "breakfast"
        }
        
        with patch('app.services.database.db_service.get_user_meal_plans', new_callable=AsyncMock) as mock_get_plans, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_get_product, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize, \
             patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get_plan, \
             patch('app.services.plan_storage.plan_storage.update_plan', new_callable=AsyncMock) as mock_update:
            
            mock_get_plans.return_value = [{"id": "test-plan-123", "plan_data": sample_meal_plan.model_dump()}]
            mock_get_plan.return_value = sample_meal_plan
            mock_get_product.return_value = sample_product_data
            
            updated_plan = sample_meal_plan.model_copy()
            change_log = [ChangeLogEntry(change_type="add_manual", description="Added Greek Yogurt (100.0 kcal) to breakfast", meal_affected="breakfast")]
            mock_customize.return_value = (updated_plan, change_log)
            mock_update.return_value = True
            
            response = client.post("/plan/add-product", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["meal_type"] == "breakfast"
            
            # Verify service calls
            mock_get_plans.assert_called_once()
            mock_get_product.assert_called_once_with("1234567890123")
            mock_get_plan.assert_called_once_with("test-plan-123")
            mock_customize.assert_called_once()
            mock_update.assert_called_once()
    
    def test_add_product_to_dinner(self, client, sample_product_data, sample_meal_plan):
        """Test adding product to dinner meal"""
        request_data = {
            "barcode": "1234567890123",
            "meal_type": "dinner"
        }
        
        with patch('app.services.database.db_service.get_user_meal_plans', new_callable=AsyncMock) as mock_get_plans, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_get_product, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize, \
             patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get_plan, \
             patch('app.services.plan_storage.plan_storage.update_plan', new_callable=AsyncMock) as mock_update:
            
            mock_get_plans.return_value = [{"id": "test-plan-123", "plan_data": sample_meal_plan.model_dump()}]
            mock_get_plan.return_value = sample_meal_plan
            mock_get_product.return_value = sample_product_data
            
            updated_plan = sample_meal_plan.model_copy()
            change_log = [ChangeLogEntry(change_type="add_manual", description="Added Greek Yogurt (100.0 kcal) to dinner", meal_affected="dinner")]
            mock_customize.return_value = (updated_plan, change_log)
            mock_update.return_value = True
            
            response = client.post("/plan/add-product", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["meal_type"] == "dinner"
            
            # Verify service calls
            mock_get_plans.assert_called_once()
            mock_get_product.assert_called_once_with("1234567890123")
            mock_get_plan.assert_called_once_with("test-plan-123")
            mock_customize.assert_called_once()
            mock_update.assert_called_once()
    
    def test_add_product_with_custom_serving(self, client, sample_product_data, sample_meal_plan):
        """Test adding product with custom serving size"""
        request_data = {
            "barcode": "1234567890123",
            "meal_type": "lunch",
            "serving_size": "200g"
        }
        
        with patch('app.services.database.db_service.get_user_meal_plans', new_callable=AsyncMock) as mock_get_plans, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_get_product, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize, \
             patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get_plan, \
             patch('app.services.plan_storage.plan_storage.update_plan', new_callable=AsyncMock) as mock_update:
            
            mock_get_plans.return_value = [{"id": "test-plan-123", "plan_data": sample_meal_plan.model_dump()}]
            mock_get_plan.return_value = sample_meal_plan
            mock_get_product.return_value = sample_product_data
            
            updated_plan = sample_meal_plan.model_copy()
            change_log = [ChangeLogEntry(change_type="add_manual", description="Added Greek Yogurt (200.0 kcal) to lunch", meal_affected="lunch")]
            mock_customize.return_value = (updated_plan, change_log)
            mock_update.return_value = True
            
            response = client.post("/plan/add-product", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            # Note: calories_added reflects the per-100g value from product, not scaled by serving
            assert data["calories_added"] == 100.0
    
    def test_add_product_default_lunch_meal(self, client, sample_product_data, sample_meal_plan):
        """Test adding product defaults to lunch when meal_type not specified"""
        request_data = {
            "barcode": "1234567890123"
            # No meal_type specified, should default to lunch
        }
        
        with patch('app.services.database.db_service.get_user_meal_plans', new_callable=AsyncMock) as mock_get_plans, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_get_product, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize, \
             patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get_plan, \
             patch('app.services.plan_storage.plan_storage.update_plan', new_callable=AsyncMock) as mock_update:
            
            mock_get_plans.return_value = [{"id": "test-plan-123", "plan_data": sample_meal_plan.model_dump()}]
            mock_get_plan.return_value = sample_meal_plan
            mock_get_product.return_value = sample_product_data
            
            updated_plan = sample_meal_plan.model_copy()
            change_log = [ChangeLogEntry(change_type="add_manual", description="Added Greek Yogurt (100.0 kcal) to lunch", meal_affected="lunch")]
            mock_customize.return_value = (updated_plan, change_log)
            mock_update.return_value = True
            
            response = client.post("/plan/add-product", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["meal_type"] == "lunch"


class TestAddProductErrors:
    """Test error scenarios for product addition"""
    
    def test_add_product_no_meal_plan(self, client, sample_product_data):
        """Test error when user has no meal plan"""
        request_data = {
            "barcode": "1234567890123",
            "meal_type": "lunch"
        }
        
        with patch('app.services.database.db_service.get_user_meal_plans', new_callable=AsyncMock) as mock_get_plans:
            mock_get_plans.return_value = []  # No meal plans
            
            response = client.post("/plan/add-product", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is False
            assert "no active meal plan" in data["message"].lower()
            assert data["meal_type"] is None
            assert data["product_name"] is None
            assert data["calories_added"] is None
    
    def test_add_product_not_found(self, client, sample_meal_plan):
        """Test error when product not found in OpenFoodFacts"""
        request_data = {
            "barcode": "9999999999999",  # Non-existent barcode
            "meal_type": "lunch"
        }
        
        with patch('app.services.database.db_service.get_user_meal_plans', new_callable=AsyncMock) as mock_get_plans, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_get_product:
            
            mock_get_plans.return_value = [{"id": "test-plan-123", "plan_data": sample_meal_plan.model_dump()}]
            mock_get_product.return_value = None  # Product not found
            
            response = client.post("/plan/add-product", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is False
            assert "product not found" in data["message"].lower()
            assert data["meal_type"] is None
            assert data["product_name"] is None
            assert data["calories_added"] is None
    
    def test_add_product_openfoodfacts_api_error(self, client, sample_meal_plan):
        """Test error when OpenFoodFacts API fails"""
        request_data = {
            "barcode": "1234567890123",
            "meal_type": "lunch"
        }
        
        with patch('app.services.database.db_service.get_user_meal_plans', new_callable=AsyncMock) as mock_get_plans, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_get_product:
            
            mock_get_plans.return_value = [{"id": "test-plan-123", "plan_data": sample_meal_plan.model_dump()}]
            mock_get_product.side_effect = Exception("API timeout")
            
            response = client.post("/plan/add-product", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is False
            assert "failed to retrieve product information" in data["message"].lower()
    
    def test_add_product_customization_fails(self, client, sample_product_data, sample_meal_plan):
        """Test error when plan customization fails"""
        request_data = {
            "barcode": "1234567890123",
            "meal_type": "lunch"
        }
        
        with patch('app.services.database.db_service.get_user_meal_plans', new_callable=AsyncMock) as mock_get_plans, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_get_product, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize:
            
            mock_get_plans.return_value = [{"id": "test-plan-123", "plan_data": sample_meal_plan.model_dump()}]
            mock_get_product.return_value = sample_product_data
            mock_customize.side_effect = Exception("Customization error")
            
            response = client.post("/plan/add-product", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is False
            assert "failed to add product to meal plan" in data["message"].lower()
    
    def test_add_product_plan_update_fails(self, client, sample_product_data, sample_meal_plan):
        """Test error when plan storage update fails"""
        request_data = {
            "barcode": "1234567890123",
            "meal_type": "lunch"
        }
        
        with patch('app.services.database.db_service.get_user_meal_plans', new_callable=AsyncMock) as mock_get_plans, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_get_product, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize, \
             patch('app.services.plan_storage.plan_storage.update_plan', new_callable=AsyncMock) as mock_update:
            
            mock_get_plans.return_value = [{"id": "test-plan-123", "plan_data": sample_meal_plan.model_dump()}]
            mock_get_product.return_value = sample_product_data
            
            updated_plan = sample_meal_plan.model_copy()
            change_log = [ChangeLogEntry(change_type="add_manual", description="Added Greek Yogurt", meal_affected="lunch")]
            mock_customize.return_value = (updated_plan, change_log)
            mock_update.return_value = False  # Update fails
            
            response = client.post("/plan/add-product", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is False
            assert "failed to save updated meal plan" in data["message"].lower()
    
    def test_add_product_invalid_meal_type(self, client, sample_product_data, sample_meal_plan):
        """Test handling of invalid meal type"""
        request_data = {
            "barcode": "1234567890123",
            "meal_type": "snack"  # Invalid meal type
        }
        
        with patch('app.services.database.db_service.get_user_meal_plans', new_callable=AsyncMock) as mock_get_plans, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_get_product, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize, \
             patch('app.services.plan_storage.plan_storage.update_plan', new_callable=AsyncMock) as mock_update:
            
            mock_get_plans.return_value = [{"id": "test-plan-123", "plan_data": sample_meal_plan.model_dump()}]
            mock_get_product.return_value = sample_product_data
            
            # Should still work but default to lunch
            updated_plan = sample_meal_plan.model_copy()
            change_log = [ChangeLogEntry(change_type="add_manual", description="Added Greek Yogurt (150.0 kcal) to lunch", meal_affected="lunch")]
            mock_customize.return_value = (updated_plan, change_log)
            mock_update.return_value = True
            
            response = client.post("/plan/add-product", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["meal_type"] == "lunch"  # Should default to lunch


class TestAddProductValidation:
    """Test request validation for add product endpoint"""
    
    def test_add_product_missing_barcode(self, client):
        """Test error when barcode is missing"""
        request_data = {
            "meal_type": "lunch"
            # Missing barcode
        }
        
        response = client.post("/plan/add-product", json=request_data)
        assert response.status_code == 422  # Pydantic validation error
    
    def test_add_product_empty_barcode(self, client):
        """Test error when barcode is empty"""
        request_data = {
            "barcode": "",
            "meal_type": "lunch"
        }
        
        response = client.post("/plan/add-product", json=request_data)
        assert response.status_code == 422  # Pydantic validation error
    
    def test_add_product_invalid_json(self, client):
        """Test error when request JSON is invalid"""
        response = client.post("/plan/add-product", data="invalid json")
        assert response.status_code == 422


class TestAddProductIntegration:
    """Integration tests for add product functionality"""
    
    def test_add_product_complete_workflow(self, client, sample_product_data, sample_meal_plan):
        """Test complete workflow: lookup -> customize -> update"""
        request_data = {
            "barcode": "1234567890123",
            "meal_type": "breakfast",
            "serving_size": "100g"
        }
        
        with patch('app.services.database.db_service.get_user_meal_plans', new_callable=AsyncMock) as mock_get_plans, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_get_product, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize, \
             patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get_plan, \
             patch('app.services.plan_storage.plan_storage.update_plan', new_callable=AsyncMock) as mock_update:
            
            mock_get_plans.return_value = [{"id": "test-plan-123", "plan_data": sample_meal_plan.model_dump()}]
            mock_get_plan.return_value = sample_meal_plan
            mock_get_product.return_value = sample_product_data
            
            updated_plan = sample_meal_plan.model_copy()
            change_log = [ChangeLogEntry(change_type="add_manual", description="Added Greek Yogurt (100.0 kcal) to breakfast", meal_affected="breakfast")]
            mock_customize.return_value = (updated_plan, change_log)
            mock_update.return_value = True
            
            response = client.post("/plan/add-product", json=request_data)
            
            # Verify successful response
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["product_name"] == "Greek Yogurt"
            assert data["meal_type"] == "breakfast"
            assert data["calories_added"] == 100.0
            
            # Verify all services were called correctly
            mock_get_plans.assert_called_once()
            mock_get_product.assert_called_once_with("1234567890123")
            
            # Verify customize_plan was called with correct ManualAddition
            mock_customize.assert_called_once()
            call_args = mock_customize.call_args
            assert call_args[0][0] == sample_meal_plan  # MealPlanResponse object
            customization_request = call_args[0][1]  # PlanCustomizationRequest
            assert customization_request.add_manual is not None
            assert customization_request.add_manual.name == "Greek Yogurt"
            assert customization_request.add_manual.calories == 100.0
            assert customization_request.add_manual.serving == "100g"
            
            mock_update.assert_called_once_with("test-plan-123", updated_plan)
    
    def test_add_product_nutrition_calculation(self, client, sample_meal_plan):
        """Test that nutrition values are calculated correctly from OpenFoodFacts data"""
        # Product with specific nutrition values
        product_data = ProductResponse(
            source="Test",
            barcode="test123",
            name="Test Product",
            brand="TestBrand",
            serving_size="100g",
            nutriments=Nutriments(
                energy_kcal_per_100g=250,    # 250 kcal per 100g
                protein_g_per_100g=20.0,     # 20g protein per 100g
                fat_g_per_100g=15.0,         # 15g fat per 100g
                carbs_g_per_100g=10.0,       # 10g carbs per 100g
                sugars_g_per_100g=5.0,       # 5g sugars per 100g
                salt_g_per_100g=0.5          # 0.5g salt per 100g
            ),
            fetched_at=datetime.now()
        )
        
        request_data = {
            "barcode": "test123",
            "meal_type": "dinner",
            "serving_size": "50g"  # Half serving
        }
        
        with patch('app.services.database.db_service.get_user_meal_plans', new_callable=AsyncMock) as mock_get_plans, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_get_product, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize, \
             patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get_plan, \
             patch('app.services.plan_storage.plan_storage.update_plan', new_callable=AsyncMock) as mock_update:
            
            mock_get_plans.return_value = [{"id": "test-plan-123", "plan_data": sample_meal_plan.model_dump()}]
            mock_get_plan.return_value = sample_meal_plan
            mock_get_product.return_value = product_data
            
            updated_plan = sample_meal_plan.model_copy()
            change_log = [ChangeLogEntry(change_type="add_manual", description="Added Test Product", meal_affected="dinner")]
            mock_customize.return_value = (updated_plan, change_log)
            mock_update.return_value = True
            
            response = client.post("/plan/add-product", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["calories_added"] == 125.0  # 250 * 0.5 = 125 kcal for 50g
            
            # Check that ManualAddition was created with correct nutrition values (50g serving)
            mock_customize.assert_called_once()
            call_args = mock_customize.call_args
            manual_addition = call_args[0][1].add_manual
            assert manual_addition.calories == 125.0    # 250 * 0.5
            assert manual_addition.protein_g == 10.0    # 20 * 0.5
            assert manual_addition.fat_g == 7.5         # 15 * 0.5
            assert manual_addition.carbs_g == 5.0       # 10 * 0.5
            assert manual_addition.sugars_g == 2.5      # 5 * 0.5
            assert manual_addition.salt_g == 0.25       # 0.5 * 0.5
    
    def test_add_multiple_products_sequential(self, client, sample_meal_plan):
        """Test adding multiple products to the same plan"""
        products = [
            {
                "barcode": "product1",
                "data": ProductResponse(
                    source="Test",
                    barcode="product1",
                    name="Product 1",
                    nutriments=Nutriments(energy_kcal_per_100g=100),
                    fetched_at=datetime.now()
                ),
                "meal": "breakfast"
            },
            {
                "barcode": "product2", 
                "data": ProductResponse(
                    source="Test",
                    barcode="product2",
                    name="Product 2",
                    nutriments=Nutriments(energy_kcal_per_100g=200),
                    fetched_at=datetime.now()
                ),
                "meal": "lunch"
            },
            {
                "barcode": "product3",
                "data": ProductResponse(
                    source="Test",
                    barcode="product3",
                    name="Product 3",
                    nutriments=Nutriments(energy_kcal_per_100g=300),
                    fetched_at=datetime.now()
                ),
                "meal": "dinner"
            }
        ]
        
        with patch('app.services.database.db_service.get_user_meal_plans', new_callable=AsyncMock) as mock_get_plans, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_get_product, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize, \
             patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get_plan, \
             patch('app.services.plan_storage.plan_storage.update_plan', new_callable=AsyncMock) as mock_update:
            
            mock_get_plans.return_value = [{"id": "test-plan-123", "plan_data": sample_meal_plan.model_dump()}]
            mock_get_plan.return_value = sample_meal_plan
            mock_update.return_value = True
            
            for i, product in enumerate(products):
                mock_get_product.return_value = product["data"]
                
                updated_plan = sample_meal_plan.model_copy()
                change_log = [ChangeLogEntry(change_type="add_manual", description=f"Added {product['data'].name}", meal_affected=product["meal"])]
                mock_customize.return_value = (updated_plan, change_log)
                
                request_data = {
                    "barcode": product["barcode"],
                    "meal_type": product["meal"]
                }
                
                response = client.post("/plan/add-product", json=request_data)
                
                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["product_name"] == product["data"].name
                assert data["meal_type"] == product["meal"]
            
            # Should have made 3 calls total
            assert mock_get_product.call_count == 3
            assert mock_customize.call_count == 3
            assert mock_update.call_count == 3