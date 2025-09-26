from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator

class MealItem(BaseModel):
    """Individual item in a meal"""
    barcode: str = Field(..., min_length=1, max_length=50, description="Product barcode")
    name: str = Field(..., min_length=1, max_length=200, description="Food item name")
    serving: str = Field(..., min_length=1, max_length=50, description="Serving size description")
    calories: float = Field(..., ge=0, description="Calories per serving (must be non-negative)")
    macros: dict = Field(default_factory=dict, description="Macronutrient information")

class MealTrackingRequest(BaseModel):
    """Request model for tracking consumed meals"""
    meal_name: str = Field(..., min_length=1, max_length=100, description="Name of the meal (Breakfast, Lunch, Dinner)")
    items: List[MealItem] = Field(..., min_items=1, max_items=20, description="List of food items consumed (1-20 items)")
    photo: Optional[str] = Field(None, max_length=1000000, description="Base64 encoded photo of the meal")
    timestamp: str = Field(..., description="ISO timestamp when meal was consumed")

    @validator('timestamp')
    def validate_timestamp(cls, v):
        if not v or not v.strip():
            raise ValueError('Timestamp cannot be empty')
        try:
            # Try to parse as ISO format
            datetime.fromisoformat(v.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            raise ValueError('Timestamp must be a valid ISO datetime string')
        return v

class MealTrackingResponse(BaseModel):
    """Response model for meal tracking"""
    id: str
    meal_name: str
    items: List[MealItem]
    total_calories: float
    photo_url: Optional[str] = None
    timestamp: datetime
    created_at: datetime

class WeightTrackingRequest(BaseModel):
    """Request model for weight tracking"""
    weight: float = Field(..., gt=0, description="Weight in kilograms")
    date: str = Field(..., description="ISO timestamp of weight measurement")
    photo: Optional[str] = Field(None, description="Base64 encoded photo")

class WeightTrackingResponse(BaseModel):
    """Response model for weight tracking"""
    id: str
    weight: float
    date: datetime
    photo_url: Optional[str] = None
    created_at: datetime

class WeightHistoryResponse(BaseModel):
    """Response model for weight history"""
    entries: List[WeightTrackingResponse]
    count: int
    date_range: dict

class MealHistoryResponse(BaseModel):
    """Response model for meal history lookups"""
    meals: List[MealTrackingResponse]
    count: int


class PhotoLogEntry(BaseModel):
    """Individual photo log entry"""
    id: str
    timestamp: datetime
    photo_url: str
    type: str  # "meal" or "weigh-in"
    description: Optional[str] = None

class PhotoLogsResponse(BaseModel):
    """Response model for photo logs"""
    logs: List[PhotoLogEntry]
    count: int
