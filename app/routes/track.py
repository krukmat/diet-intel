import uuid
import base64
import os
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Request
from fastapi.responses import JSONResponse

from app.models.tracking import (
    MealTrackingRequest, MealTrackingResponse, 
    WeightTrackingRequest, WeightTrackingResponse,
    WeightHistoryResponse, PhotoLogsResponse, PhotoLogEntry
)
from app.services.cache import cache_service
from app.services.database import db_service
from app.utils.auth_context import get_session_user_id
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Photo storage configuration
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
async def track_meal(request: MealTrackingRequest, req: Request):
    """
    Track a consumed meal with optional photo attachment
    """
    try:
        # Get user context (authenticated or session-based anonymous)
        user_id = await get_session_user_id(req)
        logger.info(f"Tracking meal for user {user_id}: {request.meal_name} with {len(request.items)} items")
        
        # Save photo if provided
        photo_url = None
        if request.photo:
            photo_url = save_photo(request.photo, f"meal_{user_id}")
        
        # Store meal in database
        meal_id = await db_service.create_meal(user_id, request, photo_url)
        
        # Get the stored meal to return proper response
        meal_data = await db_service.get_meal_by_id(meal_id)
        if not meal_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve stored meal"
            )
        
        # Convert to response model
        from app.models.tracking import MealItem
        
        meal_record = MealTrackingResponse(
            id=meal_data['id'],
            meal_name=meal_data['meal_name'],
            items=[
                MealItem(
                    barcode=item['barcode'],
                    name=item['name'],
                    serving=item['serving'],
                    calories=item['calories'],
                    macros=item['macros']
                ) for item in meal_data['items']
            ],
            total_calories=meal_data['total_calories'],
            photo_url=meal_data['photo_url'],
            timestamp=meal_data['timestamp'],
            created_at=meal_data['created_at']
        )
        
        # Update cache for recent meals (keep caching for performance)
        cache_key = f"recent_meals_{user_id}"
        recent_meals = await cache_service.get(cache_key) or []
        recent_meals.append(meal_record.model_dump())
        # Keep only last 50 meals
        recent_meals = recent_meals[-50:]
        await cache_service.set(cache_key, recent_meals, ttl_hours=24)
        
        logger.info(f"Successfully tracked meal {meal_id} for user {user_id}: {meal_data['total_calories']} calories")
        
        return meal_record
    
    except Exception as e:
        logger.error(f"Failed to track meal: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to track meal: {str(e)}"
        )

@router.post("/weight", response_model=WeightTrackingResponse)
async def track_weight(request: WeightTrackingRequest, req: Request):
    """
    Track a weight measurement with optional photo attachment
    """
    try:
        # Get user context (authenticated or session-based anonymous)
        user_id = await get_session_user_id(req)
        logger.info(f"Tracking weight for user {user_id}: {request.weight} kg")
        
        # Save photo if provided
        photo_url = None
        if request.photo:
            photo_url = save_photo(request.photo, f"weight_{user_id}")
        
        # Store weight entry in database
        weight_id = await db_service.create_weight_entry(user_id, request, photo_url)
        
        # Get the stored weight entry to return proper response
        weight_data = await db_service.get_weight_entry_by_id(weight_id)
        if not weight_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve stored weight entry"
            )
        
        # Convert to response model
        weight_record = WeightTrackingResponse(
            id=weight_data['id'],
            weight=weight_data['weight'],
            date=weight_data['date'],
            photo_url=weight_data['photo_url'],
            created_at=weight_data['created_at']
        )
        
        # Cache weight history for performance
        cache_key = f"weight_history_{user_id}"
        weight_history = await cache_service.get(cache_key) or []
        weight_history.append(weight_record.model_dump())
        # Keep only last 100 entries - sort by date with proper datetime handling
        def sort_key(x):
            date_val = x['date']
            if isinstance(date_val, str):
                from dateutil.parser import parse
                return parse(date_val)
            return date_val
        weight_history = sorted(weight_history, key=sort_key)[-100:]
        await cache_service.set(cache_key, weight_history, ttl_hours=24)
        
        logger.info(f"Successfully tracked weight {weight_id} for user {user_id}: {request.weight} kg")
        
        return weight_record
    
    except Exception as e:
        logger.error(f"Failed to track weight: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to track weight: {str(e)}"
        )

@router.get("/weight/history", response_model=WeightHistoryResponse)
async def get_weight_history(req: Request, limit: Optional[int] = 30):
    """
    Get weight tracking history
    """
    try:
        # Get user context (authenticated or session-based anonymous)
        user_id = await get_session_user_id(req)
        
        # Get weight history from database
        weight_history = await db_service.get_user_weight_history(user_id, limit or 30)
        
        # Convert to response models
        entries = []
        for record in weight_history:
            entry = WeightTrackingResponse(
                id=record['id'],
                weight=record['weight'],
                date=record['date'],
                photo_url=record['photo_url'],
                created_at=record['created_at']
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
async def get_photo_logs(req: Request, limit: Optional[int] = 50):
    """
    Get timeline of all food and weight photos
    """
    try:
        # Get user context (authenticated or session-based anonymous)
        user_id = await get_session_user_id(req)
        photo_logs = []
        
        # Collect meal photos from database
        user_meals = await db_service.get_user_meals(user_id, limit or 50)
        for meal_record in user_meals:
            if meal_record.get('photo_url'):
                photo_logs.append(PhotoLogEntry(
                    id=meal_record['id'],
                    timestamp=meal_record['created_at'],
                    photo_url=meal_record['photo_url'],
                    type="meal",
                    description=f"{meal_record['meal_name']} - {meal_record['total_calories']:.0f} kcal"
                ))
        
        # Collect weight photos from database
        user_weights = await db_service.get_user_weight_history(user_id, limit or 50)
        for weight_record in user_weights:
            if weight_record.get('photo_url'):
                photo_logs.append(PhotoLogEntry(
                    id=weight_record['id'],
                    timestamp=weight_record['created_at'],
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