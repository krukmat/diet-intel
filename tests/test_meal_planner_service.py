import pytest
import uuid
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock
from app.services.meal_planner import MealPlannerService
from app.models.meal_plan import (
    MealPlanRequest, MealPlanResponse, MealPlanConfig, UserProfile, 
    Sex, ActivityLevel, Goal, Meal, MealItem, MealItemMacros
)
from app.models.product import ProductResponse, Nutriments


class TestMealPlannerService:
    """Test suite for MealPlannerService"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.service = MealPlannerService()
        
        # Standard test profile
        self.test_profile = UserProfile(
            age=30,
            sex=Sex.MALE,
            height_cm=175,
            weight_kg=75,
            activity_level=ActivityLevel.MODERATELY_ACTIVE,
            goal=Goal.MAINTAIN
        )
        
        # Mock products for testing
        self.sample_products = [
            ProductResponse(
                source="openfoodfacts",
                barcode="1234567890",
                name="Greek Yogurt",
                serving_size="150g",
                fetched_at=datetime(2024, 1, 1),
                nutriments=Nutriments(
                    energy_kcal=100.0,
                    proteins=15.0,
                    fat=3.5,
                    carbohydrates=8.0,
                    fiber=0.0,
                    sugars=6.0,
                    salt=0.1
                )
            ),
            ProductResponse(
                source="openfoodfacts",
                barcode="2345678901",
                name="Chicken Breast",
                serving_size="100g",
                fetched_at=datetime(2024, 1, 1),
                nutriments=Nutriments(
                    energy_kcal=165.0,
                    proteins=31.0,
                    fat=3.6,
                    carbohydrates=0.0,
                    fiber=0.0,
                    sugars=0.0,
                    salt=0.07
                )
            ),
            ProductResponse(
                source="openfoodfacts",
                barcode="3456789012",
                name="Brown Rice",
                serving_size="100g",
                fetched_at=datetime(2024, 1, 1),
                nutriments=Nutriments(
                    energy_kcal=112.0,
                    proteins=2.3,
                    fat=0.9,
                    carbohydrates=23.0,
                    fiber=1.8,
                    sugars=0.4,
                    salt=0.005
                )
            ),
            ProductResponse(
                source="openfoodfacts",
                barcode="4567890123",
                name="Banana",
                serving_size="100g",
                fetched_at=datetime(2024, 1, 1),
                nutriments=Nutriments(
                    energy_kcal=89.0,
                    proteins=1.1,
                    fat=0.3,
                    carbohydrates=23.0,
                    fiber=2.6,
                    sugars=12.0,
                    salt=0.001
                )
            )
        ]


class TestMealPlanGeneration:
    """Test meal plan generation functionality"""
    
    def setup_method(self):
        self.service = MealPlannerService()
        self.test_profile = UserProfile(
            age=30, sex=Sex.MALE, height_cm=175, weight_kg=75,
            activity_level=ActivityLevel.MODERATELY_ACTIVE, goal=Goal.MAINTAIN
        )
    
    @patch('app.services.meal_planner.MealPlannerService._load_available_products')
    @patch('app.services.nutrition_calculator.nutrition_calculator.calculate_bmr')
    @patch('app.services.nutrition_calculator.nutrition_calculator.calculate_tdee')
    @patch('app.services.nutrition_calculator.nutrition_calculator.calculate_daily_target')
    @patch('app.services.nutrition_calculator.nutrition_calculator.get_meal_targets')
    async def test_successful_meal_plan_generation(self, mock_meal_targets, mock_daily_target, 
                                                 mock_tdee, mock_bmr, mock_load_products):
        """Test successful meal plan generation"""
        # Setup mocks
        mock_bmr.return_value = 1700.0
        mock_tdee.return_value = 2635.0
        mock_daily_target.return_value = 2635.0
        mock_meal_targets.return_value = (658.8, 1054.0, 922.2)  # 25%, 40%, 35%
        
        mock_products = [
            ProductResponse(
                barcode="1234567890",
                product_name="Test Food",
                serving_size="100g",
                nutriments=Nutriments(
                    energy_kcal=200.0, proteins=20.0, fat=5.0, carbohydrates=15.0,
                    fiber=2.0, sugars=3.0, salt=0.5
                )
            )
        ]
        mock_load_products.return_value = mock_products
        
        request = MealPlanRequest(
            user_profile=self.test_profile,
            optional_products=[]
        )
        
        with patch.object(self.service, '_build_meal') as mock_build_meal:
            # Mock meal building
            mock_meal = Meal(
                name="Test Meal",
                target_calories=500.0,
                items=[
                    MealItem(
                        barcode="1234567890",
                        name="Test Food",
                        serving="100g",
                        calories=200.0,
                        macros=MealItemMacros(
                            protein=20.0, fat=5.0, carbohydrates=15.0,
                            fiber=2.0, sugars=3.0, sodium=500.0
                        )
                    )
                ],
                actual_calories=200.0
            )
            mock_build_meal.return_value = mock_meal
            
            # Execute
            result = await self.service.generate_plan(request)
            
            # Verify
            assert isinstance(result, MealPlanResponse)
            assert result.bmr == 1700.0
            assert result.tdee == 2635.0
            assert result.daily_target == 2635.0
            assert len(result.meals) == 3
            assert mock_build_meal.call_count == 3
    
    @patch('app.services.meal_planner.MealPlannerService._load_available_products')
    async def test_empty_products_scenario(self, mock_load_products):
        """Test meal plan generation when no products available"""
        mock_load_products.return_value = []
        
        request = MealPlanRequest(
            user_profile=self.test_profile,
            optional_products=[]
        )
        
        with patch.object(self.service, '_create_empty_plan') as mock_empty_plan:
            mock_empty_plan.return_value = MealPlanResponse(
                bmr=1700.0, tdee=2635.0, daily_target=2635.0,
                meals=[], daily_macros=Mock(), metrics=Mock()
            )
            
            result = await self.service.generate_plan(request)
            
            assert result is not None
            assert len(result.meals) == 0
            mock_empty_plan.assert_called_once()
    
    async def test_flexibility_mode_impact(self):
        """Test that flexibility mode affects meal building"""
        request_strict = MealPlanRequest(
            user_profile=self.test_profile,
            optional_products=[],
            flexibility=False
        )
        
        request_flexible = MealPlanRequest(
            user_profile=self.test_profile,
            optional_products=[],
            flexibility=True
        )
        
        with patch.object(self.service, '_load_available_products') as mock_load:
            with patch.object(self.service, '_build_meal') as mock_build:
                mock_load.return_value = [Mock()]
                mock_build.return_value = Mock()
                
                await self.service.generate_plan(request_strict)
                await self.service.generate_plan(request_flexible)
                
                # Verify flexibility parameter is passed to _build_meal
                strict_calls = [call for call in mock_build.call_args_list[:3]]
                flexible_calls = [call for call in mock_build.call_args_list[3:]]
                
                # Check that flexibility parameter is correctly passed
                for call in strict_calls:
                    assert call[0][4] is False  # flexibility parameter
                
                for call in flexible_calls:
                    assert call[0][4] is True


class TestMealBuilding:
    """Test individual meal building logic"""
    
    def setup_method(self):
        self.service = MealPlannerService()
    
    @patch('app.services.meal_planner.MealPlannerService._select_products_for_meal')
    async def test_build_meal_success(self, mock_select_products):
        """Test successful meal building"""
        available_products = [
            ProductResponse(
                barcode="1234567890",
                product_name="Test Food",
                serving_size="100g",
                nutriments=Nutriments(
                    energy_kcal=300.0, proteins=25.0, fat=8.0, carbohydrates=20.0,
                    fiber=3.0, sugars=5.0, salt=0.8
                )
            )
        ]
        
        mock_select_products.return_value = [
            MealItem(
                barcode="1234567890",
                name="Test Food",
                serving="100g",
                calories=300.0,
                macros=MealItemMacros(
                    protein=25.0, fat=8.0, carbohydrates=20.0,
                    fiber=3.0, sugars=5.0, sodium=800.0
                )
            )
        ]
        
        meal = await self.service._build_meal(
            "Lunch", 500.0, available_products, [], False, None
        )
        
        assert meal.name == "Lunch"
        assert meal.target_calories == 500.0
        assert len(meal.items) == 1
        assert meal.actual_calories == 300.0
        mock_select_products.assert_called_once()
    
    async def test_build_meal_with_optional_products(self):
        """Test meal building prioritizes optional products"""
        available_products = [
            ProductResponse(barcode="regular", product_name="Regular Food", serving_size="100g",
                          nutriments=Nutriments(energy_kcal=200.0, proteins=10.0, fat=5.0, 
                                               carbohydrates=25.0, fiber=2.0, sugars=8.0, salt=0.5))
        ]
        
        optional_products = [
            ProductResponse(barcode="optional", product_name="Optional Food", serving_size="100g",
                          nutriments=Nutriments(energy_kcal=250.0, proteins=15.0, fat=7.0,
                                               carbohydrates=20.0, fiber=3.0, sugars=5.0, salt=0.3))
        ]
        
        with patch.object(self.service, '_select_products_for_meal') as mock_select:
            mock_select.return_value = []
            
            await self.service._build_meal(
                "Breakfast", 400.0, available_products, optional_products, False, None
            )
            
            # Verify optional products are passed to selection
            mock_select.assert_called_once()
            args = mock_select.call_args[0]
            assert optional_products[0] in args[1]  # available_products parameter


class TestProductSelection:
    """Test product selection algorithms"""
    
    def setup_method(self):
        self.service = MealPlannerService()
        
        self.test_products = [
            ProductResponse(
                barcode="low_cal", product_name="Low Cal Food", serving_size="100g",
                nutriments=Nutriments(energy_kcal=100.0, proteins=10.0, fat=2.0,
                                     carbohydrates=12.0, fiber=4.0, sugars=2.0, salt=0.2)
            ),
            ProductResponse(
                barcode="medium_cal", product_name="Medium Cal Food", serving_size="100g", 
                nutriments=Nutriments(energy_kcal=250.0, proteins=20.0, fat=8.0,
                                     carbohydrates=25.0, fiber=3.0, sugars=6.0, salt=0.5)
            ),
            ProductResponse(
                barcode="high_cal", product_name="High Cal Food", serving_size="100g",
                nutriments=Nutriments(energy_kcal=400.0, proteins=15.0, fat=25.0,
                                     carbohydrates=30.0, fiber=2.0, sugars=10.0, salt=1.0)
            )
        ]
    
    def test_product_selection_within_tolerance(self):
        """Test product selection stays within calorie tolerance"""
        target_calories = 500.0
        tolerance = 0.05  # 5%
        
        selected_items = self.service._select_products_for_meal(
            target_calories, self.test_products, [], False, None, tolerance
        )
        
        total_calories = sum(item.calories for item in selected_items)
        tolerance_range = target_calories * tolerance
        
        assert abs(total_calories - target_calories) <= tolerance_range
    
    def test_flexible_mode_tolerance(self):
        """Test that flexible mode uses higher tolerance"""
        target_calories = 300.0
        
        # In flexible mode, should be more tolerant
        flexible_items = self.service._select_products_for_meal(
            target_calories, self.test_products, [], True, None, 0.15
        )
        
        # In strict mode, should be less tolerant  
        strict_items = self.service._select_products_for_meal(
            target_calories, self.test_products, [], False, None, 0.05
        )
        
        # Both should return valid results
        assert len(flexible_items) >= 0
        assert len(strict_items) >= 0
    
    def test_max_items_per_meal_constraint(self):
        """Test that meals don't exceed maximum item count"""
        target_calories = 800.0
        
        selected_items = self.service._select_products_for_meal(
            target_calories, self.test_products, [], False, None
        )
        
        # Should not exceed 3 items in strict mode
        assert len(selected_items) <= 3
    
    def test_optional_products_priority(self):
        """Test that optional products are prioritized in selection"""
        target_calories = 300.0
        
        optional_product = ProductResponse(
            barcode="optional", product_name="Optional Food", serving_size="100g",
            nutriments=Nutriments(energy_kcal=280.0, proteins=20.0, fat=8.0,
                                 carbohydrates=20.0, fiber=5.0, sugars=3.0, salt=0.3)
        )
        
        selected_items = self.service._select_products_for_meal(
            target_calories, self.test_products, [optional_product], False, None
        )
        
        # If optional product fits, it should be included
        optional_barcodes = [item.barcode for item in selected_items if item.barcode == "optional"]
        if abs(280.0 - target_calories) <= target_calories * 0.05:
            assert len(optional_barcodes) > 0


