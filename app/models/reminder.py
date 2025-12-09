from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum

class ReminderType(str, Enum):
    """Types of reminders supported"""
    MEAL = "meal"
    WEIGH_IN = "weigh-in"

class ReminderRequest(BaseModel):
    """Request model for creating/updating reminders"""
    type: ReminderType = Field(..., description="Type of reminder")
    label: str = Field(..., min_length=1, max_length=100, description="Custom label for the reminder")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$", description="Time in HH:MM format")
    days: List[bool] = Field(..., min_items=7, max_items=7, description="Days of week [Sun, Mon, Tue, Wed, Thu, Fri, Sat]")
    enabled: bool = Field(default=True, description="Whether reminder is active")

class ReminderResponse(BaseModel):
    """Response model for reminders"""
    id: str
    type: ReminderType
    label: str
    time: str
    days: List[bool]
    enabled: bool
    created_at: datetime
    updated_at: datetime

class ReminderUpdateRequest(BaseModel):
    """Request model for updating existing reminders"""
    type: Optional[ReminderType] = None
    label: Optional[str] = Field(None, min_length=1, max_length=100)
    time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    days: Optional[List[bool]] = Field(None, min_items=7, max_items=7)
    enabled: Optional[bool] = None

class RemindersListResponse(BaseModel):
    """Response model for list of reminders"""
    reminders: List[ReminderResponse]
    count: int