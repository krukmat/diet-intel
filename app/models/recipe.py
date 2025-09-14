from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class DifficultyLevel(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class CuisineType(str, Enum):
    ITALIAN = "italian"
    MEXICAN = "mexican"
    CHINESE = "chinese"
    JAPANESE = "japanese"
    INDIAN = "indian"
    THAI = "thai"
    FRENCH = "french"
    SPANISH = "spanish"
    GREEK = "greek"
    MEDITERRANEAN = "mediterranean"
    AMERICAN = "american"
    KOREAN = "korean"
    MIDDLE_EASTERN = "middle_eastern"
    BRITISH = "british"
    GERMAN = "german"
    VIETNAMESE = "vietnamese"
    LEBANESE = "lebanese"
    TURKISH = "turkish"
    BRAZILIAN = "brazilian"
    MOROCCAN = "moroccan"
    ETHIOPIAN = "ethiopian"
    PERUVIAN = "peruvian"
    FUSION = "fusion"
    OTHER = "other"


class MealType(str, Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    SNACK = "snack"
    DESSERT = "dessert"
    APPETIZER = "appetizer"
    ANY = "any"


class CreatedBy(str, Enum):
    AI_GENERATED = "ai_generated"
    USER_CREATED = "user_created"


# ===== REQUEST MODELS =====

class RecipeGenerationRequest(BaseModel):
    """Request model for AI recipe generation"""
    user_id: Optional[str] = None
    
    # Recipe preferences
    cuisine_preferences: List[str] = Field(default_factory=list, description="Preferred cuisines")
    dietary_restrictions: List[str] = Field(default_factory=list, description="Dietary restrictions")
    difficulty_preference: DifficultyLevel = DifficultyLevel.EASY
    meal_type: Optional[MealType] = MealType.ANY
    
    # Nutritional targets (per serving)
    target_calories_per_serving: Optional[float] = None
    target_protein_g: Optional[float] = None
    target_carbs_g: Optional[float] = None
    target_fat_g: Optional[float] = None
    
    # Recipe specifications
    servings: int = Field(default=4, ge=1, le=12)
    max_prep_time_minutes: Optional[int] = Field(None, ge=5, le=240)
    max_cook_time_minutes: Optional[int] = Field(None, ge=0, le=360)
    
    # Ingredient preferences
    preferred_ingredients: List[str] = Field(default_factory=list)
    excluded_ingredients: List[str] = Field(default_factory=list)
    
    # Context
    cooking_skill_level: str = "beginner"  # beginner, intermediate, advanced
    available_equipment: List[str] = Field(default_factory=list)
    
    @validator('cuisine_preferences')
    def validate_cuisine_preferences(cls, v):
        if len(v) > 5:
            raise ValueError("Maximum 5 cuisine preferences allowed")
        return v
    
    @validator('dietary_restrictions') 
    def validate_dietary_restrictions(cls, v):
        valid_restrictions = [
            "vegetarian", "vegan", "gluten_free", "dairy_free", "nut_free",
            "low_carb", "low_fat", "low_sodium", "paleo", "keto", "halal", "kosher"
        ]
        for restriction in v:
            if restriction not in valid_restrictions:
                raise ValueError(f"Invalid dietary restriction: {restriction}")
        return v


class RecipeOptimizationRequest(BaseModel):
    """Request model for recipe optimization"""
    recipe_data: Dict[str, Any] = Field(description="Existing recipe data")
    optimization_goal: str = Field(default="balanced", description="balanced, weight_loss, muscle_gain, heart_health")
    dietary_restrictions: List[str] = Field(default_factory=list)
    target_servings: Optional[int] = None


class RecipeRatingRequest(BaseModel):
    """Request model for recipe rating"""
    rating: int = Field(ge=1, le=5, description="Rating from 1 to 5 stars")
    review: Optional[str] = Field(None, max_length=1000)
    made_modifications: bool = False
    would_make_again: Optional[bool] = None


class ShoppingListRequest(BaseModel):
    """Request model for shopping list generation"""
    name: str = Field(max_length=100)
    recipe_ids: List[str] = Field(min_items=1, max_items=20)
    store_preferences: Optional[Dict[str, Any]] = None
    budget_limit: Optional[float] = None


# ===== RESPONSE MODELS =====

class RecipeIngredientResponse(BaseModel):
    """Response model for recipe ingredient"""
    name: str
    quantity: float
    unit: str
    barcode: Optional[str] = None
    calories_per_unit: float = 0.0
    protein_g_per_unit: float = 0.0
    fat_g_per_unit: float = 0.0
    carbs_g_per_unit: float = 0.0
    is_optional: bool = False
    preparation_note: Optional[str] = None


class RecipeInstructionResponse(BaseModel):
    """Response model for recipe instruction"""
    step_number: int
    instruction: str
    cooking_method: Optional[str] = None
    duration_minutes: Optional[int] = None
    temperature_celsius: Optional[int] = None


class RecipeNutritionResponse(BaseModel):
    """Response model for recipe nutrition"""
    calories_per_serving: float = 0.0
    protein_g_per_serving: float = 0.0
    fat_g_per_serving: float = 0.0
    carbs_g_per_serving: float = 0.0
    fiber_g_per_serving: float = 0.0
    sugar_g_per_serving: float = 0.0
    sodium_mg_per_serving: float = 0.0
    recipe_score: float = 0.0


class GeneratedRecipeResponse(BaseModel):
    """Response model for generated recipe"""
    id: str
    name: str
    description: str
    cuisine_type: str
    difficulty_level: DifficultyLevel
    prep_time_minutes: int
    cook_time_minutes: int
    servings: int
    
    ingredients: List[RecipeIngredientResponse]
    instructions: List[RecipeInstructionResponse]
    nutrition: Optional[RecipeNutritionResponse] = None
    
    created_by: CreatedBy
    confidence_score: float = Field(ge=0.0, le=1.0)
    generation_time_ms: float = 0.0
    tags: List[str] = Field(default_factory=list)

    # Personalization metadata (added in Phase R.3.1.1 Task 8)
    personalization: Optional[Dict[str, Any]] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RecipeSearchResponse(BaseModel):
    """Response model for recipe search"""
    recipes: List[Dict[str, Any]]
    total_count: int
    page: int
    page_size: int
    has_more: bool


class RecipeRatingResponse(BaseModel):
    """Response model for recipe ratings"""
    recipe_id: str
    total_ratings: int
    average_rating: float
    would_make_again_percentage: float
    user_rating: Optional[int] = None
    user_review: Optional[str] = None


class ShoppingListResponse(BaseModel):
    """Response model for shopping list"""
    id: str
    name: str
    recipe_ids: List[str]
    ingredients: List[Dict[str, Any]]
    estimated_cost: Optional[float] = None
    store_optimization: Optional[Dict[str, Any]] = None
    created_at: datetime
    expires_at: Optional[datetime] = None


class RecipeAnalyticsResponse(BaseModel):
    """Response model for recipe analytics"""
    period_days: int
    generation_stats: Dict[str, Any]
    popular_cuisines: List[Dict[str, Any]]
    rating_stats: Dict[str, Any]


# ===== SEARCH MODELS =====

class RecipeSearchRequest(BaseModel):
    """Request model for recipe search"""
    query: Optional[str] = None
    cuisine_type: Optional[str] = None
    difficulty_level: Optional[DifficultyLevel] = None
    max_prep_time_minutes: Optional[int] = None
    max_cook_time_minutes: Optional[int] = None
    dietary_restrictions: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    min_rating: Optional[float] = Field(None, ge=1.0, le=5.0)
    
    # Pagination
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    
    # Sorting
    sort_by: str = Field(default="confidence_score", 
                        description="Sort by: confidence_score, created_at, rating, prep_time")
    sort_order: str = Field(default="desc", description="asc or desc")


# ===== CACHE MODELS =====

class RecipeCacheEntry(BaseModel):
    """Model for recipe cache entries"""
    cache_key: str
    recipe_data: GeneratedRecipeResponse
    created_at: datetime
    ttl_seconds: int
    
    @property
    def is_expired(self) -> bool:
        """Check if cache entry is expired"""
        expiry_time = self.created_at.timestamp() + self.ttl_seconds
        return datetime.now().timestamp() > expiry_time


# ===== USER TASTE PROFILE MODELS =====

class CuisinePreference(BaseModel):
    """Model for individual cuisine preference"""
    cuisine: str
    score: float = Field(ge=-1.0, le=1.0)
    count: int = Field(ge=0)


class IngredientPreference(BaseModel):
    """Model for individual ingredient preference"""
    ingredient: str
    preference: float = Field(ge=-1.0, le=1.0)
    frequency: int = Field(ge=0)


class UserTasteProfileRequest(BaseModel):
    """Request model for updating user taste profile"""
    user_id: str
    learning_data: Optional[Dict[str, Any]] = None


class UserTasteProfileResponse(BaseModel):
    """Response model for user taste profile"""
    user_id: str
    profile_confidence: float = Field(ge=0.0, le=1.0)
    total_ratings_analyzed: int = Field(ge=0)

    # Preferences
    cuisine_preferences: List[CuisinePreference] = Field(default_factory=list)
    difficulty_preferences: Dict[str, float] = Field(default_factory=dict)
    liked_ingredients: List[IngredientPreference] = Field(default_factory=list)
    disliked_ingredients: List[IngredientPreference] = Field(default_factory=list)
    cooking_method_preferences: Dict[str, float] = Field(default_factory=dict)

    # Time preferences
    preferred_prep_time_minutes: int = 30
    preferred_cook_time_minutes: int = 45
    quick_meal_preference: float = Field(default=0.5, ge=0.0, le=1.0)

    # Nutritional preferences
    preferred_calories_per_serving: float = 400.0
    preferred_protein_ratio: float = Field(default=0.2, ge=0.0, le=1.0)
    preferred_carb_ratio: float = Field(default=0.5, ge=0.0, le=1.0)
    preferred_fat_ratio: float = Field(default=0.3, ge=0.0, le=1.0)

    # Behavioral patterns
    modification_tendency: float = Field(default=0.0, ge=0.0, le=1.0)
    repeat_cooking_tendency: float = Field(default=0.5, ge=0.0, le=1.0)

    # Metadata
    last_learning_update: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PersonalizedRecipeRequest(BaseModel):
    """Request model for personalized recipe generation"""
    user_id: str
    base_request: RecipeGenerationRequest
    use_taste_profile: bool = True
    personalization_weight: float = Field(default=0.7, ge=0.0, le=1.0)


class RecipeRecommendation(BaseModel):
    """Model for individual recipe recommendation"""
    recipe_id: str
    recommendation_score: float = Field(ge=0.0, le=1.0)
    reason_codes: List[str] = Field(default_factory=list)
    cuisine_match_score: float = Field(default=0.0, ge=0.0, le=1.0)
    ingredient_match_score: float = Field(default=0.0, ge=0.0, le=1.0)
    difficulty_match_score: float = Field(default=0.0, ge=0.0, le=1.0)
    time_match_score: float = Field(default=0.0, ge=0.0, le=1.0)
    nutrition_match_score: float = Field(default=0.0, ge=0.0, le=1.0)


class PersonalizedRecommendationsResponse(BaseModel):
    """Response model for personalized recipe recommendations"""
    user_id: str
    recommendations: List[RecipeRecommendation]
    profile_confidence: float = Field(ge=0.0, le=1.0)
    total_available: int
    generated_at: datetime


class UserLearningProgressResponse(BaseModel):
    """Response model for user learning progress"""
    user_id: str
    ratings_milestone: int
    cuisines_explored: int
    ingredients_learned: int
    profile_accuracy_score: float = Field(ge=0.0, le=1.0)
    recommendation_success_rate: float = Field(ge=0.0, le=1.0)
    dominant_cuisine: Optional[str] = None
    flavor_profile: Optional[str] = None
    cooking_complexity_preference: Optional[str] = None
    achievements: List[str] = Field(default_factory=list)
    learning_started_at: Optional[datetime] = None
    last_milestone_reached_at: Optional[datetime] = None


# ===== ERROR MODELS =====

class RecipeGenerationError(BaseModel):
    """Model for recipe generation errors"""
    error_code: str
    error_message: str
    details: Optional[Dict[str, Any]] = None
    suggestions: List[str] = Field(default_factory=list)


class RecipeValidationError(BaseModel):
    """Model for recipe validation errors"""
    field: str
    error_message: str
    invalid_value: Optional[Any] = None