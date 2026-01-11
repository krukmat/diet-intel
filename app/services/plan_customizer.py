import logging
from typing import List, Optional, Tuple
from datetime import datetime
from copy import deepcopy

import json
from app.models.meal_plan import (
    MealPlanResponse, PlanCustomizationRequest, ChangeLogEntry,
    SwapOperation, RemoveOperation, ManualAddition, MealCalorieAdjustment,
    Meal, MealItem, MealItemMacros, DailyMacros
)
from app.models.product import ProductResponse, Nutriments
from app.services.cache import cache_service
from app.services.database import db_service
from app.services.openfoodfacts import openfoodfacts_service
from app.services.nutrition_calculator import nutrition_calculator

logger = logging.getLogger(__name__)


class PlanCustomizerService:
    """
    Service for customizing existing meal plans.
    Handles swaps, removals, manual additions, and calorie adjustments.
    """
    
    def __init__(self):
        pass
    
    async def customize_plan(self, plan: MealPlanResponse, 
                           customization: PlanCustomizationRequest) -> Tuple[MealPlanResponse, List[ChangeLogEntry]]:
        """
        Apply customizations to a meal plan and return updated plan with change log.
        
        Args:
            plan: Original meal plan
            customization: Requested customizations
            
        Returns:
            Tuple of (updated_plan, change_log)
        """
        # Create deep copy to avoid modifying original
        updated_plan = deepcopy(plan)
        change_log = []
        
        # Apply operations in order
        if customization.swap:
            await self._apply_swap(updated_plan, customization.swap, change_log)
        
        if customization.remove:
            await self._apply_removal(updated_plan, customization.remove, change_log)
        
        if customization.add_manual:
            await self._apply_manual_addition(updated_plan, customization.add_manual, change_log)
        
        if customization.adjust_meal_calories:
            await self._apply_calorie_adjustment(updated_plan, customization.adjust_meal_calories, change_log)
        
        # Recalculate totals and metrics
        self._recalculate_metrics(updated_plan)
        
        logger.info(f"Applied {len(change_log)} customizations to meal plan")
        
        return updated_plan, change_log
    
    async def _apply_swap(self, plan: MealPlanResponse, swap: SwapOperation, 
                         change_log: List[ChangeLogEntry]) -> None:
        """
        Swap one item for another in the meal plan.
        """
        # Find the item to replace
        target_meal = None
        target_item_index = None
        
        for meal in plan.meals:
            for i, item in enumerate(meal.items):
                if item.barcode == swap.old_barcode:
                    target_meal = meal
                    target_item_index = i
                    break
            if target_meal:
                break
        
        if not target_meal or target_item_index is None:
            logger.warning(f"Item to swap not found: {swap.old_barcode}")
            change_log.append(ChangeLogEntry(
                change_type="swap_failed",
                description=f"Item with barcode {swap.old_barcode} not found in plan",
                meal_affected=None
            ))
            return
        
        # Get replacement product from cache
        replacement_product = await self._get_product_from_cache(swap.new_barcode)
        if not replacement_product:
            logger.warning(f"Replacement product not found in cache: {swap.new_barcode}")
            change_log.append(ChangeLogEntry(
                change_type="swap_failed", 
                description=f"Replacement product {swap.new_barcode} not available",
                meal_affected=target_meal.name
            ))
            return
        
        # Create new meal item from replacement product
        from app.services.meal_planner import MealPlannerService
        planner = MealPlannerService()
        serving_info = planner._calculate_serving_info(replacement_product)
        
        if not serving_info:
            logger.warning(f"Could not calculate serving info for: {swap.new_barcode}")
            change_log.append(ChangeLogEntry(
                change_type="swap_failed",
                description=f"Cannot calculate nutrition for replacement item {swap.new_barcode}",
                meal_affected=target_meal.name
            ))
            return
        
        serving_size, calories, macros = serving_info
        
        # Get old item info for logging
        old_item = target_meal.items[target_item_index]
        
        # Create new item
        new_item = MealItem(
            barcode=replacement_product.barcode,
            name=replacement_product.name or "Unknown",
            serving=serving_size,
            calories=calories,
            macros=macros
        )
        
        # Replace the item
        target_meal.items[target_item_index] = new_item
        
        # Update meal calories
        target_meal.actual_calories = sum(item.calories for item in target_meal.items)
        
        change_log.append(ChangeLogEntry(
            change_type="swap",
            description=f"Swapped {old_item.name} ({old_item.calories:.0f} kcal) with {new_item.name} ({new_item.calories:.0f} kcal)",
            meal_affected=target_meal.name
        ))
    
    async def _apply_removal(self, plan: MealPlanResponse, remove: RemoveOperation,
                           change_log: List[ChangeLogEntry]) -> None:
        """
        Remove an item from the meal plan.
        """
        target_meal = None
        target_item_index = None

        def matches_target(meal: Meal, index: int, item: MealItem) -> bool:
            if remove.meal_name and meal.name.lower() != remove.meal_name.lower():
                return False
            if remove.item_index is not None and index != remove.item_index:
                return False
            return item.barcode == remove.barcode

        for meal in plan.meals:
            for i, item in enumerate(meal.items):
                if matches_target(meal, i, item):
                    target_meal = meal
                    target_item_index = i
                    break
            if target_meal:
                break

        if not target_meal or target_item_index is None:
            logger.warning(
                "Item to remove not found: %s (meal=%s, index=%s)",
                remove.barcode,
                remove.meal_name,
                remove.item_index,
            )
            change_log.append(ChangeLogEntry(
                change_type="remove_failed",
                description=f"Item with barcode {remove.barcode} not found in plan",
                meal_affected=remove.meal_name
            ))
            return
        
        # Get item info for logging
        removed_item = target_meal.items[target_item_index]
        
        # Remove the item
        target_meal.items.pop(target_item_index)
        
        # Update meal calories
        target_meal.actual_calories = sum(item.calories for item in target_meal.items)
        
        change_log.append(ChangeLogEntry(
            change_type="remove",
            description=f"Removed {removed_item.name} ({removed_item.calories:.0f} kcal)",
            meal_affected=target_meal.name
        ))
    
    async def _apply_manual_addition(self, plan: MealPlanResponse, addition: ManualAddition,
                                   change_log: List[ChangeLogEntry]) -> None:
        """
        Add a manually specified item to the meal plan.
        Adds to the meal with the lowest current calorie count.
        """
        # Find meal with lowest actual calories to add the item
        target_meal = min(plan.meals, key=lambda m: m.actual_calories)
        
        manual_barcode = addition.barcode or f"manual_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"

        existing_item = None
        normalized_name = (addition.name or "").strip().lower()
        for item in target_meal.items:
            if addition.barcode and item.barcode == addition.barcode:
                existing_item = item
                break
            if normalized_name and item.name.strip().lower() == normalized_name:
                existing_item = item
                break
        
        # Create macros
        macros = MealItemMacros(
            protein_g=addition.protein_g,
            fat_g=addition.fat_g,
            carbs_g=addition.carbs_g,
            sugars_g=addition.sugars_g,
            salt_g=addition.salt_g
        )
        
        if existing_item:
            existing_item.calories += addition.calories
            existing_item.macros.protein_g += macros.protein_g
            existing_item.macros.fat_g += macros.fat_g
            existing_item.macros.carbs_g += macros.carbs_g
            if existing_item.macros.sugars_g is not None:
                existing_item.macros.sugars_g += macros.sugars_g or 0.0
            if existing_item.macros.salt_g is not None:
                existing_item.macros.salt_g += macros.salt_g or 0.0
            existing_item.serving = self._merge_servings(existing_item.serving, addition.serving)
        else:
            manual_item = MealItem(
                barcode=manual_barcode,
                name=addition.name,
                serving=addition.serving,
                calories=addition.calories,
                macros=macros
            )
            target_meal.items.append(manual_item)
        
        # Update meal calories
        target_meal.actual_calories = sum(item.calories for item in target_meal.items)
        
        change_log.append(ChangeLogEntry(
            change_type="add_manual",
            description=f"Added manual item {addition.name} ({addition.calories:.0f} kcal)",
            meal_affected=target_meal.name
        ))

    @staticmethod
    def _merge_servings(existing: str, incoming: str) -> str:
        existing = (existing or "").strip()
        incoming = (incoming or "").strip()
        if not existing:
            return incoming
        if not incoming:
            return existing
        if existing == incoming:
            return f"2 x {existing}"
        if existing.startswith("2 x "):
            return f"{existing} + {incoming}"
        return f"{existing} + {incoming}"
    
    async def _apply_calorie_adjustment(self, plan: MealPlanResponse, adjustment: MealCalorieAdjustment,
                                      change_log: List[ChangeLogEntry]) -> None:
        """
        Adjust the calorie target for a specific meal.
        """
        # Find the target meal
        target_meal = None
        for meal in plan.meals:
            if meal.name.lower() == adjustment.meal_name.lower():
                target_meal = meal
                break
        
        if not target_meal:
            logger.warning(f"Meal not found for calorie adjustment: {adjustment.meal_name}")
            change_log.append(ChangeLogEntry(
                change_type="adjust_calories_failed",
                description=f"Meal '{adjustment.meal_name}' not found",
                meal_affected=None
            ))
            return
        
        old_target = target_meal.target_calories
        target_meal.target_calories = adjustment.new_target
        
        # Update daily calorie target proportionally
        # Calculate what percentage this meal now represents of the old total
        old_daily_target = plan.daily_calorie_target
        calorie_difference = adjustment.new_target - old_target
        plan.daily_calorie_target = old_daily_target + calorie_difference
        
        change_log.append(ChangeLogEntry(
            change_type="adjust_calories",
            description=f"Adjusted {target_meal.name} target from {old_target:.0f} to {adjustment.new_target:.0f} kcal",
            meal_affected=target_meal.name
        ))
    
    def _recalculate_metrics(self, plan: MealPlanResponse) -> None:
        """
        Recalculate daily metrics after modifications.
        """
        total_calories = 0.0
        total_protein = 0.0
        total_fat = 0.0
        total_carbs = 0.0
        total_sugars = 0.0
        total_salt = 0.0
        
        # Sum up all nutrients from all meals
        for meal in plan.meals:
            # Update meal actual calories first
            meal.actual_calories = sum(item.calories for item in meal.items)
            
            for item in meal.items:
                total_calories += item.calories
                total_protein += item.macros.protein_g
                total_fat += item.macros.fat_g
                total_carbs += item.macros.carbs_g
                total_sugars += item.macros.sugars_g or 0.0
                total_salt += item.macros.salt_g or 0.0
        
        # Calculate percentages
        protein_percent, fat_percent, carbs_percent = nutrition_calculator.calculate_macros_from_calories(
            total_calories, total_protein, total_fat, total_carbs
        )
        
        # Update metrics
        plan.metrics = DailyMacros(
            total_calories=round(total_calories, 1),
            protein_g=round(total_protein, 1),
            fat_g=round(total_fat, 1),
            carbs_g=round(total_carbs, 1),
            sugars_g=round(total_sugars, 1),
            salt_g=round(total_salt, 1),
            protein_percent=protein_percent,
            fat_percent=fat_percent,
            carbs_percent=carbs_percent
        )
        
        logger.info(f"Recalculated metrics: {total_calories:.1f} total kcal")
    
    async def _get_product_from_cache(self, barcode: str) -> Optional[ProductResponse]:
        """
        Retrieve a product from cache by barcode or name.
        """
        cache_key = f"product:{barcode}"
        cached_product = await cache_service.get(cache_key)
        
        if cached_product:
            try:
                return ProductResponse(**cached_product)
            except Exception as e:
                logger.error(f"Error deserializing cached product {barcode}: {e}")
        
        if barcode and not barcode.isdigit():
            try:
                product = await openfoodfacts_service.search_product_by_name(barcode)
            except Exception as exc:
                logger.warning(f"Product search failed for {barcode}: {exc}")
                product = None
            if product:
                try:
                    await cache_service.set(cache_key, product.model_dump(), ttl=24 * 3600)
                except Exception as cache_error:
                    logger.warning(f"Failed to cache product {barcode}: {cache_error}")
                return product

            product = self._get_product_by_name(barcode)
            if product:
                try:
                    await cache_service.set(cache_key, product.model_dump(), ttl=24 * 3600)
                except Exception as cache_error:
                    logger.warning(f"Failed to cache product {barcode}: {cache_error}")
                return product

        try:
            product = await openfoodfacts_service.get_product(barcode)
        except Exception as exc:
            logger.warning(f"Product lookup failed for {barcode}: {exc}")
            return None

        if product:
            try:
                await cache_service.set(cache_key, product.model_dump(), ttl=24 * 3600)
            except Exception as cache_error:
                logger.warning(f"Failed to cache product {barcode}: {cache_error}")
            return product

        return None

    def _get_product_by_name(self, name: str) -> Optional[ProductResponse]:
        """Fallback lookup by product name when barcode is not usable."""
        cleaned = name.replace("OPT_", "").replace("_", " ").strip().lower()
        if not cleaned:
            return None

        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT * FROM products
                    WHERE lower(name) LIKE ?
                    ORDER BY access_count DESC, last_updated DESC
                    LIMIT 1
                    """,
                    (f"%{cleaned}%",)
                )
                row = cursor.fetchone()
                if not row:
                    return None

                nutriments_data = json.loads(row["nutriments"])
                nutriments = Nutriments(
                    energy_kcal_per_100g=nutriments_data.get("energy_kcal_per_100g"),
                    protein_g_per_100g=nutriments_data.get("protein_g_per_100g"),
                    fat_g_per_100g=nutriments_data.get("fat_g_per_100g"),
                    carbs_g_per_100g=nutriments_data.get("carbs_g_per_100g"),
                    sugars_g_per_100g=nutriments_data.get("sugars_g_per_100g"),
                    salt_g_per_100g=nutriments_data.get("salt_g_per_100g"),
                )

                return ProductResponse(
                    source=row["source"] or "Database",
                    barcode=row["barcode"],
                    name=row["name"],
                    brand=row["brand"],
                    image_url=row["image_url"],
                    serving_size=row["serving_size"],
                    nutriments=nutriments,
                    fetched_at=datetime.fromisoformat(row["last_updated"]),
                )
        except Exception as exc:
            logger.warning(f"Product name lookup failed for {name}: {exc}")
            return None
    
    def check_idempotency(self, plan: MealPlanResponse, customization: PlanCustomizationRequest) -> bool:
        """
        Check if applying this customization would result in no changes (idempotent).
        
        This is a simplified check - in production you might want more sophisticated
        change detection or store operation hashes.
        
        Args:
            plan: Current meal plan
            customization: Requested customization
            
        Returns:
            True if the operation would be idempotent (no changes)
        """
        # For swap operations, check if item is already present
        if customization.swap:
            # Check if new item is already in the plan at the same position as old item
            for meal in plan.meals:
                for item in meal.items:
                    if item.barcode == customization.swap.old_barcode:
                        # If we're trying to swap an item for itself, it's idempotent
                        return customization.swap.new_barcode == customization.swap.old_barcode
        
        # For remove operations, check if item exists
        if customization.remove:
            def matches_removal(meal: Meal, index: int, item: MealItem) -> bool:
                if customization.remove.meal_name and meal.name.lower() != customization.remove.meal_name.lower():
                    return False
                if customization.remove.item_index is not None and index != customization.remove.item_index:
                    return False
                return item.barcode == customization.remove.barcode

            item_exists = any(
                matches_removal(meal, index, item)
                for meal in plan.meals
                for index, item in enumerate(meal.items)
            )
            # If item doesn't exist, removing it is idempotent
            return not item_exists
        
        # For calorie adjustments, check if target is already set
        if customization.adjust_meal_calories:
            for meal in plan.meals:
                if meal.name.lower() == customization.adjust_meal_calories.meal_name.lower():
                    return abs(meal.target_calories - customization.adjust_meal_calories.new_target) < 1.0
        
        # Manual additions are never idempotent (always add new item)
        if customization.add_manual:
            return False
        
        return True


# Global instance
plan_customizer = PlanCustomizerService()
