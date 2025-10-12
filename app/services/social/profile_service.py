"""
Profile Service - Main business logic for user profiles

Implements EPIC_A.A1 profile viewing and editing functionality.
"""

import logging
import re
from typing import Optional, List

from fastapi import HTTPException

from app.services.database import db_service
from app.models.social import (
    ProfileVisibility,
    ProfileStats,
    PostPreview,
    ProfileDetail,
    ProfileUpdateRequest,
)
from .post_read_service import post_read_service
from .gamification_gateway import gamification_gateway
from .follow_gateway import follow_gateway

logger = logging.getLogger(__name__)


class ProfileService:
    """Main service for profile operations"""

    def __init__(
        self,
        database_service=None,
        post_read_svc=None,
        gamification_gw=None,
        follow_gw=None
    ):
        """Initialize with dependency injection"""
        self.database_service = database_service or db_service
        self.post_read_service = post_read_svc or post_read_service
        self.gamification_gateway = gamification_gw or gamification_gateway
        self.follow_gateway = follow_gw or follow_gateway

    async def ensure_profile_initialized(self, user_id: str, handle: Optional[str] = None) -> None:
        """
        Ensure user has profile and stats records initialized

        Args:
            user_id: User identifier
            handle: Optional custom handle
        """
        # Check if profile exists
        with self.database_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT user_id FROM user_profiles WHERE user_id = ?", (user_id,))
            existing = cursor.fetchone()

        if not existing:
            # Get user details for default handle
            user = await self.database_service.get_user_by_id(user_id)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            # Generate handle from email if not provided
            if not handle:
                email_part = user.email.split('@')[0].lower()
                handle = re.sub(r'[^a-z0-9]', '_', email_part)

            # Insert profile record
            with self.database_service.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO user_profiles (user_id, handle, visibility, created_at, updated_at)
                    VALUES (?, ?, ?, datetime('now'), datetime('now'))
                """, (user_id, handle, ProfileVisibility.PUBLIC.value))

                # Insert stats record
                cursor.execute("""
                    INSERT INTO profile_stats (user_id, created_at, updated_at)
                    VALUES (?, datetime('now'), datetime('now'))
                """, (user_id,))

                conn.commit()

                logger.info(f"Initialized profile for user {user_id} with handle '{handle}'")

    async def get_profile(self, user_id: str, viewer_id: Optional[str]) -> ProfileDetail:
        """
        Get complete profile data with visibility rules

        Args:
            user_id: Profile owner identifier
            viewer_id: Profile viewer identifier (None for anonymous)

        Returns:
            Complete profile data with posts filtered by visibility
        """
        await self.ensure_profile_initialized(user_id)

        # Get profile and stats data
        with self.database_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT
                    p.user_id, p.handle, p.bio, p.avatar_url, p.visibility,
                    s.followers_count, s.following_count, s.posts_count, s.points_total, s.level, s.badges_count
                FROM user_profiles p
                JOIN profile_stats s ON p.user_id = s.user_id
                WHERE p.user_id = ?
            """, (user_id,))

            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Profile not found")

        # Get gamification counters
        gamification_data = self.gamification_gateway.get_profile_counters(user_id)

        # Get posts
        posts = self.post_read_service.list_recent_posts(user_id, limit=10)

        # Determine visibility rules
        viewer_is_owner = viewer_id is not None and viewer_id == user_id

        # TODO: This is stub for A1 - always False
        viewer_is_follower = self.follow_gateway.is_following(viewer_id, user_id) if viewer_id else False

        # Apply visibility filter
        if row['visibility'] == ProfileVisibility.FOLLOWERS_ONLY.value and not (viewer_is_owner or viewer_is_follower):
            posts = []
            posts_notice = "Follow to see posts"
        else:
            posts_notice = None

        # Build stats with gamification data
        stats = ProfileStats(
            followers_count=row['followers_count'] or 0,
            following_count=row['following_count'] or 0,
            posts_count=row['posts_count'] or 0,
            points_total=gamification_data["points_total"],
            level=gamification_data["level"],
            badges_count=gamification_data["badges_count"]
        )

        # Build post previews
        post_previews = []
        for post in posts:
            post_previews.append(PostPreview(
                post_id=post.post_id,
                text=post.text,
                media=post.media,
                created_at=post.created_at,
                counters=post.counters
            ))

        return ProfileDetail(
            user_id=row['user_id'],
            handle=row['handle'],
            bio=row['bio'],
            avatar_url=row['avatar_url'],
            visibility=ProfileVisibility(row['visibility']),
            stats=stats,
            posts=post_previews,
            posts_notice=posts_notice
        )

    @staticmethod
    def validate_handle_format(handle: str) -> bool:
        """Validate handle format according to rules"""
        if not handle:
            return False
        import re
        return bool(re.fullmatch(r'^[a-z0-9_]{3,30}$', handle))

    async def update_profile(self, user_id: str, payload: ProfileUpdateRequest) -> None:
        """
        Update user profile with validation

        Args:
            user_id: User identifier
            payload: Update payload

        Raises:
            HTTPException: For validation errors
        """
        await self.ensure_profile_initialized(user_id)

        # Validate handle if provided
        if payload.handle:
            if not re.fullmatch(r'^[a-z0-9_]{3,30}$', payload.handle):
                raise HTTPException(
                    status_code=422,
                    detail="Handle must be 3-30 characters, alphanumeric with underscores only"
                )

            # Check uniqueness
            with self.database_service.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT COUNT(*) FROM user_profiles WHERE handle = ? AND user_id != ?",
                    (payload.handle, user_id)
                )
                count = cursor.fetchone()[0]
                if count > 0:
                    raise HTTPException(status_code=422, detail="Handle already taken")

        # Validate bio length
        if payload.bio and len(payload.bio) > 280:
            raise HTTPException(status_code=422, detail="Bio too long")

        # Build update query dynamically
        update_fields = []
        values = []

        if payload.handle is not None:
            update_fields.append("handle = ?")
            values.append(payload.handle)

        if payload.bio is not None:
            update_fields.append("bio = ?")
            values.append(payload.bio)

        if payload.avatar_url is not None:
            update_fields.append("avatar_url = ?")
            values.append(payload.avatar_url)

        if payload.visibility is not None:
            update_fields.append("visibility = ?")
            values.append(payload.visibility.value)

        if update_fields:
            update_fields.append("updated_at = datetime('now')")
            values.append(user_id)

            with self.database_service.get_connection() as conn:
                cursor = conn.cursor()
                query = f"UPDATE user_profiles SET {', '.join(update_fields)} WHERE user_id = ?"
                cursor.execute(query, values)
                conn.commit()

                logger.info(f"Updated profile for user {user_id}")


# Singleton instance
profile_service = ProfileService(
    db_service,
    post_read_service,
    gamification_gateway,
    follow_gateway
)
