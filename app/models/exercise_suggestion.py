"""
Exercise Suggestion Models - Models for exercise recommendations based on caloric balance

Part of FEAT-PROPORTIONS implementation
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime


class ExerciseAnalysis(BaseModel):
    """Analysis of exercise needs based on caloric balance"""
    deficit_calories: float = Field(..., ge=0, description="Calories to compensate")
    recommended_activities: List['ExerciseRecommendation'] = Field(default_factory=list)
    user_profile: Optional[Dict[str, Any]] = Field(None, description="User profile (weight, activity, goals)")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class ExerciseRecommendation(BaseModel):
    """Specific exercise recommendation"""
    activity: str = Field(..., description="Type of activity (walking, running, swimming, etc.)")
    duration_min: int = Field(..., gt=0, description="Duration in minutes")
    calories_burn: int = Field(..., ge=0, description="Calories burned estimate")
    intensity: str = Field(..., description="Intensity level (low, moderate, high)")
    reasoning: str = Field(..., description="Reasoning for recommendation")
    health_benefits: List[str] = Field(default_factory=list, description="Health benefits")

    @validator('intensity')
    def validate_intensity(cls, v):
        if v not in ['low', 'moderate', 'high']:
            raise ValueError('Intensity must be low, moderate, or high')
        return v

    @validator('activity')
    def validate_activity(cls, v):
        valid_activities = ['walking', 'running', 'swimming', 'cycling', 'home_exercise', 'yoga', 'dancing', 'jump_rope']
        if v not in valid_activities:
            raise ValueError(f'Activity must be one of: {valid_activities}')
        return v


class PersonalizedExercisePlan(BaseModel):
    """Full exercise plan based on nutritional analysis"""
    caloric_balance: Dict[str, Any] = Field(..., description="Balance between consumed and target calories")
    recommendations: List[ExerciseRecommendation] = Field(..., description="List of exercise recommendations")
    total_calories_burn_target: int = Field(..., ge=0, description="Total calories to burn")
    estimated_duration: int = Field(..., ge=0, description="Estimated total time in minutes")
    plan_validity_days: int = Field(default=1, description="How many days this plan is valid")

    class Config:
        from_attributes = True


# Update forward references
ExerciseAnalysis.update_forward_refs()
PersonalizedExercisePlan.update_forward_refs()
