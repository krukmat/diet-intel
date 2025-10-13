# EPIC_A.A5: Badge service for gamification achievements

from typing import List, Dict, Optional
from app.services.database import db_service
import logging

logger = logging.getLogger(__name__)


class BadgeService:
    """Service for managing user badges and achievements"""

    # Badge definitions (starting with M0 core badges)
    BADGE_DEFINITIONS = {
        'starter': {
            'name': 'Starter',
            'description': 'Create your first post',
            'icon': '🌱',
            'rule_type': 'action_count',
            'rule_params': {'source': 'post_create', 'count': 1}
        },
        'conversationalist': {
            'name': 'Conversationalist',
            'description': 'Write 10 comments',
            'icon': '💬',
            'rule_type': 'action_count',
            'rule_params': {'source': 'comment_made', 'count': 10}
        },
        'appreciated': {
            'name': 'Appreciated',
            'description': 'Receive 100 likes on your posts',
            'icon': '💖',
            'rule_type': 'action_received',
            'rule_params': {'source': 'like_received', 'count': 100}
        },
        'connector': {
            'name': 'Connector',
            'description': 'Gain 5 followers',
            'icon': '🤝',
            'rule_type': 'follower_count',
            'rule_params': {'count': 5}
        },
        'ambassador': {
            'name': 'Ambassador',
            'description': 'Complete a successful referral',
            'icon': '👑',
            'rule_type': 'referral_completed',
            'rule_params': {'count': 1}
        },
        'streak_7': {
            'name': 'Week Warrior',
            'description': 'Active for 7 consecutive days',
            'icon': '🔥',
            'rule_type': 'activity_streak',
            'rule_params': {'days': 7}
        },
        'champion': {
            'name': 'Champion',
            'description': 'Win a challenge',
            'icon': '🏆',
            'rule_type': 'challenge_win',
            'rule_params': {'count': 1}
        }
    }

    @staticmethod
    def evaluate_badges(user_id: str, action: str, metadata: Optional[Dict] = None) -> List[str]:
        """
        Evaluate user eligibility for badges after an action.

        Args:
            user_id: User to evaluate
            action: Action performed (e.g., 'post_create', 'like_received')
            metadata: Additional context

        Returns:
            List of badge codes newly earned
        """
        earned_badges = []

        for badge_code, badge_def in BadgeService.BADGE_DEFINITIONS.items():
            if BadgeService._is_badge_earned(user_id, badge_code):
                continue  # Already earned

            if BadgeService._check_badge_eligibility(user_id, badge_code, action, metadata):
                # Award the badge
                if BadgeService._award_badge(user_id, badge_code):
                    earned_badges.append(badge_code)
                    logger.info(f"User {user_id} earned badge: {badge_code}")

        return earned_badges

    @staticmethod
    def get_user_badges(user_id: str) -> List[Dict]:
        """
        Get all badges earned by a user.

        Returns:
            List of badge details with definitions
        """
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT badge_code, earned_at
                    FROM user_badges
                    WHERE user_id = ?
                    ORDER BY earned_at ASC
                """, (user_id,))

                user_badges = []
                for row in cursor.fetchall():
                    badge_code = row['badge_code']
                    if badge_code in BadgeService.BADGE_DEFINITIONS:
                        badge_def = BadgeService.BADGE_DEFINITIONS[badge_code]
                        user_badges.append({
                            'code': badge_code,
                            'name': badge_def['name'],
                            'description': badge_def['description'],
                            'icon': badge_def['icon'],
                            'earned_at': row['earned_at']
                        })

                return user_badges

        except Exception as e:
            logger.error(f"Failed to get user badges for {user_id}: {e}")
            return []

    @staticmethod
    def get_badge_definitions() -> Dict:
        """Get all badge definitions"""
        return BadgeService.BADGE_DEFINITIONS.copy()

    @staticmethod
    def _is_badge_earned(user_id: str, badge_code: str) -> bool:
        """Check if user has already earned a badge"""
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute(
                    "SELECT 1 FROM user_badges WHERE user_id = ? AND badge_code = ?",
                    (user_id, badge_code)
                )

                return cursor.fetchone() is not None

        except Exception as e:
            logger.error(f"Error checking badge status: {e}")
            return False

    @staticmethod
    def _check_badge_eligibility(user_id: str, badge_code: str, action: str, metadata: Optional[Dict]) -> bool:
        """Check if user is eligible for a badge"""
        try:
            badge_def = BadgeService.BADGE_DEFINITIONS.get(badge_code)
            if not badge_def:
                return False

            rule_type = badge_def['rule_type']
            rule_params = badge_def['rule_params']

            return BadgeService._evaluate_rule(user_id, rule_type, rule_params, action, metadata)

        except Exception as e:
            logger.error(f"Error evaluating badge {badge_code}: {e}")
            return False

    @staticmethod
    def _evaluate_rule(user_id: str, rule_type: str, rule_params: Dict, action: str, metadata: Optional[Dict]) -> bool:
        """Evaluate if a user meets badge rules"""
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                if rule_type == 'action_count':
                    # Check total count of actions
                    source = rule_params['source']
                    required_count = rule_params['count']

                    cursor.execute("""
                        SELECT COUNT(*) as total
                        FROM points_ledger
                        WHERE user_id = ? AND source = ?
                    """, (user_id, source))

                    row = cursor.fetchone()
                    return row and row['total'] >= required_count

                elif rule_type == 'action_received':
                    # Check actions received (stored in ledger)
                    source = rule_params['source']
                    required_count = rule_params['count']

                    cursor.execute("""
                        SELECT COUNT(*) as total
                        FROM points_ledger
                        WHERE user_id = ? AND source = ?
                    """, (user_id, source))

                    row = cursor.fetchone()
                    return row and row['total'] >= required_count

                elif rule_type == 'follower_count':
                    # Check follower count
                    required_count = rule_params['count']

                    # Note: Requires updating profile stats when follows change
                    cursor.execute("""
                        SELECT followers_count
                        FROM profile_stats
                        WHERE user_id = ?
                    """, (user_id,))

                    row = cursor.fetchone()
                    return row and row['followers_count'] >= required_count

                elif rule_type == 'referral_completed':
                    # Check successful referrals
                    required_count = rule_params['count']

                    cursor.execute("""
                        SELECT COUNT(*) as total
                        FROM points_ledger
                        WHERE user_id = ? AND source = 'referral_completed'
                    """, (user_id,))

                    row = cursor.fetchone()
                    return row and row['total'] >= required_count

                elif rule_type == 'activity_streak':
                    # Check consecutive activity days (simplified version)
                    days = rule_params.get('days', 7)

                    # This is a simplified version - real implementation would need more complex logic
                    # For now, just check if user has posted in last N days
                    cursor.execute("""
                        SELECT COUNT(DISTINCT DATE(created_at)) as active_days
                        FROM points_ledger
                        WHERE user_id = ? AND created_at >= date('now', '-{} days')
                    """.format(days), (user_id,))

                    row = cursor.fetchone()
                    # This is a loose check - real streak logic would be more complex
                    return row and row['active_days'] > 0  # Placeholder for streak logic

                elif rule_type == 'challenge_win':
                    # Check challenge completions
                    required_count = rule_params['count']

                    cursor.execute("""
                        SELECT COUNT(*) as total
                        FROM points_ledger
                        WHERE user_id = ? AND source = 'challenge_completed'
                    """, (user_id,))

                    row = cursor.fetchone()
                    return row and row['total'] >= required_count

                return False

        except Exception as e:
            logger.error(f"Error evaluating {rule_type} rule: {e}")
            return False

    @staticmethod
    def _award_badge(user_id: str, badge_code: str) -> bool:
        """Award a badge to a user"""
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                # Check if already awarded (double-check)
                cursor.execute(
                    "SELECT 1 FROM user_badges WHERE user_id = ? AND badge_code = ?",
                    (user_id, badge_code)
                )

                if cursor.fetchone():
                    return False  # Already awarded

                # Award badge
                from datetime import datetime
                cursor.execute("""
                    INSERT INTO user_badges (user_id, badge_code, earned_at)
                    VALUES (?, ?, ?)
                """, (user_id, badge_code, datetime.utcnow().isoformat()))

                # Award points for badge ( EPIC_A.A5 - 10 points for earning badge)
                try:
                    from app.services.gamification.points_service import PointsService
                    PointsService.add_points(user_id, 'badge_earned')
                except ImportError:
                    pass  # Optional if gamification not active

                # TODO: Send badge notification (EPIC_A.A5 notifications)

                conn.commit()
                return True

        except Exception as e:
            logger.error(f"Failed to award badge {badge_code} to {user_id}: {e}")
            return False

    @staticmethod
    def recalculate_user_badges(user_id: str) -> List[str]:
        """
        Recalculate all badges for a user (useful for backfilling).

        Returns:
            List of badge codes newly awarded
        """
        earned_badges = []

        for badge_code in BadgeService.BADGE_DEFINITIONS.keys():
            if BadgeService._is_badge_earned(user_id, badge_code):
                continue  # Already earned

            if BadgeService._check_badge_eligibility(user_id, badge_code, '', None):
                if BadgeService._award_badge(user_id, badge_code):
                    earned_badges.append(badge_code)

        return earned_badges
