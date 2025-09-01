"""
Complete Nutrition Calculations Tests

This test suite provides comprehensive coverage for:
- BMR calculations using Mifflin-St Jeor equation
- TDEE calculations with activity level multipliers
- Daily target adjustments based on goals
- Meal distribution and calorie targeting
- Edge cases and validation

Target: Complete the missing 2% for 100% nutrition calculator coverage
"""

import pytest
from app.services.nutrition_calculator import nutrition_calculator
from app.models.meal_plan import UserProfile, Sex, ActivityLevel, Goal


class TestBMRCalculations:
    """Test BMR calculations using Mifflin-St Jeor equation"""
    
    def test_bmr_calculation_male_standard(self):
        """Test BMR calculation for standard male"""
        profile = UserProfile(
            age=30,
            weight_kg=80.0,  # kg
            height_cm=180,   # cm
            sex=Sex.MALE,
            activity_level=ActivityLevel.MODERATELY_ACTIVE,
            goal=Goal.MAINTAIN
        )
        
        # Mifflin-St Jeor for men: BMR = 10*weight + 6.25*height - 5*age + 5
        expected_bmr = 10 * 80 + 6.25 * 180 - 5 * 30 + 5
        expected_bmr = 10 * 80 + 1125 - 150 + 5  # 800 + 1125 - 150 + 5 = 1780
        
        actual_bmr = nutrition_calculator.calculate_bmr(profile)
        
        assert actual_bmr == expected_bmr
        assert actual_bmr == 1780.0
    
    def test_bmr_calculation_female_standard(self):
        """Test BMR calculation for standard female"""
        profile = UserProfile(
            age=25,
            weight_kg=65.0,  # kg
            height_cm=165,   # cm
            sex=Sex.FEMALE,
            activity_level=ActivityLevel.MODERATELY_ACTIVE,
            goal=Goal.MAINTAIN
        )
        
        # Mifflin-St Jeor for women: BMR = 10*weight + 6.25*height - 5*age - 161
        expected_bmr = 10 * 65 + 6.25 * 165 - 5 * 25 - 161
        expected_bmr = 650 + 1031.25 - 125 - 161  # = 1395.25
        
        actual_bmr = nutrition_calculator.calculate_bmr(profile)
        
        assert actual_bmr == expected_bmr
        assert actual_bmr == 1395.25
    
    def test_bmr_calculation_edge_cases(self):
        """Test BMR calculation edge cases"""
        # Very young, light person
        young_profile = UserProfile(
            age=18, weight=45.0, height=150, gender=Gender.FEMALE,
            activity_level=ActivityLevel.SEDENTARY, goal=Goal.LOSE_WEIGHT
        )
        
        young_bmr = nutrition_calculator.calculate_bmr(young_profile)
        expected_young = 10 * 45 + 6.25 * 150 - 5 * 18 - 161  # 450 + 937.5 - 90 - 161 = 1136.5
        assert young_bmr == 1136.5
        
        # Older, heavier person
        older_profile = UserProfile(
            age=65, weight=100.0, height=185, gender=Gender.MALE,
            activity_level=ActivityLevel.VERY_ACTIVE, goal=Goal.GAIN_WEIGHT
        )
        
        older_bmr = nutrition_calculator.calculate_bmr(older_profile)
        expected_older = 10 * 100 + 6.25 * 185 - 5 * 65 + 5  # 1000 + 1156.25 - 325 + 5 = 1836.25
        assert older_bmr == 1836.25


class TestTDEECalculations:
    """Test TDEE calculations with activity level multipliers"""
    
    def test_tdee_calculation_all_activity_levels(self):
        """Test TDEE calculation for all activity levels"""
        base_bmr = 1500.0
        
        # Activity level multipliers
        test_cases = [
            (ActivityLevel.SEDENTARY, 1.2, 1800.0),      # 1500 * 1.2
            (ActivityLevel.LIGHTLY_ACTIVE, 1.375, 2062.5),        # 1500 * 1.375
            (ActivityLevel.MODERATELY_ACTIVE, 1.55, 2325.0),      # 1500 * 1.55
            (ActivityLevel.VERY_ACTIVE, 1.725, 2587.5),       # 1500 * 1.725
            (ActivityLevel.VERY_ACTIVE, 1.9, 2850.0),    # 1500 * 1.9
        ]
        
        for activity_level, multiplier, expected_tdee in test_cases:
            profile = UserProfile(
                age=30, weight=70, height=170, gender=Gender.MALE,
                activity_level=activity_level, goal=Goal.MAINTAIN
            )
            
            tdee = nutrition_calculator.calculate_tdee(base_bmr, activity_level)
            
            assert tdee == expected_tdee
            assert tdee == base_bmr * multiplier
    
    def test_tdee_with_calculated_bmr(self):
        """Test TDEE using calculated BMR"""
        profile = UserProfile(
            age=30, weight=70, height=175, gender=Gender.MALE,
            activity_level=ActivityLevel.MODERATELY_ACTIVE, goal=Goal.MAINTAIN
        )
        
        bmr = nutrition_calculator.calculate_bmr(profile)
        tdee = nutrition_calculator.calculate_tdee(bmr, profile.activity_level)
        
        expected_bmr = 10 * 70 + 6.25 * 175 - 5 * 30 + 5  # 700 + 1093.75 - 150 + 5 = 1648.75
        expected_tdee = expected_bmr * 1.55  # 1648.75 * 1.55 = 2555.5625
        
        assert bmr == 1648.75
        assert tdee == 2555.5625


