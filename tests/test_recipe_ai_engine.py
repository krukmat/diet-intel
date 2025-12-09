"""
Comprehensive test suite for Recipe AI Engine
Tests recipe generation, optimization, and intelligence algorithms
"""

import pytest
import asyncio
import json
import copy
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock, MagicMock

from app.services.recipe_ai_engine import (
    RecipeAIEngine,
    RecipeGenerator, 
    IngredientOptimizer,
    CookingMethodAnalyzer,
    NutritionalOptimizer,
    RecipeGenerationRequest,
    RecipeIngredient,
    RecipeInstruction,
    RecipeNutrition,
    GeneratedRecipe,
    recipe_ai_engine
)


class TestRecipeIngredient:
    """Test RecipeIngredient data model"""
    
    def test_recipe_ingredient_creation(self):
        """Test basic recipe ingredient creation"""
        ingredient = RecipeIngredient(
            name="Chicken Breast",
            quantity=150.0,
            unit="g",
            calories_per_unit=165.0,
            protein_g_per_unit=31.0,
            fat_g_per_unit=3.6,
            carbs_g_per_unit=0.0
        )
        
        assert ingredient.name == "Chicken Breast"
        assert ingredient.quantity == 150.0
        assert ingredient.unit == "g"
        assert ingredient.calories_per_unit == 165.0
        assert ingredient.protein_g_per_unit == 31.0
        assert ingredient.is_optional is False
        assert ingredient.preparation_note is None
    
    def test_recipe_ingredient_optional_fields(self):
        """Test recipe ingredient with optional fields"""
        ingredient = RecipeIngredient(
            name="Olive Oil",
            quantity=10.0,
            unit="ml",
            calories_per_unit=884.0,
            protein_g_per_unit=0.0,
            fat_g_per_unit=100.0,
            carbs_g_per_unit=0.0,
            is_optional=True,
            preparation_note="Extra virgin preferred"
        )
        
        assert ingredient.is_optional is True
        assert ingredient.preparation_note == "Extra virgin preferred"


class TestRecipeInstruction:
    """Test RecipeInstruction data model"""
    
    def test_recipe_instruction_creation(self):
        """Test basic recipe instruction creation"""
        instruction = RecipeInstruction(
            step_number=1,
            instruction="Heat olive oil in a large pan",
            cooking_method="heat",
            duration_minutes=2,
            temperature_celsius=175
        )
        
        assert instruction.step_number == 1
        assert instruction.instruction == "Heat olive oil in a large pan"
        assert instruction.cooking_method == "heat"
        assert instruction.duration_minutes == 2
        assert instruction.temperature_celsius == 175
    
    def test_recipe_instruction_minimal(self):
        """Test recipe instruction with minimal fields"""
        instruction = RecipeInstruction(
            step_number=2,
            instruction="Season to taste",
            cooking_method="season"
        )
        
        assert instruction.duration_minutes is None
        assert instruction.temperature_celsius is None


class TestRecipeNutrition:
    """Test RecipeNutrition data model"""
    
    def test_recipe_nutrition_creation(self):
        """Test recipe nutrition calculation"""
        nutrition = RecipeNutrition(
            calories_per_serving=450.0,
            protein_g_per_serving=35.0,
            fat_g_per_serving=15.0,
            carbs_g_per_serving=40.0,
            fiber_g_per_serving=8.0,
            recipe_score=0.85
        )
        
        assert nutrition.calories_per_serving == 450.0
        assert nutrition.protein_g_per_serving == 35.0
        assert nutrition.fat_g_per_serving == 15.0
        assert nutrition.carbs_g_per_serving == 40.0
        assert nutrition.fiber_g_per_serving == 8.0
        assert nutrition.recipe_score == 0.85


