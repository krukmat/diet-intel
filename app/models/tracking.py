from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, root_validator, validator, model_validator

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
    meal_name: Optional[str] = Field(None, min_length=1, max_length=100, description="Name of the meal (Breakfast, Lunch, Dinner)")
    items: List[MealItem] = Field(default_factory=list, min_items=0, max_items=20, description="List of food items consumed (0-20 items)")
    photo: Optional[str] = Field(None, max_length=1000000, description="Base64 encoded photo of the meal")
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat(), description="ISO timestamp when meal was consumed")

    # Support for legacy field names
    meal_type: Optional[str] = Field(None, min_length=1, max_length=100, description="Legacy field - use meal_name instead")
    logged_at: Optional[str] = Field(None, description="Legacy field - use timestamp instead")

    @model_validator(mode='before')
    @classmethod
    def normalize_legacy_fields(cls, values):  # type: ignore[override]
        # Handle legacy field transformation - meal_type takes precedence over None meal_name
        if values.get('meal_type') and values.get('meal_name') is None:
            values['meal_name'] = values['meal_type']
            # Remove meal_type from values to avoid duplication in model_dump
            values.pop('meal_type', None)

        if values.get('logged_at'):
            values['timestamp'] = values['logged_at']
            # Remove logged_at from values to avoid duplication in model_dump
            values.pop('logged_at', None)

        # Legacy items sometimes use serving_size; handled in MealItem
        return values

    @validator('timestamp')
    def validate_timestamp(cls, v):
        if not v or not v.strip():
            # Use current timestamp as fallback for empty values
            return datetime.now().isoformat()

        try:
            # Try to parse as ISO format
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except (ValueError, TypeError):
            # Use current timestamp as fallback for invalid formats
            return datetime.now().isoformat()

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
    date: str = Field(default_factory=lambda: datetime.now().isoformat(), description="ISO timestamp of weight measurement")
    photo: Optional[str] = Field(None, description="Base64 encoded photo")

    @root_validator(pre=True)
    def normalize_weight(cls, values):  # type: ignore[override]
        # Handle multipart form data (bytes) vs JSON data (dict)
        if isinstance(values, bytes):
            # For multipart form data, we can't easily parse it here
            # Let FastAPI handle the parsing and validation will happen after
            return values

        # Support legacy field names used by tests and older clients
        weight_kg = values.get('weight_kg')
        if weight_kg is not None and 'weight' not in values:
            values['weight'] = weight_kg

        # Support legacy 'notes' field for additional context
        notes = values.get('notes')
        if notes is not None and 'notes' not in values:
            values['notes'] = notes

        return values

    @validator('date')
    def validate_date(cls, v):
        if not v or not v.strip():
            # Use current date as fallback for empty values
            return datetime.now().isoformat()

        try:
            # Try to parse as ISO format
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except (ValueError, TypeError):
            # Use current date as fallback for invalid formats
            return datetime.now().isoformat()

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
