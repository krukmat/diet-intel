"""
Smart Diet Engine - Unified AI Nutrition Assistant
Integrates Smart Recommendations + Smart Meal Optimization
"""

import logging
import asyncio
import uuid
import hashlib
import json
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime, timedelta
from collections import defaultdict

# Import existing recommendation engine as base
# Temporarily commented to fix circular import - Task 8 integration
# from app.services.recommendation_engine import SmartRecommendationEngine, recommendation_engine
# from app.services.recommendation_engine import recommendation_engine
from app.models.smart_diet import (
    SmartDietRequest, SmartDietResponse, SmartSuggestion, SuggestionFeedback,
    SuggestionType, SuggestionCategory, SmartDietContext, SmartDietInsights,
    SmartDietMetrics, LegacyMigrationHelper, OptimizationSuggestion
)
from app.models.recommendation import SmartRecommendationRequest
from app.models.product import ProductResponse
from app.models.meal_plan import MealPlanResponse
from app.services.cache import cache_service
from app.services.smart_diet_cache import get_smart_diet_cache
from app.services.plan_storage import plan_storage
from app.services.product_discovery import product_discovery_service
from app.services.database import db_service
from app.services.translation_service import get_translation_service

logger = logging.getLogger(__name__)


class OptimizationEngine:
    """
    Meal optimization engine for Smart Diet.
    Analyzes existing meal plans and suggests improvements.
    """
    
    def __init__(self):
        self.optimization_rules = self._initialize_optimization_rules()
        self.food_swap_database = self._initialize_swap_database()
    
    def _initialize_optimization_rules(self) -> List[Dict[str, Any]]:
        """Initialize optimization rules and logic"""
        return [
            {
                "name": "protein_boost",
                "trigger": lambda nutrition: nutrition.get("protein_g", 0) < 20,
                "suggestions": [
                    {
                        "swap": {"type": "grain", "pattern": "white rice"},
                        "to": {"name": "Quinoa", "barcode": "OPT_QUINOA"},
                        "benefit": {"protein_g": 6, "fiber_g": 3},
                        "reasoning": "Quinoa provides complete protein and fiber"
                    },
                    {
                        "add": {"name": "Greek Yogurt", "barcode": "OPT_GREEK_YOGURT", "amount": "150g"},
                        "benefit": {"protein_g": 15, "probiotics": True},
                        "reasoning": "Greek yogurt adds high-quality protein and probiotics"
                    }
                ]
            },
            {
                "name": "fiber_increase",
                "trigger": lambda nutrition: nutrition.get("fiber_g", 0) < 8,
                "suggestions": [
                    {
                        "swap": {"type": "grain", "pattern": "white bread"},
                        "to": {"name": "Whole Grain Bread", "barcode": "OPT_WHOLE_GRAIN"},
                        "benefit": {"fiber_g": 4, "b_vitamins": True},
                        "reasoning": "Whole grains provide essential fiber and B vitamins"
                    },
                    {
                        "add": {"name": "Chia Seeds", "barcode": "OPT_CHIA", "amount": "15g"},
                        "benefit": {"fiber_g": 5, "omega3_g": 2},
                        "reasoning": "Chia seeds are fiber-rich and provide healthy omega-3s"
                    }
                ]
            },
            {
                "name": "calorie_reduction",
                "trigger": lambda nutrition, target: nutrition.get("calories", 0) > target * 1.15,
                "suggestions": [
                    {
                        "swap": {"type": "dairy", "pattern": "whole milk"},
                        "to": {"name": "Almond Milk", "barcode": "OPT_ALMOND_MILK"},
                        "benefit": {"calories": -100, "calcium": True},
                        "reasoning": "Almond milk reduces calories while maintaining calcium"
                    },
                    {
                        "adjust": {"type": "portion", "reduction": 0.2},
                        "benefit": {"calories": -150},
                        "reasoning": "Slight portion reduction maintains satisfaction"
                    }
                ]
            }
        ]
    
    def _initialize_swap_database(self) -> Dict[str, List[Dict]]:
        """Initialize basic food categories for dynamic swap generation"""
        # This now serves as a category mapping for intelligent swap discovery
        return {
            "grain_products": ["rice", "bread", "pasta", "oats", "quinoa", "barley"],
            "protein_sources": ["chicken", "beef", "fish", "tofu", "beans", "eggs"],
            "dairy_products": ["milk", "cheese", "yogurt", "butter", "cream"],
            "vegetables": ["spinach", "broccoli", "carrots", "tomatoes", "onions"],
            "fruits": ["apple", "banana", "orange", "berries", "grapes"]
        }
    
    async def analyze_meal_plan(
        self, 
        meal_plan: MealPlanResponse, 
        user_goals: Dict[str, Any]
    ) -> List[OptimizationSuggestion]:
        """Analyze meal plan and generate optimization suggestions"""
        optimizations = []
        
        try:
            for meal in meal_plan.meals:
                # Calculate current meal nutrition
                meal_nutrition = self._calculate_meal_nutrition(meal)
                
                # Check against optimization rules
                for rule in self.optimization_rules:
                    if self._should_apply_rule(rule, meal_nutrition, user_goals):
                        suggestions = await self._generate_rule_suggestions(
                            rule, meal, meal_nutrition, user_goals
                        )
                        optimizations.extend(suggestions)
                
                # Check for specific food swaps
                swap_suggestions = await self._generate_swap_suggestions(meal, user_goals)
                optimizations.extend(swap_suggestions)
        
        except Exception as e:
            logger.error(f"Error analyzing meal plan: {e}")
        
        # Sort by confidence and return top suggestions
        optimizations.sort(key=lambda x: x.confidence_score, reverse=True)
        return optimizations[:10]  # Limit to top 10
    
    def _calculate_meal_nutrition(self, meal) -> Dict[str, float]:
        """Calculate nutritional totals for a meal"""
        nutrition = {
            "calories": 0,
            "protein_g": 0,
            "fat_g": 0,
            "carbs_g": 0,
            "fiber_g": 0
        }
        
        try:
            for item in meal.items:
                nutrition["calories"] += item.macros.calories
                nutrition["protein_g"] += item.macros.protein_g
                nutrition["fat_g"] += item.macros.fat_g
                nutrition["carbs_g"] += item.macros.carbs_g
                # fiber_g might not be available in all items
                if hasattr(item.macros, 'fiber_g'):
                    nutrition["fiber_g"] += item.macros.fiber_g or 0
        except Exception as e:
            logger.warning(f"Error calculating meal nutrition: {e}")
        
        return nutrition
    
    def _should_apply_rule(self, rule: Dict, nutrition: Dict, goals: Dict) -> bool:
        """Check if optimization rule should be applied"""
        try:
            trigger = rule.get("trigger")
            if not trigger:
                return False
            
            # Rules may have different signature requirements
            import inspect
            sig = inspect.signature(trigger)
            if len(sig.parameters) == 1:
                return trigger(nutrition)
            else:
                target_calories = goals.get("target_calories", 2000)
                return trigger(nutrition, target_calories)
        except Exception as e:
            logger.warning(f"Error evaluating rule trigger: {e}")
            return False
    
    async def _generate_rule_suggestions(
        self,
        rule: Dict,
        meal,
        nutrition: Dict,
        goals: Dict
    ) -> List[OptimizationSuggestion]:
        """Generate suggestions based on optimization rule"""
        suggestions = []
        
        try:
            rule_suggestions = rule.get("suggestions", [])
            
            for suggestion_def in rule_suggestions:
                suggestion = await self._create_optimization_from_rule(
                    suggestion_def, meal, nutrition, goals
                )
                if suggestion:
                    suggestions.append(suggestion)
        
        except Exception as e:
            logger.error(f"Error generating rule suggestions: {e}")
        
        return suggestions
    
    async def _create_optimization_from_rule(
        self,
        suggestion_def: Dict,
        meal,
        nutrition: Dict,
        goals: Dict
    ) -> Optional[OptimizationSuggestion]:
        """Create optimization suggestion from rule definition"""
        try:
            suggestion_id = str(uuid.uuid4())
            
            if "swap" in suggestion_def:
                # Food swap optimization
                swap_info = suggestion_def["swap"]
                to_info = suggestion_def["to"]
                benefit = suggestion_def.get("benefit", {})
                
                return OptimizationSuggestion(
                    id=suggestion_id,
                    suggestion_type=SuggestionType.OPTIMIZATION,
                    category=SuggestionCategory.FOOD_SWAP,
                    optimization_type="swap",
                    title=f"Swap to {to_info['name']}",
                    description=f"Replace {swap_info.get('pattern', 'current item')} with {to_info['name']}",
                    reasoning=suggestion_def.get("reasoning", "Improves nutritional profile"),
                    current_item={
                        "type": swap_info.get("type"),
                        "pattern": swap_info.get("pattern")
                    },
                    suggested_item={
                        "name": to_info["name"],
                        "barcode": to_info["barcode"]
                    },
                    nutritional_benefit=benefit,
                    target_improvement=benefit,
                    confidence_score=0.75,
                    planning_context=SmartDietContext.OPTIMIZE
                )
            
            elif "add" in suggestion_def:
                # Addition optimization
                add_info = suggestion_def["add"]
                benefit = suggestion_def.get("benefit", {})
                
                return OptimizationSuggestion(
                    id=suggestion_id,
                    suggestion_type=SuggestionType.OPTIMIZATION,
                    category=SuggestionCategory.MEAL_ADDITION,
                    optimization_type="add",
                    title=f"Add {add_info['name']}",
                    description=f"Add {add_info['amount']} of {add_info['name']} to boost nutrition",
                    reasoning=suggestion_def.get("reasoning", "Enhances meal nutritional value"),
                    suggested_item={
                        "name": add_info["name"],
                        "barcode": add_info["barcode"],
                        "amount": add_info["amount"]
                    },
                    nutritional_benefit=benefit,
                    target_improvement=benefit,
                    confidence_score=0.70,
                    planning_context=SmartDietContext.OPTIMIZE
                )
            
            elif "adjust" in suggestion_def:
                # Portion adjustment
                adjust_info = suggestion_def["adjust"]
                benefit = suggestion_def.get("benefit", {})
                
                return OptimizationSuggestion(
                    id=suggestion_id,
                    suggestion_type=SuggestionType.OPTIMIZATION,
                    category=SuggestionCategory.PORTION_ADJUST,
                    optimization_type="adjust",
                    title="Adjust Portion Size",
                    description=f"Reduce portion by {adjust_info.get('reduction', 0.2)*100:.0f}%",
                    reasoning=suggestion_def.get("reasoning", "Optimizes calorie intake"),
                    suggested_item={"adjustment": adjust_info},
                    nutritional_benefit=benefit,
                    target_improvement=benefit,
                    confidence_score=0.65,
                    planning_context=SmartDietContext.OPTIMIZE
                )
        
        except Exception as e:
            logger.error(f"Error creating optimization from rule: {e}")
        
        return None
    
    async def _generate_swap_suggestions(self, meal, goals: Dict) -> List[OptimizationSuggestion]:
        """Generate intelligent food swap suggestions using real product database"""
        suggestions = []
        
        try:
            for item in meal.items:
                item_name = item.name.lower() if item.name else ""
                
                # Determine item category
                item_category = self._categorize_food_item(item_name)
                if not item_category:
                    continue
                
                # Find better alternatives in the same category from database
                alternatives = await self._find_healthier_alternatives(
                    item, item_category, goals
                )
                
                for alternative in alternatives:
                    suggestion = await self._create_intelligent_swap_suggestion(
                        item, alternative, item_category
                    )
                    if suggestion:
                        suggestions.append(suggestion)
        
        except Exception as e:
            logger.error(f"Error generating intelligent swap suggestions: {e}")
        
        return suggestions
    
    def _categorize_food_item(self, item_name: str) -> Optional[str]:
        """Categorize a food item based on its name"""
        for category, keywords in self.food_swap_database.items():
            for keyword in keywords:
                if keyword in item_name:
                    return category
        return None
    
    async def _find_healthier_alternatives(
        self, 
        current_item, 
        category: str, 
        goals: Dict
    ) -> List[Dict]:
        """Find healthier alternatives from database"""
        try:
            alternatives = []
            
            # Get current item's nutritional profile
            current_calories = getattr(current_item.macros, 'calories', 0)
            current_protein = getattr(current_item.macros, 'protein_g', 0)
            current_fat = getattr(current_item.macros, 'fat_g', 0)
            
            # Search database for similar products in same category
            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                
                # Build search query based on category
                category_keywords = self.food_swap_database.get(category, [])
                keyword_conditions = []
                params = []
                
                for keyword in category_keywords:
                    keyword_conditions.append("(LOWER(name) LIKE ? OR LOWER(categories) LIKE ?)")
                    params.extend([f"%{keyword}%", f"%{keyword}%"])
                
                if not keyword_conditions:
                    return alternatives
                
                where_clause = f"WHERE {' OR '.join(keyword_conditions)}"
                params.append(10)  # Limit results
                
                cursor.execute(f"""
                    SELECT * FROM products p
                    {where_clause}
                    AND json_extract(p.nutriments, '$.energy_kcal_per_100g') IS NOT NULL
                    ORDER BY p.access_count DESC
                    LIMIT ?
                """, params)
                
                rows = cursor.fetchall()
                
                for row in rows:
                    try:
                        import json
                        nutriments = json.loads(row['nutriments'])
                        
                        # Calculate improvement potential
                        alt_calories = nutriments.get('energy_kcal_per_100g', 0) or 0
                        alt_protein = nutriments.get('protein_g_per_100g', 0) or 0
                        alt_fat = nutriments.get('fat_g_per_100g', 0) or 0
                        
                        # Determine if this is a better alternative
                        improvements = {}
                        reasoning_parts = []
                        
                        if alt_calories < current_calories * 0.8:  # 20% fewer calories
                            improvements['calories'] = current_calories - alt_calories
                            reasoning_parts.append("lower calorie option")
                        
                        if alt_protein > current_protein * 1.2:  # 20% more protein
                            improvements['protein_g'] = alt_protein - current_protein
                            reasoning_parts.append("higher protein content")
                        
                        if alt_fat < current_fat * 0.7:  # 30% less fat
                            improvements['fat_g'] = current_fat - alt_fat
                            reasoning_parts.append("reduced fat")
                        
                        # Only suggest if there are meaningful improvements
                        if improvements:
                            alternatives.append({
                                "name": row['name'],
                                "barcode": row['barcode'],
                                "benefits": improvements,
                                "confidence": min(0.9, 0.6 + len(improvements) * 0.1),
                                "reasoning": f"Better choice with {', '.join(reasoning_parts)}"
                            })
                    
                    except Exception as e:
                        logger.warning(f"Error processing alternative {row.get('barcode')}: {e}")
            
            return alternatives[:3]  # Return top 3 alternatives
            
        except Exception as e:
            logger.error(f"Error finding healthier alternatives: {e}")
            return []
    
    async def _create_intelligent_swap_suggestion(
        self, 
        current_item, 
        alternative: Dict,
        category: str
    ) -> Optional[OptimizationSuggestion]:
        """Create an intelligent swap suggestion based on database analysis"""
        try:
            suggestion_id = str(uuid.uuid4())
            
            return OptimizationSuggestion(
                id=suggestion_id,
                suggestion_type=SuggestionType.OPTIMIZATION,
                category=SuggestionCategory.FOOD_SWAP,
                optimization_type="intelligent_swap",
                title=f"Swap {current_item.name} for {alternative['name']}",
                description=f"Replace with {alternative['name']} for better nutrition",
                reasoning=alternative.get("reasoning", "Improves nutritional profile based on database analysis"),
                current_item={
                    "name": current_item.name,
                    "barcode": getattr(current_item, 'barcode', ''),
                    "calories": getattr(current_item.macros, 'calories', 0)
                },
                suggested_item={
                    "name": alternative["name"],
                    "barcode": alternative["barcode"],
                    "source": "Database Analysis"
                },
                nutritional_benefit=alternative.get("benefits", {}),
                target_improvement=alternative.get("benefits", {}),
                confidence_score=alternative.get("confidence", 0.75),
                planning_context=SmartDietContext.OPTIMIZE
            )
        
        except Exception as e:
            logger.error(f"Error creating intelligent swap suggestion: {e}")
        
        return None


