from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, root_validator, validator

class MealItem(BaseModel):
    """Individual item in a meal"""
    barcode: str = Field(..., min_length=1, max_length=50, description="Product barcode")
    name: str = Field(..., min_length=1, max_length=200, description="Food item name")
    serving: str = Field(..., min_length=1, max_length=50, description="Serving size description")
    calories: float = Field(..., ge=0, description="Calories per serving (must be non-negative)")
    macros: dict = Field(default_factory=dict, description="Macronutrient information")

    @root_validator(pre=True)
    def normalize_legacy_fields(cls, values):  # type: ignore[override]
        # Accept legacy payload keys used by older tests/clients
        serving_size = values.pop('serving_size', None)
        if serving_size and 'serving' not in values:
            values['serving'] = serving_size

        macros = values.get('macros') or {}

        protein = values.pop('protein_g', None)
        fat = values.pop('fat_g', None)
        carbs = values.pop('carbs_g', None)
        if protein is not None:
            macros.setdefault('protein', float(protein))
        if fat is not None:
            macros.setdefault('fat', float(fat))
        if carbs is not None:
            macros.setdefault('carbs', float(carbs))

        values['macros'] = macros
        return values

class MealTrackingRequest(BaseModel):
    """Request model for tracking consumed meals"""
    meal_name: str = Field(..., min_length=1, max_length=100, description="Name of the meal (Breakfast, Lunch, Dinner)")
    items: List[MealItem] = Field(..., min_items=1, max_items=20, description="List of food items consumed (1-20 items)")
    photo: Optional[str] = Field(None, max_length=1000000, description="Base64 encoded photo of the meal")
    timestamp: str = Field(..., description="ISO timestamp when meal was consumed")

    @root_validator(pre=True)
    def normalize_legacy_fields(cls, values):  # type: ignore[override]
        # Legacy payloads used meal_type + logged_at
        meal_type = values.get('meal_type')
        if meal_type and 'meal_name' not in values:
            values['meal_name'] = meal_type

        logged_at = values.get('logged_at')
        if logged_at and 'timestamp' not in values:
            values['timestamp'] = logged_at

        # Legacy items sometimes use serving_size; handled in MealItem
        return values

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

    @root_validator(pre=True)
    def normalize_weight(cls, values):  # type: ignore[override]
        weight_kg = values.get('weight_kg')
        if weight_kg is not None and 'weight' not in values:
            values['weight'] = weight_kg
        return values

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
