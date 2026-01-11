from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum
import builtins
from pydantic import BaseModel, Field, root_validator


class Sex(str, Enum):
    MALE = "male"
    FEMALE = "female"


if not hasattr(builtins, "Gender"):
    builtins.Gender = Sex


class ActivityLevel(str, Enum):
    SEDENTARY = "sedentary"          # Little or no exercise
    LIGHTLY_ACTIVE = "lightly_active"  # Light exercise/sports 1-3 days/week
    MODERATELY_ACTIVE = "moderately_active"  # Moderate exercise/sports 3-5 days/week
    VERY_ACTIVE = "very_active"      # Hard exercise/sports 6-7 days a week
    EXTRA_ACTIVE = "extra_active"    # Very hard exercise/sports + physical job


class Goal(str, Enum):
    LOSE_WEIGHT = "lose_weight"      # -500 kcal deficit
    MAINTAIN = "maintain"            # 0 kcal adjustment
    GAIN_WEIGHT = "gain_weight"      # +300 kcal surplus


class UserProfile(BaseModel):
    age: int = Field(..., ge=10, le=120, description="Age in years")
    sex: Sex = Field(..., description="Biological sex")
    height_cm: float = Field(..., ge=100, le=250, description="Height in centimeters")
    weight_kg: float = Field(..., ge=30, le=300, description="Weight in kilograms")
    activity_level: ActivityLevel = Field(..., description="Physical activity level")
    goal: Goal = Field(..., description="Weight management goal")

    @root_validator(pre=True)
    def _apply_legacy_aliases(cls, values):
        """Support legacy field names (weight, height, gender) for backward compatibility."""
        if "weight_kg" not in values and "weight" in values:
            values["weight_kg"] = values["weight"]
        if "height_cm" not in values and "height" in values:
            values["height_cm"] = values["height"]
        if "sex" not in values and "gender" in values:
            gender_value = values["gender"]
            if isinstance(gender_value, Sex):
                values["sex"] = gender_value
            elif isinstance(gender_value, str):
                try:
                    values["sex"] = Sex(gender_value.lower())
                except ValueError:
                    pass
            else:
                try:
                    values["sex"] = Sex(gender_value.value)
                except Exception:
                    pass
        return values


class Preferences(BaseModel):
    dietary_restrictions: List[str] = Field(default_factory=list, description="Dietary restrictions (e.g., vegetarian, gluten-free)")
    excludes: List[str] = Field(default_factory=list, description="Foods/ingredients to exclude")
    prefers: List[str] = Field(default_factory=list, description="Preferred foods/ingredients")


class MealPlanRequest(BaseModel):
    user_profile: UserProfile = Field(..., description="User's profile information")
    preferences: Preferences = Field(default_factory=Preferences, description="Dietary preferences")
    optional_products: Optional[List[str]] = Field(default=None, description="Optional product barcodes to prioritize")
    flexibility: Optional[bool] = Field(default=False, description="Allow flexible meal composition")


class MealItemMacros(BaseModel):
    protein_g: float = Field(..., description="Protein in grams")
    fat_g: float = Field(..., description="Fat in grams")
    carbs_g: float = Field(..., description="Carbohydrates in grams")
    sugars_g: Optional[float] = Field(None, description="Sugars in grams")
    salt_g: Optional[float] = Field(None, description="Salt in grams")


class MealItem(BaseModel):
    barcode: str = Field(..., description="Product barcode")
    name: str = Field(..., description="Product name")
    serving: str = Field(..., description="Serving size (e.g., '150g', '1 cup')")
    calories: float = Field(..., description="Calories for this serving")
    macros: MealItemMacros = Field(..., description="Macronutrients for this serving")


class Meal(BaseModel):
    name: str = Field(..., description="Meal name (Breakfast, Lunch, Dinner)")
    target_calories: float = Field(..., description="Target calories for this meal")
    actual_calories: float = Field(..., description="Actual calories from selected items")
    items: List[MealItem] = Field(..., description="Food items in this meal")


class DailyMacros(BaseModel):
    total_calories: float = Field(..., description="Total daily calories")
    protein_g: float = Field(..., description="Total protein in grams")
    fat_g: float = Field(..., description="Total fat in grams")
    carbs_g: float = Field(..., description="Total carbohydrates in grams")
    sugars_g: float = Field(..., description="Total sugars in grams")
    salt_g: float = Field(..., description="Total salt in grams")
    
    # Percentage breakdowns
    protein_percent: float = Field(..., description="Protein as % of calories")
    fat_percent: float = Field(..., description="Fat as % of calories")
    carbs_percent: float = Field(..., description="Carbs as % of calories")