class SmartDietEngine:
    """
    Unified Smart Diet Engine
    Combines Smart Recommendations + Smart Meal Optimization
    """
    
    def __init__(self):
        # Use existing recommendation engine as foundation
        # Temporarily disabled for Task 8 integration - will re-enable after completion
        self.recommendation_engine = None  # recommendation_engine
        try:
            from app.services.recommendation_engine import recommendation_engine
            self.recommendation_engine = recommendation_engine
        except Exception as exc:
            logger.warning(f"Recommendation engine unavailable: {exc}")
        
        # Add optimization capabilities
        self.optimization_engine = OptimizationEngine()
        
        # Smart Diet specific cache manager
        self.cache_manager = get_smart_diet_cache()
        
        # Translation service for internationalization
        self.translation_service = get_translation_service(cache_service)
        
        # Cross-intelligence learning
        self.suggestion_history: List[SmartSuggestion] = []
        self.feedback_history: List[SuggestionFeedback] = []
        
        # Context weights for mixed suggestions
        self.context_weights = {
            SmartDietContext.TODAY: {
                "recommendations": 0.6,
                "optimizations": 0.3,
                "insights": 0.1
            },
            SmartDietContext.OPTIMIZE: {
                "recommendations": 0.2,
                "optimizations": 0.7,
                "insights": 0.1
            },
            SmartDietContext.DISCOVER: {
                "recommendations": 0.8,
                "optimizations": 0.1,
                "insights": 0.1
            },
            SmartDietContext.INSIGHTS: {
                "recommendations": 0.2,
                "optimizations": 0.2,
                "insights": 0.6
            }
        }
    
    def _generate_request_hash(self, user_id: str, request: SmartDietRequest) -> str:
        """Generate hash for cache key based on request parameters"""
        # Create a consistent hash from request parameters
        hash_data = {
            'user_id': user_id,
            'context_type': request.context_type.value,
            'dietary_restrictions': sorted(request.dietary_restrictions),
            'cuisine_preferences': sorted(request.cuisine_preferences),
            'excluded_ingredients': sorted(request.excluded_ingredients),
            'target_macros': request.target_macros,
            'calorie_budget': request.calorie_budget,
            'max_suggestions': request.max_suggestions,
            'min_confidence': request.min_confidence,
            'include_optimizations': request.include_optimizations,
            'include_recommendations': request.include_recommendations,
            'current_meal_plan_id': request.current_meal_plan_id,
            'meal_context': request.meal_context
        }
        
        # Convert to JSON string and hash
        hash_string = json.dumps(hash_data, sort_keys=True)
        return hashlib.md5(hash_string.encode()).hexdigest()[:16]  # First 16 chars
    
    async def get_smart_suggestions(
        self, 
        user_id: str, 
        request: SmartDietRequest
    ) -> SmartDietResponse:
        """
        Generate unified Smart Diet suggestions
        Main entry point for all Smart Diet requests
        """
        start_time = datetime.now()
        logger.info(f"Generating Smart Diet suggestions for user {user_id}, context: {request.context_type}")
        
        # Generate cache key
        request_hash = self._generate_request_hash(user_id, request)
        
        # Try to get from cache first
        cached_response = await self.cache_manager.get_suggestions_cache(
            user_id, request.context_type, request_hash
        )
        if cached_response:
            logger.info(f"Cache hit for Smart Diet suggestions: {user_id}, {request.context_type}")
            return cached_response
        
        try:
            # Initialize response
            response = SmartDietResponse(
                user_id=user_id,
                context_type=request.context_type,
                suggestions=[],
                today_highlights=[],
                optimizations=[],
                discoveries=[],
                insights=[]
            )
            
            # Get context weights
            weights = self.context_weights.get(request.context_type, self.context_weights[SmartDietContext.TODAY])
            
            # Generate recommendations (if requested)
            if request.include_recommendations and weights["recommendations"] > 0:
                recommendations = await self._generate_recommendations(user_id, request)
                response.discoveries.extend(recommendations)
                response.suggestions.extend(recommendations)
            
            # Generate optimizations (if requested) 
            if request.include_optimizations and weights["optimizations"] > 0:
                optimizations = await self._generate_optimizations(user_id, request)
                response.optimizations.extend(optimizations)
                response.suggestions.extend(optimizations)
            
            # Generate insights
            if weights["insights"] > 0:
                insights = await self._generate_insights(user_id, request)
                response.insights.extend(insights)
                response.suggestions.extend(insights)
            
            # Create context-specific highlights
            response.today_highlights = await self._create_today_highlights(response.suggestions, request)
            
            # Generate nutritional summary
            response.nutritional_summary = await self._generate_nutritional_summary(
                response.suggestions, request
            )
            
            # Calculate metrics
            response.total_suggestions = len(response.suggestions)
            response.avg_confidence = (
                sum(s.confidence_score for s in response.suggestions) / len(response.suggestions)
                if response.suggestions else 0.0
            )
            response.generation_time_ms = (datetime.now() - start_time).total_seconds() * 1000
            
            # Store for learning
            self.suggestion_history.extend(response.suggestions)
            
            # Cache the response for future requests
            await self.cache_manager.set_suggestions_cache(
                user_id, request.context_type, request_hash, response
            )
            
            logger.info(f"Generated {response.total_suggestions} Smart Diet suggestions "
                       f"(avg confidence: {response.avg_confidence:.2f}) in {response.generation_time_ms:.0f}ms")
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating Smart Diet suggestions: {e}")
            return SmartDietResponse(
                user_id=user_id,
                context_type=request.context_type,
                total_suggestions=0,
                avg_confidence=0.0
            )
    
    async def _generate_recommendations(
        self, 
        user_id: str, 
        request: SmartDietRequest
    ) -> List[SmartSuggestion]:
        """Generate food discovery recommendations using legacy system"""
        try:
            # Convert to legacy request format
            legacy_request = SmartRecommendationRequest(
                user_id=user_id,
                current_meal_plan_id=request.current_meal_plan_id,
                meal_context=request.meal_context,
                dietary_restrictions=request.dietary_restrictions,
                cuisine_preferences=request.cuisine_preferences,
                excluded_ingredients=request.excluded_ingredients,
                target_macros=request.target_macros,
                calorie_budget=request.calorie_budget,
                max_recommendations=min(request.max_suggestions // 2, 10),
                min_confidence=request.min_confidence
            )
            
            # Generate legacy recommendations
            legacy_response = await self.recommendation_engine.generate_recommendations(legacy_request)
            
            # Convert to Smart Diet format
            suggestions = []
            
            # Convert meal recommendations
            for meal_rec in legacy_response.meal_recommendations:
                for item in meal_rec.recommendations:
                    suggestion = LegacyMigrationHelper.convert_legacy_recommendation(item)
                    suggestion.meal_context = meal_rec.meal_name.lower()
                    suggestions.append(suggestion)
            
            # Convert daily additions
            for item in legacy_response.daily_additions:
                suggestion = LegacyMigrationHelper.convert_legacy_recommendation(item)
                suggestion.category = SuggestionCategory.MEAL_ADDITION
                suggestions.append(suggestion)
            
            # Convert snack recommendations
            for item in legacy_response.snack_recommendations:
                suggestion = LegacyMigrationHelper.convert_legacy_recommendation(item)
                suggestion.meal_context = "snack"
                suggestions.append(suggestion)
            
            return suggestions[:request.max_suggestions // 2]
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            return []
    
    async def _generate_optimizations(
        self, 
        user_id: str, 
        request: SmartDietRequest
    ) -> List[SmartSuggestion]:
        """Generate meal plan optimizations"""
        if not request.current_meal_plan_id:
            return []
        
        try:
            # Load current meal plan
            meal_plan = await plan_storage.get_plan(request.current_meal_plan_id)
            if not meal_plan:
                return []
            
            # Get user goals (simplified for now)
            user_goals = {
                "target_calories": request.calorie_budget or 2000,
                "target_macros": request.target_macros or {}
            }
            
            # Generate optimizations
            optimizations = await self.optimization_engine.analyze_meal_plan(meal_plan, user_goals)
            
            # Convert to base SmartSuggestion format
            suggestions = []
            for opt in optimizations:
                # OptimizationSuggestion inherits from SmartSuggestion, so direct assignment works
                suggestions.append(opt)
            
            return suggestions[:request.max_suggestions // 2]
            
        except Exception as e:
            logger.error(f"Error generating optimizations: {e}")
            return []
    
    async def _generate_insights(
        self, 
        user_id: str, 
        request: SmartDietRequest
    ) -> List[SmartSuggestion]:
        """Generate nutritional insights and advice"""
        insights = []
        
        try:
            # Generate sample insights (would be more sophisticated in production)
            # First get the English versions
            insight_suggestions_en = [
                {
                    "title": "Protein Intake Analysis",
                    "description": "Your protein intake is 15% below recommended levels this week",
                    "reasoning": "Adequate protein supports muscle maintenance and satiety",
                    "category": SuggestionCategory.NUTRITIONAL_GAP
                },
                {
                    "title": "Fiber Opportunity",
                    "description": "Adding 10g more fiber daily could improve digestive health",
                    "reasoning": "Current fiber intake is below the recommended 25-35g daily",
                    "category": SuggestionCategory.NUTRITIONAL_GAP
                }
            ]
            
            # Translate to Spanish (or other languages in future)
            insight_suggestions = []
            for insight in insight_suggestions_en:
                try:
                    if request.lang == 'en':
                        # No translation needed for English - use original
                        insight_suggestions.append(insight)
                    else:
                        # Translate to target language
                        translated_title = await self.translation_service.translate_text(
                            insight["title"], source_lang='en', target_lang=request.lang
                        )
                        translated_description = await self.translation_service.translate_text(
                            insight["description"], source_lang='en', target_lang=request.lang
                        )
                        translated_reasoning = await self.translation_service.translate_text(
                            insight["reasoning"], source_lang='en', target_lang=request.lang
                        )
                        
                        insight_suggestions.append({
                            "title": translated_title or insight["title"],
                            "description": translated_description or insight["description"],
                            "reasoning": translated_reasoning or insight["reasoning"],
                            "category": insight["category"]
                        })
                except Exception as translation_error:
                    logger.warning(f"Translation failed for insight, using English: {translation_error}")
                    # Fallback to English if translation fails
                    insight_suggestions.append(insight)
            
            for idx, insight_data in enumerate(insight_suggestions):
                suggestion = SmartSuggestion(
                    id=f"insight_{user_id}_{idx}_{int(datetime.now().timestamp())}",
                    suggestion_type=SuggestionType.INSIGHT,
                    category=insight_data["category"],
                    title=insight_data["title"],
                    description=insight_data["description"],
                    reasoning=insight_data["reasoning"],
                    suggested_item={"type": "nutritional_advice"},
                    confidence_score=0.8,
                    planning_context=SmartDietContext.INSIGHTS
                )
                insights.append(suggestion)
            
        except Exception as e:
            logger.error(f"Error generating insights: {e}")
        
        return insights
    
    async def _create_today_highlights(
        self, 
        all_suggestions: List[SmartSuggestion], 
        request: SmartDietRequest
    ) -> List[SmartSuggestion]:
        """Create prioritized highlights for 'today' context"""
        if not all_suggestions:
            return []
        
        # Sort by priority and confidence
        highlights = sorted(
            all_suggestions,
            key=lambda s: (s.priority_score, s.confidence_score),
            reverse=True
        )
        
        # Return top 5 highlights
        return highlights[:5]
    
    async def _generate_nutritional_summary(
        self, 
        suggestions: List[SmartSuggestion], 
        request: SmartDietRequest
    ) -> Dict[str, Any]:
        """Generate nutritional summary from suggestions"""
        summary = {
            "total_recommended_calories": 0,
            "macro_distribution": {"protein_percent": 0, "fat_percent": 0, "carbs_percent": 0},
            "health_benefits": [],
            "nutritional_gaps": []
        }
        
        try:
            total_calories = 0
            total_protein_cal = 0
            total_fat_cal = 0 
            total_carbs_cal = 0
            
            benefits = set()
            
            for suggestion in suggestions:
                # Add calories from calorie_impact
                total_calories += abs(suggestion.calorie_impact)
                
                # Add nutritional benefits  
                for nutrient, amount in suggestion.nutritional_benefit.items():
                    if nutrient == "protein_g":
                        total_protein_cal += amount * 4
                    elif nutrient == "fat_g":
                        total_fat_cal += amount * 9
                    elif nutrient == "carbs_g":
                        total_carbs_cal += amount * 4
                
                # Collect health benefits from reasoning
                if "protein" in suggestion.reasoning.lower():
                    benefits.add("Improved protein intake")
                if "fiber" in suggestion.reasoning.lower():
                    benefits.add("Better digestive health")
                if "heart" in suggestion.reasoning.lower():
                    benefits.add("Heart health support")
            
            summary["total_recommended_calories"] = round(total_calories)
            
            # Calculate macro percentages
            total_macro_calories = total_protein_cal + total_fat_cal + total_carbs_cal
            if total_macro_calories > 0:
                summary["macro_distribution"] = {
                    "protein_percent": round((total_protein_cal / total_macro_calories) * 100, 1),
                    "fat_percent": round((total_fat_cal / total_macro_calories) * 100, 1),
                    "carbs_percent": round((total_carbs_cal / total_macro_calories) * 100, 1)
                }
            
            # Translate health benefits based on request language
            translated_benefits = []
            for benefit in benefits:
                if request.lang == 'en':
                    # No translation needed for English
                    translated_benefits.append(benefit)
                else:
                    try:
                        translated_benefit = await self.translation_service.translate_text(
                            benefit, source_lang='en', target_lang=request.lang
                        )
                        translated_benefits.append(translated_benefit or benefit)
                    except Exception as translation_error:
                        logger.warning(f"Translation failed for health benefit '{benefit}': {translation_error}")
                        translated_benefits.append(benefit)
            
            # Translate nutritional gaps based on request language
            nutritional_gaps_en = ["Vitamin D", "Omega-3", "Fiber"]
            translated_gaps = []
            for gap in nutritional_gaps_en:
                if request.lang == 'en':
                    # No translation needed for English
                    translated_gaps.append(gap)
                else:
                    try:
                        translated_gap = await self.translation_service.translate_text(
                            gap, source_lang='en', target_lang=request.lang
                        )
                        translated_gaps.append(translated_gap or gap)
                    except Exception as translation_error:
                        logger.warning(f"Translation failed for nutritional gap '{gap}': {translation_error}")
                        translated_gaps.append(gap)
            
            summary["health_benefits"] = translated_benefits
            summary["nutritional_gaps"] = translated_gaps
            
        except Exception as e:
            logger.error(f"Error generating nutritional summary: {e}")
        
        return summary
    
    async def process_suggestion_feedback(self, feedback: SuggestionFeedback) -> bool:
        """Process user feedback on Smart Diet suggestions"""
        try:
            # Store feedback
            self.feedback_history.append(feedback)
            
            # Update learning based on feedback
            await self._update_learning_from_feedback(feedback)
            
            logger.info(f"Processed feedback for suggestion {feedback.suggestion_id}: {feedback.action}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing suggestion feedback: {e}")
            return False
    
    async def _update_learning_from_feedback(self, feedback: SuggestionFeedback):
        """Update AI learning based on user feedback"""
        try:
            # Find the original suggestion
            original_suggestion = None
            for suggestion in self.suggestion_history:
                if suggestion.id == feedback.suggestion_id:
                    original_suggestion = suggestion
                    break
            
            if not original_suggestion:
                return
            
            # Update confidence based on feedback
            if feedback.action == "accepted":
                # Boost confidence for similar future suggestions
                self._boost_similar_suggestions(original_suggestion)
            elif feedback.action == "rejected":
                # Reduce confidence for similar suggestions
                self._reduce_similar_suggestions(original_suggestion, feedback.feedback_reason)
            
            # Pass recommendation feedback to legacy engine
            if (original_suggestion.suggestion_type == SuggestionType.RECOMMENDATION and 
                original_suggestion.legacy_recommendation_data):
                
                from app.models.recommendation import RecommendationFeedback
                
                legacy_feedback = RecommendationFeedback(
                    user_id=feedback.user_id,
                    recommendation_id=feedback.suggestion_id,
                    barcode=original_suggestion.suggested_item.get("barcode", ""),
                    accepted=(feedback.action == "accepted"),
                    added_to_meal=feedback.meal_context,
                    rejection_reason=feedback.feedback_reason
                )
                
                await self.recommendation_engine.record_feedback(legacy_feedback)
            
        except Exception as e:
            logger.error(f"Error updating learning from feedback: {e}")
    
    def _boost_similar_suggestions(self, suggestion: SmartSuggestion):
        """Boost confidence for similar suggestions"""
        # Simplified implementation - would be more sophisticated in production
        pass
    
    def _reduce_similar_suggestions(self, suggestion: SmartSuggestion, reason: Optional[str]):
        """Reduce confidence for similar suggestions"""  
        # Simplified implementation - would be more sophisticated in production
        pass
    
    async def get_diet_insights(self, user_id: str, period: str = "week") -> SmartDietInsights:
        """Get comprehensive diet insights for user"""
        try:
            # Calculate period boundaries
            if period == "day":
                start_date = datetime.now() - timedelta(days=1)
            elif period == "week":
                start_date = datetime.now() - timedelta(weeks=1)
            elif period == "month":
                start_date = datetime.now() - timedelta(days=30)
            else:
                start_date = datetime.now() - timedelta(weeks=1)
            
            # Filter user feedback and suggestions
            user_feedback = [
                f for f in self.feedback_history 
                if f.user_id == user_id and f.feedback_at >= start_date
            ]
            
            user_suggestions = [
                s for s in self.suggestion_history
                if s.user_id == user_id and s.created_at >= start_date
            ]
            
            # Analyze patterns
            successful_suggestions = [
                s for s in user_suggestions
                if any(f.suggestion_id == s.id and f.action == "accepted" for f in user_feedback)
            ]
            
            ignored_suggestions = [
                s for s in user_suggestions
                if not any(f.suggestion_id == s.id for f in user_feedback)
            ]
            
            # Create insights
            insights = SmartDietInsights(
                period=period,
                user_id=user_id,
                nutritional_gaps={"protein": 15, "fiber": 8, "vitamin_d": 600},  # Simplified
                macro_trends={
                    "protein": [20, 22, 18, 25, 19, 21, 23],
                    "fat": [65, 70, 68, 72, 66, 69, 71],
                    "carbs": [180, 175, 185, 170, 190, 175, 180]
                },
                calorie_trends=[1850, 1920, 1780, 2050, 1890, 1950, 1820],
                eating_patterns={
                    "most_active_meal": "lunch",
                    "suggestion_acceptance_rate": len(successful_suggestions) / len(user_suggestions) if user_suggestions else 0,
                    "preferred_categories": ["protein_boost", "healthy_swaps"]
                },
                successful_suggestions=successful_suggestions,
                ignored_suggestions=ignored_suggestions,
                priority_improvements=["Increase fiber intake", "Add more omega-3 rich foods"],
                improvement_score=0.75
            )
            
            return insights
            
        except Exception as e:
            logger.error(f"Error generating diet insights: {e}")
            return SmartDietInsights(period=period, user_id=user_id)


# Create global instance
smart_diet_engine = SmartDietEngine()
