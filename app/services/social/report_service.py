# EPIC_A.A5: Report service for content moderation

from typing import Dict, Optional
from app.services.database import db_service
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ReportService:
    """Service for content reporting and moderation"""

    VALID_REPORT_REASONS = {
        'spam', 'abuse', 'nsfw', 'misinformation', 'other'
    }

    VALID_TARGET_TYPES = {
        'post', 'comment', 'user'
    }

    @staticmethod
    def create_report(
        reporter_id: str,
        target_type: str,
        target_id: str,
        reason: str,
        additional_context: Optional[str] = None
    ) -> Dict[str, any]:
        """
        Create a content report.

        Args:
            reporter_id: User reporting the content
            target_type: Type of content ('post', 'comment', 'user')
            target_id: ID of the reported content/user
            reason: Reason for report ('spam', 'abuse', etc.)
            additional_context: Optional additional info

        Returns:
            Report details
        """
        if target_type not in ReportService.VALID_TARGET_TYPES:
            raise ValueError(f"Invalid target_type: {target_type}")

        if reason not in ReportService.VALID_REPORT_REASONS:
            raise ValueError(f"Invalid report reason: {reason}")

        # Verify target exists
        if not ReportService._verify_target_exists(target_type, target_id):
            raise ValueError(f"Target {target_type} {target_id} does not exist")

        # Check if user already reported this recently
        if ReportService._has_recent_report(reporter_id, target_type, target_id):
            raise ValueError("You have already reported this content recently")

        report_id = str(uuid.uuid4())

        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO content_reports
                    (id, reporter_id, target_type, target_id, reason, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    report_id,
                    reporter_id,
                    target_type,
                    target_id,
                    reason,
                    datetime.utcnow().isoformat()
                ))
                conn.commit()

            logger.info(f"Report created: {target_type} {target_id} by user {reporter_id}, reason: {reason}")

            return {
                'id': report_id,
                'target_type': target_type,
                'target_id': target_id,
                'reason': reason,
                'created_at': datetime.utcnow().isoformat(),
                'status': 'pending'
            }

        except Exception as e:
            logger.error(f"Failed to create report: {e}")
            raise ValueError(f"Failed to create report: {str(e)}")

    @staticmethod
    def get_reports_for_moderation(
        status: Optional[str] = 'pending',
        limit: int = 50
    ) -> list:
        """
        Get reports for moderation review (admin endpoint).

        Args:
            status: Report status to filter ('pending', 'reviewed', etc.)
            limit: Max reports to return

        Returns:
            List of reports for review
        """
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                query = "SELECT * FROM content_reports"
                params = []

                if status:
                    query += " WHERE status = ?"
                    params.append(status)

                query += " ORDER BY created_at DESC LIMIT ?"
                params.append(limit)

                cursor.execute(query, params)
                rows = cursor.fetchall()

                reports = []
                for row in rows:
                    reports.append({
                        'id': row['id'],
                        'reporter_id': row['reporter_id'],
                        'target_type': row['target_type'],
                        'target_id': row['target_id'],
                        'reason': row['reason'],
                        'created_at': row['created_at'],
                        'status': row['status'],
                        'reviewed_at': row['reviewed_at'],
                        'reviewed_by': row['reviewed_by']
                    })

                return reports

        except Exception as e:
            logger.error(f"Failed to get reports for moderation: {e}")
            return []

    @staticmethod
    def moderate_report(
        report_id: str,
        moderator_id: str,
        action: str,
        notes: Optional[str] = None
    ) -> bool:
        """
        Moderate a content report.

        Args:
            report_id: Report to moderate
            moderator_id: Moderator performing action
            action: Moderation action ('approved', 'dismissed', 'escalated')
            notes: Optional moderation notes

        Returns:
            True if moderated successfully
        """
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                # Update report status
                cursor.execute("""
                    UPDATE content_reports
                    SET status = ?, reviewed_at = ?, reviewed_by = ?
                    WHERE id = ?
                """, (
                    f"moderated_{action}",
                    datetime.utcnow().isoformat(),
                    moderator_id,
                    report_id
                ))

                # TODO: Implement content actions based on moderation decision
                # For now, just log the moderation action

                conn.commit()

                logger.info(f"Report {report_id} moderated by {moderator_id}: {action}")
                return True

        except Exception as e:
            logger.error(f"Failed to moderate report: {e}")
            return False

    @staticmethod
    def get_user_reports(user_id: str, limit: int = 10) -> list:
        """
        Get reports submitted by a user.

        Args:
            user_id: User to get reports for
            limit: Max reports to return

        Returns:
            List of user's submitted reports
        """
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT id, target_type, target_id, reason, status, created_at
                    FROM content_reports
                    WHERE reporter_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                """, (user_id, limit))

                rows = cursor.fetchall()

                reports = []
                for row in rows:
                    reports.append({
                        'id': row['id'],
                        'target_type': row['target_type'],
                        'target_id': row['target_id'],
                        'reason': row['reason'],
                        'status': row['status'],
                        'created_at': row['created_at']
                    })

                return reports

        except Exception as e:
            logger.error(f"Failed to get user reports: {e}")
            return []

    @staticmethod
    def _verify_target_exists(target_type: str, target_id: str) -> bool:
        """Verify that the reported target exists"""
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                if target_type == 'post':
                    cursor.execute("SELECT 1 FROM posts WHERE id = ?", (target_id,))
                elif target_type == 'comment':
                    cursor.execute("SELECT 1 FROM post_comments WHERE id = ?", (target_id,))
                elif target_type == 'user':
                    cursor.execute("SELECT 1 FROM users WHERE id = ?", (target_id,))
                else:
                    return False

                return cursor.fetchone() is not None

        except Exception as e:
            logger.error(f"Error verifying target exists: {e}")
            return False

    @staticmethod
    def _has_recent_report(reporter_id: str, target_type: str, target_id: str) -> bool:
        """
        Check if user recently reported the same content.

        Prevents spam reporting.
        """
        try:
            from datetime import timedelta
            recent_threshold = datetime.utcnow() - timedelta(hours=24)  # 24h cooldown

            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT 1 FROM content_reports
                    WHERE reporter_id = ? AND target_type = ? AND target_id = ?
                    AND created_at > ?
                """, (
                    reporter_id,
                    target_type,
                    target_id,
                    recent_threshold.isoformat()
                ))

                return cursor.fetchone() is not None

        except Exception as e:
            logger.error(f"Error checking recent reports: {e}")
            return False

    @staticmethod
    def get_report_stats() -> Dict:
        """
        Get moderation statistics.

        Returns:
            Stats about reports and moderation activity
        """
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()

                # Get report counts by status
                cursor.execute("""
                    SELECT status, COUNT(*) as count
                    FROM content_reports
                    GROUP BY status
                """)

                report_counts = {row['status']: row['count'] for row in cursor.fetchall()}

                # Get reports by reason
                cursor.execute("""
                    SELECT reason, COUNT(*) as count
                    FROM content_reports
                    GROUP BY reason
                """)

                reason_counts = {row['reason']: row['count'] for row in cursor.fetchall()}

                # Get recent reports (last 24h)
                recent_threshold = datetime.utcnow().isoformat()
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM content_reports
                    WHERE created_at > ?
                """, (recent_threshold,))

                recent_count = cursor.fetchone()['count']

                return {
                    'total_reports': sum(report_counts.values()),
                    'reports_by_status': report_counts,
                    'reports_by_reason': reason_counts,
                    'recent_reports_24h': recent_count
                }

        except Exception as e:
            logger.error(f"Failed to get report stats: {e}")
            return {
                'total_reports': 0,
                'reports_by_status': {},
                'reports_by_reason': {},
                'recent_reports_24h': 0
            }
