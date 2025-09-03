import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from app.models.meal_plan import MealPlanResponse
from app.services.cache import cache_service
from app.services.database import db_service
import uuid

logger = logging.getLogger(__name__)


class PlanStorageService:
    """
    Service for storing and retrieving meal plans.
    Uses database as the storage backend with Redis caching for performance.
    """
    
    def __init__(self, default_ttl_hours: int = 24):
        self.default_ttl_hours = default_ttl_hours
        self.plan_prefix = "meal_plan:"
    
    async def store_plan(self, plan: MealPlanResponse, plan_id: Optional[str] = None, user_id: str = "anonymous") -> str:
        """
        Store a meal plan with a unique ID.
        
        Args:
            plan: The meal plan to store
            plan_id: Optional specific ID to use, otherwise generates UUID
            user_id: User ID for associating the plan (defaults to anonymous)
            
        Returns:
            The plan ID used for storage
        """
        try:
            # Store in database (generates plan_id internally)
            stored_plan_id = await db_service.store_meal_plan(user_id, plan)
            
            # Use the specific plan_id if provided, otherwise use the one from database
            actual_plan_id = plan_id if plan_id else stored_plan_id
            
            # Cache for performance (non-blocking)
            cache_key = f"{self.plan_prefix}{actual_plan_id}"
            plan_data = plan.model_dump()
            plan_data["_storage_metadata"] = {
                "stored_at": datetime.now().isoformat(),
                "plan_id": actual_plan_id,
                "version": 1
            }
            try:
                await cache_service.set(cache_key, plan_data, ttl_hours=self.default_ttl_hours)
            except Exception as cache_error:
                logger.warning(f"Failed to cache plan {actual_plan_id}: {cache_error}")
            
            logger.info(f"Stored meal plan with ID: {actual_plan_id}")
            return actual_plan_id
            
        except Exception as e:
            logger.error(f"Failed to store meal plan: {e}")
            raise RuntimeError(f"Failed to store meal plan: {str(e)}")
    
    async def get_plan(self, plan_id: str) -> Optional[MealPlanResponse]:
        """
        Retrieve a meal plan by ID.
        
        Args:
            plan_id: The plan ID to retrieve
            
        Returns:
            The meal plan or None if not found
        """
        # Try cache first
        cache_key = f"{self.plan_prefix}{plan_id}"
        try:
            cached_data = await cache_service.get(cache_key)
            if cached_data:
                # Remove storage metadata before creating model
                if "_storage_metadata" in cached_data:
                    del cached_data["_storage_metadata"]
                plan = MealPlanResponse(**cached_data)
                logger.info(f"Retrieved meal plan from cache: {plan_id}")
                return plan
        except Exception as cache_error:
            logger.warning(f"Cache retrieval failed for plan {plan_id}: {cache_error}")
        
        # Fallback to database
        try:
            plan_data = await db_service.get_meal_plan(plan_id)
            if not plan_data:
                logger.info(f"Plan not found: {plan_id}")
                return None
            
            plan = MealPlanResponse(**plan_data)
            logger.info(f"Retrieved meal plan from database: {plan_id}")
            
            # Update cache (non-blocking)
            try:
                cache_data = plan_data.copy()
                cache_data["_storage_metadata"] = {
                    "stored_at": datetime.now().isoformat(),
                    "plan_id": plan_id,
                    "version": 1
                }
                await cache_service.set(cache_key, cache_data, ttl_hours=self.default_ttl_hours)
            except Exception as cache_error:
                logger.warning(f"Failed to cache retrieved plan {plan_id}: {cache_error}")
            
            return plan
            
        except Exception as e:
            logger.error(f"Error retrieving plan {plan_id}: {e}")
            return None
    
    async def update_plan(self, plan_id: str, updated_plan: MealPlanResponse) -> bool:
        """
        Update an existing meal plan.
        
        Args:
            plan_id: The plan ID to update
            updated_plan: The updated meal plan
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Update in database
            success = await db_service.update_meal_plan(plan_id, updated_plan)
            if not success:
                logger.warning(f"Attempted to update non-existent plan: {plan_id}")
                return False
            
            # Update cache (non-blocking)
            cache_key = f"{self.plan_prefix}{plan_id}"
            try:
                plan_data = updated_plan.model_dump()
                plan_data["_storage_metadata"] = {
                    "stored_at": updated_plan.created_at.isoformat(),
                    "updated_at": datetime.now().isoformat(),
                    "plan_id": plan_id,
                    "version": 2
                }
                await cache_service.set(cache_key, plan_data, ttl_hours=self.default_ttl_hours)
            except Exception as cache_error:
                logger.warning(f"Failed to update cache for plan {plan_id}: {cache_error}")
            
            logger.info(f"Updated meal plan: {plan_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update meal plan {plan_id}: {e}")
            return False
    
    async def delete_plan(self, plan_id: str) -> bool:
        """
        Delete a meal plan.
        
        Args:
            plan_id: The plan ID to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Delete from database
            success = await db_service.delete_meal_plan(plan_id)
            
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
        
        Args:
            plan_id: The plan ID to extend
            additional_hours: Hours to add to TTL
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if plan exists in database first
            plan = await db_service.get_meal_plan(plan_id)
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


# Global instance
plan_storage = PlanStorageService()