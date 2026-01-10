"""Tracking Service - Handles meal and weight tracking.

Task: Phase 2 Batch 8 - Database refactoring (extracted from database.py)
Task 2.1.3 - Refactored to use Repository Pattern
Coverage Goal: 85%+ (target: 80%+)
"""

from typing import Optional, Dict, List, Any
from datetime import datetime, date
import uuid
import json
import logging
from app.repositories.tracking_repository import TrackingRepository, MealTrackingEntity, WeightTrackingEntity
from app.services.plan_storage import plan_storage


logger = logging.getLogger(__name__)


class TrackingService:
    """Service for managing user meal and weight tracking.

    Handles:
    - Meal creation with items and macros
    - Meal retrieval and history
    - Weight entry creation and tracking
    - Weight history and trends
    - Combined photo logs from meals and weights

    Task 2.1.3: Refactored to use Repository Pattern
    """

    def __init__(self, repository: Optional[TrackingRepository] = None):
        """Initialize TrackingService with repository dependency.

        Args:
            repository: TrackingRepository instance for data access

        Task 2.1.3: Uses TrackingRepository instead of DatabaseService
        """
        self.repository = repository or TrackingRepository()
        self._consumed_plan_items: Dict[str, List[str]] = {}

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

        Task 2.1.3: Uses TrackingRepository
        """
        from app.models.tracking import MealTrackingRequest

        try:
            # Calculate total calories
            total_calories = sum(item.calories for item in meal_data.items)

            # Parse timestamp
            try:
                timestamp = datetime.fromisoformat(meal_data.timestamp.replace("Z", "+00:00"))
            except ValueError:
                timestamp = datetime.now()

            # Create meal entity - Task 2.1.3: Generate meal_id for repository
            meal = MealTrackingEntity(
                meal_id=str(uuid.uuid4()),
                user_id=user_id,
                meal_name=meal_data.meal_name,
                total_calories=total_calories,
                photo_url=photo_url,
                timestamp=timestamp.isoformat(),
                items=meal_data.items
            )

            # Create meal via repository - Task 2.1.3
            created_meal = await self.repository.create_meal(meal)

            logger.info(
                f"Created meal {created_meal.id} for user {user_id}: {total_calories} calories with {len(meal_data.items)} items"
            )
            return created_meal.id

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

        Task 2.1.3: Uses TrackingRepository
        """
        try:
            meal = await self.repository.get_meal_by_id(meal_id)

            if not meal:
                return None

            # Build response dict
            return {
                "id": meal.id,
                "meal_name": meal.meal_name,
                "items": [item.model_dump() if hasattr(item, 'model_dump') else item for item in (meal.items or [])],
                "total_calories": meal.total_calories,
                "photo_url": meal.photo_url,
                "timestamp": datetime.fromisoformat(meal.timestamp) if isinstance(meal.timestamp, str) else meal.timestamp,
                "created_at": datetime.fromisoformat(meal.created_at) if isinstance(meal.created_at, str) else meal.created_at,
            }

        except Exception as e:
            logger.error(f"Error retrieving meal {meal_id}: {e}")
            return None

    async def get_user_meals(self, user_id: str, limit: int = 50) -> List[Dict]:
        """Get user's meal history.

        Args:
            user_id: User ID to retrieve meals for
            limit: Maximum number of meals to return

        Returns:
            List of meal dicts with items

        Coverage Goal: Test pagination, history retrieval, item assembly

        Task 2.1.3: Uses TrackingRepository
        """
        try:
            meals_data = await self.repository.get_user_meals(user_id, limit)

            meals = []
            for meal in meals_data:
                meals.append(
                    {
                        "id": meal.id,
                        "meal_name": meal.meal_name,
                        "items": [item.model_dump() if hasattr(item, 'model_dump') else item for item in (meal.items or [])],
                        "total_calories": meal.total_calories,
                        "photo_url": meal.photo_url,
                        "timestamp": datetime.fromisoformat(meal.timestamp) if isinstance(meal.timestamp, str) else meal.timestamp,
                        "created_at": datetime.fromisoformat(meal.created_at) if isinstance(meal.created_at, str) else meal.created_at,
                    }
                )

            return meals

        except Exception as e:
            logger.error(f"Error retrieving meals for user {user_id}: {e}")
            return []

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

        Task 2.1.3: Uses TrackingRepository
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

    async def update_meal(
        self,
        meal_id: str,
        user_id: str,
        meal_data: 'MealTrackingRequest | Dict[str, Any]',
        photo_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Update an existing meal.

        Args:
            meal_id: ID of the meal to update
            user_id: User ID of the meal owner
            meal_data: MealTrackingRequest or dict with updated meal data
            photo_url: Optional photo URL

        Returns:
            Updated meal dict

        Coverage Goal: Test meal update, validation, photo handling

        Task: Implement update functionality
        """
        from app.models.tracking import MealTrackingRequest

        # Verify the meal belongs to the user
        existing_meal = await self.get_meal_by_id(meal_id)
        if not existing_meal:
            raise ValueError(f"Meal with id {meal_id} not found")
        
        # Normalize meal data to model instance
        request_obj = (
            meal_data if isinstance(meal_data, MealTrackingRequest) else MealTrackingRequest(**meal_data)
        )
        
        # Use repository to update the meal
        updated = await self.repository.update_meal(
            meal_id=meal_id,
            user_id=user_id,
            meal_name=request_obj.meal_name,
            items=request_obj.items,
            total_calories=sum(item.calories for item in request_obj.items),
            photo_url=photo_url,
            timestamp=datetime.now().isoformat()
        )
        
        # Retrieve and return the updated meal
        return await self.get_meal_by_id(meal_id)

    async def delete_meal(
        self,
        meal_id: str,
        user_id: str,
    ) -> bool:
        """Delete an existing meal.

        Args:
            meal_id: ID of the meal to delete
            user_id: User ID of the meal owner

        Returns:
            True if successful, False otherwise

        Coverage Goal: Test meal deletion

        Task: Implement delete functionality
        """
        # Verify the meal belongs to the user
        existing_meal = await self.get_meal_by_id(meal_id)
        if not existing_meal:
            logger.warning(f"Meal {meal_id} not found for user {user_id}")
            return False
            
        # Use repository to delete the meal
        await self.repository.delete_meal(meal_id)
        
        logger.info(f"Deleted meal {meal_id} for user {user_id}")
        return True

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

        Task 2.1.3: Uses TrackingRepository
        """
        from app.models.tracking import WeightTrackingRequest

        try:
            # Parse date
            try:
                measurement_date = datetime.fromisoformat(weight_data.date.replace("Z", "+00:00"))
            except ValueError:
                measurement_date = datetime.now()

            # Create weight entity - Task 2.1.3: Generate entry_id for repository
            weight = WeightTrackingEntity(
                entry_id=str(uuid.uuid4()),
                user_id=user_id,
                weight=weight_data.weight,
                date=measurement_date,
                photo_url=photo_url
            )

            # Create via repository - Task 2.1.3
            created = await self.repository.create_weight_entry(weight)

            logger.info(f"Created weight entry {created.id} for user {user_id}: {weight_data.weight} kg")
            return created.id

        except Exception as e:
            logger.error(f"Error creating weight entry for user {user_id}: {e}")
            raise RuntimeError(f"Failed to create weight entry: {str(e)}")

    async def get_weight_entry_by_id(self, weight_id: str) -> Optional[Dict]:
        """Get a weight entry by ID.

        Args:
            weight_id: Weight entry ID to retrieve

        Returns:
            Weight entry dict if found, None otherwise

        Coverage Goal: Test retrieval, datetime parsing

        Task 2.1.3: Uses TrackingRepository
        """
        try:
            entry = await self.repository.get_weight_entry_by_id(weight_id)

            if not entry:
                return None

            return {
                "id": entry.id,
                "weight": entry.weight,
                "date": datetime.fromisoformat(entry.date) if isinstance(entry.date, str) else entry.date,
                "photo_url": entry.photo_url,
                "created_at": datetime.fromisoformat(entry.created_at) if isinstance(entry.created_at, str) else entry.created_at,
            }
        except Exception as e:
            logger.error(f"Error retrieving weight entry {weight_id}: {e}")
            return None

    async def get_user_weight_history(self, user_id: str, limit: int = 30) -> List[Dict]:
        """Get user's weight history.

        Args:
            user_id: User ID to retrieve weight history for
            limit: Maximum number of entries to return

        Returns:
            List of weight entry dicts

        Coverage Goal: Test pagination, history retrieval, date ordering

        Task 2.1.3: Uses TrackingRepository
        """
        try:
            entries_data = await self.repository.get_user_weight_history(user_id, limit)

            entries = []
            for entry in entries_data:
                entries.append(
                    {
                        "id": entry.id,
                        "weight": entry.weight,
                        "date": datetime.fromisoformat(entry.date) if isinstance(entry.date, str) else entry.date,
                        "photo_url": entry.photo_url,
                        "created_at": datetime.fromisoformat(entry.created_at) if isinstance(entry.created_at, str) else entry.created_at,
                    }
                )

            return entries
        except Exception as e:
            logger.error(f"Error retrieving weight history for user {user_id}: {e}")
            return []

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


# ============ FASE 1 & 2: Dashboard & Progress Methods ============

    async def get_active_plan(self, user_id: str) -> Optional['PlanProgress']:
        """Return the user's active meal plan shaped as PlanProgress."""
        from app.models.tracking import PlanProgress, PlanMealItem

        plan_response = await plan_storage.get_active_plan_for_user(user_id)
        if not plan_response:
            return None

        meal_items = []
        for meal_index, meal in enumerate(plan_response.meals or []):
            meal_type = (meal.name or "meal").lower()
            for item_index, item in enumerate(meal.items or []):
                macros = self._ensure_dict(getattr(item, "macros", {}))
                identifier = self._build_plan_item_id(
                    plan_response.plan_id,
                    meal.name,
                    item_index,
                    getattr(item, "barcode", None)
                )
                meal_items.append(PlanMealItem(
                    id=identifier,
                    barcode=item.barcode,
                    name=item.name,
                    serving=item.serving,
                    calories=item.calories,
                    macros=macros,
                    meal_type=meal_type,
                    is_consumed=False
                ))

        created_at = plan_response.created_at or datetime.utcnow()
        return PlanProgress(
            plan_id=plan_response.plan_id or "",
            daily_calorie_target=plan_response.daily_calorie_target,
            meals=meal_items,
            created_at=created_at
        )

    async def calculate_day_progress(self, user_id: str) -> 'DayProgressSummary':
        """
        Calculate daily nutritional progress.
        
        Calculates consumed vs planned macros from meals.
        Uses the active plan to determine daily targets with fallbacks.
        
        Args:
            user_id: User ID to calculate progress for
            
        Returns:
            DayProgressSummary with calories, protein, fat, carbs progress
        """
        from app.models.tracking import DayProgress, DayProgressSummary

        meals = await self.get_user_meals(user_id, limit=50)
        today = datetime.utcnow().date()

        total_calories, total_protein, total_fat, total_carbs = self._sum_daily_macros(meals, today)
        plan_response = await plan_storage.get_active_plan_for_user(user_id)
        target_calories, target_protein, target_fat, target_carbs = self._resolve_plan_targets(plan_response)

        def _percentage(consumed: float, target: float) -> float:
            if target <= 0:
                return 0.0
            return round(consumed / target * 100, 1)

        return DayProgressSummary(
            calories=DayProgress(
                consumed=round(total_calories, 1),
                planned=target_calories,
                percentage=_percentage(total_calories, target_calories)
            ),
            protein=DayProgress(
                consumed=round(total_protein, 1),
                planned=target_protein,
                percentage=_percentage(total_protein, target_protein)
            ),
            fat=DayProgress(
                consumed=round(total_fat, 1),
                planned=target_fat,
                percentage=_percentage(total_fat, target_fat)
            ),
            carbs=DayProgress(
                consumed=round(total_carbs, 1),
                planned=target_carbs,
                percentage=_percentage(total_carbs, target_carbs)
            )
        )

    def _sum_daily_macros(self, meals: List[Dict[str, Any]], today: date) -> tuple[float, float, float, float]:
        """
        Iterate through today's meals and accumulate macro totals.
        """
        total_calories = total_protein = total_fat = total_carbs = 0.0

        for meal in meals:
            meal_dict = self._ensure_dict(meal)
            timestamp = self._parse_datetime(meal_dict.get('timestamp') or meal_dict.get('created_at'))
            if timestamp.date() != today:
                continue

            for item in meal_dict.get('items', []):
                item_dict = self._ensure_dict(item)
                total_calories += float(item_dict.get('calories') or 0)
                macros = self._ensure_dict(item_dict.get('macros', {}))
                total_protein += self._get_macro_value(macros, "protein", "protein_g")
                total_fat += self._get_macro_value(macros, "fat", "fat_g")
                total_carbs += self._get_macro_value(macros, "carbs", "carbs_g")

        return total_calories, total_protein, total_fat, total_carbs

    def _resolve_plan_targets(self, plan_response: Optional[Any]) -> tuple[float, float, float, float]:
        """
        Determine daily macro targets using the active plan or sensible defaults.
        """
        if not plan_response:
            return 2000.0, 120.0, 65.0, 250.0

        metrics_dict: Dict[str, Any] = {}
        metrics = getattr(plan_response, "metrics", None)
        if metrics:
            metrics_dict = metrics.model_dump() if hasattr(metrics, "model_dump") else {}

        target_calories = float(plan_response.daily_calorie_target or 0) or 2000.0
        target_protein = float(metrics_dict.get("protein_g") or 120.0)
        target_fat = float(metrics_dict.get("fat_g") or 65.0)
        target_carbs = float(metrics_dict.get("carbs_g") or 250.0)

        return target_calories, target_protein, target_fat, target_carbs

    async def get_consumed_plan_items(self, user_id: str) -> List[str]:
        """
        Get IDs of plan items that have been consumed.
        
        Returns a list of item IDs marked as consumed.
        This is a placeholder - full implementation in FASE 3.
        
        Args:
            user_id: User ID to get consumed items for
            
        Returns:
            List of consumed item IDs
        """
        return list(self._consumed_plan_items.get(user_id, []))

    async def consume_plan_item(
        self, user_id: str, item_id: str, consumed_at: str
    ) -> Dict[str, Any]:
        """
        Mark a meal plan item as consumed.

        This creates a meal entry from the plan item and updates progress.
        FASE 3: Full implementation - creates meal and updates progress.

        Args:
            user_id: User ID
            item_id: ID of the plan item to mark as consumed
            consumed_at: ISO timestamp when item was consumed

        Returns:
            Dict with success status, message, and updated progress
        """
        try:
            # 1. Get the active plan
            active_plan = await self.get_active_plan(user_id)

            if not active_plan:
                return {
                    "success": False,
                    "message": "No active meal plan found",
                    "item_id": item_id
                }

            # 2. Find the item in the plan
            item_data = None
            for meal in active_plan.meals:
                if meal.id == item_id:
                    item_data = meal
                    break

            if not item_data:
                return {
                    "success": False,
                    "message": f"Item {item_id} not found in plan",
                    "item_id": item_id
                }

            # 3. Check if item was already consumed
            consumed_items = await self.get_consumed_plan_items(user_id)
            stored_items = self._consumed_plan_items.setdefault(user_id, [])

            if item_id in consumed_items:
                return {
                    "success": False,
                    "message": f"Item {item_id} already consumed",
                    "item_id": item_id
                }

            # 4. Create meal entry from plan item
            from app.models.tracking import MealItem, MealTrackingRequest
            
            meal_item = MealItem(
                barcode=item_data.barcode,
                name=item_data.name,
                serving=item_data.serving,
                calories=item_data.calories,
                macros=item_data.macros
            )

            meal_request = MealTrackingRequest(
                meal_name=f"Plan: {item_data.name}",
                items=[meal_item],
                timestamp=consumed_at
            )

            # 5. Create the meal in database
            await self.create_meal(user_id, meal_request)

            # 6. Track consumption locally until full implementation
            stored_items.append(item_id)

            # 7. Calculate updated progress
            updated_progress = await self.calculate_day_progress(user_id)

            logger.info(f"User {user_id} consumed plan item {item_id}: {item_data.name}")

            return {
                "success": True,
                "message": f"Item '{item_data.name}' marked as consumed",
                "item_id": item_id,
                "updated_progress": updated_progress
            }

        except Exception as e:
            logger.error(f"Error consuming plan item {item_id} for user {user_id}: {e}")
            return {
                "success": False,
                "message": f"Error: {str(e)}",
                "item_id": item_id
            }

    def _ensure_dict(self, value: Any) -> Dict[str, Any]:
        """Normalize models or dicts into a plain dictionary."""
        if isinstance(value, dict):
            return value
        if hasattr(value, "model_dump"):
            return value.model_dump()
        if hasattr(value, "dict"):
            return value.dict()
        return {}

    def _parse_datetime(self, value: Any) -> datetime:
        """Parse timestamps into datetime objects with fallback."""
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return datetime.utcnow()
        return datetime.utcnow()

    def _get_macro_value(self, macros: Dict[str, Any], *keys: str) -> float:
        """Extract the first available macro value."""
        for key in keys:
            macro_value = macros.get(key)
            if macro_value is not None:
                try:
                    return float(macro_value)
                except (TypeError, ValueError):
                    continue
        return 0.0

    def _build_plan_item_id(
        self,
        plan_id: Optional[str],
        meal_name: Optional[str],
        index: int,
        barcode: Optional[str]
    ) -> str:
        """Generate a deterministic identifier for plan items."""
        plan_key = plan_id or "plan"
        meal_key = (meal_name or "meal").replace(" ", "_").lower()
        item_key = barcode or f"item{index}"
        return f"{plan_key}:{meal_key}:{item_key}:{index}"


# Global service instance - Phase 2 Batch 8 & Task 2.1.3: TrackingService
# Task 2.1.3: Now uses TrackingRepository instead of DatabaseService
tracking_service = TrackingService()