class TestDailyTargetCalculations:
    """Test daily target adjustments based on goals"""
    
    def test_daily_target_maintain_weight(self):
        """Test daily target for weight maintenance"""
        tdee = 2000.0
        
        target = nutrition_calculator.calculate_daily_target(tdee, Goal.MAINTAIN)
        
        assert target == tdee
        assert target == 2000.0
    
    def test_daily_target_lose_weight(self):
        """Test daily target for weight loss"""
        tdee = 2200.0
        
        target = nutrition_calculator.calculate_daily_target(tdee, Goal.LOSE_WEIGHT)
        
        # Should subtract 500 calories for weight loss
        expected_target = tdee - 500
        assert target == expected_target
        assert target == 1700.0
    
    def test_daily_target_gain_weight(self):
        """Test daily target for weight gain"""
        tdee = 1800.0
        
        target = nutrition_calculator.calculate_daily_target(tdee, Goal.GAIN_WEIGHT)
        
        # Should add 300 calories for weight gain
        expected_target = tdee + 300
        assert target == expected_target
        assert target == 2100.0
    
    def test_daily_target_edge_cases(self):
        """Test daily target calculations for edge cases"""
        # Very low TDEE with weight loss goal
        low_tdee = 1200.0
        lose_target = nutrition_calculator.calculate_daily_target(low_tdee, Goal.LOSE_WEIGHT)
        assert lose_target == 700.0  # 1200 - 500, might be very low but mathematically correct
        
        # Very high TDEE with weight gain goal
        high_tdee = 3000.0
        gain_target = nutrition_calculator.calculate_daily_target(high_tdee, Goal.GAIN_WEIGHT)
        assert gain_target == 3300.0  # 3000 + 300


class TestMealTargetDistribution:
    """Test meal calorie target distribution"""
    
    def test_meal_targets_standard_distribution(self):
        """Test standard meal distribution (25% breakfast, 40% lunch, 35% dinner)"""
        daily_target = 2000.0
        
        breakfast, lunch, dinner = nutrition_calculator.get_meal_targets(daily_target)
        
        # Standard distribution percentages
        expected_breakfast = daily_target * 0.25  # 500
        expected_lunch = daily_target * 0.40      # 800
        expected_dinner = daily_target * 0.35     # 700
        
        assert breakfast == expected_breakfast
        assert lunch == expected_lunch
        assert dinner == expected_dinner
        assert breakfast == 500.0
        assert lunch == 800.0
        assert dinner == 700.0
    
    def test_meal_targets_sum_equals_daily_target(self):
        """Test that meal targets sum to daily target"""
        test_targets = [1500.0, 2000.0, 2500.0, 3000.0]
        
        for daily_target in test_targets:
            breakfast, lunch, dinner = nutrition_calculator.get_meal_targets(daily_target)
            total = breakfast + lunch + dinner
            
            # Should sum to daily target (allowing for small floating point differences)
            assert abs(total - daily_target) < 0.01
    
    def test_meal_targets_proportional_scaling(self):
        """Test that meal targets scale proportionally"""
        base_target = 2000.0
        scale_factor = 1.5
        scaled_target = base_target * scale_factor
        
        base_breakfast, base_lunch, base_dinner = nutrition_calculator.get_meal_targets(base_target)
        scaled_breakfast, scaled_lunch, scaled_dinner = nutrition_calculator.get_meal_targets(scaled_target)
        
        # Scaled targets should be exactly scale_factor times the base
        assert scaled_breakfast == base_breakfast * scale_factor
        assert scaled_lunch == base_lunch * scale_factor
        assert scaled_dinner == base_dinner * scale_factor
    
    def test_meal_targets_very_low_calories(self):
        """Test meal targets with very low calorie goals"""
        low_target = 800.0
        
        breakfast, lunch, dinner = nutrition_calculator.get_meal_targets(low_target)
        
        assert breakfast == 200.0  # 800 * 0.25
        assert lunch == 320.0      # 800 * 0.40
        assert dinner == 280.0     # 800 * 0.35
        assert breakfast + lunch + dinner == low_target


