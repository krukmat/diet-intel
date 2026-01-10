import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from app.models.meal_plan import MealPlanResponse
from app.services.cache import cache_service
from app.services.database import db_service
from app.repositories.meal_plan_repository import MealPlanRepository, MealPlan
import uuid

logger = logging.getLogger(__name__)


class PlanStorageService:
    """
    Service for storing and retrieving meal plans.
    Uses MealPlanRepository as the storage backend with Redis caching for performance.
    Task 2.1.2: Refactored to use Repository Pattern
    """

    def __init__(self, repository: Optional[MealPlanRepository] = None, default_ttl_hours: int = 24):
        self.repository = repository or MealPlanRepository()
        self.default_ttl_hours = default_ttl_hours
        self.plan_prefix = "meal_plan:"
    
    def _entity_to_response(self, entity: MealPlan) -> MealPlanResponse:
        plan = MealPlanResponse(**entity.plan_data)
        plan.plan_id = entity.id
        plan.is_active = bool(entity.is_active)
        return plan
    
    async def store_plan(self, plan: MealPlanResponse, plan_id: Optional[str] = None, user_id: str = "anonymous", activate: bool = False) -> str:
        """
        Store a meal plan with a unique ID using MealPlanRepository.
        Task 2.1.2: Uses Repository Pattern

        Args:
            plan: The meal plan to store
            plan_id: Optional specific ID to use, otherwise generates UUID
            user_id: User ID for associating the plan (defaults to anonymous)

        Returns:
            The plan ID used for storage
        """
        try:
            actual_plan_id = plan_id or str(uuid.uuid4())

            if activate:
                await self.repository.deactivate_plans_for_user(user_id)

            plan.is_active = bool(activate)

            meal_plan = MealPlan(
                id=actual_plan_id,
                user_id=user_id,
                plan_data=plan.model_dump(),
                bmr=plan.bmr,
                tdee=plan.tdee,
                daily_calorie_target=plan.daily_calorie_target,
                is_active=bool(plan.is_active)
            )

            created_plan = await self.repository.create(meal_plan)

            cache_key = f"{self.plan_prefix}{actual_plan_id}"
            plan_data = plan.model_dump()
            plan_data["_storage_metadata"] = {
                "stored_at": datetime.now().isoformat(),
                "plan_id": actual_plan_id,
                "version": 1
            }
            plan_data["is_active"] = int(plan.is_active)

            try:
                await cache_service.set(cache_key, plan_data, ttl=self.default_ttl_hours * 3600)
            except Exception as cache_error:
                logger.warning(f"Failed to cache plan {actual_plan_id}: {cache_error}")

            logger.info(f"Stored meal plan with ID: {actual_plan_id}")
            return actual_plan_id

        except Exception as e:
            logger.error(f"Failed to store meal plan: {e}")
            raise RuntimeError(f"Failed to store meal plan: {str(e)}")
    
    async def get_plan(self, plan_id: str) -> Optional[MealPlanResponse]:
        """
        Retrieve a meal plan by ID from cache or repository.
        Task 2.1.2: Uses MealPlanRepository

        Args:
            plan_id: The plan ID to retrieve

        Returns:
            The meal plan or None if not found
        """
        # Try cache first - Task 2.1.2
        cache_key = f"{self.plan_prefix}{plan_id}"
        try:
            cached_data = await cache_service.get(cache_key)
            if cached_data:
                if "_storage_metadata" in cached_data:
                    del cached_data["_storage_metadata"]
                plan = MealPlanResponse(**cached_data)
                plan.plan_id = plan_id
                plan.is_active = bool(cached_data.get("is_active", False))
                logger.info(f"Retrieved meal plan from cache: {plan_id}")
                return plan
        except Exception as cache_error:
            logger.warning(f"Cache retrieval failed for plan {plan_id}: {cache_error}")

        try:
            stored_plan = await self.repository.get_by_id(plan_id)
            if not stored_plan:
                logger.info(f"Plan not found: {plan_id}")
                return None

            plan = self._entity_to_response(stored_plan)
            logger.info(f"Retrieved meal plan from repository: {plan_id}")

            try:
                cache_data = stored_plan.plan_data.copy()
                cache_data["_storage_metadata"] = {
                    "stored_at": datetime.now().isoformat(),
                    "plan_id": plan_id,
                    "version": 1
                }
                cache_data["is_active"] = int(stored_plan.is_active)
                await cache_service.set(cache_key, cache_data, ttl=self.default_ttl_hours * 3600)
            except Exception as cache_error:
                logger.warning(f"Failed to cache retrieved plan {plan_id}: {cache_error}")

            return plan
        except Exception as e:
            logger.error(f"Error retrieving plan {plan_id}: {e}")
            return None
    
    async def update_plan(self, plan_id: str, updated_plan: MealPlanResponse) -> Optional[MealPlanResponse]:
        """
        Update an existing meal plan using Repository.
        Task 2.1.2: Uses MealPlanRepository

        Args:
            plan_id: The plan ID to update
            updated_plan: The updated meal plan

        Returns:
            Updated plan or None if not found
        """
        try:
            # Update in repository
            updates = {
                "plan_data": updated_plan.model_dump(),
                "bmr": updated_plan.bmr,
                "tdee": updated_plan.tdee,
                "daily_calorie_target": updated_plan.daily_calorie_target
            }
            result = await self.repository.update(plan_id, updates)
            if not result:
                logger.warning(f"Attempted to update non-existent plan: {plan_id}")
                return None

            # Update cache (non-blocking)
            cache_key = f"{self.plan_prefix}{plan_id}"
            try:
                plan_data = updated_plan.model_dump()
                plan_data["_storage_metadata"] = {"updated_at": datetime.now().isoformat(), "plan_id": plan_id, "version": 2}
                await cache_service.set(cache_key, plan_data, ttl=self.default_ttl_hours * 3600)
            except Exception as cache_error:
                logger.warning(f"Failed to update cache for plan {plan_id}: {cache_error}")

            logger.info(f"Updated meal plan: {plan_id}")
            return result

        except Exception as e:
            logger.error(f"Failed to update meal plan {plan_id}: {e}")
            return None

    async def set_plan_active_state(self, user_id: str, plan_id: str, is_active: bool) -> Optional[MealPlanResponse]:
        """Activate or deactivate a meal plan, ensuring only one active per user."""
        plan_entity = await self.repository.get_by_id(plan_id)
        if not plan_entity or plan_entity.user_id != user_id:
            return None

        if is_active:
            await self.repository.deactivate_plans_for_user(user_id)

        updated_entity = await self.repository.update(plan_id, {"is_active": int(is_active)})
        if not updated_entity:
            return None

        return self._entity_to_response(updated_entity)
    
    async def delete_plan(self, plan_id: str) -> bool:
        """
        Delete a meal plan.
        Task 2.1.2: Uses MealPlanRepository

        Args:
            plan_id: The plan ID to delete

        Returns:
            True if successful, False otherwise
        """
        try:
            # Delete from repository - Task 2.1.2
            success = await self.repository.delete(plan_id)
            
            # Remove from cache (non-blocking)
            cache_key = f"{self.plan_prefix}{plan_id}"
            try:
                redis_client = await cache_service.get_redis()
                await redis_client.delete(cache_key)
            except Exception as cache_error:
                logger.warning(f"Failed to remove plan {plan_id} from cache: {cache_error}")
            
            if success:
                logger.info(f"Deleted meal plan: {plan_id}")
            else:
                logger.info(f"Plan not found for deletion: {plan_id}")
            
            return success
                
        except Exception as e:
            logger.error(f"Error deleting plan {plan_id}: {e}")
            return False
    
    async def extend_ttl(self, plan_id: str, additional_hours: int = 24) -> bool:
        """
        Extend the TTL of a stored plan (cache only - database storage is persistent).
        Task 2.1.2: Uses MealPlanRepository

        Args:
            plan_id: The plan ID to extend
            additional_hours: Hours to add to TTL

        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if plan exists in repository first - Task 2.1.2
            plan = await self.repository.get_by_id(plan_id)
            if not plan:
                logger.warning(f"Cannot extend TTL for non-existent plan: {plan_id}")
                return False
            
            # Extend cache TTL only
            redis_client = await cache_service.get_redis()
            cache_key = f"{self.plan_prefix}{plan_id}"
            
            # Check if key exists in cache
            exists = await redis_client.exists(cache_key)
            if exists:
                # Set new TTL
                additional_seconds = additional_hours * 3600
                await redis_client.expire(cache_key, additional_seconds)
                logger.info(f"Extended cache TTL for plan {plan_id} by {additional_hours} hours")
            else:
                logger.info(f"Plan {plan_id} not in cache, TTL extension not needed")
            
            return True
            
        except Exception as e:
            logger.error(f"Error extending TTL for plan {plan_id}: {e}")
            return False

    async def get_user_plans(self, user_id: str, limit: int = 10, offset: int = 0) -> List[MealPlanResponse]:
        """
        Retrieve all meal plans for a specific user.
        Task 2.1.2: Uses MealPlanRepository

        Args:
            user_id: The user ID to retrieve plans for
            limit: Maximum number of plans to retrieve
            offset: Number of plans to skip (for pagination)

        Returns:
            List of MealPlanResponse objects for the user
        """
        try:
            # Retrieve plans from repository - Task 2.1.2
            stored_plans = await self.repository.get_by_user_id(user_id, limit=limit, offset=offset)

            # Convert MealPlan entities to MealPlanResponse
            plans = []
            for stored_plan in stored_plans:
                try:
                    plans.append(self._entity_to_response(stored_plan))
                except Exception as e:
                    logger.warning(f"Failed to convert plan {stored_plan.id} for user {user_id}: {e}")
                    continue

            logger.info(f"Retrieved {len(plans)} meal plans for user {user_id}")
            return plans

        except Exception as e:
            logger.error(f"Error retrieving plans for user {user_id}: {e}")
            return []

    async def get_active_plan_for_user(self, user_id: str) -> Optional[MealPlanResponse]:
        """
        Retrieve the single active meal plan for a user.

        Args:
            user_id: The user whose active plan should be returned

        Returns:
            MealPlanResponse for the active plan or None when missing
        """
        try:
            active_plan_entity = await self.repository.get_active_plan_for_user(user_id)
            if not active_plan_entity:
                return None

            return self._entity_to_response(active_plan_entity)
        except Exception as e:
            logger.error(f"Error retrieving active plan for user {user_id}: {e}")
            return None


# Global instance
plan_storage = PlanStorageService()
