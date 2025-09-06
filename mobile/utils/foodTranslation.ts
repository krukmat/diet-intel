import i18n from '../i18n/config';
import { translationService } from '../services/translationService';

/**
 * Translates food names using external API with fallback to static i18n
 * Provides backward compatibility while migrating to dynamic translation
 */
export class FoodTranslationService {
  private static instance: FoodTranslationService;

  static getInstance(): FoodTranslationService {
    if (!FoodTranslationService.instance) {
      FoodTranslationService.instance = new FoodTranslationService();
    }
    return FoodTranslationService.instance;
  }

  /**
   * Main translation function for food names
   * Now uses external API with fallback to static i18n
   * @param foodName - The food name to translate
   * @param fallbackToOriginal - Whether to return original name if no translation found
   * @returns Promise resolving to translated food name or original if no translation exists
   */
  async translateFoodName(foodName: string, fallbackToOriginal: boolean = true): Promise<string> {
    if (!foodName || typeof foodName !== 'string') {
      return fallbackToOriginal ? (foodName || '') : '';
    }

    try {
      // Try external API translation first
      const apiTranslation = await translationService.translateFoodName(foodName);
      
      // If API translation succeeded and is different from original, use it
      if (apiTranslation && apiTranslation !== foodName) {
        return apiTranslation;
      }
      
      // Fallback to legacy static translation method
      return this.translateFoodNameLegacy(foodName, fallbackToOriginal);
      
    } catch (error) {
      console.warn(`API translation failed for "${foodName}":`, error);
      // Fallback to legacy static translation method
      return this.translateFoodNameLegacy(foodName, fallbackToOriginal);
    }
  }

  /**
   * Legacy translation method using static i18n files
   * Kept as fallback for offline mode or API failures
   */
  translateFoodNameLegacy(foodName: string, fallbackToOriginal: boolean = true): string {
    if (!foodName || typeof foodName !== 'string') {
      return fallbackToOriginal ? (foodName || '') : '';
    }

    const normalizedName = this.normalizeFoodName(foodName);
    
    // Try exact match first
    const exactTranslation = this.getExactTranslation(normalizedName);
    if (exactTranslation) {
      return exactTranslation;
    }

    // Try partial match
    const partialTranslation = this.getPartialTranslation(normalizedName);
    if (partialTranslation) {
      return partialTranslation;
    }

    // Try category-based translation
    const categoryTranslation = this.getCategoryTranslation(normalizedName);
    if (categoryTranslation) {
      return categoryTranslation;
    }

    // Return original name if fallback enabled, empty string otherwise
    return fallbackToOriginal ? foodName : '';
  }

