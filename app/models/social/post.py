# EPIC_A.A5: Post models for UGC content

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, validator, Field
from enum import Enum


class ReactionType(str, Enum):
    LIKE = "like"


class PostMedia(BaseModel):
    id: str
    type: str  # image or video
    url: str
    order_position: int = 0
    created_at: datetime


class PostCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    media_urls: Optional[List[str]] = Field(default_factory=list, max_items=4)

    @validator('media_urls')
    def validate_media_count(cls, v):
        if len(v) > 4:
            raise ValueError('Maximum 4 media items allowed')
        return v


class PostStats(BaseModel):
    likes_count: int = 0
    comments_count: int = 0


class PostDetail(BaseModel):
    id: str
    author_id: str
    text: str
    media: Optional[List[PostMedia]] = Field(default_factory=list)
    stats: PostStats
    visibility: str
    created_at: datetime
    updated_at: datetime
    is_liked_by_user: bool = False


class CommentCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=280)


class CommentDetail(BaseModel):
    id: str
    post_id: str
    author_id: str
    text: str
    created_at: datetime
    updated_at: datetime
