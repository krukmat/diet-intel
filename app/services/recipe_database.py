import sqlite3
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
import logging
import asyncio

from app.services.database import DatabaseService
from app.services.recipe_ai_engine import GeneratedRecipe, RecipeIngredient, RecipeInstruction, RecipeNutrition

logger = logging.getLogger(__name__)


class RecipeDatabaseService(DatabaseService):
    """Extended database service for Recipe AI Generator functionality"""
    
    def __init__(self, db_path: str = "dietintel.db", max_connections: int = 10):
        super().__init__(db_path, max_connections)
        self._recipe_tables_ready = False
        self.init_recipe_tables()
        # Task 10 related comment: Initialize shopping optimization tables automatically
        self.init_shopping_optimization_tables_sync()
        self._recipe_tables_ready = True

    def _ensure_tables_initialized(self):
        if getattr(self, "_recipe_tables_ready", False):
            return
        try:
            self.init_recipe_tables()
        except Exception as exc:
            logger.debug(f"Deferred recipe table init encountered error: {exc}")
        try:
            self.init_shopping_optimization_tables_sync()
        except Exception as exc:
            logger.debug(f"Deferred shopping optimization init encountered error: {exc}")
        self._recipe_tables_ready = True
    
    def init_recipe_tables(self):
        """Initialize recipe-related database tables"""
        try:
            # Read and execute recipe table creation script
            import os
            script_path = os.path.join(os.path.dirname(__file__), '..', '..', 'database', 'init', '02_recipe_tables.sql')
            
            if os.path.exists(script_path):
                with open(script_path, 'r') as f:
                    recipe_schema = f.read()
                
                with self.get_connection() as conn:
                    cursor = conn.cursor()
                    # Execute the entire schema (SQLite supports multiple statements)
                    cursor.executescript(recipe_schema)
                    conn.commit()
                    logger.info("Recipe database tables initialized successfully")
            else:
                logger.info(f"Recipe schema file not found at {script_path}, creating tables manually")
                self._create_recipe_tables_manually()
                
        except Exception as e:
            logger.error(f"Failed to initialize recipe tables from file: {e}")
            logger.info("Falling back to manual table creation")
            self._create_recipe_tables_manually()
    
    def _create_recipe_tables_manually(self):
        """Fallback method to create recipe tables manually"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Main recipes table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS recipes (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    name TEXT NOT NULL,
                    description TEXT,
                    cuisine_type TEXT,
                    difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
                    prep_time_minutes INTEGER,
                    cook_time_minutes INTEGER,
                    servings INTEGER DEFAULT 4,
                    created_by TEXT DEFAULT 'ai_generated' CHECK (created_by IN ('ai_generated', 'user_created')),
                    confidence_score REAL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
                    generation_time_ms REAL,
                    tags TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Recipe ingredients table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS recipe_ingredients (
                    id TEXT PRIMARY KEY,
                    recipe_id TEXT NOT NULL,
                    ingredient_name TEXT NOT NULL,
                    quantity REAL NOT NULL,
                    unit TEXT NOT NULL,
                    barcode TEXT,
                    calories_per_unit REAL DEFAULT 0.0,
                    protein_g_per_unit REAL DEFAULT 0.0,
                    fat_g_per_unit REAL DEFAULT 0.0,
                    carbs_g_per_unit REAL DEFAULT 0.0,
                    is_optional BOOLEAN DEFAULT FALSE,
                    preparation_note TEXT,
                    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
                )
            """)
            
            # Recipe instructions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS recipe_instructions (
                    id TEXT PRIMARY KEY,
                    recipe_id TEXT NOT NULL,
                    step_number INTEGER NOT NULL,
                    instruction TEXT NOT NULL,
                    cooking_method TEXT,
                    duration_minutes INTEGER,
                    temperature_celsius INTEGER,
                    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
                )
            """)
            
            # Recipe nutrition table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS recipe_nutrition (
                    recipe_id TEXT PRIMARY KEY,
                    calories_per_serving REAL DEFAULT 0.0,
                    protein_g_per_serving REAL DEFAULT 0.0,
                    fat_g_per_serving REAL DEFAULT 0.0,
                    carbs_g_per_serving REAL DEFAULT 0.0,
                    fiber_g_per_serving REAL DEFAULT 0.0,
                    sugar_g_per_serving REAL DEFAULT 0.0,
                    sodium_mg_per_serving REAL DEFAULT 0.0,
                    recipe_score REAL DEFAULT 0.0,
                    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
                )
            """)
            
            # User recipe ratings table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_recipe_ratings (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    recipe_id TEXT NOT NULL,
                    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                    review TEXT,
                    made_modifications BOOLEAN DEFAULT FALSE,
                    would_make_again BOOLEAN,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
                )
            """)
            
            # Recipe generation requests table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS recipe_generation_requests (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    session_id TEXT,
                    cache_key TEXT NOT NULL,
                    request_data TEXT NOT NULL,
                    generated_recipe_id TEXT,
                    processing_time_ms REAL,
                    success BOOLEAN NOT NULL,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (generated_recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
                )
            """)
            
            # Shopping lists table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS shopping_lists (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    name TEXT NOT NULL,
                    recipe_ids TEXT NOT NULL,
                    ingredients_data TEXT NOT NULL,
                    estimated_cost REAL,
                    store_optimization TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP
                )
            """)
            
            # Create indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_recipes_cuisine_type ON recipes(cuisine_type)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_recipe_instructions_recipe_id ON recipe_instructions(recipe_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_recipe_ratings_recipe_id ON user_recipe_ratings(recipe_id)")
            
            conn.commit()
            logger.info("Recipe tables created manually")

    async def get_recipe_by_id(self, recipe_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a recipe along with its ingredients."""
        return await asyncio.to_thread(self._get_recipe_by_id_sync, recipe_id)

    def _get_recipe_by_id_sync(self, recipe_id: str) -> Optional[Dict[str, Any]]:
        self._ensure_tables_initialized()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,))
            recipe_row = cursor.fetchone()
            if not recipe_row:
                return None

            cursor.execute(
                """
                SELECT ingredient_name, quantity, unit, preparation_note
                FROM recipe_ingredients
                WHERE recipe_id = ?
                ORDER BY id
                """,
                (recipe_id,)
            )
            ingredients = []
            for row in cursor.fetchall():
                ingredients.append({
                    'ingredient': row['ingredient_name'],
                    'quantity': row['quantity'],
                    'unit': row['unit'],
                    'notes': row['preparation_note']
                })

            return {
                'id': recipe_row['id'],
                'user_id': recipe_row['user_id'],
                'name': recipe_row['name'],
                'description': recipe_row['description'],
                'cuisine_type': recipe_row['cuisine_type'],
                'servings': recipe_row['servings'],
                'ingredients': ingredients,
                'created_at': recipe_row['created_at']
            }

    # ===== RECIPE CRUD OPERATIONS =====
    
    async def create_recipe(self, recipe: GeneratedRecipe, user_id: Optional[str] = None) -> str:
        """Store a generated recipe in the database"""
        try:
            self._ensure_tables_initialized()
            recipe_id = recipe.id or str(uuid.uuid4())
            
            with self.get_connection() as conn:
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
        """Retrieve a recipe by ID"""
        try:
            self._ensure_tables_initialized()
            with self.get_connection() as conn:
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
                ingredients = [
                    RecipeIngredient(
                        name=row['ingredient_name'],
                        quantity=row['quantity'],
                        unit=row['unit'],
                        barcode=row['barcode'],
                        calories_per_unit=row['calories_per_unit'],
                        protein_g_per_unit=row['protein_g_per_unit'],
                        fat_g_per_unit=row['fat_g_per_unit'],
                        carbs_g_per_unit=row['carbs_g_per_unit'],
                        is_optional=bool(row['is_optional']),
                        preparation_note=row['preparation_note']
                    )
                    for row in ingredient_rows
                ]
                
                instructions = [
                    RecipeInstruction(
                        step_number=row['step_number'],
                        instruction=row['instruction'],
                        cooking_method=row['cooking_method'],
                        duration_minutes=row['duration_minutes'],
                        temperature_celsius=row['temperature_celsius']
                    )
                    for row in instruction_rows
                ]
                
                nutrition = None
                if nutrition_row:
                    nutrition = RecipeNutrition(
                        calories_per_serving=nutrition_row['calories_per_serving'],
                        protein_g_per_serving=nutrition_row['protein_g_per_serving'],
                        fat_g_per_serving=nutrition_row['fat_g_per_serving'],
                        carbs_g_per_serving=nutrition_row['carbs_g_per_serving'],
                        fiber_g_per_serving=nutrition_row['fiber_g_per_serving'],
                        sugar_g_per_serving=nutrition_row['sugar_g_per_serving'],
                        sodium_mg_per_serving=nutrition_row['sodium_mg_per_serving'],
                        recipe_score=nutrition_row['recipe_score']
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
        """Search recipes based on criteria"""
        try:
            self._ensure_tables_initialized()
            with self.get_connection() as conn:
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
    
    async def rate_recipe(self, user_id: str, recipe_id: str, rating: int, 
                         review: Optional[str] = None, made_modifications: bool = False,
                         would_make_again: Optional[bool] = None) -> str:
        """Add or update a recipe rating"""
        try:
            self._ensure_tables_initialized()
            rating_id = str(uuid.uuid4())
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT OR REPLACE INTO user_recipe_ratings (
                        id, user_id, recipe_id, rating, review, made_modifications, would_make_again
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (rating_id, user_id, recipe_id, rating, review, made_modifications, would_make_again))
                
                conn.commit()
                logger.info(f"Added rating for recipe {recipe_id} by user {user_id}: {rating}/5")
                return rating_id
                
        except Exception as e:
            logger.error(f"Error rating recipe: {e}")
            raise RuntimeError(f"Failed to rate recipe: {str(e)}")
    
    async def get_recipe_ratings(self, recipe_id: str) -> Dict[str, Any]:
        """Get rating statistics for a recipe"""
        try:
            self._ensure_tables_initialized()
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_ratings,
                        AVG(rating) as average_rating,
                        SUM(CASE WHEN would_make_again THEN 1 ELSE 0 END) as would_make_again_count
                    FROM user_recipe_ratings 
                    WHERE recipe_id = ?
                """, (recipe_id,))
                
                stats = cursor.fetchone()
                
                total = stats['total_ratings'] or 0
                would_make_again = stats['would_make_again_count'] or 0
                percentage = round((would_make_again / total) * 100, 2) if total else 0

                return {
                    'total_ratings': total,
                    'average_rating': round(stats['average_rating'], 2) if stats['average_rating'] else 0,
                    'would_make_again_percentage': percentage
                }
                
        except Exception as e:
            logger.error(f"Error getting recipe ratings: {e}")
            return {'total_ratings': 0, 'average_rating': 0, 'would_make_again_percentage': 0}
    
    # ===== ANALYTICS AND CACHING =====
    
    async def log_recipe_generation_request(
        self,
        user_id: Optional[str],
        session_id: Optional[str],
        cache_key: str,
        request_data: Dict[str, Any],
        generated_recipe_id: Optional[str] = None,
        processing_time_ms: Optional[float] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> str:
        """Log a recipe generation request for analytics"""
        try:
            self._ensure_tables_initialized()
            request_id = str(uuid.uuid4())
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO recipe_generation_requests (
                        id, user_id, session_id, cache_key, request_data,
                        generated_recipe_id, processing_time_ms, success, error_message
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    request_id, user_id, session_id, cache_key, json.dumps(request_data),
                    generated_recipe_id, processing_time_ms, success, error_message
                ))
                
                conn.commit()
                return request_id
                
        except Exception as e:
            logger.error(f"Error logging recipe generation request: {e}")
            return ""
    
    async def create_shopping_list(
        self,
        user_id: Optional[str],
        name: str,
        recipe_ids: List[str],
        ingredients_data: Dict[str, Any],
        estimated_cost: Optional[float] = None,
        store_optimization: Optional[Dict[str, Any]] = None,
        ttl_hours: int = 168  # 1 week default
    ) -> str:
        """Create a shopping list from recipes"""
        try:
            self._ensure_tables_initialized()
            shopping_list_id = str(uuid.uuid4())
            expires_at = datetime.now() + timedelta(hours=ttl_hours)
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO shopping_lists (
                        id, user_id, name, recipe_ids, ingredients_data,
                        estimated_cost, store_optimization, expires_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    shopping_list_id, user_id, name, json.dumps(recipe_ids),
                    json.dumps(ingredients_data), estimated_cost,
                    json.dumps(store_optimization) if store_optimization else None,
                    expires_at.isoformat()
                ))
                
                conn.commit()
                logger.info(f"Created shopping list {shopping_list_id} for {len(recipe_ids)} recipes")
                return shopping_list_id
                
        except Exception as e:
            logger.error(f"Error creating shopping list: {e}")
            raise RuntimeError(f"Failed to create shopping list: {str(e)}")
    
    async def get_recipe_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Get recipe generation analytics"""
        try:
            self._ensure_tables_initialized()
            since_date = (datetime.now() - timedelta(days=days)).isoformat()
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Generation stats
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_requests,
                        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
                        AVG(processing_time_ms) as avg_processing_time,
                        COUNT(DISTINCT user_id) as unique_users
                    FROM recipe_generation_requests 
                    WHERE created_at >= ?
                """, (since_date,))
                
                gen_stats = cursor.fetchone()
                
                # Popular cuisines
                cursor.execute("""
                    SELECT cuisine_type, COUNT(*) as count
                    FROM recipes 
                    WHERE created_at >= ?
                    GROUP BY cuisine_type
                    ORDER BY count DESC
                    LIMIT 10
                """, (since_date,))
                
                popular_cuisines = cursor.fetchall()
                
                # Recipe ratings
                cursor.execute("""
                    SELECT 
                        AVG(rating) as avg_rating,
                        COUNT(*) as total_ratings
                    FROM user_recipe_ratings urr
                    JOIN recipes r ON urr.recipe_id = r.id
                    WHERE r.created_at >= ?
                """, (since_date,))
                
                rating_stats = cursor.fetchone()
                
                return {
                    'period_days': days,
                    'generation_stats': {
                        'total_requests': gen_stats['total_requests'] or 0,
                        'successful_requests': gen_stats['successful_requests'] or 0,
                        'success_rate': (gen_stats['successful_requests'] or 0) / max(gen_stats['total_requests'] or 1, 1),
                        'avg_processing_time_ms': gen_stats['avg_processing_time'] or 0,
                        'unique_users': gen_stats['unique_users'] or 0
                    },
                    'popular_cuisines': [dict(row) for row in popular_cuisines],
                    'rating_stats': {
                        'average_rating': round(rating_stats['avg_rating'], 2) if rating_stats['avg_rating'] else 0,
                        'total_ratings': rating_stats['total_ratings'] or 0
                    }
                }
                
        except Exception as e:
            logger.error(f"Error getting recipe analytics: {e}")
            return {
                'period_days': days,
                'generation_stats': {'total_requests': 0, 'successful_requests': 0, 'success_rate': 0, 'avg_processing_time_ms': 0, 'unique_users': 0},
                'popular_cuisines': [],
                'rating_stats': {'average_rating': 0, 'total_ratings': 0}
            }

    # ===== USER TASTE PROFILE METHODS =====

    async def get_user_taste_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user taste profile with all preferences"""
        try:
            self._ensure_tables_initialized()
            with self.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT * FROM user_taste_profiles WHERE user_id = ?
                """, (user_id,))

                profile = cursor.fetchone()
                if not profile:
                    return None

                # Parse JSON fields
                return {
                    'user_id': profile['user_id'],
                    'profile_confidence': profile['profile_confidence'],
                    'total_ratings_analyzed': profile['total_ratings_analyzed'],
                    'cuisine_preferences': json.loads(profile['cuisine_preferences']) if profile['cuisine_preferences'] else [],
                    'difficulty_preferences': json.loads(profile['difficulty_preferences']) if profile['difficulty_preferences'] else {},
                    'liked_ingredients': json.loads(profile['liked_ingredients']) if profile['liked_ingredients'] else [],
                    'disliked_ingredients': json.loads(profile['disliked_ingredients']) if profile['disliked_ingredients'] else [],
                    'cooking_method_preferences': json.loads(profile['cooking_method_preferences']) if profile['cooking_method_preferences'] else {},
                    'preferred_prep_time_minutes': profile['preferred_prep_time_minutes'],
                    'preferred_cook_time_minutes': profile['preferred_cook_time_minutes'],
                    'quick_meal_preference': profile['quick_meal_preference'],
                    'preferred_calories_per_serving': profile['preferred_calories_per_serving'],
                    'preferred_protein_ratio': profile['preferred_protein_ratio'],
                    'preferred_carb_ratio': profile['preferred_carb_ratio'],
                    'preferred_fat_ratio': profile['preferred_fat_ratio'],
                    'modification_tendency': profile['modification_tendency'],
                    'repeat_cooking_tendency': profile['repeat_cooking_tendency'],
                    'last_learning_update': profile['last_learning_update'],
                    'created_at': profile['created_at'],
                    'updated_at': profile['updated_at']
                }

        except Exception as e:
            logger.error(f"Error getting user taste profile: {e}")
            return None

    async def create_or_update_user_taste_profile(self, user_id: str, profile_data: Dict[str, Any]) -> bool:
        """Create or update user taste profile"""
        try:
            self._ensure_tables_initialized()
            with self.get_connection() as conn:
                cursor = conn.cursor()

                # Convert lists and dicts to JSON strings
                cuisine_preferences = json.dumps(profile_data.get('cuisine_preferences', []))
                difficulty_preferences = json.dumps(profile_data.get('difficulty_preferences', {}))
                liked_ingredients = json.dumps(profile_data.get('liked_ingredients', []))
                disliked_ingredients = json.dumps(profile_data.get('disliked_ingredients', []))
                cooking_method_preferences = json.dumps(profile_data.get('cooking_method_preferences', {}))

                cursor.execute("""
                    INSERT OR REPLACE INTO user_taste_profiles (
                        user_id, profile_confidence, total_ratings_analyzed,
                        cuisine_preferences, difficulty_preferences,
                        liked_ingredients, disliked_ingredients, cooking_method_preferences,
                        preferred_prep_time_minutes, preferred_cook_time_minutes, quick_meal_preference,
                        preferred_calories_per_serving, preferred_protein_ratio, preferred_carb_ratio, preferred_fat_ratio,
                        modification_tendency, repeat_cooking_tendency, last_learning_update
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    user_id,
                    profile_data.get('profile_confidence', 0.0),
                    profile_data.get('total_ratings_analyzed', 0),
                    cuisine_preferences,
                    difficulty_preferences,
                    liked_ingredients,
                    disliked_ingredients,
                    cooking_method_preferences,
                    profile_data.get('preferred_prep_time_minutes', 30),
                    profile_data.get('preferred_cook_time_minutes', 45),
                    profile_data.get('quick_meal_preference', 0.5),
                    profile_data.get('preferred_calories_per_serving', 400.0),
                    profile_data.get('preferred_protein_ratio', 0.2),
                    profile_data.get('preferred_carb_ratio', 0.5),
                    profile_data.get('preferred_fat_ratio', 0.3),
                    profile_data.get('modification_tendency', 0.0),
                    profile_data.get('repeat_cooking_tendency', 0.5)
                ))

                conn.commit()
                logger.info(f"Updated taste profile for user {user_id}")
                return True

        except Exception as e:
            logger.error(f"Error updating user taste profile: {e}")
            return False

    async def get_user_ratings_for_learning(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get user ratings with recipe details for taste learning"""
        try:
            self._ensure_tables_initialized()
            with self.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT
                        urr.rating, urr.review, urr.made_modifications, urr.would_make_again,
                        r.cuisine_type, r.difficulty_level, r.prep_time_minutes, r.cook_time_minutes,
                        r.id as recipe_id, r.name as recipe_name, r.tags,
                        ri.ingredient_name, ri.quantity, ri.unit,
                        rinstr.cooking_method
                    FROM user_recipe_ratings urr
                    JOIN recipes r ON urr.recipe_id = r.id
                    LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
                    LEFT JOIN recipe_instructions rinstr ON r.id = rinstr.recipe_id
                    WHERE urr.user_id = ?
                    ORDER BY urr.created_at DESC
                    LIMIT ?
                """, (user_id, limit))

                rows = cursor.fetchall()

                # Group by recipe_id to consolidate ingredients
                recipes = {}
                for row in rows:
                    recipe_id = row['recipe_id']
                    if recipe_id not in recipes:
                        recipes[recipe_id] = {
                            'recipe_id': recipe_id,
                            'recipe_name': row['recipe_name'],
                            'rating': row['rating'],
                            'review': row['review'],
                            'made_modifications': row['made_modifications'],
                            'would_make_again': row['would_make_again'],
                            'cuisine_type': row['cuisine_type'],
                            'difficulty_level': row['difficulty_level'],
                            'prep_time_minutes': row['prep_time_minutes'],
                            'cook_time_minutes': row['cook_time_minutes'],
                            'tags': json.loads(row['tags']) if row['tags'] else [],
                            'ingredients': [],
                            'cooking_methods': set()
                        }

                    if row['ingredient_name']:
                        recipes[recipe_id]['ingredients'].append({
                            'name': row['ingredient_name'],
                            'quantity': row['quantity'],
                            'unit': row['unit']
                        })

                    if row['cooking_method']:
                        recipes[recipe_id]['cooking_methods'].add(row['cooking_method'])

                # Convert cooking_methods set to list
                for recipe in recipes.values():
                    recipe['cooking_methods'] = list(recipe['cooking_methods'])

                return list(recipes.values())

        except Exception as e:
            logger.error(f"Error getting user ratings for learning: {e}")
            return []

    async def update_cuisine_preference(self, user_id: str, cuisine_type: str,
                                      preference_data: Dict[str, Any]) -> bool:
        """Update individual cuisine preference"""
        try:
            self._ensure_tables_initialized()
            with self.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    INSERT OR REPLACE INTO user_cuisine_preferences (
                        id, user_id, cuisine_type, preference_score, total_ratings,
                        positive_ratings, average_user_rating, would_make_again_ratio,
                        modification_ratio, first_rated_at, last_rated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    f"{user_id}_{cuisine_type}",
                    user_id,
                    cuisine_type,
                    preference_data.get('preference_score', 0.0),
                    preference_data.get('total_ratings', 0),
                    preference_data.get('positive_ratings', 0),
                    preference_data.get('average_user_rating', 0.0),
                    preference_data.get('would_make_again_ratio', 0.0),
                    preference_data.get('modification_ratio', 0.0),
                    preference_data.get('first_rated_at')
                ))

                conn.commit()
                return True

        except Exception as e:
            logger.error(f"Error updating cuisine preference: {e}")
            return False

    async def update_ingredient_preference(self, user_id: str, ingredient_name: str,
                                         preference_data: Dict[str, Any]) -> bool:
        """Update individual ingredient preference"""
        try:
            self._ensure_tables_initialized()
            with self.get_connection() as conn:
                cursor = conn.cursor()

                # Determine preference category based on score
                score = preference_data.get('preference_score', 0.0)
                if score >= 0.6:
                    category = 'loved'
                elif score >= 0.2:
                    category = 'liked'
                elif score >= -0.2:
                    category = 'neutral'
                elif score >= -0.6:
                    category = 'disliked'
                else:
                    category = 'avoided'

                cursor.execute("""
                    INSERT OR REPLACE INTO user_ingredient_preferences (
                        id, user_id, ingredient_name, preference_score, confidence_level,
                        recipes_containing_ingredient, positive_recipes, negative_recipes,
                        average_rating_with_ingredient, would_make_again_with_ingredient,
                        preference_category, first_encountered_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    f"{user_id}_{ingredient_name.lower().replace(' ', '_')}",
                    user_id,
                    ingredient_name,
                    preference_data.get('preference_score', 0.0),
                    preference_data.get('confidence_level', 0.0),
                    preference_data.get('recipes_containing_ingredient', 0),
                    preference_data.get('positive_recipes', 0),
                    preference_data.get('negative_recipes', 0),
                    preference_data.get('average_rating_with_ingredient', 0.0),
                    preference_data.get('would_make_again_with_ingredient', 0.0),
                    category,
                    preference_data.get('first_encountered_at')
                ))

                conn.commit()
                return True

        except Exception as e:
            logger.error(f"Error updating ingredient preference: {e}")
            return False

    async def get_user_learning_progress(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user learning progress and achievements"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT * FROM user_learning_progress WHERE user_id = ?
                """, (user_id,))

                progress = cursor.fetchone()
                if not progress:
                    return None

                return {
                    'user_id': progress['user_id'],
                    'ratings_milestone': progress['ratings_milestone'],
                    'cuisines_explored': progress['cuisines_explored'],
                    'ingredients_learned': progress['ingredients_learned'],
                    'profile_accuracy_score': progress['profile_accuracy_score'],
                    'recommendation_success_rate': progress['recommendation_success_rate'],
                    'dominant_cuisine': progress['dominant_cuisine'],
                    'flavor_profile': progress['flavor_profile'],
                    'cooking_complexity_preference': progress['cooking_complexity_preference'],
                    'achievements': json.loads(progress['achievements']) if progress['achievements'] else [],
                    'learning_started_at': progress['learning_started_at'],
                    'last_milestone_reached_at': progress['last_milestone_reached_at']
                }

        except Exception as e:
            logger.error(f"Error getting user learning progress: {e}")
            return None

    # ===== SHOPPING OPTIMIZATION METHODS (Task 10) =====

    def init_shopping_optimization_tables_sync(self):
        """Initialize shopping optimization database tables (synchronous version)"""
        try:
            # Task 10 related comment: Initialize shopping optimization schema synchronously
            import os
            script_path = os.path.join(os.path.dirname(__file__), '..', '..', 'database', 'migrations', '04_shopping_optimization.sql')

            if os.path.exists(script_path):
                with open(script_path, 'r') as f:
                    shopping_schema = f.read()

                with self.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.executescript(shopping_schema)
                    conn.commit()
                    logger.info("Shopping optimization database tables initialized successfully")
            else:
                logger.warning(f"Shopping optimization schema file not found at {script_path}")

        except Exception as e:
            logger.error(f"Failed to initialize shopping optimization tables: {e}")

    async def init_shopping_optimization_tables(self):
        """Initialize shopping optimization database tables"""
        try:
            # Task 10 related comment: Initialize shopping optimization schema
            import os
            script_path = os.path.join(os.path.dirname(__file__), '..', '..', 'database', 'migrations', '04_shopping_optimization.sql')

            if os.path.exists(script_path):
                with open(script_path, 'r') as f:
                    shopping_schema = f.read()

                with self.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.executescript(shopping_schema)
                    conn.commit()
                    logger.info("Shopping optimization database tables initialized successfully")
            else:
                logger.warning(f"Shopping optimization schema file not found at {script_path}")

        except Exception as e:
            logger.error(f"Failed to initialize shopping optimization tables: {e}")

    async def create_shopping_optimization(self, optimization_data: Dict[str, Any], user_id: str) -> str:
        """Create a new shopping optimization session"""
        try:
            # Task 10 related comment: Create shopping optimization with consolidation data
            optimization_id = str(uuid.uuid4())

            with self.get_connection() as conn:
                cursor = conn.cursor()

                # Insert main shopping optimization record
                cursor.execute("""
                    INSERT INTO shopping_optimizations (
                        id, user_id, optimization_name, recipe_ids,
                        total_unique_ingredients, consolidation_opportunities,
                        estimated_total_cost, cost_savings_potential, cost_per_serving,
                        preferred_store_id, estimated_shopping_time_minutes,
                        optimization_status, optimization_score, expires_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    optimization_id,
                    user_id,
                    optimization_data.get('optimization_name', f'Shopping List {datetime.now().strftime("%Y-%m-%d")}'),
                    json.dumps(optimization_data.get('recipe_ids', [])),
                    optimization_data.get('total_unique_ingredients', 0),
                    optimization_data.get('consolidation_opportunities', 0),
                    optimization_data.get('estimated_total_cost', 0.0),
                    optimization_data.get('cost_savings_potential', 0.0),
                    optimization_data.get('cost_per_serving', 0.0),
                    optimization_data.get('preferred_store_id'),
                    optimization_data.get('estimated_shopping_time_minutes', 0),
                    optimization_data.get('optimization_status', 'pending'),
                    optimization_data.get('optimization_score', 0.0),
                    optimization_data.get('expires_at')
                ))

                conn.commit()
                logger.info(f"Created shopping optimization {optimization_id} for user {user_id}")
                return optimization_id

        except Exception as e:
            logger.error(f"Error creating shopping optimization: {e}")
            raise

    async def get_shopping_optimization(self, optimization_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Retrieve shopping optimization by ID"""
        try:
            # Task 10 related comment: Retrieve shopping optimization with all related data
            with self.get_connection() as conn:
                cursor = conn.cursor()

                query = """
                    SELECT * FROM shopping_optimizations
                    WHERE id = ?
                """
                params = [optimization_id]

                if user_id:
                    query += " AND user_id = ?"
                    params.append(user_id)

                cursor.execute(query, params)
                optimization = cursor.fetchone()

                if not optimization:
                    return None

                # Get ingredient consolidations
                consolidations = await self.get_ingredient_consolidations(optimization_id)

                # Get bulk buying suggestions
                bulk_suggestions = await self.get_bulk_buying_suggestions(optimization_id)

                # Get shopping path segments
                path_segments = await self.get_shopping_path_segments(optimization_id)

                return {
                    'id': optimization['id'],
                    'user_id': optimization['user_id'],
                    'optimization_name': optimization['optimization_name'],
                    'recipe_ids': json.loads(optimization['recipe_ids']) if optimization['recipe_ids'] else [],
                    'total_unique_ingredients': optimization['total_unique_ingredients'],
                    'consolidation_opportunities': optimization['consolidation_opportunities'],
                    'estimated_total_cost': optimization['estimated_total_cost'],
                    'cost_savings_potential': optimization['cost_savings_potential'],
                    'cost_per_serving': optimization['cost_per_serving'],
                    'preferred_store_id': optimization['preferred_store_id'],
                    'estimated_shopping_time_minutes': optimization['estimated_shopping_time_minutes'],
                    'optimization_status': optimization['optimization_status'],
                    'optimization_score': optimization['optimization_score'],
                    'created_at': optimization['created_at'],
                    'expires_at': optimization['expires_at'],
                    'last_used_at': optimization['last_used_at'],
                    'consolidations': consolidations,
                    'bulk_suggestions': bulk_suggestions,
                    'path_segments': path_segments
                }

        except Exception as e:
            logger.error(f"Error getting shopping optimization: {e}")
            return None

    async def get_user_shopping_optimizations(self, user_id: str, status: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Get shopping optimizations for a user"""
        try:
            # Task 10 related comment: Retrieve user's shopping optimization history
            with self.get_connection() as conn:
                cursor = conn.cursor()

                query = """
                    SELECT * FROM shopping_optimizations
                    WHERE user_id = ?
                """
                params = [user_id]

                if status:
                    query += " AND optimization_status = ?"
                    params.append(status)

                query += " ORDER BY created_at DESC LIMIT ?"
                params.append(limit)

                cursor.execute(query, params)
                optimizations = cursor.fetchall()

                result = []
                for opt in optimizations:
                    result.append({
                        'id': opt['id'],
                        'optimization_name': opt['optimization_name'],
                        'recipe_ids': json.loads(opt['recipe_ids']) if opt['recipe_ids'] else [],
                        'total_unique_ingredients': opt['total_unique_ingredients'],
                        'estimated_total_cost': opt['estimated_total_cost'],
                        'cost_savings_potential': opt['cost_savings_potential'],
                        'optimization_status': opt['optimization_status'],
                        'optimization_score': opt['optimization_score'],
                        'created_at': opt['created_at'],
                        'expires_at': opt['expires_at']
                    })

                return result

        except Exception as e:
            logger.error(f"Error getting user shopping optimizations: {e}")
            return []

    async def create_ingredient_consolidation(self, optimization_id: str, consolidation_data: Dict[str, Any]) -> str:
        """Create ingredient consolidation record"""
        try:
            # Task 10 related comment: Store ingredient consolidation with source recipe tracking
            consolidation_id = str(uuid.uuid4())

            with self.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    INSERT INTO ingredient_consolidations (
                        id, shopping_optimization_id, consolidated_ingredient_name,
                        source_recipes, total_consolidated_quantity, final_unit,
                        unit_cost, total_cost, bulk_discount_available,
                        suggested_package_size, suggested_package_unit,
                        product_category_id, typical_aisle, store_section
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    consolidation_id,
                    optimization_id,
                    consolidation_data['consolidated_ingredient_name'],
                    json.dumps(consolidation_data.get('source_recipes', [])),
                    consolidation_data['total_consolidated_quantity'],
                    consolidation_data['final_unit'],
                    consolidation_data.get('unit_cost', 0.0),
                    consolidation_data.get('total_cost', 0.0),
                    consolidation_data.get('bulk_discount_available', False),
                    consolidation_data.get('suggested_package_size'),
                    consolidation_data.get('suggested_package_unit'),
                    consolidation_data.get('product_category_id'),
                    consolidation_data.get('typical_aisle'),
                    consolidation_data.get('store_section')
                ))

                conn.commit()
                return consolidation_id

        except Exception as e:
            logger.error(f"Error creating ingredient consolidation: {e}")
            raise

    async def get_ingredient_consolidations(self, optimization_id: str) -> List[Dict[str, Any]]:
        """Get ingredient consolidations for an optimization"""
        try:
            # Task 10 related comment: Retrieve ingredient consolidations with source recipe data
            with self.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT * FROM ingredient_consolidations
                    WHERE shopping_optimization_id = ?
                    ORDER BY consolidated_ingredient_name
                """, (optimization_id,))

                consolidations = cursor.fetchall()

                result = []
                for cons in consolidations:
                    result.append({
                        'id': cons['id'],
                        'consolidated_ingredient_name': cons['consolidated_ingredient_name'],
                        'source_recipes': json.loads(cons['source_recipes']) if cons['source_recipes'] else [],
                        'total_consolidated_quantity': cons['total_consolidated_quantity'],
                        'final_unit': cons['final_unit'],
                        'unit_cost': cons['unit_cost'],
                        'total_cost': cons['total_cost'],
                        'bulk_discount_available': cons['bulk_discount_available'],
                        'suggested_package_size': cons['suggested_package_size'],
                        'suggested_package_unit': cons['suggested_package_unit'],
                        'product_category_id': cons['product_category_id'],
                        'typical_aisle': cons['typical_aisle'],
                        'store_section': cons['store_section'],
                        'created_at': cons['created_at']
                    })

                return result

        except Exception as e:
            logger.error(f"Error getting ingredient consolidations: {e}")
            return []

    async def create_bulk_buying_suggestion(self, optimization_id: str, consolidation_id: str, suggestion_data: Dict[str, Any]) -> str:
        """Create bulk buying suggestion"""
        try:
            # Task 10 related comment: Create bulk buying opportunity with cost analysis
            suggestion_id = str(uuid.uuid4())

            with self.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    INSERT INTO bulk_buying_suggestions (
                        id, shopping_optimization_id, ingredient_consolidation_id,
                        suggestion_type, current_needed_quantity, suggested_bulk_quantity, bulk_unit,
                        regular_unit_price, bulk_unit_price, immediate_savings, cost_per_unit_savings,
                        storage_requirements, estimated_usage_timeframe_days, perishability_risk,
                        recommendation_score, user_preference_match
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    suggestion_id,
                    optimization_id,
                    consolidation_id,
                    suggestion_data['suggestion_type'],
                    suggestion_data['current_needed_quantity'],
                    suggestion_data['suggested_bulk_quantity'],
                    suggestion_data['bulk_unit'],
                    suggestion_data['regular_unit_price'],
                    suggestion_data['bulk_unit_price'],
                    suggestion_data.get('immediate_savings', 0.0),
                    suggestion_data.get('cost_per_unit_savings', 0.0),
                    suggestion_data.get('storage_requirements', 'pantry'),
                    suggestion_data.get('estimated_usage_timeframe_days', 30),
                    suggestion_data.get('perishability_risk', 'low'),
                    suggestion_data.get('recommendation_score', 0.0),
                    suggestion_data.get('user_preference_match', 0.5)
                ))

                conn.commit()
                return suggestion_id

        except Exception as e:
            logger.error(f"Error creating bulk buying suggestion: {e}")
            raise

    async def get_bulk_buying_suggestions(self, optimization_id: str) -> List[Dict[str, Any]]:
        """Get bulk buying suggestions for an optimization"""
        try:
            # Task 10 related comment: Retrieve bulk buying suggestions with cost analysis
            with self.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT bbs.*, ic.consolidated_ingredient_name
                    FROM bulk_buying_suggestions bbs
                    JOIN ingredient_consolidations ic ON bbs.ingredient_consolidation_id = ic.id
                    WHERE bbs.shopping_optimization_id = ?
                    ORDER BY bbs.recommendation_score DESC
                """, (optimization_id,))

                suggestions = cursor.fetchall()

                result = []
                for sugg in suggestions:
                    result.append({
                        'id': sugg['id'],
                        'ingredient_consolidation_id': sugg['ingredient_consolidation_id'],
                        'ingredient_name': sugg['consolidated_ingredient_name'],
                        'suggestion_type': sugg['suggestion_type'],
                        'current_needed_quantity': sugg['current_needed_quantity'],
                        'suggested_bulk_quantity': sugg['suggested_bulk_quantity'],
                        'bulk_unit': sugg['bulk_unit'],
                        'regular_unit_price': sugg['regular_unit_price'],
                        'bulk_unit_price': sugg['bulk_unit_price'],
                        'immediate_savings': sugg['immediate_savings'],
                        'cost_per_unit_savings': sugg['cost_per_unit_savings'],
                        'storage_requirements': sugg['storage_requirements'],
                        'estimated_usage_timeframe_days': sugg['estimated_usage_timeframe_days'],
                        'perishability_risk': sugg['perishability_risk'],
                        'recommendation_score': sugg['recommendation_score'],
                        'user_preference_match': sugg['user_preference_match'],
                        'created_at': sugg['created_at']
                    })

                return result

        except Exception as e:
            logger.error(f"Error getting bulk buying suggestions: {e}")
            return []

    async def create_shopping_path_segment(self, optimization_id: str, segment_data: Dict[str, Any]) -> str:
        """Create shopping path segment"""
        try:
            # Task 10 related comment: Create store layout navigation segment
            segment_id = str(uuid.uuid4())

            with self.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    INSERT INTO shopping_path_segments (
                        id, shopping_optimization_id, segment_order,
                        store_section, aisle_number, section_description,
                        ingredient_consolidation_ids, estimated_time_minutes,
                        navigation_notes, previous_segment_id, next_segment_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    segment_id,
                    optimization_id,
                    segment_data['segment_order'],
                    segment_data['store_section'],
                    segment_data.get('aisle_number'),
                    segment_data.get('section_description'),
                    json.dumps(segment_data.get('ingredient_consolidation_ids', [])),
                    segment_data.get('estimated_time_minutes', 0),
                    segment_data.get('navigation_notes'),
                    segment_data.get('previous_segment_id'),
                    segment_data.get('next_segment_id')
                ))

                conn.commit()
                return segment_id

        except Exception as e:
            logger.error(f"Error creating shopping path segment: {e}")
            raise

    async def get_shopping_path_segments(self, optimization_id: str) -> List[Dict[str, Any]]:
        """Get shopping path segments for an optimization"""
        try:
            # Task 10 related comment: Retrieve shopping path segments in order
            with self.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT * FROM shopping_path_segments
                    WHERE shopping_optimization_id = ?
                    ORDER BY segment_order
                """, (optimization_id,))

                segments = cursor.fetchall()

                result = []
                for seg in segments:
                    result.append({
                        'id': seg['id'],
                        'segment_order': seg['segment_order'],
                        'store_section': seg['store_section'],
                        'aisle_number': seg['aisle_number'],
                        'section_description': seg['section_description'],
                        'ingredient_consolidation_ids': json.loads(seg['ingredient_consolidation_ids']) if seg['ingredient_consolidation_ids'] else [],
                        'estimated_time_minutes': seg['estimated_time_minutes'],
                        'navigation_notes': seg['navigation_notes'],
                        'previous_segment_id': seg['previous_segment_id'],
                        'next_segment_id': seg['next_segment_id'],
                        'created_at': seg['created_at']
                    })

                return result

        except Exception as e:
            logger.error(f"Error getting shopping path segments: {e}")
            return []

    async def update_shopping_optimization_status(self, optimization_id: str, status: str, user_id: Optional[str] = None) -> bool:
        """Update shopping optimization status"""
        try:
            # Task 10 related comment: Update optimization status and last used timestamp
            with self.get_connection() as conn:
                cursor = conn.cursor()

                query = """
                    UPDATE shopping_optimizations
                    SET optimization_status = ?, last_used_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """
                params = [status, optimization_id]

                if user_id:
                    query += " AND user_id = ?"
                    params.append(user_id)

                cursor.execute(query, params)
                conn.commit()

                return cursor.rowcount > 0

        except Exception as e:
            logger.error(f"Error updating shopping optimization status: {e}")
            return False

    async def get_user_shopping_preferences(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user shopping preferences and behavior patterns"""
        try:
            # Task 10 related comment: Retrieve user shopping behavior for personalization
            with self.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT * FROM user_shopping_preferences WHERE user_id = ?
                """, (user_id,))

                prefs = cursor.fetchone()
                if not prefs:
                    return None

                return {
                    'user_id': prefs['user_id'],
                    'preferred_stores': json.loads(prefs['preferred_stores']) if prefs['preferred_stores'] else [],
                    'budget_conscious_level': prefs['budget_conscious_level'],
                    'bulk_buying_preference': prefs['bulk_buying_preference'],
                    'average_shopping_frequency_days': prefs['average_shopping_frequency_days'],
                    'typical_shopping_time_minutes': prefs['typical_shopping_time_minutes'],
                    'prefers_organic': prefs['prefers_organic'],
                    'prefers_name_brands': prefs['prefers_name_brands'],
                    'prioritize_cost_savings': prefs['prioritize_cost_savings'],
                    'prioritize_shopping_time': prefs['prioritize_shopping_time'],
                    'prioritize_ingredient_quality': prefs['prioritize_ingredient_quality'],
                    'actual_vs_estimated_accuracy': prefs['actual_vs_estimated_accuracy'],
                    'cost_prediction_accuracy': prefs['cost_prediction_accuracy'],
                    'time_prediction_accuracy': prefs['time_prediction_accuracy'],
                    'created_at': prefs['created_at'],
                    'updated_at': prefs['updated_at']
                }

        except Exception as e:
            logger.error(f"Error getting user shopping preferences: {e}")
            return None

    async def create_or_update_user_shopping_preferences(self, user_id: str, preferences: Dict[str, Any]) -> bool:
        """Create or update user shopping preferences"""
        try:
            # Task 10 related comment: Store user shopping behavior patterns for personalization
            with self.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    INSERT OR REPLACE INTO user_shopping_preferences (
                        user_id, preferred_stores, budget_conscious_level, bulk_buying_preference,
                        average_shopping_frequency_days, typical_shopping_time_minutes,
                        prefers_organic, prefers_name_brands,
                        prioritize_cost_savings, prioritize_shopping_time, prioritize_ingredient_quality,
                        actual_vs_estimated_accuracy, cost_prediction_accuracy, time_prediction_accuracy,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    user_id,
                    json.dumps(preferences.get('preferred_stores', [])),
                    preferences.get('budget_conscious_level', 0.5),
                    preferences.get('bulk_buying_preference', 0.5),
                    preferences.get('average_shopping_frequency_days', 7),
                    preferences.get('typical_shopping_time_minutes', 45),
                    preferences.get('prefers_organic', False),
                    preferences.get('prefers_name_brands', False),
                    preferences.get('prioritize_cost_savings', True),
                    preferences.get('prioritize_shopping_time', False),
                    preferences.get('prioritize_ingredient_quality', False),
                    preferences.get('actual_vs_estimated_accuracy', 0.0),
                    preferences.get('cost_prediction_accuracy', 0.0),
                    preferences.get('time_prediction_accuracy', 0.0)
                ))

                conn.commit()
                return True

        except Exception as e:
            logger.error(f"Error creating/updating user shopping preferences: {e}")
            return False

    async def get_stores(self, location: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get available stores, optionally filtered by location"""
        try:
            # Task 10 related comment: Retrieve store information for shopping optimization
            with self.get_connection() as conn:
                cursor = conn.cursor()

                query = "SELECT * FROM stores"
                params = []

                if location:
                    query += " WHERE location LIKE ?"
                    params.append(f"%{location}%")

                query += " ORDER BY name"

                cursor.execute(query, params)
                stores = cursor.fetchall()

                result = []
                for store in stores:
                    result.append({
                        'id': store['id'],
                        'name': store['name'],
                        'store_chain': store['store_chain'],
                        'location': store['location'],
                        'layout_data': json.loads(store['layout_data']) if store['layout_data'] else {},
                        'avg_prices_data': json.loads(store['avg_prices_data']) if store['avg_prices_data'] else {},
                        'created_at': store['created_at'],
                        'updated_at': store['updated_at']
                    })

                return result

        except Exception as e:
            logger.error(f"Error getting stores: {e}")
            return []

    async def get_product_categories(self) -> List[Dict[str, Any]]:
        """Get product categories for store organization"""
        try:
            # Task 10 related comment: Retrieve product categories for store layout optimization
            with self.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT * FROM product_categories
                    ORDER BY sort_order, category_name
                """)
                categories = cursor.fetchall()

                result = []
                for cat in categories:
                    result.append({
                        'id': cat['id'],
                        'category_name': cat['category_name'],
                        'parent_category_id': cat['parent_category_id'],
                        'typical_aisle': cat['typical_aisle'],
                        'sort_order': cat['sort_order'],
                        'created_at': cat['created_at']
                    })

                return result

        except Exception as e:
            logger.error(f"Error getting product categories: {e}")
            return []


# Global recipe database service instance
recipe_db_service = RecipeDatabaseService()
