import sqlite3
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
import logging

from app.services.database import DatabaseService
from app.services.recipe_ai_engine import GeneratedRecipe, RecipeIngredient, RecipeInstruction, RecipeNutrition

logger = logging.getLogger(__name__)


class RecipeDatabaseService(DatabaseService):
    """Extended database service for Recipe AI Generator functionality"""
    
    def __init__(self, db_path: str = "dietintel.db", max_connections: int = 10):
        super().__init__(db_path, max_connections)
        self.init_recipe_tables()
    
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
    
    # ===== RECIPE CRUD OPERATIONS =====
    
    async def create_recipe(self, recipe: GeneratedRecipe, user_id: Optional[str] = None) -> str:
        """Store a generated recipe in the database"""
        try:
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
                
                return {
                    'total_ratings': stats['total_ratings'],
                    'average_rating': round(stats['average_rating'], 2) if stats['average_rating'] else 0,
                    'would_make_again_percentage': (stats['would_make_again_count'] / max(stats['total_ratings'], 1)) * 100
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


# Global recipe database service instance
recipe_db_service = RecipeDatabaseService()