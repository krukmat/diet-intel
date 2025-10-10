"""
Food Vision Models - Data models for FEAT-PROPORTIONS

Registry by Photo with Portion Estimation
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class IdentifiedIngredient(BaseModel):
    """Ingredient identified in the image"""
    name: str = Field(..., description="Ingredient name")
    category: str = Field(..., description="Nutritional category")
    estimated_grams: float = Field(..., ge=0, description="Estimated grams")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Identification confidence")
    visual_markers: List[str] = Field(default_factory=list, description="Visual cues used")
    nutrition_per_100g: Dict[str, float] = Field(default_factory=dict, description="Nutrition per 100g")


class NutritionalAnalysis(BaseModel):
    """Complete nutritional analysis of the meal"""
    total_calories: float = Field(..., ge=0, description="Total calories")
    macro_distribution: Dict[str, float] = Field(..., description="Macro breakdown (%)")
    micronutrients: Optional[Dict[str, Any]] = Field(None, description="Micronutrients")
    food_quality_score: float = Field(..., ge=0.0, le=1.0, description="Quality score")
    health_benefits: List[str] = Field(default_factory=list, description="Health benefits")


class ExerciseSuggestion(BaseModel):
    """Exercise recommendation for calorie balancing"""
    activity_type: str = Field(..., description="Activity type")
    duration_minutes: int = Field(..., gt=0, description="Duration in minutes")
    estimated_calories_burned: int = Field(..., ge=0, description="Calories burned")
    intensity_level: str = Field(..., description="Intensity level")
    reasoning: str = Field(..., description="Reason for suggestion")
    health_benefits: List[str] = Field(default_factory=list, description="Health benefits")


class CalorieBalance(BaseModel):
    """Balance between consumed and target calories"""
    consumed_calories: float = Field(..., ge=0, description="Consumed calories")
    target_calories: float = Field(..., ge=0, description="Target calories")
    calorie_deficit: float = Field(..., description="Calorie deficit/surplus")
    exercise_needed: bool = Field(..., description="Exercise recommended")
    balance_status: str = Field(..., description="Balance status")


class VisionLogResponse(BaseModel):
    """Response for successful vision analysis"""
    id: str = Field(..., description="Unique analysis ID")
    user_id: str = Field(..., description="User ID")
    image_url: Optional[str] = Field(None, description="Analyzed image URL")
    meal_type: str = Field(..., description="Meal type")
    identified_ingredients: List[IdentifiedIngredient] = Field(..., description="Ingredients")
    estimated_portions: Dict[str, Any] = Field(..., description="Portion estimates")
    nutritional_analysis: NutritionalAnalysis = Field(..., description="Nutrition analysis")
    exercise_suggestions: List[ExerciseSuggestion] = Field(default_factory=list, description="Exercise suggestions")
    created_at: datetime = Field(..., description="Creation timestamp")
    processing_time_ms: int = Field(..., ge=0, description="Processing time")


class VisionLogWithExerciseResponse(VisionLogResponse):
    """Response including calorie balance"""
    calorie_balance: CalorieBalance = Field(..., description="Calorie balance")


class LowConfidenceVisionResponse(BaseModel):
    """Response for low confidence analysis"""
    id: str = Field(..., description="Analysis ID")
    confidence_score: float = Field(..., lt=0.7, description="Low confidence score")
    partial_identification: List[IdentifiedIngredient] = Field(..., description="Partial results")
    suggested_corrections: List[str] = Field(..., description="Correction suggestions")
    requires_manual_review: bool = Field(True, description="Manual review needed")
    created_at: datetime = Field(..., description="Creation timestamp")


class ErrorResponse(BaseModel):
    """Standard error response"""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Error details")
    error_code: str = Field(..., description="Error code")


class VisionAnalysisRequest(BaseModel):
    """Request for vision analysis"""
    image_data: str = Field(..., description="Base64 image data")
    meal_type: str = Field(..., description="Meal type")
    user_context: Optional[Dict[str, Any]] = Field(None, description="User context")


class VisionCorrectionRequest(BaseModel):
    """Request for correcting vision analysis"""
    corrected_portions: Optional[Dict[str, Any]] = Field(None, description="Corrected portions")
    ingredient_corrections: Optional[List[Dict[str, Any]]] = Field(None, description="Ingredient corrections")
    missing_ingredients: Optional[List[Dict[str, Any]]] = Field(None, description="Missing ingredients")
    correction_notes: Optional[str] = Field(None, description="Correction notes")


class PortionsEstimate(BaseModel):
    """Estimated portions result"""
    total_calories: float = Field(..., ge=0)
    total_protein_g: float = Field(..., ge=0)
    total_fat_g: float = Field(..., ge=0)
    total_carbs_g: float = Field(..., ge=0)
    confidence_score: float = Field(..., ge=0.0, le=1.0)
