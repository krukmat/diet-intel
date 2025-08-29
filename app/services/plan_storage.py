import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from app.models.meal_plan import MealPlanResponse
from app.services.cache import cache_service
import uuid

logger = logging.getLogger(__name__)


class PlanStorageService:
    """
    Service for storing and retrieving meal plans.
    Uses Redis as the storage backend with configurable TTL.
    """
    
    def __init__(self, default_ttl_hours: int = 24):
        self.default_ttl_hours = default_ttl_hours
        self.plan_prefix = "meal_plan:"
    
    async def store_plan(self, plan: MealPlanResponse, plan_id: Optional[str] = None) -> str:
        """
        Store a meal plan with a unique ID.
        
        Args:
            plan: The meal plan to store
            plan_id: Optional specific ID to use, otherwise generates UUID
            
        Returns:
            The plan ID used for storage
        """
        if not plan_id:
            plan_id = str(uuid.uuid4())
        
        cache_key = f"{self.plan_prefix}{plan_id}"
        
        # Convert plan to dict for storage
        plan_data = plan.model_dump()
        
        # Add metadata
        plan_data["_storage_metadata"] = {
            "stored_at": datetime.now().isoformat(),
            "plan_id": plan_id,
            "version": 1
        }
        
        # Store in Redis
        success = await cache_service.set(cache_key, plan_data, ttl_hours=self.default_ttl_hours)
        
        if success:
            logger.info(f"Stored meal plan with ID: {plan_id}")
        else:
            logger.error(f"Failed to store meal plan with ID: {plan_id}")
            raise RuntimeError("Failed to store meal plan")
        
        return plan_id
    
    async def get_plan(self, plan_id: str) -> Optional[MealPlanResponse]:
        """
        Retrieve a meal plan by ID.
        
        Args:
            plan_id: The plan ID to retrieve
            
        Returns:
            The meal plan or None if not found
        """
        cache_key = f"{self.plan_prefix}{plan_id}"
        
        plan_data = await cache_service.get(cache_key)
        if not plan_data:
            logger.info(f"Plan not found: {plan_id}")
            return None
        
        try:
            # Remove storage metadata before creating model
            if "_storage_metadata" in plan_data:
                del plan_data["_storage_metadata"]
            
            plan = MealPlanResponse(**plan_data)
            logger.info(f"Retrieved meal plan: {plan_id}")
            return plan
        
        except Exception as e:
            logger.error(f"Error deserializing plan {plan_id}: {e}")
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
        # First check if plan exists
        existing_plan = await self.get_plan(plan_id)
        if not existing_plan:
            logger.warning(f"Attempted to update non-existent plan: {plan_id}")
            return False
        
        cache_key = f"{self.plan_prefix}{plan_id}"
        
        # Convert updated plan to dict
        plan_data = updated_plan.model_dump()
        
        # Add/update metadata
        plan_data["_storage_metadata"] = {
            "stored_at": existing_plan.created_at.isoformat(),
            "updated_at": datetime.now().isoformat(),
            "plan_id": plan_id,
            "version": 2  # Increment version on update
        }
        
        # Store updated plan
        success = await cache_service.set(cache_key, plan_data, ttl_hours=self.default_ttl_hours)
        
        if success:
            logger.info(f"Updated meal plan: {plan_id}")
        else:
            logger.error(f"Failed to update meal plan: {plan_id}")
        
        return success
    
    async def delete_plan(self, plan_id: str) -> bool:
        """
        Delete a meal plan.
        
        Args:
            plan_id: The plan ID to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            redis_client = await cache_service.get_redis()
            cache_key = f"{self.plan_prefix}{plan_id}"
            
            result = await redis_client.delete(cache_key)
            
            if result > 0:
                logger.info(f"Deleted meal plan: {plan_id}")
                return True
            else:
                logger.info(f"Plan not found for deletion: {plan_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting plan {plan_id}: {e}")
            return False
    
    async def extend_ttl(self, plan_id: str, additional_hours: int = 24) -> bool:
        """
        Extend the TTL of a stored plan.
        
        Args:
            plan_id: The plan ID to extend
            additional_hours: Hours to add to TTL
            
        Returns:
            True if successful, False otherwise
        """
        try:
            redis_client = await cache_service.get_redis()
            cache_key = f"{self.plan_prefix}{plan_id}"
            
            # Check if key exists and get current TTL
            exists = await redis_client.exists(cache_key)
            if not exists:
                logger.warning(f"Cannot extend TTL for non-existent plan: {plan_id}")
                return False
            
            # Set new TTL
            additional_seconds = additional_hours * 3600
            await redis_client.expire(cache_key, additional_seconds)
            
            logger.info(f"Extended TTL for plan {plan_id} by {additional_hours} hours")
            return True
            
        except Exception as e:
            logger.error(f"Error extending TTL for plan {plan_id}: {e}")
            return False


# Global instance
plan_storage = PlanStorageService()