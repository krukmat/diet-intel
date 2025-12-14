import logging
import random
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from app.models.meal_plan import (
    MealPlanRequest,
    MealPlanResponse,
    MealPlanConfig,
    Meal,
    MealItem,
    MealItemMacros,
    DailyMacros,
)
from app.models.product import ProductResponse, Nutriments
from app.services.nutrition_calculator import nutrition_calculator
from app.services.cache import cache_service
from app.services.product_discovery import product_discovery_service

logger = logging.getLogger(__name__)
cached_products: List[ProductResponse] = []


class MealPlannerService:
    """
    Core meal planning service that builds daily meal plans.
    
    Algorithm:
    1. Calculate BMR, TDEE, and daily calorie target
    2. Split calories into meal targets (25% breakfast, 40% lunch, 35% dinner)
    3. For each meal, use greedy selection:
       - Prioritize optional_products first
       - Fill remaining calories from cached product database  
       - Max 3 items per meal (5 with flexibility)
       - Stay within calorie tolerance (±5% strict, ±15% flexible)
    4. Calculate final macros and metrics
    
    Assumptions:
    - If product has serving_size, use it for calculations
    - If no serving_size, assume 100g serving
    - Products without complete nutriment data are skipped
    - Simple greedy selection (room for ML improvement later)
    """
    
    def __init__(self, config: MealPlanConfig = None):
        self.config = config or MealPlanConfig()
    
    async def generate_plan(self, request: MealPlanRequest) -> MealPlanResponse:
        """
        Generate a complete daily meal plan.
        
        Args:
            request: Meal plan request with user profile and preferences
            
        Returns:
            Complete meal plan with meals and nutritional metrics
        """
        profile = request.user_profile
        
        # Step 1: Calculate nutritional requirements
        bmr = nutrition_calculator.calculate_bmr(profile)
        tdee = nutrition_calculator.calculate_tdee(bmr, profile.activity_level)
        daily_target = nutrition_calculator.calculate_daily_target(tdee, profile.goal)
        
        # Step 2: Get meal calorie targets
        breakfast_target, lunch_target, dinner_target = nutrition_calculator.get_meal_targets(daily_target)
        
        # Step 3: Load available products
        available_products = await self._load_available_products(request.optional_products)
        
        if not available_products:
            logger.warning("No products available for meal planning")
            # Return empty plan rather than failing
            return self._create_empty_plan(bmr, tdee, daily_target, request.flexibility or False)
        
        # Step 4: Build each meal
        breakfast = await self._build_meal(
            "Breakfast", breakfast_target, available_products, 
            request.optional_products or [], request.flexibility or False, request.preferences
        )
        
        lunch = await self._build_meal(
            "Lunch", lunch_target, available_products,
            request.optional_products or [], request.flexibility or False, request.preferences
        )
        
        dinner = await self._build_meal(
            "Dinner", dinner_target, available_products,
            request.optional_products or [], request.flexibility or False, request.preferences
        )
        
        # Step 5: Calculate final metrics
        meals = [breakfast, lunch, dinner]
        daily_macros = self._calculate_daily_macros(meals)
        
        # Count optional products used
        optional_products_used = sum(
            1 for meal in meals 
            for item in meal.items 
            if item.barcode in (request.optional_products or [])
        )
        
        return MealPlanResponse(
            bmr=bmr,
            tdee=tdee,
            daily_calorie_target=daily_target,
            meals=meals,
            metrics=daily_macros,
            flexibility_used=request.flexibility or False,
            optional_products_used=optional_products_used
        )
    
    async def _load_available_products(self, optional_products: Optional[List[str]]) -> List[ProductResponse]:
        """
        Load available products from cache and optional products.
        
        Args:
            optional_products: List of barcode strings to prioritize
            
        Returns:
            List of ProductResponse objects available for meal planning
        """
        products = []
        
        # Load optional products first (from cache if available)
        if optional_products:
            for barcode in optional_products:
                cache_key = f"product:{barcode}"
                cached_product = await cache_service.get(cache_key)
                if cached_product:
                    try:
                        product = ProductResponse(**cached_product)
                        products.append(product)
                        logger.debug(f"Loaded optional product: {barcode}")
                    except Exception as e:
                        logger.warning(f"Failed to load optional product {barcode}: {e}")
        
        # Use the new product discovery service for intelligent meal planning products
        try:
            # Get additional products through discovery service
            discovered_products = await product_discovery_service.discover_products_for_meal_planning(
                user_id=None,  # Could be enhanced with user context
                dietary_restrictions=None,  # Could be enhanced with user preferences
                optional_products=optional_products,
                max_products=30  # Good balance for meal planning
            )
            
            # Merge with optional products, avoiding duplicates
            existing_barcodes = {p.barcode for p in products}
            for product in discovered_products:
                if product.barcode not in existing_barcodes:
                    products.append(product)
                    existing_barcodes.add(product.barcode)

        except Exception as e:
            logger.error(f"Error with product discovery service: {e}")
            # Fallback to emergency products if discovery fails
            if len(products) < 5:
                emergency_products = await product_discovery_service._get_emergency_fallback_products()
                existing_barcodes = {p.barcode for p in products}
                for product in emergency_products:
                    if product.barcode not in existing_barcodes:
                        products.append(product)
                        existing_barcodes.add(product.barcode)

        # Legacy compatibility: include cached_products module attribute if populated
        if cached_products:
            existing_barcodes = {p.barcode for p in products}
            for product in cached_products:
                try:
                    if product.barcode not in existing_barcodes:
                        products.append(product)
                        existing_barcodes.add(product.barcode)
                except AttributeError:
                    logger.debug("Skipping cached product without barcode attribute")
        
        logger.info(f"Loaded {len(products)} products for meal planning")
        return products
    
    async def _log_meal_product_usage(self, user_id: Optional[str], barcode: str, meal_name: str):
        """Log product usage in meal planning for learning."""
        if not user_id:
            return
        
        try:
            from app.services.database import db_service
            from app.services.analytics_service import AnalyticsService
            # Task: Phase 2 Batch 6 - Analytics Service Extraction
            analytics_service = AnalyticsService(db_service)
            await analytics_service.log_user_product_interaction(
                user_id=user_id,
                session_id=None,  # Could be enhanced with session tracking
                barcode=barcode,
                action="used_in_meal_plan",
                context=f"meal_planning:{meal_name}"
            )
            logger.debug(f"Logged meal product usage: {user_id} used {barcode} in {meal_name}")
        except Exception as e:
            logger.warning(f"Failed to log meal product usage: {e}")

    async def _get_mock_products(self, target_count: int = 12) -> List[ProductResponse]:
        """Return deterministic mock products for tests and offline scenarios."""
        base_catalog = [
            {
                "barcode": "9900001",
                "name": "Mock Greek Yogurt",
                "brand": "DietIntel Kitchen",
                "serving_size": "150g",
                "energy": 95,
                "protein": 17,
                "fat": 0,
                "carbs": 6,
            },
            {
                "barcode": "9900002",
                "name": "Mock Steel Cut Oats",
                "brand": "DietIntel Pantry",
                "serving_size": "50g",
                "energy": 185,
                "protein": 7,
                "fat": 3,
                "carbs": 32,
            },
            {
                "barcode": "9900003",
                "name": "Mock Grilled Chicken Breast",
                "brand": "DietIntel Kitchen",
                "serving_size": "120g",
                "energy": 165,
                "protein": 31,
                "fat": 4,
                "carbs": 0,
            },
            {
                "barcode": "9900004",
                "name": "Mock Quinoa Salad",
                "brand": "DietIntel Kitchen",
                "serving_size": "140g",
                "energy": 210,
                "protein": 8,
                "fat": 7,
                "carbs": 30,
            },
            {
                "barcode": "9900005",
                "name": "Mock Roasted Veggies",
                "brand": "DietIntel Kitchen",
                "serving_size": "130g",
                "energy": 110,
                "protein": 3,
                "fat": 4,
                "carbs": 15,
            },
        ]

        products: List[ProductResponse] = []
        now = datetime.utcnow()

        for blueprint in base_catalog:
            nutriments = Nutriments(
                energy_kcal_per_100g=blueprint["energy"],
                protein_g_per_100g=blueprint["protein"],
                fat_g_per_100g=blueprint["fat"],
                carbs_g_per_100g=blueprint["carbs"],
            )
            products.append(
                ProductResponse(
                    source="mock",
                    barcode=blueprint["barcode"],
                    name=blueprint["name"],
                    brand=blueprint["brand"],
                    serving_size=blueprint["serving_size"],
                    image_url=None,
                    nutriments=nutriments,
                    fetched_at=now,
                )
            )

        # Create additional variants if a higher count is requested
        variant_index = 0
        while len(products) < target_count:
            base = base_catalog[variant_index % len(base_catalog)]
            modifier = 1 + (0.05 * (variant_index + 1))
            nutriments = Nutriments(
                energy_kcal_per_100g=min(900, base["energy"] * modifier),
                protein_g_per_100g=min(100, base["protein"] * modifier),
                fat_g_per_100g=min(100, base["fat"] * modifier),
                carbs_g_per_100g=min(100, base["carbs"] * modifier),
            )
            products.append(
                ProductResponse(
                    source="mock",
                    barcode=f"{base['barcode']}-{variant_index}",
                    name=f"{base['name']} Variant {variant_index + 1}",
                    brand=base["brand"],
                    serving_size=base["serving_size"],
                    image_url=None,
                    nutriments=nutriments,
                    fetched_at=now,
                )
            )
            variant_index += 1

        return products[:target_count]
    
    async def _build_meal(self, meal_name: str, target_calories: float, 
                         available_products: List[ProductResponse],
                         optional_products: List[str], flexibility: bool,
                         preferences) -> Meal:
        """
        Build a single meal using greedy selection algorithm.
        
        Args:
            meal_name: Name of the meal (Breakfast, Lunch, Dinner)
            target_calories: Target calories for this meal
            available_products: All available products
            optional_products: Barcodes to prioritize
            flexibility: Whether to use flexible constraints
            preferences: User dietary preferences
            
        Returns:
            Complete Meal object with selected items
        """
        selected_items = []
        current_calories = 0.0
        
        # Set constraints based on flexibility
        max_items = self.config.max_items_flexible if flexibility else self.config.max_items_per_meal
        tolerance = self.config.calorie_tolerance_flexible if flexibility else self.config.calorie_tolerance_strict
        
        # Separate optional and regular products
        optional_prods = [p for p in available_products if p.barcode in optional_products]
        regular_prods = [p for p in available_products if p.barcode not in optional_products]
        
        # Prioritize optional products first
        products_to_try = optional_prods + regular_prods
        
        # Sort for deterministic results in testing, with some variety
        products_to_try.sort(key=lambda p: (p.barcode, p.name or ""))
        
        for product in products_to_try:
            if len(selected_items) >= max_items:
                break
            
            # Skip products that don't match preferences (basic filtering)
            if not self._matches_preferences(product, preferences):
                continue
            
            # Calculate serving info
            serving_info = self._calculate_serving_info(product)
            if not serving_info:
                continue
            
            serving_size, serving_calories, serving_macros = serving_info
            
            # Check if adding this item would exceed our target (with tolerance)
            max_allowed_calories = target_calories * (1 + tolerance)
            if current_calories + serving_calories > max_allowed_calories:
                # Try to scale down the serving if flexible
                if flexibility and current_calories < target_calories:
                    remaining_calories = target_calories - current_calories
                    if remaining_calories > 50:  # Minimum useful calories
                        scale_factor = remaining_calories / serving_calories
                        if scale_factor >= 0.3:  # Don't scale too small
                            scaled_serving = self._scale_serving(serving_size, serving_calories, serving_macros, scale_factor)
                            if scaled_serving:
                                scaled_size, scaled_calories, scaled_macros = scaled_serving
                                item = MealItem(
                                    barcode=product.barcode,
                                    name=product.name or "Unknown",
                                    serving=scaled_size,
                                    calories=scaled_calories,
                                    macros=scaled_macros
                                )
                                selected_items.append(item)
                                current_calories += scaled_calories
                                break
                continue
            
            # Add the item
            item = MealItem(
                barcode=product.barcode,
                name=product.name or "Unknown",
                serving=serving_size,
                calories=serving_calories,
                macros=serving_macros
            )
            
            selected_items.append(item)
            current_calories += serving_calories
            
            # Check if we're close enough to target
            min_allowed_calories = target_calories * (1 - tolerance)
            if current_calories >= min_allowed_calories:
                break
        
        logger.info(f"Built {meal_name}: {len(selected_items)} items, "
                   f"{current_calories:.1f}/{target_calories:.1f} kcal")
        
        return Meal(
            name=meal_name,
            target_calories=target_calories,
            actual_calories=current_calories,
            items=selected_items
        )
    
    def _select_products_for_meal(self, target_calories: float, available_products: List[ProductResponse], 
                                 optional_products: List[str], flexibility: bool, preferences, 
                                 tolerance: float = None) -> List[MealItem]:
        """
        Select products for a meal using greedy selection algorithm.
        
        This method extracts the core product selection logic for testing purposes.
        
        Args:
            target_calories: Target calories for the meal
            available_products: List of available products
            optional_products: List of barcode strings to prioritize
            flexibility: Whether to use flexible constraints
            preferences: User dietary preferences
            tolerance: Custom tolerance (overrides flexibility-based tolerance)
            
        Returns:
            List of MealItem objects selected for the meal
        """
        selected_items = []
        current_calories = 0.0
        
        # Set constraints based on flexibility or custom tolerance
        max_items = self.config.max_items_flexible if flexibility else self.config.max_items_per_meal
        if tolerance is not None:
            actual_tolerance = tolerance
        else:
            actual_tolerance = self.config.calorie_tolerance_flexible if flexibility else self.config.calorie_tolerance_strict
        
        # Separate optional and regular products
        optional_prods = [p for p in available_products if p.barcode in optional_products]
        regular_prods = [p for p in available_products if p.barcode not in optional_products]
        
        # Prioritize optional products first
        products_to_try = optional_prods + regular_prods
        
        # Sort for deterministic results in testing, with some variety
        products_to_try.sort(key=lambda p: (p.barcode, p.name or ""))
        
        for product in products_to_try:
            if len(selected_items) >= max_items:
                break
            
            # Skip products that don't match preferences (basic filtering)
            if not self._matches_preferences(product, preferences):
                continue
            
            # Calculate serving info
            serving_info = self._calculate_serving_info(product)
            if not serving_info:
                continue
            
            serving_size, serving_calories, serving_macros = serving_info
            
            # Check if adding this item would exceed our target (with tolerance)
            max_allowed_calories = target_calories * (1 + actual_tolerance)
            if current_calories + serving_calories > max_allowed_calories:
                # Try to scale down the serving if flexible
                if flexibility and current_calories < target_calories:
                    remaining_calories = target_calories - current_calories
                    if remaining_calories > 50:  # Minimum useful calories
                        scale_factor = remaining_calories / serving_calories
                        if scale_factor >= 0.3:  # Don't scale too small
                            scaled_serving = self._scale_serving(serving_size, serving_calories, serving_macros, scale_factor)
                            if scaled_serving:
                                scaled_size, scaled_calories, scaled_macros = scaled_serving
                                item = MealItem(
                                    barcode=product.barcode,
                                    name=product.name,
                                    serving=scaled_size,
                                    calories=scaled_calories,
                                    macros=scaled_macros
                                )
                                selected_items.append(item)
                                current_calories += scaled_calories
                continue
            
            # Add item with full serving
            item = MealItem(
                barcode=product.barcode,
                name=product.name,
                serving=serving_size,
                calories=serving_calories,
                macros=serving_macros
            )
            selected_items.append(item)
            current_calories += serving_calories
            
            # Check if we've reached our target (within tolerance)
            min_allowed_calories = target_calories * (1 - actual_tolerance)
            if current_calories >= min_allowed_calories:
                break
        
        return selected_items
    
    def _calculate_serving_info(self, product: ProductResponse) -> Optional[Tuple[str, float, MealItemMacros]]:
        """
        Calculate serving size, calories, and macros for a product.
        
        Args:
            product: Product information
            
        Returns:
            Tuple of (serving_size_str, calories, macros) or None if incomplete data
        """
        nutriments = product.nutriments
        
        # Check if we have essential nutrition data
        if nutriments.energy_kcal_per_100g is None:
            return None
        
        # Determine serving size
        if product.serving_size:
            # Parse serving size (assume format like "150g", "1 cup", etc.)
            serving_size_str = product.serving_size
            # For simplicity, assume all serving sizes are in grams
            # In production, you'd need proper unit parsing
            try:
                if 'g' in serving_size_str:
                    serving_grams = float(serving_size_str.replace('g', '').strip())
                else:
                    # Default to 100g if we can't parse
                    serving_grams = 100.0
                    serving_size_str = "100g"
            except (ValueError, AttributeError):
                serving_grams = 100.0
                serving_size_str = "100g"
        else:
            # No serving size specified, assume 100g
            serving_grams = 100.0
            serving_size_str = "100g"
        
        # Calculate nutrition per serving
        scale_factor = serving_grams / 100.0
        calories = nutriments.energy_kcal_per_100g * scale_factor
        
        macros = MealItemMacros(
            protein_g=(nutriments.protein_g_per_100g or 0.0) * scale_factor,
            fat_g=(nutriments.fat_g_per_100g or 0.0) * scale_factor,
            carbs_g=(nutriments.carbs_g_per_100g or 0.0) * scale_factor,
            sugars_g=(nutriments.sugars_g_per_100g or 0.0) * scale_factor if nutriments.sugars_g_per_100g else None,
            salt_g=(nutriments.salt_g_per_100g or 0.0) * scale_factor if nutriments.salt_g_per_100g else None
        )
        
        return serving_size_str, calories, macros
    
    def _scale_serving(self, serving_size: str, calories: float, 
                      macros: MealItemMacros, scale_factor: float) -> Optional[Tuple[str, float, MealItemMacros]]:
        """
        Scale a serving down by a factor.
        
        Args:
            serving_size: Original serving size string
            calories: Original calories
            macros: Original macros
            scale_factor: Scale factor (0.0 to 1.0)
            
        Returns:
            Tuple of scaled (serving_size, calories, macros) or None
        """
        if scale_factor <= 0 or scale_factor > 1:
            return None
        
        # Scale the serving size string
        try:
            if 'g' in serving_size:
                original_grams = float(serving_size.replace('g', '').strip())
                new_grams = original_grams * scale_factor
                new_serving_size = f"{new_grams:.0f}g"
            else:
                new_serving_size = f"{scale_factor:.1f} × {serving_size}"
        except (ValueError, AttributeError):
            new_serving_size = f"{scale_factor:.1f} × {serving_size}"
        
        # Scale nutrition values
        new_calories = calories * scale_factor
        new_macros = MealItemMacros(
            protein_g=macros.protein_g * scale_factor,
            fat_g=macros.fat_g * scale_factor,
            carbs_g=macros.carbs_g * scale_factor,
            sugars_g=macros.sugars_g * scale_factor if macros.sugars_g else None,
            salt_g=macros.salt_g * scale_factor if macros.salt_g else None
        )
        
        return new_serving_size, new_calories, new_macros
    
    def _matches_preferences(self, product: ProductResponse, preferences) -> bool:
        """
        Check if product matches user preferences.
        
        This is a simplified implementation - in production you'd want:
        - Ingredient analysis
        - Allergen checking  
        - More sophisticated dietary restriction logic
        
        Args:
            product: Product to check
            preferences: User preferences (can be None)
            
        Returns:
            True if product matches preferences
        """
        # If no preferences, all products match
        if preferences is None:
            return True
        
        # For now, just do basic name-based filtering
        product_name_lower = (product.name or "").lower()
        brand_lower = (product.brand or "").lower()
        
        # Check excludes
        if hasattr(preferences, 'excludes') and preferences.excludes:
            for exclude in preferences.excludes:
                exclude_lower = exclude.lower()
                if exclude_lower in product_name_lower or exclude_lower in brand_lower:
                    logger.debug(f"Excluding product {product.name} due to exclude: {exclude}")
                    return False
        
        # Basic dietary restriction checking (very simplified)
        if hasattr(preferences, 'dietary_restrictions') and preferences.dietary_restrictions:
            for restriction in preferences.dietary_restrictions:
                restriction_lower = restriction.lower()
                if restriction_lower == "vegetarian":
                    # Skip meat products (basic keyword matching)
                    meat_keywords = ["chicken", "beef", "pork", "fish", "meat"]
                    if any(keyword in product_name_lower for keyword in meat_keywords):
                        logger.debug(f"Excluding meat product {product.name} for vegetarian")
                        return False
                elif restriction_lower == "vegan":
                    # Skip animal products (basic keyword matching)
                    animal_keywords = ["chicken", "beef", "pork", "fish", "meat", "milk", "cheese", "yogurt", "egg"]
                    if any(keyword in product_name_lower for keyword in animal_keywords):
                        logger.debug(f"Excluding animal product {product.name} for vegan")
                        return False
        
        return True
    
    def _calculate_daily_macros(self, meals: List[Meal]) -> DailyMacros:
        """
        Calculate total daily macros from all meals.
        
        Args:
            meals: List of meals
            
        Returns:
            DailyMacros object with totals and percentages
        """
        total_calories = 0.0
        total_protein = 0.0
        total_fat = 0.0
        total_carbs = 0.0
        total_sugars = 0.0
        total_salt = 0.0
        
        for meal in meals:
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
        
        return DailyMacros(
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
    
    def _create_empty_plan(self, bmr: float, tdee: float, daily_target: float, flexibility: bool) -> MealPlanResponse:
        """
        Create an empty meal plan when no products are available.
        """
        empty_macros = DailyMacros(
            total_calories=0.0, protein_g=0.0, fat_g=0.0, carbs_g=0.0,
            sugars_g=0.0, salt_g=0.0, protein_percent=0.0, fat_percent=0.0, carbs_percent=0.0
        )
        
        breakfast_target, lunch_target, dinner_target = nutrition_calculator.get_meal_targets(daily_target)
        
        return MealPlanResponse(
            bmr=bmr,
            tdee=tdee,
            daily_calorie_target=daily_target,
            meals=[
                Meal(name="Breakfast", target_calories=breakfast_target, actual_calories=0.0, items=[]),
                Meal(name="Lunch", target_calories=lunch_target, actual_calories=0.0, items=[]),
                Meal(name="Dinner", target_calories=dinner_target, actual_calories=0.0, items=[])
            ],
            metrics=empty_macros,
            flexibility_used=flexibility,
            optional_products_used=0
        )


meal_planner = MealPlannerService()
