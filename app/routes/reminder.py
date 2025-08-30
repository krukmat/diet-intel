import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Path

from app.models.reminder import (
    ReminderRequest, ReminderResponse, ReminderUpdateRequest,
    RemindersListResponse, ReminderType
)
from app.services.cache import cache_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory storage for demo purposes (replace with database in production)
reminders_data = []

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
async def create_reminder(request: ReminderRequest):
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
        
        # Generate unique ID
        reminder_id = str(uuid.uuid4())
        current_time = datetime.now()
        
        # Create reminder record
        reminder = ReminderResponse(
            id=reminder_id,
            type=request.type,
            label=request.label,
            time=request.time,
            days=request.days,
            enabled=request.enabled,
            created_at=current_time,
            updated_at=current_time
        )
        
        # Store in memory (replace with database)
        reminders_data.append(reminder.dict())
        
        # Cache user reminders
        cache_key = f"user_reminders"
        user_reminders = await cache_service.get(cache_key) or []
        user_reminders.append(reminder.dict())
        await cache_service.set(cache_key, user_reminders, ttl_hours=24)  # 24 hours
        
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
async def get_reminders():
    """
    Get all reminders for the user
    """
    try:
        logger.info("Fetching user reminders")
        
        # Get from cache first
        cache_key = f"user_reminders"
        cached_reminders = await cache_service.get(cache_key)
        
        if cached_reminders:
            reminders = []
            for record in cached_reminders:
                reminder = ReminderResponse(
                    id=record['id'],
                    type=ReminderType(record['type']),
                    label=record['label'],
                    time=record['time'],
                    days=record['days'],
                    enabled=record['enabled'],
                    created_at=datetime.fromisoformat(record['created_at']) if isinstance(record['created_at'], str) else record['created_at'],
                    updated_at=datetime.fromisoformat(record['updated_at']) if isinstance(record['updated_at'], str) else record['updated_at']
                )
                reminders.append(reminder)
        else:
            # Fallback to in-memory data
            reminders = []
            for record in reminders_data:
                reminder = ReminderResponse(
                    id=record['id'],
                    type=ReminderType(record['type']),
                    label=record['label'],
                    time=record['time'],
                    days=record['days'],
                    enabled=record['enabled'],
                    created_at=datetime.fromisoformat(record['created_at']) if isinstance(record['created_at'], str) else record['created_at'],
                    updated_at=datetime.fromisoformat(record['updated_at']) if isinstance(record['updated_at'], str) else record['updated_at']
                )
                reminders.append(reminder)
        
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
    request: ReminderUpdateRequest = ...
):
    """
    Update an existing reminder
    """
    try:
        logger.info(f"Updating reminder {reminder_id}")
        
        # Find existing reminder
        reminder_record = None
        reminder_index = None
        for i, record in enumerate(reminders_data):
            if record['id'] == reminder_id:
                reminder_record = record
                reminder_index = i
                break
        
        if not reminder_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Reminder {reminder_id} not found"
            )
        
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
        
        # Update fields
        update_data = request.dict(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None:
                reminder_record[field] = value
        
        # Update timestamp
        reminder_record['updated_at'] = datetime.now().isoformat()
        
        # Update in memory storage
        reminders_data[reminder_index] = reminder_record
        
        # Update cache
        cache_key = f"user_reminders"
        await cache_service.set(cache_key, reminders_data, ttl_hours=24)  # 24 hours
        
        # Create response
        updated_reminder = ReminderResponse(
            id=reminder_record['id'],
            type=ReminderType(reminder_record['type']),
            label=reminder_record['label'],
            time=reminder_record['time'],
            days=reminder_record['days'],
            enabled=reminder_record['enabled'],
            created_at=datetime.fromisoformat(reminder_record['created_at']) if isinstance(reminder_record['created_at'], str) else reminder_record['created_at'],
            updated_at=datetime.fromisoformat(reminder_record['updated_at']) if isinstance(reminder_record['updated_at'], str) else reminder_record['updated_at']
        )
        
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
    reminder_id: str = Path(..., description="Reminder ID to delete")
):
    """
    Delete a reminder
    """
    try:
        logger.info(f"Deleting reminder {reminder_id}")
        
        # Find and remove reminder
        global reminders_data
        original_count = len(reminders_data)
        reminders_data = [record for record in reminders_data if record['id'] != reminder_id]
        
        if len(reminders_data) == original_count:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Reminder {reminder_id} not found"
            )
        
        # Update cache
        cache_key = f"user_reminders"
        await cache_service.set(cache_key, reminders_data, ttl_hours=24)  # 24 hours
        
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
    reminder_id: str = Path(..., description="Reminder ID to retrieve")
):
    """
    Get a specific reminder by ID
    """
    try:
        logger.info(f"Getting reminder {reminder_id}")
        
        # Find reminder
        for record in reminders_data:
            if record['id'] == reminder_id:
                reminder = ReminderResponse(
                    id=record['id'],
                    type=ReminderType(record['type']),
                    label=record['label'],
                    time=record['time'],
                    days=record['days'],
                    enabled=record['enabled'],
                    created_at=datetime.fromisoformat(record['created_at']) if isinstance(record['created_at'], str) else record['created_at'],
                    updated_at=datetime.fromisoformat(record['updated_at']) if isinstance(record['updated_at'], str) else record['updated_at']
                )
                return reminder
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reminder {reminder_id} not found"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get reminder: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get reminder: {str(e)}"
        )