from datetime import datetime
from typing import Optional, Literal, List
try:
    from enum import StrEnum
except ImportError:
    # Python 3.9 fallback
    from enum import Enum

    class StrEnum(str, Enum):
        pass
from pydantic import BaseModel, Field

from app.models.social.follow import Status


class BlockAction(StrEnum):
    BLOCK = 'block'
    UNBLOCK = 'unblock'


class BlockActionRequest(BaseModel):
    action: BlockAction
    reason: Optional[str] = None


class BlockActionResponse(BaseModel):
    ok: bool
    blocker_id: str
    blocked_id: str
    status: Status
    blocked_at: datetime


class BlockListItem(BaseModel):
    user_id: str
    handle: str
    avatar_url: Optional[str]
    since: datetime
    reason: Optional[str]


class BlockListResponse(BaseModel):
    items: List[BlockListItem]
    next_cursor: Optional[str] = None
