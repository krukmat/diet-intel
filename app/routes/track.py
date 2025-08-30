import uuid
import base64
import os
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.models.tracking import (
    MealTrackingRequest, MealTrackingResponse, 
    WeightTrackingRequest, WeightTrackingResponse,
    WeightHistoryResponse, PhotoLogsResponse, PhotoLogEntry
)
from app.services.cache import cache_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory storage for demo purposes (replace with database in production)
meal_tracking_data = []
weight_tracking_data = []
photo_storage_path = "/tmp/dietintel_photos"

def ensure_photo_directory():
    """Ensure photo storage directory exists"""
    os.makedirs(photo_storage_path, exist_ok=True)

def save_photo(photo_base64: str, prefix: str) -> str:
    """Save base64 photo to filesystem and return URL"""
    try:
        ensure_photo_directory()
        
        # Decode base64 image
        if "," in photo_base64:
            header, data = photo_base64.split(",", 1)
        else:
            data = photo_base64
        
        photo_data = base64.b64decode(data)
        
        # Generate unique filename
        photo_id = str(uuid.uuid4())
        filename = f"{prefix}_{photo_id}.jpg"
        filepath = os.path.join(photo_storage_path, filename)
        
        # Save to filesystem
        with open(filepath, "wb") as f:
            f.write(photo_data)
        
        # Return URL (in production, this would be a proper URL)
        return f"/photos/{filename}"
    
    except Exception as e:
        logger.error(f"Failed to save photo: {str(e)}")
        return None

@router.post("/meal", response_model=MealTrackingResponse)
async def track_meal(request: MealTrackingRequest):
    """
    Track a consumed meal with optional photo attachment
    """
    try:
        logger.info(f"Tracking meal: {request.meal_name} with {len(request.items)} items")
        
        # Generate unique ID
        meal_id = str(uuid.uuid4())
        
        # Calculate total calories
        total_calories = sum(item.calories for item in request.items)
        
        # Save photo if provided
        photo_url = None
        if request.photo:
            photo_url = save_photo(request.photo, f"meal_{meal_id}")
        
        # Parse timestamp
        try:
            timestamp = datetime.fromisoformat(request.timestamp.replace("Z", "+00:00"))
        except ValueError:
            timestamp = datetime.now()
        
        # Create response
        meal_record = MealTrackingResponse(
            id=meal_id,
            meal_name=request.meal_name,
            items=request.items,
            total_calories=total_calories,
            photo_url=photo_url,
            timestamp=timestamp,
            created_at=datetime.now()
        )
        
        # Store in memory (replace with database)
        meal_tracking_data.append(meal_record.dict())
        
        # Cache recent meals
        cache_key = f"recent_meals_user"
        recent_meals = await cache_service.get(cache_key) or []
        recent_meals.append(meal_record.dict())
        # Keep only last 50 meals
        recent_meals = recent_meals[-50:]
        await cache_service.set(cache_key, recent_meals, ttl_hours=24)
        
        logger.info(f"Successfully tracked meal {meal_id}: {total_calories} calories")
        
        return meal_record
    
    except Exception as e:
        logger.error(f"Failed to track meal: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to track meal: {str(e)}"
        )

@router.post("/weight", response_model=WeightTrackingResponse)
async def track_weight(request: WeightTrackingRequest):
    """
    Track a weight measurement with optional photo attachment
    """
    try:
        logger.info(f"Tracking weight: {request.weight} kg")
        
        # Generate unique ID
        weight_id = str(uuid.uuid4())
        
        # Save photo if provided
        photo_url = None
        if request.photo:
            photo_url = save_photo(request.photo, f"weight_{weight_id}")
        
        # Parse date
        try:
            measurement_date = datetime.fromisoformat(request.date.replace("Z", "+00:00"))
        except ValueError:
            measurement_date = datetime.now()
        
        # Create response
        weight_record = WeightTrackingResponse(
            id=weight_id,
            weight=request.weight,
            date=measurement_date,
            photo_url=photo_url,
            created_at=datetime.now()
        )
        
        # Store in memory (replace with database)
        weight_tracking_data.append(weight_record.dict())
        
        # Cache weight history
        cache_key = f"weight_history_user"
        weight_history = await cache_service.get(cache_key) or []
        weight_history.append(weight_record.dict())
        # Keep only last 100 entries
        weight_history = sorted(weight_history, key=lambda x: x['date'])[-100:]
        await cache_service.set(cache_key, weight_history, ttl_hours=24)
        
        logger.info(f"Successfully tracked weight {weight_id}: {request.weight} kg")
        
        return weight_record
    
    except Exception as e:
        logger.error(f"Failed to track weight: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to track weight: {str(e)}"
        )

@router.get("/weight/history", response_model=WeightHistoryResponse)
async def get_weight_history(limit: Optional[int] = 30):
    """
    Get weight tracking history
    """
    try:
        # Get from cache first
        cache_key = f"weight_history_user"
        weight_history = await cache_service.get(cache_key) or []
        
        # Limit results
        if limit:
            weight_history = weight_history[-limit:]
        
        # Convert to response models
        entries = []
        for record in weight_history:
            entry = WeightTrackingResponse(
                id=record['id'],
                weight=record['weight'],
                date=datetime.fromisoformat(record['date']) if isinstance(record['date'], str) else record['date'],
                photo_url=record.get('photo_url'),
                created_at=datetime.fromisoformat(record['created_at']) if isinstance(record['created_at'], str) else record['created_at']
            )
            entries.append(entry)
        
        # Calculate date range
        date_range = {}
        if entries:
            dates = [entry.date for entry in entries]
            date_range = {
                "earliest": min(dates),
                "latest": max(dates)
            }
        
        return WeightHistoryResponse(
            entries=entries,
            count=len(entries),
            date_range=date_range
        )
    
    except Exception as e:
        logger.error(f"Failed to get weight history: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get weight history: {str(e)}"
        )

@router.get("/photos", response_model=PhotoLogsResponse)
async def get_photo_logs(limit: Optional[int] = 50):
    """
    Get timeline of all food and weight photos
    """
    try:
        photo_logs = []
        
        # Collect meal photos
        for meal_record in meal_tracking_data:
            if meal_record.get('photo_url'):
                photo_logs.append(PhotoLogEntry(
                    id=meal_record['id'],
                    timestamp=datetime.fromisoformat(meal_record['created_at']) if isinstance(meal_record['created_at'], str) else meal_record['created_at'],
                    photo_url=meal_record['photo_url'],
                    type="meal",
                    description=f"{meal_record['meal_name']} - {meal_record['total_calories']:.0f} kcal"
                ))
        
        # Collect weight photos
        for weight_record in weight_tracking_data:
            if weight_record.get('photo_url'):
                photo_logs.append(PhotoLogEntry(
                    id=weight_record['id'],
                    timestamp=datetime.fromisoformat(weight_record['created_at']) if isinstance(weight_record['created_at'], str) else weight_record['created_at'],
                    photo_url=weight_record['photo_url'],
                    type="weigh-in",
                    description=f"Weight: {weight_record['weight']} kg"
                ))
        
        # Sort by timestamp (newest first)
        photo_logs.sort(key=lambda x: x.timestamp, reverse=True)
        
        # Limit results
        if limit:
            photo_logs = photo_logs[:limit]
        
        return PhotoLogsResponse(
            logs=photo_logs,
            count=len(photo_logs)
        )
    
    except Exception as e:
        logger.error(f"Failed to get photo logs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get photo logs: {str(e)}"
        )