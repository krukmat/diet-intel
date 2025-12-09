"""
Taste Learning Service - User Preference Detection and Analysis
Phase R.3.1.1: User Taste Profile Analysis Implementation
"""

import json
import logging
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict, Counter

from app.services.recipe_database import RecipeDatabaseService

logger = logging.getLogger(__name__)


class TasteLearningService:
    """Service for analyzing user preferences and learning taste patterns"""

    def __init__(self, db_service: Optional[RecipeDatabaseService] = None):
        """Initialize taste learning service with database connection"""
        self.db_service = db_service or RecipeDatabaseService()

    async def analyze_cuisine_preferences(self, user_id: str, min_ratings: int = 3) -> Dict[str, Any]:
        """Analyze user's cuisine preferences based on rating patterns"""
        try:
            # Get user's rating history
            ratings = await self.db_service.get_user_ratings_for_learning(user_id, limit=100)

            if len(ratings) < min_ratings:
                logger.info(f"Insufficient ratings ({len(ratings)}) for user {user_id}, minimum {min_ratings} required")
                return self._create_empty_cuisine_analysis()

            # Group ratings by cuisine
            cuisine_data = defaultdict(list)
            for rating in ratings:
                cuisine = rating.get('cuisine_type', 'unknown')
                if cuisine and cuisine != 'unknown':
                    cuisine_data[cuisine].append(rating)

            # Analyze each cuisine
            cuisine_preferences = {}
            total_weight = 0

            for cuisine, cuisine_ratings in cuisine_data.items():
                if len(cuisine_ratings) >= min_ratings:  # Only analyze cuisines with sufficient data
                    analysis = self._analyze_single_cuisine(cuisine, cuisine_ratings)
                    cuisine_preferences[cuisine] = analysis
                    total_weight += analysis['weight']

            # Calculate normalized preference scores
            for cuisine in cuisine_preferences:
                if total_weight > 0:
                    cuisine_preferences[cuisine]['normalized_score'] = (
                        cuisine_preferences[cuisine]['raw_score'] *
                        cuisine_preferences[cuisine]['weight'] / total_weight
                    )
                else:
                    cuisine_preferences[cuisine]['normalized_score'] = 0.0

            # Sort by preference score
            sorted_cuisines = sorted(
                cuisine_preferences.items(),
                key=lambda x: x[1]['normalized_score'],
                reverse=True
            )

            # Calculate confidence based on data volume and consistency
            confidence = self._calculate_cuisine_confidence(cuisine_preferences, len(ratings))

            return {
                'user_id': user_id,
                'total_ratings_analyzed': len(ratings),
                'cuisines_analyzed': len(cuisine_preferences),
                'confidence_score': confidence,
                'cuisine_preferences': dict(sorted_cuisines),
                'top_cuisine': sorted_cuisines[0][0] if sorted_cuisines else None,
                'analysis_timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Error analyzing cuisine preferences for user {user_id}: {e}")
            return self._create_empty_cuisine_analysis()

    def _analyze_single_cuisine(self, cuisine: str, ratings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze preference data for a single cuisine"""
        if not ratings:
            return {'raw_score': 0.0, 'weight': 0, 'confidence': 0.0}

        # Extract rating values
        rating_values = [r['rating'] for r in ratings if r.get('rating') is not None]
        would_make_again = [r['would_make_again'] for r in ratings if r.get('would_make_again') is not None]
        made_modifications = [r['made_modifications'] for r in ratings if r.get('made_modifications') is not None]

        # Calculate base metrics
        avg_rating = statistics.mean(rating_values) if rating_values else 0.0
        would_make_again_ratio = sum(would_make_again) / len(would_make_again) if would_make_again else 0.0
        modification_ratio = sum(made_modifications) / len(made_modifications) if made_modifications else 0.0

        # Calculate raw preference score (normalized to -1 to 1 scale)
        # High ratings and willingness to make again = positive preference
        # High modification rate = slight negative (indicates recipe wasn't perfect)
        rating_score = (avg_rating - 3.0) / 2.0  # Convert 1-5 scale to -1 to 1
        would_make_score = (would_make_again_ratio - 0.5) * 2  # Convert 0-1 to -1 to 1
        modification_penalty = modification_ratio * -0.2  # Small penalty for modifications

        raw_score = (rating_score * 0.6) + (would_make_score * 0.3) + (modification_penalty * 0.1)
        raw_score = max(-1.0, min(1.0, raw_score))  # Clamp to [-1, 1]

        # Calculate weight based on number of ratings and recency
        weight = len(rating_values)

        # Calculate confidence based on consistency of ratings
        if len(rating_values) > 1:
            rating_variance = statistics.variance(rating_values)
            consistency_score = max(0, 1 - (rating_variance / 4.0))  # Lower variance = higher consistency
        else:
            consistency_score = 0.5  # Moderate confidence for single rating

        confidence = min(1.0, (len(rating_values) / 10.0) * consistency_score)

        return {
            'raw_score': round(raw_score, 3),
            'weight': weight,
            'confidence': round(confidence, 3),
            'average_rating': round(avg_rating, 2),
            'would_make_again_ratio': round(would_make_again_ratio, 3),
            'modification_ratio': round(modification_ratio, 3),
            'total_ratings': len(rating_values),
            'rating_consistency': round(consistency_score, 3)
        }

    def _calculate_cuisine_confidence(self, cuisine_preferences: Dict[str, Any], total_ratings: int) -> float:
        """Calculate overall confidence in cuisine preference analysis"""
        if not cuisine_preferences or total_ratings < 5:
            return 0.0

        # Factors affecting confidence:
        # 1. Total number of ratings
        # 2. Number of cuisines analyzed
        # 3. Consistency within cuisines
        # 4. Clear preference differentiation

        volume_factor = min(1.0, total_ratings / 50.0)  # Max confidence at 50+ ratings
        cuisine_factor = min(1.0, len(cuisine_preferences) / 5.0)  # Better with more cuisines

        # Average confidence across cuisines
        avg_cuisine_confidence = statistics.mean([
            data['confidence'] for data in cuisine_preferences.values()
        ])

        # Preference differentiation (higher = more distinct preferences)
        scores = [data['raw_score'] for data in cuisine_preferences.values()]
        if len(scores) > 1:
            score_variance = statistics.variance(scores)
            differentiation_factor = min(1.0, score_variance)
        else:
            differentiation_factor = 0.5

        overall_confidence = (
            volume_factor * 0.3 +
            cuisine_factor * 0.2 +
            avg_cuisine_confidence * 0.3 +
            differentiation_factor * 0.2
        )

        return round(overall_confidence, 3)

    def _create_empty_cuisine_analysis(self) -> Dict[str, Any]:
        """Create empty analysis result for error cases or insufficient data"""
        return {
            'user_id': '',
            'total_ratings_analyzed': 0,
            'cuisines_analyzed': 0,
            'confidence_score': 0.0,
            'cuisine_preferences': {},
            'top_cuisine': None,
            'analysis_timestamp': datetime.now().isoformat(),
            'error': 'Insufficient data for analysis'
        }

    async def update_cuisine_preferences_in_db(self, user_id: str, analysis: Dict[str, Any]) -> bool:
        """Update cuisine preferences in database based on analysis"""
        try:
            if not analysis.get('cuisine_preferences'):
                logger.info(f"No cuisine preferences to update for user {user_id}")
                return False

            # Update each cuisine preference in the database
            for cuisine, data in analysis['cuisine_preferences'].items():
                preference_data = {
                    'preference_score': data['raw_score'],
                    'total_ratings': data['total_ratings'],
                    'positive_ratings': max(1, int(data['total_ratings'] * data['would_make_again_ratio'])),
                    'average_user_rating': data['average_rating'],
                    'would_make_again_ratio': data['would_make_again_ratio'],
                    'modification_ratio': data['modification_ratio'],
                    'first_rated_at': datetime.now() - timedelta(days=30)  # Approximate
                }

                success = await self.db_service.update_cuisine_preference(
                    user_id, cuisine, preference_data
                )

                if not success:
                    logger.warning(f"Failed to update preference for cuisine {cuisine}")

            logger.info(f"Updated {len(analysis['cuisine_preferences'])} cuisine preferences for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error updating cuisine preferences in database: {e}")
            return False

    async def detect_cuisine_patterns(self, user_id: str) -> Dict[str, Any]:
        """Detect advanced patterns in cuisine preferences"""
        try:
            analysis = await self.analyze_cuisine_preferences(user_id)

            if analysis.get('error'):
                return analysis

            preferences = analysis['cuisine_preferences']

            # Detect patterns
            patterns = {
                'regional_preferences': self._detect_regional_patterns(preferences),
                'complexity_preference': self._detect_complexity_patterns(preferences),
                'flavor_profile': self._detect_flavor_patterns(preferences),
                'dietary_patterns': self._detect_dietary_patterns(preferences)
            }

            # Add pattern analysis to result
            analysis['detected_patterns'] = patterns

            return analysis

        except Exception as e:
            logger.error(f"Error detecting cuisine patterns for user {user_id}: {e}")
            return self._create_empty_cuisine_analysis()

    def _detect_regional_patterns(self, preferences: Dict[str, Any]) -> Dict[str, Any]:
        """Detect regional cuisine groupings"""
        # Define regional groupings
        regions = {
            'mediterranean': ['mediterranean', 'greek', 'italian', 'spanish'],
            'asian': ['chinese', 'japanese', 'thai', 'korean', 'vietnamese'],
            'latin': ['mexican', 'brazilian', 'peruvian'],
            'middle_eastern': ['middle_eastern', 'lebanese', 'turkish', 'moroccan'],
            'european': ['french', 'german', 'british'],
            'african': ['ethiopian', 'moroccan']
        }

        region_scores = {}
        for region, cuisines in regions.items():
            scores = []
            for cuisine in cuisines:
                if cuisine in preferences:
                    scores.append(preferences[cuisine]['normalized_score'])

            if scores:
                region_scores[region] = {
                    'average_score': round(statistics.mean(scores), 3),
                    'cuisines_tried': len(scores),
                    'top_score': max(scores)
                }

        return region_scores

    def _detect_complexity_patterns(self, preferences: Dict[str, Any]) -> str:
        """Detect preference for cooking complexity"""
        # Simplified complexity mapping (would be more sophisticated in production)
        complex_cuisines = ['french', 'japanese', 'indian']
        simple_cuisines = ['american', 'british', 'mediterranean']

        complex_scores = []
        simple_scores = []

        for cuisine, data in preferences.items():
            score = data['normalized_score']
            if cuisine in complex_cuisines:
                complex_scores.append(score)
            elif cuisine in simple_cuisines:
                simple_scores.append(score)

        if complex_scores and simple_scores:
            complex_avg = statistics.mean(complex_scores)
            simple_avg = statistics.mean(simple_scores)

            if complex_avg > simple_avg + 0.2:
                return 'complex'
            elif simple_avg > complex_avg + 0.2:
                return 'simple'
            else:
                return 'balanced'

        return 'unknown'

    def _detect_flavor_patterns(self, preferences: Dict[str, Any]) -> str:
        """Detect dominant flavor profile preferences"""
        # Simplified flavor mapping
        spicy_cuisines = ['mexican', 'thai', 'indian', 'korean']
        mild_cuisines = ['american', 'british', 'french']

        spicy_scores = []
        mild_scores = []

        for cuisine, data in preferences.items():
            score = data['normalized_score']
            if cuisine in spicy_cuisines:
                spicy_scores.append(score)
            elif cuisine in mild_cuisines:
                mild_scores.append(score)

        if spicy_scores and mild_scores:
            spicy_avg = statistics.mean(spicy_scores)
            mild_avg = statistics.mean(mild_scores)

            if spicy_avg > mild_avg + 0.2:
                return 'spicy'
            elif mild_avg > spicy_avg + 0.2:
                return 'mild'
            else:
                return 'balanced'

        return 'unknown'

    def _detect_dietary_patterns(self, preferences: Dict[str, Any]) -> List[str]:
        """Detect potential dietary preferences"""
        patterns = []

        # Look for vegetarian-friendly cuisines
        veg_friendly = ['indian', 'mediterranean', 'middle_eastern']
        veg_scores = [preferences[c]['normalized_score'] for c in veg_friendly if c in preferences]

        if veg_scores and statistics.mean(veg_scores) > 0.3:
            patterns.append('vegetarian_friendly')

        # Look for health-conscious patterns
        healthy_cuisines = ['mediterranean', 'japanese', 'vietnamese']
        healthy_scores = [preferences[c]['normalized_score'] for c in healthy_cuisines if c in preferences]

        if healthy_scores and statistics.mean(healthy_scores) > 0.3:
            patterns.append('health_conscious')

        return patterns

    # ===== INGREDIENT PREFERENCE ANALYSIS =====

    async def analyze_ingredient_preferences(self, user_id: str, min_occurrences: int = 2) -> Dict[str, Any]:
        """Analyze user's ingredient preferences based on rating patterns"""
        try:
            # Get user's rating history with ingredients
            ratings = await self.db_service.get_user_ratings_for_learning(user_id, limit=100)

            if len(ratings) < 3:
                logger.info(f"Insufficient ratings ({len(ratings)}) for ingredient analysis")
                return self._create_empty_ingredient_analysis()

            # Collect ingredient data across all rated recipes
            ingredient_data = defaultdict(list)

            for rating in ratings:
                for ingredient in rating.get('ingredients', []):
                    ingredient_name = ingredient['name'].lower().strip()
                    if ingredient_name:
                        ingredient_data[ingredient_name].append({
                            'rating': rating['rating'],
                            'would_make_again': rating.get('would_make_again'),
                            'made_modifications': rating.get('made_modifications', False),
                            'recipe_id': rating['recipe_id']
                        })

            # Analyze each ingredient with sufficient data
            ingredient_preferences = {}
            total_weight = 0

            for ingredient_name, ingredient_ratings in ingredient_data.items():
                if len(ingredient_ratings) >= min_occurrences:
                    analysis = self._analyze_single_ingredient(ingredient_name, ingredient_ratings)
                    ingredient_preferences[ingredient_name] = analysis
                    total_weight += analysis['weight']

            # Calculate normalized preference scores
            for ingredient in ingredient_preferences:
                if total_weight > 0:
                    ingredient_preferences[ingredient]['normalized_score'] = (
                        ingredient_preferences[ingredient]['raw_score'] *
                        ingredient_preferences[ingredient]['weight'] / total_weight
                    )
                else:
                    ingredient_preferences[ingredient]['normalized_score'] = 0.0

            # Categorize ingredients
            categorized = self._categorize_ingredients(ingredient_preferences)

            # Sort by preference score
            sorted_ingredients = sorted(
                ingredient_preferences.items(),
                key=lambda x: x[1]['raw_score'],
                reverse=True
            )

            # Calculate confidence
            confidence = self._calculate_ingredient_confidence(ingredient_preferences, len(ratings))

            return {
                'user_id': user_id,
                'total_ratings_analyzed': len(ratings),
                'ingredients_analyzed': len(ingredient_preferences),
                'confidence_score': confidence,
                'ingredient_preferences': dict(sorted_ingredients),
                'categorized_ingredients': categorized,
                'top_loved_ingredient': categorized['loved'][0] if categorized['loved'] else None,
                'top_disliked_ingredient': categorized['avoided'][0] if categorized['avoided'] else None,
                'analysis_timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Error analyzing ingredient preferences for user {user_id}: {e}")
            return self._create_empty_ingredient_analysis()

    def _analyze_single_ingredient(self, ingredient: str, ratings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze preference data for a single ingredient"""
        if not ratings:
            return {'raw_score': 0.0, 'weight': 0, 'confidence': 0.0}

        # Extract rating values
        rating_values = [r['rating'] for r in ratings if r.get('rating') is not None]
        would_make_again = [r['would_make_again'] for r in ratings if r.get('would_make_again') is not None]
        made_modifications = [r['made_modifications'] for r in ratings if r.get('made_modifications') is not None]

        # Calculate base metrics
        avg_rating = statistics.mean(rating_values) if rating_values else 0.0
        would_make_again_ratio = sum(would_make_again) / len(would_make_again) if would_make_again else 0.0
        modification_ratio = sum(made_modifications) / len(made_modifications) if made_modifications else 0.0

        # Calculate raw preference score (normalized to -1 to 1 scale)
        rating_score = (avg_rating - 3.0) / 2.0  # Convert 1-5 scale to -1 to 1
        would_make_score = (would_make_again_ratio - 0.5) * 2  # Convert 0-1 to -1 to 1

        # For ingredients, modifications might indicate the ingredient needed adjustment
        modification_penalty = modification_ratio * -0.1  # Small penalty

        raw_score = (rating_score * 0.7) + (would_make_score * 0.2) + (modification_penalty * 0.1)
        raw_score = max(-1.0, min(1.0, raw_score))  # Clamp to [-1, 1]

        # Calculate weight based on frequency
        weight = len(rating_values)

        # Calculate confidence based on consistency
        if len(rating_values) > 1:
            rating_variance = statistics.variance(rating_values)
            consistency_score = max(0, 1 - (rating_variance / 4.0))
        else:
            consistency_score = 0.5

        confidence = min(1.0, (len(rating_values) / 5.0) * consistency_score)

        return {
            'raw_score': round(raw_score, 3),
            'weight': weight,
            'confidence': round(confidence, 3),
            'average_rating': round(avg_rating, 2),
            'would_make_again_ratio': round(would_make_again_ratio, 3),
            'modification_ratio': round(modification_ratio, 3),
            'total_occurrences': len(rating_values),
            'recipe_count': len(set([r['recipe_id'] for r in ratings]))
        }

    def _categorize_ingredients(self, preferences: Dict[str, Any]) -> Dict[str, List[str]]:
        """Categorize ingredients by preference level"""
        categories = {
            'loved': [],      # >= 0.6
            'liked': [],      # 0.2 to 0.6
            'neutral': [],    # -0.2 to 0.2
            'disliked': [],   # -0.6 to -0.2
            'avoided': []     # <= -0.6
        }

        for ingredient, data in preferences.items():
            score = data['raw_score']
            if score >= 0.6:
                categories['loved'].append(ingredient)
            elif score >= 0.2:
                categories['liked'].append(ingredient)
            elif score >= -0.2:
                categories['neutral'].append(ingredient)
            elif score >= -0.6:
                categories['disliked'].append(ingredient)
            else:
                categories['avoided'].append(ingredient)

        return categories

    def _calculate_ingredient_confidence(self, ingredient_preferences: Dict[str, Any], total_ratings: int) -> float:
        """Calculate overall confidence in ingredient preference analysis"""
        if not ingredient_preferences or total_ratings < 3:
            return 0.0

        # Factors affecting confidence:
        # 1. Total number of ratings
        # 2. Number of ingredients analyzed
        # 3. Average confidence per ingredient
        # 4. Ingredient diversity

        volume_factor = min(1.0, total_ratings / 30.0)  # Max confidence at 30+ ratings
        ingredient_factor = min(1.0, len(ingredient_preferences) / 10.0)  # Better with more ingredients

        # Average confidence across ingredients
        avg_ingredient_confidence = statistics.mean([
            data['confidence'] for data in ingredient_preferences.values()
        ])

        # Ingredient preference diversity
        scores = [data['raw_score'] for data in ingredient_preferences.values()]
        if len(scores) > 1:
            diversity_factor = min(1.0, statistics.pstdev(scores))
        else:
            diversity_factor = 0.5

        overall_confidence = (
            volume_factor * 0.3 +
            ingredient_factor * 0.25 +
            avg_ingredient_confidence * 0.3 +
            diversity_factor * 0.15
        )

        return round(overall_confidence, 3)

    def _create_empty_ingredient_analysis(self) -> Dict[str, Any]:
        """Create empty analysis result for ingredient analysis"""
        return {
            'user_id': '',
            'total_ratings_analyzed': 0,
            'ingredients_analyzed': 0,
            'confidence_score': 0.0,
            'ingredient_preferences': {},
            'categorized_ingredients': {'loved': [], 'liked': [], 'neutral': [], 'disliked': [], 'avoided': []},
            'top_loved_ingredient': None,
            'top_disliked_ingredient': None,
            'analysis_timestamp': datetime.now().isoformat(),
            'error': 'Insufficient data for ingredient analysis'
        }

    async def update_ingredient_preferences_in_db(self, user_id: str, analysis: Dict[str, Any]) -> bool:
        """Update ingredient preferences in database based on analysis"""
        try:
            if not analysis.get('ingredient_preferences'):
                logger.info(f"No ingredient preferences to update for user {user_id}")
                return False

            # Update each ingredient preference in the database
            for ingredient, data in analysis['ingredient_preferences'].items():
                preference_data = {
                    'preference_score': data['raw_score'],
                    'confidence_level': data['confidence'],
                    'recipes_containing_ingredient': data['recipe_count'],
                    'positive_recipes': max(1, int(data['recipe_count'] * data['would_make_again_ratio'])),
                    'negative_recipes': max(0, data['recipe_count'] - int(data['recipe_count'] * data['would_make_again_ratio'])),
                    'average_rating_with_ingredient': data['average_rating'],
                    'would_make_again_with_ingredient': data['would_make_again_ratio'],
                    'first_encountered_at': datetime.now() - timedelta(days=30)  # Approximate
                }

                success = await self.db_service.update_ingredient_preference(
                    user_id, ingredient, preference_data
                )

                if not success:
                    logger.warning(f"Failed to update preference for ingredient {ingredient}")

            logger.info(f"Updated {len(analysis['ingredient_preferences'])} ingredient preferences for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error updating ingredient preferences in database: {e}")
            return False

    async def detect_ingredient_patterns(self, user_id: str) -> Dict[str, Any]:
        """Detect advanced patterns in ingredient preferences"""
        try:
            analysis = await self.analyze_ingredient_preferences(user_id)

            if analysis.get('error'):
                return analysis

            preferences = analysis['ingredient_preferences']
            categorized = analysis['categorized_ingredients']

            # Detect patterns
            patterns = {
                'protein_preferences': self._detect_protein_patterns(preferences),
                'vegetable_preferences': self._detect_vegetable_patterns(preferences),
                'spice_tolerance': self._detect_spice_patterns(preferences),
                'cooking_fat_preferences': self._detect_fat_patterns(preferences),
                'dietary_indicators': self._detect_dietary_ingredient_patterns(categorized)
            }

            # Add pattern analysis to result
            analysis['detected_patterns'] = patterns

            return analysis

        except Exception as e:
            logger.error(f"Error detecting ingredient patterns for user {user_id}: {e}")
            return self._create_empty_ingredient_analysis()

    def _detect_protein_patterns(self, preferences: Dict[str, Any]) -> Dict[str, Any]:
        """Detect protein preferences"""
        proteins = {
            'animal': ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'shrimp', 'turkey'],
            'plant': ['tofu', 'beans', 'lentils', 'chickpeas', 'quinoa', 'nuts']
        }

        protein_scores = {'animal': [], 'plant': []}

        for ingredient, data in preferences.items():
            score = data['raw_score']
            for category, protein_list in proteins.items():
                if any(protein in ingredient.lower() for protein in protein_list):
                    protein_scores[category].append(score)
                    break

        result = {}
        for category, scores in protein_scores.items():
            if scores:
                result[category] = {
                    'average_score': round(statistics.mean(scores), 3),
                    'count': len(scores),
                    'preference': 'high' if statistics.mean(scores) > 0.3 else 'low' if statistics.mean(scores) < -0.3 else 'moderate'
                }

        return result

    def _detect_vegetable_patterns(self, preferences: Dict[str, Any]) -> Dict[str, Any]:
        """Detect vegetable preferences"""
        vegetables = {
            'leafy_greens': ['spinach', 'lettuce', 'kale', 'arugula'],
            'root_vegetables': ['carrot', 'potato', 'onion', 'garlic'],
            'nightshades': ['tomato', 'pepper', 'eggplant'],
            'cruciferous': ['broccoli', 'cauliflower', 'cabbage']
        }

        veg_scores = {category: [] for category in vegetables}

        for ingredient, data in preferences.items():
            score = data['raw_score']
            for category, veg_list in vegetables.items():
                if any(veg in ingredient.lower() for veg in veg_list):
                    veg_scores[category].append(score)

        result = {}
        for category, scores in veg_scores.items():
            if scores:
                result[category] = {
                    'average_score': round(statistics.mean(scores), 3),
                    'count': len(scores)
                }

        return result

    def _detect_spice_patterns(self, preferences: Dict[str, Any]) -> str:
        """Detect spice tolerance level"""
        spicy_ingredients = ['chili', 'pepper', 'hot', 'spicy', 'jalapeño', 'cayenne', 'paprika']

        spice_scores = []
        for ingredient, data in preferences.items():
            if any(spice in ingredient.lower() for spice in spicy_ingredients):
                spice_scores.append(data['raw_score'])

        if spice_scores:
            avg_score = statistics.mean(spice_scores)
            if avg_score > 0.3:
                return 'high_tolerance'
            elif avg_score > -0.3:
                return 'moderate_tolerance'
            else:
                return 'low_tolerance'

        return 'unknown'

    def _detect_fat_patterns(self, preferences: Dict[str, Any]) -> Dict[str, Any]:
        """Detect cooking fat preferences"""
        fats = {
            'healthy_oils': ['olive oil', 'avocado oil', 'coconut oil'],
            'butter_dairy': ['butter', 'cream', 'cheese'],
            'other_oils': ['vegetable oil', 'canola oil']
        }

        fat_scores = {category: [] for category in fats}

        for ingredient, data in preferences.items():
            score = data['raw_score']
            for category, fat_list in fats.items():
                if any(fat in ingredient.lower() for fat in fat_list):
                    fat_scores[category].append(score)

        result = {}
        for category, scores in fat_scores.items():
            if scores:
                result[category] = {
                    'average_score': round(statistics.mean(scores), 3),
                    'count': len(scores),
                    'preference_level': 'high' if statistics.mean(scores) > 0.3 else 'low' if statistics.mean(scores) < -0.3 else 'moderate'
                }

        return result

    def _detect_dietary_ingredient_patterns(self, categorized: Dict[str, List[str]]) -> List[str]:
        """Detect dietary patterns based on ingredient preferences"""
        patterns = []

        # Check for vegetarian indicators
        plant_proteins = ['tofu', 'beans', 'lentils', 'chickpeas', 'quinoa']
        loved_plant_proteins = sum(1 for ingredient in categorized['loved']
                                 if any(protein in ingredient for protein in plant_proteins))

        if loved_plant_proteins >= 2:
            patterns.append('vegetarian_leaning')

        # Check for health-conscious indicators
        healthy_ingredients = ['olive oil', 'avocado', 'quinoa', 'spinach', 'kale']
        loved_healthy = sum(1 for ingredient in categorized['loved']
                           if any(healthy in ingredient for healthy in healthy_ingredients))

        if loved_healthy >= 2:
            patterns.append('health_conscious')

        # Check for comfort food indicators
        comfort_ingredients = ['cheese', 'butter', 'cream', 'bacon']
        loved_comfort = sum(1 for ingredient in categorized['loved']
                           if any(comfort in ingredient for comfort in comfort_ingredients))

        if loved_comfort >= 2:
            patterns.append('comfort_food_lover')

        return patterns


# Global taste learning service instance
taste_learning_service = TasteLearningService()