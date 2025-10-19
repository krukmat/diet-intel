from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Literal

from pydantic import BaseModel, Field


class RankReason(str, Enum):
    FRESH = "fresh"
    POPULAR = "popular"
    SUGGESTED = "suggested"
    DIVERSITY = "diversity"


class DiscoverFeedItem(BaseModel):
    id: str = Field(..., description="Post ID")
    author_id: str = Field(..., description="Author user ID")
    author_handle: Optional[str] = Field(
        default=None, description="Public handle if available"
    )
    text: str = Field(..., description="Post text snippet")
    media: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of media objects (id, url, type, order_position)",
    )
    rank_score: float = Field(..., description="Final ranking score")
    reason: RankReason = Field(..., description="Why the item is shown")
    created_at: datetime = Field(..., description="Creation timestamp")
    surface: str = Field(..., description="Surface requesting the feed (web/mobile)")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Extra ranker metadata (weights, signals)",
    )


class DiscoverFeedResponse(BaseModel):
    items: List[DiscoverFeedItem] = Field(
        default_factory=list, description="Ranked feed items"
    )
    next_cursor: Optional[str] = Field(
        default=None, description="Opaque pagination cursor"
    )
    variant: str = Field(
        default="control", description="Experiment variant applied to ranking"
    )
    request_id: Optional[str] = Field(
        default=None, description="Telemetry request identifier"
    )


class DiscoverFeedInteraction(BaseModel):
    post_id: str = Field(..., description="Interacted post ID")
    action: Literal["click", "dismiss"] = Field(
        ..., description="Interaction action type"
    )
    surface: Literal["web", "mobile"] = Field(
        ..., description="Surface where the interaction happened"
    )
    variant: Optional[str] = Field(
        default="control", description="Experiment variant associated to the view"
    )
    request_id: Optional[str] = Field(
        default=None, description="Request identifier from the feed response"
    )
    rank_score: Optional[float] = Field(
        default=0.0, description="Rank score assigned to the item"
    )
    reason: Optional[str] = Field(
        default=None, description="Displayed reason for the item"
    )
