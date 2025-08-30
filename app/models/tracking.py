from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class MealItem(BaseModel):
    """Individual item in a meal"""
    barcode: str
    name: str
    serving: str
    calories: float
    macros: dict = Field(default_factory=dict)

class MealTrackingRequest(BaseModel):
    """Request model for tracking consumed meals"""
    meal_name: str = Field(..., description="Name of the meal (Breakfast, Lunch, Dinner)")
    items: List[MealItem] = Field(..., description="List of food items consumed")
    photo: Optional[str] = Field(None, description="Base64 encoded photo of the meal")
    timestamp: str = Field(..., description="ISO timestamp when meal was consumed")

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