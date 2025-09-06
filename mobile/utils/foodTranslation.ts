import i18n from '../i18n/config';

/**
 * Translates food names using the global i18n system
 * Provides fallback mechanisms and smart matching for food translations
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
   * @param foodName - The food name to translate
   * @param fallbackToOriginal - Whether to return original name if no translation found
   * @returns Translated food name or original if no translation exists
   */
  translateFoodName(foodName: string, fallbackToOriginal: boolean = true): string {
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
   * @returns Array of translated food names
   */
  translateFoodNames(foodNames: string[]): string[] {
    return foodNames.map(name => this.translateFoodName(name));
  }

  /**
   * Check if a translation exists for a food name
   * @param foodName - Food name to check
   * @returns True if translation exists
   */
  hasTranslation(foodName: string): boolean {
    return this.translateFoodName(foodName, false) !== '';
  }
}

// Export singleton instance and helper function
export const foodTranslation = FoodTranslationService.getInstance();

/**
 * Helper function for easy food name translation
 * @param foodName - Food name to translate
 * @returns Translated food name
 */
export const translateFoodName = (foodName: string): string => {
  return foodTranslation.translateFoodName(foodName);
};

/**
 * Helper function to translate multiple food names
 * @param foodNames - Array of food names
 * @returns Array of translated food names
 */
export const translateFoodNames = (foodNames: string[]): string[] => {
  return foodTranslation.translateFoodNames(foodNames);
};