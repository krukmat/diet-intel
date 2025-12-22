"""Vision Service - Handles vision log and correction operations.

This service manages all vision-related functionality including:
- Vision log creation, retrieval, and updates
- Vision correction tracking
- Identified ingredients and portion estimation storage
- Nutritional analysis and exercise suggestion persistence

Task: Phase 2 Batch 5 - Database refactoring (extracted from database.py)
Coverage Goal: 80%+ (currently 5% in database.py)
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import json
import sqlite3
import uuid
from app.services.database import DatabaseService


class VisionService:
    """Service for managing vision log operations and corrections.

    This service encapsulates all vision-related database operations,
    providing a clear separation of concerns from the main DatabaseService.

    Attributes:
        db: DatabaseService instance for database operations
    """

    def __init__(self, db_service: DatabaseService):
        """Initialize VisionService with database dependency.

        Args:
            db_service: DatabaseService instance for database operations
        """
        self.db = db_service

    async def create_vision_log(self, vision_log: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new vision log entry.

        Args:
            vision_log: Dictionary containing vision log data with keys:
                - user_id: User identifier (required)
                - image_url: URL of the analyzed image (optional)
                - meal_type: Type of meal (breakfast, lunch, dinner, etc.)
                - identified_ingredients: List of detected ingredients
                - estimated_portions: Dictionary of portion sizes
                - nutritional_analysis: Nutrition data extracted
                - exercise_suggestions: Recommended exercises
                - confidence_score: Quality score of analysis (0.0-1.0)
                - processing_time_ms: Time taken for analysis
                - created_at: Custom timestamp (optional, defaults to now)
                - id: Custom ID (optional, auto-generated if not provided)

        Returns:
            Dictionary with created vision log including generated ID and timestamp

        Raises:
            KeyError: If required fields (user_id, meal_type) are missing
            ValueError: If data serialization fails
        """
        with self.db.get_connection() as conn:
            self.db._ensure_vision_tables(conn)
            # Respect incoming ID or generate new one
            input_id = vision_log.get("id") or str(uuid.uuid4())
            cursor = conn.cursor()
            identified = self.db._serialize_for_json(vision_log.get('identified_ingredients', [])) or []
            estimated = self.db._serialize_for_json(vision_log.get('estimated_portions', {})) or {}
            nutritional = self.db._serialize_for_json(vision_log.get('nutritional_analysis', {})) or {}
            exercises = self.db._serialize_for_json(vision_log.get('exercise_suggestions', [])) or []
            created_at = vision_log.get('created_at') or datetime.utcnow()
            if isinstance(created_at, datetime):
                created_at_value = created_at.isoformat()
            else:
                created_at_value = created_at
            cursor.execute("""
                INSERT INTO vision_logs (id, user_id, image_url, meal_type, identified_ingredients,
                                       estimated_portions, nutritional_analysis, exercise_suggestions,
                                       confidence_score, processing_time_ms, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (input_id, vision_log['user_id'], vision_log.get('image_url'), vision_log['meal_type'],
                  json.dumps(identified), json.dumps(estimated),
                  json.dumps(nutritional), json.dumps(exercises),
                  vision_log.get('confidence_score', 0.0), vision_log.get('processing_time_ms', 0), created_at_value))
            conn.commit()
            return {**vision_log, 'id': input_id, 'created_at': created_at}

    async def list_vision_logs(self, *, user_id: str, limit: int, offset: int, date_from: Optional[str] = None, date_to: Optional[str] = None) -> Tuple[List[Dict], int]:
        """Get vision logs with pagination and optional date filtering.

        Args:
            user_id: Filter logs by user ID (required)
            limit: Maximum number of logs to return (pagination)
            offset: Number of logs to skip (pagination)
            date_from: Optional start date filter (ISO format string)
            date_to: Optional end date filter (ISO format string)

        Returns:
            Tuple of (list of vision logs, total count of logs matching filter)

        Coverage Notes:
            - Basic retrieval: needs test
            - Date range filtering: needs test
            - Pagination edge cases: needs test
            - JSON parsing errors: needs test
        """
        with self.db.get_connection() as conn:
            self.db._ensure_vision_tables(conn)
            cursor = conn.cursor()

            # Build query with optional date filtering
            query = """
                SELECT * FROM vision_logs WHERE user_id = ?
            """
            params = [user_id]

            if date_from:
                query += " AND created_at >= ?"
                params.append(date_from)
            if date_to:
                query += " AND created_at <= ?"
                params.append(date_to)

            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            # Get total count
            count_query = "SELECT COUNT(*) FROM vision_logs WHERE user_id = ?"
            count_params = [user_id]
            if date_from:
                count_query += " AND created_at >= ?"
                count_params.append(date_from)
            if date_to:
                count_query += " AND created_at <= ?"
                count_params.append(date_to)

            cursor.execute(count_query, count_params)
            total_count = cursor.fetchone()[0]

            cursor.execute(query, params)
            rows = cursor.fetchall()

            logs = []
            for row in rows:
                # Parse JSON fields safely
                try:
                    identified_ingredients = json.loads(row['identified_ingredients']) if row['identified_ingredients'] else []
                except:
                    identified_ingredients = []

                try:
                    estimated_portions = json.loads(row['estimated_portions']) if row['estimated_portions'] else {}
                except:
                    estimated_portions = {}

                try:
                    nutritional_analysis = json.loads(row['nutritional_analysis']) if row['nutritional_analysis'] else {}
                except:
                    nutritional_analysis = {}

                try:
                    exercise_suggestions = json.loads(row['exercise_suggestions']) if row['exercise_suggestions'] else []
                except:
                    exercise_suggestions = []

                logs.append({
                    'id': row['id'],
                    'user_id': row['user_id'],
                    'image_url': row['image_url'],
                    'meal_type': row['meal_type'],
                    'identified_ingredients': identified_ingredients,
                    'estimated_portions': estimated_portions,
                    'nutritional_analysis': nutritional_analysis,
                    'exercise_suggestions': exercise_suggestions,
                    'confidence_score': row['confidence_score'],
                    'processing_time_ms': row['processing_time_ms'],
                    'created_at': datetime.fromisoformat(row['created_at']) if isinstance(row['created_at'], str) else row['created_at']
                })

            return logs, total_count

    async def get_vision_log(self, log_id: str) -> Optional[Dict[str, Any]]:
        """Get a vision log by ID.

        Args:
            log_id: The vision log ID to retrieve

        Returns:
            Dictionary with vision log data if found, None otherwise

        Coverage Notes:
            - Successful retrieval: needs test
            - Non-existent ID (returns None): needs test
            - JSON parsing errors: needs test
        """
        with self.db.get_connection() as conn:
            self.db._ensure_vision_tables(conn)
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM vision_logs WHERE id = ?", (log_id,))
            row = cursor.fetchone()

            if row:
                # Parse JSON fields safely
                try:
                    identified_ingredients = json.loads(row['identified_ingredients']) if row['identified_ingredients'] else []
                except:
                    identified_ingredients = []

                try:
                    estimated_portions = json.loads(row['estimated_portions']) if row['estimated_portions'] else {}
                except:
                    estimated_portions = {}

                try:
                    nutritional_analysis = json.loads(row['nutritional_analysis']) if row['nutritional_analysis'] else {}
                except:
                    nutritional_analysis = {}

                try:
                    exercise_suggestions = json.loads(row['exercise_suggestions']) if row['exercise_suggestions'] else []
                except:
                    exercise_suggestions = []

                return {
                    'id': row['id'],
                    'user_id': row['user_id'],
                    'image_url': row['image_url'],
                    'meal_type': row['meal_type'],
                    'identified_ingredients': identified_ingredients,
                    'estimated_portions': estimated_portions,
                    'nutritional_analysis': nutritional_analysis,
                    'exercise_suggestions': exercise_suggestions,
                    'confidence_score': row['confidence_score'],
                    'processing_time_ms': row['processing_time_ms'],
                    'created_at': datetime.fromisoformat(row['created_at']) if isinstance(row['created_at'], str) else row['created_at']
                }
            return None

    async def create_vision_correction(self, correction: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new vision correction entry.

        Used to track user corrections to vision analysis results,
        helping improve the vision model over time.

        Args:
            correction: Dictionary with correction data:
                - vision_log_id: ID of the vision log being corrected
                - user_id: ID of the user making the correction
                - correction_type: Type of correction (e.g., 'ingredient', 'portion', 'nutrition')
                - original_data: The original data that was incorrect
                - corrected_data: The corrected data
                - improvement_score: Score indicating quality of correction (0.0-1.0)
                - created_at: Timestamp of correction

        Returns:
            Dictionary with created correction including generated ID

        Raises:
            KeyError: If required fields are missing
            ValueError: If data serialization fails
        """
        with self.db.get_connection() as conn:
            self.db._ensure_vision_tables(conn)
            correction_id = str(uuid.uuid4())
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO vision_corrections (id, vision_log_id, user_id, correction_type,
                                               original_data, corrected_data, improvement_score, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (correction_id, correction['vision_log_id'], correction['user_id'], correction['correction_type'],
                  json.dumps(self.db._serialize_for_json(correction.get('original_data', {}))),
                  json.dumps(self.db._serialize_for_json(correction.get('corrected_data', {}))),
                  correction.get('improvement_score', 0.0), correction['created_at']))
            conn.commit()
            return {**correction, 'id': correction_id}
