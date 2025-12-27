"""
Shopping Table Service

Manages shopping optimization tables and operations.
Handles ingredient consolidation, path optimization, and shopping preferences.

Task: Phase 2 Tarea 5 - Recipe Database Refactoring
"""

import json
import uuid
import logging
from typing import Optional, List, Dict, Any

from app.services.database import DatabaseService

logger = logging.getLogger(__name__)


class ShoppingTableService:
    """Service for shopping optimization operations"""

    def __init__(self, db_service: Optional[DatabaseService] = None):
        """
        Initialize shopping table service.

        Args:
            db_service: DatabaseService instance (optional)
        """
        self.db_service = db_service or DatabaseService()

    async def init_shopping_optimization_tables(self) -> None:
        """Initialize shopping optimization tables asynchronously."""
        self.init_shopping_optimization_tables_sync()

    def init_shopping_optimization_tables_sync(self) -> None:
        """Initialize shopping optimization related tables synchronously."""
        try:
            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                # Shopping optimization table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS shopping_optimizations (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        optimization_data TEXT,
                        total_cost REAL,
                        estimated_savings REAL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                # Ingredient consolidations
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS ingredient_consolidations (
                        id TEXT PRIMARY KEY,
                        optimization_id TEXT NOT NULL,
                        consolidation_data TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (optimization_id) REFERENCES shopping_optimizations(id)
                    )
                """)

                # Bulk buying suggestions
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS bulk_buying_suggestions (
                        id TEXT PRIMARY KEY,
                        optimization_id TEXT NOT NULL,
                        consolidation_id TEXT,
                        suggestion_data TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (optimization_id) REFERENCES shopping_optimizations(id)
                    )
                """)

                # Shopping path segments
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS shopping_path_segments (
                        id TEXT PRIMARY KEY,
                        optimization_id TEXT NOT NULL,
                        segment_data TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (optimization_id) REFERENCES shopping_optimizations(id)
                    )
                """)

                # User shopping preferences
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS user_shopping_preferences (
                        user_id TEXT PRIMARY KEY,
                        preferences_data TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                conn.commit()
                logger.info("Shopping optimization tables initialized")
        except Exception as e:
            logger.error(f"Error initializing shopping tables: {e}")

    async def create_shopping_optimization(
        self,
        optimization_data: Dict[str, Any],
        user_id: str
    ) -> str:
        """
        Create a new shopping optimization.

        Args:
            optimization_data: Optimization data
            user_id: User ID

        Returns:
            Optimization ID
        """
        try:
            optimization_id = str(uuid.uuid4())

            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    INSERT INTO shopping_optimizations (
                        id, user_id, optimization_data, status
                    ) VALUES (?, ?, ?, 'pending')
                """, (optimization_id, user_id, json.dumps(optimization_data)))

                conn.commit()
                return optimization_id

        except Exception as e:
            logger.error(f"Error creating shopping optimization: {e}")
            raise RuntimeError(f"Failed to create optimization: {str(e)}")

    async def get_shopping_optimization(
        self,
        optimization_id: str,
        user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get shopping optimization by ID."""
        try:
            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                if user_id:
                    cursor.execute(
                        "SELECT * FROM shopping_optimizations WHERE id = ? AND user_id = ?",
                        (optimization_id, user_id)
                    )
                else:
                    cursor.execute(
                        "SELECT * FROM shopping_optimizations WHERE id = ?",
                        (optimization_id,)
                    )

                row = cursor.fetchone()
                return dict(row) if row else None

        except Exception as e:
            logger.error(f"Error getting shopping optimization: {e}")
            return None

    async def get_user_shopping_optimizations(
        self,
        user_id: str,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get user's shopping optimizations."""
        try:
            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                if status:
                    cursor.execute(
                        "SELECT * FROM shopping_optimizations WHERE user_id = ? AND status = ? LIMIT ?",
                        (user_id, status, limit)
                    )
                else:
                    cursor.execute(
                        "SELECT * FROM shopping_optimizations WHERE user_id = ? LIMIT ?",
                        (user_id, limit)
                    )

                return [dict(row) for row in cursor.fetchall()]

        except Exception as e:
            logger.error(f"Error getting user optimizations: {e}")
            return []

    async def update_shopping_optimization_status(
        self,
        optimization_id: str,
        status: str,
        user_id: Optional[str] = None
    ) -> bool:
        """Update optimization status."""
        try:
            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                if user_id:
                    cursor.execute(
                        "UPDATE shopping_optimizations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
                        (status, optimization_id, user_id)
                    )
                else:
                    cursor.execute(
                        "UPDATE shopping_optimizations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (status, optimization_id)
                    )

                conn.commit()
                return cursor.rowcount > 0

        except Exception as e:
            logger.error(f"Error updating optimization status: {e}")
            return False

    async def create_ingredient_consolidation(
        self,
        optimization_id: str,
        consolidation_data: Dict[str, Any]
    ) -> str:
        """Create ingredient consolidation."""
        try:
            consolidation_id = str(uuid.uuid4())

            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    INSERT INTO ingredient_consolidations (
                        id, optimization_id, consolidation_data
                    ) VALUES (?, ?, ?)
                """, (consolidation_id, optimization_id, json.dumps(consolidation_data)))

                conn.commit()
                return consolidation_id

        except Exception as e:
            logger.error(f"Error creating ingredient consolidation: {e}")
            raise RuntimeError(f"Failed to create consolidation: {str(e)}")

    async def get_ingredient_consolidations(self, optimization_id: str) -> List[Dict[str, Any]]:
        """Get ingredient consolidations for optimization."""
        try:
            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute(
                    "SELECT * FROM ingredient_consolidations WHERE optimization_id = ?",
                    (optimization_id,)
                )

                return [dict(row) for row in cursor.fetchall()]

        except Exception as e:
            logger.error(f"Error getting consolidations: {e}")
            return []

    async def get_user_shopping_preferences(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's shopping preferences."""
        try:
            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute(
                    "SELECT preferences_data FROM user_shopping_preferences WHERE user_id = ?",
                    (user_id,)
                )

                row = cursor.fetchone()
                if row:
                    return json.loads(row['preferences_data'])
                return None

        except Exception as e:
            logger.error(f"Error getting shopping preferences: {e}")
            return None

    async def create_or_update_user_shopping_preferences(
        self,
        user_id: str,
        preferences: Dict[str, Any]
    ) -> bool:
        """Create or update user shopping preferences."""
        try:
            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    INSERT OR REPLACE INTO user_shopping_preferences (
                        user_id, preferences_data, updated_at
                    ) VALUES (?, ?, CURRENT_TIMESTAMP)
                """, (user_id, json.dumps(preferences)))

                conn.commit()
                return True

        except Exception as e:
            logger.error(f"Error updating shopping preferences: {e}")
            return False
