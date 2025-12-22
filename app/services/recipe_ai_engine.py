"""
Recipe AI Engine - Intelligent Recipe Generation System
Extends Smart Diet engine with recipe creation and optimization capabilities
"""

import asyncio
import logging
import random
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
import json

from .smart_diet_optimized import SmartDietEngine
from .nutrition_calculator import NutritionCalculator
from .performance_monitor import performance_monitor
from .redis_cache import redis_cache_service
from .recipe_translation_service import get_recipe_translation_service

logger = logging.getLogger(__name__)


@dataclass
class RecipeIngredient:
    """Single ingredient in a recipe"""
    name: str
    quantity: float
    unit: str
    barcode: Optional[str] = None
    calories_per_unit: float = 0.0
    protein_g_per_unit: float = 0.0
    fat_g_per_unit: float = 0.0
    carbs_g_per_unit: float = 0.0
    is_optional: bool = False
    preparation_note: Optional[str] = None


@dataclass
class RecipeInstruction:
    """Single cooking instruction step"""
    step_number: int
    instruction: str
    cooking_method: str
    duration_minutes: Optional[int] = None
    temperature_celsius: Optional[int] = None


@dataclass
class RecipeNutrition:
    """Nutritional analysis of complete recipe"""
    calories_per_serving: float
    protein_g_per_serving: float
    fat_g_per_serving: float
    carbs_g_per_serving: float
    fiber_g_per_serving: float = 0.0
    sugar_g_per_serving: float = 0.0
    sodium_mg_per_serving: float = 0.0
    recipe_score: float = 0.0  # Overall nutritional quality score


@dataclass
class GeneratedRecipe:
    """Complete AI-generated recipe"""
    id: str
    name: str
    description: str
    cuisine_type: str
    difficulty_level: str  # easy, medium, hard
    prep_time_minutes: int
    cook_time_minutes: int
    servings: int
    ingredients: List[RecipeIngredient]
    instructions: List[RecipeInstruction]
    nutrition: Optional[RecipeNutrition] = None
    created_by: str = "ai_generated"
    confidence_score: float = 0.0
    generation_time_ms: float = 0.0
    tags: List[str] = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []


@dataclass
class RecipeGenerationRequest:
    """Request parameters for recipe generation"""
    user_id: Optional[str] = None
    target_calories_per_serving: Optional[float] = None
    target_protein_g: Optional[float] = None
    target_carbs_g: Optional[float] = None
    target_fat_g: Optional[float] = None
    available_ingredients: List[str] = None
    dietary_restrictions: List[str] = None
    cuisine_preferences: List[str] = None
    excluded_ingredients: List[str] = None
    difficulty_preference: str = "easy"  # easy, medium, hard, any
    max_prep_time_minutes: Optional[int] = None
    max_cook_time_minutes: Optional[int] = None
    servings: int = 4
    meal_type: Optional[str] = None  # breakfast, lunch, dinner, snack
    target_language: str = "en"
    
    def __post_init__(self):
        if self.available_ingredients is None:
            self.available_ingredients = []
        if self.dietary_restrictions is None:
            self.dietary_restrictions = []
        if self.cuisine_preferences is None:
            self.cuisine_preferences = []
        if self.excluded_ingredients is None:
            self.excluded_ingredients = []


