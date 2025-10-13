from datetime import datetime
from enum import Enum
from typing import List, Optional, Literal
from pydantic import BaseModel

class BlockAction(str, Enum):
    BLOCK = 'block'
    UNBLOCK = 'unblock'

class BlockActionRequest(BaseModel):
    action: BlockAction
    reason: Optional[str] = None

class BlockActionResponse(BaseModel):
    ok: bool
    blocker_id: str
    blocked_id: str
    status: Literal['active', 'revoked']
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
