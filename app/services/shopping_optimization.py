# Task 11 related comment: Main shopping optimization service with multi-recipe ingredient consolidation
"""
Shopping Optimization Service - Multi-Recipe Ingredient Consolidation
Phase R.3 Task 11 - Smart Shopping Intelligence Implementation

Provides comprehensive shopping list optimization with ingredient consolidation,
unit conversion, and cost optimization across multiple recipes.
"""

import asyncio
import uuid
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import json
import logging
from difflib import SequenceMatcher
import re
from enum import Enum

from app.services.unit_conversion import UnitConversionEngine, UnitCategory, ConversionResult
from app.services.recipe_database import RecipeDatabaseService
from app.models.shopping import (
    ShoppingOptimization,
    IngredientConsolidation,
    ConsolidationResult,
    ShoppingOptimizationResponse
)

logger = logging.getLogger(__name__)


@dataclass
class RecipeIngredient:
    """Individual ingredient from a recipe"""
    recipe_id: str
    recipe_name: str
    ingredient_name: str
    quantity: float
    unit: str
    notes: Optional[str] = None


@dataclass
class IngredientGroup:
    """Group of similar ingredients that can be consolidated"""
    consolidated_name: str
    ingredients: List[RecipeIngredient] = field(default_factory=list)
    total_standard_quantity: float = 0.0
    standard_unit: str = ""
    category: UnitCategory = UnitCategory.UNKNOWN
    confidence: float = 0.0


@dataclass
class ConsolidatedIngredient:
    """Final consolidated ingredient result"""
    id: str
    name: str
    total_quantity: float
    unit: str
    source_recipes: List[Dict[str, Any]]
    category: UnitCategory
    estimated_cost: float = 0.0
    bulk_discount_available: bool = False


class StorageType(Enum):
    """Storage requirement categories"""
    PANTRY = "pantry"
    REFRIGERATED = "refrigerated"
    FROZEN = "frozen"


@dataclass
class BulkOpportunity:
    """Bulk buying opportunity with cost analysis"""
    ingredient_consolidation_id: str
    ingredient_name: str
    current_quantity: float
    current_unit: str
    recommended_bulk_quantity: float
    bulk_unit: str
    regular_cost_estimate: float
    bulk_cost_estimate: float
    savings_amount: float
    savings_percentage: float
    storage_type: StorageType
    perishability_days: int
    recommendation_confidence: float
    bulk_package_info: str


class IngredientMatcher:
    """
    Advanced ingredient matching algorithm for consolidation

    Features:
    - Fuzzy string matching
    - Synonym recognition
    - Brand name normalization
    - Category-based matching
    """

    def __init__(self):
        """Initialize ingredient matcher with synonym dictionaries"""
        self._init_synonyms()
        self._init_stop_words()

    def _init_synonyms(self):
        """Initialize ingredient synonym mappings"""
        # Task 11 related comment: Ingredient synonyms for intelligent consolidation matching
        self.INGREDIENT_SYNONYMS = {
            # Oils
            'olive_oil': ['extra_virgin_olive_oil', 'evoo', 'olive_oil_extra_virgin'],
            'vegetable_oil': ['canola_oil', 'sunflower_oil', 'safflower_oil'],
            'cooking_oil': ['vegetable_oil', 'canola_oil'],

            # Flours
            'flour': ['all_purpose_flour', 'plain_flour', 'white_flour'],
            'whole_wheat_flour': ['whole_grain_flour', 'wholemeal_flour'],

            # Sugars
            'sugar': ['granulated_sugar', 'white_sugar', 'caster_sugar'],
            'brown_sugar': ['light_brown_sugar', 'dark_brown_sugar'],

            # Dairy
            'milk': ['whole_milk', 'skim_milk', '2_milk'],
            'butter': ['unsalted_butter', 'salted_butter'],
            'cream': ['heavy_cream', 'whipping_cream', 'double_cream'],

            # Vegetables
            'onion': ['yellow_onion', 'white_onion', 'cooking_onion'],
            'tomato': ['fresh_tomato', 'ripe_tomato'],
            'garlic': ['fresh_garlic', 'garlic_cloves'],

            # Herbs and spices
            'salt': ['table_salt', 'sea_salt', 'kosher_salt'],
            'pepper': ['black_pepper', 'ground_black_pepper'],
            'parsley': ['fresh_parsley', 'flat_leaf_parsley', 'italian_parsley'],
            'basil': ['fresh_basil', 'sweet_basil'],

            # Proteins
            'chicken': ['chicken_breast', 'chicken_thigh', 'chicken_meat'],
            'beef': ['ground_beef', 'beef_mince', 'minced_beef'],

            # Grains and legumes
            'rice': ['white_rice', 'jasmine_rice', 'basmati_rice'],
            'beans': ['black_beans', 'kidney_beans', 'cannellini_beans'],
        }

    def _init_stop_words(self):
        """Initialize words to ignore during matching"""
        # Task 11 related comment: Stop words to ignore for better ingredient matching
        self.STOP_WORDS = {
            'fresh', 'dried', 'ground', 'whole', 'chopped', 'sliced', 'diced',
            'minced', 'crushed', 'grated', 'shredded', 'organic', 'natural',
            'raw', 'cooked', 'frozen', 'canned', 'jarred', 'bottled',
            'pure', 'premium', 'grade', 'a', 'quality',
            'brand', 'name', 'store', 'generic'
        }

    def normalize_ingredient_name(self, name: str) -> str:
        """
        Normalize ingredient name for matching

        Args:
            name: Raw ingredient name from recipe

        Returns:
            Normalized ingredient name
        """
        if not name:
            return ''

        # Convert to lowercase
        normalized = name.lower().strip()

        # Remove parenthetical information
        normalized = re.sub(r'\([^)]*\)', '', normalized)

        # Remove measurements and quantities if present
        normalized = re.sub(r'\b\d+(?:\.\d+)?\s*(?:cups?|tbsps?|tsps?|ozs?|lbs?|grams?|kgs?)\b', '', normalized)

        # Remove special characters and normalize spaces
        normalized = re.sub(r'[^\w\s]', ' ', normalized)
        normalized = re.sub(r'\s+', ' ', normalized.strip())

        # Remove stop words
        words = normalized.split()
        filtered_words = [word for word in words if word not in self.STOP_WORDS]

        # Join back and convert to underscore format
        result = '_'.join(filtered_words) if filtered_words else normalized.replace(' ', '_')

        return result

    def calculate_similarity(self, name1: str, name2: str) -> float:
        """
        Calculate similarity score between two ingredient names

        Args:
            name1: First ingredient name
            name2: Second ingredient name

        Returns:
            Similarity score from 0.0 to 1.0
        """
        # Normalize both names
        norm1 = self.normalize_ingredient_name(name1)
        norm2 = self.normalize_ingredient_name(name2)

        if not norm1 or not norm2:
            return 0.0

        # Exact match
        if norm1 == norm2:
            return 1.0

        # Check synonyms
        if self._are_synonyms(norm1, norm2):
            return 0.95

        # Fuzzy string matching
        fuzzy_score = SequenceMatcher(None, norm1, norm2).ratio()

        # Bonus for partial matches (one name contains the other)
        if norm1 in norm2 or norm2 in norm1:
            fuzzy_score = max(fuzzy_score, 0.8)

        # Word-level matching bonus
        words1 = set(norm1.split('_'))
        words2 = set(norm2.split('_'))
        word_overlap = len(words1.intersection(words2)) / max(len(words1.union(words2)), 1)

        # Combined score with weights
        final_score = 0.7 * fuzzy_score + 0.3 * word_overlap

        return min(final_score, 1.0)

    def _are_synonyms(self, name1: str, name2: str) -> bool:
        """
        Check if two normalized names are synonyms

        Args:
            name1: First normalized name
            name2: Second normalized name

        Returns:
            True if names are synonyms
        """
        # Check direct synonym mapping
        for base_ingredient, synonyms in self.INGREDIENT_SYNONYMS.items():
            if ((name1 == base_ingredient and name2 in synonyms) or
                (name2 == base_ingredient and name1 in synonyms) or
                (name1 in synonyms and name2 in synonyms)):
                return True

        return False

    def can_consolidate(self, ingredient1: RecipeIngredient, ingredient2: RecipeIngredient) -> Tuple[bool, float]:
        """
        Determine if two ingredients can be consolidated

        Args:
            ingredient1: First ingredient
            ingredient2: Second ingredient

        Returns:
            Tuple of (can_consolidate, confidence_score)
        """
        # Calculate name similarity
        similarity = self.calculate_similarity(ingredient1.ingredient_name, ingredient2.ingredient_name)

        # Check if units are compatible for consolidation
        unit_converter = UnitConversionEngine()
        units_compatible = unit_converter.can_consolidate_units(ingredient1.unit, ingredient2.unit)

        # Consolidation decision logic
        if similarity >= 0.9 and units_compatible:
            return True, similarity
        elif similarity >= 0.8 and units_compatible:
            return True, similarity * 0.9  # Slightly lower confidence
        elif similarity >= 0.7 and units_compatible:
            return True, similarity * 0.8  # Even lower confidence
        else:
            return False, 0.0