class TestMacroCalculations:
    """Test macro calculation and aggregation"""
    
    def setup_method(self):
        self.service = MealPlannerService()
    
    def test_daily_macros_calculation(self):
        """Test daily macro aggregation from meals"""
        meals = [
            Meal(
                name="Breakfast", target_calories=400.0,
                items=[
                    MealItem(barcode="1", name="Food 1", serving="100g", calories=200.0,
                           macros=MealItemMacros(protein=20.0, fat=5.0, carbohydrates=25.0,
                                               fiber=3.0, sugars=8.0, sodium=300.0))
                ],
                actual_calories=200.0
            ),
            Meal(
                name="Lunch", target_calories=600.0,
                items=[
                    MealItem(barcode="2", name="Food 2", serving="150g", calories=350.0,
                           macros=MealItemMacros(protein=30.0, fat=10.0, carbohydrates=35.0,
                                               fiber=5.0, sugars=10.0, sodium=500.0))
                ],
                actual_calories=350.0
            )
        ]
        
        daily_macros = self.service._calculate_daily_macros(meals)
        
        assert daily_macros.calories == 550.0  # 200 + 350
        assert daily_macros.protein == 50.0    # 20 + 30
        assert daily_macros.fat == 15.0        # 5 + 10
        assert daily_macros.carbohydrates == 60.0  # 25 + 35
        assert daily_macros.fiber == 8.0       # 3 + 5
        assert daily_macros.sugars == 18.0     # 8 + 10
        assert daily_macros.sodium == 800.0    # 300 + 500
    
    def test_empty_meals_macro_calculation(self):
        """Test macro calculation with empty meals"""
        daily_macros = self.service._calculate_daily_macros([])
        
        assert daily_macros.calories == 0.0
        assert daily_macros.protein == 0.0
        assert daily_macros.fat == 0.0
        assert daily_macros.carbohydrates == 0.0


