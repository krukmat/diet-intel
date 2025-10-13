import base64
import uuid
from datetime import datetime
from typing import Optional
import json

from fastapi import HTTPException

from app.services.database import db_service
from app.models.social import (
    BlockAction,
    BlockActionRequest,
    BlockActionResponse,
    BlockListItem,
    BlockListResponse
)
from app.services.social.event_publisher import publish_event


class BlockService:
    """Service for handling user blocking/unblocking operations"""

    @staticmethod
    async def block_user(blocker_id: str, blocked_id: str, reason: Optional[str] = None) -> BlockActionResponse:
        """Block a user. Performs validation and transaction logic."""
        # Validation: cannot block self
        if blocker_id == blocked_id:
            raise HTTPException(status_code=400, detail="cannot block self")

        with db_service.get_connection() as conn:
            cursor = conn.cursor()

            # Check if already blocked (idempotent operation)
            cursor.execute("""
                SELECT status, created_at FROM user_blocks
                WHERE blocker_id = ? AND blocked_id = ?
            """, (blocker_id, blocked_id))

            existing_block = cursor.fetchone()

            if existing_block:
                # Already blocked, return current state
                return BlockActionResponse(
                    ok=True,
                    blocker_id=blocker_id,
                    blocked_id=blocked_id,
                    status='active',
                    blocked_at=datetime.fromisoformat(existing_block['created_at'])
                )

            # Delete any existing follows in both directions and decrement counters
            # Check which follows exist and decrement counters appropriately
            cursor.execute("""
                SELECT follower_id, followee_id FROM user_follows
                WHERE (follower_id = ? AND followee_id = ?) OR (follower_id = ? AND followee_id = ?)
                AND status = 'active'
            """, (blocker_id, blocked_id, blocked_id, blocker_id))

            existing_follows = cursor.fetchall()

            # Delete the follows
            cursor.execute("""
                DELETE FROM user_follows
                WHERE (follower_id = ? AND followee_id = ?) OR (follower_id = ? AND followee_id = ?)
            """, (blocker_id, blocked_id, blocked_id, blocker_id))

            # Decrement counters for each follow that was deleted
            for follow in existing_follows:
                follower_id = follow['follower_id']
                followee_id = follow['followee_id']
                cursor.execute("""
                    UPDATE profile_stats SET followers_count = MAX(0, followers_count - 1)
                    WHERE user_id = ?
                """, (followee_id,))

                cursor.execute("""
                    UPDATE profile_stats SET following_count = MAX(0, following_count - 1)
                    WHERE user_id = ?
                """, (follower_id,))

            # Insert block record
            blocked_at = datetime.utcnow()
            cursor.execute("""
                INSERT INTO user_blocks (blocker_id, blocked_id, reason, status, created_at)
                VALUES (?, ?, ?, 'active', ?)
            """, (blocker_id, blocked_id, reason, blocked_at.isoformat()))

            # Insert block event
            event_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO block_events (id, blocker_id, blocked_id, action, reason, created_at)
                VALUES (?, ?, ?, 'block', ?, ?)
            """, (event_id, blocker_id, blocked_id, reason, blocked_at.isoformat()))

            conn.commit()

            # Publish event
            await publish_event('UserAction.UserBlocked', {
                'blocker_id': blocker_id,
                'blocked_id': blocked_id,
                'reason': reason,
                'ts': blocked_at.isoformat()
            })

            return BlockActionResponse(
                ok=True,
                blocker_id=blocker_id,
                blocked_id=blocked_id,
                status='active',
                blocked_at=blocked_at
            )

    @staticmethod
    async def unblock_user(blocker_id: str, blocked_id: str) -> BlockActionResponse:
        """Unblock a user. Handles idempotent case where no block exists."""
        with db_service.get_connection() as conn:
            cursor = conn.cursor()

            # Check if currently blocked
            cursor.execute("""
                SELECT created_at FROM user_blocks
                WHERE blocker_id = ? AND blocked_id = ? AND status = 'active'
            """, (blocker_id, blocked_id))

            existing_block = cursor.fetchone()

            if not existing_block:
                # Not blocked, return success (idempotent)
                return BlockActionResponse(
                    ok=True,
                    blocker_id=blocker_id,
                    blocked_id=blocked_id,
                    status='revoked',
                    blocked_at=datetime.utcnow()  # Use current time for unblock timestamp
                )

            # Delete block record
            cursor.execute("""
                UPDATE user_blocks
                SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
                WHERE blocker_id = ? AND blocked_id = ? AND status = 'active'
            """, (blocker_id, blocked_id))

            # Insert unblock event
            event_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO block_events (id, blocker_id, blocked_id, action, created_at)
                VALUES (?, ?, ?, 'unblock', CURRENT_TIMESTAMP)
            """, (event_id, blocker_id, blocked_id))

            unblocked_at = datetime.utcnow()
            conn.commit()

            # Publish event
            await publish_event('UserAction.UserUnblocked', {
                'blocker_id': blocker_id,
                'blocked_id': blocked_id,
                'ts': unblocked_at.isoformat()
            })

            return BlockActionResponse(
                ok=True,
                blocker_id=blocker_id,
                blocked_id=blocked_id,
                status='revoked',
                blocked_at=unblocked_at
            )

    @staticmethod
    async def list_blocked(blocker_id: str, limit: int = 20, cursor: Optional[str] = None) -> BlockListResponse:
        """List users blocked by the given user with pagination."""
        items = []
        next_cursor = None

        with db_service.get_connection() as conn:
            cursor_obj = conn.cursor()

            # Parse cursor if provided
            where_clause = ""
            params = [blocker_id, limit + 1]  # +1 to detect if there are more

            if cursor:
                try:
                    # Decode cursor (base64 of "created_at|user_id")
                    decoded = base64.b64decode(cursor).decode('utf-8')
                    created_at_str, user_id = decoded.split('|', 1)
                    created_at = datetime.fromisoformat(created_at_str)
                    where_clause = " AND (b.created_at < ? OR (b.created_at = ? AND u.id < ?))"
                    params.extend([created_at.isoformat(), created_at.isoformat(), user_id])
                except (ValueError, UnicodeDecodeError):
                    raise HTTPException(status_code=400, detail="invalid cursor")

            # Query blocked users with user details
            cursor_obj.execute(f"""
                SELECT u.id, u.handle, u.avatar_url, b.created_at, b.reason
                FROM user_blocks b
                JOIN user_profiles u ON b.blocked_id = u.user_id
                WHERE b.blocker_id = ? AND b.status = 'active'
                {where_clause}
                ORDER BY b.created_at DESC, u.user_id ASC
                LIMIT ?
            """, params)

            rows = cursor_obj.fetchall()

            for row in rows[:limit]:  # Exclude the extra row used for pagination detection
                items.append(BlockListItem(
                    user_id=row['id'],
                    handle=row['handle'] if row['handle'] else f"user_{row['id'][:8]}",
                    avatar_url=row['avatar_url'],
                    since=datetime.fromisoformat(row['created_at']),
                    reason=row['reason']
                ))

            # Set next cursor if there are more results
            if len(rows) > limit:
                last_item = items[-1]
                next_cursor = base64.b64encode(
                    f"{last_item.since.isoformat()}|{last_item.user_id}".encode()
                ).decode()

        return BlockListResponse(items=items, next_cursor=next_cursor)

    @staticmethod
    async def list_blockers(blocked_id: str, limit: int = 20, cursor: Optional[str] = None) -> BlockListResponse:
        """List users who have blocked the given user with pagination."""
        items = []
        next_cursor = None

        with db_service.get_connection() as conn:
            cursor_obj = conn.cursor()

            # Parse cursor if provided
            where_clause = ""
            params = [blocked_id, limit + 1]  # +1 to detect if there are more

            if cursor:
                try:
                    # Decode cursor (base64 of "created_at|user_id")
                    decoded = base64.b64decode(cursor).decode('utf-8')
                    created_at_str, user_id = decoded.split('|', 1)
                    created_at = datetime.fromisoformat(created_at_str)
                    where_clause = " AND (b.created_at < ? OR (b.created_at = ? AND u.id < ?))"
                    params.extend([created_at.isoformat(), created_at.isoformat(), user_id])
                except (ValueError, UnicodeDecodeError):
                    raise HTTPException(status_code=400, detail="invalid cursor")

            # Query blockers with user details
            cursor_obj.execute(f"""
                SELECT u.id, u.handle, u.avatar_url, b.created_at, b.reason
                FROM user_blocks b
                JOIN user_profiles u ON b.blocker_id = u.user_id
                WHERE b.blocked_id = ? AND b.status = 'active'
                {where_clause}
                ORDER BY b.created_at DESC, u.user_id ASC
                LIMIT ?
            """, params)

            rows = cursor_obj.fetchall()

            for row in rows[:limit]:  # Exclude the extra row used for pagination detection
                items.append(BlockListItem(
                    user_id=row['id'],
                    handle=row['handle'] if row['handle'] else f"user_{row['id'][:8]}",
                    avatar_url=row['avatar_url'],
                    since=datetime.fromisoformat(row['created_at']),
                    reason=row['reason']
                ))

            # Set next cursor if there are more results
            if len(rows) > limit:
                last_item = items[-1]
                next_cursor = base64.b64encode(
                    f"{last_item.since.isoformat()}|{last_item.user_id}".encode()
                ).decode()

        return BlockListResponse(items=items, next_cursor=next_cursor)

    @staticmethod
    async def is_blocking(blocker_id: str, blocked_id: str) -> bool:
        """Check if blocker_id is currently blocking blocked_id."""
        with db_service.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT 1 FROM user_blocks
                WHERE blocker_id = ? AND blocked_id = ? AND status = 'active'
                LIMIT 1
            """, (blocker_id, blocked_id))

            return cursor.fetchone() is not None


# Singleton instance
block_service = BlockService()