  /**
   * Normalizes food name for consistent matching
   * @param foodName - Raw food name
   * @returns Normalized food name
   */
  private normalizeFoodName(foodName: string): string {
    return foodName
      .trim()
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Gets exact translation match from i18n
   * @param normalizedName - Normalized food name
   * @returns Exact translation or null
   */
  private getExactTranslation(normalizedName: string): string | null {
    // Try direct lookup with normalized name
    const directKey = `foods.${normalizedName}`;
    const directTranslation = i18n.t(directKey);
    if (directTranslation !== directKey) {
      return directTranslation;
    }

    // Try legacy plan.foods namespace with exact legacy key mapping
    const legacyKey = this.getLegacyPlanFoodsKey(normalizedName);
    if (legacyKey) {
      const planKey = `plan.foods.${legacyKey}`;
      const planTranslation = i18n.t(planKey);
      if (planTranslation !== planKey) {
        return planTranslation;
      }
    }

    return null;
  }

  /**
   * Maps normalized food names to their exact legacy plan.foods keys
   * @param normalizedName - Normalized food name
   * @returns Legacy key or null
   */
  private getLegacyPlanFoodsKey(normalizedName: string): string | null {
    const legacyMapping: Record<string, string> = {
      'oatmeal': 'Oatmeal',
      'chicken breast': 'Chicken Breast',
      'almonds': 'Almonds',
      'banana': 'Banana',
      'brown rice': 'Brown Rice',
      'salmon': 'Salmon',
      'eggs': 'Eggs',
      'greek yogurt': 'Greek Yogurt',
      'spinach': 'Spinach',
      'broccoli': 'Broccoli',
      'sweet potato': 'Sweet Potato',
      'quinoa': 'Quinoa',
      'avocado': 'Avocado',
      'olive oil': 'Olive Oil',
      'tuna': 'Tuna',
      'lentils': 'Lentils',
      'beans': 'Beans',
      'nuts': 'Nuts',
      'cheese': 'Cheese',
      'milk': 'Milk',
      'baby spinach': 'Baby Spinach',
      'fiber': 'Fiber',
      'protein intake': 'Protein Intake'
    };

    return legacyMapping[normalizedName] || null;
  }

  /**
   * Attempts partial matching for compound food names
   * @param normalizedName - Normalized food name
   * @returns Partial match translation or null
   */
  private getPartialTranslation(normalizedName: string): string | null {
    const words = normalizedName.split(' ');
    
    // Try each word individually for compound foods
    for (const word of words) {
      if (word.length > 2) { // Skip short words like "de", "of"
        const wordTranslation = this.getExactTranslation(word);
        if (wordTranslation) {
          // Return partial translation with context
          return wordTranslation;
        }
      }
    }

    return null;
  }

  /**
   * Attempts category-based translation for common food types
   * @param normalizedName - Normalized food name
   * @returns Category-based translation or null
   */
  private getCategoryTranslation(normalizedName: string): string | null {
    const categories = {
      // Fruits
      fruit: ['apple', 'banana', 'orange', 'strawberry', 'grape', 'pineapple'],
      // Vegetables
      vegetable: ['carrot', 'broccoli', 'spinach', 'lettuce', 'tomato', 'potato'],
      // Proteins
      protein: ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'eggs'],
      // Grains
      grain: ['rice', 'bread', 'pasta', 'oats', 'quinoa', 'barley'],
      // Dairy
      dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream'],
    };

    for (const [category, items] of Object.entries(categories)) {
      if (items.some(item => normalizedName.includes(item))) {
        const categoryKey = `foods.categories.${category}`;
        const categoryTranslation = i18n.t(categoryKey);
        if (categoryTranslation !== categoryKey) {
          return categoryTranslation;
        }
      }
    }

    return null;
  }


  /**
   * Batch translate multiple food names
   * @param foodNames - Array of food names to translate
   * @returns Promise resolving to array of translated food names
   */
  async translateFoodNames(foodNames: string[]): Promise<string[]> {
    if (!foodNames || foodNames.length === 0) {
      return [];
    }

    try {
      // Try batch API translation first
      const apiTranslations = await translationService.translateTexts(foodNames);
      
      // Convert to array format
      return foodNames.map(name => apiTranslations[name] || name);
      
    } catch (error) {
      console.warn('Batch API translation failed:', error);
      
      // Fallback to legacy individual translations
      const results: string[] = [];
      for (const name of foodNames) {
        results.push(this.translateFoodNameLegacy(name));
      }
      return results;
    }
  }

  /**
   * Check if a translation exists for a food name
   * @param foodName - Food name to check
   * @returns Promise resolving to true if translation exists
   */
  async hasTranslation(foodName: string): Promise<boolean> {
    const translation = await this.translateFoodName(foodName, false);
    return translation !== '' && translation !== foodName;
  }
}

// Export singleton instance and helper function
export const foodTranslation = FoodTranslationService.getInstance();

/**
 * Helper function for easy food name translation (async - uses API)
 * @param foodName - Food name to translate
 * @returns Promise resolving to translated food name
 */
export const translateFoodName = async (foodName: string): Promise<string> => {
  return await foodTranslation.translateFoodName(foodName);
};

/**
 * Async version of translateFoodName that waits for API translation
 * @param foodName - Food name to translate
 * @returns Promise resolving to translated food name
 */
export const translateFoodNameAsync = async (foodName: string): Promise<string> => {
  return await foodTranslation.translateFoodName(foodName);
};

/**
 * Helper function to translate multiple food names (async - uses API)
 * @param foodNames - Array of food names
 * @returns Promise resolving to array of translated food names
 */
export const translateFoodNames = async (foodNames: string[]): Promise<string[]> => {
  return await foodTranslation.translateFoodNames(foodNames);
};

/**
 * Async version of translateFoodNames that waits for API translation
 * @param foodNames - Array of food names
 * @returns Promise resolving to array of translated food names
 */
export const translateFoodNamesAsync = async (foodNames: string[]): Promise<string[]> => {
  return await foodTranslation.translateFoodNames(foodNames);
};