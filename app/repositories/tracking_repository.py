"""
Tracking Repository for Meal and Weight Tracking CRUD operations
Replaces tracking-related functions from database.py
"""
import logging
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.repositories.base import Repository
from app.repositories.connection import connection_manager

logger = logging.getLogger(__name__)


class MealTrackingEntity:
    """Data class for meal tracking (combines meals + meal_items)"""
    def __init__(self, meal_id: str, user_id: str, meal_name: str, total_calories: float,
                 items: List[Dict[str, Any]], photo_url: Optional[str] = None,
                 timestamp: Optional[datetime] = None, created_at: Optional[datetime] = None):
        self.id = meal_id
        self.user_id = user_id
        self.meal_name = meal_name
        self.total_calories = total_calories
        self.items = items
        self.photo_url = photo_url
        self.timestamp = timestamp or datetime.now()
        self.created_at = created_at or datetime.now()


class WeightTrackingEntity:
    """Data class for weight tracking"""
    def __init__(self, entry_id: str, user_id: str, weight: float,
                 date: datetime, photo_url: Optional[str] = None,
                 created_at: Optional[datetime] = None):
        self.id = entry_id
        self.user_id = user_id
        self.weight = weight
        self.date = date
        self.photo_url = photo_url
        self.created_at = created_at or datetime.now()


