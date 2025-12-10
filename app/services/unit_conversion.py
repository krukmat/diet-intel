# Task 11 related comment: Comprehensive unit conversion engine for ingredient consolidation
"""
Unit Conversion Engine for Recipe Ingredient Consolidation
Phase R.3 Task 11 - Multi-recipe ingredient consolidation algorithm

Handles complex cooking unit conversions with ingredient-specific density calculations
Supports volume, weight, and count-based measurements with high accuracy
"""

from typing import Dict, Tuple, Optional, List
import re
from dataclasses import dataclass
from enum import Enum


class UnitCategory(Enum):
    VOLUME = "volume"
    WEIGHT = "weight"
    COUNT = "count"
    UNKNOWN = "unknown"


@dataclass
class ConversionResult:
    """Result of unit conversion operation"""
    quantity: float
    unit: str
    category: UnitCategory
    confidence: float  # 0.0 to 1.0 conversion confidence


class UnitConversionEngine:
    """
    Comprehensive cooking unit conversion system for ingredient consolidation

    Features:
    - Volume conversions (cups, ml, fl oz, etc.)
    - Weight conversions (grams, oz, lbs, etc.)
    - Count-based conversions (pieces, cloves, etc.)
    - Ingredient-specific density conversions
    - Smart unit selection for display
    """

    def __init__(self):
        """Initialize conversion engine with comprehensive conversion tables"""
        self._init_conversion_tables()
        self._init_ingredient_densities()
        self._init_unit_aliases()

    def _init_conversion_tables(self):
        """Initialize comprehensive unit conversion tables"""

        # Volume conversions - all to milliliters (ml) as base
        self.VOLUME_CONVERSIONS = {
            # Metric volume units
            'ml': 1.0,
            'milliliter': 1.0,
            'millilitre': 1.0,
            'liter': 1000.0,
            'litre': 1000.0,
            'l': 1000.0,

            # US volume units
            'cup': 236.588,
            'c': 236.588,
            'tablespoon': 14.787,
            'tbsp': 14.787,
            'tbs': 14.787,
            'teaspoon': 4.929,
            'tsp': 4.929,
            'fluid_ounce': 29.5735,
            'fl_oz': 29.5735,
            'floz': 29.5735,
            'pint': 473.176,
            'pt': 473.176,
            'quart': 946.353,
            'qt': 946.353,
            'gallon': 3785.41,
            'gal': 3785.41,

            # International variations
            'cup_metric': 250.0,
            'tablespoon_metric': 15.0,
            'teaspoon_metric': 5.0,
        }

        # Weight conversions - all to grams (g) as base
        self.WEIGHT_CONVERSIONS = {
            # Metric weight units
            'g': 1.0,
            'gram': 1.0,
            'grams': 1.0,
            'kg': 1000.0,
            'kilogram': 1000.0,
            'kilograms': 1000.0,
            'mg': 0.001,
            'milligram': 0.001,
            'milligrams': 0.001,

            # Imperial weight units
            'oz': 28.3495,
            'ounce': 28.3495,
            'ounces': 28.3495,
            'lb': 453.592,
            'lbs': 453.592,
            'pound': 453.592,
            'pounds': 453.592,

            # Specialty units
            'stone': 6350.29,  # UK unit
        }

        # Count-based units - normalized to "pieces"
        self.COUNT_CONVERSIONS = {
            'piece': 1.0,
            'pieces': 1.0,
            'item': 1.0,
            'items': 1.0,
            'whole': 1.0,
            'each': 1.0,

            # Food-specific counts
            'clove': 1.0,  # garlic cloves
            'cloves': 1.0,
            'slice': 1.0,
            'slices': 1.0,
            'head': 1.0,  # lettuce head, cabbage head
            'heads': 1.0,
            'bunch': 1.0,  # herbs, greens
            'bunches': 1.0,
            'stalk': 1.0,  # celery
            'stalks': 1.0,
            'sprig': 1.0,  # herbs
            'sprigs': 1.0,
            'leaf': 1.0,  # bay leaves
            'leaves': 1.0,

            # Container-based counts
            'can': 1.0,
            'cans': 1.0,
            'bottle': 1.0,
            'bottles': 1.0,
            'package': 1.0,
            'packages': 1.0,
            'container': 1.0,
            'containers': 1.0,
        }

    def _init_ingredient_densities(self):
        """
        Initialize ingredient-specific density conversions
        Format: ingredient_name -> {volume_unit: weight_in_grams}
        """
        # Task 11 related comment: Ingredient-specific density conversions for accurate volume-to-weight
        self.INGREDIENT_DENSITIES = {
            # Common baking ingredients
            'flour': {
                'cup': 120,
                'tablespoon': 7.5,
                'teaspoon': 2.5
            },
            'all_purpose_flour': {
                'cup': 120,
                'tablespoon': 7.5,
                'teaspoon': 2.5
            },
            'bread_flour': {
                'cup': 127,
                'tablespoon': 8,
                'teaspoon': 2.7
            },
            'cake_flour': {
                'cup': 115,
                'tablespoon': 7,
                'teaspoon': 2.4
            },

            # Sugars
            'sugar': {
                'cup': 200,
                'tablespoon': 12.5,
                'teaspoon': 4.2
            },
            'granulated_sugar': {
                'cup': 200,
                'tablespoon': 12.5,
                'teaspoon': 4.2
            },
            'brown_sugar': {
                'cup': 213,
                'tablespoon': 13.3,
                'teaspoon': 4.4
            },
            'powdered_sugar': {
                'cup': 120,
                'tablespoon': 7.5,
                'teaspoon': 2.5
            },

            # Liquids (water-based)
            'water': {
                'cup': 236.6,
                'tablespoon': 14.8,
                'teaspoon': 4.9
            },
            'milk': {
                'cup': 244,
                'tablespoon': 15.3,
                'teaspoon': 5.1
            },
            'cream': {
                'cup': 238,
                'tablespoon': 14.9,
                'teaspoon': 5.0
            },

            # Oils and fats
            'oil': {
                'cup': 218,
                'tablespoon': 13.6,
                'teaspoon': 4.5
            },
            'olive_oil': {
                'cup': 216,
                'tablespoon': 13.5,
                'teaspoon': 4.5
            },
            'vegetable_oil': {
                'cup': 218,
                'tablespoon': 13.6,
                'teaspoon': 4.5
            },
            'butter': {
                'cup': 227,
                'tablespoon': 14.2,
                'teaspoon': 4.7
            },

            # Common cooking ingredients
            'salt': {
                'cup': 288,
                'tablespoon': 18,
                'teaspoon': 6
            },
            'rice': {
                'cup': 185,
                'tablespoon': 11.6,
                'teaspoon': 3.9
            },
            'oats': {
                'cup': 81,
                'tablespoon': 5.1,
                'teaspoon': 1.7
            },
            'honey': {
                'cup': 336,
                'tablespoon': 21,
                'teaspoon': 7
            },

            # Nuts and seeds
            'nuts': {
                'cup': 120,
                'tablespoon': 7.5,
                'teaspoon': 2.5
            },
            'almonds': {
                'cup': 143,
                'tablespoon': 8.9,
                'teaspoon': 3.0
            },
            'walnuts': {
                'cup': 117,
                'tablespoon': 7.3,
                'teaspoon': 2.4
            },
        }

    def _init_unit_aliases(self):
        """Initialize unit name aliases and variations"""
        # Task 11 related comment: Handle common unit name variations and abbreviations
        self.UNIT_ALIASES = {
            # Volume aliases
            'cups': 'cup',
            'tablespoons': 'tablespoon',
            'teaspoons': 'teaspoon',
            'tbsps': 'tablespoon',
            'tsps': 'teaspoon',
            'fluid_ounces': 'fluid_ounce',
            'fl_ozs': 'fl_oz',
            'pints': 'pint',
            'quarts': 'quart',
            'gallons': 'gallon',
            'liters': 'liter',
            'litres': 'liter',
            'milliliters': 'ml',
            'millilitres': 'ml',

            # Weight aliases
            'grams': 'gram',
            'kilograms': 'kilogram',
            'ounces': 'ounce',
            'pounds': 'pound',
            'lbs': 'lb',
            'ozs': 'oz',

            # Count aliases
            'pcs': 'piece',
            'pc': 'piece',
        }

    def normalize_unit_name(self, unit: str) -> str:
        """
        Normalize unit name for consistent processing

        Args:
            unit: Raw unit string from recipe

        Returns:
            Normalized unit name
        """
        if not unit:
            return 'piece'

        # Clean and normalize
        unit = unit.lower().strip()
        unit = re.sub(r'[^\w]', '_', unit)  # Replace special chars with underscore
        unit = re.sub(r'_+', '_', unit)     # Collapse multiple underscores
        unit = unit.strip('_')              # Remove leading/trailing underscores

        # Apply aliases
        return self.UNIT_ALIASES.get(unit, unit)

    def get_unit_category(self, unit: str) -> UnitCategory:
        """
        Determine the category of a unit

        Args:
            unit: Normalized unit name

        Returns:
            UnitCategory enum value
        """
        unit = self.normalize_unit_name(unit)

        if unit in self.VOLUME_CONVERSIONS:
            return UnitCategory.VOLUME
        elif unit in self.WEIGHT_CONVERSIONS:
            return UnitCategory.WEIGHT
        elif unit in self.COUNT_CONVERSIONS:
            return UnitCategory.COUNT
        else:
            return UnitCategory.UNKNOWN

    def convert_to_standard_unit(
        self,
        quantity: float,
        from_unit: str,
        ingredient_name: Optional[str] = None
    ) -> ConversionResult:
        """
        Convert quantity to standard unit for the category

        Args:
            quantity: Amount to convert
            from_unit: Source unit
            ingredient_name: Ingredient name for density conversions

        Returns:
            ConversionResult with standardized quantity and unit
        """
        # Task 11 related comment: Convert ingredients to standard units for consolidation
        normalized_unit = self.normalize_unit_name(from_unit)
        category = self.get_unit_category(normalized_unit)

        if category == UnitCategory.VOLUME:
            if ingredient_name:
                density_result = self._convert_using_density(quantity, normalized_unit, ingredient_name)
                if density_result:
                    return density_result

            # Convert to milliliters
            if normalized_unit in self.VOLUME_CONVERSIONS:
                conversion_factor = self.VOLUME_CONVERSIONS[normalized_unit]
                standard_quantity = quantity * conversion_factor
                return ConversionResult(
                    quantity=standard_quantity,
                    unit='ml',
                    category=category,
                    confidence=1.0
                )

        elif category == UnitCategory.WEIGHT:
            # Convert to grams
            if normalized_unit in self.WEIGHT_CONVERSIONS:
                conversion_factor = self.WEIGHT_CONVERSIONS[normalized_unit]
                standard_quantity = quantity * conversion_factor
                return ConversionResult(
                    quantity=standard_quantity,
                    unit='g',
                    category=category,
                    confidence=1.0
                )

        elif category == UnitCategory.COUNT:
            # Convert to pieces
            if normalized_unit in self.COUNT_CONVERSIONS:
                conversion_factor = self.COUNT_CONVERSIONS[normalized_unit]
                standard_quantity = quantity * conversion_factor
                return ConversionResult(
                    quantity=standard_quantity,
                    unit='piece',
                    category=category,
                    confidence=1.0
                )

        # Return as-is if no conversion available
        return ConversionResult(
            quantity=quantity,
            unit=from_unit,
            category=UnitCategory.UNKNOWN,
            confidence=0.5
        )

    def _convert_using_density(
        self,
        quantity: float,
        unit: str,
        ingredient_name: str
    ) -> Optional[ConversionResult]:
        """
        Convert using ingredient-specific density data

        Args:
            quantity: Amount to convert
            unit: Volume unit
            ingredient_name: Ingredient for density lookup

        Returns:
            ConversionResult if density conversion available, None otherwise
        """
        # Task 11 related comment: Use ingredient densities for volume-to-weight conversions
        normalized_ingredient = self._normalize_ingredient_name(ingredient_name)

        if normalized_ingredient in self.INGREDIENT_DENSITIES:
            density_data = self.INGREDIENT_DENSITIES[normalized_ingredient]

            if unit in density_data:
                # Direct density conversion available
                weight_per_unit = density_data[unit]
                total_weight = quantity * weight_per_unit

                return ConversionResult(
                    quantity=total_weight,
                    unit='g',
                    category=UnitCategory.WEIGHT,
                    confidence=0.9
                )

            # Try to convert volume unit first, then apply density
            if unit in self.VOLUME_CONVERSIONS and 'cup' in density_data:
                # Convert to cups first, then to weight
                cups_quantity = (quantity * self.VOLUME_CONVERSIONS[unit]) / self.VOLUME_CONVERSIONS['cup']
                weight_per_cup = density_data['cup']
                total_weight = cups_quantity * weight_per_cup

                return ConversionResult(
                    quantity=total_weight,
                    unit='g',
                    category=UnitCategory.WEIGHT,
                    confidence=0.8
                )

        return None

    def _normalize_ingredient_name(self, ingredient_name: str) -> str:
        """
        Normalize ingredient name for density lookup

        Args:
            ingredient_name: Raw ingredient name

        Returns:
            Normalized ingredient name for density lookup
        """
        if not ingredient_name:
            return ''

        # Convert to lowercase and remove common words
        name = ingredient_name.lower().strip()

        # Remove common adjectives and brand indicators
        remove_words = ['fresh', 'dried', 'ground', 'whole', 'extra', 'virgin', 'organic', 'raw']
        for word in remove_words:
            name = re.sub(rf'\b{word}\b', '', name)

        # Clean up whitespace and special characters
        name = re.sub(r'[^\w\s]', ' ', name)
        name = re.sub(r'\s+', '_', name.strip())

        return name

    def get_best_display_unit(
        self,
        quantity: float,
        standard_unit: str,
        category: UnitCategory
    ) -> Tuple[float, str]:
        """
        Select the most natural unit for displaying the quantity

        Args:
            quantity: Amount in standard unit
            standard_unit: Current standard unit (ml, g, piece)
            category: Unit category

        Returns:
            Tuple of (display_quantity, display_unit)
        """
        # Task 11 related comment: Choose optimal display unit for shopping lists

        if category == UnitCategory.VOLUME and standard_unit == 'ml':
            # Volume display optimization
            if quantity >= 1000:
                return (quantity / 1000, 'liter')
            elif quantity >= 236:
                return (quantity / 236.588, 'cup')
            elif quantity >= 15:
                return (quantity / 14.787, 'tablespoon')
            elif quantity >= 5:
                return (quantity / 4.929, 'teaspoon')
            else:
                return (quantity, 'ml')

        elif category == UnitCategory.WEIGHT and standard_unit == 'g':
            # Weight display optimization
            if quantity >= 1000:
                return (quantity / 1000, 'kg')
            elif quantity >= 454:
                return (quantity / 453.592, 'lb')
            elif quantity >= 28:
                return (quantity / 28.3495, 'oz')
            else:
                return (quantity, 'g')

        elif category == UnitCategory.COUNT and standard_unit == 'piece':
            # Count display optimization
            if quantity == 1:
                return (quantity, 'piece')
            else:
                return (quantity, 'pieces')

        # Default: return as-is
        return (quantity, standard_unit)

    def can_consolidate_units(self, unit1: str, unit2: str) -> bool:
        """
        Check if two units can be consolidated (same category)

        Args:
            unit1: First unit name
            unit2: Second unit name

        Returns:
            True if units can be consolidated, False otherwise
        """
        category1 = self.get_unit_category(unit1)
        category2 = self.get_unit_category(unit2)

        return (category1 == category2 and
                category1 != UnitCategory.UNKNOWN and
                category2 != UnitCategory.UNKNOWN)

    def get_conversion_confidence(
        self,
        from_unit: str,
        to_unit: str,
        ingredient_name: Optional[str] = None
    ) -> float:
        """
        Get confidence score for a unit conversion

        Args:
            from_unit: Source unit
            to_unit: Target unit
            ingredient_name: Ingredient name for density conversions

        Returns:
            Confidence score from 0.0 to 1.0
        """
        from_category = self.get_unit_category(from_unit)
        to_category = self.get_unit_category(to_unit)

        # Same category conversions are high confidence
        if from_category == to_category and from_category != UnitCategory.UNKNOWN:
            return 1.0

        # Cross-category with ingredient density is medium-high confidence
        if ingredient_name and self._normalize_ingredient_name(ingredient_name) in self.INGREDIENT_DENSITIES:
            return 0.8

        # Different categories without density data is low confidence
        if from_category != to_category:
            return 0.3

        # Unknown units are low confidence
        return 0.2
