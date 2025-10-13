"""
Social profile models for DietIntel

Part of EPIC_A.A1 - View Profile implementation
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ProfileVisibility(str, Enum):
    """Profile visibility settings"""
    PUBLIC = "public"
    FOLLOWERS_ONLY = "followers_only"


class ProfileStats(BaseModel):
    """User profile statistics"""
    followers_count: int = Field(..., ge=0)
    following_count: int = Field(..., ge=0)
    posts_count: int = Field(..., ge=0)
    points_total: int = Field(..., ge=0)
    level: int = Field(..., ge=0)
    badges_count: int = Field(..., ge=0)


class PostPreview(BaseModel):
    """Preview of a user post for profile view"""
    post_id: str
    text: str
    media: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime
    counters: Dict[str, int]


class ProfileDetail(BaseModel):
    """Complete profile data for viewing"""
    user_id: str
    handle: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    visibility: ProfileVisibility
    stats: ProfileStats
    posts: List[PostPreview]
    posts_notice: Optional[str] = None
    block_relation: Optional[str] = Field(None, description="Block relation: 'blocked', 'blocked_by', or None")


class ProfileUpdateRequest(BaseModel):
    """Request payload for profile updates"""
    handle: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    visibility: Optional[ProfileVisibility] = None
