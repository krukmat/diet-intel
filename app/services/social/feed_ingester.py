"""
Feed Ingester - Moves social events from event_outbox to social_feed

EPIC_A.A4: Processes outbox events into activity feed items for users.
"""

import json
import logging
import uuid
from datetime import datetime

from app.services.database import db_service
from app.services.social.event_names import UserAction

logger = logging.getLogger(__name__)


def ingest_pending_events(batch_size: int = 100) -> int:
    """
    Process pending events from event_outbox into social_feed table.

    Args:
        batch_size: Maximum number of events to process in one batch

    Returns:
        Number of events successfully ingested
    """
    ingested_count = 0

    try:
        with db_service.get_connection() as conn:
            cursor = conn.cursor()

            # Get pending events that should be shown in feeds
            cursor.execute("""
                SELECT id, name, payload
                FROM event_outbox
                WHERE name IN (?, ?, ?, ?)
                ORDER BY created_at ASC
                LIMIT ?
            """, (
                UserAction.USER_FOLLOWED.value,
                UserAction.USER_UNFOLLOWED.value,
                UserAction.USER_BLOCKED.value,
                UserAction.USER_UNBLOCKED.value,
                batch_size
            ))

            events = cursor.fetchall()

            for event_id, event_name, payload_json in events:
                try:
                    # Parse the payload
                    payload = json.loads(payload_json)

                    # Map event to feed items based on event type
                    feed_items = _map_event_to_feed_items(event_name, payload)

                    # Insert each feed item
                    for item in feed_items:
                        feed_id = str(uuid.uuid4())
                        cursor.execute("""
                            INSERT INTO social_feed (id, user_id, actor_id, event_name, payload, created_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (
                            feed_id,
                            item['user_id'],
                            item['actor_id'],
                            item['event_name'],
                            json.dumps(item['payload']),
                            datetime.utcnow().isoformat()
                        ))

                        logger.debug(f"ingested_{event_name}")

                    # Remove processed event from outbox
                    cursor.execute("DELETE FROM event_outbox WHERE id = ?", (event_id,))

                    ingested_count += 1

                except json.JSONDecodeError as json_err:
                    logger.warning(f"Failed to parse payload for event {event_id}: {json_err}")
                    # Remove corrupted event
                    cursor.execute("DELETE FROM event_outbox WHERE id = ?", (event_id,))
                    continue

                except Exception as event_err:
                    logger.error(f"Failed to process event {event_id}: {event_err}")
                    # Continue with next event, don't remove corrupted one
                    continue

            conn.commit()

    except Exception as e:
        logger.error(f"Feed ingester error: {e}")
        # Don't raise exception, just log and continue

    if ingested_count > 0:
        logger.info(f"Feed ingester processed {ingested_count} events")

    return ingested_count


def _map_event_to_feed_items(event_name: str, payload: dict) -> list:
    """
    Map a social event to one or more feed items.

    Args:
        event_name: The event type
        payload: Event payload data

    Returns:
        List of feed item dictionaries
    """
    items = []

    try:
        if event_name == UserAction.USER_FOLLOWED.value:
            items.append({
                'user_id': payload['target_id'],  # Person being followed
                'actor_id': payload['follower_id'],  # Person who followed
                'event_name': UserAction.USER_FOLLOWED.value,
                'payload': {
                    'follower_id': payload['follower_id'],
                    'target_id': payload['target_id'],
                    'action': 'followed',
                    'ts': payload.get('ts')
                }
            })

        elif event_name == UserAction.USER_UNFOLLOWED.value:
            items.append({
                'user_id': payload['target_id'],  # Person being unfollowed
                'actor_id': payload['follower_id'],  # Person who unfollowed
                'event_name': UserAction.USER_UNFOLLOWED.value,
                'payload': {
                    'follower_id': payload['follower_id'],
                    'target_id': payload['target_id'],
                    'action': 'unfollowed',
                    'ts': payload.get('ts')
                }
            })

        elif event_name == UserAction.USER_BLOCKED.value:
            items.append({
                'user_id': payload['blocked_id'],  # Person being blocked
                'actor_id': payload['blocker_id'],  # Person who blocked
                'event_name': UserAction.USER_BLOCKED.value,
                'payload': {
                    'blocker_id': payload['blocker_id'],
                    'blocked_id': payload['blocked_id'],
                    'reason': payload.get('reason'),
                    'action': 'blocked',
                    'ts': payload.get('ts')
                }
            })

        elif event_name == UserAction.USER_UNBLOCKED.value:
            items.append({
                'user_id': payload['blocked_id'],  # Person being unblocked
                'actor_id': payload['blocker_id'],  # Person who unblocked
                'event_name': UserAction.USER_UNBLOCKED.value,
                'payload': {
                    'blocker_id': payload['blocker_id'],
                    'blocked_id': payload['blocked_id'],
                    'action': 'unblocked',
                    'ts': payload.get('ts')
                }
            })

    except KeyError as key_err:
        logger.warning(f"Missing required field in {event_name} payload: {key_err}")

    return items
