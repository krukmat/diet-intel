"""
Métodos de refactorización para MealPlannerService
Fase 3: Reducción de Complejidad Cíclica
"""

# Métodos de refactorización para _build_meal
def _filter_products_by_preferences(self, products: List[ProductResponse], preferences) -> List[ProductResponse]:
    """
    Filter products based on user dietary preferences and restrictions.
    """
    if preferences is None:
        return products
    
    filtered_products = []
    
    for product in products:
        if self._matches_preferences(product, preferences):
            filtered_products.append(product)
        else:
            logger.debug(f"Filtered out product: {product.name} due to preferences")
    
    return filtered_products


def _apply_macro_constraints(self, products: List[ProductResponse], target_calories: float, 
                            current_calories: float, preferences) -> List[ProductResponse]:
    """
    Apply macro constraints to filter products for optimal nutritional balance.
    """
    if not products:
        return []
    
    remaining_calories = target_calories - current_calories
    constrained_products = []
    
    for product in products:
        serving_info = self._calculate_serving_info(product)
        if not serving_info:
            continue
        
        serving_size, serving_calories, serving_macros = serving_info
        
        # Skip if product would exceed remaining calories by too much
        if serving_calories > remaining_calories * 1.5:  # 50% tolerance
            continue
        
        # Apply nutritional balance constraints
        if self._meets_macro_requirements(serving_macros, remaining_calories, preferences):
            constrained_products.append(product)
    
    return constrained_products


def _meets_macro_requirements(self, macros: MealItemMacros, remaining_calories: float, 
                             preferences) -> bool:
    """
    Check if macros meet nutritional requirements.
    """
    # Check for excessive sugar (more than 30% of calories)
    if macros.sugars_g and macros.sugars_g > 0:
        sugar_calories = macros.sugars_g * 4  # 4 calories per gram sugar
        sugar_percentage = (sugar_calories / max(remaining_calories, 1)) * 100
        
        if sugar_percentage > 30:  # More than 30% sugar
            return False
    
    # Check for reasonable fat content (not excessive)
    if macros.fat_g > 0:
        fat_calories = macros.fat_g * 9  # 9 calories per gram fat
        fat_percentage = (fat_calories / max(remaining_calories, 1)) * 100
        
        if fat_percentage > 60:  # More than 60% fat (very fatty)
            return False
    
    return True


def _score_product_for_meal(self, product: ProductResponse, target_calories: float, 
                           current_calories: float, preferences) -> float:
    """
    Calculate a score for how well a product fits a meal.
    """
    # Base score starts at 0.5
    score = 0.5
    
    # Calculate serving info
    serving_info = self._calculate_serving_info(product)
    if not serving_info:
        return 0.0  # No nutrition data, very poor score
    
    serving_size, serving_calories, serving_macros = serving_info
    
    # Score based on calorie fit
    remaining_calories = target_calories - current_calories
    if remaining_calories > 0:
        # Perfect fit would be exact match
        calorie_diff = abs(serving_calories - remaining_calories)
        calorie_score = max(0.0, 1.0 - (calorie_diff / max(remaining_calories, 1.0)))
        score += calorie_score * 0.3  # 30% weight on calorie fit
    else:
        # Already over target, penalize heavily
        score -= 0.3
    
    # Score based on nutritional balance
    if serving_macros.protein_g > 0:
        score += 0.1  # Bonus for protein
    if serving_macros.carbs_g > 0:
        score += 0.05  # Small bonus for carbs
    if serving_macros.fat_g > 0:
        score += 0.05  # Small bonus for fat
    
    return max(0.0, min(1.0, score))  # Clamp between 0 and 1


def _pick_best_products(self, products: List[ProductResponse], target_calories: float, 
                       max_items: int, preferences) -> List[ProductResponse]:
    """
    Pick the best products for a meal using scoring algorithm.
    """
    if not products:
        return []
    
    # Score all products
    scored_products = []
    for product in products:
        score = self._score_product_for_meal(product, target_calories, 0.0, preferences)
        if score > 0.3:  # Minimum threshold
            scored_products.append((product, score))
    
    # Sort by score (highest first)
    scored_products.sort(key=lambda x: x[1], reverse=True)
    
    # Select top products, but ensure we don't exceed calorie target
    selected_products = []
    total_calories = 0.0
    
    for product, score in scored_products[:max_items * 2]:  # Consider more options
        serving_info = self._calculate_serving_info(product)
        if serving_info:
            serving_size, serving_calories, serving_macros = serving_info
            if total_calories + serving_calories <= target_calories * 1.1:  # 10% tolerance
                selected_products.append(product)
                total_calories += serving_calories
                
                if len(selected_products) >= max_items:
                    break
    
    return selected_products


def _build_meal_refactored(self, meal_name: str, target_calories: float, 
                          available_products: List[ProductResponse],
                          optional_products: List[str], flexibility: bool,
                          preferences) -> Meal:
    """
    Build a single meal using refactored pipeline approach.
    """
    # Set constraints based on flexibility
    max_items = self.config.max_items_flexible if flexibility else self.config.max_items_per_meal
    tolerance = self.config.calorie_tolerance_flexible if flexibility else self.config.calorie_tolerance_strict
    
    # Pipeline: Filter -> Score -> Select -> Build
    
    # Step 1: Filter products by preferences
    filtered_products = self._filter_products_by_preferences(available_products, preferences)
    
    # Step 2: Apply macro constraints
    constrained_products = self._apply_macro_constraints(filtered_products, target_calories, 0.0, preferences)
    
    # Step 3: Select best products using scoring
    selected_products = self._pick_best_products(constrained_products, target_calories, max_items, preferences)
    
    # Step 4: Build meal items with validation
    selected_items = []
    current_calories = 0.0
    
    for product in selected_products:
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
