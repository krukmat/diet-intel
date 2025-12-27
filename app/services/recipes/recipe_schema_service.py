"""
Recipe Schema Service

Manages database schema creation and migrations for recipe tables.
Handles DDL operations and schema evolution.

Task: Phase 2 Tarea 5 - Recipe Database Refactoring
"""

import os
import logging
from typing import Optional

from app.services.database import DatabaseService

logger = logging.getLogger(__name__)


class RecipeSchemaService:
    """Service for recipe database schema management"""

    def __init__(self, db_service: Optional[DatabaseService] = None):
        """
        Initialize recipe schema service.

        Args:
            db_service: DatabaseService instance (optional)
        """
        self.db_service = db_service or DatabaseService()

    def init_recipe_tables(self) -> None:
        """
        Initialize recipe-related database tables.

        Attempts to load schema from SQL file, falls back to manual creation.
        """
        try:
            # Read and execute recipe table creation script
            script_path = os.path.join(
                os.path.dirname(__file__), '..', '..', '..', 'database', 'init', '02_recipe_tables.sql'
            )

            if os.path.exists(script_path):
                with open(script_path, 'r') as f:
                    recipe_schema = f.read()

                with self.db_service.get_connection() as conn:
                    cursor = conn.cursor()
                    # Execute the entire schema (SQLite supports multiple statements)
                    cursor.executescript(recipe_schema)
                    conn.commit()
                    logger.info("Recipe database tables initialized successfully from SQL file")
            else:
                logger.info(f"Recipe schema file not found at {script_path}, creating tables manually")
                self._create_recipe_tables_manually()

        except Exception as e:
            logger.error(f"Failed to initialize recipe tables from file: {e}")
            logger.info("Falling back to manual table creation")
            self._create_recipe_tables_manually()

    def _create_recipe_tables_manually(self) -> None:
        """
        Fallback method to create recipe tables manually via SQL.

        Creates all necessary recipe-related tables if they don't exist.
        """
        with self.db_service.get_connection() as conn:
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
                    calories_per_unit REAL,
                    protein_g_per_unit REAL,
                    fat_g_per_unit REAL,
                    carbs_g_per_unit REAL,
                    is_optional BOOLEAN DEFAULT 0,
                    preparation_note TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
                    temperature_celsius REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
                )
            """)

            # Recipe nutrition table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS recipe_nutrition (
                    recipe_id TEXT PRIMARY KEY,
                    calories_per_serving REAL,
                    protein_g_per_serving REAL,
                    fat_g_per_serving REAL,
                    carbs_g_per_serving REAL,
                    fiber_g_per_serving REAL,
                    sugar_g_per_serving REAL,
                    sodium_mg_per_serving REAL,
                    recipe_score REAL,
                    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
                )
            """)

            # User recipe ratings table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_recipe_ratings (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    recipe_id TEXT NOT NULL,
                    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                    review TEXT,
                    made_modifications BOOLEAN DEFAULT 0,
                    would_make_again BOOLEAN,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
                )
            """)

            # Recipe generation requests table (for analytics)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS recipe_generation_requests (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    session_id TEXT,
                    cache_key TEXT,
                    request_data TEXT,
                    generated_recipe_id TEXT,
                    processing_time_ms REAL,
                    success BOOLEAN DEFAULT 1,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # User taste profiles table (for learning)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_taste_profiles (
                    user_id TEXT PRIMARY KEY,
                    profile_confidence REAL DEFAULT 0,
                    cuisine_preferences TEXT DEFAULT '[]',
                    liked_ingredients TEXT DEFAULT '[]',
                    disliked_ingredients TEXT DEFAULT '[]',
                    preferred_prep_time_minutes INTEGER,
                    preferred_cook_time_minutes INTEGER,
                    preferred_calories_per_serving REAL,
                    macro_preferences TEXT DEFAULT '{}',
                    modification_tendency REAL DEFAULT 0,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            conn.commit()
            logger.info("Recipe tables created successfully")
