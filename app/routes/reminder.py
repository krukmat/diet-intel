import uuid
import json
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, status, Path, Request

from app.models.reminder import (
    ReminderRequest, ReminderResponse, ReminderUpdateRequest,
    RemindersListResponse, ReminderUpdateResponse,
    ReminderType, normalize_reminder_days, DAY_NAMES
)
from app.services.cache import cache_service
from app.services import cache as cache_module
from app.services.database import db_service
from app.services.reminders_service import RemindersService  # Task: Phase 2 Batch 5
from app.utils.auth_context import get_session_user_id
import logging

logger = logging.getLogger(__name__)
router = APIRouter()
reminders_service = RemindersService(db_service)  # Task: Phase 2 Batch 5

_REMINDER_STORE: Dict[str, List[dict]] = {}


def _cache_key(user_id: str) -> str:
    return f"user_reminders:{user_id}"


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _coerce_datetime(value) -> datetime:
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return datetime.fromisoformat(_now_iso())


def _get_cache_backend():
    return getattr(cache_module, "cache_service", cache_service)


def _coerce_reminder_entry(entry) -> Optional[dict]:
    if not isinstance(entry, dict):
        return None

    original_days = entry.get("days") or [False] * 7
    format_hint = entry.get("days_format")
    if format_hint not in {"names", "bool"}:
        if isinstance(original_days, list) and original_days and isinstance(original_days[0], str):
            format_hint = "names"
        else:
            format_hint = "bool"

    base = {
        "id": entry.get("id") or str(uuid.uuid4()),
        "type": entry.get("type") or ReminderType.MEAL.value,
        "label": entry.get("label") or "",
        "time": entry.get("time") or "08:00",
        "days": original_days,
        "enabled": bool(entry.get("enabled", True)),
        "created_at": entry.get("created_at") or _now_iso(),
        "updated_at": entry.get("updated_at") or _now_iso(),
        "days_format": format_hint,
    }

    try:
        base["type"] = ReminderType(base["type"]).value
    except Exception:
        base["type"] = ReminderType.MEAL.value

    try:
        base["days"] = normalize_reminder_days(base["days"])
    except Exception:
        base["days"] = [False] * 7
        base["days_format"] = "bool"

    if isinstance(base["created_at"], datetime):
        base["created_at"] = base["created_at"].isoformat()
    if isinstance(base["updated_at"], datetime):
        base["updated_at"] = base["updated_at"].isoformat()

    return base


def _parse_cached_payload(payload) -> List[dict]:
    if payload is None:
        return []

    if isinstance(payload, bytes):
        payload = payload.decode("utf-8")

    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            return []

    if isinstance(payload, dict):
        items = payload.get("reminders") or payload.get("items")
    else:
        items = payload

    if not isinstance(items, list):
        return []

    normalized = []
    for item in items:
        normalized_entry = _coerce_reminder_entry(item)
        if normalized_entry:
            normalized.append(normalized_entry)
    return normalized


def _db_record_to_entry(record: dict) -> dict:
    entry = {
        "id": record.get("id") or str(uuid.uuid4()),
        "type": record.get("type") or record.get("description") or ReminderType.MEAL.value,
        "label": record.get("label") or record.get("title") or "",
        "time": record.get("time") or "08:00",
        "days": record.get("days") or record.get("frequency") or [False] * 7,
        "enabled": bool(record.get("enabled", record.get("is_active", True))),
        "created_at": record.get("created_at") or _now_iso(),
        "updated_at": record.get("updated_at") or record.get("created_at") or _now_iso(),
        "days_format": "bool",
    }

    if isinstance(entry["days"], str):
        try:
            entry["days"] = json.loads(entry["days"])
        except json.JSONDecodeError:
            entry["days"] = [False] * 7

    if isinstance(entry["days"], list):
        try:
            entry["days"] = normalize_reminder_days(entry["days"])
        except Exception:
            entry["days"] = [False] * 7
    else:
        entry["days"] = [False] * 7

    if isinstance(entry["created_at"], datetime):
        entry["created_at"] = entry["created_at"].isoformat()
    else:
        entry["created_at"] = _coerce_datetime(entry["created_at"]).isoformat()

    if isinstance(entry["updated_at"], datetime):
        entry["updated_at"] = entry["updated_at"].isoformat()
    else:
        entry["updated_at"] = _coerce_datetime(entry["updated_at"]).isoformat()

    try:
        entry["type"] = ReminderType(entry["type"]).value
    except Exception:
        entry["type"] = ReminderType.MEAL.value

    return entry


