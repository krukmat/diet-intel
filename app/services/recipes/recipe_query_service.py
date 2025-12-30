"""
Recipe Query Service

Handles all recipe CRUD operations and search/analytics queries.
Provides access to recipe data without modifying ratings or preferences.

Task: Phase 2 Tarea 5 - Recipe Database Refactoring
"""

import json
import uuid
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

from app.services.database import DatabaseService
from app.services.recipe_ai_engine import GeneratedRecipe, RecipeIngredient, RecipeInstruction, RecipeNutrition

logger = logging.getLogger(__name__)


class RecipeQueryService:
    """Service for recipe CRUD operations and queries"""

    def __init__(self, db_service: Optional[DatabaseService] = None):
        """
        Initialize recipe query service.

        Args:
            db_service: DatabaseService instance (optional, creates new if not provided)
        """
        self.db_service = db_service or DatabaseService()

    async def create_recipe(self, recipe: GeneratedRecipe, user_id: Optional[str] = None) -> str:
        """
        Store a generated recipe in the database.

        Args:
            recipe: Recipe object to store
            user_id: Optional user ID who created the recipe

        Returns:
            Recipe ID of created recipe

        Raises:
            RuntimeError: If recipe creation fails
        """
        try:
            recipe_id = recipe.id or str(uuid.uuid4())

            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                # Insert recipe
                cursor.execute("""
                    INSERT INTO recipes (
                        id, user_id, name, description, cuisine_type, difficulty_level,
                        prep_time_minutes, cook_time_minutes, servings, created_by,
                        confidence_score, generation_time_ms, tags
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    recipe_id, user_id, recipe.name, recipe.description, recipe.cuisine_type,
                    recipe.difficulty_level, recipe.prep_time_minutes, recipe.cook_time_minutes,
                    recipe.servings, recipe.created_by, recipe.confidence_score,
                    recipe.generation_time_ms, json.dumps(recipe.tags)
                ))

                # Insert ingredients
                for ingredient in recipe.ingredients:
                    ingredient_id = str(uuid.uuid4())
                    cursor.execute("""
                        INSERT INTO recipe_ingredients (
                            id, recipe_id, ingredient_name, quantity, unit,
                            calories_per_unit, protein_g_per_unit, fat_g_per_unit, carbs_g_per_unit,
                            is_optional, preparation_note
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        ingredient_id, recipe_id, ingredient.name, ingredient.quantity, ingredient.unit,
                        ingredient.calories_per_unit, ingredient.protein_g_per_unit,
                        ingredient.fat_g_per_unit, ingredient.carbs_g_per_unit,
                        ingredient.is_optional, ingredient.preparation_note
                    ))

                # Insert instructions
                for instruction in recipe.instructions:
                    instruction_id = str(uuid.uuid4())
                    cursor.execute("""
                        INSERT INTO recipe_instructions (
                            id, recipe_id, step_number, instruction, cooking_method,
                            duration_minutes, temperature_celsius
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        instruction_id, recipe_id, instruction.step_number, instruction.instruction,
                        instruction.cooking_method, instruction.duration_minutes, instruction.temperature_celsius
                    ))

                # Insert nutrition data
                if recipe.nutrition:
                    cursor.execute("""
                        INSERT OR REPLACE INTO recipe_nutrition (
                            recipe_id, calories_per_serving, protein_g_per_serving,
                            fat_g_per_serving, carbs_g_per_serving, fiber_g_per_serving,
                            sugar_g_per_serving, sodium_mg_per_serving, recipe_score
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        recipe_id, recipe.nutrition.calories_per_serving, recipe.nutrition.protein_g_per_serving,
                        recipe.nutrition.fat_g_per_serving, recipe.nutrition.carbs_g_per_serving,
                        recipe.nutrition.fiber_g_per_serving, recipe.nutrition.sugar_g_per_serving,
                        recipe.nutrition.sodium_mg_per_serving, recipe.nutrition.recipe_score
                    ))

                conn.commit()
                logger.info(f"Successfully created recipe {recipe_id}: {recipe.name}")
                return recipe_id

        except Exception as e:
            logger.error(f"Error creating recipe: {e}")
            raise RuntimeError(f"Failed to create recipe: {str(e)}")

    async def get_recipe(self, recipe_id: str) -> Optional[GeneratedRecipe]:
        """
        Retrieve a recipe by ID.

        Args:
            recipe_id: ID of recipe to retrieve

        Returns:
            GeneratedRecipe object or None if not found
        """
        try:
            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                # Get recipe data
                cursor.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,))
                recipe_row = cursor.fetchone()

                if not recipe_row:
                    return None

                # Get ingredients
                cursor.execute("""
                    SELECT * FROM recipe_ingredients
                    WHERE recipe_id = ?
                    ORDER BY ingredient_name
                """, (recipe_id,))
                ingredient_rows = cursor.fetchall()

                # Get instructions
                cursor.execute("""
                    SELECT * FROM recipe_instructions
                    WHERE recipe_id = ?
                    ORDER BY step_number
                """, (recipe_id,))
                instruction_rows = cursor.fetchall()

                # Get nutrition
                cursor.execute("SELECT * FROM recipe_nutrition WHERE recipe_id = ?", (recipe_id,))
                nutrition_row = cursor.fetchone()

                # Build recipe object
                # Convert sqlite3.Row to dict for .get() support
                ingredients = []
                for row in ingredient_rows:
                    row_dict = dict(row)
                    ingredients.append(RecipeIngredient(
                        name=row_dict['ingredient_name'],
                        quantity=row_dict['quantity'],
                        unit=row_dict['unit'],
                        barcode=row_dict.get('barcode'),
                        calories_per_unit=row_dict.get('calories_per_unit'),
                        protein_g_per_unit=row_dict.get('protein_g_per_unit'),
                        fat_g_per_unit=row_dict.get('fat_g_per_unit'),
                        carbs_g_per_unit=row_dict.get('carbs_g_per_unit'),
                        is_optional=bool(row_dict.get('is_optional')),
                        preparation_note=row_dict.get('preparation_note')
                    ))

                instructions = []
                for row in instruction_rows:
                    row_dict = dict(row)
                    instructions.append(RecipeInstruction(
                        step_number=row_dict['step_number'],
                        instruction=row_dict['instruction'],
                        cooking_method=row_dict.get('cooking_method'),
                        duration_minutes=row_dict.get('duration_minutes'),
                        temperature_celsius=row_dict.get('temperature_celsius')
                    ))

                nutrition = None
                if nutrition_row:
                    nutrition_dict = dict(nutrition_row)
                    nutrition = RecipeNutrition(
                        calories_per_serving=nutrition_dict['calories_per_serving'],
                        protein_g_per_serving=nutrition_dict['protein_g_per_serving'],
                        fat_g_per_serving=nutrition_dict['fat_g_per_serving'],
                        carbs_g_per_serving=nutrition_dict['carbs_g_per_serving'],
                        fiber_g_per_serving=nutrition_dict.get('fiber_g_per_serving'),
                        sugar_g_per_serving=nutrition_dict.get('sugar_g_per_serving'),
                        sodium_mg_per_serving=nutrition_dict.get('sodium_mg_per_serving'),
                        recipe_score=nutrition_dict.get('recipe_score')
                    )

                # Parse tags
                tags = json.loads(recipe_row['tags']) if recipe_row['tags'] else []

                return GeneratedRecipe(
                    id=recipe_row['id'],
                    name=recipe_row['name'],
                    description=recipe_row['description'],
                    cuisine_type=recipe_row['cuisine_type'],
                    difficulty_level=recipe_row['difficulty_level'],
                    prep_time_minutes=recipe_row['prep_time_minutes'],
                    cook_time_minutes=recipe_row['cook_time_minutes'],
                    servings=recipe_row['servings'],
                    ingredients=ingredients,
                    instructions=instructions,
                    nutrition=nutrition,
                    created_by=recipe_row['created_by'],
                    confidence_score=recipe_row['confidence_score'],
                    generation_time_ms=recipe_row['generation_time_ms'],
                    tags=tags
                )

        except Exception as e:
            logger.error(f"Error retrieving recipe {recipe_id}: {e}")
            return None

    async def search_recipes(
        self,
        user_id: Optional[str] = None,
        cuisine_type: Optional[str] = None,
        difficulty_level: Optional[str] = None,
        max_prep_time: Optional[int] = None,
        tags: Optional[List[str]] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search recipes based on criteria.

        Args:
            user_id: Filter by user ID
            cuisine_type: Filter by cuisine type
            difficulty_level: Filter by difficulty
            max_prep_time: Filter by max prep time in minutes
            tags: Filter by tags (recipe must have any of these)
            limit: Max number of results (default 20)

        Returns:
            List of recipe summaries matching criteria
        """
        try:
            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                # Build dynamic query
                conditions = []
                params = []

                if user_id:
                    conditions.append("user_id = ?")
                    params.append(user_id)

                if cuisine_type:
                    conditions.append("cuisine_type = ?")
                    params.append(cuisine_type)

                if difficulty_level:
                    conditions.append("difficulty_level = ?")
                    params.append(difficulty_level)

                if max_prep_time:
                    conditions.append("prep_time_minutes <= ?")
                    params.append(max_prep_time)

                where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""

                cursor.execute(f"""
                    SELECT r.*, rn.calories_per_serving, rn.protein_g_per_serving
                    FROM recipes r
                    LEFT JOIN recipe_nutrition rn ON r.id = rn.recipe_id
                    {where_clause}
                    ORDER BY r.confidence_score DESC, r.created_at DESC
                    LIMIT ?
                """, params + [limit])

                rows = cursor.fetchall()

                recipes = []
                for row in rows:
                    recipe_data = {
                        'id': row['id'],
                        'name': row['name'],
                        'description': row['description'],
                        'cuisine_type': row['cuisine_type'],
                        'difficulty_level': row['difficulty_level'],
                        'prep_time_minutes': row['prep_time_minutes'],
                        'cook_time_minutes': row['cook_time_minutes'],
                        'servings': row['servings'],
                        'confidence_score': row['confidence_score'],
                        'tags': json.loads(row['tags']) if row['tags'] else [],
                        'calories_per_serving': row['calories_per_serving'],
                        'protein_g_per_serving': row['protein_g_per_serving'],
                        'created_at': row['created_at']
                    }

                    # Filter by tags if specified
                    if tags:
                        recipe_tags = recipe_data['tags']
                        if not any(tag in recipe_tags for tag in tags):
                            continue

                    recipes.append(recipe_data)

                return recipes

        except Exception as e:
            logger.error(f"Error searching recipes: {e}")
            return []

    async def get_recipe_analytics(self, days: int = 30) -> Dict[str, Any]:
        """
        Get recipe analytics for the last N days.

        Args:
            days: Number of days to analyze (default 30)

        Returns:
            Dictionary with analytics metrics
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)

            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                # Get generation stats
                cursor.execute("""
                    SELECT
                        COUNT(DISTINCT id) as total_recipes,
                        COUNT(CASE WHEN success THEN 1 END) as successful_generations,
                        AVG(processing_time_ms) as avg_processing_time,
                        MAX(processing_time_ms) as max_processing_time
                    FROM recipe_generation_requests
                    WHERE created_at >= ?
                """, (cutoff_date,))

                gen_stats_row = cursor.fetchone()
                gen_stats = dict(gen_stats_row) if gen_stats_row else {}

                # Get top cuisines
                cursor.execute("""
                    SELECT cuisine_type, COUNT(*) as count
                    FROM recipes
                    WHERE created_at >= ?
                    GROUP BY cuisine_type
                    ORDER BY count DESC
                    LIMIT 5
                """, (cutoff_date,))

                top_cuisines = [dict(row) for row in cursor.fetchall()]

                return {
                    'period_days': days,
                    'total_recipes_generated': gen_stats.get('total_recipes', 0),
                    'successful_generations': gen_stats.get('successful_generations', 0),
                    'avg_processing_time_ms': round(gen_stats.get('avg_processing_time', 0), 2),
                    'top_cuisines': top_cuisines
                }

        except Exception as e:
            logger.error(f"Error getting recipe analytics: {e}")
            return {'error': str(e)}
