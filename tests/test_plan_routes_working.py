"""
Plan Routes Working Integration Tests - Phase 4

Working integration tests for plan routes based on actual API structure.
Uses the correct model fields and realistic test scenarios.

Target: Plan routes coverage 23% → 60%
"""

import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
import uuid

from main import app
from app.models.meal_plan import (
    MealPlanRequest, UserProfile, Preferences, Sex, ActivityLevel, Goal,
    MealPlanResponse, Meal, MealItem, MealItemMacros, DailyMacros,
    PlanCustomizationRequest, SwapOperation, RemoveOperation, ManualAddition,
    MealCalorieAdjustment, CustomizedPlanResponse, ChangeLogEntry
)


@pytest.fixture
def client():
    """Test client fixture"""
    return TestClient(app)


@pytest.fixture
def sample_user_profile():
    """Sample user profile for testing"""
    return UserProfile(
        age=30,
        sex=Sex.MALE,
        height_cm=175.0,
        weight_kg=75.0,
        activity_level=ActivityLevel.MODERATELY_ACTIVE,
        goal=Goal.MAINTAIN
    )


@pytest.fixture
def sample_meal_plan_response():
    """Sample meal plan response for testing"""
    return MealPlanResponse(
        bmr=1800.0,
        tdee=2790.0,
        daily_calorie_target=2790.0,
        meals=[
            Meal(
                name="Breakfast",
                target_calories=697.5,
                actual_calories=680.0,
                items=[
                    MealItem(
                        barcode="oats_123",
                        name="Steel Cut Oats",
                        serving="50g",
                        calories=340.0,
                        macros=MealItemMacros(
                            protein_g=12.0,
                            fat_g=6.0,
                            carbs_g=60.0,
                            sugars_g=2.0,
                            salt_g=0.1
                        )
                    ),
                    MealItem(
                        barcode="banana_456",
                        name="Banana",
                        serving="1 medium",
                        calories=340.0,
                        macros=MealItemMacros(
                            protein_g=4.0,
                            fat_g=1.0,
                            carbs_g=80.0,
                            sugars_g=20.0,
                            salt_g=0.0
                        )
                    )
                ]
            )
        ],
        metrics=DailyMacros(
            total_calories=680.0,
            protein_g=16.0,
            fat_g=7.0,
            carbs_g=140.0,
            sugars_g=22.0,
            salt_g=0.1,
            protein_percent=9.4,
            fat_percent=9.2,
            carbs_percent=82.4
        ),
        flexibility_used=False,
        optional_products_used=0
    )


