/**
 * Translation service for mobile app using external API
 * Replaces static i18n files with dynamic translation via backend API
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentLanguage } from '../i18n/config';
import { API_BASE_URL } from '../config/environment';

interface TranslationResponse {
  original_text: string;
  translated_text: string | null;
  source_lang: string;
  target_lang: string;
  success: boolean;
  cached?: boolean;
  error_message?: string;
}

interface BatchTranslationResponse {
  translations: Record<string, string | null>;
  source_lang: string;
  target_lang: string;
  total_count: number;
  successful_count: number;
  failed_count: number;
  cached_count?: number;
}

interface SupportedLanguagesResponse {
  languages: Record<string, string>;
  count: number;
}

export class TranslationService {
  private static instance: TranslationService;
  private baseUrl: string;
  private cachePrefix = '@dietintel_translation_';
  private cacheTTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  private requestTimeout = 10000; // 10 seconds
  private batchRequestTimeout = 20000; // 20 seconds
  
  // Fallback translations for offline mode
  private fallbackTranslations: Record<string, Record<string, string>> = {
    es: {
      // Common food terms
      'chicken breast': 'pechuga de pollo',
      'brown rice': 'arroz integral',
      'salmon': 'salmón',
      'eggs': 'huevos',
      'greek yogurt': 'yogur griego',
      'spinach': 'espinacas',
      'baby spinach': 'espinacas tiernas',
      'broccoli': 'brócoli',
      'sweet potato': 'batata',
      'quinoa': 'quinoa',
      'avocado': 'aguacate',
      'olive oil': 'aceite de oliva',
      'tuna': 'atún',
      'lentils': 'lentejas',
      'beans': 'frijoles',
      'nuts': 'nueces',
      'cheese': 'queso',
      'milk': 'leche',
      'banana': 'plátano',
      'oatmeal': 'avena',
      'almonds': 'almendras',
      'fiber': 'fibra',
      'protein intake': 'ingesta de proteínas',
      'whole grain bread': 'pan integral',
      'lean protein': 'proteína magra',
      'fresh fruit': 'fruta fresca',
      'vegetable': 'vegetal',
      'dairy': 'lácteos',
      'healthy fats': 'grasas saludables'
    }
  };

  private constructor() {
    // Use environment variable or default to host machine IP for Android emulator
    this.baseUrl = process.env.EXPO_PUBLIC_API_URL || API_BASE_URL;
  }

  static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  /**
   * Get cache key for a translation
   */
  private getCacheKey(text: string, sourceLang: string, targetLang: string): string {
    return `${this.cachePrefix}${sourceLang}_${targetLang}_${text.toLowerCase().trim()}`;
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    if (typeof AbortController === 'undefined') {
      return fetch(url, options);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get cached translation
   */
  private async getCachedTranslation(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
    try {
      const cacheKey = this.getCacheKey(text, sourceLang, targetLang);
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (cachedData) {
        const { translation, timestamp } = JSON.parse(cachedData);
        
        // Check if cache is still valid
        if (Date.now() - timestamp < this.cacheTTL) {
          return translation;
        } else {
          // Remove expired cache
          await AsyncStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.warn('Error reading translation cache:', error);
    }
    
    return null;
  }

  /**
   * Cache a translation
   */
  private async setCachedTranslation(text: string, sourceLang: string, targetLang: string, translation: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(text, sourceLang, targetLang);
      const cacheData = {
        translation,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Error caching translation:', error);
    }
  }

  /**
   * Get fallback translation from static mappings
   */
  private getFallbackTranslation(text: string, targetLang: string): string | null {
    const fallbackMap = this.fallbackTranslations[targetLang];
    if (!fallbackMap) return null;
    
    const normalizedText = text.toLowerCase().trim();
    return fallbackMap[normalizedText] || null;
  }

  /**
   * Translate a single text
   */
  async translateText(text: string, sourceLang?: string, targetLang?: string): Promise<string | null> {
    if (!text || !text.trim()) {
      return text;
    }

    const source = sourceLang || 'auto';
    const target = targetLang || getCurrentLanguage();

    // Return original if same language
    if (source === target) {
      return text;
    }

    try {
      // Check cache first
      const cachedTranslation = await this.getCachedTranslation(text, source, target);
      if (cachedTranslation) {
        return cachedTranslation;
      }

      // Make API request
      const response = await this.fetchWithTimeout(`${this.baseUrl}/translate/food`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          source_lang: source,
          target_lang: target,
        }),
      }, this.requestTimeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: TranslationResponse = await response.json();

      if (data.success && data.translated_text) {
        // Cache successful translation
        await this.setCachedTranslation(text, source, target, data.translated_text);
        return data.translated_text;
      }

      throw new Error(data.error_message || 'Translation failed');

    } catch (error) {
      console.debug(`Translation API failed for "${text}":`, error);

      // Try fallback translation
      const fallback = this.getFallbackTranslation(text, target);
      if (fallback) {
        console.log(`Using fallback translation: ${text} -> ${fallback}`);
        return fallback;
      }

      // Return original text as last resort
      console.log(`Returning original text: ${text}`);
      return text;
    }
  }

  /**
   * Translate a food name with food-specific optimizations
   */
  async translateFoodName(foodName: string, sourceLang?: string, targetLang?: string): Promise<string> {
    const translation = await this.translateText(foodName, sourceLang, targetLang);
    return translation || foodName;
  }

  /**
   * Batch translate multiple texts
   */
  async translateTexts(texts: string[], sourceLang?: string, targetLang?: string): Promise<Record<string, string>> {
    if (!texts || texts.length === 0) {
      return {};
    }

    const source = sourceLang || 'auto';
    const target = targetLang || getCurrentLanguage();
    const result: Record<string, string> = {};

    // Return original texts if same language
    if (source === target) {
      texts.forEach(text => {
        result[text] = text;
      });
      return result;
    }

    try {
      // Filter out empty texts
      const validTexts = texts.filter(text => text && text.trim());
      
      if (validTexts.length === 0) {
        return result;
      }

      // Check cache for each text first
      const uncachedTexts: string[] = [];
      
      for (const text of validTexts) {
        const cached = await this.getCachedTranslation(text, source, target);
        if (cached) {
          result[text] = cached;
        } else {
          uncachedTexts.push(text);
        }
      }

      // Translate uncached texts via API
      if (uncachedTexts.length > 0) {
        const response = await this.fetchWithTimeout(`${this.baseUrl}/translate/batch/foods`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            food_names: uncachedTexts,
            source_lang: source,
            target_lang: target,
          }),
        }, this.batchRequestTimeout);

        if (response.ok) {
          const data: BatchTranslationResponse = await response.json();
          
          // Process API translations
          for (const [originalText, translatedText] of Object.entries(data.translations)) {
            if (translatedText) {
              result[originalText] = translatedText;
              // Cache successful translation
              await this.setCachedTranslation(originalText, source, target, translatedText);
            } else {
              // Try fallback or use original
              const fallback = this.getFallbackTranslation(originalText, target);
              result[originalText] = fallback || originalText;
            }
          }
        } else {
          throw new Error(`Batch translation failed: ${response.status}`);
        }
      }

    } catch (error) {
      console.debug('Batch translation error:', error);

      // Fallback to individual translations for remaining texts
      const remainingTexts = texts.filter(text => !result[text]);
      
      for (const text of remainingTexts) {
        result[text] = await this.translateFoodName(text, source, target);
      }
    }

    return result;
  }

  /**
   * Get supported languages from API
   */
  async getSupportedLanguages(): Promise<Record<string, string> | null> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/translate/languages`,
        {},
        this.requestTimeout
      );

      if (response.ok) {
        const data: SupportedLanguagesResponse = await response.json();
        return data.languages;
      }

      throw new Error(`Failed to get languages: ${response.status}`);
    } catch (error) {
      console.debug('Error getting supported languages:', error);
      return null;
    }
  }

  /**
   * Check if translation service is available
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/translate/health`,
        {},
        5000
      );

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear translation cache
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const translationKeys = keys.filter(key => key.startsWith(this.cachePrefix));
      
      if (translationKeys.length > 0) {
        await AsyncStorage.multiRemove(translationKeys);
      }
    } catch (error) {
      console.debug('Error clearing translation cache:', error);
    }
  }
}

// Export singleton instance and helper functions
export const translationService = TranslationService.getInstance();

/**
 * Helper function to translate a food name
 */
export const translateFoodName = async (foodName: string, sourceLang?: string, targetLang?: string): Promise<string> => {
  return await translationService.translateFoodName(foodName, sourceLang, targetLang);
};

/**
 * Helper function to translate multiple food names
 */
export const translateFoodNames = async (foodNames: string[], sourceLang?: string, targetLang?: string): Promise<Record<string, string>> => {
  return await translationService.translateTexts(foodNames, sourceLang, targetLang);
};

export default translationService;
