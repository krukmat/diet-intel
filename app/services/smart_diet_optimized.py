"""
Smart Diet Engine - Performance Optimized Version
Phase 9.3.1: Performance Optimization Implementation
"""

import logging
import asyncio
import uuid
import hashlib
import json
import time
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
from contextlib import asynccontextmanager

# Import existing modules
from app.services.smart_diet import SmartDietEngine
from app.models.smart_diet import (
    SmartDietRequest, SmartDietResponse, SmartSuggestion, 
    SuggestionType, SuggestionCategory, SmartDietContext,
    OptimizationSuggestion
)
from app.services.cache import cache_service
from app.services.database import db_service
from app.services.redis_cache import redis_cache_service

logger = logging.getLogger(__name__)


class PerformanceMonitor:
    """Performance monitoring and metrics collection"""
    
    def __init__(self):
        self.metrics = {
            'api_calls': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'db_queries': 0,
            'avg_response_time': 0.0,
            'response_times': []
        }
    
    def record_api_call(self, response_time_ms: float):
        """Record API call metrics"""
        self.metrics['api_calls'] += 1
        self.metrics['response_times'].append(response_time_ms)
        
        # Keep only last 100 response times for moving average
        if len(self.metrics['response_times']) > 100:
            self.metrics['response_times'].pop(0)
        
        self.metrics['avg_response_time'] = sum(self.metrics['response_times']) / len(self.metrics['response_times'])
    
    def record_cache_hit(self):
        """Record cache hit"""
        self.metrics['cache_hits'] += 1
    
    def record_cache_miss(self):
        """Record cache miss"""
        self.metrics['cache_misses'] += 1
    
    def record_db_query(self):
        """Record database query"""
        self.metrics['db_queries'] += 1
    
    def get_cache_hit_rate(self) -> float:
        """Calculate cache hit rate percentage"""
        total = self.metrics['cache_hits'] + self.metrics['cache_misses']
        return (self.metrics['cache_hits'] / total * 100) if total > 0 else 0.0
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get comprehensive metrics summary"""
        return {
            **self.metrics,
            'cache_hit_rate_percent': self.get_cache_hit_rate(),
            'total_cache_requests': self.metrics['cache_hits'] + self.metrics['cache_misses']
        }


class OptimizedDatabaseService:
    """Optimized database operations for Smart Diet"""
    
    def __init__(self):
        self.connection_pool = None
        self.prepared_queries = self._prepare_queries()
    
    def _prepare_queries(self) -> Dict[str, str]:
        """Prepare optimized SQL queries"""
        return {
            'find_alternatives': """
                SELECT 
                    p.name, p.barcode, p.nutriments, p.access_count,
                    json_extract(p.nutriments, '$.energy_kcal_per_100g') as calories,
                    json_extract(p.nutriments, '$.protein_g_per_100g') as protein,
                    json_extract(p.nutriments, '$.fat_g_per_100g') as fat,
                    json_extract(p.nutriments, '$.fiber_g_per_100g') as fiber
                FROM products p
                WHERE (LOWER(p.name) LIKE ? OR LOWER(p.categories) LIKE ?)
                  AND json_extract(p.nutriments, '$.energy_kcal_per_100g') IS NOT NULL
                  AND p.calories > 0
                ORDER BY p.access_count DESC, p.calories ASC
                LIMIT ?
            """,
            
            'batch_product_lookup': """
                SELECT name, barcode, nutriments, access_count
                FROM products 
                WHERE barcode IN ({})
                ORDER BY access_count DESC
            """,
            
            'user_preferences': """
                SELECT dietary_restrictions, cuisine_preferences, excluded_ingredients
                FROM user_preferences 
                WHERE user_id = ?
            """,
            
            'meal_plan_nutrition': """
                SELECT 
                    mpi.item_name, mpi.quantity,
                    json_extract(p.nutriments, '$.energy_kcal_per_100g') as calories_per_100g,
                    json_extract(p.nutriments, '$.protein_g_per_100g') as protein_per_100g
                FROM meal_plan_items mpi
                LEFT JOIN products p ON mpi.barcode = p.barcode
                WHERE mpi.meal_plan_id = ?
            """
        }
    
    async def find_healthier_alternatives_optimized(
        self, 
        search_terms: List[str], 
        current_nutrition: Dict,
        limit: int = 5
    ) -> List[Dict]:
        """Optimized database query for finding alternatives"""
        try:
            start_time = time.time()
            alternatives = []
            
            # Use connection pooling
            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                
                # Single optimized query using prepared statement
                for term in search_terms[:3]:  # Limit search terms
                    search_pattern = f"%{term.lower()}%"
                    
                    cursor.execute(
                        self.prepared_queries['find_alternatives'],
                        [search_pattern, search_pattern, limit]
                    )
                    
                    rows = cursor.fetchall()
                    
                    for row in rows:
                        if len(alternatives) >= limit:
                            break
                            
                        try:
                            # Use pre-extracted nutrition values
                            alt_calories = float(row['calories'] or 0)
                            alt_protein = float(row['protein'] or 0)
                            alt_fat = float(row['fat'] or 0)
                            
                            # Quick improvement calculation
                            score = self._calculate_improvement_score(
                                current_nutrition, 
                                {'calories': alt_calories, 'protein': alt_protein, 'fat': alt_fat}
                            )
                            
                            if score > 0.1:  # Only meaningful improvements
                                alternatives.append({
                                    'name': row['name'],
                                    'barcode': row['barcode'],
                                    'score': score,
                                    'calories': alt_calories,
                                    'protein': alt_protein,
                                    'fat': alt_fat,
                                    'confidence': min(0.9, 0.5 + score)
                                })
                        
                        except (ValueError, TypeError) as e:
                            continue
                
                # Sort by improvement score
                alternatives.sort(key=lambda x: x['score'], reverse=True)
                
                query_time = (time.time() - start_time) * 1000
                logger.debug(f"Database query completed in {query_time:.2f}ms, found {len(alternatives)} alternatives")
                
                return alternatives[:limit]
                
        except Exception as e:
            logger.error(f"Error in optimized alternatives query: {e}")
            return []
    
    def _calculate_improvement_score(self, current: Dict, alternative: Dict) -> float:
        """Fast improvement score calculation"""
        score = 0.0
        
        # Calorie improvement (20% threshold)
        if alternative['calories'] < current.get('calories', 0) * 0.8:
            score += 0.3
        
        # Protein improvement (15% threshold)
        if alternative['protein'] > current.get('protein', 0) * 1.15:
            score += 0.4
        
        # Fat reduction (25% threshold)
        if alternative['fat'] < current.get('fat', 0) * 0.75:
            score += 0.3
        
        return score


class OptimizedCacheManager:
    """High-performance caching with Redis and memory layers"""
    
    def __init__(self):
        self.memory_cache = {}  # L1 cache
        self.cache_ttl = {
            SmartDietContext.TODAY: 1800,      # 30 minutes
            SmartDietContext.OPTIMIZE: 900,    # 15 minutes  
            SmartDietContext.DISCOVER: 7200,   # 2 hours
            SmartDietContext.INSIGHTS: 43200   # 12 hours
        }
        self.max_memory_cache_size = 1000
    
    async def get_suggestions_cache(
        self, 
        user_id: str, 
        context: SmartDietContext, 
        request_hash: str
    ) -> Optional[SmartDietResponse]:
        """Multi-level cache lookup with performance monitoring"""
        cache_key = f"smart_diet:{user_id}:{context.value}:{request_hash}"
        
        # L1 Memory cache check
        if cache_key in self.memory_cache:
            cached_data, timestamp = self.memory_cache[cache_key]
            ttl = self.cache_ttl.get(context, 1800)
            
            if time.time() - timestamp < ttl:
                logger.debug(f"L1 cache hit: {cache_key}")
                return cached_data
            else:
                # Remove expired entry
                del self.memory_cache[cache_key]
        
        # L2 Redis cache check
        try:
            cached_json = await redis_cache_service.get(cache_key)
            if cached_json:
                logger.debug(f"L2 cache hit: {cache_key}")
                response_data = json.loads(cached_json)
                
                # Convert back to SmartDietResponse object
                response = SmartDietResponse(**response_data)
                
                # Store in L1 cache for faster access
                self._store_in_memory_cache(cache_key, response)
                
                return response
        
        except Exception as e:
            logger.warning(f"Redis cache error: {e}")
        
        return None
    
    async def set_suggestions_cache(
        self, 
        user_id: str, 
        context: SmartDietContext, 
        request_hash: str, 
        response: SmartDietResponse
    ):
        """Store in multi-level cache with optimal TTL"""
        cache_key = f"smart_diet:{user_id}:{context.value}:{request_hash}"
        ttl = self.cache_ttl.get(context, 1800)
        
        # Store in L1 memory cache
        self._store_in_memory_cache(cache_key, response)
        
        # Store in L2 Redis cache
        try:
            response_json = json.dumps(response.dict())
            await redis_cache_service.set(cache_key, response_json, ttl)
            logger.debug(f"Cached response for {cache_key} with TTL {ttl}s")
        
        except Exception as e:
            logger.warning(f"Redis cache storage error: {e}")
    
    def _store_in_memory_cache(self, key: str, response: SmartDietResponse):
        """Store in L1 memory cache with size management"""
        # Implement LRU eviction if cache is full
        if len(self.memory_cache) >= self.max_memory_cache_size:
            # Remove oldest entry
            oldest_key = min(self.memory_cache.keys(), 
                           key=lambda k: self.memory_cache[k][1])
            del self.memory_cache[oldest_key]
        
        self.memory_cache[key] = (response, time.time())


class SmartDietEngineOptimized(SmartDietEngine):
    """Performance-optimized Smart Diet Engine"""
    
    def __init__(self):
        super().__init__()
        self.performance_monitor = PerformanceMonitor()
        self.optimized_cache = OptimizedCacheManager()
        self.optimized_db = OptimizedDatabaseService()
        
        # Performance configuration
        self.max_concurrent_queries = 5
        self.query_timeout = 2.0  # seconds
        self.batch_size = 10
    
    async def get_smart_suggestions_optimized(
        self, 
        user_id: str, 
        request: SmartDietRequest
    ) -> SmartDietResponse:
        """
        Optimized main entry point for Smart Diet suggestions
        Target: <500ms response time
        """
        start_time = time.time()
        
        try:
            # Generate cache key
            request_hash = self._generate_request_hash(user_id, request)
            
            # Multi-level cache lookup
            cached_response = await self.optimized_cache.get_suggestions_cache(
                user_id, request.context_type, request_hash
            )
            
            if cached_response:
                self.performance_monitor.record_cache_hit()
                response_time = (time.time() - start_time) * 1000
                self.performance_monitor.record_api_call(response_time)
                
                logger.info(f"Cache hit - Smart Diet response in {response_time:.2f}ms")
                return cached_response
            
            self.performance_monitor.record_cache_miss()
            
            # Parallel generation of suggestion components
            tasks = []
            
            # Get context weights
            weights = self.context_weights.get(
                request.context_type, 
                self.context_weights[SmartDietContext.TODAY]
            )
            
            # Create tasks for parallel execution
            if request.include_recommendations and weights["recommendations"] > 0:
                tasks.append(self._generate_recommendations_optimized(user_id, request))
            
            if request.include_optimizations and weights["optimizations"] > 0:
                tasks.append(self._generate_optimizations_optimized(user_id, request))
            
            if weights["insights"] > 0:
                tasks.append(self._generate_insights_optimized(user_id, request))
            
            # Execute all tasks in parallel with timeout
            try:
                results = await asyncio.wait_for(
                    asyncio.gather(*tasks, return_exceptions=True),
                    timeout=self.query_timeout
                )
                
                # Process results
                recommendations = []
                optimizations = []
                insights = []
                
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        logger.warning(f"Task {i} failed: {result}")
                        continue
                    
                    if i == 0 and request.include_recommendations:
                        recommendations = result
                    elif (i == 1 if request.include_recommendations else i == 0) and request.include_optimizations:
                        optimizations = result
                    else:
                        insights = result
            
            except asyncio.TimeoutError:
                logger.warning(f"Smart Diet generation timed out after {self.query_timeout}s")
                recommendations = optimizations = insights = []
            
            # Build response
            all_suggestions = recommendations + optimizations + insights
            
            response = SmartDietResponse(
                user_id=user_id,
                context_type=request.context_type,
                suggestions=all_suggestions,
                today_highlights=all_suggestions[:3],  # Quick highlights
                optimizations=optimizations,
                discoveries=recommendations,
                insights=insights,
                total_suggestions=len(all_suggestions),
                avg_confidence=(
                    sum(s.confidence_score for s in all_suggestions) / len(all_suggestions)
                    if all_suggestions else 0.0
                ),
                generation_time_ms=(time.time() - start_time) * 1000
            )
            
            # Cache response asynchronously
            asyncio.create_task(self.optimized_cache.set_suggestions_cache(
                user_id, request.context_type, request_hash, response
            ))
            
            # Record performance metrics
            response_time = (time.time() - start_time) * 1000
            self.performance_monitor.record_api_call(response_time)
            
            logger.info(f"Generated Smart Diet response in {response_time:.2f}ms "
                       f"({len(all_suggestions)} suggestions)")
            
            return response
            
        except Exception as e:
            logger.error(f"Error in optimized Smart Diet generation: {e}")
            error_time = (time.time() - start_time) * 1000
            self.performance_monitor.record_api_call(error_time)
            
            # Return minimal response on error
            return SmartDietResponse(
                user_id=user_id,
                context_type=request.context_type,
                total_suggestions=0,
                avg_confidence=0.0,
                generation_time_ms=error_time
            )
    
    async def _generate_recommendations_optimized(
        self, 
        user_id: str, 
        request: SmartDietRequest
    ) -> List[SmartSuggestion]:
        """Optimized recommendation generation"""
        try:
            # Use optimized legacy system with caching
            cache_key = f"recommendations:{user_id}:{request.meal_context}"
            
            # Check memory cache first
            cached = self.optimized_cache.memory_cache.get(cache_key)
            if cached and time.time() - cached[1] < 300:  # 5 min cache
                return cached[0]
            
            # Generate with limited scope for performance
            recommendations = await self._call_legacy_recommendations_fast(user_id, request)
            
            # Cache results
            self.optimized_cache.memory_cache[cache_key] = (recommendations, time.time())
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating optimized recommendations: {e}")
            return []
    
    async def _generate_optimizations_optimized(
        self, 
        user_id: str, 
        request: SmartDietRequest
    ) -> List[SmartSuggestion]:
        """Optimized meal plan optimization"""
        try:
            if not request.current_meal_plan_id:
                return []
            
            # Use optimized database queries
            optimizations = []
            
            # Get meal plan data with single query
            meal_items = await self._get_meal_plan_items_fast(request.current_meal_plan_id)
            
            if not meal_items:
                return optimizations
            
            # Batch process improvements
            for item_batch in self._batch_items(meal_items, self.batch_size):
                batch_improvements = await self._process_optimization_batch(item_batch)
                optimizations.extend(batch_improvements)
                
                # Limit optimizations for performance
                if len(optimizations) >= request.max_suggestions:
                    break
            
            return optimizations[:request.max_suggestions]
            
        except Exception as e:
            logger.error(f"Error generating optimized optimizations: {e}")
            return []
    
    async def _generate_insights_optimized(
        self, 
        user_id: str, 
        request: SmartDietRequest
    ) -> List[SmartSuggestion]:
        """Optimized insights generation"""
        try:
            # Fast insights with pre-computed data
            insights = []
            
            # Generate quick insights without heavy computation
            quick_insights = await self._generate_quick_insights(user_id, request)
            insights.extend(quick_insights)
            
            return insights[:3]  # Limit for performance
            
        except Exception as e:
            logger.error(f"Error generating optimized insights: {e}")
            return []
    
    def _batch_items(self, items: List, batch_size: int) -> List[List]:
        """Split items into batches for parallel processing"""
        return [items[i:i + batch_size] for i in range(0, len(items), batch_size)]
    
    async def _process_optimization_batch(self, items: List) -> List[SmartSuggestion]:
        """Process a batch of items for optimization"""
        try:
            # Use optimized database service
            suggestions = []
            
            for item in items:
                # Fast alternative lookup
                alternatives = await self.optimized_db.find_healthier_alternatives_optimized(
                    [item.get('name', '')],
                    item.get('nutrition', {}),
                    limit=2
                )
                
                for alt in alternatives[:1]:  # Limit to 1 per item for performance
                    suggestion = SmartSuggestion(
                        id=str(uuid.uuid4()),
                        suggestion_type=SuggestionType.OPTIMIZATION,
                        category=SuggestionCategory.FOOD_SWAP,
                        title=f"Swap for {alt['name']}",
                        description=f"Better nutritional choice",
                        reasoning="Database-analyzed improvement",
                        confidence_score=alt['confidence'],
                        priority_score=alt['score'],
                        suggested_item={"name": alt['name'], "barcode": alt['barcode']},
                        current_item={"name": item.get('name')},
                        nutritional_benefit={"calories": alt['calories']},
                        calorie_impact=alt.get('calories', 0),
                        planning_context=request.context_type
                    )
                    suggestions.append(suggestion)
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Error processing optimization batch: {e}")
            return []
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get comprehensive performance metrics"""
        return self.performance_monitor.get_metrics_summary()


# Singleton instance
smart_diet_engine_optimized = SmartDietEngineOptimized()