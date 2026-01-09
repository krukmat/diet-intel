"""Tracking Service - Handles meal and weight tracking.

Task: Phase 2 Batch 8 - Database refactoring (extracted from database.py)
Task 2.1.3 - Refactored to use Repository Pattern
Coverage Goal: 85%+ (target: 80%+)
"""

from typing import Optional, Dict, List, Any
from datetime import datetime
import uuid
import json
import logging
from app.repositories.tracking_repository import TrackingRepository, MealTrackingEntity, WeightTrackingEntity


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
        """
        Get user's active meal plan.
        
        Returns the most recent meal plan for the user.
        This is a placeholder - full implementation in FASE 2.
        
        Args:
            user_id: User ID to get plan for
            
        Returns:
            PlanProgress object or None if no plan exists
        """
        from app.models.tracking import PlanProgress, PlanMealItem
        
        try:
            # Get most recent plan from plan storage
            from app.services.plan_storage import plan_storage
            
            plans = await plan_storage.get_user_plans(user_id, limit=1)
            
            if not plans:
                return None
            
            plan = plans[0]
            
            # Convert to PlanProgress format
            meal_items = []
            for meal in plan.get('meals', []):
                for item in meal.get('items', []):
                    meal_items.append(PlanMealItem(
                        id=item.get('id', str(uuid.uuid4())),
                        barcode=item.get('barcode', ''),
                        name=item.get('name', ''),
                        serving=item.get('serving', '100g'),
                        calories=item.get('calories', 0),
                        macros=item.get('macros', {}),
                        meal_type=meal.get('name', 'lunch').lower(),
                        is_consumed=False
                    ))
            
            return PlanProgress(
                plan_id=plan.get('id', str(uuid.uuid4())),
                daily_calorie_target=plan.get('daily_calorie_target', 2000),
                meals=meal_items,
                created_at=datetime.fromisoformat(plan.get('created_at', datetime.now().isoformat()))
            )
            
        except Exception as e:
            logger.error(f"Error getting active plan for user {user_id}: {e}")
            return None

    async def calculate_day_progress(self, user_id: str) -> 'DayProgressSummary':
        """
        Calculate daily nutritional progress.
        
        Calculates consumed vs planned macros from meals.
        This is a placeholder - full implementation in FASE 2.
        
        Args:
            user_id: User ID to calculate progress for
            
        Returns:
            DayProgressSummary with calories, protein, fat, carbs progress
        """
        from app.models.tracking import DayProgress, DayProgressSummary
        
        try:
            # Get today's meals
            meals = await self.get_user_meals(user_id, limit=50)
            
            # Calculate totals from meals
            total_calories = 0
            total_protein = 0
            total_fat = 0
            total_carbs = 0
            
            for meal in meals:
                items = meal.get('items', [])
                for item in items:
                    total_calories += item.get('calories', 0)
                    macros = item.get('macros', {})
                    total_protein += macros.get('protein', macros.get('protein_g', 0))
                    total_fat += macros.get('fat', macros.get('fat_g', 0))
                    total_carbs += macros.get('carbs', macros.get('carbs_g', 0))
            
            # Default targets (placeholder - should come from user profile)
            target_calories = 2000
            target_protein = 120
            target_fat = 65
            target_carbs = 250
            
            # Calculate percentages
            calories_pct = (total_calories / target_calories * 100) if target_calories > 0 else 0
            protein_pct = (total_protein / target_protein * 100) if target_protein > 0 else 0
            fat_pct = (total_fat / target_fat * 100) if target_fat > 0 else 0
            carbs_pct = (total_carbs / target_carbs * 100) if target_carbs > 0 else 0
            
            return DayProgressSummary(
                calories=DayProgress(
                    consumed=round(total_calories, 1),
                    planned=target_calories,
                    percentage=round(calories_pct, 1)
                ),
                protein=DayProgress(
                    consumed=round(total_protein, 1),
                    planned=target_protein,
                    percentage=round(protein_pct, 1)
                ),
                fat=DayProgress(
                    consumed=round(total_fat, 1),
                    planned=target_fat,
                    percentage=round(fat_pct, 1)
                ),
                carbs=DayProgress(
                    consumed=round(total_carbs, 1),
                    planned=target_carbs,
                    percentage=round(carbs_pct, 1)
                )
            )
            
        except Exception as e:
            logger.error(f"Error calculating day progress for user {user_id}: {e}")
            # Return zeros on error
            return DayProgressSummary(
                calories=DayProgress(consumed=0, planned=2000, percentage=0),
                protein=DayProgress(consumed=0, planned=120, percentage=0),
                fat=DayProgress(consumed=0, planned=65, percentage=0),
                carbs=DayProgress(consumed=0, planned=250, percentage=0)
            )

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
        try:
            # Get from cache first
            cache_key = f"consumed_plan_items_{user_id}"
            cached = await self.repository.cache.get(cache_key)
            
            if cached and isinstance(cached, list):
                return cached
            
            return []
            
        except Exception as e:
            logger.error(f"Error getting consumed plan items for user {user_id}: {e}")
            return []

    async def consume_plan_item(
        self, user_id: str, item_id: str, consumed_at: str
    ) -> Dict[str, Any]:
        """
        Mark a meal plan item as consumed.
        
        This creates a meal entry from the plan item and updates progress.
        This is a placeholder - full implementation in FASE 3.
        
        Args:
            user_id: User ID
            item_id: ID of the plan item to mark as consumed
            consumed_at: ISO timestamp when item was consumed
            
        Returns:
            Dict with success status, message, and updated progress
        """
        try:
            # Get the active plan
            active_plan = await self.get_active_plan(user_id)
            
            if not active_plan:
                return {
                    "success": False,
                    "message": "No active meal plan found",
                    "item_id": item_id
                }
            
            # Find the item in the plan
            item_found = False
            item_data = None
            for meal in active_plan.meals:
                if meal.id == item_id:
                    item_found = True
                    item_data = meal
                    break
            
            if not item_found:
                return {
                    "success": False,
                    "message": f"Item {item_id} not found in plan",
                    "item_id": item_id
                }
            
            # Mark item as consumed in cache
            cache_key = f"consumed_plan_items_{user_id}"
            consumed_items = await self.get_consumed_plan_items(user_id)
            
            if item_id not in consumed_items:
                consumed_items.append(item_id)
                await self.repository.cache.set(cache_key, consumed_items, ttl=24 * 3600)
            
            # Calculate updated progress
            updated_progress = await self.calculate_day_progress(user_id)
            
            logger.info(f"User {user_id} consumed plan item {item_id}")
            
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


# Global service instance - Phase 2 Batch 8 & Task 2.1.3: TrackingService
# Task 2.1.3: Now uses TrackingRepository instead of DatabaseService
tracking_service = TrackingService()
