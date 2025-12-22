import pytest
from unittest.mock import Mock, patch
from app.services.nutrition_calculator import NutritionCalculator, nutrition_calculator
from app.models.meal_plan import UserProfile, Sex, ActivityLevel, Goal, MealPlanConfig


class TestNutritionCalculator:
    """Test suite for NutritionCalculator service"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.calculator = NutritionCalculator()
        
        # Standard test profiles
        self.male_profile = UserProfile(
            age=30,
            sex=Sex.MALE,
            height_cm=175,
            weight_kg=75,
            activity_level=ActivityLevel.MODERATELY_ACTIVE,
            goal=Goal.MAINTAIN
        )
        
        self.female_profile = UserProfile(
            age=25,
            sex=Sex.FEMALE,
            height_cm=165,
            weight_kg=60,
            activity_level=ActivityLevel.LIGHTLY_ACTIVE,
            goal=Goal.LOSE_WEIGHT
        )


class TestBMRCalculation:
    """Test BMR calculation using Mifflin-St Jeor equation"""
    
    def setup_method(self):
        self.calculator = NutritionCalculator()
    
    def test_bmr_male_calculation(self):
        """Test BMR calculation for male profile"""
        profile = UserProfile(
            age=30, sex=Sex.MALE, height_cm=175, weight_kg=75,
            activity_level=ActivityLevel.MODERATELY_ACTIVE, goal=Goal.MAINTAIN
        )
        
        # Expected: 10*75 + 6.25*175 - 5*30 + 5 = 750 + 1093.75 - 150 + 5 = 1698.75
        bmr = self.calculator.calculate_bmr(profile)
        
        assert bmr == 1698.75
    
    def test_bmr_female_calculation(self):
        """Test BMR calculation for female profile"""
        profile = UserProfile(
            age=25, sex=Sex.FEMALE, height_cm=165, weight_kg=60,
            activity_level=ActivityLevel.LIGHTLY_ACTIVE, goal=Goal.LOSE_WEIGHT
        )
        
        # Expected: 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
        bmr = self.calculator.calculate_bmr(profile)
        
        assert bmr == 1345.25
    
    def test_bmr_edge_cases(self):
        """Test BMR calculation for edge cases"""
        # Very young person
        young_profile = UserProfile(
            age=18, sex=Sex.MALE, height_cm=180, weight_kg=70,
            activity_level=ActivityLevel.MODERATELY_ACTIVE, goal=Goal.MAINTAIN
        )
        bmr_young = self.calculator.calculate_bmr(young_profile)
        assert bmr_young > 0
        
        # Older person
        older_profile = UserProfile(
            age=65, sex=Sex.FEMALE, height_cm=160, weight_kg=65,
            activity_level=ActivityLevel.SEDENTARY, goal=Goal.MAINTAIN
        )
        bmr_older = self.calculator.calculate_bmr(older_profile)
        assert bmr_older > 0
        assert bmr_older < bmr_young  # Older person should have lower BMR
    
    def test_bmr_weight_impact(self):
        """Test that higher weight results in higher BMR"""
        base_profile = UserProfile(
            age=30, sex=Sex.MALE, height_cm=175, weight_kg=70,
            activity_level=ActivityLevel.MODERATELY_ACTIVE, goal=Goal.MAINTAIN
        )
        heavy_profile = UserProfile(
            age=30, sex=Sex.MALE, height_cm=175, weight_kg=90,
            activity_level=ActivityLevel.MODERATELY_ACTIVE, goal=Goal.MAINTAIN
        )
        
        bmr_base = self.calculator.calculate_bmr(base_profile)
        bmr_heavy = self.calculator.calculate_bmr(heavy_profile)
        
        assert bmr_heavy > bmr_base
        assert bmr_heavy - bmr_base == 200  # 20kg * 10 = 200 kcal difference


class TestTDEECalculation:
    """Test TDEE calculation with activity multipliers"""
    
    def setup_method(self):
        self.calculator = NutritionCalculator()
    
    def test_tdee_sedentary(self):
        """Test TDEE calculation for sedentary activity level"""
        bmr = 1700.0
        tdee = self.calculator.calculate_tdee(bmr, ActivityLevel.SEDENTARY)
        
        # Expected: 1700 * 1.2 = 2040
        assert tdee == 2040.0
    
    def test_tdee_light_activity(self):
        """Test TDEE calculation for light activity level"""
        bmr = 1500.0
        tdee = self.calculator.calculate_tdee(bmr, ActivityLevel.LIGHTLY_ACTIVE)
        
        # Expected: 1500 * 1.375 = 2062.5
        assert tdee == 2062.5
    
    def test_tdee_moderate_activity(self):
        """Test TDEE calculation for moderate activity level"""
        bmr = 1600.0
        tdee = self.calculator.calculate_tdee(bmr, ActivityLevel.MODERATELY_ACTIVE)
        
        # Expected: 1600 * 1.55 = 2480
        assert tdee == 2480.0
    
    def test_tdee_heavy_activity(self):
        """Test TDEE calculation for heavy activity level"""
        bmr = 1800.0
        tdee = self.calculator.calculate_tdee(bmr, ActivityLevel.VERY_ACTIVE)
        
        # Expected: 1800 * 1.725 = 3105
        assert tdee == 3105.0
    
    def test_tdee_extreme_activity(self):
        """Test TDEE calculation for extreme activity level"""
        bmr = 2000.0
        tdee = self.calculator.calculate_tdee(bmr, ActivityLevel.EXTRA_ACTIVE)
        
        # Expected: 2000 * 1.9 = 3800
        assert tdee == 3800.0
    
    def test_tdee_with_custom_config(self):
        """Test TDEE calculation with custom activity multipliers"""
        custom_config = MealPlanConfig()
        custom_config.activity_multipliers = {
            ActivityLevel.LIGHTLY_ACTIVE.value: 1.4
        }
        calculator = NutritionCalculator(custom_config)
        
        bmr = 1500.0
        tdee = calculator.calculate_tdee(bmr, ActivityLevel.LIGHTLY_ACTIVE)
        
        assert tdee == 2100.0  # 1500 * 1.4


class TestDailyTargetCalculation:
    """Test daily calorie target calculation based on goals"""
    
    def setup_method(self):
        self.calculator = NutritionCalculator()
    
    def test_maintain_weight_target(self):
        """Test daily target for weight maintenance"""
        tdee = 2200.0
        target = self.calculator.calculate_daily_target(tdee, Goal.MAINTAIN)
        
        # Expected: 2200 + 0 = 2200
        assert target == 2200.0
    
    def test_lose_weight_target(self):
        """Test daily target for weight loss"""
        tdee = 2200.0
        target = self.calculator.calculate_daily_target(tdee, Goal.LOSE_WEIGHT)
        
        # Expected: 2200 - 500 = 1700
        assert target == 1700.0
    
    def test_gain_weight_target(self):
        """Test daily target for weight gain"""
        tdee = 2200.0
        target = self.calculator.calculate_daily_target(tdee, Goal.GAIN_WEIGHT)
        
        # Expected: 2200 + 300 = 2500
        assert target == 2500.0
    
    def test_daily_target_with_custom_config(self):
        """Test daily target with custom goal adjustments"""
        custom_config = MealPlanConfig()
        custom_config.goal_adjustments = {
            Goal.LOSE_WEIGHT.value: -750  # More aggressive weight loss
        }
        calculator = NutritionCalculator(custom_config)
        
        tdee = 2000.0
        target = calculator.calculate_daily_target(tdee, Goal.LOSE_WEIGHT)
        
        assert target == 1250.0  # 2000 - 750


class TestMealTargets:
    """Test meal calorie distribution"""
    
    def setup_method(self):
        self.calculator = NutritionCalculator()
    
    def test_default_meal_distribution(self):
        """Test default meal distribution (25%, 40%, 35%)"""
        daily_target = 2000.0
        breakfast, lunch, dinner = self.calculator.get_meal_targets(daily_target)
        
        # Expected: 500, 800, 700
        assert breakfast == 500.0
        assert lunch == 800.0
        assert dinner == 700.0
        assert breakfast + lunch + dinner == daily_target
    
    def test_meal_distribution_with_fractional_calories(self):
        """Test meal distribution with non-round calorie targets"""
        daily_target = 2150.0
        breakfast, lunch, dinner = self.calculator.get_meal_targets(daily_target)
        
        # Expected: 537.5, 860.0, 752.5 -> rounded
        assert breakfast == 537.5
        assert lunch == 860.0 
        assert dinner == 752.5
        assert breakfast + lunch + dinner == daily_target
    
    def test_custom_meal_distribution(self):
        """Test custom meal distribution percentages"""
        custom_config = MealPlanConfig()
        custom_config.breakfast_percent = 0.30
        custom_config.lunch_percent = 0.35
        custom_config.dinner_percent = 0.35
        
        calculator = NutritionCalculator(custom_config)
        daily_target = 2000.0
        
        breakfast, lunch, dinner = calculator.get_meal_targets(daily_target)
        
        assert breakfast == 600.0  # 30%
        assert lunch == 700.0      # 35%
        assert dinner == 700.0     # 35%


class TestMacroCalculations:
    """Test macro percentage calculations"""
    
    def setup_method(self):
        self.calculator = NutritionCalculator()
    
    def test_macro_percentages_calculation(self):
        """Test macro percentage calculation from gram amounts"""
        calories = 400.0
        protein_g = 30.0   # 120 kcal (4 kcal/g)
        fat_g = 15.0       # 135 kcal (9 kcal/g)
        carbs_g = 36.25    # 145 kcal (4 kcal/g) -> Total: 400 kcal
        
        protein_pct, fat_pct, carbs_pct = self.calculator.calculate_macros_from_calories(
            calories, protein_g, fat_g, carbs_g
        )
        
        assert protein_pct == 30.0  # 120/400 = 30%
        assert fat_pct == 33.8      # 135/400 = 33.75% -> rounded to 33.8%
        assert carbs_pct == 36.2    # 145/400 = 36.25% -> rounded to 36.2%
    
    def test_macro_percentages_zero_calories(self):
        """Test macro percentage calculation with zero calories"""
        protein_pct, fat_pct, carbs_pct = self.calculator.calculate_macros_from_calories(
            0.0, 10.0, 5.0, 15.0
        )
        
        assert protein_pct == 0.0
        assert fat_pct == 0.0
        assert carbs_pct == 0.0
    
    def test_macro_percentages_realistic_meal(self):
        """Test macro calculation for realistic meal"""
        # Example: chicken breast with rice and vegetables
        calories = 350.0
        protein_g = 35.0   # 140 kcal 
        fat_g = 8.0        # 72 kcal
        carbs_g = 34.5     # 138 kcal -> Total: 350 kcal
        
        protein_pct, fat_pct, carbs_pct = self.calculator.calculate_macros_from_calories(
            calories, protein_g, fat_g, carbs_g
        )
        
        assert protein_pct == 40.0  # High protein meal
        assert fat_pct == 20.6
        assert carbs_pct == 39.4
        # Total should be close to 100%
        assert abs((protein_pct + fat_pct + carbs_pct) - 100.0) < 1.0


class TestIntegrationScenarios:
    """Test complete nutrition calculation workflows"""
    
    def setup_method(self):
        self.calculator = NutritionCalculator()
    
    def test_complete_male_cutting_scenario(self):
        """Test complete calculation for male cutting (weight loss)"""
        profile = UserProfile(
            age=28, sex=Sex.MALE, height_cm=180, weight_kg=85,
            activity_level=ActivityLevel.MODERATELY_ACTIVE, goal=Goal.LOSE_WEIGHT
        )
        
        bmr = self.calculator.calculate_bmr(profile)
        tdee = self.calculator.calculate_tdee(bmr, profile.activity_level)
        daily_target = self.calculator.calculate_daily_target(tdee, profile.goal)
        breakfast, lunch, dinner = self.calculator.get_meal_targets(daily_target)
        
        # Verify logical progression
        assert bmr > 0
        assert tdee > bmr  # TDEE should be higher than BMR
        assert daily_target < tdee  # Weight loss target should be below TDEE
        assert breakfast + lunch + dinner == daily_target
        assert lunch > breakfast  # Lunch should be largest meal (40%)
        assert dinner > breakfast  # Dinner should be larger than breakfast
    
    def test_complete_female_bulking_scenario(self):
        """Test complete calculation for female bulking (weight gain)"""
        profile = UserProfile(
            age=24, sex=Sex.FEMALE, height_cm=160, weight_kg=55,
            activity_level=ActivityLevel.VERY_ACTIVE, goal=Goal.GAIN_WEIGHT
        )
        
        bmr = self.calculator.calculate_bmr(profile)
        tdee = self.calculator.calculate_tdee(bmr, profile.activity_level)
        daily_target = self.calculator.calculate_daily_target(tdee, profile.goal)
        breakfast, lunch, dinner = self.calculator.get_meal_targets(daily_target)
        
        assert bmr > 0
        assert tdee > bmr
        assert daily_target > tdee  # Weight gain target should be above TDEE
        assert abs(breakfast + lunch + dinner - daily_target) < 0.1  # Allow for rounding differences
    
    def test_sedentary_maintenance_scenario(self):
        """Test calculation for sedentary maintenance"""
        profile = UserProfile(
            age=45, sex=Sex.MALE, height_cm=170, weight_kg=70,
            activity_level=ActivityLevel.SEDENTARY, goal=Goal.MAINTAIN
        )
        
        bmr = self.calculator.calculate_bmr(profile)
        tdee = self.calculator.calculate_tdee(bmr, profile.activity_level)
        daily_target = self.calculator.calculate_daily_target(tdee, profile.goal)
        
        # For sedentary maintenance, target should equal TDEE
        assert daily_target == tdee
        assert tdee == bmr * 1.2  # Sedentary multiplier


@pytest.fixture
def nutrition_calculator_instance():
    """Fixture providing nutrition calculator instance"""
    return NutritionCalculator()


@pytest.fixture
def sample_male_profile():
    """Fixture for standard male profile"""
    return UserProfile(
        age=30, sex=Sex.MALE, height_cm=175, weight_kg=75,
        activity_level=ActivityLevel.MODERATELY_ACTIVE, goal=Goal.MAINTAIN
    )


@pytest.fixture  
def sample_female_profile():
    """Fixture for standard female profile"""
    return UserProfile(
        age=25, sex=Sex.FEMALE, height_cm=165, weight_kg=60,
        activity_level=ActivityLevel.LIGHTLY_ACTIVE, goal=Goal.LOSE_WEIGHT
    )