def _format_days(entry: dict) -> List:
    if entry.get("days_format") == "names":
        return [DAY_NAMES[idx] for idx, flag in enumerate(entry["days"]) if flag]
    return list(entry["days"])


async def _save_user_reminders(user_id: str, reminders: List[dict]):
    serialized = json.dumps({"reminders": reminders, "count": len(reminders)})
    cache_key = _cache_key(user_id)
    cache = _get_cache_backend()
    try:
        await cache.set(cache_key, serialized, ttl=24 * 3600)
    except Exception as cache_error:
        logger.warning(f"Failed to persist reminder cache for {user_id}: {cache_error}")
    _REMINDER_STORE[user_id] = [dict(reminder) for reminder in reminders]


async def _load_user_reminders(user_id: str) -> List[dict]:
    cache_key = _cache_key(user_id)
    cache_available = False
    cache = _get_cache_backend()
    try:
        cached = await cache.get(cache_key)
        cache_available = True
    except Exception as cache_error:
        logger.debug(f"Failed to read reminder cache for {user_id}: {cache_error}")
        cached = None

    if cache_available:
        reminders = _parse_cached_payload(cached)
        if reminders:
            _REMINDER_STORE[user_id] = [dict(reminder) for reminder in reminders]
            return reminders
        consume_error = getattr(cache, "consume_last_error", None)
        last_error = consume_error() if callable(consume_error) else None
        if last_error is None:
            if user_id in _REMINDER_STORE:
                return [dict(reminder) for reminder in _REMINDER_STORE[user_id]]
            return []

    if user_id in _REMINDER_STORE:
        return [dict(reminder) for reminder in _REMINDER_STORE[user_id]]

    try:
        db_records = await reminders_service.get_user_reminders(user_id)  # Task: Phase 2 Batch 5
    except Exception as db_error:
        logger.debug(f"Failed to fetch reminders from DB for {user_id}: {db_error}")
        db_records = []

    reminders = [_db_record_to_entry(record) for record in db_records]
    if reminders:
        await _save_user_reminders(user_id, reminders)
    return reminders


def _build_response(reminder_entry: dict) -> ReminderResponse:
    return ReminderResponse(
        id=reminder_entry["id"],
        type=ReminderType(reminder_entry["type"]),
        label=reminder_entry["label"],
        time=reminder_entry["time"],
        days=_format_days(reminder_entry),
        enabled=reminder_entry["enabled"],
        created_at=_coerce_datetime(reminder_entry["created_at"]),
        updated_at=_coerce_datetime(reminder_entry["updated_at"]),
    )


def _validate_time_format(time_str: str) -> bool:
    try:
        hour, minute = map(int, time_str.split(":"))
        return 0 <= hour <= 23 and 0 <= minute <= 59
    except (ValueError, AttributeError):
        return False

@router.post("", response_model=ReminderResponse)
async def create_reminder(request: ReminderRequest, req: Request):
    """
    Create a new meal or weigh-in reminder
    """
    try:
        logger.info(f"Creating {request.type} reminder: {request.label}")

        if not _validate_time_format(request.time):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid time format. Use HH:MM format."
            )

        # Ensure at least one day is selected
        if not any(request.days):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one day must be selected."
            )

        user_id = await get_session_user_id(req)
        reminders = await _load_user_reminders(user_id)

        reminder_entry = {
            "id": str(uuid.uuid4()),
            "type": request.type.value,
            "label": request.label,
            "time": request.time,
            "days": list(request.days),
            "enabled": request.enabled,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "days_format": getattr(request, "days_format", "bool"),
        }

        reminders.append(reminder_entry)
        await _save_user_reminders(user_id, reminders)

        try:
            await reminders_service.create_reminder(user_id, request)  # Task: Phase 2 Batch 5
        except Exception as db_error:
            logger.debug(f"DB reminder persistence skipped: {db_error}")

        logger.info(f"Successfully created reminder {reminder_entry['id']}")

        return _build_response(reminder_entry)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create reminder: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create reminder: {str(e)}"
        )

