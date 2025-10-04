import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Request
from fastapi.responses import JSONResponse

from app.models.tracking import (
    MealTrackingRequest,
    MealTrackingResponse,
    MealHistoryResponse,
    WeightTrackingRequest,
    WeightTrackingResponse,
    WeightHistoryResponse,
    PhotoLogsResponse,
    PhotoLogEntry,
    MealItem,
)
from app.services.cache import cache_service
from app.services.database import db_service
from app.services.storage import save_photo
from app.utils.auth_context import get_session_user_id
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

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
            photo_result = await save_photo(request.photo, f"meal_{user_id}")
            if photo_result:
                photo_url = photo_result.get("photo_url")

        # Persist meal and retrieve stored record
        stored_meal = await db_service.track_meal(user_id, request, photo_url)

        # Convert to response model
        meal_record = MealTrackingResponse(
            id=stored_meal['id'],
            meal_name=stored_meal['meal_name'],
            items=[
                MealItem(
                    barcode=item['barcode'],
                    name=item['name'],
                    serving=item['serving'],
                    calories=item['calories'],
                    macros=item['macros']
                ) for item in stored_meal['items']
            ],
            total_calories=stored_meal['total_calories'],
            photo_url=stored_meal['photo_url'],
            timestamp=stored_meal['timestamp'],
            created_at=stored_meal['created_at']
        )
        
        # Update cache for recent meals (keep caching for performance)
        cache_key = f"recent_meals_{user_id}"
        cached_meals = await cache_service.get(cache_key)
        # Ensure recent_meals is always a list
        recent_meals = cached_meals if isinstance(cached_meals, list) else []
        recent_meals.append(meal_record.model_dump())
        # Keep only last 50 meals
        recent_meals = recent_meals[-50:]
        await cache_service.set(cache_key, recent_meals, ttl=24*3600)
        
        logger.info(f"Successfully tracked meal {meal_record.id} for user {user_id}: {meal_record.total_calories} calories")
        
        return meal_record

    except HTTPException:
        # Re-raise HTTPException to preserve intended status codes
        raise
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
            photo_result = await save_photo(request.photo, f"weight_{user_id}")
            if photo_result:
                photo_url = photo_result.get("photo_url")

        # Store weight entry in database
        weight_data = await db_service.track_weight(user_id, request, photo_url)

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
        cached_history = await cache_service.get(cache_key)
        # Ensure weight_history is always a list
        weight_history = cached_history if isinstance(cached_history, list) else []
        weight_history.append(weight_record.model_dump())
        # Keep only last 100 entries - sort by date with proper datetime handling
        def sort_key(x):
            date_val = x['date']
            if isinstance(date_val, str):
                from dateutil.parser import parse
                return parse(date_val)
            return date_val
        weight_history = sorted(weight_history, key=sort_key)[-100:]
        await cache_service.set(cache_key, weight_history, ttl=24*3600)
        
        logger.info(f"Successfully tracked weight {weight_record.id} for user {user_id}: {weight_record.weight} kg")
        
        return weight_record
    
    except HTTPException:
        # Re-raise HTTPException to preserve intended status codes
        raise
    except Exception as e:
        logger.error(f"Failed to track weight: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to track weight: {str(e)}"
        )

@router.get("/meals", response_model=MealHistoryResponse)
async def get_meal_history(req: Request, limit: Optional[int] = 50):
    """Return tracked meals for the current session/user."""
    try:
        user_id = await get_session_user_id(req)

        # Pull meals from persistent storage
        meals_raw = await db_service.get_user_meals(user_id, limit or 50)

        meals: List[MealTrackingResponse] = []
        for record in meals_raw:
            items = [
                MealItem(
                    barcode=item.get('barcode', ''),
                    name=item.get('name', ''),
                    serving=item.get('serving', ''),
                    calories=item.get('calories', 0.0),
                    macros=item.get('macros', {}),
                )
                for item in record.get('items', [])
            ]

            meals.append(
                MealTrackingResponse(
                    id=record['id'],
                    meal_name=record['meal_name'],
                    items=items,
                    total_calories=record.get('total_calories', 0.0),
                    photo_url=record.get('photo_url'),
                    timestamp=record['timestamp'],
                    created_at=record['created_at'],
                )
            )

        return MealHistoryResponse(meals=meals, count=len(meals))

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to fetch meal history: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving meal history",
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
        weight_history = await db_service.get_weight_history(user_id, limit or 30)
        
        # Convert to response models (accept legacy keys)
        entries: List[WeightTrackingResponse] = []
        for record in weight_history:
            weight_value = record.get('weight', record.get('weight_kg'))
            date_value = record.get('date')
            created_at_value = record.get('created_at')

            if isinstance(date_value, str):
                try:
                    date_value = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
                except ValueError:
                    date_value = datetime.now()

            if isinstance(created_at_value, str):
                try:
                    created_at_value = datetime.fromisoformat(created_at_value.replace('Z', '+00:00'))
                except ValueError:
                    created_at_value = datetime.now()

            entry = WeightTrackingResponse(
                id=record['id'],
                weight=weight_value,
                date=date_value,
                photo_url=record.get('photo_url'),
                created_at=created_at_value
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
    
    except HTTPException:
        # Re-raise HTTPException to preserve intended status codes
        raise
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
        
        db_logs = await db_service.get_photo_logs(user_id, limit or 50)

        if limit:
            db_logs = db_logs[:limit]

        photo_logs: List[PhotoLogEntry] = []
        for entry in db_logs:
            timestamp = entry.get('timestamp', entry.get('date'))
            if isinstance(timestamp, str):
                try:
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                except ValueError:
                    timestamp = datetime.now()

            photo_logs.append(
                PhotoLogEntry(
                    id=entry['id'],
                    timestamp=timestamp,
                    photo_url=entry['photo_url'],
                    type=entry.get('type', 'meal'),
                    description=entry.get('description')
                )
            )

        return PhotoLogsResponse(
            logs=photo_logs,
            count=len(photo_logs)
        )
    
    except HTTPException:
        # Re-raise HTTPException to preserve intended status codes
        raise
    except Exception as e:
        logger.error(f"Failed to get photo logs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get photo logs: {str(e)}"
        )
