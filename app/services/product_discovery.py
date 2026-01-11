"""
Product Discovery Service for Smart Recommendations
Provides dynamic, database-driven product sourcing with intelligent fallbacks
"""

import logging
import asyncio
import random
from typing import List, Dict, Optional, Set, Tuple
from datetime import datetime, timedelta
from collections import defaultdict

from app.models.product import ProductResponse, Nutriments
from app.services.database import db_service
from app.services.openfoodfacts import openfoodfacts_service
from app.services.cache import cache_service

logger = logging.getLogger(__name__)

FALLBACK_PRODUCT_DATA = [
    {
        "barcode": "0000000000001",
        "source": "Fallback",
        "name": "Banana",
        "brand": "DietIntel",
        "categories": "fruit",
        "serving_size": "120g",
        "image_url": None,
        "nutriments": {
            "energy_kcal_per_100g": 89.0,
            "protein_g_per_100g": 1.1,
            "fat_g_per_100g": 0.3,
            "carbs_g_per_100g": 22.8,
            "sugars_g_per_100g": 12.2,
            "salt_g_per_100g": 0.0,
        },
    },
    {
        "barcode": "0000000000002",
        "source": "Fallback",
        "name": "Plain Greek Yogurt",
        "brand": "DietIntel",
        "categories": "dairy",
        "serving_size": "170g",
        "image_url": None,
        "nutriments": {
            "energy_kcal_per_100g": 97.0,
            "protein_g_per_100g": 10.0,
            "fat_g_per_100g": 0.4,
            "carbs_g_per_100g": 3.6,
            "sugars_g_per_100g": 3.6,
            "salt_g_per_100g": 0.1,
        },
    },
    {
        "barcode": "0000000000003",
        "source": "Fallback",
        "name": "Brown Rice",
        "brand": "DietIntel",
        "categories": "grain",
        "serving_size": "100g",
        "image_url": None,
        "nutriments": {
            "energy_kcal_per_100g": 362.0,
            "protein_g_per_100g": 7.9,
            "fat_g_per_100g": 2.9,
            "carbs_g_per_100g": 72.9,
            "sugars_g_per_100g": 0.7,
            "salt_g_per_100g": 0.0,
        },
    },
]