class MealPlanResponse(BaseModel):
    # User metrics
    bmr: float = Field(..., description="Basal Metabolic Rate (kcal/day)")
    tdee: float = Field(..., description="Total Daily Energy Expenditure (kcal/day)")
    daily_calorie_target: float = Field(..., description="Adjusted daily calorie target based on goal")
    
    # Meal plan
    meals: List[Meal] = Field(..., description="Daily meals")
    metrics: DailyMacros = Field(..., description="Daily nutritional metrics")
    
    # Metadata
    plan_id: Optional[str] = Field(None, description="Unique plan identifier for storage and retrieval")
    created_at: datetime = Field(default_factory=datetime.now, description="Plan generation timestamp")
    flexibility_used: bool = Field(..., description="Whether flexibility was applied")
    optional_products_used: int = Field(default=0, description="Number of optional products included")
    is_active: bool = Field(default=False, description="Indicates whether this plan is currently active")


class SwapOperation(BaseModel):
    old_barcode: str = Field(..., description="Barcode of item to replace")
    new_barcode: str = Field(..., description="Barcode of replacement item")


class RemoveOperation(BaseModel):
    barcode: str = Field(..., description="Barcode of item to remove")


class ManualAddition(BaseModel):
    barcode: Optional[str] = Field(default=None, description="Barcode of item when available")
    name: str = Field(..., description="Name of manual item")
    calories: float = Field(..., ge=0, description="Calories for the item")
    protein_g: float = Field(default=0.0, ge=0, description="Protein in grams")
    fat_g: float = Field(default=0.0, ge=0, description="Fat in grams")
    carbs_g: float = Field(default=0.0, ge=0, description="Carbohydrates in grams")
    sugars_g: Optional[float] = Field(default=None, ge=0, description="Sugars in grams")
    salt_g: Optional[float] = Field(default=None, ge=0, description="Salt in grams")
    serving: str = Field(default="1 serving", description="Serving size description")


class MealCalorieAdjustment(BaseModel):
    meal_name: str = Field(..., description="Name of meal to adjust (Breakfast, Lunch, Dinner)")
    new_target: float = Field(..., ge=0, description="New calorie target for the meal")


class PlanCustomizationRequest(BaseModel):
    swap: Optional[SwapOperation] = Field(None, description="Swap one item for another")
    remove: Optional[RemoveOperation] = Field(None, description="Remove an item")
    add_manual: Optional[ManualAddition] = Field(None, description="Add a manual item")
    adjust_meal_calories: Optional[MealCalorieAdjustment] = Field(None, description="Adjust meal calorie target")
    
    def has_operations(self) -> bool:
        """Check if any operations are specified"""
        return any([self.swap, self.remove, self.add_manual, self.adjust_meal_calories])


class ChangeLogEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now, description="When the change was made")
    change_type: str = Field(..., description="Type of change (swap, remove, add_manual, adjust_calories)")
    description: str = Field(..., description="Human-readable description of the change")
    meal_affected: Optional[str] = Field(None, description="Which meal was affected")


class CustomizedPlanResponse(BaseModel):
    plan: MealPlanResponse = Field(..., description="Updated meal plan")
    change_log: List[ChangeLogEntry] = Field(..., description="Log of changes made")
    plan_id: str = Field(..., description="Plan ID for future references")


class MealPlanConfig(BaseModel):
    """Configuration for meal planning algorithm"""
    # Meal distribution percentages (must sum to 1.0)
    breakfast_percent: float = Field(default=0.25, description="Breakfast calorie percentage")
    lunch_percent: float = Field(default=0.40, description="Lunch calorie percentage") 
    dinner_percent: float = Field(default=0.35, description="Dinner calorie percentage")
    
    # Item limits
    max_items_per_meal: int = Field(default=3, description="Maximum items per meal")
    max_items_flexible: int = Field(default=5, description="Maximum items per meal with flexibility")
    
    # Tolerance settings
    calorie_tolerance_strict: float = Field(default=0.05, description="Strict calorie tolerance (±5%)")
    calorie_tolerance_flexible: float = Field(default=0.15, description="Flexible calorie tolerance (±15%)")
    
    # Activity level multipliers for TDEE calculation
    activity_multipliers: Dict[str, float] = Field(default={
        "sedentary": 1.2,
        "lightly_active": 1.375,
        "moderately_active": 1.55,
        "very_active": 1.725,
        "extra_active": 1.9
    })
    
    # Goal adjustments (kcal)
    goal_adjustments: Dict[str, int] = Field(default={
        "lose_weight": -500,
        "maintain": 0,
        "gain_weight": 300
    })


class AddProductRequest(BaseModel):
    barcode: str = Field(..., min_length=1, description="Product barcode to add to meal plan")
    meal_type: Optional[str] = Field("lunch", description="Target meal (breakfast, lunch, dinner)")
    serving_size: Optional[str] = Field(None, description="Custom serving size (e.g., '150g', '1 cup')")


class AddProductResponse(BaseModel):
    success: bool = Field(..., description="Whether the product was added successfully")
    message: str = Field(..., description="Human-readable result message")
    meal_type: Optional[str] = Field(None, description="Meal the product was added to")
    product_name: Optional[str] = Field(None, description="Name of the added product")
    calories_added: Optional[float] = Field(None, description="Calories added to the meal plan")