class RecipeGenerator:
    """Core recipe generation logic with AI algorithms"""
    
    def __init__(self):
        self.cooking_methods = {
            "easy": ["boil", "steam", "bake", "pan_fry", "microwave"],
            "medium": ["saute", "grill", "roast", "simmer", "blanch"],
            "hard": ["braise", "sous_vide", "deep_fry", "flambé", "confit"]
        }
        
        self.cuisine_ingredients = {
            "mediterranean": ["olive_oil", "tomatoes", "basil", "garlic", "lemon"],
            "asian": ["soy_sauce", "ginger", "garlic", "sesame_oil", "rice"],
            "mexican": ["cumin", "chili_powder", "lime", "cilantro", "black_beans"],
            "italian": ["pasta", "parmesan", "basil", "tomatoes", "olive_oil"],
            "indian": ["turmeric", "cumin", "coriander", "garam_masala", "onions"]
        }
        
        # Base ingredient nutrition database (simplified)
        self.ingredient_nutrition = {
            "chicken_breast": {"calories": 165, "protein": 31, "fat": 3.6, "carbs": 0},
            "salmon": {"calories": 208, "protein": 22, "fat": 13, "carbs": 0},
            "quinoa": {"calories": 120, "protein": 4.4, "fat": 1.9, "carbs": 22},
            "brown_rice": {"calories": 112, "protein": 2.3, "fat": 0.9, "carbs": 23},
            "broccoli": {"calories": 25, "protein": 3, "fat": 0.3, "carbs": 5},
            "spinach": {"calories": 7, "protein": 0.9, "fat": 0.1, "carbs": 1.1},
            "olive_oil": {"calories": 884, "protein": 0, "fat": 100, "carbs": 0},
            "avocado": {"calories": 160, "protein": 2, "fat": 15, "carbs": 9},
            "eggs": {"calories": 155, "protein": 13, "fat": 11, "carbs": 1.1},
            "greek_yogurt": {"calories": 100, "protein": 10, "fat": 0.4, "carbs": 6}
        }
    
    async def generate_recipe_base(self, request: RecipeGenerationRequest) -> GeneratedRecipe:
        """Generate base recipe structure with AI logic"""
        
        # Determine cuisine type based on preferences
        cuisine_type = self._select_cuisine_type(request.cuisine_preferences)
        
        # Generate recipe name and description
        recipe_name = self._generate_recipe_name(cuisine_type, request.meal_type)
        description = self._generate_description(recipe_name, cuisine_type)
        
        # Select ingredients based on nutritional targets and preferences
        ingredients = await self._select_recipe_ingredients(request, cuisine_type)
        
        # Generate cooking instructions
        instructions = self._generate_cooking_instructions(ingredients, request.difficulty_preference)
        
        # Calculate nutritional profile
        nutrition = self._calculate_recipe_nutrition(ingredients, request.servings)
        
        # Determine timing based on complexity
        prep_time, cook_time = self._estimate_cooking_times(ingredients, instructions)
        
        recipe = GeneratedRecipe(
            id=f"recipe_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{random.randint(1000, 9999)}",
            name=recipe_name,
            description=description,
            cuisine_type=cuisine_type,
            difficulty_level=request.difficulty_preference,
            prep_time_minutes=prep_time,
            cook_time_minutes=cook_time,
            servings=request.servings,
            ingredients=ingredients,
            instructions=instructions,
            nutrition=nutrition,
            confidence_score=self._calculate_confidence_score(ingredients, nutrition, request),
            tags=self._generate_recipe_tags(cuisine_type, ingredients, request.meal_type)
        )
        
        return recipe
    
    def _select_cuisine_type(self, preferences: List[str]) -> str:
        """Select cuisine type based on user preferences"""
        if preferences and preferences[0].lower() in self.cuisine_ingredients:
            return preferences[0].lower()
        return random.choice(list(self.cuisine_ingredients.keys()))
    
    def _generate_recipe_name(self, cuisine_type: str, meal_type: Optional[str]) -> str:
        """Generate AI recipe name based on cuisine and meal type"""
        cuisine_names = {
            "mediterranean": ["Mediterranean Bowl", "Greek Style Dish", "Tuscan Inspired"],
            "asian": ["Asian Fusion Bowl", "Stir-Fry Delight", "Asian Style"],
            "mexican": ["Mexican Bowl", "Tex-Mex Style", "Latin Inspired"],
            "italian": ["Italian Classic", "Tuscan Style", "Italian Inspired"],
            "indian": ["Indian Spiced", "Curry Style", "Indian Fusion"]
        }
        
        base_names = cuisine_names.get(cuisine_type, ["Healthy Recipe"])
        meal_prefix = ""
        
        if meal_type:
            meal_prefix = f"{meal_type.title()} "
        
        return f"{meal_prefix}{random.choice(base_names)}"
    
    def _generate_description(self, name: str, cuisine_type: str) -> str:
        """Generate recipe description"""
        descriptions = {
            "mediterranean": "A fresh and healthy Mediterranean-inspired dish packed with nutritious ingredients and vibrant flavors.",
            "asian": "An Asian-inspired recipe combining fresh ingredients with authentic flavors and balanced nutrition.",
            "mexican": "A delicious Mexican-style dish with bold flavors and healthy ingredients for a satisfying meal.",
            "italian": "A classic Italian-inspired recipe featuring fresh ingredients and traditional cooking methods.",
            "indian": "An aromatic Indian-style dish with warming spices and nutritious ingredients."
        }
        
        return descriptions.get(cuisine_type, "A healthy and delicious recipe created with fresh, nutritious ingredients.")
    
    async def _select_recipe_ingredients(self, request: RecipeGenerationRequest, cuisine_type: str) -> List[RecipeIngredient]:
        """Select ingredients based on nutritional targets and cuisine"""
        ingredients = []
        
        # Start with cuisine base ingredients
        base_ingredients = self.cuisine_ingredients.get(cuisine_type, [])
        
        # Add protein source
        protein_options = ["chicken_breast", "salmon", "eggs", "greek_yogurt"]
        if "vegetarian" in request.dietary_restrictions:
            protein_options = ["eggs", "greek_yogurt", "quinoa"]
        if "vegan" in request.dietary_restrictions:
            protein_options = ["quinoa"]
        
        protein = random.choice(protein_options)
        nutrition = self.ingredient_nutrition.get(protein, {"calories": 100, "protein": 10, "fat": 5, "carbs": 5})
        ingredients.append(RecipeIngredient(
            name=protein.replace("_", " ").title(),
            quantity=150.0,
            unit="g",
            calories_per_unit=nutrition.get("calories", 100),
            protein_g_per_unit=nutrition.get("protein", 10),
            fat_g_per_unit=nutrition.get("fat", 5),
            carbs_g_per_unit=nutrition.get("carbs", 5)
        ))
        
        # Add carbohydrate source
        carb_options = ["quinoa", "brown_rice"]
        carb = random.choice(carb_options)
        nutrition = self.ingredient_nutrition.get(carb, {"calories": 100, "protein": 3, "fat": 1, "carbs": 20})
        ingredients.append(RecipeIngredient(
            name=carb.replace("_", " ").title(),
            quantity=75.0,
            unit="g",
            calories_per_unit=nutrition.get("calories", 100),
            protein_g_per_unit=nutrition.get("protein", 3),
            fat_g_per_unit=nutrition.get("fat", 1),
            carbs_g_per_unit=nutrition.get("carbs", 20)
        ))
        
        # Add vegetables
        vegetable_options = ["broccoli", "spinach"]
        vegetable = random.choice(vegetable_options)
        nutrition = self.ingredient_nutrition.get(vegetable, {"calories": 20, "protein": 2, "fat": 0, "carbs": 4})
        ingredients.append(RecipeIngredient(
            name=vegetable.replace("_", " ").title(),
            quantity=100.0,
            unit="g",
            calories_per_unit=nutrition.get("calories", 20),
            protein_g_per_unit=nutrition.get("protein", 2),
            fat_g_per_unit=nutrition.get("fat", 0),
            carbs_g_per_unit=nutrition.get("carbs", 4)
        ))
        
        # Add healthy fat
        if "olive_oil" in base_ingredients:
            nutrition = self.ingredient_nutrition.get("olive_oil", {"calories": 884, "protein": 0, "fat": 100, "carbs": 0})
            ingredients.append(RecipeIngredient(
                name="Olive Oil",
                quantity=10.0,
                unit="ml",
                calories_per_unit=nutrition.get("calories", 884),
                protein_g_per_unit=nutrition.get("protein", 0),
                fat_g_per_unit=nutrition.get("fat", 100),
                carbs_g_per_unit=nutrition.get("carbs", 0)
            ))
        
        return ingredients
    
    def _generate_cooking_instructions(self, ingredients: List[RecipeIngredient], difficulty: str) -> List[RecipeInstruction]:
        """Generate step-by-step cooking instructions"""
        instructions = []
        
        instructions.append(RecipeInstruction(
            step_number=1,
            instruction="Prepare all ingredients by washing and chopping as needed.",
            cooking_method="prep",
            duration_minutes=10
        ))
        
        instructions.append(RecipeInstruction(
            step_number=2,
            instruction="Heat olive oil in a large pan over medium heat.",
            cooking_method="heat",
            duration_minutes=2
        ))
        
        instructions.append(RecipeInstruction(
            step_number=3,
            instruction="Cook protein until golden brown and cooked through.",
            cooking_method="pan_fry",
            duration_minutes=8
        ))
        
        instructions.append(RecipeInstruction(
            step_number=4,
            instruction="Add vegetables and cook until tender.",
            cooking_method="saute",
            duration_minutes=5
        ))
        
        instructions.append(RecipeInstruction(
            step_number=5,
            instruction="Serve hot with grain of choice. Season to taste.",
            cooking_method="serve",
            duration_minutes=1
        ))
        
        return instructions
    
    def _calculate_recipe_nutrition(self, ingredients: List[RecipeIngredient], servings: int) -> RecipeNutrition:
        """Calculate total nutritional profile for recipe"""
        total_calories = sum(ing.calories_per_unit * ing.quantity / 100 for ing in ingredients)
        total_protein = sum(ing.protein_g_per_unit * ing.quantity / 100 for ing in ingredients)
        total_fat = sum(ing.fat_g_per_unit * ing.quantity / 100 for ing in ingredients)
        total_carbs = sum(ing.carbs_g_per_unit * ing.quantity / 100 for ing in ingredients)
        
        return RecipeNutrition(
            calories_per_serving=total_calories / servings,
            protein_g_per_serving=total_protein / servings,
            fat_g_per_serving=total_fat / servings,
            carbs_g_per_serving=total_carbs / servings,
            fiber_g_per_serving=total_carbs * 0.1 / servings,  # Estimate
            recipe_score=self._calculate_nutrition_score(total_calories/servings, total_protein/servings, total_fat/servings, total_carbs/servings)
        )
    
    def _calculate_nutrition_score(self, calories: float, protein: float, fat: float, carbs: float) -> float:
        """Calculate overall nutritional quality score (0-1)"""
        # Simple scoring based on macro balance
        protein_ratio = protein * 4 / calories if calories > 0 else 0
        fat_ratio = fat * 9 / calories if calories > 0 else 0
        carbs_ratio = carbs * 4 / calories if calories > 0 else 0
        
        # Ideal ratios (protein: 20-30%, fat: 25-35%, carbs: 45-55%)
        protein_score = 1.0 - abs(protein_ratio - 0.25) * 2
        fat_score = 1.0 - abs(fat_ratio - 0.30) * 2
        carbs_score = 1.0 - abs(carbs_ratio - 0.45) * 2
        
        return max(0, (protein_score + fat_score + carbs_score) / 3)
    
    def _estimate_cooking_times(self, ingredients: List[RecipeIngredient], instructions: List[RecipeInstruction]) -> Tuple[int, int]:
        """Estimate preparation and cooking times"""
        prep_time = 15  # Base prep time
        cook_time = sum(inst.duration_minutes or 0 for inst in instructions if inst.cooking_method != "prep")
        
        return prep_time, cook_time
    
    def _calculate_confidence_score(self, ingredients: List[RecipeIngredient], nutrition: RecipeNutrition, request: RecipeGenerationRequest) -> float:
        """Calculate AI confidence in generated recipe"""
        score = 0.8  # Base confidence
        
        # Adjust based on nutritional targets match
        if request.target_calories_per_serving:
            calorie_diff = abs(nutrition.calories_per_serving - request.target_calories_per_serving) / request.target_calories_per_serving
            score -= calorie_diff * 0.2
        
        # Adjust based on ingredient availability
        if request.available_ingredients:
            available_count = sum(1 for ing in ingredients if any(avail.lower() in ing.name.lower() for avail in request.available_ingredients))
            availability_ratio = available_count / len(ingredients)
            score = score * 0.7 + availability_ratio * 0.3
        
        return max(0.3, min(1.0, score))
    
    def _generate_recipe_tags(self, cuisine_type: str, ingredients: List[RecipeIngredient], meal_type: Optional[str]) -> List[str]:
        """Generate descriptive tags for recipe"""
        tags = [cuisine_type]
        
        if meal_type:
            tags.append(meal_type)
        
        # Add nutritional tags
        if any("quinoa" in ing.name.lower() for ing in ingredients):
            tags.append("high_protein")
        
        if any("salmon" in ing.name.lower() for ing in ingredients):
            tags.append("omega_3")
        
        tags.extend(["healthy", "ai_generated", "balanced_nutrition"])
        
        return tags


