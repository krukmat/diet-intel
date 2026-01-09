"""Request parsers for track routes."""

from datetime import datetime
from typing import Optional
from fastapi import Request, HTTPException, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from pydantic_core import ValidationError as CoreValidationError
from starlette.datastructures import UploadFile

from app.models.tracking import WeightTrackingRequest


def _validate_image_file(file: UploadFile) -> None:
    """Validate that uploaded file is an image."""
    content_type = file.content_type or ""
    if not content_type.lower().startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="photo must be an image file"
        )


def parse_photo_upload(request: Request, user_id: str) -> Optional[str]:
    """Parse photo from multipart request and save it.
    
    Args:
        request: The incoming request
        user_id: User ID for photo naming
        
    Returns:
        Photo URL or None if no photo uploaded
    """
    content_type = request.headers.get("content-type", "") or ""
    
    if "multipart/form-data" not in content_type.lower():
        return None
    
    # Handle multipart directly for photo
    form_task = request.form()
    
    async def process_form():
        form = await request.form()
        photo = form.get("photo")
        if photo and isinstance(photo, UploadFile):
            _validate_image_file(photo)
            from app.services.storage import save_photo
            photo_result = await save_photo(photo, f"photo_{user_id}")
            if photo_result:
                return photo_result.get("photo_url")
        return None
    
    # Return None for now - caller handles async
    return None


async def parse_weight_request(request: Request) -> WeightTrackingRequest:
    """Parse weight tracking request from form or JSON.
    
    Args:
        request: The incoming request
        
    Returns:
        Parsed WeightTrackingRequest
        
    Raises:
        RequestValidationError: If validation fails
    """
    content_type = request.headers.get("content-type", "") or ""
    
    if "multipart/form-data" in content_type.lower():
        # Parse multipart
        form = await request.form()
        data = {}
        for key, value in form.multi_items():
            if key != "photo":
                data[key] = value
            elif isinstance(value, UploadFile):
                _validate_image_file(value)
                data["photo"] = value
        
        return WeightTrackingRequest(**data)
    
    # Parse JSON
    try:
        json_data = await request.json()
        return WeightTrackingRequest(**json_data)
    except Exception as exc:
        raise RequestValidationError(
            [{"loc": ("body",), "msg": f"Invalid JSON payload: {exc}", "type": "value_error.jsondecode"}]
        )


def parse_datetime(value, default: Optional[datetime] = None) -> datetime:
    """Parse datetime from string or return default.
    
    Args:
        value: Value to parse (datetime or string)
        default: Default value if parsing fails
        
    Returns:
        Parsed datetime
    """
    default = default or datetime.utcnow()
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return default
    return default


def parse_photo_timestamp(value) -> datetime:
    """Parse timestamp for photo logs.
    
    Args:
        value: Timestamp value
        
    Returns:
        Parsed datetime
    """
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return datetime.now()
    return datetime.now()