class IngredientConsolidator:
    """
    Core algorithm for multi-recipe ingredient consolidation

    Handles ingredient grouping, unit conversion, and quantity optimization
    """

    def __init__(self):
        """Initialize consolidator with conversion engine and matcher"""
        self.unit_converter = UnitConversionEngine()
        self.ingredient_matcher = IngredientMatcher()

    async def consolidate_ingredients(
        self,
        recipe_ingredients: List[RecipeIngredient]
    ) -> List[ConsolidatedIngredient]:
        """
        Main consolidation algorithm

        Args:
            recipe_ingredients: List of all ingredients from all recipes

        Returns:
            List of consolidated ingredients
        """
        # Task 11 related comment: Main ingredient consolidation algorithm workflow
        logger.info(f"Starting consolidation of {len(recipe_ingredients)} ingredients")

        # Step 1: Group similar ingredients
        ingredient_groups = self._group_similar_ingredients(recipe_ingredients)
        logger.info(f"Grouped ingredients into {len(ingredient_groups)} groups")

        # Step 2: Convert units and consolidate quantities
        consolidated_results = []
        for group in ingredient_groups:
            consolidated = await self._consolidate_group(group)
            if consolidated:
                consolidated_results.append(consolidated)

        # Step 3: Optimize final quantities
        optimized_results = self._optimize_quantities(consolidated_results)

        logger.info(f"Consolidation complete: {len(optimized_results)} final ingredients")
        return optimized_results

    def _group_similar_ingredients(
        self,
        ingredients: List[RecipeIngredient]
    ) -> List[IngredientGroup]:
        """
        Group similar ingredients that can be consolidated

        Args:
            ingredients: List of recipe ingredients

        Returns:
            List of ingredient groups
        """
        # Task 11 related comment: Group similar ingredients using matching algorithm
        groups: List[IngredientGroup] = []
        processed: Set[int] = set()

        for i, ingredient in enumerate(ingredients):
            if i in processed:
                continue

            # Create new group with this ingredient
            group = IngredientGroup(
                consolidated_name=ingredient.ingredient_name,
                ingredients=[ingredient]
            )

            # Find similar ingredients to add to this group
            for j, other_ingredient in enumerate(ingredients[i+1:], start=i+1):
                if j in processed:
                    continue

                can_consolidate, confidence = self.ingredient_matcher.can_consolidate(
                    ingredient, other_ingredient
                )

                if can_consolidate:
                    group.ingredients.append(other_ingredient)
                    processed.add(j)

            groups.append(group)
            processed.add(i)

        return groups

    async def _consolidate_group(self, group: IngredientGroup) -> Optional[ConsolidatedIngredient]:
        """
        Consolidate a group of similar ingredients

        Args:
            group: Group of similar ingredients

        Returns:
            Consolidated ingredient or None if consolidation fails
        """
        # Task 11 related comment: Consolidate ingredient group with unit conversion
        if not group.ingredients:
            return None

        if len(group.ingredients) == 1:
            ingredient = group.ingredients[0]
            category = self.unit_converter.get_unit_category(ingredient.unit)
            return ConsolidatedIngredient(
                id=str(uuid.uuid4()),
                name=ingredient.ingredient_name,
                total_quantity=ingredient.quantity,
                unit=ingredient.unit,
                source_recipes=[{
                    'recipe_id': ingredient.recipe_id,
                    'recipe_name': ingredient.recipe_name,
                    'original_quantity': ingredient.quantity,
                    'unit': ingredient.unit,
                    'original_unit': ingredient.unit,
                    'converted_quantity': ingredient.quantity,
                    'notes': ingredient.notes
                }],
                category=category
            )

        # Choose the best name for the consolidated ingredient
        consolidated_name = self._choose_best_name(group.ingredients)

        # Determine if we need density conversions (mixed categories)
        ingredient_categories = [
            self.unit_converter.get_unit_category(ingredient.unit)
            for ingredient in group.ingredients
        ]
        primary_category = next(
            (category for category in ingredient_categories if category != UnitCategory.UNKNOWN),
            UnitCategory.UNKNOWN
        )
        requires_density = any(
            category != primary_category and category != UnitCategory.UNKNOWN
            for category in ingredient_categories
        )

        # Convert all ingredients to standard units
        converted_ingredients = []
        total_standard_quantity = 0.0
        standard_unit = ""
        category = UnitCategory.UNKNOWN

        for ingredient in group.ingredients:
            conversion_result = self.unit_converter.convert_to_standard_unit(
                ingredient.quantity,
                ingredient.unit,
                ingredient.ingredient_name if requires_density else None
            )

            if conversion_result.confidence >= 0.5:  # Acceptable conversion confidence
                converted_ingredients.append((ingredient, conversion_result))
                total_standard_quantity += conversion_result.quantity

                # Use first successful conversion as reference
                if not standard_unit:
                    standard_unit = conversion_result.unit
                    category = conversion_result.category

        if not converted_ingredients:
            logger.warning(f"Failed to convert any ingredients in group: {consolidated_name}")
            return None

        # Create source recipe information
        source_recipes = []
        for ingredient, conversion_result in converted_ingredients:
            source_recipes.append({
                'recipe_id': ingredient.recipe_id,
                'recipe_name': ingredient.recipe_name,
                'original_quantity': ingredient.quantity,
                'unit': ingredient.unit,
                'original_unit': ingredient.unit,
                'converted_quantity': conversion_result.quantity,
                'notes': ingredient.notes
            })

        # Choose best display unit
        display_quantity, display_unit = self.unit_converter.get_best_display_unit(
            total_standard_quantity,
            standard_unit,
            category
        )

        return ConsolidatedIngredient(
            id=str(uuid.uuid4()),
            name=consolidated_name,
            total_quantity=display_quantity,
            unit=display_unit,
            source_recipes=source_recipes,
            category=category
        )

    def _choose_best_name(self, ingredients: List[RecipeIngredient]) -> str:
        """
        Choose the best name for consolidated ingredient

        Args:
            ingredients: List of ingredients in the group

        Returns:
            Best representative name
        """
        # Task 11 related comment: Choose most descriptive name for consolidated ingredient
        if len(ingredients) == 1:
            return ingredients[0].ingredient_name

        # Find the most common normalized name
        name_counts = {}
        for ingredient in ingredients:
            normalized = self.ingredient_matcher.normalize_ingredient_name(ingredient.ingredient_name)
            name_counts[normalized] = name_counts.get(normalized, 0) + 1

        # Get most common normalized name
        most_common_normalized = max(name_counts.keys(), key=lambda x: name_counts[x])

        # Find the original name that matches this normalized version
        for ingredient in ingredients:
            if self.ingredient_matcher.normalize_ingredient_name(ingredient.ingredient_name) == most_common_normalized:
                return ingredient.ingredient_name

        # Fallback to first ingredient name
        return ingredients[0].ingredient_name

    def _optimize_quantities(self, consolidated: List[ConsolidatedIngredient]) -> List[ConsolidatedIngredient]:
        """
        Optimize final quantities for practical shopping

        Args:
            consolidated: List of consolidated ingredients

        Returns:
            List with optimized quantities
        """
        # Task 11 related comment: Round quantities to practical shopping amounts
        for ingredient in consolidated:
            ingredient.total_quantity = self._round_to_practical_amount(
                ingredient.total_quantity,
                ingredient.unit
            )

        return consolidated

    def _round_to_practical_amount(self, quantity: float, unit: str) -> float:
        """
        Round quantity to practical shopping amount

        Args:
            quantity: Original quantity
            unit: Unit of measurement

        Returns:
            Rounded practical quantity
        """
        # Different rounding strategies based on unit and quantity
        if unit in ['piece', 'pieces', 'item', 'items']:
            # Count items - round to whole numbers
            return round(quantity)

        elif unit in ['cup', 'cups']:
            # Cups - round to common fractions
            if quantity < 0.25:
                return 0.25
            elif quantity < 0.5:
                return 0.5
            elif quantity < 1:
                return round(quantity * 4) / 4  # Quarter increments
            else:
                return round(quantity * 2) / 2   # Half increments

        elif unit in ['tablespoon', 'tablespoons', 'tbsp']:
            # Tablespoons - round to practical amounts
            if quantity < 1:
                return round(quantity * 2) / 2   # Half increments
            else:
                return round(quantity)

        elif unit in ['teaspoon', 'teaspoons', 'tsp']:
            # Teaspoons - round to quarters
            return round(quantity * 4) / 4

        elif unit in ['g', 'gram', 'grams']:
            # Grams - round based on amount
            if quantity < 10:
                return round(quantity)
            elif quantity < 100:
                return round(quantity / 5) * 5    # Round to 5g increments
            else:
                return round(quantity / 10) * 10  # Round to 10g increments

        elif unit in ['kg', 'kilogram', 'kilograms']:
            # Kilograms - round to practical amounts
            if quantity < 1:
                return round(quantity * 4) / 4    # Quarter kg increments
            else:
                return round(quantity * 2) / 2    # Half kg increments

        elif unit in ['oz', 'ounce', 'ounces']:
            # Ounces - round to practical amounts
            if quantity < 1:
                return round(quantity * 4) / 4
            else:
                return round(quantity * 2) / 2

        elif unit in ['lb', 'lbs', 'pound', 'pounds']:
            # Pounds - round to practical amounts
            return round(quantity * 4) / 4

        elif unit in ['ml', 'milliliter', 'milliliters']:
            # Milliliters - round based on amount
            if quantity < 100:
                return round(quantity / 5) * 5    # 5ml increments
            else:
                return round(quantity / 10) * 10  # 10ml increments

        elif unit in ['liter', 'liters', 'l']:
            # Liters - round to practical amounts
            return round(quantity * 4) / 4

        else:
            # Default: round to 2 decimal places
            return round(quantity, 2)


