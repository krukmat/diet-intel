"""
Translation service using deep-translator for food name translations.
Provides multi-provider translation with caching and fallback mechanisms.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Tuple
import httpx
from deep_translator import GoogleTranslator, MicrosoftTranslator, YandexTranslator
from deep_translator.exceptions import TranslationNotFound, TooManyRequests, RequestError

from .cache import CacheService
from app.config import config

logger = logging.getLogger(__name__)


class TranslationService:
    """
    Service for translating food names using multiple translation providers.
    Implements caching, fallback mechanisms, and async operations.
    """
    
    # Supported language codes
    SUPPORTED_LANGUAGES = {
        'auto': 'Auto Detect',
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese'
    }
    
    # Translation providers in order of preference
    TRANSLATION_PROVIDERS = [
        GoogleTranslator,
        MicrosoftTranslator,
        YandexTranslator
    ]
    
    def __init__(self, cache_service: CacheService):
        self.cache = cache_service
        self._translation_cache_ttl = 7 * 24 * 60 * 60  # 7 days in seconds
        self.libretranslate_url = config.libretranslate_url.rstrip('/') if config.libretranslate_url else None
        self.libretranslate_api_key = config.libretranslate_api_key

    def _get_cache_key(self, text: str, source_lang: str, target_lang: str) -> str:
        """Generate cache key for translation."""
        return f"translation:{source_lang}:{target_lang}:{text.lower().strip()}"
    
    async def translate_text(
        self, 
        text: str, 
        source_lang: str = 'en', 
        target_lang: str = 'es'
    ) -> Optional[str]:
        """
        Translate a single text using multiple providers with caching.
        
        Args:
            text: Text to translate
            source_lang: Source language code
            target_lang: Target language code
            
        Returns:
            Translated text or None if translation fails
        """
        if not text or not text.strip():
            return text
            
        # Normalize input
        text = text.strip()
        
        # Return original if same language
        if source_lang == target_lang:
            return text
            
        # Validate language codes
        if source_lang not in self.SUPPORTED_LANGUAGES:
            logger.warning(f"Unsupported source language: {source_lang}")
            return None
            
        if target_lang not in self.SUPPORTED_LANGUAGES:
            logger.warning(f"Unsupported target language: {target_lang}")
            return None
        
        # Check cache first
        cache_key = self._get_cache_key(text, source_lang, target_lang)
        cached_translation = await self.cache.get(cache_key)
        if cached_translation:
            logger.debug(f"Cache hit for translation: {text} -> {cached_translation}")
            return cached_translation

        # Try LibreTranslate first if configured
        libre_translation = await self._translate_with_libretranslate(text, source_lang, target_lang)
        if libre_translation:
            await self.cache.set(cache_key, libre_translation, ttl=self._translation_cache_ttl)
            logger.info(f"Translated via LibreTranslate: {text[:50]}... -> {libre_translation[:50]}...")
            return libre_translation

        # Try translation providers in order
        translation = await self._translate_with_providers(text, source_lang, target_lang)
        
        if translation:
            # Cache successful translation
            await self.cache.set(cache_key, translation, ttl=self._translation_cache_ttl)
            logger.info(f"Successfully translated and cached: {text} -> {translation}")
            return translation
        
        logger.warning(f"Failed to translate text: {text}")
        return None

    async def _translate_with_providers(
        self, 
        text: str, 
        source_lang: str, 
        target_lang: str
    ) -> Optional[str]:
        """Try translation with multiple providers."""
        for provider_class in self.TRANSLATION_PROVIDERS:
            try:
                # Run translation in thread pool to avoid blocking
                translation = await asyncio.get_event_loop().run_in_executor(
                    None, 
                    self._translate_sync, 
                    provider_class, 
                    text, 
                    source_lang, 
                    target_lang
                )
                
                if translation and translation.strip():
                    logger.debug(f"Translation successful with {provider_class.__name__}")
                    return translation.strip()
                    
            except Exception as e:
                logger.warning(f"Translation failed with {provider_class.__name__}: {e}")
                continue
        
        return None

    async def _translate_with_libretranslate(
        self,
        text: str,
        source_lang: str,
        target_lang: str
    ) -> Optional[str]:
        """Attempt translation via LibreTranslate if configured."""

        if not self.libretranslate_url:
            return None

        payload = {
            "q": text,
            "source": source_lang,
            "target": target_lang,
            "format": "text"
        }

        if self.libretranslate_api_key:
            payload["api_key"] = self.libretranslate_api_key

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(f"{self.libretranslate_url}/translate", json=payload)
                response.raise_for_status()
                data = response.json()

                if isinstance(data, dict):
                    translation = data.get("translatedText") or data.get("translated_text")
                else:
                    translation = data

                if translation and translation.strip():
                    return translation.strip()

                logger.warning("LibreTranslate responded without translated text")
        except Exception as exc:
            logger.warning(f"LibreTranslate request failed: {exc}")

        return None

    async def libretranslate_health(self) -> str:
        """Return health status string for LibreTranslate endpoint."""

        if not self.libretranslate_url:
            return "disabled"

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.libretranslate_url}/languages")
                response.raise_for_status()
            return "available"
        except Exception as exc:
            logger.warning(f"LibreTranslate health probe failed: {exc}")
            return f"error: {exc}".split('\n')[0]
    
    def _translate_sync(
        self, 
        provider_class, 
        text: str, 
        source_lang: str, 
        target_lang: str
    ) -> Optional[str]:
        """Synchronous translation for running in thread pool."""
        try:
            translator = provider_class(source=source_lang, target=target_lang)
            return translator.translate(text)
            
        except (TranslationNotFound, TooManyRequests, RequestError) as e:
            logger.warning(f"Translation error with {provider_class.__name__}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error with {provider_class.__name__}: {e}")
            raise
    
    async def translate_food_name(
        self, 
        food_name: str, 
        source_lang: str = 'en', 
        target_lang: str = 'es'
    ) -> Optional[str]:
        """
        Translate a food name with food-specific optimizations.
        
        Args:
            food_name: Food name to translate
            source_lang: Source language code
            target_lang: Target language code
            
        Returns:
            Translated food name or None if translation fails
        """
        if not food_name or not food_name.strip():
            return food_name
        
        # Pre-process food name for better translation
        processed_name = self._preprocess_food_name(food_name)
        
        # Translate
        translation = await self.translate_text(processed_name, source_lang, target_lang)
        
        if translation:
            # Post-process translated food name
            return self._postprocess_food_name(translation, target_lang)
        
        return None
    
    async def translate_food_names(
        self, 
        food_names: List[str], 
        source_lang: str = 'en', 
        target_lang: str = 'es'
    ) -> Dict[str, Optional[str]]:
        """
        Batch translate multiple food names.
        
        Args:
            food_names: List of food names to translate
            source_lang: Source language code
            target_lang: Target language code
            
        Returns:
            Dictionary mapping original names to translated names
        """
        if not food_names:
            return {}
        
        # Create translation tasks
        tasks = [
            self.translate_food_name(name, source_lang, target_lang)
            for name in food_names
        ]
        
        # Execute translations concurrently
        translations = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Build result dictionary
        result = {}
        for i, name in enumerate(food_names):
            translation = translations[i]
            if isinstance(translation, Exception):
                logger.warning(f"Translation failed for {name}: {translation}")
                result[name] = None
            else:
                result[name] = translation
        
        return result
    
    def _preprocess_food_name(self, food_name: str) -> str:
        """Pre-process food name for better translation accuracy."""
        # Remove brand names in parentheses
        import re
        food_name = re.sub(r'\([^)]*\)', '', food_name).strip()
        
        # Remove common packaging terms
        packaging_terms = [
            'organic', 'natural', 'fresh', 'frozen', 'canned', 'dried',
            'raw', 'cooked', 'roasted', 'grilled', 'steamed', 'baked'
        ]
        
        words = food_name.split()
        filtered_words = [
            word for word in words 
            if word.lower() not in packaging_terms
        ]
        
        return ' '.join(filtered_words) if filtered_words else food_name
    
    def _postprocess_food_name(self, translated_name: str, target_lang: str) -> str:
        """Post-process translated food name for consistency."""
        # Capitalize first letter for consistency
        if translated_name:
            return translated_name.strip().capitalize()
        return translated_name
    
    def get_supported_languages(self) -> Dict[str, str]:
        """Get dictionary of supported language codes and names."""
        return self.SUPPORTED_LANGUAGES.copy()
    
    def is_language_supported(self, lang_code: str) -> bool:
        """Check if a language code is supported."""
        return lang_code in self.SUPPORTED_LANGUAGES


# Singleton instance
_translation_service: Optional[TranslationService] = None


def get_translation_service(cache_service: CacheService) -> TranslationService:
    """Get or create translation service instance."""
    global _translation_service
    if _translation_service is None:
        _translation_service = TranslationService(cache_service)
    return _translation_service