class ProductDiscoveryService:
    """
    Intelligent product discovery service that replaces hardcoded mock data
    with dynamic database and API-driven product sourcing.
    """
    
    def __init__(self):
        self.category_cache = {}
        self.discovery_cache_ttl = 3600  # 1 hour cache for discoveries
        
        # Nutritional categories for targeted product discovery
        self.nutritional_categories = {
            'high_protein': {
                'min_protein_per_100g': 15.0,
                'keywords': ['protein', 'chicken', 'fish', 'eggs', 'beans', 'yogurt', 'cheese']
            },
            'low_calorie': {
                'max_calories_per_100g': 100.0,
                'keywords': ['salad', 'vegetables', 'fruit', 'lettuce', 'spinach', 'tomato']
            },
            'healthy_fats': {
                'min_fat_per_100g': 10.0,
                'keywords': ['avocado', 'nuts', 'olive oil', 'salmon', 'seeds']
            },
            'complex_carbs': {
                'min_carbs_per_100g': 60.0,
                'keywords': ['oats', 'quinoa', 'brown rice', 'whole grain', 'sweet potato']
            },
            'fiber_rich': {
                'keywords': ['beans', 'lentils', 'fiber', 'whole grain', 'vegetables']
            }
        }
    
    async def discover_products_for_recommendations(
        self,
        user_id: Optional[str] = None,
        dietary_restrictions: List[str] = None,
        cuisine_preferences: List[str] = None,
        max_products: int = 50
    ) -> List[ProductResponse]:
        """
        Discover products suitable for recommendations using multiple data sources.
        
        Args:
            user_id: User ID for personalized recommendations
            dietary_restrictions: User's dietary restrictions
            cuisine_preferences: User's cuisine preferences
            max_products: Maximum number of products to return
            
        Returns:
            List of ProductResponse objects for recommendation engine
        """
        logger.info(f"Discovering products for user {user_id}, max_products: {max_products}")
        
        try:
            products = []
            
            # 1. Load popular cached products first
            cached_products = await self._load_popular_cached_products(
                dietary_restrictions, max_products // 2
            )
            products.extend(cached_products)
            logger.info(f"Loaded {len(cached_products)} popular cached products")
            
            # 2. Load user interaction-based products
            if user_id:
                user_products = await self._load_user_preferred_products(
                    user_id, dietary_restrictions, max_products // 4
                )
                products.extend(user_products)
                logger.info(f"Loaded {len(user_products)} user-preferred products")
            
            # 3. Fill remaining slots with nutritionally diverse products
            remaining_slots = max_products - len(products)
            if remaining_slots > 0:
                diverse_products = await self._load_nutritionally_diverse_products(
                    dietary_restrictions, remaining_slots
                )
                products.extend(diverse_products)
                logger.info(f"Loaded {len(diverse_products)} nutritionally diverse products")
            
            # 4. If still not enough, use OpenFoodFacts API discovery
            if len(products) < max_products // 2:
                api_products = await self._discover_products_from_api(
                    dietary_restrictions, cuisine_preferences, max_products // 3
                )
                products.extend(api_products)
                logger.info(f"Loaded {len(api_products)} products from API")
            
            # Remove duplicates and limit results
            unique_products = self._deduplicate_products(products)
            final_products = unique_products[:max_products]
            
            logger.info(f"Discovered {len(final_products)} total products for recommendations")
            return final_products
            
        except Exception as e:
            logger.error(f"Error discovering products: {e}")
            return await self._get_emergency_fallback_products()
    
    async def discover_products_for_meal_planning(
        self,
        user_id: Optional[str] = None,
        dietary_restrictions: List[str] = None,
        optional_products: List[str] = None,
        max_products: int = 30
    ) -> List[ProductResponse]:
        """
        Discover products suitable for meal planning with focus on balanced nutrition.
        
        Args:
            user_id: User ID for personalized meal planning
            dietary_restrictions: User's dietary restrictions
            optional_products: Preferred product barcodes to prioritize
            max_products: Maximum number of products to return
            
        Returns:
            List of ProductResponse objects for meal planner
        """
        logger.info(f"Discovering products for meal planning, user: {user_id}")
        
        try:
            products = []
            
            # 1. Load optional products first if specified
            if optional_products:
                optional_products_data = await self._load_specific_products(optional_products)
                products.extend(optional_products_data)
                logger.info(f"Loaded {len(optional_products_data)} optional products")
            
            # 2. Load meal-appropriate cached products
            meal_products = await self._load_meal_appropriate_products(
                dietary_restrictions, max_products - len(products)
            )
            products.extend(meal_products)
            logger.info(f"Loaded {len(meal_products)} meal-appropriate products")
            
            # 3. Ensure nutritional balance across categories
            balanced_products = await self._ensure_nutritional_balance(
                products, dietary_restrictions, max_products
            )
            
            logger.info(f"Discovered {len(balanced_products)} balanced products for meal planning")
            return balanced_products
            
        except Exception as e:
            logger.error(f"Error discovering meal planning products: {e}")
            return await self._get_emergency_fallback_products()
    
    async def _load_popular_cached_products(
        self, 
        dietary_restrictions: Optional[List[str]] = None,
        limit: int = 25
    ) -> List[ProductResponse]:
        """Load most accessed products from database cache."""
        try:
            # Query database for most popular products
            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                
                # Get products ordered by access count and recent updates
                cursor.execute("""
                    SELECT * FROM products 
                    WHERE access_count > 0 
                    ORDER BY access_count DESC, last_updated DESC 
                    LIMIT ?
                """, (limit * 2,))  # Get extra to filter
                
                rows = cursor.fetchall()
                products = []
                
                for row in rows:
                    try:
                        product = await self._convert_db_row_to_product(row)
                        if product and self._meets_dietary_restrictions(product, dietary_restrictions):
                            products.append(product)
                            if len(products) >= limit:
                                break
                    except Exception as e:
                        logger.warning(f"Error converting product {row.get('barcode')}: {e}")
                
                return products
                
        except Exception as e:
            logger.error(f"Error loading popular cached products: {e}")
            return []
    
    async def _load_user_preferred_products(
        self, 
        user_id: str,
        dietary_restrictions: Optional[List[str]] = None,
        limit: int = 10
    ) -> List[ProductResponse]:
        """Load products based on user interaction history."""
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                
                # Get products user has interacted with positively
                cursor.execute("""
                    SELECT p.*, COUNT(h.id) as interaction_count
                    FROM products p
                    JOIN user_product_history h ON p.barcode = h.barcode
                    WHERE h.user_id = ? AND h.action IN ('viewed', 'added_to_meal', 'recommended_accepted')
                    GROUP BY p.barcode
                    ORDER BY interaction_count DESC, p.last_updated DESC
                    LIMIT ?
                """, (user_id, limit * 2))
                
                rows = cursor.fetchall()
                products = []
                
                for row in rows:
                    try:
                        product = await self._convert_db_row_to_product(row)
                        if product and self._meets_dietary_restrictions(product, dietary_restrictions):
                            products.append(product)
                            if len(products) >= limit:
                                break
                    except Exception as e:
                        logger.warning(f"Error converting user product {row.get('barcode')}: {e}")
                
                return products
                
        except Exception as e:
            logger.error(f"Error loading user preferred products: {e}")
            return []
    
    async def _load_nutritionally_diverse_products(
        self,
        dietary_restrictions: Optional[List[str]] = None,
        limit: int = 15
    ) -> List[ProductResponse]:
        """Load products to ensure nutritional diversity."""
        try:
            products = []
            products_per_category = max(1, limit // len(self.nutritional_categories))
            
            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                
                for category, criteria in self.nutritional_categories.items():
                    try:
                        # Build query based on category criteria
                        conditions = []
                        params = []
                        
                        # Add keyword-based filtering
                        if 'keywords' in criteria:
                            keyword_conditions = []
                            for keyword in criteria['keywords']:
                                keyword_conditions.append("(LOWER(p.name) LIKE ? OR LOWER(p.categories) LIKE ?)")
                                params.extend([f"%{keyword.lower()}%", f"%{keyword.lower()}%"])
                            conditions.append(f"({' OR '.join(keyword_conditions)})")
                        
                        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
                        params.append(products_per_category * 2)  # Get extra for filtering
                        
                        cursor.execute(f"""
                            SELECT * FROM products p
                            {where_clause}
                            ORDER BY p.access_count DESC, RANDOM()
                            LIMIT ?
                        """, params)
                        
                        rows = cursor.fetchall()
                        
                        for row in rows:
                            try:
                                product = await self._convert_db_row_to_product(row)
                                if (product and 
                                    self._meets_dietary_restrictions(product, dietary_restrictions) and
                                    self._meets_nutritional_criteria(product, criteria)):
                                    products.append(product)
                                    if len([p for p in products if self._categorize_product(p) == category]) >= products_per_category:
                                        break
                            except Exception as e:
                                logger.warning(f"Error processing product {row.get('barcode')}: {e}")
                    
                    except Exception as e:
                        logger.warning(f"Error loading category {category}: {e}")
            
            return products[:limit]
            
        except Exception as e:
            logger.error(f"Error loading nutritionally diverse products: {e}")
            return []
    
    async def _load_specific_products(self, barcodes: List[str]) -> List[ProductResponse]:
        """Load specific products by barcode."""
        try:
            products = []
            
            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                
                for barcode in barcodes:
                    cursor.execute("SELECT * FROM products WHERE barcode = ?", (barcode,))
                    row = cursor.fetchone()
                    
                    if row:
                        try:
                            product = await self._convert_db_row_to_product(row)
                            if product:
                                products.append(product)
                        except Exception as e:
                            logger.warning(f"Error loading product {barcode}: {e}")
            
            return products
            
        except Exception as e:
            logger.error(f"Error loading specific products: {e}")
            return []
    
    async def _load_meal_appropriate_products(
        self,
        dietary_restrictions: Optional[List[str]] = None,
        limit: int = 20
    ) -> List[ProductResponse]:
        """Load products suitable for meal construction."""
        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                
                # Focus on products with complete nutritional profiles
                cursor.execute("""
                    SELECT * FROM products
                    WHERE json_extract(nutriments, '$.energy_kcal_per_100g') IS NOT NULL
                    AND json_extract(nutriments, '$.protein_g_per_100g') IS NOT NULL
                    AND json_extract(nutriments, '$.carbs_g_per_100g') IS NOT NULL
                    ORDER BY access_count DESC, RANDOM()
                    LIMIT ?
                """, (limit * 2,))
                
                rows = cursor.fetchall()
                products = []
                
                for row in rows:
                    try:
                        product = await self._convert_db_row_to_product(row)
                        if product and self._meets_dietary_restrictions(product, dietary_restrictions):
                            products.append(product)
                            if len(products) >= limit:
                                break
                    except Exception as e:
                        logger.warning(f"Error converting meal product {row.get('barcode')}: {e}")
                
                return products
                
        except Exception as e:
            logger.error(f"Error loading meal appropriate products: {e}")
            return []
    
    async def _discover_products_from_api(
        self,
        dietary_restrictions: Optional[List[str]] = None,
        cuisine_preferences: Optional[List[str]] = None,
        limit: int = 10
    ) -> List[ProductResponse]:
        """Discover new products using OpenFoodFacts API."""
        try:
            products = []
            
            # Use category-based search terms for discovery
            search_terms = []
            
            # Add dietary-friendly terms
            if dietary_restrictions:
                if 'vegetarian' in dietary_restrictions:
                    search_terms.extend(['vegetables', 'fruits', 'dairy'])
                if 'vegan' in dietary_restrictions:
                    search_terms.extend(['vegetables', 'fruits', 'plant-based'])
                if 'gluten-free' in dietary_restrictions:
                    search_terms.extend(['gluten-free', 'rice', 'quinoa'])
            
            # Add general healthy food categories
            search_terms.extend(['protein', 'whole grain', 'vegetables', 'fruits'])
            
            # Limit API calls to avoid rate limiting
            for term in search_terms[:3]:  # Only try top 3 terms
                try:
                    # This would require implementing category search in OpenFoodFacts service
                    # For now, we'll use a simplified approach
                    discovered = await self._search_openfoodfacts_category(term, limit // 3)
                    products.extend(discovered)
                except Exception as e:
                    logger.warning(f"Error searching category {term}: {e}")
            
            return products[:limit]
            
        except Exception as e:
            logger.error(f"Error discovering products from API: {e}")
            return []
    
    async def _search_openfoodfacts_category(self, category: str, limit: int) -> List[ProductResponse]:
        """Search OpenFoodFacts for products in a specific category."""
        # This is a placeholder for category-based search
        # In a full implementation, you would use OpenFoodFacts category API
        # For now, return empty list to avoid API calls during development
        return []
    
    async def _ensure_nutritional_balance(
        self,
        existing_products: List[ProductResponse],
        dietary_restrictions: Optional[List[str]] = None,
        target_count: int = 30
    ) -> List[ProductResponse]:
        """Ensure nutritional balance across product categories."""
        try:
            # Categorize existing products
            categorized = defaultdict(list)
            for product in existing_products:
                category = self._categorize_product(product)
                categorized[category].append(product)
            
            # Fill missing categories
            balanced_products = list(existing_products)
            needed_categories = set(self.nutritional_categories.keys()) - set(categorized.keys())
            
            for category in needed_categories:
                if len(balanced_products) >= target_count:
                    break
                
                # Load a few products from missing category
                category_products = await self._load_nutritionally_diverse_products(
                    dietary_restrictions, 2
                )
                
                # Filter for specific category
                for product in category_products:
                    if self._categorize_product(product) == category:
                        balanced_products.append(product)
                        break
            
            return balanced_products[:target_count]
            
        except Exception as e:
            logger.error(f"Error ensuring nutritional balance: {e}")
            return existing_products
    
    async def _convert_db_row_to_product(self, row) -> Optional[ProductResponse]:
        """Convert database row to ProductResponse object."""
        try:
            import json
            
            nutriments_data = json.loads(row['nutriments'])
            
            # Convert to Nutriments object
            nutriments = Nutriments(
                energy_kcal_per_100g=nutriments_data.get('energy_kcal_per_100g'),
                protein_g_per_100g=nutriments_data.get('protein_g_per_100g'),
                fat_g_per_100g=nutriments_data.get('fat_g_per_100g'),
                carbs_g_per_100g=nutriments_data.get('carbs_g_per_100g'),
                sugars_g_per_100g=nutriments_data.get('sugars_g_per_100g'),
                salt_g_per_100g=nutriments_data.get('salt_g_per_100g')
            )
            
            return ProductResponse(
                source=row['source'] or "Database",
                barcode=row['barcode'],
                name=row['name'],
                brand=row['brand'],
                image_url=row['image_url'],
                serving_size=row['serving_size'],
                nutriments=nutriments,
                fetched_at=datetime.fromisoformat(row['last_updated'])
            )
            
        except Exception as e:
            logger.error(f"Error converting database row to product: {e}")
            return None
    
    def _meets_dietary_restrictions(
        self, 
        product: ProductResponse, 
        restrictions: Optional[List[str]]
    ) -> bool:
        """Check if product meets dietary restrictions."""
        if not restrictions:
            return True
        
        product_name = (product.name or "").lower()
        brand_name = (product.brand or "").lower()
        
        for restriction in restrictions:
            restriction_lower = restriction.lower()
            
            if restriction_lower == "vegetarian":
                meat_keywords = ["chicken", "beef", "pork", "fish", "meat", "turkey", "lamb"]
                if any(keyword in product_name or keyword in brand_name for keyword in meat_keywords):
                    return False
            
            elif restriction_lower == "vegan":
                animal_keywords = [
                    "chicken", "beef", "pork", "fish", "meat", "milk", "cheese", 
                    "yogurt", "egg", "butter", "cream", "whey", "casein"
                ]
                if any(keyword in product_name or keyword in brand_name for keyword in animal_keywords):
                    return False
            
            elif restriction_lower == "gluten-free":
                gluten_keywords = ["wheat", "barley", "rye", "gluten", "flour", "bread", "pasta"]
                if any(keyword in product_name or keyword in brand_name for keyword in gluten_keywords):
                    return False
        
        return True
    
    def _meets_nutritional_criteria(self, product: ProductResponse, criteria: Dict) -> bool:
        """Check if product meets nutritional criteria for category."""
        if not product.nutriments:
            return False
        
        # Check minimum protein
        if 'min_protein_per_100g' in criteria:
            if not product.nutriments.protein_g_per_100g:
                return False
            if product.nutriments.protein_g_per_100g < criteria['min_protein_per_100g']:
                return False
        
        # Check maximum calories
        if 'max_calories_per_100g' in criteria:
            if not product.nutriments.energy_kcal_per_100g:
                return False
            if product.nutriments.energy_kcal_per_100g > criteria['max_calories_per_100g']:
                return False
        
        # Check minimum fat
        if 'min_fat_per_100g' in criteria:
            if not product.nutriments.fat_g_per_100g:
                return False
            if product.nutriments.fat_g_per_100g < criteria['min_fat_per_100g']:
                return False
        
        # Check minimum carbs
        if 'min_carbs_per_100g' in criteria:
            if not product.nutriments.carbs_g_per_100g:
                return False
            if product.nutriments.carbs_g_per_100g < criteria['min_carbs_per_100g']:
                return False
        
        return True
    
    def _categorize_product(self, product: ProductResponse) -> str:
        """Categorize product based on nutritional profile."""
        if not product.nutriments:
            return 'other'
        
        # Check protein content
        if (product.nutriments.protein_g_per_100g and 
            product.nutriments.protein_g_per_100g >= 15.0):
            return 'high_protein'
        
        # Check calorie density
        if (product.nutriments.energy_kcal_per_100g and 
            product.nutriments.energy_kcal_per_100g <= 100.0):
            return 'low_calorie'
        
        # Check fat content
        if (product.nutriments.fat_g_per_100g and 
            product.nutriments.fat_g_per_100g >= 10.0):
            return 'healthy_fats'
        
        # Check carbs content
        if (product.nutriments.carbs_g_per_100g and 
            product.nutriments.carbs_g_per_100g >= 60.0):
            return 'complex_carbs'
        
        # Default category
        return 'other'
    
    def _deduplicate_products(self, products: List[ProductResponse]) -> List[ProductResponse]:
        """Remove duplicate products by barcode."""
        seen_barcodes = set()
        unique_products = []
        
        for product in products:
            if product.barcode not in seen_barcodes:
                seen_barcodes.add(product.barcode)
                unique_products.append(product)
        
        return unique_products
    
    async def _get_emergency_fallback_products(self) -> List[ProductResponse]:
        """
        Emergency fallback when all other methods fail.
        Returns a minimal set of basic nutritious foods.
        """
        logger.warning("Using emergency fallback products from local OpenFoodFacts cache")

        try:
            with db_service.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT * FROM products
                    WHERE json_extract(nutriments, '$.energy_kcal_per_100g') IS NOT NULL
                    AND json_extract(nutriments, '$.protein_g_per_100g') IS NOT NULL
                    AND json_extract(nutriments, '$.fat_g_per_100g') IS NOT NULL
                    AND json_extract(nutriments, '$.carbs_g_per_100g') IS NOT NULL
                    ORDER BY access_count DESC, last_updated DESC
                    LIMIT 5
                    """
                )
                rows = cursor.fetchall()
                products: List[ProductResponse] = []
                for row in rows:
                    product = await self._convert_db_row_to_product(row)
                    if product:
                        products.append(product)
                return products
        except Exception as exc:
            logger.error(f"Emergency fallback failed: {exc}")
            return []


# Global service instance
product_discovery_service = ProductDiscoveryService()
