"""
Feed models for social activity feed.

EPIC_A.A4: Models for feed API responses.
"""

from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class FeedItem(BaseModel):
    """Individual item in the social activity feed."""
    id: str
    user_id: str
    actor_id: str
    event_name: str
    payload: Dict[str, Any]
    created_at: datetime


class FeedResponse(BaseModel):
    """Response for feed API endpoint with pagination."""
    items: List[FeedItem]
    next_cursor: Optional[str] = None
