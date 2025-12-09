"""
EPIC_A.A2: Event publisher skeleton.

Provides a simple interface to publish domain events to an outbox table
and log them. Implementation is intentionally minimal (KISS) and can be
extended to real queues later.
"""
import json
import logging
import uuid
from datetime import datetime

from app.services.database import db_service

logger = logging.getLogger(__name__)


def publish_event(name: str, payload: dict) -> None:
    """Publish an event to the outbox and log it.

    KISS: best-effort insert; errors are logged but not raised.
    """
    try:
        event_id = str(uuid.uuid4())
        data = json.dumps(payload, ensure_ascii=False)
        with db_service.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS event_outbox (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  payload TEXT NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            cur.execute(
                "INSERT INTO event_outbox (id, name, payload, created_at) VALUES (?,?,?,?)",
                (event_id, name, data, datetime.utcnow().isoformat()),
            )
            conn.commit()
        logger.info("event published: %s %s", name, payload)
    except Exception as exc:
        logger.warning("failed to publish event '%s': %s", name, exc)

