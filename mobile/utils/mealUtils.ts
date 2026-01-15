// Pure utility functions for meal-related calculations and processing
// Following TDD approach - tests written first, then implementation

export interface MealMacros {
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  sugars_g?: number;
  salt_g?: number;
}

export interface MealItem {
  id: string;
  barcode: string;
  name: string;
  serving: string;
  calories: number;
  macros: MealMacros;
  isConsumed?: boolean;
}

export interface Meal {
  name: string;
  target_calories: number;
  actual_calories: number;
  items: MealItem[];
}

/**
 * Normalize meal macros from API response
 */
export const normalizeMealMacros = (macros?: Record<string, number>): MealMacros => ({
  protein_g: getMacroValue(macros, 'protein_g', 'protein'),
  fat_g: getMacroValue(macros, 'fat_g', 'fat'),
  carbs_g: getMacroValue(macros, 'carbs_g', 'carbs'),
  sugars_g: macros?.sugars_g ?? macros?.sugars ?? 0,
  salt_g: macros?.salt_g ?? macros?.salt ?? 0,
});

/**
 * Get macro value with fallback
 */
export const getMacroValue = (
  macros: Record<string, number> | undefined,
  primary: string,
  fallback: string
): number => {
  const normalized = macros || {};
  return Number(normalized[primary] ?? normalized[fallback] ?? 0);
};

/**
 * Calculate total calories from macros (rough estimate)
 */
export const calculateCaloriesFromMacros = (macros: MealMacros): number => {
  return (macros.protein_g * 4) + (macros.carbs_g * 4) + (macros.fat_g * 9);
};

/**
 * Validate meal item data
 */
export const isValidMealItem = (item: Partial<MealItem>): boolean => {
  return Boolean(
    item.id &&
    item.name &&
    typeof item.calories === 'number' &&
    item.calories >= 0 &&
    item.macros
  );
};

/**
 * Format calories display
 */
export const formatCalories = (calories: number): string => {
  return `${Math.round(calories)} kcal`;
};

/**
 * Calculate meal completion percentage
 */
export const calculateMealCompletion = (meal: Meal): number => {
  if (meal.target_calories === 0) return 100;
  return Math.min((meal.actual_calories / meal.target_calories) * 100, 100);
};

/**
 * Get consumed items from meal
 */
export const getConsumedItems = (meal: Meal): MealItem[] => {
  return meal.items.filter(item => item.isConsumed);
};

/**
 * Calculate total macros for meal
 */
export const calculateMealMacros = (meal: Meal): MealMacros => {
  return meal.items.reduce(
    (total, item) => ({
      protein_g: total.protein_g + item.macros.protein_g,
      fat_g: total.fat_g + item.macros.fat_g,
      carbs_g: total.carbs_g + item.macros.carbs_g,
      sugars_g: (total.sugars_g ?? 0) + (item.macros.sugars_g ?? 0),
      salt_g: (total.salt_g ?? 0) + (item.macros.salt_g ?? 0),
    }),
    { protein_g: 0, fat_g: 0, carbs_g: 0, sugars_g: 0, salt_g: 0 }
  );
};

/**
 * Normalize meal type label
 */
export const normalizeMealTypeLabel = (mealType: string): string => {
  if (!mealType) return 'Meal';
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
};

/**
 * Group meal items by type
 */
export const groupMealsByType = (items: MealItem[]): Map<string, Meal> => {
  const mealsByType = new Map<string, Meal>();

  items.forEach(item => {
    const mealType = item.name?.split(' ')?.[0]?.toLowerCase() || 'meal';
    const label = normalizeMealTypeLabel(mealType);

    const existing = mealsByType.get(label);
    if (existing) {
      existing.items.push(item);
      existing.actual_calories += item.calories;
      existing.target_calories = existing.actual_calories;
    } else {
      mealsByType.set(label, {
        name: label,
        target_calories: item.calories,
        actual_calories: item.calories,
        items: [item],
      });
    }
  });

  return mealsByType;
};