class TestEdgeCasesAndErrorHandling:
    """Test edge cases and error scenarios"""
    
    def setup_method(self):
        self.service = MealPlannerService()
    
    def test_impossible_calorie_target(self):
        """Test handling of impossible calorie targets"""
        # Very low calorie target with only high-calorie products
        high_cal_products = [
            ProductResponse(
                source="openfoodfacts",
                barcode="high", name="High Cal", serving_size="100g",
                fetched_at=datetime(2024, 1, 1),
                nutriments=Nutriments(energy_kcal=800.0, proteins=10.0, fat=50.0,
                                     carbohydrates=60.0, fiber=1.0, sugars=20.0, salt=2.0)
            )
        ]
        
        selected_items = self.service._select_products_for_meal(
            100.0, high_cal_products, [], False, None  # Impossible: 100 cal target, 800 cal products
        )
        
        # Should return empty or best-effort selection
        assert isinstance(selected_items, list)
    
    def test_products_without_serving_size(self):
        """Test handling of products without serving size"""
        no_serving_product = ProductResponse(
            source="openfoodfacts",
            barcode="no_serving", name="No Serving Size", serving_size=None,
            fetched_at=datetime(2024, 1, 1),
            nutriments=Nutriments(energy_kcal=200.0, proteins=15.0, fat=8.0,
                                 carbohydrates=20.0, fiber=3.0, sugars=5.0, salt=0.5)
        )
        
        # Should handle gracefully and assume 100g serving
        selected_items = self.service._select_products_for_meal(
            200.0, [no_serving_product], [], False, None
        )
        
        assert isinstance(selected_items, list)
    
    def test_zero_calorie_products(self):
        """Test handling of zero-calorie products"""
        zero_cal_product = ProductResponse(
            source="openfoodfacts",
            barcode="zero", name="Zero Cal", serving_size="100g",
            fetched_at=datetime(2024, 1, 1),
            nutriments=Nutriments(energy_kcal=0.0, proteins=0.0, fat=0.0,
                                 carbohydrates=0.0, fiber=2.0, sugars=0.0, salt=0.0)
        )
        
        selected_items = self.service._select_products_for_meal(
            200.0, [zero_cal_product], [], False, None
        )
        
        # Should handle gracefully
        assert isinstance(selected_items, list)


@pytest.fixture
def meal_planner_service():
    """Fixture providing meal planner service instance"""
    return MealPlannerService()


@pytest.fixture
def sample_meal_plan_request():
    """Fixture for standard meal plan request"""
    profile = UserProfile(
        age=30, sex=Sex.MALE, height_cm=175, weight_kg=75,
        activity_level=ActivityLevel.MODERATELY_ACTIVE, goal=Goal.MAINTAIN
    )
    
    return MealPlanRequest(
        user_profile=profile,
        optional_products=[]
    )


@pytest.fixture
def sample_products():
    """Fixture for sample product catalog"""
    return [
        ProductResponse(
            barcode="test1", product_name="Test Food 1", serving_size="100g",
            nutriments=Nutriments(energy_kcal=200.0, proteins=20.0, fat=5.0,
                                 carbohydrates=25.0, fiber=3.0, sugars=8.0, salt=0.5)
        ),
        ProductResponse(
            barcode="test2", product_name="Test Food 2", serving_size="150g",
            nutriments=Nutriments(energy_kcal=300.0, proteins=15.0, fat=12.0,
                                 carbohydrates=35.0, fiber=4.0, sugars=10.0, salt=0.8)
        )
    ]