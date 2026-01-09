"""Track routes - Refactored for low cyclomatic complexity.

This module contains endpoints for meal and weight tracking.
Uses Builder Pattern for responses and centralized error handling.
"""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Request
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from pydantic_core import ValidationError as CoreValidationError

from app.models.tracking import (
    MealTrackingRequest,
    MealTrackingResponse,
    MealHistoryResponse,
    WeightTrackingRequest,
    WeightTrackingResponse,
    WeightHistoryResponse,
    PhotoLogsResponse,
    MealItem,
)
from app.services.cache import cache_service
from app.repositories.tracking_repository import TrackingRepository
from app.services.tracking_service import TrackingService
from app.services.storage import save_photo
from app.utils.auth_context import get_session_user_id

from app.routes.track.builders import (
    MealResponseBuilder,
    WeightResponseBuilder,
    build_meal_item,
    build_meal_history_response,
    build_weight_history_response,
    build_photo_logs_response,
)
from app.routes.track.errors import (
    handle_track_error,
    log_operation,
    MealNotFoundError,
)

import logging

tracking_service = TrackingService(TrackingRepository())
logger = logging.getLogger(__name__)
router = APIRouter()


# ============ Helper Functions ============

def _normalize_meal_items(raw_items) -> list[MealItem]:
    """Normalize meal items to MealItem objects."""
    normalized = []
    for item in raw_items or []:
        if isinstance(item, MealItem):
            normalized.append(item)
        elif isinstance(item, dict):
            normalized.append(MealItem(**item))
        else:
            try:
                normalized.append(MealItem(**item.model_dump()))
            except AttributeError:
                raise ValueError("Invalid meal item payload")
    return normalized


async def _save_photo_async(photo, user_id: str, prefix: str) -> Optional[str]:
    """Save photo asynchronously."""
    if not photo:
        return None
    try:
        photo_result = await save_photo(photo, f"{prefix}_{user_id}")
        if photo_result:
            return photo_result.get("photo_url")
    except Exception:
        pass
    return None


async def _update_meal_cache(user_id: str, meal_record) -> None:
    """Update meal cache after creation."""
    cache_key = f"recent_meals_{user_id}"
    cached_meals = await cache_service.get(cache_key)
    recent_meals = cached_meals if isinstance(cached_meals, list) else []
    recent_meals.append(meal_record.model_dump())
    await cache_service.set(cache_key, recent_meals[-50:], ttl=24 * 3600)


async def _update_weight_cache(user_id: str, weight_record) -> None:
    """Update weight cache after creation."""
    cache_key = f"weight_history_{user_id}"
    cached_history = await cache_service.get(cache_key)
    weight_history = cached_history if isinstance(cached_history, list) else []
    weight_history.append(weight_record.model_dump())
    weight_history = sorted(weight_history, key=lambda x: x['date'])[-100:]
    await cache_service.set(cache_key, weight_history, ttl=24 * 3600)


# ============ Endpoints ============

@router.post("/meal", response_model=MealTrackingResponse)
async def track_meal(request: MealTrackingRequest, req: Request):
    """Track a consumed meal with optional photo attachment."""
    try:
        user_id = await get_session_user_id(req)
        log_operation("Tracking meal", user_id, request.meal_name)
        
        # Handle photo upload
        uploaded_photo_url = await _save_photo_async(request.photo, user_id, "meal")
        
        # Store meal
        stored_meal = await tracking_service.track_meal(user_id, request, uploaded_photo_url)
        if not stored_meal:
            raise HTTPException(status_code=500, detail="Meal tracking error: storage returned no data")
        
        # Build response using Builder pattern
        raw_items = stored_meal.get('items') or request.items
        normalized_items = _normalize_meal_items(raw_items)
        total_calories = stored_meal.get('total_calories')
        if total_calories is None:
            total_calories = round(sum(item.calories for item in normalized_items), 2)
        
        response = (
            MealResponseBuilder()
            .with_id(stored_meal.get('id') or str(uuid.uuid4()))
            .with_name(stored_meal.get('meal_name') or request.meal_name)
            .with_items(normalized_items)
            .with_total_calories(total_calories)
            .with_photo_url(stored_meal.get('photo_url') or uploaded_photo_url)
            .with_timestamp(stored_meal.get('timestamp', request.timestamp))
            .with_created_at(datetime.utcnow())
            .build()
        )
        
        await _update_meal_cache(user_id, response)
        log_operation("Tracked meal", user_id, f"{response.total_calories} calories")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        raise handle_track_error("track meal", e)


