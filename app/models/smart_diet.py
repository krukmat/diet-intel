"""
Smart Diet Models - Unified AI Nutrition Assistant
Integrates Smart Recommendations + Smart Meal Optimization
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

# Import existing recommendation models for backward compatibility
from app.models.recommendation import (
    RecommendationType as LegacyRecommendationType,
    RecommendationReason,
    NutritionalScore,
    RecommendationItem as LegacyRecommendationItem
)


class SuggestionType(str, Enum):
    """Types of Smart Diet suggestions"""
    RECOMMENDATION = "recommendation"  # Food discovery suggestions
    OPTIMIZATION = "optimization"      # Meal plan improvements
    INSIGHT = "insight"               # Nutritional analysis & advice


class SuggestionCategory(str, Enum):
    """Categories of Smart Diet suggestions"""
    DISCOVERY = "discovery"                # New food discovery
    MEAL_ADDITION = "meal_addition"        # Add to existing meal
    FOOD_SWAP = "food_swap"               # Replace current food
    PORTION_ADJUST = "portion_adjust"      # Adjust portion sizes
    NUTRITIONAL_GAP = "nutritional_gap"    # Fill nutrient gaps


class SmartDietContext(str, Enum):
    """Context types for Smart Diet suggestions"""
    TODAY = "today"                # Mixed suggestions for today
    OPTIMIZE = "optimize"          # Focus on meal plan optimization
    DISCOVER = "discover"          # Focus on food discovery
    INSIGHTS = "insights"          # Focus on nutritional insights


class SmartSuggestion(BaseModel):
    """Unified model for all Smart Diet suggestions"""
    # Core identification
    id: str = Field(..., description="Unique suggestion identifier")
    user_id: Optional[str] = Field(None, description="User identifier")
    suggestion_type: SuggestionType = Field(..., description="Type of suggestion")
    category: SuggestionCategory = Field(..., description="Category of suggestion")
    
    # Display content
    title: str = Field(..., description="Human-readable suggestion title")
    description: str = Field(..., description="Detailed suggestion description")
    reasoning: str = Field(..., description="AI reasoning for this suggestion")
    
    # Food/product information
    suggested_item: Dict[str, Any] = Field(..., description="Main suggested food item")
    current_item: Optional[Dict[str, Any]] = Field(None, description="Current item to replace (for optimizations)")
    
    # Nutritional impact (unified across all types)
    nutritional_benefit: Dict[str, float] = Field(default_factory=dict, description="Nutritional benefits")
    calorie_impact: int = Field(0, description="Calorie impact (positive or negative)")
    macro_impact: Dict[str, float] = Field(default_factory=dict, description="Macro percentage changes")
    
    # AI confidence and priority
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="AI confidence (0-1)")
    priority_score: float = Field(0.5, ge=0.0, le=1.0, description="Display priority")
    
    # Context and targeting
    meal_context: Optional[str] = Field(None, description="Target meal (breakfast/lunch/dinner)")
    planning_context: SmartDietContext = Field(..., description="Context this suggestion was generated for")
    
    # Implementation details
    implementation_complexity: str = Field("simple", description="Complexity: simple, moderate, complex")
    implementation_notes: Optional[str] = Field(None, description="Implementation instructions")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")
    expires_at: Optional[datetime] = Field(None, description="Expiration timestamp")
    tags: List[str] = Field(default_factory=list, description="Suggestion tags")
    
    # Legacy compatibility
    legacy_recommendation_data: Optional[Dict[str, Any]] = Field(None, description="Legacy recommendation data for migration")


class OptimizationSuggestion(SmartSuggestion):
    """Specialized optimization suggestion"""
    # Optimization-specific fields
    optimization_type: str = Field(..., description="Type of optimization: swap, add, adjust")
    target_improvement: Dict[str, float] = Field(..., description="Expected improvements")
    current_meal_analysis: Optional[Dict[str, Any]] = Field(None, description="Current meal analysis")
    
    # Always set for optimizations
    suggestion_type: SuggestionType = Field(SuggestionType.OPTIMIZATION, description="Always optimization")


class SmartDietRequest(BaseModel):
    """Unified request for Smart Diet suggestions"""
    # User context
    user_id: Optional[str] = Field(None, description="User identifier for personalized suggestions")
    
    # Context specification
    context_type: SmartDietContext = Field(SmartDietContext.TODAY, description="Type of suggestions requested")
    meal_context: Optional[str] = Field(None, description="Target meal context")
    current_meal_plan_id: Optional[str] = Field(None, description="Current meal plan to optimize")
    
    # Preferences and restrictions (inherited from legacy)
    dietary_restrictions: List[str] = Field(default_factory=list, description="Dietary restrictions")
    cuisine_preferences: List[str] = Field(default_factory=list, description="Preferred cuisines")
    excluded_ingredients: List[str] = Field(default_factory=list, description="Ingredients to avoid")
    
    # Nutritional context
    target_macros: Optional[Dict[str, float]] = Field(None, description="Target macro ratios")
    calorie_budget: Optional[float] = Field(None, gt=0, description="Available calories")
    
    # Generation parameters
    max_suggestions: int = Field(10, ge=1, le=50, description="Maximum suggestions to return")
    min_confidence: float = Field(0.3, ge=0.0, le=1.0, description="Minimum confidence threshold")
    include_optimizations: bool = Field(True, description="Include optimization suggestions")
    include_recommendations: bool = Field(True, description="Include discovery recommendations")
    
    # Localization
    lang: str = Field("en", description="Target language for translations (en, es, fr, etc.)")
    
    # Time and freshness
    requested_at: datetime = Field(default_factory=datetime.now, description="Request timestamp")


class SmartDietResponse(BaseModel):
    """Unified response for Smart Diet suggestions"""
    # Request context
    user_id: Optional[str] = Field(None, description="User identifier")
    context_type: SmartDietContext = Field(..., description="Context type that was requested")
    generated_at: datetime = Field(default_factory=datetime.now, description="Generation timestamp")
    
    # Suggestions by context
    suggestions: List[SmartSuggestion] = Field(default_factory=list, description="All suggestions")
    
    # Context-specific groupings
    today_highlights: List[SmartSuggestion] = Field(default_factory=list, description="Today's top suggestions")
    optimizations: List[SmartSuggestion] = Field(default_factory=list, description="Meal optimization suggestions")  
    discoveries: List[SmartSuggestion] = Field(default_factory=list, description="Food discovery suggestions")
    insights: List[SmartSuggestion] = Field(default_factory=list, description="Nutritional insights")
    
    # Analytics and insights
    nutritional_summary: Dict[str, Any] = Field(default_factory=dict, description="Nutritional analysis")
    personalization_factors: List[str] = Field(default_factory=list, description="Personalization factors used")
    
    # Performance metrics
    total_suggestions: int = Field(0, description="Total number of suggestions")
    avg_confidence: float = Field(0.0, description="Average confidence score")
    generation_time_ms: Optional[float] = Field(None, description="Generation time in milliseconds")
    
    # Version and metadata
    smart_diet_version: str = Field("1.0", description="Smart Diet algorithm version")
    
    # Legacy compatibility
    legacy_meal_recommendations: List[Dict] = Field(default_factory=list, description="Legacy format for migration")


class SuggestionFeedback(BaseModel):
    """User feedback on Smart Diet suggestions"""
    # Core feedback
    suggestion_id: str = Field(..., description="Suggestion being rated")
    user_id: str = Field(..., description="User providing feedback")
    action: str = Field(..., description="Action taken: accepted, rejected, saved, modified")
    
    # Detailed feedback
    feedback_reason: Optional[str] = Field(None, description="Reason for the action")
    implementation_notes: Optional[str] = Field(None, description="How the user implemented it")
    satisfaction_rating: Optional[int] = Field(None, ge=1, le=5, description="Satisfaction rating (1-5)")
    
    # Context
    meal_context: Optional[str] = Field(None, description="Meal it was used for")
    used_at: Optional[datetime] = Field(None, description="When the suggestion was actually used")
    
    # Metadata
    feedback_at: datetime = Field(default_factory=datetime.now, description="Feedback timestamp")


class SmartDietInsights(BaseModel):
    """Comprehensive diet insights and analysis"""
    # Time context
    period: str = Field(..., description="Analysis period (day/week/month)")
    user_id: str = Field(..., description="User identifier")
    analysis_date: datetime = Field(default_factory=datetime.now, description="Analysis timestamp")
    
    # Nutritional analysis
    nutritional_gaps: Dict[str, float] = Field(default_factory=dict, description="Identified nutrient gaps")
    macro_trends: Dict[str, List[float]] = Field(default_factory=dict, description="Macro intake trends")
    calorie_trends: List[float] = Field(default_factory=list, description="Daily calorie trends")
    
    # Behavioral insights
    eating_patterns: Dict[str, Any] = Field(default_factory=dict, description="Eating behavior patterns")
    successful_suggestions: List[SmartSuggestion] = Field(default_factory=list, description="Well-received suggestions")
    ignored_suggestions: List[SmartSuggestion] = Field(default_factory=list, description="Ignored suggestions")
    
    # Recommendations for improvement
    priority_improvements: List[str] = Field(default_factory=list, description="Priority areas for improvement")
    suggested_changes: List[SmartSuggestion] = Field(default_factory=list, description="Recommended changes")
    
    # Progress metrics
    goal_progress: Dict[str, float] = Field(default_factory=dict, description="Progress towards dietary goals")
    improvement_score: float = Field(0.0, ge=0.0, le=1.0, description="Overall improvement score")


class SmartDietMetrics(BaseModel):
    """Performance metrics for Smart Diet system"""
    # Time period
    period_days: int = Field(..., description="Metrics period in days")
    analysis_date: datetime = Field(default_factory=datetime.now, description="Analysis timestamp")
    
    # Usage metrics
    total_suggestions: int = Field(0, description="Total suggestions generated")
    unique_users: int = Field(0, description="Unique users served")
    suggestions_per_user: float = Field(0.0, description="Average suggestions per user")
    
    # Engagement metrics
    overall_acceptance_rate: float = Field(0.0, ge=0.0, le=1.0, description="Overall acceptance rate")
    context_performance: Dict[SmartDietContext, Dict[str, float]] = Field(
        default_factory=dict, 
        description="Performance by context type"
    )
    category_performance: Dict[SuggestionCategory, Dict[str, float]] = Field(
        default_factory=dict,
        description="Performance by suggestion category"
    )
    
    # Quality metrics
    avg_confidence_score: float = Field(0.0, ge=0.0, le=1.0, description="Average confidence")
    avg_satisfaction_rating: float = Field(0.0, ge=0.0, le=5.0, description="Average user satisfaction")
    
    # User behavior
    most_popular_suggestions: List[Dict[str, Any]] = Field(default_factory=list, description="Most popular suggestions")
    common_rejection_reasons: List[Dict[str, int]] = Field(default_factory=list, description="Common rejection reasons")


# Migration helpers
class LegacyMigrationHelper(BaseModel):
    """Helper for migrating from legacy recommendation system"""
    
    @staticmethod
    def convert_legacy_recommendation(legacy_item: LegacyRecommendationItem) -> SmartSuggestion:
        """Convert legacy recommendation item to Smart Diet suggestion"""
        return SmartSuggestion(
            id=f"legacy_{legacy_item.barcode}_{int(datetime.now().timestamp())}",
            suggestion_type=SuggestionType.RECOMMENDATION,
            category=SuggestionCategory.DISCOVERY,
            title=legacy_item.name,
            description=f"Recommended {legacy_item.name} for its nutritional benefits",
            reasoning=f"Selected for {', '.join([r.value for r in legacy_item.reasons])}",
            suggested_item={
                "barcode": legacy_item.barcode,
                "name": legacy_item.name,
                "brand": legacy_item.brand,
                "calories": legacy_item.calories_per_serving,
                "protein_g": legacy_item.protein_g,
                "fat_g": legacy_item.fat_g,
                "carbs_g": legacy_item.carbs_g,
                "fiber_g": legacy_item.fiber_g,
            },
            nutritional_benefit={
                "protein_g": legacy_item.protein_g,
                "fat_g": legacy_item.fat_g, 
                "carbs_g": legacy_item.carbs_g,
                "fiber_g": legacy_item.fiber_g or 0
            },
            calorie_impact=int(legacy_item.calories_per_serving),
            confidence_score=legacy_item.confidence_score,
            planning_context=SmartDietContext.DISCOVER,
            legacy_recommendation_data=legacy_item.model_dump()
        )


# Backward compatibility aliases
RecommendationItem = SmartSuggestion  # For API compatibility
SmartRecommendationRequest = SmartDietRequest  # For API compatibility  
SmartRecommendationResponse = SmartDietResponse  # For API compatibility