import logging
from typing import Tuple
from app.models.meal_plan import UserProfile, Sex, ActivityLevel, Goal, MealPlanConfig

logger = logging.getLogger(__name__)


class NutritionCalculator:
    """
    Handles BMR and TDEE calculations for meal planning.
    
    BMR calculated using Mifflin-St Jeor equation:
    - Men: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age + 5
    - Women: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age - 161
    
    TDEE = BMR × activity_multiplier
    Daily target = TDEE + goal_adjustment
    """
    
    def __init__(self, config: MealPlanConfig = None):
        self.config = config or MealPlanConfig()
    
    def calculate_bmr(self, profile: UserProfile) -> float:
        """
        Calculate Basal Metabolic Rate using Mifflin-St Jeor equation.
        
        Args:
            profile: User profile with age, sex, height, weight
            
        Returns:
            BMR in kcal/day
        """
        # Base calculation: 10 * weight + 6.25 * height - 5 * age
        bmr = (10 * profile.weight_kg) + (6.25 * profile.height_cm) - (5 * profile.age)
        
        # Sex-specific adjustment
        if profile.sex == Sex.MALE:
            bmr += 5
        else:  # female
            bmr -= 161
        
        logger.info(f"Calculated BMR: {bmr:.1f} kcal/day for {profile.sex.value}, "
                   f"age {profile.age}, {profile.weight_kg}kg, {profile.height_cm}cm")
        
        return float(bmr)
    
    def calculate_tdee(self, bmr: float, activity_level: ActivityLevel) -> float:
        """
        Calculate Total Daily Energy Expenditure.
        
        Args:
            bmr: Basal Metabolic Rate
            activity_level: Physical activity level
            
        Returns:
            TDEE in kcal/day
        """
        multiplier = self.config.activity_multipliers.get(activity_level.value, 1.2)
        tdee = bmr * multiplier
        
        logger.info(f"Calculated TDEE: {tdee:.1f} kcal/day (BMR {bmr} × {multiplier} for {activity_level.value})")
        
        return float(tdee)
    
    def calculate_daily_target(self, tdee: float, goal: Goal) -> float:
        """
        Calculate daily calorie target based on goal.
        
        Args:
            tdee: Total Daily Energy Expenditure
            goal: Weight management goal
            
        Returns:
            Daily calorie target in kcal/day
        """
        adjustment = self.config.goal_adjustments.get(goal.value, 0)
        target = tdee + adjustment
        
        logger.info(f"Daily calorie target: {target:.1f} kcal/day (TDEE {tdee} + {adjustment} for {goal.value})")
        
        return float(target)
    
    def get_meal_targets(self, daily_target: float) -> Tuple[float, float, float]:
        """
        Split daily calories into meal targets.
        
        Args:
            daily_target: Total daily calorie target
            
        Returns:
            Tuple of (breakfast_target, lunch_target, dinner_target)
        """
        breakfast = daily_target * self.config.breakfast_percent
        lunch = daily_target * self.config.lunch_percent
        dinner = daily_target * self.config.dinner_percent
        
        # Verify percentages sum to 1.0 (with small floating point tolerance)
        total_percent = self.config.breakfast_percent + self.config.lunch_percent + self.config.dinner_percent
        if abs(total_percent - 1.0) > 0.001:
            logger.warning(f"Meal percentages don't sum to 1.0: {total_percent}")
        
        logger.info(f"Meal targets - Breakfast: {breakfast:.1f}, Lunch: {lunch:.1f}, Dinner: {dinner:.1f}")
        
        return float(breakfast), float(lunch), float(dinner)
    
    def calculate_macros_from_calories(self, calories: float, protein_g: float, 
                                     fat_g: float, carbs_g: float) -> Tuple[float, float, float]:
        """
        Calculate macro percentages from gram amounts.
        
        Args:
            calories: Total calories
            protein_g: Protein in grams
            fat_g: Fat in grams  
            carbs_g: Carbohydrates in grams
            
        Returns:
            Tuple of (protein_percent, fat_percent, carbs_percent)
        """
        if calories <= 0:
            return 0.0, 0.0, 0.0
        
        # Calories per gram: protein=4, fat=9, carbs=4
        protein_calories = protein_g * 4
        fat_calories = fat_g * 9
        carbs_calories = carbs_g * 4
        
        protein_percent = (protein_calories / calories) * 100
        fat_percent = (fat_calories / calories) * 100
        carbs_percent = (carbs_calories / calories) * 100
        
        return round(protein_percent, 1), round(fat_percent, 1), round(carbs_percent, 1)


nutrition_calculator = NutritionCalculator()
