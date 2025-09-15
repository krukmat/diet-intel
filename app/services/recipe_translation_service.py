"""
Recipe Translation Service for Spanish language support.
Integrates with existing translation service to provide recipe-specific translations.
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta

from .translation_service import get_translation_service, TranslationService
from .cache import get_cache_service
from ..models.recipe import (
    GeneratedRecipeResponse,
    RecipeIngredientResponse,
    RecipeInstructionResponse,
    RecipeNutritionResponse,
    RecipeTranslationResponse,
    BatchRecipeTranslationResponse,
    SpanishRecipeMetadata
)

logger = logging.getLogger(__name__)


class RecipeTranslationService:
    """Service for translating recipes to Spanish with specialized food terminology handling."""

    def __init__(self, translation_service: TranslationService = None, cache_service=None):
        self.translation_service = translation_service or get_translation_service(get_cache_service())
        self.cache_service = cache_service or get_cache_service()
        self.cache_ttl = 7 * 24 * 60 * 60  # 7 days for recipe translations

        # Spanish food terminology mappings for better translation accuracy
        self.food_terminology_es = {
            # Common cooking terms
            "olive oil": "aceite de oliva",
            "salt": "sal",
            "pepper": "pimienta",
            "garlic": "ajo",
            "onion": "cebolla",
            "tomato": "tomate",
            "chicken": "pollo",
            "beef": "carne de res",
            "pork": "cerdo",
            "fish": "pescado",
            "rice": "arroz",
            "pasta": "pasta",
            "cheese": "queso",
            "milk": "leche",
            "butter": "mantequilla",
            "flour": "harina",
            "sugar": "azúcar",
            "egg": "huevo",
            "bread": "pan",
            "water": "agua",

            # Cooking methods
            "bake": "hornear",
            "fry": "freír",
            "boil": "hervir",
            "grill": "asar a la parrilla",
            "sauté": "saltear",
            "roast": "asar",
            "steam": "cocinar al vapor",
            "simmer": "cocer a fuego lento",
            "marinate": "marinar",
            "season": "sazonar",
            "mix": "mezclar",
            "stir": "revolver",
            "chop": "picar",
            "dice": "cortar en cubitos",
            "slice": "rebanar",
            "mince": "picar finamente",

            # Measurements
            "cup": "taza",
            "tablespoon": "cucharada",
            "teaspoon": "cucharadita",
            "ounce": "onza",
            "pound": "libra",
            "gram": "gramo",
            "kilogram": "kilogramo",
            "liter": "litro",
            "milliliter": "mililitro",
            "pinch": "pizca",
        }

    def _get_cache_key(self, content: str, content_type: str) -> str:
        """Generate cache key for translated content."""
        import hashlib
        content_hash = hashlib.md5(content.encode()).hexdigest()
        return f"recipe_translation:es:{content_type}:{content_hash}"

    async def _translate_with_food_context(self, text: str, context_type: str = "general") -> Optional[str]:
        """Translate text with food-specific terminology handling."""
        if not text or not text.strip():
            return text

        # Check cache first
        cache_key = self._get_cache_key(text, context_type)
        try:
            cached_translation = await self.cache_service.get(cache_key)
            if cached_translation:
                logger.info(f"Found cached translation for {context_type}: {text[:50]}...")
                return cached_translation
        except Exception as e:
            logger.warning(f"Cache lookup failed: {e}")

        # Apply pre-translation food terminology improvements
        enhanced_text = text
        for en_term, es_term in self.food_terminology_es.items():
            enhanced_text = enhanced_text.replace(en_term, es_term)

        try:
            # Translate using the existing translation service
            translated = await self.translation_service.translate_text(
                text=enhanced_text,
                source_lang="en",
                target_lang="es"
            )

            if translated:
                # Cache the successful translation
                try:
                    await self.cache_service.set(cache_key, translated, self.cache_ttl)
                except Exception as e:
                    logger.warning(f"Cache storage failed: {e}")

                logger.info(f"Successfully translated {context_type}: {text[:50]}... -> {translated[:50]}...")
                return translated
            else:
                logger.error(f"Translation failed for {context_type}: {text[:50]}...")
                return text  # Return original if translation fails

        except Exception as e:
            logger.error(f"Translation error for {context_type}: {e}")
            return text  # Return original text on error

    async def translate_recipe_name(self, name: str) -> str:
        """Translate recipe name to Spanish."""
        return await self._translate_with_food_context(name, "recipe_name") or name

    async def translate_recipe_description(self, description: str) -> str:
        """Translate recipe description to Spanish."""
        return await self._translate_with_food_context(description, "description") or description

    async def translate_ingredient(self, ingredient: RecipeIngredientResponse) -> RecipeIngredientResponse:
        """Translate a single ingredient to Spanish."""
        translated_name = await self._translate_with_food_context(ingredient.name, "ingredient")
        translated_preparation = None

        if ingredient.preparation_note:
            translated_preparation = await self._translate_with_food_context(
                ingredient.preparation_note, "preparation"
            )

        return RecipeIngredientResponse(
            name=translated_name or ingredient.name,
            quantity=ingredient.quantity,
            unit=ingredient.unit,
            barcode=ingredient.barcode,
            calories_per_unit=ingredient.calories_per_unit,
            protein_g_per_unit=ingredient.protein_g_per_unit,
            fat_g_per_unit=ingredient.fat_g_per_unit,
            carbs_g_per_unit=ingredient.carbs_g_per_unit,
            is_optional=ingredient.is_optional,
            preparation_note=translated_preparation or ingredient.preparation_note
        )

    async def translate_instruction(self, instruction: RecipeInstructionResponse) -> RecipeInstructionResponse:
        """Translate a single cooking instruction to Spanish."""
        translated_instruction = await self._translate_with_food_context(
            instruction.instruction, "instruction"
        )

        translated_cooking_method = None
        if instruction.cooking_method:
            translated_cooking_method = await self._translate_with_food_context(
                instruction.cooking_method, "cooking_method"
            )

        return RecipeInstructionResponse(
            step_number=instruction.step_number,
            instruction=translated_instruction or instruction.instruction,
            cooking_method=translated_cooking_method or instruction.cooking_method,
            duration_minutes=instruction.duration_minutes,
            temperature_celsius=instruction.temperature_celsius
        )

    async def translate_recipe_tags(self, tags: List[str]) -> List[str]:
        """Translate recipe tags to Spanish."""
        translated_tags = []
        for tag in tags:
            translated_tag = await self._translate_with_food_context(tag, "tag")
            translated_tags.append(translated_tag or tag)
        return translated_tags

    async def translate_complete_recipe(self, recipe: GeneratedRecipeResponse) -> GeneratedRecipeResponse:
        """Translate a complete recipe to Spanish."""
        logger.info(f"Starting complete translation of recipe: {recipe.name}")

        try:
            # Translate basic recipe information
            translated_name = await self.translate_recipe_name(recipe.name)
            translated_description = await self.translate_recipe_description(recipe.description)

            # Translate ingredients in parallel for better performance
            translated_ingredients = []
            for ingredient in recipe.ingredients:
                translated_ingredient = await self.translate_ingredient(ingredient)
                translated_ingredients.append(translated_ingredient)

            # Translate instructions in parallel
            translated_instructions = []
            for instruction in recipe.instructions:
                translated_instruction = await self.translate_instruction(instruction)
                translated_instructions.append(translated_instruction)

            # Translate tags
            translated_tags = await self.translate_recipe_tags(recipe.tags)

            # Create translated recipe
            translated_recipe = GeneratedRecipeResponse(
                id=recipe.id,
                name=translated_name,
                description=translated_description,
                cuisine_type=recipe.cuisine_type,  # Keep original cuisine type
                difficulty_level=recipe.difficulty_level,
                prep_time_minutes=recipe.prep_time_minutes,
                cook_time_minutes=recipe.cook_time_minutes,
                servings=recipe.servings,
                ingredients=translated_ingredients,
                instructions=translated_instructions,
                nutrition=recipe.nutrition,  # Keep original nutrition data
                created_by=recipe.created_by,
                confidence_score=recipe.confidence_score,
                generation_time_ms=recipe.generation_time_ms,
                tags=translated_tags
            )

            logger.info(f"Successfully translated complete recipe: {recipe.name} -> {translated_name}")
            return translated_recipe

        except Exception as e:
            logger.error(f"Failed to translate complete recipe {recipe.name}: {e}")
            raise Exception(f"Recipe translation failed: {str(e)}")

    async def batch_translate_recipes(self, recipes: List[GeneratedRecipeResponse]) -> Dict[str, Optional[GeneratedRecipeResponse]]:
        """Translate multiple recipes to Spanish."""
        translations = {}

        for recipe in recipes:
            try:
                translated_recipe = await self.translate_complete_recipe(recipe)
                translations[recipe.id] = translated_recipe
            except Exception as e:
                logger.error(f"Failed to translate recipe {recipe.id}: {e}")
                translations[recipe.id] = None

        return translations

    def calculate_translation_quality_score(self, original_recipe: GeneratedRecipeResponse, translated_recipe: GeneratedRecipeResponse) -> float:
        """Calculate a quality score for the translation (0.0 to 1.0)."""
        score = 1.0

        # Check if essential fields were translated
        if translated_recipe.name == original_recipe.name:
            score -= 0.2  # Name wasn't translated
        if translated_recipe.description == original_recipe.description:
            score -= 0.2  # Description wasn't translated

        # Check ingredient translation success rate
        ingredients_translated = 0
        for orig_ing, trans_ing in zip(original_recipe.ingredients, translated_recipe.ingredients):
            if orig_ing.name != trans_ing.name:
                ingredients_translated += 1

        if original_recipe.ingredients:
            ingredient_score = ingredients_translated / len(original_recipe.ingredients)
            score *= (0.7 + 0.3 * ingredient_score)  # Weight ingredient translation

        return max(0.0, min(1.0, score))


# Service instance
_recipe_translation_service = None

def get_recipe_translation_service() -> RecipeTranslationService:
    """Get the recipe translation service instance."""
    global _recipe_translation_service
    if _recipe_translation_service is None:
        _recipe_translation_service = RecipeTranslationService()
    return _recipe_translation_service