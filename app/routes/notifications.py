# EPIC_A.A5: Notification routes for managing user notifications

from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from typing import List, Dict

from app.models.user import User
from app.services.auth import get_current_user
from app.utils.feature_flags import assert_feature_enabled
from app.services.notifications.notification_service import NotificationService

router = APIRouter()


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    payload: Dict
    is_read: bool
    created_at: str
    read_at: Optional[str]


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int


class MarkReadResponse(BaseModel):
    success: bool
    message: str


@router.get("/notifications", response_model=NotificationListResponse)
async def get_notifications(
    unread_only: bool = Query(default=False, description="Show only unread notifications"),
    limit: int = Query(default=50, ge=1, le=100, description="Maximum notifications to return"),
    current_user: User = Depends(get_current_user)
):
    """
    Get notifications for the authenticated user.

    Supports filtering to unread only and pagination.
    """
    assert_feature_enabled("notifications_enabled")

    try:
        notifications = NotificationService.get_user_notifications(
            current_user.id, unread_only=unread_only, limit=limit
        )
        unread_count = NotificationService.get_unread_count(current_user.id)

        return NotificationListResponse(
            notifications=notifications,
            unread_count=unread_count
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get notifications: {str(e)}")


@router.post("/notifications/{notification_id}/read", response_model=MarkReadResponse)
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Mark a specific notification as read.
    """
    assert_feature_enabled("notifications_enabled")

    try:
        success = NotificationService.mark_as_read(notification_id, current_user.id)

        if not success:
            raise HTTPException(status_code=404, detail="Notification not found or does not belong to user")

        return MarkReadResponse(
            success=True,
            message="Notification marked as read"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to mark notification read: {str(e)}")


@router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(current_user: User = Depends(get_current_user)):
    """
    Mark all notifications as read for the authenticated user.
    """
    assert_feature_enabled("notifications_enabled")

    try:
        marked_count = NotificationService.mark_all_read(current_user.id)

        return {
            "success": True,
            "message": f"Marked {marked_count} notifications as read",
            "marked_count": marked_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to mark all notifications read: {str(e)}")


@router.get("/notifications/unread-count")
async def get_unread_count(current_user: User = Depends(get_current_user)):
    """
    Get the count of unread notifications.

    Useful for showing notification badge counts in UI.
    """
    assert_feature_enabled("notifications_enabled")

    try:
        count = NotificationService.get_unread_count(current_user.id)
        return {"unread_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get unread count: {str(e)}")


@router.post("/notifications/cleanup", response_model=Dict[str, int])
async def cleanup_old_notifications(
    days_old: int = Query(default=30, ge=1, le=365, description="Delete notifications older than this many days"),
    current_user: User = Depends(get_current_user)
):
    """
    Admin endpoint: Clean up old read notifications.

    Requires authentication and proper permissions.
    Returns the count of deleted notifications.
    """
    assert_feature_enabled("notifications_enabled")

    # TODO: Add proper admin role check
    # For now, allow authenticated users (temporary)

    try:
        deleted_count = NotificationService.cleanup_old_notifications(days_old)
        return {
            "deleted_count": deleted_count,
            "message": f"Cleaned up {deleted_count} old notifications older than {days_old} days"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cleanup notifications: {str(e)}")
