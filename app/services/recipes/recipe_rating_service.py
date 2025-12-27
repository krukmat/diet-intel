"""
Recipe Rating Service

Handles recipe ratings, user preference learning, and taste profile management.
Tracks user preferences and ingredient/cuisine preferences for recommendation engine.

Task: Phase 2 Tarea 5 - Recipe Database Refactoring
"""

import json
import uuid
import logging
from typing import Optional, List, Dict, Any

from app.services.database import DatabaseService

logger = logging.getLogger(__name__)


class RecipeRatingService:
    """Service for recipe ratings and user preference learning"""

    def __init__(self, db_service: Optional[DatabaseService] = None):
        """
        Initialize recipe rating service.

        Args:
            db_service: DatabaseService instance (optional)
        """
        self.db_service = db_service or DatabaseService()

    async def rate_recipe(
        self,
        user_id: str,
        recipe_id: str,
        rating: int,
        review: Optional[str] = None,
        made_modifications: bool = False,
        would_make_again: Optional[bool] = None
    ) -> str:
        """
        Add or update a recipe rating.

        Args:
            user_id: User ID
            recipe_id: Recipe ID to rate
            rating: Rating 1-5
            review: Optional review text
            made_modifications: Whether user modified the recipe
            would_make_again: Whether user would make recipe again

        Returns:
            Rating ID

        Raises:
            RuntimeError: If rating fails
        """
        try:
            rating_id = str(uuid.uuid4())

            with self.db_service.get_connection() as conn:
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
        """
        Get rating statistics for a recipe.

        Args:
            recipe_id: Recipe ID

        Returns:
            Dictionary with rating statistics
        """
        try:
            with self.db_service.get_connection() as conn:
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
        """
        Log a recipe generation request for analytics.

        Args:
            user_id: User ID
            session_id: Session ID
            cache_key: Cache key used
            request_data: Request parameters
            generated_recipe_id: ID of generated recipe
            processing_time_ms: Processing time
            success: Whether generation succeeded
            error_message: Error message if failed

        Returns:
            Request log ID
        """
        try:
            request_id = str(uuid.uuid4())

            with self.db_service.get_connection() as conn:
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
            raise RuntimeError(f"Failed to log request: {str(e)}")

    async def get_user_taste_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user's taste profile.

        Args:
            user_id: User ID

        Returns:
            Taste profile dictionary or None
        """
        try:
            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("SELECT * FROM user_taste_profiles WHERE user_id = ?", (user_id,))
                row = cursor.fetchone()

                if not row:
                    return None

                return {
                    'user_id': row['user_id'],
                    'profile_confidence': row.get('profile_confidence', 0),
                    'cuisine_preferences': json.loads(row.get('cuisine_preferences', '[]')),
                    'liked_ingredients': json.loads(row.get('liked_ingredients', '[]')),
                    'disliked_ingredients': json.loads(row.get('disliked_ingredients', '[]')),
                    'preferred_prep_time_minutes': row.get('preferred_prep_time_minutes'),
                    'preferred_cook_time_minutes': row.get('preferred_cook_time_minutes'),
                    'preferred_calories_per_serving': row.get('preferred_calories_per_serving'),
                    'macro_preferences': json.loads(row.get('macro_preferences', '{}'))
                }

        except Exception as e:
            logger.error(f"Error getting taste profile for user {user_id}: {e}")
            return None

    async def create_or_update_user_taste_profile(
        self,
        user_id: str,
        profile_data: Dict[str, Any]
    ) -> bool:
        """
        Create or update user's taste profile.

        Args:
            user_id: User ID
            profile_data: Profile data dictionary

        Returns:
            True if successful
        """
        try:
            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    INSERT OR REPLACE INTO user_taste_profiles (
                        user_id, profile_confidence, cuisine_preferences, liked_ingredients,
                        disliked_ingredients, preferred_prep_time_minutes, preferred_cook_time_minutes,
                        preferred_calories_per_serving, macro_preferences, last_updated
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    user_id,
                    profile_data.get('profile_confidence', 0),
                    json.dumps(profile_data.get('cuisine_preferences', [])),
                    json.dumps(profile_data.get('liked_ingredients', [])),
                    json.dumps(profile_data.get('disliked_ingredients', [])),
                    profile_data.get('preferred_prep_time_minutes'),
                    profile_data.get('preferred_cook_time_minutes'),
                    profile_data.get('preferred_calories_per_serving'),
                    json.dumps(profile_data.get('macro_preferences', {}))
                ))

                conn.commit()
                logger.info(f"Updated taste profile for user {user_id}")
                return True

        except Exception as e:
            logger.error(f"Error updating taste profile: {e}")
            return False

    async def get_user_ratings_for_learning(
        self,
        user_id: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get user's recipe ratings for preference learning.

        Args:
            user_id: User ID
            limit: Max number of ratings

        Returns:
            List of rating records
        """
        try:
            with self.db_service.get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    SELECT urr.*, r.cuisine_type, r.ingredients
                    FROM user_recipe_ratings urr
                    JOIN recipes r ON urr.recipe_id = r.id
                    WHERE urr.user_id = ?
                    ORDER BY urr.created_at DESC
                    LIMIT ?
                """, (user_id, limit))

                rows = cursor.fetchall()
                return [dict(row) for row in rows]

        except Exception as e:
            logger.error(f"Error getting user ratings for learning: {e}")
            return []

    async def update_cuisine_preference(
        self,
        user_id: str,
        cuisine_type: str,
        preference_score: float
    ) -> bool:
        """
        Update user's preference for a cuisine type.

        Args:
            user_id: User ID
            cuisine_type: Cuisine type
            preference_score: Preference score (-1 to 1)

        Returns:
            True if successful
        """
        try:
            profile = await self.get_user_taste_profile(user_id)
            if not profile:
                profile = {
                    'profile_confidence': 0,
                    'cuisine_preferences': [],
                    'liked_ingredients': [],
                    'disliked_ingredients': [],
                    'macro_preferences': {}
                }

            # Update cuisine preference
            cuisines = profile['cuisine_preferences']
            existing = [c for c in cuisines if c.get('cuisine') != cuisine_type]
            existing.append({'cuisine': cuisine_type, 'score': preference_score})
            profile['cuisine_preferences'] = existing

            # Update confidence based on number of preferences
            profile['profile_confidence'] = min(1.0, len(existing) * 0.1)

            return await self.create_or_update_user_taste_profile(user_id, profile)

        except Exception as e:
            logger.error(f"Error updating cuisine preference: {e}")
            return False

    async def update_ingredient_preference(
        self,
        user_id: str,
        ingredient_name: str,
        preference_score: float
    ) -> bool:
        """
        Update user's preference for an ingredient.

        Args:
            user_id: User ID
            ingredient_name: Ingredient name
            preference_score: Preference score (-1 to 1)

        Returns:
            True if successful
        """
        try:
            profile = await self.get_user_taste_profile(user_id)
            if not profile:
                profile = {
                    'profile_confidence': 0,
                    'cuisine_preferences': [],
                    'liked_ingredients': [],
                    'disliked_ingredients': [],
                    'macro_preferences': {}
                }

            # Update ingredient preference
            if preference_score > 0:
                liked = [ing for ing in profile['liked_ingredients'] if ing.get('ingredient') != ingredient_name]
                liked.append({'ingredient': ingredient_name, 'preference': preference_score})
                profile['liked_ingredients'] = liked
            else:
                disliked = [ing for ing in profile['disliked_ingredients'] if ing.get('ingredient') != ingredient_name]
                disliked.append({'ingredient': ingredient_name, 'preference': preference_score})
                profile['disliked_ingredients'] = disliked

            return await self.create_or_update_user_taste_profile(user_id, profile)

        except Exception as e:
            logger.error(f"Error updating ingredient preference: {e}")
            return False

    async def get_user_learning_progress(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user's preference learning progress.

        Args:
            user_id: User ID

        Returns:
            Learning progress dictionary
        """
        try:
            profile = await self.get_user_taste_profile(user_id)
            if not profile:
                return None

            ratings = await self.get_user_ratings_for_learning(user_id, limit=100)

            return {
                'total_ratings': len(ratings),
                'cuisines_learned': len(profile.get('cuisine_preferences', [])),
                'ingredients_learned': len(profile.get('liked_ingredients', [])) + len(profile.get('disliked_ingredients', [])),
                'profile_confidence': profile.get('profile_confidence', 0),
                'last_updated': profile.get('last_updated')
            }

        except Exception as e:
            logger.error(f"Error getting learning progress: {e}")
            return None