class TestRecipeGenerationRequest:
    """Test RecipeGenerationRequest data model"""
    
    def test_recipe_generation_request_defaults(self):
        """Test request with default values"""
        request = RecipeGenerationRequest()
        
        assert request.user_id is None
        assert request.target_calories_per_serving is None
        assert request.available_ingredients == []
        assert request.dietary_restrictions == []
        assert request.cuisine_preferences == []
        assert request.excluded_ingredients == []
        assert request.difficulty_preference == "easy"
        assert request.servings == 4
    
    def test_recipe_generation_request_full(self):
        """Test request with all parameters"""
        request = RecipeGenerationRequest(
            user_id="test_user_123",
            target_calories_per_serving=500.0,
            target_protein_g=30.0,
            available_ingredients=["chicken", "rice"],
            dietary_restrictions=["gluten_free"],
            cuisine_preferences=["mediterranean"],
            difficulty_preference="medium",
            max_prep_time_minutes=30,
            servings=2,
            meal_type="dinner"
        )
        
        assert request.user_id == "test_user_123"
        assert request.target_calories_per_serving == 500.0
        assert request.target_protein_g == 30.0
        assert "chicken" in request.available_ingredients
        assert "gluten_free" in request.dietary_restrictions
        assert "mediterranean" in request.cuisine_preferences
        assert request.difficulty_preference == "medium"
        assert request.servings == 2
        assert request.meal_type == "dinner"


