from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class RecommendationType(str, Enum):
    """Types of meal recommendations"""
    SIMILAR_NUTRITION = "similar_nutrition"
    COMPLEMENTARY_MACROS = "complementary_macros" 
    SEASONAL_TRENDS = "seasonal_trends"
    USER_HISTORY = "user_history"
    POPULAR_COMBINATIONS = "popular_combinations"
    DIETARY_GOALS = "dietary_goals"

class RecommendationReason(str, Enum):
    """Reason codes for recommendations"""
    HIGH_PROTEIN = "high_protein"
    LOW_CALORIE = "low_calorie" 
    BALANCED_MACROS = "balanced_macros"
    SIMILAR_TASTE = "similar_taste"
    FREQUENTLY_PAIRED = "frequently_paired"
    SEASONAL_AVAILABILITY = "seasonal_availability"
    DIETARY_PREFERENCE = "dietary_preference"
    GOAL_ALIGNMENT = "goal_alignment"

class NutritionalScore(BaseModel):
    """Nutritional scoring for recommendations"""
    overall_score: float = Field(..., ge=0.0, le=1.0, description="Overall nutritional score (0-1)")
    protein_score: float = Field(..., ge=0.0, le=1.0, description="Protein adequacy score")
    fiber_score: float = Field(..., ge=0.0, le=1.0, description="Fiber adequacy score") 
    micronutrient_score: float = Field(..., ge=0.0, le=1.0, description="Vitamin/mineral score")
    calorie_density_score: float = Field(..., ge=0.0, le=1.0, description="Calorie density appropriateness")

class RecommendationItem(BaseModel):
    """Individual recommended food item"""
    barcode: str = Field(..., description="Product barcode identifier")
    name: str = Field(..., description="Product name")
    brand: Optional[str] = Field(None, description="Product brand")
    image_url: Optional[str] = Field(None, description="Product image URL")
    
    # Nutritional information
    calories_per_serving: float = Field(..., description="Calories per recommended serving")
    serving_size: str = Field(..., description="Recommended serving size")
    protein_g: float = Field(..., ge=0, description="Protein content in grams")
    fat_g: float = Field(..., ge=0, description="Fat content in grams") 
    carbs_g: float = Field(..., ge=0, description="Carbohydrate content in grams")
    fiber_g: Optional[float] = Field(None, ge=0, description="Fiber content in grams")
    
    # Recommendation metadata
    recommendation_type: RecommendationType = Field(..., description="Type of recommendation")
    reasons: List[RecommendationReason] = Field(..., description="Why this item is recommended")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Recommendation confidence (0-1)")
    nutritional_score: NutritionalScore = Field(..., description="Nutritional quality scores")
    
    # User preference alignment
    preference_match: float = Field(..., ge=0.0, le=1.0, description="Match with user preferences")
    goal_alignment: float = Field(..., ge=0.0, le=1.0, description="Alignment with dietary goals")

class MealRecommendation(BaseModel):
    """Recommendations for a specific meal"""
    meal_name: str = Field(..., description="Name of the meal (Breakfast, Lunch, Dinner)")
    target_calories: float = Field(..., gt=0, description="Target calories for this meal")
    current_calories: float = Field(..., ge=0, description="Current calories in planned meal")
    recommendations: List[RecommendationItem] = Field(..., description="List of recommended items")
    
    # Meal-level insights
    macro_gaps: Dict[str, float] = Field(..., description="Macronutrient gaps to fill")
    micronutrient_gaps: List[str] = Field(default_factory=list, description="Missing vitamins/minerals")
    
class SmartRecommendationRequest(BaseModel):
    """Request for smart meal recommendations"""
    user_id: Optional[str] = Field(None, description="User identifier for personalized recommendations")
    current_meal_plan_id: Optional[str] = Field(None, description="Current meal plan to enhance")
    
    # Context for recommendations
    meal_context: Optional[str] = Field(None, description="Specific meal to recommend for (breakfast/lunch/dinner)")
    dietary_restrictions: List[str] = Field(default_factory=list, description="Dietary restrictions")
    cuisine_preferences: List[str] = Field(default_factory=list, description="Preferred cuisines")
    excluded_ingredients: List[str] = Field(default_factory=list, description="Ingredients to avoid")
    
    # Nutritional context  
    target_macros: Optional[Dict[str, float]] = Field(None, description="Target macro ratios")
    calorie_budget: Optional[float] = Field(None, gt=0, description="Available calories for recommendations")
    
    # Personalization
    include_history: bool = Field(True, description="Include user meal history in recommendations")
    max_recommendations: int = Field(10, ge=1, le=50, description="Maximum number of recommendations")
    min_confidence: float = Field(0.3, ge=0.0, le=1.0, description="Minimum confidence threshold")

class SmartRecommendationResponse(BaseModel):
    """Response containing smart meal recommendations"""
    user_id: Optional[str] = Field(None, description="User identifier")
    generated_at: datetime = Field(default_factory=datetime.now, description="When recommendations were generated")
    
    # Meal-specific recommendations
    meal_recommendations: List[MealRecommendation] = Field(..., description="Recommendations by meal")
    
    # Global recommendations
    daily_additions: List[RecommendationItem] = Field(default_factory=list, description="Items to add anywhere in the day")
    snack_recommendations: List[RecommendationItem] = Field(default_factory=list, description="Healthy snack options")
    
    # Insights and analytics
    nutritional_insights: Dict[str, Any] = Field(..., description="Nutritional analysis and insights")
    personalization_factors: List[str] = Field(..., description="Factors used in personalization")
    
    # Metadata
    total_recommendations: int = Field(..., description="Total number of recommendations")
    avg_confidence: float = Field(..., description="Average confidence score")
    recommendation_version: str = Field("1.0", description="Algorithm version used")

class RecommendationFeedback(BaseModel):
    """User feedback on recommendations"""
    user_id: str = Field(..., description="User providing feedback")
    recommendation_id: str = Field(..., description="ID of the recommendation") 
    barcode: str = Field(..., description="Product barcode that was recommended")
    
    # Feedback details
    accepted: bool = Field(..., description="Whether user accepted the recommendation")
    added_to_meal: Optional[str] = Field(None, description="Which meal it was added to, if any")
    rejection_reason: Optional[str] = Field(None, description="Reason for rejection")
    
    # Quality ratings
    relevance_rating: Optional[int] = Field(None, ge=1, le=5, description="Relevance rating (1-5)")
    taste_expectation: Optional[int] = Field(None, ge=1, le=5, description="Expected taste rating (1-5)")
    
    # Metadata
    feedback_at: datetime = Field(default_factory=datetime.now, description="When feedback was provided")

class RecommendationMetrics(BaseModel):
    """Analytics metrics for recommendation performance"""
    total_recommendations: int = Field(..., description="Total recommendations generated")
    acceptance_rate: float = Field(..., ge=0.0, le=1.0, description="Overall acceptance rate")
    avg_confidence: float = Field(..., ge=0.0, le=1.0, description="Average confidence score")
    
    # Performance by type
    type_performance: Dict[RecommendationType, Dict[str, float]] = Field(..., description="Performance metrics by type")
    
    # User engagement
    unique_users: int = Field(..., description="Number of unique users receiving recommendations")
    avg_recommendations_per_user: float = Field(..., description="Average recommendations per user")
    
    # Quality metrics
    avg_nutritional_score: float = Field(..., ge=0.0, le=1.0, description="Average nutritional quality")
    goal_alignment_score: float = Field(..., ge=0.0, le=1.0, description="Average goal alignment")