@router.get("", response_model=RemindersListResponse)
async def get_reminders(req: Request, reminder_type: Optional[str] = None):
    """
    Get all reminders for the user
    """
    try:
        user_id = await get_session_user_id(req)
        logger.info(f"Fetching reminders for user {user_id}")

        reminders = await _load_user_reminders(user_id)

        if reminder_type:
            try:
                desired = ReminderType(reminder_type)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid reminder type filter"
                )
            reminders = [
                reminder for reminder in reminders
                if ReminderType(reminder["type"]) == desired
            ]

        response_items = [_build_response(entry) for entry in reminders]

        logger.info(f"Retrieved {len(response_items)} reminders")

        return RemindersListResponse(
            reminders=response_items,
            count=len(response_items)
        )
    
    except HTTPException:
        # Re-raise HTTPException to preserve intended status codes
        raise
    except Exception as e:
        logger.error(f"Failed to get reminders: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get reminders: {str(e)}"
        )

@router.put("/{reminder_id}", response_model=ReminderUpdateResponse)
async def update_reminder(
    reminder_id: str = Path(..., description="Reminder ID to update"),
    request: ReminderUpdateRequest = ...,
    req: Request = ...
):
    """
    Update an existing reminder
    """
    try:
        user_id = await get_session_user_id(req)
        logger.info(f"Updating reminder {reminder_id} for user {user_id}")

        reminders = await _load_user_reminders(user_id)
        target = next((entry for entry in reminders if entry["id"] == reminder_id), None)

        if target is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reminder not found"
            )

        updates = request.model_dump(exclude_unset=True)

        if "days" in updates and updates["days"] is not None and not any(updates["days"]):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one day must be selected."
            )

        if "time" in updates and updates["time"] is not None:
            if not _validate_time_format(updates["time"]):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid time format. Use HH:MM format."
                )

        if "label" in updates:
            target["label"] = updates["label"]
        if "time" in updates and updates["time"] is not None:
            target["time"] = updates["time"]
        if "days" in updates and updates["days"] is not None:
            target["days"] = list(updates["days"])
            target["days_format"] = getattr(request, "days_format", target.get("days_format", "bool"))
        if "enabled" in updates and updates["enabled"] is not None:
            target["enabled"] = updates["enabled"]
        if "type" in updates and updates["type"] is not None:
            new_type = updates["type"]
            if isinstance(new_type, ReminderType):
                new_type = new_type.value
            target["type"] = ReminderType(new_type).value

        target["updated_at"] = _now_iso()
        await _save_user_reminders(user_id, reminders)

        try:
            db_payload = updates.copy()
            if "type" in db_payload and isinstance(db_payload["type"], ReminderType):
                db_payload["type"] = db_payload["type"].value
            success = await reminders_service.update_reminder(reminder_id, db_payload)  # Task: Phase 2 Batch 5
            if not success:
                logger.debug(f"DB reminder update reported missing reminder {reminder_id}")
        except Exception as db_error:
            logger.debug(f"DB reminder update skipped: {db_error}")

        logger.info(f"Successfully updated reminder {reminder_id}")

        reminder_payload = _build_response(target)
        payload_dict = reminder_payload.model_dump()
        payload_dict["message"] = "Reminder updated successfully"
        return ReminderUpdateResponse(**payload_dict)
    
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
        user_id = await get_session_user_id(req)
        logger.info(f"Deleting reminder {reminder_id} for user {user_id}")

        reminders = await _load_user_reminders(user_id)
        new_reminders = [entry for entry in reminders if entry["id"] != reminder_id]

        if len(new_reminders) == len(reminders):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reminder not found"
            )

        await _save_user_reminders(user_id, new_reminders)

        try:
            success = await reminders_service.delete_reminder(reminder_id)  # Task: Phase 2 Batch 5
            if not success:
                logger.debug(f"DB reminder delete reported missing reminder {reminder_id}")
        except Exception as db_error:
            logger.debug(f"DB reminder delete skipped: {db_error}")

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
        user_id = await get_session_user_id(req)
        logger.info(f"Getting reminder {reminder_id} for user {user_id}")

        reminders = await _load_user_reminders(user_id)
        target = next((entry for entry in reminders if entry["id"] == reminder_id), None)

        if target is None:
            try:
                reminder_data = await reminders_service.get_reminder_by_id(reminder_id)  # Task: Phase 2 Batch 5
            except Exception as db_error:
                logger.debug(f"DB get reminder failed: {db_error}")
                reminder_data = None

            if reminder_data:
                target = _db_record_to_entry(reminder_data)
                reminders.append(target)
                await _save_user_reminders(user_id, reminders)

        if target is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reminder not found"
            )

        return _build_response(target)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get reminder: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get reminder: {str(e)}"
        )
