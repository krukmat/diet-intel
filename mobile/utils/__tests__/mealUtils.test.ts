import {
  normalizeMealMacros,
  getMacroValue,
  calculateCaloriesFromMacros,
  isValidMealItem,
  formatCalories,
  calculateMealCompletion,
  getConsumedItems,
  calculateMealMacros,
  normalizeMealTypeLabel,
  groupMealsByType,
  type MealMacros,
  type MealItem,
  type Meal,
} from '../mealUtils';

describe('mealUtils', () => {
  describe('normalizeMealMacros', () => {
    it('should normalize complete macros object', () => {
      const macros = { protein_g: 10, fat_g: 5, carbs_g: 20, sugars_g: 15, salt_g: 2 };
      const result = normalizeMealMacros(macros);
      expect(result).toEqual({
        protein_g: 10,
        fat_g: 5,
        carbs_g: 20,
        sugars_g: 15,
        salt_g: 2,
      });
    });

    it('should handle fallback keys', () => {
      const macros = { protein: 10, fat: 5, carbs: 20 };
      const result = normalizeMealMacros(macros);
      expect(result).toEqual({
        protein_g: 10,
        fat_g: 5,
        carbs_g: 20,
        sugars_g: 0,
        salt_g: 0,
      });
    });

    it('should handle empty macros', () => {
      const result = normalizeMealMacros({});
      expect(result).toEqual({
        protein_g: 0,
        fat_g: 0,
        carbs_g: 0,
        sugars_g: 0,
        salt_g: 0,
      });
    });

    it('should handle undefined macros', () => {
      const result = normalizeMealMacros(undefined);
      expect(result).toEqual({
        protein_g: 0,
        fat_g: 0,
        carbs_g: 0,
        sugars_g: 0,
        salt_g: 0,
      });
    });
  });

  describe('getMacroValue', () => {
    it('should return primary value when available', () => {
      const macros = { protein_g: 10, protein: 5 };
      const result = getMacroValue(macros, 'protein_g', 'protein');
      expect(result).toBe(10);
    });

    it('should return fallback value when primary is missing', () => {
      const macros = { protein: 5 };
      const result = getMacroValue(macros, 'protein_g', 'protein');
      expect(result).toBe(5);
    });

    it('should return 0 when both keys are missing', () => {
      const macros = { other: 10 };
      const result = getMacroValue(macros, 'protein_g', 'protein');
      expect(result).toBe(0);
    });

    it('should handle undefined macros', () => {
      const result = getMacroValue(undefined, 'protein_g', 'protein');
      expect(result).toBe(0);
    });
  });

  describe('calculateCaloriesFromMacros', () => {
    it('should calculate calories correctly', () => {
      const macros: MealMacros = {
        protein_g: 10, // 10 * 4 = 40
        fat_g: 5,      // 5 * 9 = 45
        carbs_g: 20,   // 20 * 4 = 80
      };
      const result = calculateCaloriesFromMacros(macros);
      expect(result).toBe(165); // 40 + 45 + 80
    });

    it('should ignore optional macros', () => {
      const macros: MealMacros = {
        protein_g: 10,
        fat_g: 5,
        carbs_g: 20,
        sugars_g: 15,
        salt_g: 2,
      };
      const result = calculateCaloriesFromMacros(macros);
      expect(result).toBe(165);
    });
  });

  describe('isValidMealItem', () => {
    it('should validate complete meal item', () => {
      const item: Partial<MealItem> = {
        id: '1',
        name: 'Apple',
        calories: 100,
        macros: { protein_g: 0, fat_g: 0, carbs_g: 25 },
      };
      expect(isValidMealItem(item)).toBe(true);
    });

    it('should reject missing id', () => {
      const item: Partial<MealItem> = {
        name: 'Apple',
        calories: 100,
        macros: { protein_g: 0, fat_g: 0, carbs_g: 25 },
      };
      expect(isValidMealItem(item)).toBe(false);
    });

    it('should reject missing name', () => {
      const item: Partial<MealItem> = {
        id: '1',
        calories: 100,
        macros: { protein_g: 0, fat_g: 0, carbs_g: 25 },
      };
      expect(isValidMealItem(item)).toBe(false);
    });

    it('should reject negative calories', () => {
      const item: Partial<MealItem> = {
        id: '1',
        name: 'Apple',
        calories: -50,
        macros: { protein_g: 0, fat_g: 0, carbs_g: 25 },
      };
      expect(isValidMealItem(item)).toBe(false);
    });

    it('should reject missing macros', () => {
      const item: Partial<MealItem> = {
        id: '1',
        name: 'Apple',
        calories: 100,
      };
      expect(isValidMealItem(item)).toBe(false);
    });
  });

  describe('formatCalories', () => {
    it('should format calories with kcal suffix', () => {
      expect(formatCalories(150)).toBe('150 kcal');
      expect(formatCalories(150.7)).toBe('151 kcal');
    });

    it('should round to nearest integer', () => {
      expect(formatCalories(150.4)).toBe('150 kcal');
      expect(formatCalories(150.5)).toBe('151 kcal');
    });
  });

  describe('calculateMealCompletion', () => {
    it('should calculate completion percentage correctly', () => {
      const meal: Meal = {
        name: 'Breakfast',
        target_calories: 400,
        actual_calories: 200,
        items: [],
      };
      const result = calculateMealCompletion(meal);
      expect(result).toBe(50);
    });

    it('should return 100% when actual exceeds target', () => {
      const meal: Meal = {
        name: 'Breakfast',
        target_calories: 400,
        actual_calories: 600,
        items: [],
      };
      const result = calculateMealCompletion(meal);
      expect(result).toBe(100);
    });

    it('should return 100% when target is 0', () => {
      const meal: Meal = {
        name: 'Breakfast',
        target_calories: 0,
        actual_calories: 100,
        items: [],
      };
      const result = calculateMealCompletion(meal);
      expect(result).toBe(100);
    });

    it('should return 0% when no calories consumed', () => {
      const meal: Meal = {
        name: 'Breakfast',
        target_calories: 400,
        actual_calories: 0,
        items: [],
      };
      const result = calculateMealCompletion(meal);
      expect(result).toBe(0);
    });
  });

  describe('getConsumedItems', () => {
    it('should return only consumed items', () => {
      const items: MealItem[] = [
        { id: '1', barcode: '', name: 'Apple', serving: '1', calories: 100, macros: { protein_g: 0, fat_g: 0, carbs_g: 25 }, isConsumed: true },
        { id: '2', barcode: '', name: 'Banana', serving: '1', calories: 120, macros: { protein_g: 1, fat_g: 0, carbs_g: 30 }, isConsumed: false },
        { id: '3', barcode: '', name: 'Orange', serving: '1', calories: 80, macros: { protein_g: 1, fat_g: 0, carbs_g: 20 }, isConsumed: true },
      ];

      const result = getConsumedItems({ name: 'Breakfast', target_calories: 300, actual_calories: 180, items });
      expect(result).toHaveLength(2);
      expect(result.map(item => item.id)).toEqual(['1', '3']);
    });

    it('should return empty array when no items consumed', () => {
      const items: MealItem[] = [
        { id: '1', barcode: '', name: 'Apple', serving: '1', calories: 100, macros: { protein_g: 0, fat_g: 0, carbs_g: 25 }, isConsumed: false },
      ];

      const result = getConsumedItems({ name: 'Breakfast', target_calories: 100, actual_calories: 0, items });
      expect(result).toHaveLength(0);
    });
  });

  describe('calculateMealMacros', () => {
    it('should sum all macros correctly', () => {
      const meal: Meal = {
        name: 'Breakfast',
        target_calories: 300,
        actual_calories: 300,
        items: [
          {
            id: '1',
            barcode: '',
            name: 'Eggs',
            serving: '2',
            calories: 140,
            macros: { protein_g: 12, fat_g: 10, carbs_g: 1, sugars_g: 0, salt_g: 0.5 },
          },
          {
            id: '2',
            barcode: '',
            name: 'Toast',
            serving: '1 slice',
            calories: 80,
            macros: { protein_g: 3, fat_g: 1, carbs_g: 15, sugars_g: 2, salt_g: 0.3 },
          },
        ],
      };

      const result = calculateMealMacros(meal);
      expect(result).toEqual({
        protein_g: 15, // 12 + 3
        fat_g: 11,     // 10 + 1
        carbs_g: 16,   // 1 + 15
        sugars_g: 2,   // 0 + 2
        salt_g: 0.8,   // 0.5 + 0.3
      });
    });

    it('should handle empty meal', () => {
      const meal: Meal = {
        name: 'Breakfast',
        target_calories: 0,
        actual_calories: 0,
        items: [],
      };

      const result = calculateMealMacros(meal);
      expect(result).toEqual({
        protein_g: 0,
        fat_g: 0,
        carbs_g: 0,
        sugars_g: 0,
        salt_g: 0,
      });
    });
  });

  describe('normalizeMealTypeLabel', () => {
    it('should capitalize first letter', () => {
      expect(normalizeMealTypeLabel('breakfast')).toBe('Breakfast');
      expect(normalizeMealTypeLabel('lunch')).toBe('Lunch');
    });

    it('should handle empty string', () => {
      expect(normalizeMealTypeLabel('')).toBe('Meal');
    });

    it('should handle undefined', () => {
      expect(normalizeMealTypeLabel(undefined as any)).toBe('Meal');
    });
  });

  describe('groupMealsByType', () => {
    it('should group items by first word of name', () => {
      const items: MealItem[] = [
        { id: '1', barcode: '', name: 'Scrambled Eggs', serving: '2', calories: 140, macros: { protein_g: 12, fat_g: 10, carbs_g: 1 } },
        { id: '2', barcode: '', name: 'Toast', serving: '1 slice', calories: 80, macros: { protein_g: 3, fat_g: 1, carbs_g: 15 } },
        { id: '3', barcode: '', name: 'Grilled Chicken', serving: '100g', calories: 200, macros: { protein_g: 30, fat_g: 5, carbs_g: 0 } },
      ];

      const result = groupMealsByType(items);
      expect(result.size).toBe(3); // Creates groups: 'Scrambled', 'Toast', 'Grilled'

      expect(result.get('Scrambled')?.items).toHaveLength(1);
      expect(result.get('Toast')?.items).toHaveLength(1);
      expect(result.get('Grilled')?.items).toHaveLength(1);
    });

    it('should handle empty items array', () => {
      const result = groupMealsByType([]);
      expect(result.size).toBe(0);
    });

    it('should accumulate calories for same meal type', () => {
      const items: MealItem[] = [
        { id: '1', barcode: '', name: 'Breakfast Eggs', serving: '2', calories: 140, macros: { protein_g: 12, fat_g: 10, carbs_g: 1 } },
        { id: '2', barcode: '', name: 'Breakfast Toast', serving: '1 slice', calories: 80, macros: { protein_g: 3, fat_g: 1, carbs_g: 15 } },
      ];

      const result = groupMealsByType(items);
      expect(result.size).toBe(1);

      const breakfastMeal = result.get('Breakfast');
      expect(breakfastMeal?.actual_calories).toBe(220); // 140 + 80
      expect(breakfastMeal?.items).toHaveLength(2);
    });
  });
});