class TestRecipeGenerator:
    """Test RecipeGenerator core functionality"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.generator = RecipeGenerator()
    
    def test_select_cuisine_type_with_preferences(self):
        """Test cuisine selection with user preferences"""
        preferences = ["mediterranean", "italian"]
        cuisine = self.generator._select_cuisine_type(preferences)
        assert cuisine == "mediterranean"
    
    def test_select_cuisine_type_no_preferences(self):
        """Test cuisine selection without preferences"""
        preferences = []
        cuisine = self.generator._select_cuisine_type(preferences)
        assert cuisine in self.generator.cuisine_ingredients.keys()
    
    def test_generate_recipe_name(self):
        """Test recipe name generation"""
        name = self.generator._generate_recipe_name("mediterranean", "dinner")
        assert "Dinner" in name
        assert any(med_name in name for med_name in ["Mediterranean", "Greek", "Tuscan"])
    
    def test_generate_description(self):
        """Test recipe description generation"""
        description = self.generator._generate_description("Mediterranean Bowl", "mediterranean")
        assert "Mediterranean" in description
        assert "healthy" in description
        assert len(description) > 50
    
    def test_calculate_nutrition_score(self):
        """Test nutritional quality scoring"""
        # Test balanced nutrition (should score high)
        score = self.generator._calculate_nutrition_score(
            calories=400, protein=30, fat=15, carbs=40
        )
        assert 0.0 <= score <= 1.0
        assert score > 0.5  # Should be a decent score for balanced nutrition
        
        # Test poor nutrition (should score lower)
        poor_score = self.generator._calculate_nutrition_score(
            calories=800, protein=5, fat=60, carbs=100
        )
        assert poor_score < score
    
    def test_estimate_cooking_times(self):
        """Test cooking time estimation"""
        instructions = [
            RecipeInstruction(1, "Prep", "prep", duration_minutes=10),
            RecipeInstruction(2, "Cook", "saute", duration_minutes=15),
            RecipeInstruction(3, "Bake", "bake", duration_minutes=25)
        ]
        
        prep_time, cook_time = self.generator._estimate_cooking_times([], instructions)
        assert prep_time == 15  # Base prep time
        assert cook_time == 40  # 15 + 25 (excluding prep step)
    
    def test_calculate_confidence_score_with_targets(self):
        """Test confidence scoring with nutritional targets"""
        ingredients = [
            RecipeIngredient("Chicken", 150, "g", 165, 31, 3.6, 0),
            RecipeIngredient("Rice", 75, "g", 112, 2.3, 0.9, 23)
        ]
        
        nutrition = RecipeNutrition(400, 30, 10, 50)
        
        request = RecipeGenerationRequest(
            target_calories_per_serving=420.0,  # Close to actual
            available_ingredients=["chicken", "rice"]
        )
        
        score = self.generator._calculate_confidence_score(ingredients, nutrition, request)
        assert 0.3 <= score <= 1.0
        assert score > 0.7  # Should be high confidence
    
    def test_generate_recipe_tags(self):
        """Test recipe tag generation"""
        ingredients = [
            RecipeIngredient("Quinoa", 75, "g", 120, 4.4, 1.9, 22),
            RecipeIngredient("Salmon", 150, "g", 208, 22, 13, 0)
        ]
        
        tags = self.generator._generate_recipe_tags("mediterranean", ingredients, "lunch")
        
        assert "mediterranean" in tags
        assert "lunch" in tags
        assert "high_protein" in tags  # Due to quinoa
        assert "omega_3" in tags  # Due to salmon
        assert "healthy" in tags
        assert "ai_generated" in tags
    
    @pytest.mark.asyncio
    async def test_generate_recipe_base(self):
        """Test complete recipe generation"""
        request = RecipeGenerationRequest(
            cuisine_preferences=["mediterranean"],
            difficulty_preference="easy",
            servings=4,
            meal_type="dinner"
        )
        
        recipe = await self.generator.generate_recipe_base(request)
        
        assert isinstance(recipe, GeneratedRecipe)
        assert recipe.cuisine_type == "mediterranean"
        assert recipe.difficulty_level == "easy"
        assert recipe.servings == 4
        assert len(recipe.ingredients) > 0
        assert len(recipe.instructions) > 0
        assert recipe.nutrition.calories_per_serving > 0
        assert 0.3 <= recipe.confidence_score <= 1.0
        assert "dinner" in recipe.name.lower() or "Dinner" in recipe.name
    
    @pytest.mark.asyncio
    async def test_select_recipe_ingredients_vegetarian(self):
        """Test ingredient selection with vegetarian restriction"""
        request = RecipeGenerationRequest(
            dietary_restrictions=["vegetarian"],
            cuisine_preferences=["mediterranean"]
        )
        
        ingredients = await self.generator._select_recipe_ingredients(request, "mediterranean")
        
        # Should not contain meat
        ingredient_names = [ing.name.lower() for ing in ingredients]
        assert not any("chicken" in name for name in ingredient_names)
        assert not any("salmon" in name for name in ingredient_names)
        
        # Should contain vegetarian proteins
        assert any("egg" in name or "quinoa" in name or "yogurt" in name for name in ingredient_names)
    
    @pytest.mark.asyncio
    async def test_select_recipe_ingredients_vegan(self):
        """Test ingredient selection with vegan restriction"""
        request = RecipeGenerationRequest(
            dietary_restrictions=["vegan"],
            cuisine_preferences=["asian"]
        )
        
        ingredients = await self.generator._select_recipe_ingredients(request, "asian")
        
        # Should not contain animal products
        ingredient_names = [ing.name.lower() for ing in ingredients]
        assert not any("chicken" in name for name in ingredient_names)
        assert not any("egg" in name for name in ingredient_names)
        assert not any("yogurt" in name for name in ingredient_names)
        
        # Should contain vegan proteins
        assert any("quinoa" in name for name in ingredient_names)


class TestIngredientOptimizer:
    """Test IngredientOptimizer functionality"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.optimizer = IngredientOptimizer()
    
    @pytest.mark.asyncio
    async def test_optimize_ingredients_for_target(self):
        """Test ingredient optimization for nutritional targets"""
        base_ingredients = [
            RecipeIngredient("Chicken", 100, "g", 165, 31, 3.6, 0),
            RecipeIngredient("Rice", 50, "g", 112, 2.3, 0.9, 23)
        ]
        
        target_nutrition = {"calories": 400}  # Target 400 calories
        
        optimized = await self.optimizer.optimize_ingredients_for_target(
            base_ingredients, target_nutrition
        )
        
        # Calculate total calories of optimized ingredients
        total_calories = sum(ing.calories_per_unit * ing.quantity / 100 for ing in optimized)
        assert abs(total_calories - 400) < 50  # Should be close to target
    
    @pytest.mark.asyncio
    async def test_suggest_ingredient_substitutions_vegetarian(self):
        """Test ingredient substitutions for vegetarian diet"""
        chicken_ingredient = RecipeIngredient("Chicken Breast", 150, "g", 165, 31, 3.6, 0)
        
        substitutions = await self.optimizer.suggest_ingredient_substitutions(
            chicken_ingredient, ["vegetarian"]
        )
        
        assert len(substitutions) > 0
        assert substitutions[0].name == "Tofu"
        assert substitutions[0].quantity == 150  # Same quantity
        assert substitutions[0].unit == "g"
    
    @pytest.mark.asyncio
    async def test_suggest_ingredient_substitutions_vegan(self):
        """Test ingredient substitutions for vegan diet"""
        yogurt_ingredient = RecipeIngredient("Greek Yogurt", 200, "g", 100, 10, 0.4, 6)
        
        substitutions = await self.optimizer.suggest_ingredient_substitutions(
            yogurt_ingredient, ["vegan"]
        )
        
        assert len(substitutions) > 0
        assert substitutions[0].name == "Coconut Yogurt"
        assert substitutions[0].quantity == 200