class BulkBuyingDetector:
    """
    Optimized bulk buying detection system for cost optimization

    Features simplified pricing analysis with proven bulk savings ratios
    and basic storage assessment for practical bulk buying recommendations
    """

    def __init__(self):
        """Initialize bulk detector with pricing and storage data"""
        # Task 12 related comment: Simplified bulk buying detection with static pricing ratios
        self._init_bulk_pricing_data()
        self._init_storage_requirements()

    def _init_bulk_pricing_data(self):
        """Initialize bulk pricing ratios based on real-world data"""
        # Bulk savings percentages from market research
        self.BULK_SAVINGS_RATIOS = {
            # Oils and liquid ingredients
            'olive_oil': 0.22,          # 22% bulk savings
            'vegetable_oil': 0.25,      # 25% bulk savings
            'oil': 0.23,                # 23% average savings

            # Dry goods and pantry staples
            'flour': 0.30,              # 30% bulk savings
            'sugar': 0.28,              # 28% bulk savings
            'rice': 0.35,               # 35% bulk savings
            'pasta': 0.20,              # 20% bulk savings

            # Spices and seasonings
            'salt': 0.40,               # 40% bulk savings
            'pepper': 0.35,             # 35% bulk savings
            'spices': 0.30,             # 30% average for spices

            # Nuts and proteins
            'nuts': 0.25,               # 25% bulk savings
            'chicken': 0.15,            # 15% bulk meat savings
            'beef': 0.12,               # 12% bulk meat savings

            # Default categories
            'pantry_default': 0.20,     # 20% default pantry savings
            'refrigerated_default': 0.12, # 12% default fresh savings
            'frozen_default': 0.18,     # 18% default frozen savings
            'global_default': 0.15      # 15% conservative default
        }

        # Minimum quantities for bulk opportunities (in standardized units)
        self.BULK_QUANTITY_THRESHOLDS = {
            'ml': 500,      # 500ml minimum for liquids
            'g': 500,       # 500g minimum for dry goods
            'piece': 5,     # 5 pieces minimum for count items
            'default': 3    # 3 units default threshold
        }

    def _init_storage_requirements(self):
        """Initialize storage requirements for common ingredients"""
        # Task 12 related comment: Storage requirements for bulk buying assessment
        self.STORAGE_DATA = {
            # Pantry items (long shelf life)
            'flour': {'type': StorageType.PANTRY, 'days': 365, 'risk': 'low'},
            'sugar': {'type': StorageType.PANTRY, 'days': 730, 'risk': 'low'},
            'salt': {'type': StorageType.PANTRY, 'days': 1825, 'risk': 'low'},
            'rice': {'type': StorageType.PANTRY, 'days': 730, 'risk': 'low'},
            'pasta': {'type': StorageType.PANTRY, 'days': 730, 'risk': 'low'},
            'oil': {'type': StorageType.PANTRY, 'days': 540, 'risk': 'low'},
            'olive_oil': {'type': StorageType.PANTRY, 'days': 540, 'risk': 'low'},
            'spices': {'type': StorageType.PANTRY, 'days': 365, 'risk': 'low'},

            # Refrigerated items (medium shelf life)
            'milk': {'type': StorageType.REFRIGERATED, 'days': 7, 'risk': 'high'},
            'cheese': {'type': StorageType.REFRIGERATED, 'days': 30, 'risk': 'medium'},
            'butter': {'type': StorageType.REFRIGERATED, 'days': 60, 'risk': 'medium'},
            'eggs': {'type': StorageType.REFRIGERATED, 'days': 28, 'risk': 'medium'},

            # Fresh produce (short shelf life)
            'onion': {'type': StorageType.PANTRY, 'days': 30, 'risk': 'medium'},
            'garlic': {'type': StorageType.PANTRY, 'days': 90, 'risk': 'low'},
            'tomato': {'type': StorageType.REFRIGERATED, 'days': 7, 'risk': 'high'},

            # Frozen items (long shelf life)
            'frozen_vegetables': {'type': StorageType.FROZEN, 'days': 365, 'risk': 'low'},
            'frozen_meat': {'type': StorageType.FROZEN, 'days': 180, 'risk': 'low'},

            # Default storage for unknown ingredients
            'default_pantry': {'type': StorageType.PANTRY, 'days': 180, 'risk': 'medium'},
            'default_fresh': {'type': StorageType.REFRIGERATED, 'days': 7, 'risk': 'high'}
        }

    def detect_bulk_opportunities(
        self,
        consolidated_ingredients: List[ConsolidatedIngredient]
    ) -> List[BulkOpportunity]:
        """
        Detect bulk buying opportunities in consolidated ingredients

        Args:
            consolidated_ingredients: List of consolidated ingredients from Task 11

        Returns:
            List of bulk buying opportunities with cost analysis
        """
        # Task 12 related comment: Main bulk opportunity detection algorithm
        bulk_opportunities = []

        for ingredient in consolidated_ingredients:
            opportunity = self._analyze_ingredient_for_bulk(ingredient)
            if opportunity:
                bulk_opportunities.append(opportunity)

        # Sort by savings percentage (highest first)
        bulk_opportunities.sort(key=lambda x: x.savings_percentage, reverse=True)

        return bulk_opportunities

    def _analyze_ingredient_for_bulk(self, ingredient: ConsolidatedIngredient) -> Optional[BulkOpportunity]:
        """
        Analyze single ingredient for bulk buying opportunity

        Args:
            ingredient: Consolidated ingredient to analyze

        Returns:
            BulkOpportunity if viable, None otherwise
        """
        # Check quantity threshold
        if not self._meets_bulk_threshold(ingredient.total_quantity, ingredient.unit):
            return None

        # Get bulk savings ratio
        savings_ratio = self._get_bulk_savings_ratio(ingredient.name)

        # Storage requirements
        storage_data = self._get_storage_requirements(ingredient.name)

        # Calculate bulk opportunity
        return self._calculate_bulk_opportunity(ingredient, savings_ratio, storage_data)

    def _meets_bulk_threshold(self, quantity: float, unit: str) -> bool:
        """Check if quantity meets bulk buying threshold"""
        # Task 12 related comment: Check bulk quantity thresholds
        threshold = self.BULK_QUANTITY_THRESHOLDS.get(unit, self.BULK_QUANTITY_THRESHOLDS['default'])
        return quantity >= threshold

    def _get_bulk_savings_ratio(self, ingredient_name: str) -> float:
        """Get bulk savings ratio for ingredient"""
        # Task 12 related comment: Get bulk savings ratio using ingredient matching
        ingredient_lower = ingredient_name.lower()

        # Direct match
        if ingredient_lower in self.BULK_SAVINGS_RATIOS:
            return self.BULK_SAVINGS_RATIOS[ingredient_lower]

        # Partial matching for ingredient categories
        for key, ratio in self.BULK_SAVINGS_RATIOS.items():
            if key in ingredient_lower or ingredient_lower in key:
                return ratio

        # Category defaults based on common ingredients
        if any(word in ingredient_lower for word in ['oil', 'vinegar']):
            return self.BULK_SAVINGS_RATIOS['oil']
        elif any(word in ingredient_lower for word in ['flour', 'sugar', 'rice', 'pasta']):
            return self.BULK_SAVINGS_RATIOS['pantry_default']
        elif any(word in ingredient_lower for word in ['milk', 'cheese', 'butter']):
            return self.BULK_SAVINGS_RATIOS['refrigerated_default']
        elif any(word in ingredient_lower for word in ['frozen']):
            return self.BULK_SAVINGS_RATIOS['frozen_default']
        else:
            return self.BULK_SAVINGS_RATIOS['global_default']

    def _get_storage_requirements(self, ingredient_name: str) -> Dict[str, Any]:
        """Get storage requirements for ingredient"""
        # Task 12 related comment: Get storage requirements using ingredient matching
        ingredient_lower = ingredient_name.lower()

        # Direct match
        if ingredient_lower in self.STORAGE_DATA:
            return self.STORAGE_DATA[ingredient_lower]

        # Partial matching
        for key, data in self.STORAGE_DATA.items():
            if key in ingredient_lower:
                return data

        # Category-based defaults
        if any(word in ingredient_lower for word in ['milk', 'cream', 'cheese', 'butter', 'egg']):
            return self.STORAGE_DATA['default_fresh']
        else:
            return self.STORAGE_DATA['default_pantry']

    def _calculate_bulk_opportunity(
        self,
        ingredient: ConsolidatedIngredient,
        savings_ratio: float,
        storage_data: Dict[str, Any]
    ) -> BulkOpportunity:
        """Calculate detailed bulk opportunity analysis"""
        # Task 12 related comment: Calculate bulk opportunity with cost-benefit analysis

        # Estimate regular cost (simplified pricing model)
        regular_unit_cost = self._estimate_unit_cost(ingredient.name, ingredient.unit, bulk=False)
        regular_total_cost = ingredient.total_quantity * regular_unit_cost

        # Calculate bulk pricing
        bulk_quantity = self._calculate_optimal_bulk_quantity(ingredient.total_quantity, ingredient.unit)
        bulk_unit_cost = regular_unit_cost * (1 - savings_ratio)
        bulk_total_cost = bulk_quantity * bulk_unit_cost

        # Calculate savings
        savings_amount = regular_total_cost - (ingredient.total_quantity * bulk_unit_cost)
        savings_percentage = savings_ratio * 100

        # Recommendation confidence based on savings and storage
        confidence = self._calculate_confidence_score(savings_ratio, storage_data, bulk_quantity - ingredient.total_quantity)

        return BulkOpportunity(
            ingredient_consolidation_id=ingredient.id,
            ingredient_name=ingredient.name,
            current_quantity=ingredient.total_quantity,
            current_unit=ingredient.unit,
            recommended_bulk_quantity=bulk_quantity,
            bulk_unit=ingredient.unit,
            regular_cost_estimate=regular_total_cost,
            bulk_cost_estimate=bulk_total_cost,
            savings_amount=savings_amount,
            savings_percentage=savings_percentage,
            storage_type=StorageType(storage_data['type'].value),
            perishability_days=storage_data['days'],
            recommendation_confidence=confidence,
            bulk_package_info=self._generate_bulk_package_info(ingredient.name, bulk_quantity, ingredient.unit)
        )

    def _estimate_unit_cost(self, ingredient_name: str, unit: str, bulk: bool = False) -> float:
        """Estimate unit cost for ingredient (simplified pricing model)"""
        # Task 12 related comment: Simplified unit cost estimation for development

        # Basic cost estimates per unit (in USD)
        base_costs = {
            'ml': 0.01,      # $0.01 per ml for liquids
            'g': 0.005,      # $0.005 per gram for dry goods
            'piece': 0.50,   # $0.50 per piece for count items
            'cup': 1.00,     # $1.00 per cup average
            'tablespoon': 0.15, # $0.15 per tablespoon
            'teaspoon': 0.05,   # $0.05 per teaspoon
        }

        # Ingredient-specific cost multipliers
        ingredient_multipliers = {
            'olive_oil': 2.0,   # Premium oil
            'truffle_oil': 10.0, # Luxury ingredient
            'saffron': 50.0,    # Expensive spice
            'vanilla': 5.0,     # Expensive extract
            'meat': 3.0,        # Higher protein cost
            'fish': 4.0,        # Premium protein
            'cheese': 2.5,      # Dairy premium
        }

        base_cost = base_costs.get(unit, 0.10)  # Default $0.10 per unit

        # Apply ingredient-specific multipliers
        multiplier = 1.0
        ingredient_lower = ingredient_name.lower()
        for key, mult in ingredient_multipliers.items():
            if key in ingredient_lower:
                multiplier = mult
                break

        return base_cost * multiplier

    def _calculate_optimal_bulk_quantity(self, current_quantity: float, unit: str) -> float:
        """Calculate optimal bulk purchase quantity"""
        # Task 12 related comment: Calculate optimal bulk quantity for cost efficiency

        # Bulk size multipliers by unit type
        bulk_multipliers = {
            'ml': 2.0,       # Double for liquids
            'g': 2.5,        # 2.5x for dry goods
            'piece': 2.0,    # Double for count items
            'cup': 2.0,      # Double for volume
        }

        multiplier = bulk_multipliers.get(unit, 2.0)  # Default double
        bulk_quantity = current_quantity * multiplier

        # Round to practical bulk sizes
        return self._round_to_bulk_size(bulk_quantity, unit)

    def _round_to_bulk_size(self, quantity: float, unit: str) -> float:
        """Round quantity to practical bulk package sizes"""
        # Task 12 related comment: Round to realistic bulk package sizes

        if unit == 'ml':
            # Round to common liquid bulk sizes
            if quantity <= 1000:
                return 1000
            elif quantity <= 2000:
                return 2000
            else:
                return round(quantity / 1000) * 1000  # Round to nearest liter

        elif unit == 'g':
            # Round to common weight bulk sizes
            if quantity <= 1000:
                return 1000
            elif quantity <= 2500:
                return 2500
            elif quantity <= 5000:
                return 5000
            else:
                return round(quantity / 1000) * 1000  # Round to nearest kg

        elif unit == 'piece':
            # Round to practical count bulk sizes
            if quantity <= 12:
                return 12
            elif quantity <= 24:
                return 24
            else:
                return round(quantity / 12) * 12  # Round to dozens

        else:
            # Default: round to 1.5x current quantity
            return round(quantity * 1.5, 1)

    def _calculate_confidence_score(
        self,
        savings_ratio: float,
        storage_data: Dict[str, Any],
        excess_quantity: float
    ) -> float:
        """Calculate recommendation confidence score"""
        # Task 12 related comment: Calculate bulk buying recommendation confidence

        # Base confidence from savings percentage
        savings_score = min(savings_ratio / 0.30, 1.0)  # Max at 30% savings

        # Storage feasibility score
        risk_scores = {'low': 1.0, 'medium': 0.7, 'high': 0.3}
        storage_score = risk_scores.get(storage_data['risk'], 0.5)

        # Excess quantity penalty (less confidence for much larger quantities)
        if excess_quantity > 0:
            excess_penalty = max(0.5, 1.0 - (excess_quantity / 1000))  # Penalty for large excess
        else:
            excess_penalty = 1.0

        # Weighted confidence score
        confidence = (savings_score * 0.5) + (storage_score * 0.3) + (excess_penalty * 0.2)

        return min(max(confidence, 0.1), 1.0)  # Clamp between 0.1 and 1.0

    def _generate_bulk_package_info(self, ingredient_name: str, bulk_quantity: float, unit: str) -> str:
        """Generate descriptive bulk package information"""
        # Task 12 related comment: Generate user-friendly bulk package descriptions

        if unit == 'ml':
            if bulk_quantity >= 1000:
                liters = bulk_quantity / 1000
                return f"{liters:.1f}L container"
            else:
                return f"{bulk_quantity:.0f}ml bottle"

        elif unit == 'g':
            if bulk_quantity >= 1000:
                kg = bulk_quantity / 1000
                return f"{kg:.1f}kg bag"
            else:
                return f"{bulk_quantity:.0f}g package"

        elif unit == 'piece':
            if bulk_quantity >= 24:
                return f"Case of {bulk_quantity:.0f}"
            elif bulk_quantity >= 12:
                return f"Pack of {bulk_quantity:.0f}"
            else:
                return f"{bulk_quantity:.0f} pieces"

        else:
            return f"Bulk {bulk_quantity:.1f} {unit}"