class TrackingRepository:
    """
    Repository for meal and weight tracking operations.
    Manages meals, meal_items, and weight_entries tables.
    """

    def __init__(self):
        """Initialize TrackingRepository (uses connection_manager, not db_path)"""
        self.logger = logging.getLogger(self.__class__.__name__)

    # ===== MEAL TRACKING METHODS =====

    async def create_meal(self, meal: MealTrackingEntity) -> MealTrackingEntity:
        """
        Create new meal tracking entry with items.

        Args:
            meal: MealTrackingEntity with meal data and items

        Returns:
            Created MealTrackingEntity with confirmed ID
        """
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()

            try:
                # Convert datetime objects to ISO format strings
                timestamp_str = meal.timestamp.isoformat() if isinstance(meal.timestamp, datetime) else meal.timestamp
                created_at_str = meal.created_at.isoformat() if isinstance(meal.created_at, datetime) else meal.created_at

                # Insert meal record
                cursor.execute(
                    """
                    INSERT INTO meals (id, user_id, meal_name, total_calories, photo_url, timestamp, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        meal.id,
                        meal.user_id,
                        meal.meal_name,
                        meal.total_calories,
                        meal.photo_url,
                        timestamp_str,
                        created_at_str
                    )
                )

                # Insert meal items - Task: Handle both dict and Pydantic MealItem objects
                for item in meal.items:
                    # Handle both dict and Pydantic model
                    if hasattr(item, 'model_dump'):
                        # Pydantic model - convert to dict
                        item_dict = item.model_dump()
                    elif hasattr(item, 'dict'):
                        # Pydantic v1 model
                        item_dict = item.dict()
                    elif isinstance(item, dict):
                        item_dict = item
                    else:
                        # Try to access as object attributes
                        item_dict = {
                            'id': getattr(item, 'id', None),
                            'barcode': getattr(item, 'barcode', None),
                            'name': getattr(item, 'name', None),
                            'serving': getattr(item, 'serving', None),
                            'calories': getattr(item, 'calories', None),
                            'macros': getattr(item, 'macros', {})
                        }

                    macros_data = item_dict.get('macros', {})
                    if hasattr(macros_data, 'model_dump'):
                        macros_dict = macros_data.model_dump()
                    elif hasattr(macros_data, 'dict'):
                        macros_dict = macros_data.dict()
                    elif isinstance(macros_data, dict):
                        macros_dict = macros_data
                    else:
                        macros_dict = {}

                    macros_json = json.dumps(macros_dict)

                    cursor.execute(
                        """
                        INSERT INTO meal_items (id, meal_id, barcode, name, serving, calories, macros)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            item_dict.get('id'),
                            meal.id,
                            item_dict.get('barcode'),
                            item_dict.get('name'),
                            item_dict.get('serving'),
                            item_dict.get('calories'),
                            macros_json
                        )
                    )

                conn.commit()
                self.logger.info(f"Meal created: {meal.id}")
                return meal

            except Exception as e:
                conn.rollback()
                self.logger.error(f"Failed to create meal: {e}")
                raise

    async def get_meal_by_id(self, meal_id: str) -> Optional[MealTrackingEntity]:
        """Get meal with all its items"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()

            # Get meal
            cursor.execute(
                "SELECT id, user_id, meal_name, total_calories, photo_url, timestamp, created_at FROM meals WHERE id = ?",
                (meal_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None

            # Get items and parse macros from JSON string to dict
            cursor.execute(
                "SELECT id, barcode, name, serving, calories, macros FROM meal_items WHERE meal_id = ?",
                (meal_id,)
            )
            items_rows = cursor.fetchall()
            items = []
            for item_row in items_rows:
                item_dict = dict(item_row)
                if isinstance(item_dict.get('macros'), str):
                    try:
                        item_dict['macros'] = json.loads(item_dict['macros'])
                    except (json.JSONDecodeError, TypeError):
                        item_dict['macros'] = {}
                items.append(item_dict)

            return MealTrackingEntity(
                meal_id=row['id'],
                user_id=row['user_id'],
                meal_name=row['meal_name'],
                total_calories=row['total_calories'],
                items=items,
                photo_url=row['photo_url'],
                timestamp=datetime.fromisoformat(row['timestamp']) if row['timestamp'] else None,
                created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else None
            )

    async def get_user_meals(self, user_id: str, limit: int = 50, offset: int = 0) -> List[MealTrackingEntity]:
        """Get all meals for a user with pagination"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT id, user_id, meal_name, total_calories, photo_url, timestamp, created_at
                FROM meals
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
                """,
                (user_id, limit, offset)
            )
            rows = cursor.fetchall()

            meals = []
            for row in rows:
                # Get items for this meal
                cursor.execute(
                    "SELECT id, barcode, name, serving, calories, macros FROM meal_items WHERE meal_id = ?",
                    (row['id'],)
                )
                items_rows = cursor.fetchall()

                # Parse macros from JSON string to dict - Task: Fix JSON deserialization
                items = []
                for item_row in items_rows:
                    item_dict = dict(item_row)
                    if isinstance(item_dict.get('macros'), str):
                        try:
                            item_dict['macros'] = json.loads(item_dict['macros'])
                        except (json.JSONDecodeError, TypeError):
                            item_dict['macros'] = {}
                    items.append(item_dict)

                meal = MealTrackingEntity(
                    meal_id=row['id'],
                    user_id=row['user_id'],
                    meal_name=row['meal_name'],
                    total_calories=row['total_calories'],
                    items=items,
                    photo_url=row['photo_url'],
                    timestamp=datetime.fromisoformat(row['timestamp']) if row['timestamp'] else None,
                    created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else None
                )
                meals.append(meal)

            return meals

    async def delete_meal(self, meal_id: str) -> bool:
        """Delete meal and its items"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()

            try:
                # Delete items first
                cursor.execute("DELETE FROM meal_items WHERE meal_id = ?", (meal_id,))
                # Then delete meal
                cursor.execute("DELETE FROM meals WHERE id = ?", (meal_id,))
                conn.commit()
                self.logger.info(f"Meal deleted: {meal_id}")
                return True
            except Exception as e:
                conn.rollback()
                self.logger.error(f"Failed to delete meal: {e}")
                raise

    # ===== WEIGHT TRACKING METHODS =====

    async def create_weight_entry(self, entry: WeightTrackingEntity) -> WeightTrackingEntity:
        """Create new weight tracking entry"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()

            try:
                # Convert datetime objects to ISO format strings
                date_str = entry.date.isoformat() if isinstance(entry.date, datetime) else entry.date
                created_at_str = entry.created_at.isoformat() if isinstance(entry.created_at, datetime) else entry.created_at

                cursor.execute(
                    """
                    INSERT INTO weight_entries (id, user_id, weight, date, photo_url, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        entry.id,
                        entry.user_id,
                        entry.weight,
                        date_str,
                        entry.photo_url,
                        created_at_str
                    )
                )
                conn.commit()
                self.logger.info(f"Weight entry created: {entry.id}")
                return entry
            except Exception as e:
                conn.rollback()
                self.logger.error(f"Failed to create weight entry: {e}")
                raise

    async def get_weight_entry_by_id(self, entry_id: str) -> Optional[WeightTrackingEntity]:
        """Get weight entry by ID"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, user_id, weight, date, photo_url, created_at FROM weight_entries WHERE id = ?",
                (entry_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None

            return WeightTrackingEntity(
                entry_id=row['id'],
                user_id=row['user_id'],
                weight=row['weight'],
                date=datetime.fromisoformat(row['date']) if row['date'] else datetime.now(),
                photo_url=row['photo_url'],
                created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else None
            )

    async def get_user_weight_entries(self, user_id: str, limit: int = 100, offset: int = 0) -> List[WeightTrackingEntity]:
        """Get all weight entries for a user with pagination"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, user_id, weight, date, photo_url, created_at
                FROM weight_entries
                WHERE user_id = ?
                ORDER BY date DESC
                LIMIT ? OFFSET ?
                """,
                (user_id, limit, offset)
            )
            rows = cursor.fetchall()

            return [
                WeightTrackingEntity(
                    entry_id=row['id'],
                    user_id=row['user_id'],
                    weight=row['weight'],
                    date=datetime.fromisoformat(row['date']) if row['date'] else datetime.now(),
                    photo_url=row['photo_url'],
                    created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else None
                )
                for row in rows
            ]

    async def get_user_weight_history(self, user_id: str, limit: int = 100) -> List[WeightTrackingEntity]:
        """Alias for get_user_weight_entries for backward compatibility - Task: Add missing method"""
        return await self.get_user_weight_entries(user_id, limit)

    async def delete_weight_entry(self, entry_id: str) -> bool:
        """Delete weight entry"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()

            try:
                cursor.execute("DELETE FROM weight_entries WHERE id = ?", (entry_id,))
                conn.commit()
                self.logger.info(f"Weight entry deleted: {entry_id}")
                return True
            except Exception as e:
                conn.rollback()
                self.logger.error(f"Failed to delete weight entry: {e}")
                raise

    # ===== UTILITY METHODS =====

    async def count_user_meals(self, user_id: str) -> int:
        """Count total meals for user"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM meals WHERE user_id = ?", (user_id,))
            return cursor.fetchone()[0]

    async def count_user_weight_entries(self, user_id: str) -> int:
        """Count total weight entries for user"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM weight_entries WHERE user_id = ?", (user_id,))
            return cursor.fetchone()[0]
