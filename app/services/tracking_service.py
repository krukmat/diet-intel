"""Tracking Service - Handles meal and weight tracking.

Task: Phase 2 Batch 8 - Database refactoring (extracted from database.py)
Coverage Goal: 85%+ (target: 80%+)
"""

from typing import Optional, Dict, List, Any
from datetime import datetime
import uuid
import json
import logging
from app.services.database import DatabaseService, db_service


logger = logging.getLogger(__name__)


class TrackingService:
    """Service for managing user meal and weight tracking.

    Handles:
    - Meal creation with items and macros
    - Meal retrieval and history
    - Weight entry creation and tracking
    - Weight history and trends
    - Combined photo logs from meals and weights
    """

    def __init__(self, db_service: DatabaseService):
        """Initialize TrackingService with database dependency.

        Args:
            db_service: DatabaseService instance for database operations

        Task: Phase 2 Batch 8 - Tracking Service Extraction
        """
        self.db = db_service

    # ===== MEAL TRACKING METHODS =====

    async def create_meal(
        self, user_id: str, meal_data: 'MealTrackingRequest', photo_url: Optional[str] = None
    ) -> str:
        """Create a new meal tracking entry with items.

        Args:
            user_id: User ID creating the meal
            meal_data: MealTrackingRequest with items and metadata
            photo_url: Optional photo URL for meal

        Returns:
            Created meal ID (UUID)

        Coverage Goal: Test successful creation, item insertion, JSON serialization

        Task: Phase 2 Batch 8 - Tracking Service Extraction
        """
        from app.models.tracking import MealTrackingRequest

        meal_id = str(uuid.uuid4())

        try:
            # Calculate total calories
            total_calories = sum(item.calories for item in meal_data.items)

            # Parse timestamp
            try:
                timestamp = datetime.fromisoformat(meal_data.timestamp.replace("Z", "+00:00"))
            except ValueError:
                timestamp = datetime.now()

            with self.db.get_connection() as conn:
                cursor = conn.cursor()

                try:
                    # Insert meal record
                    cursor.execute(
                        """
                        INSERT INTO meals (id, user_id, meal_name, total_calories, photo_url, timestamp, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                        (
                            meal_id,
                            user_id,
                            meal_data.meal_name,
                            total_calories,
                            photo_url,
                            timestamp.isoformat(),
                            datetime.now().isoformat(),
                        ),
                    )

                    # Insert meal items (all or nothing)
                    for item in meal_data.items:
                        item_id = str(uuid.uuid4())
                        try:
                            macros_json = json.dumps(item.macros)
                        except (TypeError, ValueError) as json_error:
                            logger.error(f"Failed to serialize macros for item {item.name}: {json_error}")
                            raise RuntimeError(f"Invalid macros data for item {item.name}")

                        cursor.execute(
                            """
                            INSERT INTO meal_items (id, meal_id, barcode, name, serving, calories, macros)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                            (
                                item_id,
                                meal_id,
                                item.barcode,
                                item.name,
                                item.serving,
                                item.calories,
                                macros_json,
                            ),
                        )

                    # Commit the entire transaction
                    conn.commit()

                    logger.info(
                        f"Created meal {meal_id} for user {user_id}: {total_calories} calories with {len(meal_data.items)} items"
                    )
                    return meal_id

                except Exception as db_error:
                    # Rollback entire meal creation on any failure
                    conn.rollback()
                    logger.error(f"Database error creating meal for user {user_id}: {db_error}")
                    raise RuntimeError(f"Failed to create meal: {str(db_error)}")

        except Exception as e:
            logger.error(f"Error in create_meal for user {user_id}: {e}")
            raise RuntimeError(f"Failed to create meal: {str(e)}")

    async def get_meal_by_id(self, meal_id: str) -> Optional[Dict]:
        """Get a meal by ID with all its items.

        Args:
            meal_id: Meal ID to retrieve

        Returns:
            Meal dict with items if found, None otherwise

        Coverage Goal: Test retrieval, JSON parsing, item assembly

        Task: Phase 2 Batch 8 - Tracking Service Extraction
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            # Get meal record
            cursor.execute("SELECT * FROM meals WHERE id = ?", (meal_id,))
            meal_row = cursor.fetchone()

            if not meal_row:
                return None

            # Get meal items
            cursor.execute("SELECT * FROM meal_items WHERE meal_id = ? ORDER BY id", (meal_id,))
            item_rows = cursor.fetchall()

            # Build response
            items = []
            for item_row in item_rows:
                items.append(
                    {
                        "barcode": item_row["barcode"],
                        "name": item_row["name"],
                        "serving": item_row["serving"],
                        "calories": item_row["calories"],
                        "macros": json.loads(item_row["macros"]),
                    }
                )

            return {
                "id": meal_row["id"],
                "meal_name": meal_row["meal_name"],
                "items": items,
                "total_calories": meal_row["total_calories"],
                "photo_url": meal_row["photo_url"],
                "timestamp": datetime.fromisoformat(meal_row["timestamp"]),
                "created_at": datetime.fromisoformat(meal_row["created_at"]),
            }

    async def get_user_meals(self, user_id: str, limit: int = 50) -> List[Dict]:
        """Get user's meal history.

        Args:
            user_id: User ID to retrieve meals for
            limit: Maximum number of meals to return

        Returns:
            List of meal dicts with items

        Coverage Goal: Test pagination, history retrieval, item assembly

        Task: Phase 2 Batch 8 - Tracking Service Extraction
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            # Get meals for user
            cursor.execute(
                """
                SELECT * FROM meals
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """,
                (user_id, limit),
            )
            meal_rows = cursor.fetchall()

            meals = []
            for meal_row in meal_rows:
                # Get items for each meal
                cursor.execute("SELECT * FROM meal_items WHERE meal_id = ?", (meal_row["id"],))
                item_rows = cursor.fetchall()

                items = []
                for item_row in item_rows:
                    items.append(
                        {
                            "barcode": item_row["barcode"],
                            "name": item_row["name"],
                            "serving": item_row["serving"],
                            "calories": item_row["calories"],
                            "macros": json.loads(item_row["macros"]),
                        }
                    )

                meals.append(
                    {
                        "id": meal_row["id"],
                        "meal_name": meal_row["meal_name"],
                        "items": items,
                        "total_calories": meal_row["total_calories"],
                        "photo_url": meal_row["photo_url"],
                        "timestamp": datetime.fromisoformat(meal_row["timestamp"]),
                        "created_at": datetime.fromisoformat(meal_row["created_at"]),
                    }
                )

            return meals

    async def track_meal(
        self,
        user_id: str,
        meal_data: 'MealTrackingRequest | Dict[str, Any]',
        photo_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Persist a meal and return the stored record.

        Args:
            user_id: User ID creating the meal
            meal_data: MealTrackingRequest or dict with meal data
            photo_url: Optional photo URL

        Returns:
            Stored meal dict with items

        Coverage Goal: Test full flow, dict/model handling

        Task: Phase 2 Batch 8 - Tracking Service Extraction
        """
        from app.models.tracking import MealTrackingRequest

        # Normalise payload to model instance
        request_obj = (
            meal_data if isinstance(meal_data, MealTrackingRequest) else MealTrackingRequest(**meal_data)
        )

        meal_id = await self.create_meal(user_id, request_obj, photo_url)
        meal_record = await self.get_meal_by_id(meal_id)

        if meal_record is None:
            raise RuntimeError("Failed to retrieve persisted meal record")

        return meal_record

    # ===== WEIGHT TRACKING METHODS =====

    async def create_weight_entry(
        self, user_id: str, weight_data: 'WeightTrackingRequest', photo_url: Optional[str] = None
    ) -> str:
        """Create a new weight tracking entry.

        Args:
            user_id: User ID creating the weight entry
            weight_data: WeightTrackingRequest with weight and date
            photo_url: Optional photo URL for weight entry

        Returns:
            Created weight entry ID (UUID)

        Coverage Goal: Test successful creation, date parsing

        Task: Phase 2 Batch 8 - Tracking Service Extraction
        """
        from app.models.tracking import WeightTrackingRequest

        weight_id = str(uuid.uuid4())

        # Parse date
        try:
            measurement_date = datetime.fromisoformat(weight_data.date.replace("Z", "+00:00"))
        except ValueError:
            measurement_date = datetime.now()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO weight_entries (id, user_id, weight, date, photo_url, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
                (weight_id, user_id, weight_data.weight, measurement_date.isoformat(), photo_url, datetime.now().isoformat()),
            )
            conn.commit()

        logger.info(f"Created weight entry {weight_id} for user {user_id}: {weight_data.weight} kg")
        return weight_id

    async def get_weight_entry_by_id(self, weight_id: str) -> Optional[Dict]:
        """Get a weight entry by ID.

        Args:
            weight_id: Weight entry ID to retrieve

        Returns:
            Weight entry dict if found, None otherwise

        Coverage Goal: Test retrieval, datetime parsing

        Task: Phase 2 Batch 8 - Tracking Service Extraction
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM weight_entries WHERE id = ?", (weight_id,))
            row = cursor.fetchone()

            if row:
                return {
                    "id": row["id"],
                    "weight": row["weight"],
                    "date": datetime.fromisoformat(row["date"]),
                    "photo_url": row["photo_url"],
                    "created_at": datetime.fromisoformat(row["created_at"]),
                }
            return None

    async def get_user_weight_history(self, user_id: str, limit: int = 30) -> List[Dict]:
        """Get user's weight history.

        Args:
            user_id: User ID to retrieve weight history for
            limit: Maximum number of entries to return

        Returns:
            List of weight entry dicts

        Coverage Goal: Test pagination, history retrieval, date ordering

        Task: Phase 2 Batch 8 - Tracking Service Extraction
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM weight_entries
                WHERE user_id = ?
                ORDER BY date DESC
                LIMIT ?
            """,
                (user_id, limit),
            )
            rows = cursor.fetchall()

            entries = []
            for row in rows:
                entries.append(
                    {
                        "id": row["id"],
                        "weight": row["weight"],
                        "date": datetime.fromisoformat(row["date"]),
                        "photo_url": row["photo_url"],
                        "created_at": datetime.fromisoformat(row["created_at"]),
                    }
                )

            return entries

    async def track_weight(
        self,
        user_id: str,
        weight_data: 'WeightTrackingRequest | Dict[str, Any]',
        photo_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Persist a weight entry and return the stored record.

        Args:
            user_id: User ID creating the weight entry
            weight_data: WeightTrackingRequest or dict with weight data
            photo_url: Optional photo URL

        Returns:
            Stored weight entry dict

        Coverage Goal: Test full flow, dict/model handling

        Task: Phase 2 Batch 8 - Tracking Service Extraction
        """
        from app.models.tracking import WeightTrackingRequest

        request_obj = (
            weight_data if isinstance(weight_data, WeightTrackingRequest) else WeightTrackingRequest(**weight_data)
        )
        weight_id = await self.create_weight_entry(user_id, request_obj, photo_url)
        weight_record = await self.get_weight_entry_by_id(weight_id)

        if weight_record is None:
            raise RuntimeError("Failed to retrieve persisted weight entry")

        return weight_record

    async def get_weight_history(self, user_id: str, limit: int = 30) -> List[Dict]:
        """Wrapper for backward compatibility – forwards to get_user_weight_history.

        Args:
            user_id: User ID to retrieve weight history for
            limit: Maximum number of entries to return

        Returns:
            List of weight entry dicts

        Coverage Goal: Test alias functionality

        Task: Phase 2 Batch 8 - Tracking Service Extraction
        """
        return await self.get_user_weight_history(user_id, limit)

    # ===== PHOTO LOGS =====

    async def get_photo_logs(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Collect combined photo logs from meals and weight entries.

        Args:
            user_id: User ID to retrieve photo logs for
            limit: Maximum number of photo logs to return

        Returns:
            List of photo log entries (meals + weights) sorted by timestamp

        Coverage Goal: Test merging, sorting, filtering

        Task: Phase 2 Batch 8 - Tracking Service Extraction
        """
        logs: List[Dict[str, Any]] = []

        meals = await self.get_user_meals(user_id, limit)
        for meal in meals:
            photo_url = meal.get("photo_url")
            if photo_url:
                logs.append(
                    {
                        "id": meal["id"],
                        "timestamp": meal["created_at"],
                        "photo_url": photo_url,
                        "type": "meal",
                        "description": f"{meal['meal_name']} - {meal['total_calories']:.0f} kcal",
                    }
                )

        weights = await self.get_user_weight_history(user_id, limit)
        for weight in weights:
            photo_url = weight.get("photo_url")
            if photo_url:
                logs.append(
                    {
                        "id": weight["id"],
                        "timestamp": weight["created_at"],
                        "photo_url": photo_url,
                        "type": "weigh-in",
                        "description": f"Weight: {weight['weight']} kg",
                    }
                )

        logs.sort(key=lambda entry: entry["timestamp"], reverse=True)
        return logs[:limit]


# Global service instance - Phase 2 Batch 8: TrackingService
tracking_service = TrackingService(db_service)