class ShoppingOptimizationService:
    """
    Main service for shopping list optimization and consolidation

    Uses Command Pattern to orchestrate ingredient consolidation,
    bulk analysis, and cost calculation. Maintains backward compatibility
    while delegating to specialized command handlers.

    Task: Phase 2 Tarea 6 - Shopping Optimization Refactoring
    """

    def __init__(self, db_service: RecipeDatabaseService):
        """
        Initialize shopping optimization service with command pattern

        Args:
            db_service: Database service for storing optimization results
        """
        from app.services.shopping import (
            ConsolidationCommand,
            BulkAnalysisCommand,
            CostCalculationCommand
        )

        self.db_service = db_service
        self.consolidator = IngredientConsolidator()  # For legacy compatibility
        self.unit_converter = UnitConversionEngine()  # For legacy compatibility

        # Command pattern handlers (Task 6 refactoring)
        self.consolidation_cmd = ConsolidationCommand()
        self.bulk_analysis_cmd = BulkAnalysisCommand()
        self.cost_calc_cmd = CostCalculationCommand()

    async def optimize_shopping_list(
        self,
        recipe_ids: List[str],
        user_id: str,
        preferred_store_id: Optional[str] = None,
        optimization_name: Optional[str] = None
    ) -> ShoppingOptimizationResponse:
        """
        Generate optimized shopping list from multiple recipes

        Orchestrates ingredient consolidation, bulk analysis, and cost calculation
        using Command Pattern with shared OptimizationContext.

        Args:
            recipe_ids: List of recipe IDs to include
            user_id: User requesting optimization
            preferred_store_id: Optional preferred store
            optimization_name: Optional name for the optimization

        Returns:
            Complete shopping optimization response

        Task: Phase 2 Tarea 6 - Shopping Optimization Refactoring
        """
        logger.info(f"Starting shopping optimization for user {user_id} with {len(recipe_ids)} recipes")

        try:
            # Step 1: Retrieve recipe data
            recipes_data = await self._get_recipes_data(recipe_ids)
            if not recipes_data:
                raise ValueError("No valid recipes found")

            # Step 2: Initialize shared context for command chain
            from app.services.shopping import OptimizationContext
            context = OptimizationContext(recipes_data, user_id)

            # Step 3: Execute command pipeline (Task 6 refactoring)
            await self.consolidation_cmd.execute(context)
            if context.has_errors():
                logger.warning(f"Consolidation errors: {context.errors}")

            await self.bulk_analysis_cmd.execute(context)
            if context.has_errors():
                logger.warning(f"Bulk analysis errors: {context.errors}")

            await self.cost_calc_cmd.execute(context)
            if context.has_errors():
                logger.warning(f"Cost calculation errors: {context.errors}")

            logger.info(
                f"Optimization pipeline complete: "
                f"{len(context.consolidated_ingredients)} consolidated, "
                f"{len(context.bulk_opportunities)} bulk opportunities"
            )

            # Step 4: Store optimization in database
            optimization_data = {
                'optimization_name': optimization_name or f"Shopping List {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                'recipe_ids': recipe_ids,
                'total_unique_ingredients': len(context.consolidated_ingredients),
                'consolidation_opportunities': context.metrics.get('consolidation', {}).get('input_ingredients', 0) - len(context.consolidated_ingredients),
                'estimated_total_cost': context.total_cost,
                'preferred_store_id': preferred_store_id,
                'optimization_status': 'optimized',
                'optimization_score': context.optimization_score
            }

            optimization_id = await self.db_service.create_shopping_optimization(optimization_data, user_id)
            logger.info(f"Created shopping optimization: {optimization_id}")

            # Step 5: Store consolidated ingredients and bulk opportunities
            response = await self._store_optimization_results(
                optimization_id, context, recipe_ids, optimization_name or optimization_data['optimization_name']
            )

            logger.info(f"Shopping optimization completed successfully: {optimization_id}")
            return response

        except Exception as e:
            logger.error(f"Shopping optimization failed: {str(e)}")
            raise

    async def _store_optimization_results(
        self,
        optimization_id: str,
        context: "OptimizationContext",
        recipe_ids: List[str],
        optimization_name: str
    ) -> ShoppingOptimizationResponse:
        """
        Store optimization results in database and build response

        Args:
            optimization_id: ID of created optimization
            context: Populated OptimizationContext from commands
            recipe_ids: Original recipe IDs
            optimization_name: Name of optimization

        Returns:
            ShoppingOptimizationResponse with all results
        """
        from app.models.shopping import BulkBuyingSuggestion, SuggestionType, StorageRequirement, PerishabilityRisk

        # Store consolidated ingredients
        ingredient_consolidation_ids = []
        for ingredient in context.consolidated_ingredients:
            consolidation_data = {
                'consolidated_ingredient_name': ingredient.name,
                'source_recipes': ingredient.sources,
                'total_consolidated_quantity': ingredient.quantity,
                'final_unit': ingredient.unit,
                'unit_cost': 0.0,  # Task 6 refactoring uses context-based cost
                'total_cost': 0.0,
                'bulk_discount_available': False
            }

            consolidation_id = await self.db_service.create_ingredient_consolidation(
                optimization_id, consolidation_data
            )
            ingredient_consolidation_ids.append(consolidation_id)

        # Store bulk buying opportunities
        ingredient_to_consolidation_id = {
            ingredient.name: consolidation_id
            for ingredient, consolidation_id in zip(context.consolidated_ingredients, ingredient_consolidation_ids)
        }

        for opportunity in context.bulk_opportunities:
            consolidation_id = ingredient_to_consolidation_id.get(opportunity.ingredient_name)

            bulk_data = {
                'ingredient_consolidation_id': consolidation_id,
                'suggestion_type': 'bulk_discount',
                'current_needed_quantity': opportunity.standard_quantity,
                'suggested_bulk_quantity': opportunity.bulk_quantity,
                'bulk_unit': opportunity.bulk_unit,
                'regular_unit_price': opportunity.standard_unit_cost,
                'bulk_unit_price': opportunity.bulk_unit_cost,
                'immediate_savings': opportunity.standard_quantity * opportunity.standard_unit_cost - opportunity.bulk_quantity * opportunity.bulk_unit_cost,
                'cost_per_unit_savings': (opportunity.standard_unit_cost - opportunity.bulk_unit_cost),
                'storage_requirements': opportunity.storage_requirements.get('type', 'pantry'),
                'estimated_usage_timeframe_days': opportunity.storage_requirements.get('shelf_life_days', 30),
                'perishability_risk': 'low' if opportunity.storage_requirements.get('shelf_life_days', 30) > 30 else 'high',
                'recommendation_score': opportunity.confidence_score,
                'user_preference_match': 0.7
            }

            await self.db_service.create_bulk_buying_suggestion(optimization_id, bulk_data)

        # Retrieve bulk suggestions for response
        bulk_suggestions_data = await self.db_service.get_bulk_buying_suggestions(optimization_id)
        bulk_suggestions = []
        for suggestion in bulk_suggestions_data:
            bulk_suggestions.append(BulkBuyingSuggestion(
                id=suggestion['id'],
                shopping_optimization_id=suggestion['shopping_optimization_id'],
                ingredient_consolidation_id=suggestion['ingredient_consolidation_id'],
                suggestion_type=SuggestionType(suggestion['suggestion_type']),
                current_needed_quantity=suggestion['current_needed_quantity'],
                suggested_bulk_quantity=suggestion['suggested_bulk_quantity'],
                bulk_unit=suggestion['bulk_unit'],
                regular_unit_price=suggestion['regular_unit_price'],
                bulk_unit_price=suggestion['bulk_unit_price'],
                immediate_savings=suggestion['immediate_savings'],
                cost_per_unit_savings=suggestion['cost_per_unit_savings'],
                storage_requirements=StorageRequirement(suggestion['storage_requirements']),
                estimated_usage_timeframe_days=suggestion['estimated_usage_timeframe_days'],
                perishability_risk=PerishabilityRisk(suggestion['perishability_risk']),
                recommendation_score=suggestion['recommendation_score'],
                user_preference_match=suggestion['user_preference_match'],
                created_at=suggestion['created_at']
            ))

        # Build consolidated ingredient models
        consolidated_models = []
        for ingredient in context.consolidated_ingredients:
            consolidated_models.append(
                IngredientConsolidation(
                    id='',  # Will be populated from database
                    shopping_optimization_id=optimization_id,
                    consolidated_ingredient_name=ingredient.name,
                    source_recipes=[{'recipe_id': rid, 'recipe_name': rid, 'original_quantity': 0.0, 'unit': ingredient.unit} for rid in ingredient.sources],
                    total_consolidated_quantity=ingredient.quantity,
                    final_unit=ingredient.unit,
                    total_cost=0.0,
                    bulk_discount_available=any(opp.ingredient_name == ingredient.name for opp in context.bulk_opportunities)
                )
            )

        # Build response with command metrics
        optimization_metrics = context.metrics.get('cost_analysis', {})
        optimization_metrics.update({
            'total_original_ingredients': context.metrics.get('consolidation', {}).get('input_ingredients', 0),
            'total_consolidated_ingredients': len(context.consolidated_ingredients),
            'consolidation_opportunities': context.metrics.get('consolidation', {}).get('input_ingredients', 0) - len(context.consolidated_ingredients),
            'optimization_score': context.optimization_score
        })

        response = ShoppingOptimizationResponse(
            optimization_id=optimization_id,
            optimization_name=optimization_name,
            recipe_ids=recipe_ids,
            consolidated_ingredients=consolidated_models,
            optimization_metrics=optimization_metrics,
            bulk_suggestions=bulk_suggestions,
            shopping_path=[],
            estimated_total_cost=context.total_cost,
            estimated_savings=context.estimated_savings,
            created_at=datetime.now()
        )

        return response

    async def _get_recipes_data(self, recipe_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Retrieve recipe data from database

        Args:
            recipe_ids: List of recipe IDs

        Returns:
            List of recipe data dictionaries
        """
        # Task 11 related comment: Retrieve recipe data for ingredient extraction
        recipes_data = []

        for recipe_id in recipe_ids:
            recipe = await self.db_service.get_recipe_by_id(recipe_id)
            if recipe:
                recipes_data.append(recipe)
            else:
                logger.warning(f"Recipe not found: {recipe_id}")

        return recipes_data

    def _extract_all_ingredients(self, recipes_data: List[Dict[str, Any]]) -> List[RecipeIngredient]:
        """
        Extract all ingredients from recipe data

        Args:
            recipes_data: List of recipe dictionaries

        Returns:
            List of RecipeIngredient objects
        """
        # Task 11 related comment: Extract ingredients from all recipes for consolidation
        all_ingredients = []

        for recipe in recipes_data:
            recipe_id = recipe.get('id', '')
            recipe_name = recipe.get('name', 'Unknown Recipe')

            # Parse ingredients from recipe data
            ingredients = recipe.get('ingredients', [])
            if isinstance(ingredients, str):
                try:
                    ingredients = json.loads(ingredients)
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse ingredients for recipe {recipe_id}")
                    continue

            for ingredient_data in ingredients:
                if isinstance(ingredient_data, dict):
                    ingredient = RecipeIngredient(
                        recipe_id=recipe_id,
                        recipe_name=recipe_name,
                        ingredient_name=ingredient_data.get('ingredient', ''),
                        quantity=float(ingredient_data.get('quantity', 0)),
                        unit=ingredient_data.get('unit', 'piece'),
                        notes=ingredient_data.get('notes')
                    )
                    if ingredient.ingredient_name and ingredient.quantity > 0:
                        all_ingredients.append(ingredient)

        return all_ingredients

    def _calculate_optimization_metrics(
        self,
        original_ingredients: List[RecipeIngredient],
        consolidated_ingredients: List[ConsolidatedIngredient]
    ) -> Dict[str, Any]:
        """
        Calculate optimization performance metrics

        Args:
            original_ingredients: Original ingredient list
            consolidated_ingredients: Consolidated ingredient list

        Returns:
            Dictionary of optimization metrics
        """
        # Task 11 related comment: Calculate optimization performance metrics
        total_original = len(original_ingredients)
        total_consolidated = len(consolidated_ingredients)
        consolidation_opportunities = total_original - total_consolidated

        # Calculate consolidation efficiency score
        efficiency_score = consolidation_opportunities / max(total_original, 1)

        # Estimate total cost (placeholder - would integrate with pricing data)
        estimated_cost = sum(ingredient.estimated_cost for ingredient in consolidated_ingredients)

        # Calculate overall optimization score
        optimization_score = min(0.5 + (efficiency_score * 0.5), 1.0)

        return {
            'total_original_ingredients': total_original,
            'total_consolidated_ingredients': total_consolidated,
            'consolidation_opportunities': consolidation_opportunities,
            'efficiency_score': efficiency_score,
            'estimated_cost': estimated_cost,
            'optimization_score': optimization_score,
            'ingredients_reduced_percent': (consolidation_opportunities / max(total_original, 1)) * 100
        }

    async def get_shopping_optimization(
        self,
        optimization_id: str,
        user_id: Optional[str] = None
    ) -> Optional[ShoppingOptimizationResponse]:
        """
        Retrieve existing shopping optimization

        Args:
            optimization_id: ID of optimization to retrieve
            user_id: Optional user ID for ownership check

        Returns:
            Shopping optimization response or None if not found
        """
        # Task 11 related comment: Retrieve stored shopping optimization
        optimization_data = await self.db_service.get_shopping_optimization(optimization_id, user_id)

        if not optimization_data:
            return None

        # Convert database result to response format
        return ShoppingOptimizationResponse(
            optimization_id=optimization_id,
            optimization_name=optimization_data['optimization_name'],
            recipe_ids=json.loads(optimization_data.get('recipe_ids', '[]')),
            consolidated_ingredients=optimization_data.get('consolidations', []),
            optimization_metrics=optimization_data.get('metrics', {}),
            created_at=optimization_data.get('created_at')
        )
