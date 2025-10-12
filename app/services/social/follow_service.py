"""
EPIC_A.A2: FollowService implementation.
"""
import base64
from datetime import datetime
from typing import Optional, Dict, Tuple

from fastapi import HTTPException

from app.models.social.follow import (
    FollowActionRequest,
    FollowActionResponse,
    FollowListResponse,
)
from app.services.database import db_service
from .event_publisher import publish_event
from .moderation_gateway import moderation_gateway


class FollowService:
    RATE_LIMIT = 200

    def __init__(self):
        self.db = db_service

    async def follow_user(self, follower_id: str, followee_id: str) -> FollowActionResponse:
        if follower_id == followee_id:
            raise HTTPException(status_code=400, detail="cannot follow self")

        if moderation_gateway.is_blocked(follower_id, followee_id):
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                status = self._get_existing_status(cursor, follower_id, followee_id) or 'blocked'
                followers_count, following_count = self._get_counts(cursor, follower_id, followee_id)
            return FollowActionResponse(
                ok=False,
                follower_id=follower_id,
                followee_id=followee_id,
                status=status,
                followers_count=followers_count,
                following_count=following_count,
            )

        event_payload = {
            "follower_id": follower_id,
            "followee_id": followee_id,
            "ts": datetime.utcnow().isoformat(),
        }

        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            self._enforce_rate_limit(cursor, follower_id)

            existing = cursor.execute(
                """
                SELECT status
                FROM user_follows
                WHERE follower_id = ? AND followee_id = ?
                """,
                (follower_id, followee_id),
            ).fetchone()

            if existing and existing["status"] == "active":
                followers_count, following_count = self._get_counts(cursor, follower_id, followee_id)
                conn.commit()
                return FollowActionResponse(
                    ok=True,
                    follower_id=follower_id,
                    followee_id=followee_id,
                    status="active",
                    followers_count=followers_count,
                    following_count=following_count,
                )

            cursor.execute(
                """
                INSERT INTO user_follows (follower_id, followee_id, status)
                VALUES (?, ?, 'active')
                ON CONFLICT(follower_id, followee_id)
                DO UPDATE SET status='active', updated_at=CURRENT_TIMESTAMP
                """,
                (follower_id, followee_id),
            )

            self._ensure_profile_stats(cursor, follower_id)
            self._ensure_profile_stats(cursor, followee_id)
            self._update_counter(cursor, followee_id, "followers_count", 1)
            self._update_counter(cursor, follower_id, "following_count", 1)

            followers_count, following_count = self._get_counts(cursor, follower_id, followee_id)

            conn.commit()

        publish_event("UserAction.FollowCreated", event_payload)

        return FollowActionResponse(
            ok=True,
            follower_id=follower_id,
            followee_id=followee_id,
            status="active",
            followers_count=followers_count,
            following_count=following_count,
        )

    async def unfollow_user(self, follower_id: str, followee_id: str) -> FollowActionResponse:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            existing = cursor.execute(
                """
                SELECT status
                FROM user_follows
                WHERE follower_id = ? AND followee_id = ?
                """,
                (follower_id, followee_id),
            ).fetchone()

            if not existing:
                followers_count, following_count = self._get_counts(cursor, follower_id, followee_id)
                conn.commit()
                return FollowActionResponse(
                    ok=True,
                    follower_id=follower_id,
                    followee_id=followee_id,
                    status="active",
                    followers_count=followers_count,
                    following_count=following_count,
                )

            was_active = existing["status"] == "active"

            cursor.execute(
                "DELETE FROM user_follows WHERE follower_id = ? AND followee_id = ?",
                (follower_id, followee_id),
            )

            if was_active:
                self._ensure_profile_stats(cursor, follower_id)
                self._ensure_profile_stats(cursor, followee_id)
                self._update_counter(cursor, followee_id, "followers_count", -1)
                self._update_counter(cursor, follower_id, "following_count", -1)

            followers_count, following_count = self._get_counts(cursor, follower_id, followee_id)

            conn.commit()

        if was_active:
            publish_event(
                "UserAction.FollowRemoved",
                {
                    "follower_id": follower_id,
                    "followee_id": followee_id,
                    "ts": datetime.utcnow().isoformat(),
                },
            )

        return FollowActionResponse(
            ok=True,
            follower_id=follower_id,
            followee_id=followee_id,
            status="active",
            followers_count=followers_count,
            following_count=following_count,
        )

    async def list_followers(self, user_id: str, limit: int = 20, cursor: Optional[str] = None) -> FollowListResponse:
        with self.db.get_connection() as conn:
            db_cursor = conn.cursor()
            params = [user_id]
            where_clauses = ["uf.followee_id = ?", "uf.status = 'active'"]

            if cursor:
                cursor_created_at, cursor_user_id = self._decode_cursor(cursor)
                where_clauses.append(
                    "(uf.created_at < ? OR (uf.created_at = ? AND uf.follower_id > ?))"
                )
                params.extend([cursor_created_at, cursor_created_at, cursor_user_id])

            params.append(limit + 1)

            query = f"""
                SELECT
                    uf.follower_id AS user_id,
                    uf.created_at,
                    p.handle,
                    p.avatar_url
                FROM user_follows uf
                JOIN user_profiles p ON p.user_id = uf.follower_id
                WHERE {' AND '.join(where_clauses)}
                ORDER BY uf.created_at DESC, uf.follower_id ASC
                LIMIT ?
            """

            rows = db_cursor.execute(query, params).fetchall()

        items, next_cursor = self._build_list_response(rows, limit)
        return FollowListResponse(items=items, next_cursor=next_cursor)

    async def list_following(self, user_id: str, limit: int = 20, cursor: Optional[str] = None) -> FollowListResponse:
        with self.db.get_connection() as conn:
            db_cursor = conn.cursor()
            params = [user_id]
            where_clauses = ["uf.follower_id = ?", "uf.status = 'active'"]

            if cursor:
                cursor_created_at, cursor_user_id = self._decode_cursor(cursor)
                where_clauses.append(
                    "(uf.created_at < ? OR (uf.created_at = ? AND uf.followee_id > ?))"
                )
                params.extend([cursor_created_at, cursor_created_at, cursor_user_id])

            params.append(limit + 1)

            query = f"""
                SELECT
                    uf.followee_id AS user_id,
                    uf.created_at,
                    p.handle,
                    p.avatar_url
                FROM user_follows uf
                JOIN user_profiles p ON p.user_id = uf.followee_id
                WHERE {' AND '.join(where_clauses)}
                ORDER BY uf.created_at DESC, uf.followee_id ASC
                LIMIT ?
            """

            rows = db_cursor.execute(query, params).fetchall()

        items, next_cursor = self._build_list_response(rows, limit)
        return FollowListResponse(items=items, next_cursor=next_cursor)

    async def is_following(self, follower_id: str, followee_id: str) -> bool:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            row = cursor.execute(
                """
                SELECT 1
                FROM user_follows
                WHERE follower_id = ? AND followee_id = ? AND status = 'active'
                """,
                (follower_id, followee_id),
            ).fetchone()
        return row is not None

    def _enforce_rate_limit(self, cursor, user_id: str) -> None:
        today = datetime.utcnow().date().isoformat()
        existing = cursor.execute(
            """
            SELECT count
            FROM follow_activity_log
            WHERE user_id = ? AND action = 'follow' AND date = ?
            """,
            (user_id, today),
        ).fetchone()

        if existing and existing["count"] >= self.RATE_LIMIT:
            raise HTTPException(status_code=429, detail="rate limit exceeded")

        if existing:
            cursor.execute(
                """
                UPDATE follow_activity_log
                SET count = ?
                WHERE user_id = ? AND action = 'follow' AND date = ?
                """,
                (existing["count"] + 1, user_id, today),
            )
        else:
            cursor.execute(
                """
                INSERT INTO follow_activity_log (user_id, action, date, count)
                VALUES (?, 'follow', ?, 1)
                """,
                (user_id, today),
            )

    def _ensure_profile_stats(self, cursor, user_id: str) -> None:
        cursor.execute(
            """
            INSERT OR IGNORE INTO profile_stats (
                user_id,
                followers_count,
                following_count,
                posts_count,
                points_total,
                level,
                badges_count
            ) VALUES (?, 0, 0, 0, 0, 0, 0)
            """,
            (user_id,),
        )

    def _update_counter(self, cursor, user_id: str, column: str, delta: int) -> None:
        if column not in {"followers_count", "following_count"}:
            raise ValueError("invalid counter column")

        cursor.execute(
            f"""
            UPDATE profile_stats
            SET {column} = MAX(0, {column} + ?),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
            """,
            (delta, user_id),
        )

    def _get_counts(self, cursor, follower_id: str, followee_id: str) -> Tuple[int, int]:
        following_row = cursor.execute(
            "SELECT following_count FROM profile_stats WHERE user_id = ?",
            (follower_id,),
        ).fetchone()
        followers_row = cursor.execute(
            "SELECT followers_count FROM profile_stats WHERE user_id = ?",
            (followee_id,),
        ).fetchone()
        following_count = following_row["following_count"] if following_row else 0
        followers_count = followers_row["followers_count"] if followers_row else 0
        return followers_count, following_count

    def _get_existing_status(self, cursor, follower_id: str, followee_id: str) -> Optional[str]:
        row = cursor.execute(
            """
            SELECT status
            FROM user_follows
            WHERE follower_id = ? AND followee_id = ?
            """,
            (follower_id, followee_id),
        ).fetchone()
        return row["status"] if row else None

    def _build_list_response(self, rows, limit: int):
        items = []
        next_cursor = None

        truncated_rows = rows[:limit]

        for row in truncated_rows:
            created_at = row["created_at"]
            if isinstance(created_at, str):
                created_at_dt = datetime.fromisoformat(created_at.replace(" ", "T"))
            else:
                created_at_dt = datetime.fromtimestamp(created_at)

            items.append(
                {
                    "user_id": row["user_id"],
                    "handle": row["handle"],
                    "avatar_url": row["avatar_url"],
                    "since": created_at_dt,
                }
            )

        if len(rows) > limit and truncated_rows:
            last_row = truncated_rows[-1]
            created_at = last_row["created_at"]
            if isinstance(created_at, str):
                created_at_str = created_at
            else:
                created_at_str = datetime.fromtimestamp(created_at).isoformat()
            cursor_value = f"{created_at_str}|{last_row['user_id']}"
            next_cursor = base64.urlsafe_b64encode(cursor_value.encode("utf-8")).decode("utf-8")

        return items, next_cursor

    def _decode_cursor(self, cursor_value: str) -> Tuple[str, str]:
        try:
            decoded = base64.urlsafe_b64decode(cursor_value.encode("utf-8")).decode("utf-8")
            created_at_str, user_id = decoded.split("|", 1)
            return created_at_str, user_id
        except Exception as exc:
            raise HTTPException(status_code=400, detail="invalid cursor") from exc


# Singleton
follow_service = FollowService()
