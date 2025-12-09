/**
 * Recipe AI Language Helper
 * Utilities for Recipe AI Spanish language integration
 */

import { getCurrentLanguage } from '../i18n/config';

export type SupportedLanguage = 'en' | 'es';

/**
 * Get current app language for Recipe AI
 */
export const getCurrentRecipeLanguage = (): SupportedLanguage => {
  const currentLang = getCurrentLanguage();
  return (currentLang === 'es') ? 'es' : 'en';
};

/**
 * Check if Spanish is currently selected
 */
export const isSpanishSelected = (): boolean => {
  return getCurrentRecipeLanguage() === 'es';
};

/**
 * Get language-specific default values for recipe generation
 */
export const getLanguageDefaults = (language: SupportedLanguage = getCurrentRecipeLanguage()) => {
  return {
    target_language: language,
    defaultCuisineTypes: language === 'es'
      ? ['spanish', 'mediterranean', 'mexican', 'italian']
      : ['american', 'italian', 'mediterranean', 'asian'],
    defaultMealType: language === 'es' ? 'lunch' : 'dinner',
  };
};

/**
 * Get localized cuisine type labels
 */
export const getLocalizedCuisineTypes = (language: SupportedLanguage = getCurrentRecipeLanguage()) => {
  const cuisineTypes = {
    en: {
      italian: 'Italian',
      mexican: 'Mexican',
      spanish: 'Spanish',
      mediterranean: 'Mediterranean',
      american: 'American',
      chinese: 'Chinese',
      japanese: 'Japanese',
      indian: 'Indian',
      thai: 'Thai',
      french: 'French',
      greek: 'Greek',
      korean: 'Korean',
      middle_eastern: 'Middle Eastern',
      other: 'Other'
    },
    es: {
      italian: 'Italiana',
      mexican: 'Mexicana',
      spanish: 'Española',
      mediterranean: 'Mediterránea',
      american: 'Americana',
      chinese: 'China',
      japanese: 'Japonesa',
      indian: 'India',
      thai: 'Tailandesa',
      french: 'Francesa',
      greek: 'Griega',
      korean: 'Coreana',
      middle_eastern: 'Medio Oriental',
      other: 'Otra'
    }
  };

  return cuisineTypes[language];
};

/**
 * Get localized dietary restrictions
 */
export const getLocalizedDietaryRestrictions = (language: SupportedLanguage = getCurrentRecipeLanguage()) => {
  const restrictions = {
    en: {
      vegetarian: 'Vegetarian',
      vegan: 'Vegan',
      gluten_free: 'Gluten Free',
      dairy_free: 'Dairy Free',
      nut_free: 'Nut Free',
      low_carb: 'Low Carb',
      low_fat: 'Low Fat',
      keto: 'Keto',
      paleo: 'Paleo'
    },
    es: {
      vegetarian: 'Vegetariano',
      vegan: 'Vegano',
      gluten_free: 'Sin Gluten',
      dairy_free: 'Sin Lácteos',
      nut_free: 'Sin Nueces',
      low_carb: 'Bajo en Carbohidratos',
      low_fat: 'Bajo en Grasa',
      keto: 'Keto',
      paleo: 'Paleo'
    }
  };

  return restrictions[language];
};

/**
 * Get localized difficulty levels
 */
export const getLocalizedDifficultyLevels = (language: SupportedLanguage = getCurrentRecipeLanguage()) => {
  const levels = {
    en: {
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced'
    },
    es: {
      beginner: 'Principiante',
      intermediate: 'Intermedio',
      advanced: 'Avanzado'
    }
  };

  return levels[language];
};

/**
 * Get localized meal types
 */
export const getLocalizedMealTypes = (language: SupportedLanguage = getCurrentRecipeLanguage()) => {
  const mealTypes = {
    en: {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      snack: 'Snack',
      dessert: 'Dessert',
      appetizer: 'Appetizer',
      any: 'Any'
    },
    es: {
      breakfast: 'Desayuno',
      lunch: 'Almuerzo',
      dinner: 'Cena',
      snack: 'Merienda',
      dessert: 'Postre',
      appetizer: 'Aperitivo',
      any: 'Cualquiera'
    }
  };

  return mealTypes[language];
};

/**
 * Format recipe time display based on language
 */
export const formatRecipeTime = (minutes: number, language: SupportedLanguage = getCurrentRecipeLanguage()): string => {
  if (language === 'es') {
    if (minutes < 60) {
      return `${minutes} minutos`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hora${hours > 1 ? 's' : ''}`;
      }
      return `${hours}h ${remainingMinutes}m`;
    }
  } else {
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
      }
      return `${hours}h ${remainingMinutes}m`;
    }
  }
};

/**
 * Format servings display based on language
 */
export const formatServings = (servings: number, language: SupportedLanguage = getCurrentRecipeLanguage()): string => {
  if (language === 'es') {
    return `${servings} porción${servings > 1 ? 'es' : ''}`;
  } else {
    return `${servings} serving${servings > 1 ? 's' : ''}`;
  }
};

/**
 * Format ingredient quantity with unit based on language
 */
export const formatIngredientQuantity = (
  quantity: number | string,
  unit: string,
  language: SupportedLanguage = getCurrentRecipeLanguage()
): string => {
  const unitTranslations = {
    es: {
      'g': 'g',
      'kg': 'kg',
      'ml': 'ml',
      'l': 'l',
      'cup': 'taza',
      'cups': 'tazas',
      'tablespoon': 'cucharada',
      'tablespoons': 'cucharadas',
      'teaspoon': 'cucharadita',
      'teaspoons': 'cucharaditas',
      'piece': 'pieza',
      'pieces': 'piezas',
      'slice': 'rebanada',
      'slices': 'rebanadas',
      'clove': 'diente',
      'cloves': 'dientes'
    },
    en: {
      'g': 'g',
      'kg': 'kg',
      'ml': 'ml',
      'l': 'l',
      'cup': 'cup',
      'cups': 'cups',
      'tablespoon': 'tablespoon',
      'tablespoons': 'tablespoons',
      'teaspoon': 'teaspoon',
      'teaspoons': 'teaspoons',
      'piece': 'piece',
      'pieces': 'pieces',
      'slice': 'slice',
      'slices': 'slices',
      'clove': 'clove',
      'cloves': 'cloves'
    }
  };

  const localizedUnit = unitTranslations[language][unit.toLowerCase()] || unit;
  return `${quantity} ${localizedUnit}`;
};

/**
 * Check if recipe content needs translation
 */
export const needsTranslation = (recipeLanguage: string): boolean => {
  const currentLang = getCurrentRecipeLanguage();
  return recipeLanguage !== currentLang && currentLang === 'es';
};

/**
 * Get recipe generation request with automatic language detection
 */
export const enhanceRequestWithLanguage = <T extends { target_language?: SupportedLanguage }>(
  request: T
): T => {
  return {
    ...request,
    target_language: request.target_language || getCurrentRecipeLanguage()
  };
};