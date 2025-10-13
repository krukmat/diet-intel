"""
Block routes for user blocking/unblocking functionality.
Implements EPIC_A.A3: Basic blocking and moderation between users.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError

from app.config import config
from app.database import get_current_user
from app.models.social import User
from app.models.social.block import (
    BlockActionRequest,
    BlockActionResponse,
    BlockListResponse
)
from app.services.social.block_service import block_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/blocks", tags=["blocks"])

MODERATION_ENABLED = getattr(config, 'moderation_enabled', True)


@router.post("/{target_id}", response_model=BlockActionResponse)
async def block_or_unblock_user(
    target_id: str,
    request: BlockActionRequest,
    current_user: User = Depends(get_current_user)
) -> BlockActionResponse:
    """
    Block or unblock a user.

    - **target_id**: User ID to block/unblock
    - **request.action**: 'block' or 'unblock'
    - **request.reason**: Optional reason for blocking (only used when blocking)
    """
    if not MODERATION_ENABLED:
        raise HTTPException(status_code=403, detail="moderation features disabled")

    if current_user.id == target_id:
        raise HTTPException(status_code=400, detail="cannot block self")

    try:
        if request.action == "block":
            response = await block_service.block_user(
                blocker_id=current_user.id,
                blocked_id=target_id,
                reason=request.reason
            )
        elif request.action == "unblock":
            response = await block_service.unblock_user(
                blocker_id=current_user.id,
                blocked_id=target_id
            )
        else:
            raise HTTPException(status_code=400, detail="invalid action")

        return response

    except ValidationError as e:
        logger.error(f"Validation error in block route: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in block route: {e}")
        raise HTTPException(status_code=500, detail="internal server error")


@router.get("/profiles/{user_id}/blocked", response_model=BlockListResponse)
async def get_blocked_users(
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
) -> BlockListResponse:
    """
    Get list of users blocked by the specified user.

    - **user_id**: User whose blocked list to retrieve
    - **limit**: Maximum number of results (1-100)
    - **cursor**: Pagination cursor for next page
    """
    if not MODERATION_ENABLED:
        raise HTTPException(status_code=403, detail="moderation features disabled")

    # Only the user themselves can see their blocked list, or admins
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="forbidden")

    try:
        return await block_service.list_blocked(
            blocker_id=user_id,
            limit=limit,
            cursor=cursor
        )
    except HTTPException:
        # Re-raise cursor validation errors
        raise
    except Exception as e:
        logger.error(f"Error listing blocked users: {e}")
        raise HTTPException(status_code=500, detail="internal server error")


@router.get("/profiles/{user_id}/blockers", response_model=BlockListResponse)
async def get_blockers(
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
) -> BlockListResponse:
    """
    Get list of users who have blocked the specified user.

    - **user_id**: User whose blockers list to retrieve
    - **limit**: Maximum number of results (1-100)
    - **cursor**: Pagination cursor for next page
    """
    if not MODERATION_ENABLED:
        raise HTTPException(status_code=403, detail="moderation features disabled")

    # Only the user themselves can see who blocked them, or admins
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="forbidden")

    try:
        return await block_service.list_blockers(
            blocked_id=user_id,
            limit=limit,
            cursor=cursor
        )
    except HTTPException:
        # Re-raise cursor validation errors
        raise
    except Exception as e:
        logger.error(f"Error listing blockers: {e}")
        raise HTTPException(status_code=500, detail="internal server error")