class TestCookingMethodAnalyzer:
    """Test CookingMethodAnalyzer functionality"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.analyzer = CookingMethodAnalyzer()
    
    @pytest.mark.asyncio
    async def test_suggest_optimal_cooking_method_protein_high_health(self):
        """Test cooking method suggestion for protein with high health priority"""
        chicken = RecipeIngredient("Chicken Breast", 150, "g", 165, 31, 3.6, 0)
        
        method = await self.analyzer.suggest_optimal_cooking_method(chicken, health_priority=0.9)
        assert method == "bake"
    
    @pytest.mark.asyncio
    async def test_suggest_optimal_cooking_method_protein_low_health(self):
        """Test cooking method suggestion for protein with lower health priority"""
        salmon = RecipeIngredient("Salmon", 150, "g", 208, 22, 13, 0)
        
        method = await self.analyzer.suggest_optimal_cooking_method(salmon, health_priority=0.5)
        assert method == "grill"
    
    @pytest.mark.asyncio
    async def test_suggest_optimal_cooking_method_vegetables(self):
        """Test cooking method suggestion for vegetables"""
        broccoli = RecipeIngredient("Broccoli", 100, "g", 25, 3, 0.3, 5)
        
        method = await self.analyzer.suggest_optimal_cooking_method(broccoli)
        assert method == "steam"


class TestNutritionalOptimizer:
    """Test NutritionalOptimizer functionality"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.optimizer = NutritionalOptimizer()
        self.sample_recipe = GeneratedRecipe(
            id="test_recipe",
            name="Test Recipe",
            description="Test description",
            cuisine_type="mediterranean",
            difficulty_level="easy",
            prep_time_minutes=15,
            cook_time_minutes=25,
            servings=4,
            ingredients=[
                RecipeIngredient("Chicken", 150, "g", 165, 31, 3.6, 0),
                RecipeIngredient("Olive Oil", 15, "ml", 884, 0, 100, 0),
                RecipeIngredient("Broccoli", 100, "g", 25, 3, 0.3, 5)
            ],
            instructions=[],
            nutrition=RecipeNutrition(300, 25, 12, 30),
            tags=[]
        )
    
    @pytest.mark.asyncio
    async def test_optimize_for_weight_loss(self):
        """Test recipe optimization for weight loss"""
        sample_copy = copy.deepcopy(self.sample_recipe)
        optimized = await self.optimizer._optimize_for_weight_loss(sample_copy)
        
        # Find olive oil ingredient (should be reduced)
        oil_ingredient = next((ing for ing in optimized.ingredients if "oil" in ing.name.lower()), None)
        assert oil_ingredient is not None
        assert oil_ingredient.quantity < 15  # Should be reduced from original 15ml
        
        # Find vegetable ingredient (should be increased)
        veg_ingredient = next((ing for ing in optimized.ingredients if "broccoli" in ing.name.lower()), None)
        assert veg_ingredient is not None
        assert veg_ingredient.quantity > 100  # Should be increased from original 100g
        
        assert "weight_loss_friendly" in optimized.tags
    
    @pytest.mark.asyncio
    async def test_optimize_for_muscle_gain(self):
        """Test recipe optimization for muscle gain"""
        sample_copy = copy.deepcopy(self.sample_recipe)
        optimized = await self.optimizer._optimize_for_muscle_gain(sample_copy)
        
        # Find protein ingredient (should be increased)
        protein_ingredient = next((ing for ing in optimized.ingredients if "chicken" in ing.name.lower()), None)
        assert protein_ingredient is not None
        assert protein_ingredient.quantity > 150  # Should be increased from original 150g
        
        assert "high_protein" in optimized.tags
    
    @pytest.mark.asyncio
    async def test_optimize_for_heart_health(self):
        """Test recipe optimization for heart health"""
        optimized = await self.optimizer._optimize_for_heart_health(copy.deepcopy(self.sample_recipe))
        
        # Find oil ingredient (should be specified as extra virgin)
        oil_ingredient = next((ing for ing in optimized.ingredients if "oil" in ing.name.lower()), None)
        assert oil_ingredient is not None
        assert "Extra Virgin" in oil_ingredient.name
        
        assert "heart_healthy" in optimized.tags
        assert "anti_inflammatory" in optimized.tags


