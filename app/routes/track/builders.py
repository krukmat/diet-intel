"""Response builders for track routes - Builder Pattern."""

from datetime import datetime
from typing import List, Optional, Dict, Any

from app.models.tracking import (
    MealTrackingResponse,
    MealHistoryResponse,
    WeightTrackingResponse,
    WeightHistoryResponse,
    PhotoLogsResponse,
    PhotoLogEntry,
    MealItem,
)


class MealResponseBuilder:
    """Builder for MealTrackingResponse."""
    
    def __init__(self):
        self._data: Dict[str, Any] = {}
    
    def with_id(self, meal_id: str) -> "MealResponseBuilder":
        self._data["id"] = meal_id
        return self
    
    def with_name(self, name: str) -> "MealResponseBuilder":
        self._data["meal_name"] = name
        return self
    
    def with_items(self, items: List) -> "MealResponseBuilder":
        self._data["items"] = items
        return self
    
    def with_total_calories(self, calories: float) -> "MealResponseBuilder":
        self._data["total_calories"] = round(calories, 2)
        return self
    
    def with_photo_url(self, url: Optional[str]) -> "MealResponseBuilder":
        self._data["photo_url"] = url
        return self
    
    def with_timestamp(self, ts: Any) -> "MealResponseBuilder":
        self._data["timestamp"] = self._parse_datetime(ts)
        return self
    
    def with_created_at(self, ts: Any) -> "MealResponseBuilder":
        self._data["created_at"] = self._parse_datetime(ts)
        return self
    
    def build(self) -> MealTrackingResponse:
        """Build the final response."""
        return MealTrackingResponse(**self._data)
    
    @staticmethod
    def _parse_datetime(value) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str) and value.strip():
            try:
                return datetime.fromisoformat(value.replace('Z', '+00:00'))
            except ValueError:
                return datetime.utcnow()
        return datetime.utcnow()


class WeightResponseBuilder:
    """Builder for WeightTrackingResponse."""
    
    def __init__(self):
        self._data: Dict[str, Any] = {}
    
    def with_id(self, entry_id: str) -> "WeightResponseBuilder":
        self._data["id"] = entry_id
        return self
    
    def with_weight(self, weight: float) -> "WeightResponseBuilder":
        self._data["weight"] = weight
        return self
    
    def with_date(self, date: Any) -> "WeightResponseBuilder":
        self._data["date"] = self._parse_datetime(date)
        return self
    
    def with_photo_url(self, url: Optional[str]) -> "WeightResponseBuilder":
        self._data["photo_url"] = url
        return self
    
    def with_created_at(self, ts: Any) -> "WeightResponseBuilder":
        self._data["created_at"] = self._parse_datetime(ts)
        return self
    
    def build(self) -> WeightTrackingResponse:
        """Build the final response."""
        return WeightTrackingResponse(**self._data)
    
    @staticmethod
    def _parse_datetime(value) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str) and value.strip():
            try:
                return datetime.fromisoformat(value.replace('Z', '+00:00'))
            except ValueError:
                return datetime.utcnow()
        return datetime.utcnow()


def build_meal_item(item_data: dict) -> MealItem:
    """Build a MealItem from dictionary."""
    return MealItem(
        barcode=item_data.get('barcode', ''),
        name=item_data.get('name', ''),
        serving=item_data.get('serving', ''),
        calories=item_data.get('calories', 0.0),
        macros=item_data.get('macros', {})
    )


def build_meal_history_response(records: List[Dict]) -> MealHistoryResponse:
    """Build meal history response from records."""
    meals = []
    for record in records:
        items = [build_meal_item(item) for item in record.get('items', [])]
        meal = MealTrackingResponse(
            id=record['id'],
            meal_name=record['meal_name'],
            items=items,
            total_calories=record.get('total_calories', 0.0),
            photo_url=record.get('photo_url'),
            timestamp=record['timestamp'],
            created_at=record.get('created_at')
        )
        meals.append(meal)
    
    return MealHistoryResponse(meals=meals, count=len(meals))


def build_weight_response(record: dict) -> Optional[WeightTrackingResponse]:
    """Build a weight response from record."""
    weight_value = record.get('weight', record.get('weight_kg'))
    if weight_value is None:
        return None
    
    return WeightTrackingResponse(
        id=record['id'],
        weight=weight_value,
        date=record.get('date'),
        photo_url=record.get('photo_url'),
        created_at=record.get('created_at')
    )


def build_weight_history_response(records: List[Dict]) -> WeightHistoryResponse:
    """Build weight history response from records."""
    entries = []
    for record in records:
        response = build_weight_response(record)
        if response:
            entries.append(response)
    
    date_range = {}
    if entries:
        dates = [
            entry.date.replace(tzinfo=None) if entry.date.tzinfo else entry.date
            for entry in entries
        ]
        date_range = {"earliest": min(dates), "latest": max(dates)}
    
    return WeightHistoryResponse(
        entries=entries,
        count=len(entries),
        date_range=date_range,
        history=entries
    )


def build_photo_log_entry(entry: dict) -> PhotoLogEntry:
    """Build a photo log entry from dictionary."""
    timestamp = entry.get('timestamp', entry.get('date'))
    
    if isinstance(timestamp, datetime):
        ts = timestamp
    elif isinstance(timestamp, str):
        try:
            ts = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except ValueError:
            ts = datetime.now()
    else:
        ts = datetime.now()
    
    return PhotoLogEntry(
        id=entry['id'],
        timestamp=ts,
        photo_url=entry['photo_url'],
        type=entry.get('type', 'meal'),
        description=entry.get('description')
    )


def build_photo_logs_response(records: List[Dict], limit: Optional[int] = None) -> PhotoLogsResponse:
    """Build photo logs response from records."""
    logs = [build_photo_log_entry(entry) for entry in records]
    if limit:
        logs = logs[:limit]
    
    return PhotoLogsResponse(logs=logs, count=len(logs))
