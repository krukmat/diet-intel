import json
from datetime import datetime

import pytest

from app.routes import reminder as reminder_module
from app.models.reminder import ReminderType


def test_cache_key_prefixed():
    assert reminder_module._cache_key("abc") == "user_reminders:abc"


def test_coerce_reminder_entry_falls_back_on_bad_days():
    entry = {
        "id": "test",
        "type": "unknown",
        "label": "Label",
        "days": "invalid",
        "time": "07:00",
        "enabled": True
    }

    coerced = reminder_module._coerce_reminder_entry(entry)

    assert coerced["type"] == ReminderType.MEAL.value
    assert coerced["days_format"] == "bool"
    assert len(coerced["days"]) == 7


def test_parse_cached_payload_handles_bytes_and_json():
    payload = json.dumps({"reminders": [{
        "id": "cached",
        "type": ReminderType.WEIGHT.value,
        "label": "Weigh",
        "days": [False, False, False, False, False, False, True],
        "time": "08:00",
        "enabled": False,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "days_format": "bool"
    }]})

    decoded = reminder_module._parse_cached_payload(payload.encode("utf-8"))

    assert len(decoded) == 1
    assert decoded[0]["type"] == ReminderType.WEIGHT.value


def test_format_days_returns_names_when_requested():
    entry = {
        "days": [True, False, True, False, False, False, False],
        "days_format": "names"
    }
    assert reminder_module._format_days(entry) == ["sunday", "tuesday"]


def test_validate_time_format_rejects_invalid():
    assert reminder_module._validate_time_format("25:00") is False
    assert reminder_module._validate_time_format("09:61") is False
    assert reminder_module._validate_time_format("08:30") is True