class IngredientOptimizer:
    """Optimizes ingredient selection for nutritional balance"""
    
    def __init__(self):
        self.nutrition_calculator = NutritionCalculator()
    
    async def optimize_ingredients_for_target(self, 
                                            base_ingredients: List[RecipeIngredient], 
                                            target_nutrition: Dict[str, float]) -> List[RecipeIngredient]:
        """Optimize ingredient quantities to meet nutritional targets"""
        optimized_ingredients = base_ingredients.copy()
        
        # Simple optimization: adjust quantities proportionally
        current_calories = sum(ing.calories_per_unit * ing.quantity / 100 for ing in optimized_ingredients)
        target_calories = target_nutrition.get("calories", current_calories)
        
        if current_calories > 0:
            scale_factor = target_calories / current_calories
            
            for ingredient in optimized_ingredients:
                ingredient.quantity *= scale_factor
        
        return optimized_ingredients
    
    async def suggest_ingredient_substitutions(self, 
                                             ingredient: RecipeIngredient, 
                                             dietary_restrictions: List[str]) -> List[RecipeIngredient]:
        """Suggest alternative ingredients based on dietary restrictions"""
        substitutions = []
        
        # Simple substitution logic
        if "vegetarian" in dietary_restrictions and "chicken" in ingredient.name.lower():
            substitutions.append(RecipeIngredient(
                name="Tofu",
                quantity=ingredient.quantity,
                unit=ingredient.unit,
                calories_per_unit=70,
                protein_g_per_unit=8,
                fat_g_per_unit=4,
                carbs_g_per_unit=2
            ))
        
        if "vegan" in dietary_restrictions and "yogurt" in ingredient.name.lower():
            substitutions.append(RecipeIngredient(
                name="Coconut Yogurt",
                quantity=ingredient.quantity,
                unit=ingredient.unit,
                calories_per_unit=60,
                protein_g_per_unit=1,
                fat_g_per_unit=4,
                carbs_g_per_unit=7
            ))
        
        return substitutions