class TestRecipeAIEngine:
    """Test main RecipeAIEngine functionality"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.engine = RecipeAIEngine()
    
    @pytest.mark.asyncio
    async def test_generate_recipe_basic(self):
        """Test basic recipe generation"""
        request = RecipeGenerationRequest(
            user_id="test_user",
            cuisine_preferences=["mediterranean"],
            difficulty_preference="easy",
            servings=4
        )
        
        with patch.object(self.engine, '_generate_cache_key', return_value="test_cache_key"), \
             patch('app.services.recipe_ai_engine.redis_cache_service') as mock_redis, \
             patch('app.services.recipe_ai_engine.performance_monitor') as mock_monitor:
            
            # Mock async cache methods
            mock_redis.get = AsyncMock(return_value=None)  # Cache miss
            mock_redis.set = AsyncMock(return_value=True)
            
            # Mock performance monitor
            mock_monitor.measure_api_call.return_value.__aenter__ = AsyncMock()
            mock_monitor.measure_api_call.return_value.__aexit__ = AsyncMock()
            
            recipe = await self.engine.generate_recipe(request)
            
            assert isinstance(recipe, GeneratedRecipe)
            assert recipe.cuisine_type == "mediterranean"
            assert recipe.difficulty_level == "easy"
            assert recipe.servings == 4
            assert recipe.generation_time_ms > 0
            assert len(recipe.ingredients) > 0
            assert len(recipe.instructions) > 0
            assert recipe.nutrition.calories_per_serving > 0
    
    @pytest.mark.asyncio
    async def test_generate_recipe_with_cache_hit(self):
        """Test recipe generation with cache hit"""
        request = RecipeGenerationRequest(
            cuisine_preferences=["italian"]
        )
        
        cached_recipe_data = {
            "id": "cached_recipe",
            "name": "Cached Italian Recipe",
            "cuisine_type": "italian",
            "difficulty_level": "easy",
            "prep_time_minutes": 15,
            "cook_time_minutes": 25,
            "servings": 4,
            "ingredients": [],
            "instructions": [],
            "nutrition": {
                "calories_per_serving": 400,
                "protein_g_per_serving": 25,
                "fat_g_per_serving": 15,
                "carbs_g_per_serving": 35,
                "fiber_g_per_serving": 5,
                "sugar_g_per_serving": 10,
                "sodium_mg_per_serving": 500,
                "recipe_score": 0.8
            },
            "created_by": "ai_generated",
            "confidence_score": 0.85,
            "generation_time_ms": 1500,
            "tags": ["italian", "healthy"],
            "description": "Test cached recipe"
        }
        
        with patch.object(self.engine, '_generate_cache_key', return_value="test_cache_key"), \
             patch('app.services.recipe_ai_engine.redis_cache_service') as mock_redis, \
             patch('app.services.recipe_ai_engine.performance_monitor') as mock_monitor:
            
            # Mock async cache methods
            mock_redis.get = AsyncMock(return_value=json.dumps(cached_recipe_data))
            
            recipe = await self.engine.generate_recipe(request)
            
            assert recipe.id == "cached_recipe"
            assert recipe.name == "Cached Italian Recipe"
            assert recipe.cuisine_type == "italian"
    
    @pytest.mark.asyncio
    async def test_generate_recipe_with_nutritional_targets(self):
        """Test recipe generation with specific nutritional targets"""
        request = RecipeGenerationRequest(
            target_calories_per_serving=500.0,
            target_protein_g=35.0,
            target_carbs_g=45.0,
            target_fat_g=20.0,
            servings=2
        )
        
        with patch('app.services.recipe_ai_engine.redis_cache_service') as mock_redis:
            mock_redis.get.return_value = None
            mock_redis.set.return_value = True
            
            recipe = await self.engine.generate_recipe(request)
            
            # Nutritional targets should influence the recipe
            assert abs(recipe.nutrition.calories_per_serving - 500.0) < 300  # Within reasonable range
            assert recipe.servings == 2
    
    @pytest.mark.asyncio
    async def test_optimize_existing_recipe(self):
        """Test optimization of existing recipe"""
        recipe_data = {
            "id": "existing_recipe",
            "name": "Existing Recipe",
            "description": "User recipe",
            "cuisine_type": "international",
            "difficulty_level": "medium",
            "prep_time_minutes": 20,
            "cook_time_minutes": 30,
            "servings": 4,
            "ingredients": [
                {
                    "name": "Chicken Breast",
                    "quantity": 200,
                    "unit": "g",
                    "calories_per_unit": 165,
                    "protein_g_per_unit": 31,
                    "fat_g_per_unit": 3.6,
                    "carbs_g_per_unit": 0
                }
            ],
            "instructions": [
                {
                    "instruction": "Cook chicken",
                    "cooking_method": "grill"
                }
            ]
        }
        
        optimized = await self.engine.optimize_existing_recipe(recipe_data, "weight_loss")
        
        assert isinstance(optimized, GeneratedRecipe)
        assert optimized.name == "Existing Recipe"
        assert "optimized" in optimized.tags
        assert optimized.confidence_score > 0.7  # Should increase after optimization
    
    @pytest.mark.asyncio
    async def test_generate_shopping_list(self):
        """Test shopping list generation from multiple recipes"""
        recipe1_data = {
            "name": "Recipe 1",
            "servings": 4,
            "ingredients": [
                {"name": "Chicken Breast", "quantity": 200, "unit": "g"},
                {"name": "Rice", "quantity": 100, "unit": "g"}
            ],
            "instructions": []
        }
        
        recipe2_data = {
            "name": "Recipe 2", 
            "servings": 4,
            "ingredients": [
                {"name": "Chicken Breast", "quantity": 150, "unit": "g"},
                {"name": "Broccoli", "quantity": 200, "unit": "g"}
            ],
            "instructions": []
        }
        
        shopping_list = await self.engine.generate_shopping_list([recipe1_data, recipe2_data])
        
        assert "ingredients" in shopping_list
        assert "total_items" in shopping_list
        assert "estimated_cost" in shopping_list
        assert shopping_list["total_items"] == 3  # chicken, rice, broccoli
        
        # Find consolidated chicken ingredient
        chicken_item = next((item for item in shopping_list["ingredients"] if "chicken" in item["name"].lower()), None)
        assert chicken_item is not None
        assert chicken_item["quantity"] == 350  # 200 + 150
        assert len(chicken_item["recipes"]) == 2
    
    def test_generate_cache_key(self):
        """Test cache key generation"""
        request = RecipeGenerationRequest(
            target_calories_per_serving=500.0,
            difficulty_preference="medium",
            servings=2,
            dietary_restrictions=["vegetarian", "gluten_free"],
            cuisine_preferences=["mediterranean"]
        )
        
        cache_key = self.engine._generate_cache_key(request)
        
        assert "recipe_gen" in cache_key
        assert "cal_500.0" in cache_key
        assert "diff_medium" in cache_key
        assert "serv_2" in cache_key
        assert "gluten_free" in cache_key
        assert "vegetarian" in cache_key
        assert "mediterranean" in cache_key
    
    def test_convert_to_generated_recipe(self):
        """Test conversion of generic recipe data to GeneratedRecipe"""
        recipe_data = {
            "id": "test_conversion",
            "name": "Test Conversion Recipe",
            "description": "Test recipe for conversion",
            "servings": 2,
            "ingredients": [
                {
                    "name": "Test Ingredient",
                    "quantity": 100,
                    "unit": "g",
                    "calories_per_unit": 50,
                    "protein_g_per_unit": 5
                }
            ],
            "instructions": [
                {
                    "instruction": "Test instruction",
                    "cooking_method": "test_method"
                }
            ]
        }
        
        converted = self.engine._convert_to_generated_recipe(recipe_data)
        
        assert isinstance(converted, GeneratedRecipe)
        assert converted.id == "test_conversion"
        assert converted.name == "Test Conversion Recipe"
        assert converted.servings == 2
        assert len(converted.ingredients) == 1
        assert len(converted.instructions) == 1
        assert converted.created_by == "user_provided"
        assert converted.confidence_score == 0.7
    
    def test_estimate_shopping_cost(self):
        """Test shopping cost estimation"""
        ingredients = {
            "chicken_breast": {"name": "Chicken Breast"},
            "salmon_fillet": {"name": "Salmon Fillet"},
            "unknown_item": {"name": "Unknown Item"}
        }
        
        cost = self.engine._estimate_shopping_cost(ingredients)
        
        assert isinstance(cost, float)
        assert cost > 0
        assert cost == 24.0  # 8.0 (chicken) + 12.0 (salmon) + 4.0 (unknown)


class TestRecipeAIEngineIntegration:
    """Integration tests for Recipe AI Engine"""
    
    @pytest.mark.asyncio
    async def test_full_recipe_generation_workflow(self):
        """Test complete recipe generation workflow"""
        request = RecipeGenerationRequest(
            user_id="integration_test_user",
            target_calories_per_serving=450.0,
            dietary_restrictions=["vegetarian"],
            cuisine_preferences=["mediterranean"],
            difficulty_preference="easy",
            servings=4,
            meal_type="dinner"
        )
        
        with patch('app.services.recipe_ai_engine.redis_cache_service') as mock_redis, \
             patch('app.services.recipe_ai_engine.performance_monitor') as mock_monitor:
            
            # Mock async cache methods
            mock_redis.get = AsyncMock(return_value=None)
            mock_redis.set = AsyncMock(return_value=True)
            
            # Mock performance monitor
            mock_monitor.measure_api_call.return_value.__aenter__ = AsyncMock()
            mock_monitor.measure_api_call.return_value.__aexit__ = AsyncMock()
            
            # Create a fresh Recipe AI Engine instance  
            recipe_ai_engine = RecipeAIEngine()
            
            # Generate recipe
            recipe = await recipe_ai_engine.generate_recipe(request)
            
            # Verify recipe structure
            assert isinstance(recipe, GeneratedRecipe)
            assert recipe.cuisine_type == "mediterranean"
            assert recipe.difficulty_level == "easy"
            assert recipe.servings == 4
            assert len(recipe.ingredients) > 0
            assert len(recipe.instructions) > 0
            
            # Verify nutritional content
            assert recipe.nutrition.calories_per_serving > 0
            assert recipe.nutrition.protein_g_per_serving > 0
            assert recipe.nutrition.fat_g_per_serving >= 0
            assert recipe.nutrition.carbs_g_per_serving >= 0
            
            # Verify AI confidence and performance
            assert 0.3 <= recipe.confidence_score <= 1.0
            assert recipe.generation_time_ms > 0
            
            # Verify tags
            assert "mediterranean" in recipe.tags
            assert "healthy" in recipe.tags
            assert "ai_generated" in recipe.tags
            
            # Verify no meat ingredients (vegetarian)
            ingredient_names = [ing.name.lower() for ing in recipe.ingredients]
            assert not any("chicken" in name or "beef" in name or "pork" in name for name in ingredient_names)
    
    @pytest.mark.asyncio
    async def test_recipe_optimization_workflow(self):
        """Test recipe optimization workflow"""
        # First generate a base recipe
        base_request = RecipeGenerationRequest(
            cuisine_preferences=["asian"],
            difficulty_preference="medium"
        )
        
        with patch('app.services.recipe_ai_engine.redis_cache_service') as mock_redis, \
             patch('app.services.recipe_ai_engine.performance_monitor') as mock_monitor:
            
            # Mock async cache methods
            mock_redis.get = AsyncMock(return_value=None)
            mock_redis.set = AsyncMock(return_value=True)
            
            # Mock performance monitor
            mock_monitor.measure_api_call.return_value.__aenter__ = AsyncMock()
            mock_monitor.measure_api_call.return_value.__aexit__ = AsyncMock()
            
            # Create engine instance
            recipe_ai_engine = RecipeAIEngine()
            
            base_recipe = await recipe_ai_engine.generate_recipe(base_request)
            
            # Convert to dict for optimization
            recipe_data = {
                "id": base_recipe.id,
                "name": base_recipe.name,
                "description": base_recipe.description,
                "servings": base_recipe.servings,
                "ingredients": [
                    {
                        "name": ing.name,
                        "quantity": ing.quantity,
                        "unit": ing.unit,
                        "calories_per_unit": ing.calories_per_unit,
                        "protein_g_per_unit": ing.protein_g_per_unit,
                        "fat_g_per_unit": ing.fat_g_per_unit,
                        "carbs_g_per_unit": ing.carbs_g_per_unit
                    }
                    for ing in base_recipe.ingredients
                ],
                "instructions": [
                    {
                        "instruction": inst.instruction,
                        "cooking_method": inst.cooking_method
                    }
                    for inst in base_recipe.instructions
                ]
            }
            
            # Optimize for muscle gain
            optimized = await recipe_ai_engine.optimize_existing_recipe(recipe_data, "muscle_gain")
            
            assert isinstance(optimized, GeneratedRecipe)
            # Optimized recipe should have high protein tag
            assert "high_protein" in optimized.tags
            assert "optimized" in optimized.tags
            # Confidence scores should be reasonable (allowing for small variations)
            assert 0.3 <= optimized.confidence_score <= 1.0


# Performance and error handling tests
class TestRecipeAIEngineErrorHandling:
    """Test error handling and edge cases"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.engine = RecipeAIEngine()
    
    @pytest.mark.asyncio
    async def test_generate_recipe_with_cache_error(self):
        """Test recipe generation when cache fails"""
        request = RecipeGenerationRequest(cuisine_preferences=["italian"])
        
        with patch('app.services.recipe_ai_engine.redis_cache_service') as mock_redis, \
             patch('app.services.recipe_ai_engine.performance_monitor') as mock_monitor:
            
            # Mock async cache methods to fail
            mock_redis.get = AsyncMock(side_effect=Exception("Cache connection failed"))
            mock_redis.set = AsyncMock(side_effect=Exception("Cache write failed"))
            
            # Mock performance monitor
            mock_monitor.measure_api_call.return_value.__aenter__ = AsyncMock()
            mock_monitor.measure_api_call.return_value.__aexit__ = AsyncMock()
            
            # Should still generate recipe despite cache failures
            recipe = await self.engine.generate_recipe(request)
            
            assert isinstance(recipe, GeneratedRecipe)
            assert recipe.cuisine_type == "italian"
    
    @pytest.mark.asyncio
    async def test_optimize_recipe_invalid_goal(self):
        """Test recipe optimization with invalid goal"""
        recipe_data = {
            "name": "Test Recipe",
            "servings": 4,
            "ingredients": [],
            "instructions": []
        }
        
        # Should handle invalid goal gracefully
        optimized = await self.engine.optimize_existing_recipe(recipe_data, "invalid_goal")
        
        assert isinstance(optimized, GeneratedRecipe)
        assert optimized.name == "Test Recipe"
    
    @pytest.mark.asyncio
    async def test_generate_shopping_list_empty_recipes(self):
        """Test shopping list generation with empty recipe list"""
        shopping_list = await self.engine.generate_shopping_list([])
        
        assert shopping_list["ingredients"] == []
        assert shopping_list["total_items"] == 0
        assert shopping_list["estimated_cost"] == 0.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])