@router.post("/weight", response_model=WeightTrackingResponse)
async def track_weight(req: Request, weight_request: WeightTrackingRequest):
    """Track a weight measurement with optional photo attachment."""
    try:
        user_id = await get_session_user_id(req)
        log_operation("Tracking weight", user_id, f"{weight_request.weight} kg")
        
        # Handle photo
        uploaded_photo_url = await _save_photo_async(weight_request.photo, user_id, "weight")
        
        # Store weight
        weight_data = await tracking_service.track_weight(user_id, weight_request, uploaded_photo_url)
        if not weight_data:
            raise HTTPException(status_code=500, detail="Weight tracking error")
        
        # Build response
        weight_value = weight_data.get('weight', weight_data.get('weight_kg', weight_request.weight))
        response = (
            WeightResponseBuilder()
            .with_id(weight_data.get('id') or str(uuid.uuid4()))
            .with_weight(weight_value)
            .with_date(weight_data.get('date', weight_request.date))
            .with_photo_url(weight_data.get('photo_url') or uploaded_photo_url)
            .with_created_at(datetime.utcnow())
            .build()
        )
        
        await _update_weight_cache(user_id, response)
        log_operation("Tracked weight", user_id, f"{response.weight} kg")
        return response
        
    except HTTPException:
        raise
    except (ValidationError, CoreValidationError) as e:
        raise RequestValidationError(e.errors())
    except Exception as e:
        raise handle_track_error("track weight", e)


@router.get("/meals", response_model=MealHistoryResponse)
async def get_meal_history(req: Request, limit: Optional[int] = 50):
    """Return tracked meals for the current user."""
    try:
        user_id = await get_session_user_id(req)
        log_operation("Getting meal history", user_id)
        
        meals_raw = await tracking_service.get_user_meals(user_id, limit or 50)
        return build_meal_history_response(meals_raw)
        
    except Exception as e:
        raise handle_track_error("get meal history", e)


@router.get("/weight/history", response_model=WeightHistoryResponse)
async def get_weight_history(req: Request, limit: Optional[int] = 30):
    """Get weight tracking history."""
    try:
        user_id = await get_session_user_id(req)
        log_operation("Getting weight history", user_id)
        
        weight_history = await tracking_service.get_weight_history(user_id, limit or 30)
        return build_weight_history_response(weight_history)
        
    except Exception as e:
        raise handle_track_error("get weight history", e)


@router.get("/photos", response_model=PhotoLogsResponse)
async def get_photo_logs(req: Request, limit: Optional[int] = 50):
    """Get timeline of all food and weight photos."""
    try:
        user_id = await get_session_user_id(req)
        log_operation("Getting photo logs", user_id)
        
        db_logs = await tracking_service.get_photo_logs(user_id, limit or 50)
        return build_photo_logs_response(db_logs, limit)
        
    except Exception as e:
        raise handle_track_error("get photo logs", e)


@router.put("/meal/{meal_id}", response_model=MealTrackingResponse)
async def update_meal(req: Request, meal_id: str, meal_data: MealTrackingRequest):
    """Update an existing meal entry."""
    try:
        user_id = await get_session_user_id(req)
        log_operation("Updating meal", user_id, meal_id)
        
        # Handle photo
        uploaded_photo_url = await _save_photo_async(meal_data.photo, user_id, "meal")
        
        # Update meal - catch ValueError from service
        try:
            updated_meal = await tracking_service.update_meal(meal_id, user_id, meal_data, uploaded_photo_url)
        except ValueError as e:
            if "not found" in str(e).lower():
                raise HTTPException(status_code=404, detail=str(e))
            raise

        
        if not updated_meal:
            raise MealNotFoundError(meal_id)
        
        # Build response
        raw_items = updated_meal.get('items', [])
        normalized_items = _normalize_meal_items(raw_items)
        total_calories = updated_meal.get('total_calories')
        if total_calories is None:
            total_calories = round(sum(item.calories for item in normalized_items), 2)
        
        response = (
            MealResponseBuilder()
            .with_id(updated_meal['id'])
            .with_name(updated_meal.get('meal_name', ''))
            .with_items(normalized_items)
            .with_total_calories(total_calories)
            .with_photo_url(updated_meal.get('photo_url') or uploaded_photo_url)
            .with_timestamp(updated_meal.get('timestamp', meal_data.timestamp))
            .with_created_at(datetime.utcnow())
            .build()
        )
        
        log_operation("Updated meal", user_id, meal_id)
        return response
        
    except HTTPException:
        raise
    except MealNotFoundError:
        raise
    except Exception as e:
        raise handle_track_error("update meal", e)


@router.delete("/meal/{meal_id}")
async def delete_meal(req: Request, meal_id: str):
    """Delete a meal entry."""
    try:
        user_id = await get_session_user_id(req)
        log_operation("Deleting meal", user_id, meal_id)
        
        success = await tracking_service.delete_meal(meal_id, user_id)
        if not success:
            raise MealNotFoundError(meal_id)
        
        log_operation("Deleted meal", user_id, meal_id)
        return {"Message": f"Meal with id {meal_id} has been deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise handle_track_error("delete meal", e)
