import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Path, Request

from app.models.reminder import (
    ReminderRequest, ReminderResponse, ReminderUpdateRequest,
    RemindersListResponse, ReminderType
)
from app.services.cache import cache_service
from app.services.database import db_service
from app.utils.auth_context import get_session_user_id
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Legacy in-memory storage - now using database
# reminders_data = []

def validate_time_format(time_str: str) -> bool:
    """Validate HH:MM time format"""
    try:
        hour, minute = map(int, time_str.split(':'))
        return 0 <= hour <= 23 and 0 <= minute <= 59
    except (ValueError, IndexError):
        return False

def validate_days_array(days: List[bool]) -> bool:
    """Validate days array has exactly 7 boolean values"""
    return len(days) == 7 and all(isinstance(day, bool) for day in days)

@router.post("", response_model=ReminderResponse)
async def create_reminder(request: ReminderRequest, req: Request):
    """
    Create a new meal or weigh-in reminder
    """
    try:
        logger.info(f"Creating {request.type} reminder: {request.label}")
        
        # Validate input
        if not validate_time_format(request.time):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid time format. Use HH:MM format."
            )
        
        if not validate_days_array(request.days):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Days must be an array of exactly 7 boolean values."
            )
        
        # Check if any days are selected
        if not any(request.days):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one day must be selected."
            )
        
        # Get user context
        user_id = await get_session_user_id(req)
        
        # Store in database
        reminder_id = await db_service.create_reminder(user_id, request)
        
        # Get the stored reminder to return proper response
        reminder_data = await db_service.get_reminder_by_id(reminder_id)
        if not reminder_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve stored reminder"
            )
        
        # Convert to response model
        reminder = ReminderResponse(
            id=reminder_data['id'],
            type=ReminderType(reminder_data['type']),
            label=reminder_data['label'],
            time=reminder_data['time'],
            days=reminder_data['days'],
            enabled=reminder_data['enabled'],
            created_at=reminder_data['created_at'],
            updated_at=reminder_data['updated_at']
        )
        
        # Cache user reminders (performance optimization)
        try:
            cache_key = f"user_reminders_{user_id}"
            user_reminders = await cache_service.get(cache_key) or []
            user_reminders.append(reminder.model_dump())
            user_reminders = user_reminders[-50:]  # Keep last 50
            await cache_service.set(cache_key, user_reminders, ttl_hours=24)
        except Exception as cache_error:
            logger.warning(f"Failed to cache reminder {reminder_id}: {cache_error}")
        
        logger.info(f"Successfully created reminder {reminder_id}")
        
        return reminder
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create reminder: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create reminder: {str(e)}"
        )

@router.get("", response_model=RemindersListResponse)
async def get_reminders(req: Request):
    """
    Get all reminders for the user
    """
    try:
        # Get user context
        user_id = await get_session_user_id(req)
        logger.info(f"Fetching user reminders for user {user_id}")
        
        # Get from database
        user_reminders = await db_service.get_user_reminders(user_id)
        
        # Convert to response models
        reminders = []
        for record in user_reminders:
            reminder = ReminderResponse(
                id=record['id'],
                type=ReminderType(record['type']),
                label=record['label'],
                time=record['time'],
                days=record['days'],
                enabled=record['enabled'],
                created_at=record['created_at'],
                updated_at=record['updated_at']
            )
            reminders.append(reminder)
        
        # Update cache (performance optimization)
        try:
            cache_key = f"user_reminders_{user_id}"
            await cache_service.set(cache_key, [r.model_dump() for r in reminders], ttl_hours=24)
        except Exception as cache_error:
            logger.warning(f"Failed to cache reminders for user {user_id}: {cache_error}")
        
        # Sort by creation time (newest first)
        reminders.sort(key=lambda x: x.created_at, reverse=True)
        
        logger.info(f"Retrieved {len(reminders)} reminders")
        
        return RemindersListResponse(
            reminders=reminders,
            count=len(reminders)
        )
    
    except Exception as e:
        logger.error(f"Failed to get reminders: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get reminders: {str(e)}"
        )

@router.put("/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: str = Path(..., description="Reminder ID to update"),
    request: ReminderUpdateRequest = ...,
    req: Request = ...
):
    """
    Update an existing reminder
    """
    try:
        # Get user context
        user_id = await get_session_user_id(req)
        logger.info(f"Updating reminder {reminder_id} for user {user_id}")
        
        # Validate updates
        if request.time and not validate_time_format(request.time):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid time format. Use HH:MM format."
            )
        
        if request.days and not validate_days_array(request.days):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Days must be an array of exactly 7 boolean values."
            )
        
        if request.days and not any(request.days):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one day must be selected."
            )
        
        # Update in database
        success = await db_service.update_reminder(reminder_id, request)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Reminder {reminder_id} not found"
            )
        
        # Get updated reminder
        reminder_data = await db_service.get_reminder_by_id(reminder_id)
        if not reminder_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve updated reminder"
            )
        
        # Convert to response model
        updated_reminder = ReminderResponse(
            id=reminder_data['id'],
            type=ReminderType(reminder_data['type']),
            label=reminder_data['label'],
            time=reminder_data['time'],
            days=reminder_data['days'],
            enabled=reminder_data['enabled'],
            created_at=reminder_data['created_at'],
            updated_at=reminder_data['updated_at']
        )
        
        # Update cache (clear to force refresh)
        try:
            cache_key = f"user_reminders_{user_id}"
            await cache_service.delete(cache_key)
        except Exception as cache_error:
            logger.warning(f"Failed to clear cache for user {user_id}: {cache_error}")
        
        logger.info(f"Successfully updated reminder {reminder_id}")
        
        return updated_reminder
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update reminder: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update reminder: {str(e)}"
        )

@router.delete("/{reminder_id}")
async def delete_reminder(
    reminder_id: str = Path(..., description="Reminder ID to delete"),
    req: Request = ...
):
    """
    Delete a reminder
    """
    try:
        # Get user context
        user_id = await get_session_user_id(req)
        logger.info(f"Deleting reminder {reminder_id} for user {user_id}")
        
        # Delete from database
        success = await db_service.delete_reminder(reminder_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Reminder {reminder_id} not found"
            )
        
        # Update cache (clear to force refresh)
        try:
            cache_key = f"user_reminders_{user_id}"
            await cache_service.delete(cache_key)
        except Exception as cache_error:
            logger.warning(f"Failed to clear cache for user {user_id}: {cache_error}")
        
        logger.info(f"Successfully deleted reminder {reminder_id}")
        
        return {"message": "Reminder deleted successfully", "id": reminder_id}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete reminder: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete reminder: {str(e)}"
        )

@router.get("/{reminder_id}", response_model=ReminderResponse)
async def get_reminder(
    reminder_id: str = Path(..., description="Reminder ID to retrieve"),
    req: Request = ...
):
    """
    Get a specific reminder by ID
    """
    try:
        # Get user context
        user_id = await get_session_user_id(req)
        logger.info(f"Getting reminder {reminder_id} for user {user_id}")
        
        # Get from database
        reminder_data = await db_service.get_reminder_by_id(reminder_id)
        if not reminder_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Reminder {reminder_id} not found"
            )
        
        # Convert to response model
        reminder = ReminderResponse(
            id=reminder_data['id'],
            type=ReminderType(reminder_data['type']),
            label=reminder_data['label'],
            time=reminder_data['time'],
            days=reminder_data['days'],
            enabled=reminder_data['enabled'],
            created_at=reminder_data['created_at'],
            updated_at=reminder_data['updated_at']
        )
        
        return reminder
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get reminder: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get reminder: {str(e)}"
        )