from datetime import datetime
from typing import Optional, Literal, List
from pydantic import BaseModel, Field

Status = Literal['active', 'blocked']
Action = Literal['follow', 'unfollow']


class FollowEdge(BaseModel):
    follower_id: str = Field(...)
    followee_id: str = Field(...)
    status: Status = Field('active')
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FollowActionRequest(BaseModel):
    action: Action


class FollowActionResponse(BaseModel):
    ok: bool
    follower_id: str
    followee_id: str
    status: Status
    followers_count: int
    following_count: int
    blocked: bool = False


class FollowListItem(BaseModel):
    user_id: str
    handle: str
    avatar_url: Optional[str] = None
    since: datetime


class FollowListResponse(BaseModel):
    items: List[FollowListItem]
    next_cursor: Optional[str] = None