class TestNutritionCalculatorIntegration:
    """Test complete nutrition calculation workflows"""
    
    def test_complete_male_workflow(self):
        """Test complete nutrition calculation workflow for male"""
        profile = UserProfile(
            age=35, weight=85, height=180, gender=Gender.MALE,
            activity_level=ActivityLevel.VERY_ACTIVE, goal=Goal.LOSE_WEIGHT
        )
        
        # Step 1: Calculate BMR
        bmr = nutrition_calculator.calculate_bmr(profile)
        expected_bmr = 10 * 85 + 6.25 * 180 - 5 * 35 + 5  # 850 + 1125 - 175 + 5 = 1805
        assert bmr == 1805.0
        
        # Step 2: Calculate TDEE
        tdee = nutrition_calculator.calculate_tdee(bmr, profile.activity_level)
        expected_tdee = bmr * 1.725  # 1805 * 1.725 = 3113.625
        assert tdee == 3113.625
        
        # Step 3: Calculate daily target
        daily_target = nutrition_calculator.calculate_daily_target(tdee, profile.goal)
        expected_target = tdee - 500  # 3113.625 - 500 = 2613.625
        assert daily_target == 2613.625
        
        # Step 4: Get meal targets
        breakfast, lunch, dinner = nutrition_calculator.get_meal_targets(daily_target)
        assert breakfast == daily_target * 0.25  # 653.40625
        assert lunch == daily_target * 0.40      # 1045.45
        assert dinner == daily_target * 0.35     # 914.76875
    
    def test_complete_female_workflow(self):
        """Test complete nutrition calculation workflow for female"""
        profile = UserProfile(
            age=28, weight=60, height=165, gender=Gender.FEMALE,
            activity_level=ActivityLevel.LIGHTLY_ACTIVE, goal=Goal.GAIN_WEIGHT
        )
        
        # Complete workflow
        bmr = nutrition_calculator.calculate_bmr(profile)
        tdee = nutrition_calculator.calculate_tdee(bmr, profile.activity_level)
        daily_target = nutrition_calculator.calculate_daily_target(tdee, profile.goal)
        breakfast, lunch, dinner = nutrition_calculator.get_meal_targets(daily_target)
        
        # Verify calculations
        expected_bmr = 10 * 60 + 6.25 * 165 - 5 * 28 - 161  # 600 + 1031.25 - 140 - 161 = 1330.25
        expected_tdee = expected_bmr * 1.375  # 1330.25 * 1.375 = 1829.09375
        expected_target = expected_tdee + 300  # 1829.09375 + 300 = 2129.09375
        
        assert bmr == 1330.25
        assert tdee == 1829.09375
        assert daily_target == 2129.09375
        assert breakfast + lunch + dinner == daily_target
    
    def test_nutrition_calculator_singleton(self):
        """Test that nutrition calculator is properly initialized"""
        # Test that the global instance exists and works
        assert nutrition_calculator is not None
        
        # Test basic functionality
        test_profile = UserProfile(
            age=25, weight=70, height=175, gender=Gender.MALE,
            activity_level=ActivityLevel.MODERATELY_ACTIVE, goal=Goal.MAINTAIN
        )
        
        bmr = nutrition_calculator.calculate_bmr(test_profile)
        assert isinstance(bmr, float)
        assert bmr > 0
        
        tdee = nutrition_calculator.calculate_tdee(bmr, test_profile.activity_level)
        assert isinstance(tdee, float)
        assert tdee > bmr
        
        target = nutrition_calculator.calculate_daily_target(tdee, test_profile.goal)
        assert isinstance(target, float)
        assert target == tdee  # MAINTAIN goal should equal TDEE


class TestNutritionCalculatorValidation:
    """Test validation and error handling"""
    
    def test_bmr_calculation_consistency(self):
        """Test BMR calculation consistency across multiple calls"""
        profile = UserProfile(
            age=30, weight_kg=70, height_cm=170, sex=Sex.MALE,
            activity_level=ActivityLevel.MODERATELY_ACTIVE, goal=Goal.MAINTAIN
        )
        
        # Multiple calls should return same result
        bmr1 = nutrition_calculator.calculate_bmr(profile)
        bmr2 = nutrition_calculator.calculate_bmr(profile)
        bmr3 = nutrition_calculator.calculate_bmr(profile)
        
        assert bmr1 == bmr2 == bmr3
    
    def test_meal_targets_precision(self):
        """Test meal target calculation precision"""
        # Use a target that doesn't divide evenly
        daily_target = 2333.0
        
        breakfast, lunch, dinner = nutrition_calculator.get_meal_targets(daily_target)
        
        # Check precision and rounding
        expected_breakfast = 2333.0 * 0.25  # 583.25
        expected_lunch = 2333.0 * 0.40       # 933.2
        expected_dinner = 2333.0 * 0.35      # 816.55
        
        assert breakfast == expected_breakfast
        assert lunch == expected_lunch  
        assert dinner == expected_dinner
        
        # Verify sum is still exact
        assert abs((breakfast + lunch + dinner) - daily_target) < 1e-10