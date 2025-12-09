# EPIC_A.A5: Points service for gamification system

from typing import Dict, List, Optional
from app.services.database import db_service
import uuid
from datetime import datetime, date
import logging

from app.config import config

logger = logging.getLogger(__name__)


class PointsService:
    """Service for managing user points and gamification rules"""

    # Default points for social actions (aligned with spec)
    DEFAULT_EARNING_RULES = {
        'post_create': 5,           # Points for creating a post
        'first_post_of_day_bonus': 3,  # Bonus for first post of day
        'like_received': 1,            # Points when someone likes your post
        'comment_made': 2,             # Points for writing a comment
        'follow_gained': 2,            # Points when someone follows you
        'referral_completed': 25,      # Points for successful referral
        'challenge_completed': 15,     # Points for completing a challenge
        'reaction_given': 1,           # Points for giving reactions
        'badge_earned': 3,             # Bonus for earning badges
        'intelligent_flow_complete': 12,  # Points for IA flow completion (overridable)
    }

    # Daily caps for point earning (prevents gaming)
    DAILY_CAPS = {
        'like_received': 20,
        'comment_made': 30,
        'follow_gained': 10,
    }

    # Level thresholds
    LEVEL_THRESHOLDS = {
        1: 0,      # L1: 0-99 points
        2: 100,    # L2: 100-249 points
        3: 250,    # L3: 250-499 points
        4: 500,    # L4: 500-999 points
        5: 1000,   # L5: 1000+ points
    }

    @staticmethod
    def add_points(user_id: str, source: str, metadata: Optional[Dict] = None) -> int:
        """
        Add points to a user for a specific action.

        Args:
            user_id: User to award points to
            source: Activity type (e.g., 'post_create', 'like_received')
            metadata: Optional context data

        Returns:
            Points awarded (0 if capped/duplicate)
        """
        earning_rules = PointsService._get_earning_rules()

        if source not in earning_rules:
            logger.warning(f"Unknown points source: {source}")
            return 0

        base_points = earning_rules[source]

        # Apply daily caps where applicable
        if source in PointsService.DAILY_CAPS:
            if not PointsService._check_daily_cap(user_id, source):
                logger.info(f"Daily cap reached for {source} by user {user_id}")
                return 0

        # Check for duplicates based on event metadata
        if source == 'first_post_of_day_bonus':
            if PointsService._has_first_post_today(user_id):
                return 0

        # Record in ledger and update totals
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                entry_id = str(uuid.uuid4())

                cursor.execute("""
                    INSERT INTO points_ledger (id, user_id, source, points, created_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (entry_id, user_id, source, base_points, datetime.utcnow().isoformat()))

                # Update user level/points total
                old_level, old_points = PointsService._get_current_level_and_points(user_id)

                cursor.execute("""
                    UPDATE user_levels SET
                        points_total = points_total + ?,
                        level = ?,
                        updated_at = ?
                    WHERE user_id = ?
                """, (
                    base_points,
                    PointsService._calculate_level(old_points + base_points),
                    datetime.utcnow().isoformat(),
                    user_id
                ))

                # Ensure user has a level record
                if cursor.rowcount == 0:
                    cursor.execute("""
                        INSERT INTO user_levels (user_id, points_total, level, updated_at)
                        VALUES (?, ?, ?, ?)
                    """, (
                        user_id,
                        base_points,
                        PointsService._calculate_level(base_points),
                        datetime.utcnow().isoformat()
                    ))

                # Insert new record if level changed
                new_level = PointsService._calculate_level(old_points + base_points)
                if new_level > old_level:
                    logger.info(f"User {user_id} leveled up: L{old_level} → L{new_level}")

                    # Send level up notification (EPIC_A.A5 notifications)
                    try:
                        from app.services.notifications.notification_service import NotificationService
                        NotificationService.enqueue_notification(
                            user_id, 'level_up',
                            {'old_level': old_level, 'new_level': new_level, 'leveled_at': datetime.utcnow().isoformat()}
                        )
                    except ImportError:
                        pass

                conn.commit()
                return base_points

        except Exception as e:
            logger.error(f"Failed to add points for user {user_id}, source {source}: {e}")
            return 0

    @staticmethod
    def get_user_points(user_id: str) -> Dict:
        """
        Get comprehensive points info for a user.

        Returns:
            {
                'total_points': int,
                'current_level': int,
                'next_level_threshold': int,
                'points_needed': int,
                'recent_transactions': List[Dict]
            }
        """
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                # Get current level and points
                level, points_total = PointsService._get_current_level_and_points(user_id)
                next_threshold, points_needed = PointsService._get_next_level_info(level, points_total)

                # Get recent transactions (last 10)
                cursor.execute("""
                    SELECT source, points, created_at
                    FROM points_ledger
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT 10
                """, (user_id,))

                transactions = [
                    {
                        'source': row['source'],
                        'points': row['points'],
                        'created_at': row['created_at']
                    }
                    for row in cursor.fetchall()
                ]

                return {
                    'total_points': points_total,
                    'current_level': level,
                    'next_level_threshold': next_threshold,
                    'points_needed': points_needed,
                    'recent_transactions': transactions
                }

        except Exception as e:
            logger.error(f"Failed to get user points for {user_id}: {e}")
            return {
                'total_points': 0,
                'current_level': 1,
                'next_level_threshold': 100,
                'points_needed': 100,
                'recent_transactions': []
            }

    @staticmethod
    def get_leaderboard(limit: int = 100, time_range: str = 'weekly') -> List[Dict]:
        """
        Get leaderboard of top users by points.

        Args:
            limit: Max users to return
            time_range: 'weekly', 'monthly', 'all_time'

        Returns:
            List of user rankings with points_window
        """
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                if time_range == 'weekly':
                    # Calculate points earned in last 7 days
                    days_lookback = 7
                elif time_range == 'monthly':
                    days_lookback = 30
                else:  # all_time
                    days_lookback = None

                if days_lookback:
                    # Get points since N days ago
                    cursor.execute("""
                        SELECT pl.user_id, SUM(pl.points) as points_window, ul.level
                        FROM points_ledger pl
                        LEFT JOIN user_levels ul ON pl.user_id = ul.user_id
                        WHERE pl.created_at >= date('now', '-{} days')
                        GROUP BY pl.user_id
                        ORDER BY points_window DESC, pl.user_id
                        LIMIT ?
                    """.format(days_lookback), (limit,))
                else:
                    # All-time total points
                    cursor.execute("""
                        SELECT user_id, points_total as points_window, level
                        FROM user_levels
                        WHERE points_total > 0
                        ORDER BY points_total DESC, user_id
                        LIMIT ?
                    """, (limit,))

                rows = cursor.fetchall()
                leaderboard = []

                for rank, row in enumerate(rows, 1):
                    leaderboard.append({
                        'rank': rank,
                        'user_id': row['user_id'],
                        'points_window': row['points_window'] or 0,
                        'current_level': row['level'] or 1
                    })

                return leaderboard

        except Exception as e:
            logger.error(f"Failed to get leaderboard: {e}")
            return []

    @staticmethod
    def _get_earning_rules() -> Dict[str, int]:
        """
        Retrieve the effective earning rules, merging defaults with overrides from config.
        """
        overrides = getattr(config, 'gamification_point_rules', {}) or {}
        # Merge without mutating defaults; overrides can add new sources or replace existing ones.
        merged = {**PointsService.DEFAULT_EARNING_RULES, **overrides}

        cleaned: Dict[str, int] = {}
        for source, value in merged.items():
            try:
                cleaned[source] = int(value)
            except (TypeError, ValueError):
                logger.warning("Invalid point value for source '%s': %s", source, value)
        return cleaned

    @staticmethod
    def _check_daily_cap(user_id: str, source: str) -> bool:
        """Check if user is under daily cap for a points source"""
        if source not in PointsService.DAILY_CAPS:
            return True

        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                today = date.today().isoformat()
                cap = PointsService.DAILY_CAPS[source]

                cursor.execute("""
                    SELECT COALESCE(SUM(points), 0) as total_today
                    FROM points_ledger
                    WHERE user_id = ? AND source = ? AND DATE(created_at) = ?
                """, (user_id, source, today))

                row = cursor.fetchone()
                return (row['total_today'] or 0) < cap

        except Exception as e:
            logger.error(f"Error checking daily cap: {e}")
            return True  # Allow on error

    @staticmethod
    def _has_first_post_today(user_id: str) -> bool:
        """Check if user has already received first_post bonus today"""
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                today = date.today().isoformat()

                cursor.execute("""
                    SELECT 1 FROM points_ledger
                    WHERE user_id = ? AND source = 'first_post_of_day_bonus'
                    AND DATE(created_at) = ?
                """, (user_id, today))

                return cursor.fetchone() is not None

        except Exception:
            return False

    @staticmethod
    def _get_current_level_and_points(user_id: str) -> tuple[int, int]:
        """Get user's current level and total points"""
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute(
                    "SELECT level, points_total FROM user_levels WHERE user_id = ?",
                    (user_id,)
                )

                row = cursor.fetchone()
                if row:
                    return row['level'] or 1, row['points_total'] or 0

        except Exception as e:
            logger.error(f"Error getting current level: {e}")

        return (1, 0)

    @staticmethod
    def _calculate_level(points_total: int) -> int:
        """Calculate level based on points"""
        level = 1
        for l, threshold in PointsService.LEVEL_THRESHOLDS.items():
            if points_total >= threshold:
                level = l
        return level

    @staticmethod
    def _get_next_level_info(current_level: int, points_total: int) -> tuple[int, int]:
        """Get next level threshold and points needed"""
        next_level = current_level + 1

        if next_level in PointsService.LEVEL_THRESHOLDS:
            threshold = PointsService.LEVEL_THRESHOLDS[next_level]
            return threshold, max(0, threshold - points_total)

        # Max level reached
        return points_total, 0
