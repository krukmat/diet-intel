from datetime import datetime
from typing import List, Optional, Union
from pydantic import BaseModel, Field, validator, root_validator
from enum import Enum

DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
DAY_INDEX = {name: idx for idx, name in enumerate(DAY_NAMES)}


def normalize_reminder_days(days_value):
    """Normalize incoming day selectors into a 7-length boolean list."""
    if days_value is None:
        return None

    if isinstance(days_value, list):
        if all(isinstance(day, bool) for day in days_value):
            if len(days_value) != 7:
                raise ValueError("Days list must contain exactly 7 boolean entries")
            return list(days_value)

        if all(isinstance(day, str) for day in days_value):
            normalized = [False] * 7
            for entry in days_value:
                name = entry.strip().lower()
                if name not in DAY_INDEX:
                    raise ValueError(f"Invalid day name: {entry}")
                normalized[DAY_INDEX[name]] = True
            if not any(normalized):
                raise ValueError("At least one valid day must be selected")
            return normalized

    raise ValueError("Days must be either a 7-length boolean array or list of day names")


class ReminderType(str, Enum):
    """Types of reminders supported"""
    MEAL = "meal"
    WEIGHT = "weight"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"weight", "weigh-in", "weigh_in"}:
                return cls.WEIGHT
            if normalized == "meal":
                return cls.MEAL
        return None


class ReminderRequest(BaseModel):
    """Request model for creating/updating reminders"""
    type: ReminderType = Field(..., description="Type of reminder")
    label: str = Field(..., min_length=1, max_length=100, description="Custom label for the reminder")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$", description="Time in HH:MM format")
    days: List[bool] = Field(..., min_items=7, max_items=7, description="Days of week [Sun, Mon, Tue, Wed, Thu, Fri, Sat]")
    enabled: bool = Field(default=True, description="Whether reminder is active")
    days_format: str = Field(default="bool", exclude=True)

    @root_validator(pre=True)
    def _set_days_format(cls, values):
        days_value = values.get("days")
        if isinstance(days_value, list) and days_value and isinstance(days_value[0], str):
            values["days_format"] = "names"
        else:
            values["days_format"] = "bool"
        return values

    @validator("days", pre=True)
    def _coerce_days(cls, value):
        return normalize_reminder_days(value)


class ReminderResponse(BaseModel):
    """Response model for reminders"""
    id: str
    type: ReminderType
    label: str
    time: str
    days: List[Union[bool, str]]
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
    days_format: str = Field(default="bool", exclude=True)

    @root_validator(pre=True)
    def _set_optional_days_format(cls, values):
        days_value = values.get("days")
        if isinstance(days_value, list) and days_value and isinstance(days_value[0], str):
            values["days_format"] = "names"
        elif days_value is not None:
            values["days_format"] = "bool"
        return values

    @validator("days", pre=True)
    def _coerce_optional_days(cls, value):
        if value is None:
            return value
        return normalize_reminder_days(value)


class RemindersListResponse(BaseModel):
    """Response model for list of reminders"""
    reminders: List[ReminderResponse]
    count: int


class ReminderUpdateResponse(ReminderResponse):
    """Response model for reminder updates with confirmation message."""
    message: str