class TestPlanGenerationWorking:
    """Working meal plan generation tests"""
    
    def test_generate_meal_plan_basic_success(self, client, sample_user_profile):
        """Test basic meal plan generation"""
        request_data = {
            "user_profile": sample_user_profile.model_dump(),
            "preferences": {
                "dietary_restrictions": [],
                "excludes": [],
                "prefers": []
            },
            "flexibility": False
        }
        
        with patch('app.services.meal_planner.meal_planner.generate_plan', new_callable=AsyncMock) as mock_generate, \
             patch('app.services.plan_storage.plan_storage.store_plan', new_callable=AsyncMock) as mock_store:
            
            # Mock successful plan generation
            mock_plan = MealPlanResponse(
                bmr=1800.0,
                tdee=2790.0,
                daily_calorie_target=2790.0,
                meals=[],
                metrics=DailyMacros(
                    total_calories=2750.0,
                    protein_g=150.0,
                    fat_g=90.0,
                    carbs_g=300.0,
                    sugars_g=50.0,
                    salt_g=5.0,
                    protein_percent=21.8,
                    fat_percent=29.5,
                    carbs_percent=43.6
                ),
                flexibility_used=False,
                optional_products_used=0
            )
            
            mock_generate.return_value = mock_plan
            mock_store.return_value = "test-plan-123"
            
            response = client.post("/plan/generate", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify plan structure
            assert "bmr" in data
            assert "tdee" in data
            assert "daily_calorie_target" in data
            assert "meals" in data
            assert "metrics" in data
            assert data["bmr"] == 1800.0
            assert data["tdee"] == 2790.0
    
    def test_generate_meal_plan_with_optional_products(self, client, sample_user_profile):
        """Test meal plan generation with optional products"""
        request_data = {
            "user_profile": sample_user_profile.model_dump(),
            "preferences": {
                "dietary_restrictions": ["vegetarian"],
                "excludes": ["nuts"],
                "prefers": ["fruits"]
            },
            "optional_products": ["product_123", "product_456"],
            "flexibility": True
        }
        
        with patch('app.services.meal_planner.meal_planner.generate_plan', new_callable=AsyncMock) as mock_generate, \
             patch('app.services.plan_storage.plan_storage.store_plan', new_callable=AsyncMock) as mock_store:
            
            mock_plan = MealPlanResponse(
                bmr=1800.0,
                tdee=2790.0,
                daily_calorie_target=2790.0,
                meals=[],
                metrics=DailyMacros(
                    total_calories=2800.0,
                    protein_g=140.0,
                    fat_g=100.0,
                    carbs_g=320.0,
                    sugars_g=60.0,
                    salt_g=4.0,
                    protein_percent=20.0,
                    fat_percent=32.1,
                    carbs_percent=45.7
                ),
                flexibility_used=True,
                optional_products_used=2
            )
            
            mock_generate.return_value = mock_plan
            mock_store.return_value = "test-plan-456"
            
            response = client.post("/plan/generate", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["flexibility_used"] is True
            assert data["optional_products_used"] == 2
    
    def test_generate_meal_plan_validation_errors(self, client):
        """Test meal plan generation with invalid data"""
        # Invalid age
        invalid_data = {
            "user_profile": {
                "age": 200,  # Too old
                "sex": "male",
                "height_cm": 175.0,
                "weight_kg": 75.0,
                "activity_level": "moderately_active",
                "goal": "maintain"
            },
            "preferences": {}
        }
        
        response = client.post("/plan/generate", json=invalid_data)
        assert response.status_code == 422  # Pydantic validation error
    
    def test_generate_meal_plan_service_error(self, client, sample_user_profile):
        """Test meal plan generation service error handling"""
        request_data = {
            "user_profile": sample_user_profile.model_dump(),
            "preferences": {}
        }
        
        with patch('app.services.meal_planner.meal_planner.generate_plan', new_callable=AsyncMock) as mock_generate:
            mock_generate.side_effect = Exception("Service error")
            
            response = client.post("/plan/generate", json=request_data)
            assert response.status_code == 500


class TestPlanConfigurationWorking:
    """Working meal plan configuration tests"""
    
    def test_get_meal_plan_config(self, client):
        """Test getting meal plan configuration"""
        response = client.get("/plan/config")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify configuration structure
        assert "meal_distribution" in data
        assert "item_limits" in data
        assert "tolerance" in data
        assert "activity_multipliers" in data
        assert "goal_adjustments" in data
        
        # Verify meal distribution
        meal_dist = data["meal_distribution"]
        assert "breakfast_percent" in meal_dist
        assert "lunch_percent" in meal_dist
        assert "dinner_percent" in meal_dist
        
        # Verify percentages are reasonable
        assert 0.2 <= meal_dist["breakfast_percent"] <= 0.3
        assert 0.3 <= meal_dist["lunch_percent"] <= 0.5
        assert 0.3 <= meal_dist["dinner_percent"] <= 0.4
        
        # Verify item limits
        item_limits = data["item_limits"]
        assert item_limits["max_items_per_meal"] >= 3
        assert item_limits["max_items_flexible"] >= item_limits["max_items_per_meal"]
        
        # Verify tolerance settings
        tolerance = data["tolerance"]
        assert 0.0 < tolerance["calorie_tolerance_strict"] < 0.1
        assert tolerance["calorie_tolerance_flexible"] > tolerance["calorie_tolerance_strict"]


class TestPlanCustomizationWorking:
    """Working meal plan customization tests"""
    
    def test_customize_plan_swap_operation(self, client, sample_meal_plan_response):
        """Test plan customization with swap operation"""
        plan_id = "test-plan-123"
        customization_data = {
            "swap": {
                "old_barcode": "oats_123",
                "new_barcode": "eggs_789"
            }
        }
        
        with patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get_plan, \
             patch('app.services.plan_customizer.plan_customizer.check_idempotency') as mock_check_idem, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize, \
             patch('app.services.plan_storage.plan_storage.update_plan', new_callable=AsyncMock) as mock_update:
            
            mock_get_plan.return_value = sample_meal_plan_response
            mock_check_idem.return_value = False
            
            updated_plan = sample_meal_plan_response.model_copy()
            change_log = [
                ChangeLogEntry(
                    change_type="swap",
                    description="Swapped oats_123 for eggs_789 in Breakfast",
                    meal_affected="Breakfast"
                )
            ]
            
            mock_customize.return_value = (updated_plan, change_log)
            mock_update.return_value = True
            
            response = client.put(f"/plan/customize/{plan_id}", json=customization_data)
            
            assert response.status_code == 200
            data = response.json()
            
            assert "plan" in data
            assert "change_log" in data
            assert "plan_id" in data
            assert data["plan_id"] == plan_id
            assert len(data["change_log"]) == 1
            assert data["change_log"][0]["change_type"] == "swap"
    
    def test_customize_plan_remove_operation(self, client, sample_meal_plan_response):
        """Test plan customization with remove operation"""
        plan_id = "test-plan-456"
        customization_data = {
            "remove": {
                "barcode": "banana_456"
            }
        }
        
        with patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get_plan, \
             patch('app.services.plan_customizer.plan_customizer.check_idempotency') as mock_check_idem, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize, \
             patch('app.services.plan_storage.plan_storage.update_plan', new_callable=AsyncMock) as mock_update:
            
            mock_get_plan.return_value = sample_meal_plan_response
            mock_check_idem.return_value = False
            
            updated_plan = sample_meal_plan_response.model_copy()
            change_log = [
                ChangeLogEntry(
                    change_type="remove",
                    description="Removed banana_456 from Breakfast",
                    meal_affected="Breakfast"
                )
            ]
            
            mock_customize.return_value = (updated_plan, change_log)
            mock_update.return_value = True
            
            response = client.put(f"/plan/customize/{plan_id}", json=customization_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["change_log"][0]["change_type"] == "remove"
    
    def test_customize_plan_add_manual_operation(self, client, sample_meal_plan_response):
        """Test plan customization with manual addition"""
        plan_id = "test-plan-789"
        customization_data = {
            "add_manual": {
                "name": "Greek Yogurt",
                "calories": 150.0,
                "protein_g": 15.0,
                "fat_g": 8.0,
                "carbs_g": 10.0,
                "serving": "1 cup"
            }
        }
        
        with patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get_plan, \
             patch('app.services.plan_customizer.plan_customizer.check_idempotency') as mock_check_idem, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize, \
             patch('app.services.plan_storage.plan_storage.update_plan', new_callable=AsyncMock) as mock_update:
            
            mock_get_plan.return_value = sample_meal_plan_response
            mock_check_idem.return_value = False
            
            updated_plan = sample_meal_plan_response.model_copy()
            change_log = [
                ChangeLogEntry(
                    change_type="add_manual",
                    description="Added Greek Yogurt (150.0 kcal) to meal plan",
                    meal_affected=None
                )
            ]
            
            mock_customize.return_value = (updated_plan, change_log)
            mock_update.return_value = True
            
            response = client.put(f"/plan/customize/{plan_id}", json=customization_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["change_log"][0]["change_type"] == "add_manual"
    
    def test_customize_plan_not_found(self, client):
        """Test customization of non-existent plan"""
        plan_id = "non-existent-plan"
        customization_data = {
            "swap": {
                "old_barcode": "test_123",
                "new_barcode": "test_456"
            }
        }
        
        with patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get_plan:
            mock_get_plan.return_value = None
            
            response = client.put(f"/plan/customize/{plan_id}", json=customization_data)
            assert response.status_code == 404
    
    def test_customize_plan_no_operations(self, client):
        """Test customization with no operations"""
        plan_id = "test-plan-123"
        customization_data = {}  # No operations
        
        response = client.put(f"/plan/customize/{plan_id}", json=customization_data)
        assert response.status_code == 400


class TestPlanStorageWorking:
    """Working meal plan storage tests"""
    
    def test_get_meal_plan_success(self, client, sample_meal_plan_response):
        """Test getting a meal plan by ID"""
        plan_id = "test-plan-123"
        
        with patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get_plan:
            mock_get_plan.return_value = sample_meal_plan_response
            
            response = client.get(f"/plan/{plan_id}")
            
            assert response.status_code == 200
            data = response.json()
            
            assert "bmr" in data
            assert "tdee" in data
            assert "meals" in data
            assert "metrics" in data
    
    def test_get_meal_plan_not_found(self, client):
        """Test getting non-existent meal plan"""
        plan_id = "non-existent-plan"
        
        with patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get_plan:
            mock_get_plan.return_value = None
            
            response = client.get(f"/plan/{plan_id}")
            assert response.status_code == 404
    
    def test_delete_meal_plan_success(self, client):
        """Test deleting a meal plan"""
        plan_id = "test-plan-123"
        
        with patch('app.services.plan_storage.plan_storage.delete_plan', new_callable=AsyncMock) as mock_delete:
            mock_delete.return_value = True
            
            response = client.delete(f"/plan/{plan_id}")
            
            assert response.status_code == 200
            data = response.json()
            assert "message" in data
            assert plan_id in data["message"]
    
    def test_delete_meal_plan_not_found(self, client):
        """Test deleting non-existent meal plan"""
        plan_id = "non-existent-plan"
        
        with patch('app.services.plan_storage.plan_storage.delete_plan', new_callable=AsyncMock) as mock_delete:
            mock_delete.return_value = False
            
            response = client.delete(f"/plan/{plan_id}")
            assert response.status_code == 404


class TestPlanIntegrationWorkingWorkflows:
    """Working integration tests for plan workflows"""
    
    def test_complete_plan_lifecycle(self, client, sample_user_profile):
        """Test complete plan lifecycle: generate -> customize -> retrieve -> delete"""
        # Step 1: Generate plan
        request_data = {
            "user_profile": sample_user_profile.model_dump(),
            "preferences": {}
        }
        
        mock_plan = MealPlanResponse(
            bmr=1800.0,
            tdee=2790.0,
            daily_calorie_target=2790.0,
            meals=[],
            metrics=DailyMacros(
                total_calories=2800.0,
                protein_g=140.0,
                fat_g=100.0,
                carbs_g=320.0,
                sugars_g=60.0,
                salt_g=4.0,
                protein_percent=20.0,
                fat_percent=32.1,
                carbs_percent=45.7
            ),
            flexibility_used=False,
            optional_products_used=0
        )
        
        plan_id = "lifecycle-test-plan"
        
        with patch('app.services.meal_planner.meal_planner.generate_plan', new_callable=AsyncMock) as mock_generate, \
             patch('app.services.plan_storage.plan_storage.store_plan', new_callable=AsyncMock) as mock_store, \
             patch('app.services.plan_storage.plan_storage.get_plan', new_callable=AsyncMock) as mock_get, \
             patch('app.services.plan_customizer.plan_customizer.check_idempotency') as mock_check_idem, \
             patch('app.services.plan_customizer.plan_customizer.customize_plan', new_callable=AsyncMock) as mock_customize, \
             patch('app.services.plan_storage.plan_storage.update_plan', new_callable=AsyncMock) as mock_update, \
             patch('app.services.plan_storage.plan_storage.delete_plan', new_callable=AsyncMock) as mock_delete:
            
            # Generate plan
            mock_generate.return_value = mock_plan
            mock_store.return_value = plan_id
            
            generate_response = client.post("/plan/generate", json=request_data)
            assert generate_response.status_code == 200
            
            # Step 2: Customize plan
            mock_get.return_value = mock_plan
            mock_check_idem.return_value = False
            mock_customize.return_value = (mock_plan, [])
            mock_update.return_value = True
            
            customize_data = {
                "add_manual": {
                    "name": "Protein Shake",
                    "calories": 200.0,
                    "protein_g": 25.0
                }
            }
            
            customize_response = client.put(f"/plan/customize/{plan_id}", json=customize_data)
            assert customize_response.status_code == 200
            
            # Step 3: Retrieve plan
            retrieve_response = client.get(f"/plan/{plan_id}")
            assert retrieve_response.status_code == 200
            
            # Step 4: Delete plan
            mock_delete.return_value = True
            delete_response = client.delete(f"/plan/{plan_id}")
            assert delete_response.status_code == 200
    
    def test_multiple_user_profiles(self, client):
        """Test plan generation for different user profiles"""
        profiles = [
            # Young active male
            UserProfile(
                age=25,
                sex=Sex.MALE,
                height_cm=180.0,
                weight_kg=80.0,
                activity_level=ActivityLevel.VERY_ACTIVE,
                goal=Goal.GAIN_WEIGHT
            ),
            # Middle-aged sedentary female  
            UserProfile(
                age=45,
                sex=Sex.FEMALE,
                height_cm=165.0,
                weight_kg=70.0,
                activity_level=ActivityLevel.SEDENTARY,
                goal=Goal.LOSE_WEIGHT
            )
        ]
        
        with patch('app.services.meal_planner.meal_planner.generate_plan', new_callable=AsyncMock) as mock_generate, \
             patch('app.services.plan_storage.plan_storage.store_plan', new_callable=AsyncMock) as mock_store:
            
            for i, profile in enumerate(profiles):
                mock_plan = MealPlanResponse(
                    bmr=1600.0 + i * 200,  # Different BMR for each profile
                    tdee=2000.0 + i * 400,
                    daily_calorie_target=2000.0 + i * 400,
                    meals=[],
                    metrics=DailyMacros(
                        total_calories=2000.0 + i * 400,
                        protein_g=100.0 + i * 20,
                        fat_g=70.0 + i * 10,
                        carbs_g=250.0 + i * 50,
                        sugars_g=50.0,
                        salt_g=5.0,
                        protein_percent=20.0,
                        fat_percent=30.0,
                        carbs_percent=50.0
                    ),
                    flexibility_used=False,
                    optional_products_used=0
                )
                
                mock_generate.return_value = mock_plan
                mock_store.return_value = f"profile-test-{i}"
                
                request_data = {
                    "user_profile": profile.model_dump(),
                    "preferences": {}
                }
                
                response = client.post("/plan/generate", json=request_data)
                assert response.status_code == 200
                
                data = response.json()
                assert data["bmr"] == 1600.0 + i * 200
                assert data["tdee"] == 2000.0 + i * 400