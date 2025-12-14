import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Request, Depends
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from pydantic_core import ValidationError as CoreValidationError
from starlette.datastructures import UploadFile
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
from app.services.tracking_service import TrackingService
from app.services.storage import save_photo
from app.utils.auth_context import get_session_user_id
import logging

# Phase 2 Batch 8: Using TrackingService for meal and weight tracking
tracking_service = TrackingService(db_service)

logger = logging.getLogger(__name__)
router = APIRouter()

def _coerce_datetime(value, default: Optional[datetime] = None) -> datetime:
    """Convert values into datetime instances, falling back to default when needed."""
    default = default or datetime.utcnow()
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return default
    return default


def _normalize_meal_items(raw_items) -> List[MealItem]:
    """Ensure raw meal items are represented as MealItem instances."""
    normalized: List[MealItem] = []
    for item in raw_items or []:
        if isinstance(item, MealItem):
            normalized.append(item)
        elif isinstance(item, dict):
            normalized.append(MealItem(**item))
        else:
            try:
                normalized.append(MealItem(**item.model_dump()))  # type: ignore[attr-defined]
            except AttributeError as exc:
                raise ValueError("Invalid meal item payload") from exc
    return normalized


async def _parse_weight_request(request: Request) -> WeightTrackingRequest:
    """Support both JSON and multipart submissions for weight tracking."""
    content_type = request.headers.get("content-type", "")
    if content_type and "multipart/form-data" in content_type.lower():
        form = await request.form()
        data = {}
        for key, value in form.multi_items():
            if key == "photo" and isinstance(value, UploadFile):
                content_type = value.content_type or ""
                if not content_type.lower().startswith("image/"):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="photo must be an image file"
                    )
            data[key] = value
        try:
            return WeightTrackingRequest(**data)
        except (ValidationError, CoreValidationError) as exc:
            raise RequestValidationError(exc.errors(), body=data) from exc

    try:
        payload = await request.json()
    except Exception as exc:
        raise RequestValidationError(
            [
                {
                    "loc": ("body",),
                    "msg": f"Invalid JSON payload: {exc}",
                    "type": "value_error.jsondecode"
                }
            ]
        ) from exc
    try:
        return WeightTrackingRequest(**payload)
    except (ValidationError, CoreValidationError) as exc:
        raise RequestValidationError(exc.errors(), body=payload) from exc


@router.post("/meal", response_model=MealTrackingResponse)
async def track_meal(request: MealTrackingRequest, req: Request):
    """
    Track a consumed meal with optional photo attachment
    Supports both new format (meal_name, timestamp) and legacy format (meal_type, logged_at)
    """
    try:
        # Get user context (authenticated or session-based anonymous)
        user_id = await get_session_user_id(req)
        logger.info(f"Tracking meal for user {user_id}: {request.meal_name} with {len(request.items)} items")

        # Log additional context for debugging legacy field usage
        if hasattr(request, '_meal_type_original'):
            logger.info(f"Legacy meal_type '{request._meal_type_original}' converted to meal_name '{request.meal_name}'")
        
        # Save photo if provided
        uploaded_photo_url = None
        if request.photo:
            photo_result = await save_photo(request.photo, f"meal_{user_id}")
            if photo_result:
                uploaded_photo_url = photo_result.get("photo_url")

        # Persist meal and retrieve stored record
        stored_meal = await tracking_service.track_meal(user_id, request, uploaded_photo_url)

        # Convert to response model
        if not stored_meal:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Meal tracking error: storage returned no data"
            )

        meal_id = stored_meal.get('id') or str(uuid.uuid4())
        meal_name = stored_meal.get('meal_name') or request.meal_name

        raw_items = stored_meal.get('items') or request.items
        normalized_items = _normalize_meal_items(raw_items)

        total_calories = stored_meal.get('total_calories')
        if total_calories is None:
            total_calories = round(sum(item.calories for item in normalized_items), 2)

        final_photo_url = stored_meal.get('photo_url') or uploaded_photo_url

        meal_record = MealTrackingResponse(
            id=meal_id,
            meal_name=meal_name,
            items=normalized_items,
            total_calories=total_calories,
            photo_url=final_photo_url,
            timestamp=_coerce_datetime(stored_meal.get('timestamp', request.timestamp)),
            created_at=_coerce_datetime(stored_meal.get('created_at'), datetime.utcnow())
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
        # Provide more specific error messages for debugging
        error_detail = f"Failed to track meal: {str(e)}"
        if "meal_name" in str(e):
            error_detail = f"Failed to track meal - check meal_name field: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )

@router.post("/weight", response_model=WeightTrackingResponse)
async def track_weight(
    req: Request,
    weight_request: WeightTrackingRequest = Depends(_parse_weight_request)
):
    """
    Track a weight measurement with optional photo attachment
    """
    try:
        # Get user context (authenticated or session-based anonymous)
        user_id = await get_session_user_id(req)
        logger.info(f"Tracking weight for user {user_id}: {weight_request.weight} kg")
        
        # Save photo if provided
        uploaded_photo_url = None
        if weight_request.photo:
            photo_result = await save_photo(weight_request.photo, f"weight_{user_id}")
            if photo_result:
                uploaded_photo_url = photo_result.get("photo_url")

        # Store weight entry in database
        weight_data = await tracking_service.track_weight(user_id, weight_request, uploaded_photo_url)

        # Convert to response model
        if not weight_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Weight tracking error: storage returned no data"
            )

        weight_id = weight_data.get('id') or str(uuid.uuid4())
        weight_value = weight_data.get('weight', weight_data.get('weight_kg', weight_request.weight))
        date_value = weight_data.get('date', weight_request.date)

        weight_record = WeightTrackingResponse(
            id=weight_id,
            weight=weight_value,
            date=_coerce_datetime(date_value),
            photo_url=weight_data.get('photo_url') or uploaded_photo_url,
            created_at=_coerce_datetime(weight_data.get('created_at'), datetime.utcnow())
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
            if weight_value is None:
                continue
            date_dt = _coerce_datetime(record.get('date'))
            created_at_dt = _coerce_datetime(record.get('created_at'), default=date_dt)

            entries.append(
                WeightTrackingResponse(
                    id=record['id'],
                    weight=weight_value,
                    date=date_dt,
                    photo_url=record.get('photo_url'),
                    created_at=created_at_dt
                )
            )
        
        # Calculate date range
        date_range = {}
        if entries:
            dates = [
                entry.date.replace(tzinfo=None) if entry.date.tzinfo else entry.date
                for entry in entries
            ]
            date_range = {
                "earliest": min(dates),
                "latest": max(dates)
            }
        
        return WeightHistoryResponse(
            entries=entries,
            count=len(entries),
            date_range=date_range,
            history=entries
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
        
        db_logs = await tracking_service.get_photo_logs(user_id, limit or 50)

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