class CookingMethodAnalyzer:
    """Analyzes and suggests optimal cooking methods"""
    
    def __init__(self):
        self.method_nutrition_impact = {
            "steam": {"health_score": 0.9, "nutrient_retention": 0.95},
            "bake": {"health_score": 0.8, "nutrient_retention": 0.85},
            "grill": {"health_score": 0.7, "nutrient_retention": 0.80},
            "pan_fry": {"health_score": 0.6, "nutrient_retention": 0.75},
            "deep_fry": {"health_score": 0.3, "nutrient_retention": 0.60}
        }
    
    async def suggest_optimal_cooking_method(self, 
                                           ingredient: RecipeIngredient, 
                                           health_priority: float = 0.8) -> str:
        """Suggest best cooking method based on health and nutrition priorities"""
        
        # For proteins, suggest healthier methods
        if any(protein in ingredient.name.lower() for protein in ["chicken", "fish", "salmon"]):
            if health_priority > 0.7:
                return "bake"
            else:
                return "grill"
        
        # For vegetables, prioritize nutrient retention
        if any(veg in ingredient.name.lower() for veg in ["broccoli", "spinach", "vegetables"]):
            return "steam"
        
        return "saute"  # Default method


class NutritionalOptimizer:
    """Optimizes recipes for specific nutritional goals"""
    
    async def optimize_for_goal(self, 
                               recipe: GeneratedRecipe, 
                               goal: str) -> GeneratedRecipe:
        """Optimize recipe based on specific health/fitness goal"""
        
        if goal == "weight_loss":
            # Reduce calorie density, increase protein and fiber
            return await self._optimize_for_weight_loss(recipe)
        elif goal == "muscle_gain":
            # Increase protein content
            return await self._optimize_for_muscle_gain(recipe)
        elif goal == "heart_health":
            # Optimize fat sources, reduce sodium
            return await self._optimize_for_heart_health(recipe)
        
        return recipe
    
    async def _optimize_for_weight_loss(self, recipe: GeneratedRecipe) -> GeneratedRecipe:
        """Optimize recipe for weight loss goals"""
        # Increase vegetable content, reduce calorie-dense ingredients
        for ingredient in recipe.ingredients:
            if "oil" in ingredient.name.lower():
                ingredient.quantity *= 0.7  # Reduce oil by 30%
            elif any(veg in ingredient.name.lower() for veg in ["broccoli", "spinach"]):
                ingredient.quantity *= 1.3  # Increase vegetables by 30%
        
        # Recalculate nutrition
        recipe.nutrition = RecipeGenerator()._calculate_recipe_nutrition(recipe.ingredients, recipe.servings)
        recipe.tags.append("weight_loss_friendly")
        
        return recipe
    
    async def _optimize_for_muscle_gain(self, recipe: GeneratedRecipe) -> GeneratedRecipe:
        """Optimize recipe for muscle gain goals"""
        # Increase protein sources
        for ingredient in recipe.ingredients:
            if any(protein in ingredient.name.lower() for protein in ["chicken", "salmon", "eggs"]):
                ingredient.quantity *= 1.2  # Increase protein by 20%
        
        recipe.nutrition = RecipeGenerator()._calculate_recipe_nutrition(recipe.ingredients, recipe.servings)
        recipe.tags.append("high_protein")
        
        return recipe
    
    async def _optimize_for_heart_health(self, recipe: GeneratedRecipe) -> GeneratedRecipe:
        """Optimize recipe for heart health"""
        # Focus on healthy fats, reduce sodium
        for ingredient in recipe.ingredients:
            if "oil" in ingredient.name.lower():
                ingredient.name = "Extra Virgin Olive Oil"  # Specify healthy oil
        
        recipe.tags.extend(["heart_healthy", "anti_inflammatory"])
        
        return recipe


