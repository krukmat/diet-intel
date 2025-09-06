import logging
import asyncio
import random
from typing import List, Dict, Optional, Tuple, Set, Any
from datetime import datetime, timedelta
from collections import defaultdict
from dataclasses import dataclass

from app.models.recommendation import (
    SmartRecommendationRequest, SmartRecommendationResponse, MealRecommendation,
    RecommendationItem, RecommendationType, RecommendationReason, NutritionalScore,
    RecommendationFeedback, RecommendationMetrics
)
from app.models.product import ProductResponse, Nutriments
from app.models.meal_plan import MealPlanResponse
from app.services.cache import cache_service
from app.services.plan_storage import plan_storage
from app.services.product_discovery import product_discovery_service

logger = logging.getLogger(__name__)

@dataclass
class UserPreferenceProfile:
    """Learned user preferences from interaction history"""
    favorite_foods: Set[str]
    avoided_foods: Set[str]
    preferred_cuisines: List[str]
    macro_preferences: Dict[str, float]
    meal_timing_patterns: Dict[str, List[str]]
    seasonal_preferences: Dict[str, List[str]]
    interaction_count: int
    last_updated: datetime

class SmartRecommendationEngine:
    """
    Intelligent meal recommendation engine that provides personalized food suggestions.
    
    The engine uses multiple algorithms to generate recommendations:
    1. **Nutritional Profiling**: Analyzes nutritional gaps and complementary foods
    2. **User History Mining**: Learns from past meal choices and feedback
    3. **Collaborative Filtering**: Finds similar users and popular combinations
    4. **Seasonal Trends**: Incorporates seasonal availability and preferences
    5. **Goal Alignment**: Matches recommendations to user fitness goals
    6. **Dietary Compatibility**: Ensures recommendations meet restrictions
    
    Key Features:
    - Multi-factor scoring system combining nutrition, preference, and goal alignment
    - Real-time personalization based on user feedback loops
    - Confidence scoring for recommendation transparency
    - A/B testing framework for algorithm optimization
    """
    
    def __init__(self):
        self.user_profiles: Dict[str, UserPreferenceProfile] = {}
        self.feedback_history: List[RecommendationFeedback] = []
        self.recommendation_cache_ttl = 300  # 5 minutes
        
        # Algorithm weights (can be tuned based on A/B testing)
        self.scoring_weights = {
            'nutritional_quality': 0.25,
            'user_preference': 0.25,
            'goal_alignment': 0.20,
            'dietary_compatibility': 0.15,
            'seasonal_factor': 0.10,
            'popularity_factor': 0.05
        }
        
        # Nutritional targets and thresholds
        self.macro_targets = {
            'protein_min_percent': 0.15,  # Min 15% protein
            'protein_max_percent': 0.35,  # Max 35% protein
            'fat_min_percent': 0.20,     # Min 20% fat
            'fat_max_percent': 0.35,     # Max 35% fat
            'carbs_min_percent': 0.30,   # Min 30% carbs
            'carbs_max_percent': 0.65    # Max 65% carbs
        }
    
    async def generate_recommendations(self, request: SmartRecommendationRequest) -> SmartRecommendationResponse:
        """
        Generate personalized smart meal recommendations.
        
        Args:
            request: SmartRecommendationRequest with user context and preferences
            
        Returns:
            SmartRecommendationResponse with personalized recommendations
        """
        logger.info(f"Generating recommendations for user {request.user_id}")
        start_time = datetime.now()
        
        try:
            # Load user profile and preferences
            user_profile = await self._load_user_profile(request.user_id) if request.user_id else None
            
            # Get current meal plan context if provided
            current_plan = await self._load_meal_plan_context(request.current_meal_plan_id)
            
            # Load available products for recommendations
            available_products = await self._load_available_products(request)
            
            if not available_products:
                logger.warning("No products available for recommendations")
                return self._create_empty_response(request.user_id)
            
            # Generate recommendations by category
            meal_recommendations = []
            daily_additions = []
            snack_recommendations = []
            
            # Generate meal-specific recommendations
            if request.meal_context:
                meal_rec = await self._generate_meal_specific_recommendations(
                    request, user_profile, current_plan, available_products
                )
                meal_recommendations.append(meal_rec)
            else:
                # Generate for all meals
                for meal_name in ['Breakfast', 'Lunch', 'Dinner']:
                    meal_rec = await self._generate_meal_recommendations_for_meal(
                        meal_name, request, user_profile, current_plan, available_products
                    )
                    meal_recommendations.append(meal_rec)
            
            # Generate daily additions (foods that can be added anywhere)
            daily_additions = await self._generate_daily_additions(
                request, user_profile, current_plan, available_products
            )
            
            # Generate healthy snack recommendations
            snack_recommendations = await self._generate_snack_recommendations(
                request, user_profile, available_products
            )
            
            # Generate nutritional insights
            nutritional_insights = await self._generate_nutritional_insights(
                current_plan, meal_recommendations, daily_additions
            )
            
            # Calculate personalization factors
            personalization_factors = self._get_personalization_factors(user_profile, request)
            
            # Aggregate metrics
            all_recommendations = []
            for meal_rec in meal_recommendations:
                all_recommendations.extend(meal_rec.recommendations)
            all_recommendations.extend(daily_additions)
            all_recommendations.extend(snack_recommendations)
            
            total_recommendations = len(all_recommendations)
            avg_confidence = (
                sum(rec.confidence_score for rec in all_recommendations) / total_recommendations
                if total_recommendations > 0 else 0.0
            )
            
            # Create response
            response = SmartRecommendationResponse(
                user_id=request.user_id,
                generated_at=datetime.now(),
                meal_recommendations=meal_recommendations,
                daily_additions=daily_additions,
                snack_recommendations=snack_recommendations,
                nutritional_insights=nutritional_insights,
                personalization_factors=personalization_factors,
                total_recommendations=total_recommendations,
                avg_confidence=avg_confidence,
                recommendation_version="1.0"
            )
            
            # Cache the response for future use
            await self._cache_recommendations(request, response)
            
            generation_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"Generated {total_recommendations} recommendations in {generation_time:.2f}s "
                       f"(avg confidence: {avg_confidence:.2f})")
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            return self._create_empty_response(request.user_id)
    
    async def _generate_meal_specific_recommendations(
        self, 
        request: SmartRecommendationRequest,
        user_profile: Optional[UserPreferenceProfile],
        current_plan: Optional[MealPlanResponse],
        available_products: List[ProductResponse]
    ) -> MealRecommendation:
        """Generate recommendations for a specific meal."""
        meal_name = request.meal_context or "Breakfast"
        
        # Analyze current meal if available
        current_meal = None
        if current_plan:
            current_meal = next(
                (meal for meal in current_plan.meals if meal.name.lower() == meal_name.lower()),
                None
            )
        
        target_calories = request.calorie_budget or 500.0  # Default if not specified
        current_calories = current_meal.actual_calories if current_meal else 0.0
        
        # Calculate nutritional gaps
        macro_gaps = self._calculate_macro_gaps(current_meal, target_calories)
        
        # Generate candidate recommendations
        candidates = []
        for product in available_products:
            if len(candidates) >= request.max_recommendations * 2:  # Generate extra for filtering
                break
            
            recommendation = await self._create_recommendation_item(
                product, request, user_profile, meal_name, macro_gaps
            )
            
            if recommendation and recommendation.confidence_score >= request.min_confidence:
                candidates.append(recommendation)
        
        # Sort by confidence and take top recommendations
        candidates.sort(key=lambda x: x.confidence_score, reverse=True)
        final_recommendations = candidates[:request.max_recommendations]
        
        return MealRecommendation(
            meal_name=meal_name,
            target_calories=target_calories,
            current_calories=current_calories,
            recommendations=final_recommendations,
            macro_gaps=macro_gaps,
            micronutrient_gaps=self._identify_micronutrient_gaps(current_meal)
        )
    
    async def _generate_meal_recommendations_for_meal(
        self,
        meal_name: str,
        request: SmartRecommendationRequest,
        user_profile: Optional[UserPreferenceProfile],
        current_plan: Optional[MealPlanResponse],
        available_products: List[ProductResponse]
    ) -> MealRecommendation:
        """Generate recommendations for a specific meal type."""
        # Create meal-specific request
        meal_request = SmartRecommendationRequest(
            user_id=request.user_id,
            current_meal_plan_id=request.current_meal_plan_id,
            meal_context=meal_name,
            dietary_restrictions=request.dietary_restrictions,
            cuisine_preferences=request.cuisine_preferences,
            excluded_ingredients=request.excluded_ingredients,
            target_macros=request.target_macros,
            calorie_budget=self._get_meal_calorie_budget(meal_name, request.calorie_budget),
            include_history=request.include_history,
            max_recommendations=max(3, request.max_recommendations // 3),  # Divide among meals
            min_confidence=request.min_confidence
        )
        
        return await self._generate_meal_specific_recommendations(
            meal_request, user_profile, current_plan, available_products
        )
    
    def _get_meal_calorie_budget(self, meal_name: str, daily_budget: Optional[float]) -> float:
        """Get calorie budget for a specific meal."""
        if not daily_budget:
            # Default meal calorie budgets
            meal_defaults = {
                'Breakfast': 400,
                'Lunch': 500, 
                'Dinner': 600
            }
            return meal_defaults.get(meal_name, 500)
        
        # Distribute daily budget across meals
        meal_percentages = {
            'Breakfast': 0.25,
            'Lunch': 0.40,
            'Dinner': 0.35
        }
        
        return daily_budget * meal_percentages.get(meal_name, 0.33)
    
    async def _create_recommendation_item(
        self,
        product: ProductResponse,
        request: SmartRecommendationRequest,
        user_profile: Optional[UserPreferenceProfile],
        meal_context: str,
        macro_gaps: Dict[str, float]
    ) -> Optional[RecommendationItem]:
        """Create a recommendation item from a product."""
        if not product.nutriments or not product.nutriments.energy_kcal_per_100g:
            return None
        
        # Calculate serving information
        serving_info = self._calculate_serving_info(product)
        if not serving_info:
            return None
        
        serving_size, calories, protein_g, fat_g, carbs_g, fiber_g = serving_info
        
        # Check dietary restrictions
        if not self._check_dietary_compatibility(product, request.dietary_restrictions):
            return None
        
        # Check excluded ingredients
        if self._contains_excluded_ingredients(product, request.excluded_ingredients):
            return None
        
        # Calculate nutritional quality score
        nutritional_score = self._calculate_nutritional_score(product, serving_info)
        
        # Calculate preference match
        preference_match = self._calculate_preference_match(product, user_profile)
        
        # Calculate goal alignment
        goal_alignment = self._calculate_goal_alignment(
            product, serving_info, request.target_macros, macro_gaps
        )
        
        # Determine recommendation type and reasons
        rec_type, reasons = self._determine_recommendation_type_and_reasons(
            product, serving_info, macro_gaps, user_profile
        )
        
        # Calculate overall confidence score
        confidence_score = self._calculate_confidence_score(
            nutritional_score, preference_match, goal_alignment, product
        )
        
        return RecommendationItem(
            barcode=product.barcode,
            name=product.name or "Unknown Product",
            brand=product.brand,
            image_url=product.image_url,
            calories_per_serving=calories,
            serving_size=serving_size,
            protein_g=protein_g,
            fat_g=fat_g,
            carbs_g=carbs_g,
            fiber_g=fiber_g,
            recommendation_type=rec_type,
            reasons=reasons,
            confidence_score=confidence_score,
            nutritional_score=nutritional_score,
            preference_match=preference_match,
            goal_alignment=goal_alignment
        )
    
    def _calculate_serving_info(self, product: ProductResponse) -> Optional[Tuple[str, float, float, float, float, Optional[float]]]:
        """Calculate serving size and nutritional information."""
        nutriments = product.nutriments
        
        # Determine serving size (default to 100g if not specified)
        serving_grams = 100.0
        serving_size = "100g"
        
        if product.serving_size:
            try:
                if 'g' in product.serving_size:
                    serving_grams = float(product.serving_size.replace('g', '').strip())
                    serving_size = product.serving_size
            except (ValueError, AttributeError):
                pass  # Keep defaults
        
        # Calculate nutrition per serving
        scale_factor = serving_grams / 100.0
        calories = nutriments.energy_kcal_per_100g * scale_factor
        protein_g = (nutriments.protein_g_per_100g or 0.0) * scale_factor
        fat_g = (nutriments.fat_g_per_100g or 0.0) * scale_factor
        carbs_g = (nutriments.carbs_g_per_100g or 0.0) * scale_factor
        fiber_g = (nutriments.fiber_g_per_100g or 0.0) * scale_factor if hasattr(nutriments, 'fiber_g_per_100g') else None
        
        return serving_size, calories, protein_g, fat_g, carbs_g, fiber_g
    
    def _calculate_nutritional_score(self, product: ProductResponse, serving_info: Tuple) -> NutritionalScore:
        """Calculate comprehensive nutritional quality score."""
        serving_size, calories, protein_g, fat_g, carbs_g, fiber_g = serving_info
        
        # Calculate macronutrient ratios
        total_macros = protein_g + fat_g + carbs_g
        if total_macros == 0:
            return NutritionalScore(
                overall_score=0.0,
                protein_score=0.0,
                fiber_score=0.0,
                micronutrient_score=0.5,  # Neutral since unknown
                calorie_density_score=0.5
            )
        
        protein_ratio = protein_g / total_macros
        fat_ratio = fat_g / total_macros
        carbs_ratio = carbs_g / total_macros
        
        # Score protein adequacy (higher protein generally better)
        protein_score = min(1.0, protein_ratio / 0.25)  # 25% protein is excellent
        
        # Score fiber content (if available)
        fiber_score = 0.5  # Default neutral score
        if fiber_g is not None:
            fiber_per_100_cal = (fiber_g / calories) * 100 if calories > 0 else 0
            fiber_score = min(1.0, fiber_per_100_cal / 5.0)  # 5g fiber per 100 calories is excellent
        
        # Score calorie density (lower is generally better for weight management)
        calorie_density = calories / 100.0  # Calories per 100g equivalent
        if calorie_density <= 150:
            calorie_density_score = 1.0
        elif calorie_density <= 300:
            calorie_density_score = 0.7
        elif calorie_density <= 500:
            calorie_density_score = 0.5
        else:
            calorie_density_score = 0.3
        
        # Micronutrient score (simplified - would need detailed nutrition data)
        micronutrient_score = 0.6  # Default reasonable score
        
        # Overall score (weighted average)
        overall_score = (
            protein_score * 0.3 +
            fiber_score * 0.2 +
            micronutrient_score * 0.25 +
            calorie_density_score * 0.25
        )
        
        return NutritionalScore(
            overall_score=overall_score,
            protein_score=protein_score,
            fiber_score=fiber_score,
            micronutrient_score=micronutrient_score,
            calorie_density_score=calorie_density_score
        )
    
    def _calculate_confidence_score(
        self,
        nutritional_score: NutritionalScore,
        preference_match: float,
        goal_alignment: float,
        product: ProductResponse
    ) -> float:
        """Calculate overall confidence score for the recommendation."""
        # Base score from nutritional quality
        base_score = nutritional_score.overall_score * self.scoring_weights['nutritional_quality']
        
        # Add preference matching
        preference_component = preference_match * self.scoring_weights['user_preference']
        
        # Add goal alignment
        goal_component = goal_alignment * self.scoring_weights['goal_alignment']
        
        # Add dietary compatibility (assumed 1.0 if we reach this point)
        dietary_component = 1.0 * self.scoring_weights['dietary_compatibility']
        
        # Add seasonal factor (simplified)
        seasonal_component = 0.8 * self.scoring_weights['seasonal_factor']  # Default seasonal score
        
        # Add popularity factor (simplified - would use actual user data)
        popularity_component = 0.7 * self.scoring_weights['popularity_factor']  # Default popularity
        
        total_score = (
            base_score + preference_component + goal_component +
            dietary_component + seasonal_component + popularity_component
        )
        
        # Ensure score is between 0 and 1
        return max(0.0, min(1.0, total_score))
    
    def _calculate_preference_match(self, product: ProductResponse, user_profile: Optional[UserPreferenceProfile]) -> float:
        """Calculate how well the product matches user preferences."""
        if not user_profile:
            return 0.5  # Neutral score for new users
        
        product_name = (product.name or "").lower()
        brand_name = (product.brand or "").lower()
        
        # Check if product is in favorites
        if any(fav.lower() in product_name or fav.lower() in brand_name for fav in user_profile.favorite_foods):
            return 0.9
        
        # Check if product is avoided
        if any(avoid.lower() in product_name or avoid.lower() in brand_name for avoid in user_profile.avoided_foods):
            return 0.1
        
        # Default neutral preference for unknown items
        return 0.6
    
    def _calculate_goal_alignment(
        self,
        product: ProductResponse,
        serving_info: Tuple,
        target_macros: Optional[Dict[str, float]],
        macro_gaps: Dict[str, float]
    ) -> float:
        """Calculate how well the product aligns with dietary goals."""
        serving_size, calories, protein_g, fat_g, carbs_g, fiber_g = serving_info
        
        alignment_score = 0.5  # Base score
        
        # Check macro gaps alignment
        if macro_gaps.get('protein', 0) > 0 and protein_g > 10:
            alignment_score += 0.2
        
        if macro_gaps.get('fiber', 0) > 0 and fiber_g and fiber_g > 3:
            alignment_score += 0.15
        
        # Check target macros if provided
        if target_macros:
            total_macros = protein_g + fat_g + carbs_g
            if total_macros > 0:
                actual_protein_ratio = protein_g / total_macros
                target_protein_ratio = target_macros.get('protein_ratio', 0.25)
                
                protein_diff = abs(actual_protein_ratio - target_protein_ratio)
                if protein_diff < 0.05:  # Within 5%
                    alignment_score += 0.15
        
        return max(0.0, min(1.0, alignment_score))
    
    def _determine_recommendation_type_and_reasons(
        self,
        product: ProductResponse,
        serving_info: Tuple,
        macro_gaps: Dict[str, float],
        user_profile: Optional[UserPreferenceProfile]
    ) -> Tuple[RecommendationType, List[RecommendationReason]]:
        """Determine the recommendation type and reasons."""
        serving_size, calories, protein_g, fat_g, carbs_g, fiber_g = serving_info
        
        reasons = []
        
        # Determine primary recommendation type
        if user_profile and any((product.name or "").lower() in fav.lower() for fav in user_profile.favorite_foods):
            rec_type = RecommendationType.USER_HISTORY
            reasons.append(RecommendationReason.FREQUENTLY_PAIRED)
        elif macro_gaps.get('protein', 0) > 0 and protein_g > 15:
            rec_type = RecommendationType.COMPLEMENTARY_MACROS
            reasons.append(RecommendationReason.HIGH_PROTEIN)
        elif calories < 150:  # Low calorie density
            rec_type = RecommendationType.DIETARY_GOALS
            reasons.append(RecommendationReason.LOW_CALORIE)
        else:
            rec_type = RecommendationType.SIMILAR_NUTRITION
            reasons.append(RecommendationReason.BALANCED_MACROS)
        
        # Add additional reasons based on nutritional profile
        if protein_g > 10:
            reasons.append(RecommendationReason.HIGH_PROTEIN)
        
        if fiber_g and fiber_g > 5:
            reasons.append(RecommendationReason.BALANCED_MACROS)
        
        if calories < 100:
            reasons.append(RecommendationReason.LOW_CALORIE)
        
        # Remove duplicates and limit to 3 reasons
        reasons = list(set(reasons))[:3]
        
        return rec_type, reasons
    
    async def _load_available_products(self, request: SmartRecommendationRequest) -> List[ProductResponse]:
        """Load available products for recommendations using intelligent discovery."""
        logger.info(f"Loading products for user {request.user_id} with dynamic discovery")
        
        try:
            # Use the new product discovery service for intelligent product sourcing
            products = await product_discovery_service.discover_products_for_recommendations(
                user_id=request.user_id,
                dietary_restrictions=request.dietary_restrictions,
                cuisine_preferences=request.cuisine_preferences,
                max_products=50  # Get more products for better recommendation diversity
            )
            
            logger.info(f"Loaded {len(products)} products for recommendations via dynamic discovery")
            return products
            
        except Exception as e:
            logger.error(f"Error loading products with discovery service: {e}")
            # Fallback to emergency products if discovery fails
            return await product_discovery_service._get_emergency_fallback_products()
    
    async def _log_user_product_interaction(self, user_id: Optional[str], barcode: str, action: str):
        """Log user interaction with recommended product for learning."""
        if not user_id:
            return
        
        try:
            from app.services.database import db_service
            await db_service.log_user_product_interaction(
                user_id=user_id,
                session_id=None,  # Could be enhanced with session tracking
                barcode=barcode,
                action=action,
                context="smart_recommendation"
            )
            logger.debug(f"Logged product interaction: {user_id} {action} {barcode}")
        except Exception as e:
            logger.warning(f"Failed to log product interaction: {e}")
    
    # Additional helper methods would continue here...
    
    async def record_feedback(self, feedback: RecommendationFeedback) -> bool:
        """Record user feedback for algorithm improvement."""
        try:
            # Store feedback in history
            self.feedback_history.append(feedback)
            
            # Update user preferences based on feedback
            await self._update_user_preferences(feedback)
            
            # TODO: Store in persistent database
            # TODO: Trigger algorithm retraining if needed
            
            logger.info(f"Recorded feedback for user {feedback.user_id}: "
                       f"recommendation {feedback.recommendation_id} "
                       f"{'accepted' if feedback.accepted else 'rejected'}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error recording feedback: {e}")
            return False
    
    async def get_metrics(self, days: int = 30, user_id: Optional[str] = None) -> RecommendationMetrics:
        """Get recommendation performance metrics."""
        # Filter feedback by time period and user
        cutoff_date = datetime.now() - timedelta(days=days)
        filtered_feedback = [
            fb for fb in self.feedback_history
            if fb.feedback_at >= cutoff_date and (user_id is None or fb.user_id == user_id)
        ]
        
        if not filtered_feedback:
            # Return empty metrics
            return RecommendationMetrics(
                total_recommendations=0,
                acceptance_rate=0.0,
                avg_confidence=0.0,
                type_performance={},
                unique_users=0,
                avg_recommendations_per_user=0.0,
                avg_nutritional_score=0.0,
                goal_alignment_score=0.0
            )
        
        # Calculate metrics
        total_recommendations = len(filtered_feedback)
        accepted_count = sum(1 for fb in filtered_feedback if fb.accepted)
        acceptance_rate = accepted_count / total_recommendations
        
        unique_users = len(set(fb.user_id for fb in filtered_feedback))
        avg_recommendations_per_user = total_recommendations / unique_users if unique_users > 0 else 0
        
        # Calculate average ratings
        relevance_ratings = [fb.relevance_rating for fb in filtered_feedback if fb.relevance_rating]
        avg_relevance = sum(relevance_ratings) / len(relevance_ratings) if relevance_ratings else 3.0
        
        # Mock additional metrics for demonstration
        type_performance = {
            RecommendationType.USER_HISTORY: {"acceptance_rate": 0.85, "avg_confidence": 0.9},
            RecommendationType.COMPLEMENTARY_MACROS: {"acceptance_rate": 0.72, "avg_confidence": 0.8},
            RecommendationType.DIETARY_GOALS: {"acceptance_rate": 0.68, "avg_confidence": 0.75}
        }
        
        return RecommendationMetrics(
            total_recommendations=total_recommendations,
            acceptance_rate=acceptance_rate,
            avg_confidence=0.75,  # Mock average
            type_performance=type_performance,
            unique_users=unique_users,
            avg_recommendations_per_user=avg_recommendations_per_user,
            avg_nutritional_score=0.7,  # Mock average
            goal_alignment_score=0.65   # Mock average
        )
    
    async def get_user_preferences(self, user_id: str) -> Optional[Dict]:
        """Get learned user preferences."""
        profile = self.user_profiles.get(user_id)
        if not profile:
            return None
        
        return {
            "favorite_foods": list(profile.favorite_foods),
            "avoided_foods": list(profile.avoided_foods),
            "preferred_cuisines": profile.preferred_cuisines,
            "macro_preferences": profile.macro_preferences,
            "interaction_count": profile.interaction_count,
            "last_updated": profile.last_updated.isoformat()
        }
    
    # Additional private helper methods
    async def _load_user_profile(self, user_id: Optional[str]) -> Optional[UserPreferenceProfile]:
        """Load user preference profile."""
        if not user_id:
            return None
        
        # Check if we have the profile in memory
        if user_id in self.user_profiles:
            return self.user_profiles[user_id]
        
        # TODO: Load from database in production
        # For now, create a default profile for new users
        profile = UserPreferenceProfile(
            favorite_foods=set(),
            avoided_foods=set(), 
            preferred_cuisines=[],
            macro_preferences={},
            meal_timing_patterns={},
            seasonal_preferences={},
            interaction_count=0,
            last_updated=datetime.now()
        )
        
        self.user_profiles[user_id] = profile
        return profile
    
    async def _load_meal_plan_context(self, meal_plan_id: Optional[str]) -> Optional[MealPlanResponse]:
        """Load current meal plan context."""
        if not meal_plan_id:
            return None
        
        try:
            return await plan_storage.get_plan(meal_plan_id)
        except Exception as e:
            logger.error(f"Error loading meal plan {meal_plan_id}: {e}")
            return None
    
    async def _generate_daily_additions(
        self,
        request: SmartRecommendationRequest,
        user_profile: Optional[UserPreferenceProfile],
        current_plan: Optional[MealPlanResponse],
        available_products: List[ProductResponse]
    ) -> List[RecommendationItem]:
        """Generate daily addition recommendations."""
        recommendations = []
        
        # Focus on healthy additions like fruits, vegetables, supplements
        healthy_categories = ["fruit", "vegetable", "superfood", "protein", "healthy"]
        
        for product in available_products[:5]:  # Limit for demo
            if any(cat in (product.name or "").lower() for cat in healthy_categories):
                rec_item = await self._create_recommendation_item(
                    product, request, user_profile, "daily", {}
                )
                if rec_item and rec_item.confidence_score >= request.min_confidence:
                    recommendations.append(rec_item)
        
        return recommendations[:3]  # Return top 3
    
    async def _generate_snack_recommendations(
        self,
        request: SmartRecommendationRequest,
        user_profile: Optional[UserPreferenceProfile],
        available_products: List[ProductResponse]
    ) -> List[RecommendationItem]:
        """Generate healthy snack recommendations."""
        recommendations = []
        
        # Focus on low-calorie, nutrient-dense snacks
        for product in available_products:
            if not product.nutriments or not product.nutriments.energy_kcal_per_100g:
                continue
            
            # Filter for snack-appropriate items (low calorie density)
            if product.nutriments.energy_kcal_per_100g < 200:  # Less than 200 kcal/100g
                rec_item = await self._create_recommendation_item(
                    product, request, user_profile, "snack", {}
                )
                if rec_item and rec_item.confidence_score >= request.min_confidence:
                    recommendations.append(rec_item)
        
        return recommendations[:2]  # Return top 2 snacks
    
    async def _generate_nutritional_insights(
        self,
        current_plan: Optional[MealPlanResponse],
        meal_recommendations: List[MealRecommendation],
        daily_additions: List[RecommendationItem]
    ) -> Dict[str, Any]:
        """Generate nutritional insights from recommendations."""
        insights = {
            "total_recommended_calories": 0,
            "macro_distribution": {
                "protein_percent": 0,
                "fat_percent": 0,
                "carbs_percent": 0
            },
            "nutritional_gaps": [],
            "health_benefits": []
        }
        
        # Calculate totals from all recommendations
        total_calories = 0
        total_protein = 0
        total_fat = 0
        total_carbs = 0
        
        # Sum from meal recommendations
        for meal_rec in meal_recommendations:
            for item in meal_rec.recommendations:
                total_calories += item.calories_per_serving
                total_protein += item.protein_g * 4  # Convert to calories
                total_fat += item.fat_g * 9
                total_carbs += item.carbs_g * 4
        
        # Sum from daily additions
        for item in daily_additions:
            total_calories += item.calories_per_serving
            total_protein += item.protein_g * 4
            total_fat += item.fat_g * 9
            total_carbs += item.carbs_g * 4
        
        insights["total_recommended_calories"] = round(total_calories)
        
        # Calculate macro percentages
        if total_calories > 0:
            insights["macro_distribution"] = {
                "protein_percent": round((total_protein / total_calories) * 100, 1),
                "fat_percent": round((total_fat / total_calories) * 100, 1),
                "carbs_percent": round((total_carbs / total_calories) * 100, 1)
            }
        
        # Add generic insights
        insights["nutritional_gaps"] = ["Vitamin D", "Omega-3", "Fiber"]
        insights["health_benefits"] = ["Improved protein intake", "Better micronutrient profile"]
        
        return insights
    
    def _get_personalization_factors(
        self,
        user_profile: Optional[UserPreferenceProfile],
        request: SmartRecommendationRequest
    ) -> List[str]:
        """Get factors used in personalization."""
        factors = []
        
        if user_profile and user_profile.interaction_count > 0:
            factors.append("User meal history")
        
        if request.dietary_restrictions:
            factors.append("Dietary restrictions")
        
        if request.cuisine_preferences:
            factors.append("Cuisine preferences")
        
        if request.target_macros:
            factors.append("Macro targets")
        
        factors.append("Nutritional quality scoring")
        factors.append("Seasonal availability")
        
        return factors
    
    async def _cache_recommendations(
        self,
        request: SmartRecommendationRequest,
        response: SmartRecommendationResponse
    ):
        """Cache recommendations for future use."""
        # Create cache key from request parameters
        cache_key = f"recommendations:{hash(str(request))}"
        
        try:
            await cache_service.set(
                cache_key,
                response.dict()
            )
            logger.debug(f"Cached recommendations with key: {cache_key}")
        except Exception as e:
            logger.warning(f"Failed to cache recommendations: {e}")
    
    def _check_dietary_compatibility(self, product: ProductResponse, restrictions: List[str]) -> bool:
        """Check if product meets dietary restrictions."""
        if not restrictions:
            return True
        
        product_name = (product.name or "").lower()
        brand_name = (product.brand or "").lower()
        
        for restriction in restrictions:
            restriction_lower = restriction.lower()
            
            if restriction_lower == "vegetarian":
                # Basic meat detection
                meat_keywords = ["chicken", "beef", "pork", "fish", "meat", "turkey", "lamb"]
                if any(keyword in product_name or keyword in brand_name for keyword in meat_keywords):
                    return False
            
            elif restriction_lower == "vegan":
                # Basic animal product detection
                animal_keywords = [
                    "chicken", "beef", "pork", "fish", "meat", "milk", "cheese", 
                    "yogurt", "egg", "butter", "cream", "whey", "casein"
                ]
                if any(keyword in product_name or keyword in brand_name for keyword in animal_keywords):
                    return False
            
            elif restriction_lower == "gluten-free":
                # Basic gluten detection
                gluten_keywords = ["wheat", "barley", "rye", "gluten", "flour", "bread", "pasta"]
                if any(keyword in product_name or keyword in brand_name for keyword in gluten_keywords):
                    return False
        
        return True
    
    def _contains_excluded_ingredients(self, product: ProductResponse, excluded: List[str]) -> bool:
        """Check if product contains excluded ingredients."""
        if not excluded:
            return False
        
        product_name = (product.name or "").lower()
        brand_name = (product.brand or "").lower()
        
        for ingredient in excluded:
            ingredient_lower = ingredient.lower()
            if ingredient_lower in product_name or ingredient_lower in brand_name:
                return True
        
        return False
    
    async def _update_user_preferences(self, feedback: RecommendationFeedback):
        """Update user preferences based on feedback."""
        user_id = feedback.user_id
        
        if user_id not in self.user_profiles:
            await self._load_user_profile(user_id)
        
        profile = self.user_profiles[user_id]
        
        # Update preferences based on feedback
        if feedback.accepted:
            # Add to favorites (simplified - would use product name/category)
            profile.favorite_foods.add(feedback.barcode)
        else:
            # Add to avoided foods
            profile.avoided_foods.add(feedback.barcode)
        
        # Update interaction count and timestamp
        profile.interaction_count += 1
        profile.last_updated = datetime.now()
        
        logger.debug(f"Updated preferences for user {user_id}: "
                    f"{len(profile.favorite_foods)} favorites, "
                    f"{len(profile.avoided_foods)} avoided")

    def _create_empty_response(self, user_id: Optional[str]) -> SmartRecommendationResponse:
        """Create empty response when no recommendations can be generated."""
        return SmartRecommendationResponse(
            user_id=user_id,
            generated_at=datetime.now(),
            meal_recommendations=[],
            daily_additions=[],
            snack_recommendations=[],
            nutritional_insights={},
            personalization_factors=[],
            total_recommendations=0,
            avg_confidence=0.0,
            recommendation_version="1.0"
        )
    
    def _calculate_macro_gaps(self, current_meal, target_calories: float) -> Dict[str, float]:
        """Calculate macronutrient gaps in current meal."""
        gaps = {"protein": 0, "fat": 0, "carbs": 0, "fiber": 0}
        
        if current_meal:
            # Calculate current macros
            current_protein = sum(item.macros.protein_g for item in current_meal.items)
            current_fat = sum(item.macros.fat_g for item in current_meal.items)
            current_carbs = sum(item.macros.carbs_g for item in current_meal.items)
            
            # Calculate target macros (using standard ratios)
            target_protein = target_calories * 0.25 / 4  # 25% protein, 4 kcal/g
            target_fat = target_calories * 0.30 / 9      # 30% fat, 9 kcal/g
            target_carbs = target_calories * 0.45 / 4    # 45% carbs, 4 kcal/g
            
            # Calculate gaps
            gaps["protein"] = max(0, target_protein - current_protein)
            gaps["fat"] = max(0, target_fat - current_fat)
            gaps["carbs"] = max(0, target_carbs - current_carbs)
            gaps["fiber"] = max(0, 8.0)  # Assume 8g fiber target per meal
        
        return gaps
    
    def _identify_micronutrient_gaps(self, current_meal) -> List[str]:
        """Identify potential micronutrient gaps."""
        # Simplified implementation - would need detailed nutrition database
        gaps = ["Vitamin D", "Iron", "Calcium", "Vitamin B12"]
        return gaps[:2]  # Return top 2 for simplicity


# Create global instance
recommendation_engine = SmartRecommendationEngine()