class RecipeAIEngine:
    """
    Main Recipe AI Engine class extending Smart Diet capabilities
    Provides intelligent recipe generation, optimization, and analysis
    """
    
    def __init__(self):
        # Leverage existing Smart Diet components
        self.smart_diet_engine = SmartDietEngine()
        self.nutrition_calculator = NutritionCalculator()

        # New recipe-specific components
        self.recipe_generator = RecipeGenerator()
        self.ingredient_optimizer = IngredientOptimizer()
        self.cooking_method_analyzer = CookingMethodAnalyzer()
        self.nutritional_optimizer = NutritionalOptimizer()

        # Spanish translation service
        self.translation_service = get_recipe_translation_service()
    
    async def generate_recipe(self, request: RecipeGenerationRequest) -> GeneratedRecipe:
        """
        AI-powered recipe generation with nutritional optimization
        Main entry point for recipe creation
        """
        start_time = datetime.now()
        
        try:
            async with performance_monitor.measure_api_call("recipe_generation", {"user_id": request.user_id}):
                
                # Check cache first
                cache_key = self._generate_cache_key(request)
                cached_recipe = None
                try:
                    cached_recipe = await redis_cache_service.get(cache_key)
                except Exception as e:
                    logger.warning(f"Cache read failed for {cache_key}: {e}")
                
                if cached_recipe:
                    logger.info(f"Recipe cache hit for request: {cache_key}")
                    return GeneratedRecipe(**json.loads(cached_recipe))
                
                # Generate base recipe
                recipe = await self.recipe_generator.generate_recipe_base(request)
                
                # Optimize ingredients if targets specified
                if any([request.target_calories_per_serving, request.target_protein_g, request.target_carbs_g]):
                    target_nutrition = {
                        "calories": request.target_calories_per_serving or recipe.nutrition.calories_per_serving,
                        "protein": request.target_protein_g or recipe.nutrition.protein_g_per_serving,
                        "carbs": request.target_carbs_g or recipe.nutrition.carbs_g_per_serving,
                        "fat": request.target_fat_g or recipe.nutrition.fat_g_per_serving
                    }
                    
                    recipe.ingredients = await self.ingredient_optimizer.optimize_ingredients_for_target(
                        recipe.ingredients, target_nutrition
                    )
                    
                    # Recalculate nutrition after optimization
                    recipe.nutrition = self.recipe_generator._calculate_recipe_nutrition(
                        recipe.ingredients, recipe.servings
                    )
                
                # Calculate generation time
                generation_time = (datetime.now() - start_time).total_seconds() * 1000
                recipe.generation_time_ms = generation_time
                
                # Cache the generated recipe
                try:
                    await redis_cache_service.set(
                        cache_key, 
                        json.dumps(asdict(recipe)), 
                        ttl=3600  # 1 hour cache for generated recipes
                    )
                except Exception as e:
                    logger.warning(f"Cache write failed for {cache_key}: {e}")
                
                logger.info(f"Generated recipe '{recipe.name}' in {generation_time:.1f}ms")
                
                return recipe
                
        except Exception as e:
            logger.error(f"Error generating recipe: {e}")
            raise
    
    async def optimize_existing_recipe(self, recipe_data: Dict[str, Any], goal: str = "balanced") -> GeneratedRecipe:
        """
        Improve nutritional profile of existing user recipes
        """
        try:
            async with performance_monitor.measure_api_call("recipe_optimization", {"goal": goal}):
                
                # Convert input to GeneratedRecipe format
                recipe = self._convert_to_generated_recipe(recipe_data)
                
                # Apply goal-specific optimization
                optimized_recipe = await self.nutritional_optimizer.optimize_for_goal(recipe, goal)
                
                # Update confidence score based on optimization
                optimized_recipe.confidence_score = min(1.0, recipe.confidence_score + 0.1)
                optimized_recipe.tags.append("optimized")
                
                logger.info(f"Optimized recipe '{recipe.name}' for goal: {goal}")
                
                return optimized_recipe
                
        except Exception as e:
            logger.error(f"Error optimizing recipe: {e}")
            raise
    
    async def generate_shopping_list(self, recipes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Create optimized ingredient lists for multiple recipes
        """
        try:
            async with performance_monitor.measure_api_call("shopping_list_generation", {"recipe_count": len(recipes)}):
                
                # Consolidate ingredients across recipes
                consolidated_ingredients = {}
                
                for recipe_data in recipes:
                    recipe = self._convert_to_generated_recipe(recipe_data)
                    
                    for ingredient in recipe.ingredients:
                        key = ingredient.name.lower()
                        
                        if key in consolidated_ingredients:
                            # Add quantities (simple addition for now)
                            consolidated_ingredients[key]["quantity"] += ingredient.quantity
                            consolidated_ingredients[key]["recipes"].append(recipe.name)
                        else:
                            consolidated_ingredients[key] = {
                                "name": ingredient.name,
                                "quantity": ingredient.quantity,
                                "unit": ingredient.unit,
                                "recipes": [recipe.name]
                            }
                
                # Format shopping list
                shopping_list = {
                    "ingredients": list(consolidated_ingredients.values()),
                    "total_items": len(consolidated_ingredients),
                    "estimated_cost": self._estimate_shopping_cost(consolidated_ingredients),
                    "generated_at": datetime.now().isoformat()
                }
                
                logger.info(f"Generated shopping list with {len(consolidated_ingredients)} items")
                
                return shopping_list
                
        except Exception as e:
            logger.error(f"Error generating shopping list: {e}")
            raise
    
    def _generate_cache_key(self, request: RecipeGenerationRequest) -> str:
        """Generate cache key for recipe request"""
        key_parts = [
            f"recipe_gen",
            f"cal_{request.target_calories_per_serving or 'any'}",
            f"prot_{request.target_protein_g or 'any'}",
            f"diff_{request.difficulty_preference}",
            f"serv_{request.servings}",
            f"meal_{request.meal_type or 'any'}",
            "_".join(sorted(request.dietary_restrictions)),
            "_".join(sorted(request.cuisine_preferences))
        ]
        return "_".join(key_parts)
    
    def _convert_to_generated_recipe(self, recipe_data: Dict[str, Any]) -> GeneratedRecipe:
        """Convert generic recipe data to GeneratedRecipe format"""
        
        # Extract ingredients
        ingredients = []
        for ing_data in recipe_data.get("ingredients", []):
            ingredients.append(RecipeIngredient(
                name=ing_data.get("name", "Unknown"),
                quantity=float(ing_data.get("quantity", 100)),
                unit=ing_data.get("unit", "g"),
                calories_per_unit=float(ing_data.get("calories_per_unit", 0)),
                protein_g_per_unit=float(ing_data.get("protein_g_per_unit", 0)),
                fat_g_per_unit=float(ing_data.get("fat_g_per_unit", 0)),
                carbs_g_per_unit=float(ing_data.get("carbs_g_per_unit", 0))
            ))
        
        # Extract instructions
        instructions = []
        for i, inst_data in enumerate(recipe_data.get("instructions", [])):
            instructions.append(RecipeInstruction(
                step_number=i + 1,
                instruction=inst_data.get("instruction", ""),
                cooking_method=inst_data.get("cooking_method", "cook")
            ))
        
        # Calculate nutrition
        nutrition = self.recipe_generator._calculate_recipe_nutrition(
            ingredients, recipe_data.get("servings", 4)
        )
        
        return GeneratedRecipe(
            id=recipe_data.get("id", f"recipe_{datetime.now().strftime('%Y%m%d_%H%M%S')}"),
            name=recipe_data.get("name", "Custom Recipe"),
            description=recipe_data.get("description", "User-provided recipe"),
            cuisine_type=recipe_data.get("cuisine_type", "international"),
            difficulty_level=recipe_data.get("difficulty_level", "medium"),
            prep_time_minutes=recipe_data.get("prep_time_minutes", 20),
            cook_time_minutes=recipe_data.get("cook_time_minutes", 30),
            servings=recipe_data.get("servings", 4),
            ingredients=ingredients,
            instructions=instructions,
            nutrition=nutrition,
            created_by="user_provided",
            confidence_score=0.7  # Default confidence for user recipes
        )
    
    def _estimate_shopping_cost(self, ingredients: Dict[str, Any]) -> float:
        """Estimate total cost of shopping list (simplified)"""
        # Simple cost estimation based on ingredient types
        cost_estimates = {
            "chicken": 8.0,
            "salmon": 12.0,
            "quinoa": 5.0,
            "rice": 3.0,
            "broccoli": 4.0,
            "spinach": 3.0,
            "oil": 6.0,
            "yogurt": 5.0
        }
        
        total_cost = 0.0
        for ingredient_data in ingredients.values():
            ingredient_name = ingredient_data["name"].lower()
            
            # Find matching cost estimate
            for key, cost in cost_estimates.items():
                if key in ingredient_name:
                    total_cost += cost
                    break
            else:
                total_cost += 4.0  # Default cost for unknown ingredients
        
        return round(total_cost, 2)

    async def generate_recipe_with_translation(self, request: RecipeGenerationRequest) -> GeneratedRecipe:
        """
        Generate recipe and translate to target language if specified
        Enhanced version that supports Spanish translation
        """
        # Generate the base recipe in English
        base_recipe = await self.generate_recipe(request)

        # If target language is Spanish, translate the recipe
        if hasattr(request, 'target_language') and request.target_language == "es":
            try:
                logger.info(f"Translating recipe '{base_recipe.name}' to Spanish")
                translated_recipe = await self.translation_service.translate_complete_recipe(base_recipe)
                logger.info(f"Successfully translated recipe to Spanish: {translated_recipe.name}")
                return translated_recipe
            except Exception as e:
                logger.error(f"Failed to translate recipe to Spanish: {e}")
                # Return original recipe if translation fails
                return base_recipe

        # Return original recipe if no translation needed
        return base_recipe

    async def translate_existing_recipe(self, recipe: GeneratedRecipe, target_language: str = "es") -> GeneratedRecipe:
        """
        Translate an existing recipe to Spanish
        """
        if target_language == "es":
            try:
                logger.info(f"Translating existing recipe '{recipe.name}' to Spanish")
                translated_recipe = await self.translation_service.translate_complete_recipe(recipe)
                logger.info(f"Successfully translated existing recipe: {translated_recipe.name}")
                return translated_recipe
            except Exception as e:
                logger.error(f"Failed to translate existing recipe to Spanish: {e}")
                raise Exception(f"Translation failed: {str(e)}")
        else:
            raise ValueError(f"Unsupported target language: {target_language}")

    async def batch_translate_recipes(self, recipes: List[GeneratedRecipe], target_language: str = "es") -> Dict[str, Optional[GeneratedRecipe]]:
        """
        Translate multiple recipes to Spanish
        """
        if target_language == "es":
            return await self.translation_service.batch_translate_recipes(recipes)
        else:
            raise ValueError(f"Unsupported target language: {target_language}")


# Singleton instance
recipe_ai_engine = RecipeAIEngine()
