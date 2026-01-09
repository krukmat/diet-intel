/**
 * Tests for MealLog types - TDD approach
 * Testing contracts and factory functions
 */

import {
  MealEntry,
  MealLogState,
  CreateMealRequest,
  UpdateMealRequest,
  MealType,
  MealSource,
  createMealEntry,
  createEmptyMealLogState,
  createMealLogState,
} from '../mealLog';

describe('MealLog Types - TDD Validation', () => {
  describe('MealEntry interface contract', () => {
    it('should validate MealEntry structure with all required fields', () => {
      const meal: MealEntry = {
        id: 'meal-123',
        userId: 'user-456',
        name: 'Chicken Salad',
        calories: 350,
        protein_g: 30,
        fat_g: 15,
        carbs_g: 20,
        mealType: 'lunch' as MealType,
        timestamp: new Date('2024-01-01T12:00:00Z'),
        source: 'manual' as MealSource,
        createdAt: new Date('2024-01-01T12:00:00Z'),
        updatedAt: new Date('2024-01-01T12:00:00Z'),
      };

      expect(meal.id).toBe('meal-123');
      expect(meal.userId).toBe('user-456');
      expect(meal.name).toBe('Chicken Salad');
      expect(meal.calories).toBe(350);
      expect(meal.protein_g).toBe(30);
      expect(meal.fat_g).toBe(15);
      expect(meal.carbs_g).toBe(20);
      expect(meal.mealType).toBe('lunch');
      expect(meal.timestamp).toEqual(new Date('2024-01-01T12:00:00Z'));
      expect(meal.source).toBe('manual');
    });

    it('should allow optional fields in MealEntry', () => {
      const meal: MealEntry = {
        id: 'meal-123',
        userId: 'user-456',
        name: 'Apple',
        calories: 95,
        protein_g: 0.5,
        fat_g: 0.3,
        carbs_g: 25,
        mealType: 'snack' as MealType,
        timestamp: new Date(),
        source: 'barcode' as MealSource,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: 'Fresh red apple',
        photoUrl: 'https://example.com/apple.jpg',
        barcode: '1234567890123',
      };

      expect(meal.description).toBe('Fresh red apple');
      expect(meal.photoUrl).toBe('https://example.com/apple.jpg');
      expect(meal.barcode).toBe('1234567890123');
    });
  });

  describe('MealLogState interface contract', () => {
    it('should validate MealLogState structure', () => {
      const state: MealLogState = {
        meals: [],
        loading: false,
        error: null,
        selectedMeal: null,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
      };

      expect(state.meals).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.selectedMeal).toBeNull();
      expect(state.isCreating).toBe(false);
      expect(state.isUpdating).toBe(false);
      expect(state.isDeleting).toBe(false);
    });

    it('should allow MealLogState with meals and error', () => {
      const mockMeal: MealEntry = {
        id: 'meal-123',
        userId: 'user-456',
        name: 'Test Meal',
        calories: 100,
        protein_g: 10,
        fat_g: 5,
        carbs_g: 10,
        mealType: 'breakfast' as MealType,
        timestamp: new Date(),
        source: 'manual' as MealSource,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const state: MealLogState = {
        meals: [mockMeal],
        loading: true,
        error: 'Network error',
        selectedMeal: mockMeal,
        isCreating: true,
        isUpdating: false,
        isDeleting: false,
      };

      expect(state.meals).toHaveLength(1);
      expect(state.loading).toBe(true);
      expect(state.error).toBe('Network error');
      expect(state.selectedMeal).toBe(mockMeal);
      expect(state.isCreating).toBe(true);
    });
  });

  describe('CreateMealRequest interface contract', () => {
    it('should validate CreateMealRequest with required fields', () => {
      const request: CreateMealRequest = {
        name: 'Grilled Chicken',
        calories: 250,
        protein_g: 35,
        fat_g: 10,
        carbs_g: 0,
        mealType: 'dinner' as MealType,
        source: 'manual' as MealSource,
      };

      expect(request.name).toBe('Grilled Chicken');
      expect(request.calories).toBe(250);
      expect(request.protein_g).toBe(35);
      expect(request.fat_g).toBe(10);
      expect(request.carbs_g).toBe(0);
      expect(request.mealType).toBe('dinner');
      expect(request.source).toBe('manual');
    });

    it('should allow optional fields in CreateMealRequest', () => {
      const request: CreateMealRequest = {
        name: 'Pasta',
        description: 'Whole wheat pasta with sauce',
        calories: 400,
        protein_g: 15,
        fat_g: 8,
        carbs_g: 65,
        mealType: 'lunch' as MealType,
        photoUrl: 'https://example.com/pasta.jpg',
        barcode: '9876543210987',
        source: 'ocr' as MealSource,
      };

      expect(request.description).toBe('Whole wheat pasta with sauce');
      expect(request.photoUrl).toBe('https://example.com/pasta.jpg');
      expect(request.barcode).toBe('9876543210987');
      expect(request.source).toBe('ocr');
    });
  });

  describe('UpdateMealRequest interface contract', () => {
    it('should allow partial updates', () => {
      const request: UpdateMealRequest = {
        calories: 300,
        description: 'Updated description',
      };

      expect(request.calories).toBe(300);
      expect(request.description).toBe('Updated description');
      expect(request.name).toBeUndefined();
      expect(request.protein_g).toBeUndefined();
    });
  });

  describe('Factory functions - createMealEntry', () => {
    it('should create MealEntry with correct structure', () => {
      const request: CreateMealRequest = {
        name: 'Banana',
        calories: 105,
        protein_g: 1.3,
        fat_g: 0.4,
        carbs_g: 27,
        mealType: 'snack' as MealType,
        source: 'barcode' as MealSource,
        barcode: '1234567890123',
      };

      const meal = createMealEntry('meal-123', 'user-456', request);

      expect(meal.id).toBe('meal-123');
      expect(meal.userId).toBe('user-456');
      expect(meal.name).toBe('Banana');
      expect(meal.calories).toBe(105);
      expect(meal.protein_g).toBe(1.3);
      expect(meal.fat_g).toBe(0.4);
      expect(meal.carbs_g).toBe(27);
      expect(meal.mealType).toBe('snack');
      expect(meal.barcode).toBe('1234567890123');
      expect(meal.source).toBe('barcode');
      expect(meal.timestamp).toBeInstanceOf(Date);
      expect(meal.createdAt).toBeInstanceOf(Date);
      expect(meal.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Factory functions - createEmptyMealLogState', () => {
    it('should create empty state with correct defaults', () => {
      const state = createEmptyMealLogState();

      expect(state.meals).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.selectedMeal).toBeNull();
      expect(state.isCreating).toBe(false);
      expect(state.isUpdating).toBe(false);
      expect(state.isDeleting).toBe(false);
    });
  });

  describe('Factory functions - createMealLogState', () => {
    it('should create state with provided parameters', () => {
      const mockMeals: MealEntry[] = [
        {
          id: 'meal-1',
          userId: 'user-1',
          name: 'Test Meal',
          calories: 200,
          protein_g: 20,
          fat_g: 10,
          carbs_g: 15,
          mealType: 'breakfast' as MealType,
          timestamp: new Date(),
          source: 'manual' as MealSource,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const state = createMealLogState(mockMeals, true, 'Test error');

      expect(state.meals).toBe(mockMeals);
      expect(state.loading).toBe(true);
      expect(state.error).toBe('Test error');
      expect(state.selectedMeal).toBeNull();
      expect(state.isCreating).toBe(false);
      expect(state.isUpdating).toBe(false);
      expect(state.isDeleting).toBe(false);
    });

    it('should create state with default parameters', () => {
      const state = createMealLogState();

      expect(state.meals).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('Type validation - MealType', () => {
    it('should accept valid meal types', () => {
      const validTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

      validTypes.forEach(type => {
        const meal: MealEntry = {
          id: 'test',
          userId: 'user',
          name: 'Test',
          calories: 100,
          protein_g: 10,
          fat_g: 5,
          carbs_g: 10,
          mealType: type,
          timestamp: new Date(),
          source: 'manual' as MealSource,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        expect(meal.mealType).toBe(type);
      });
    });
  });

  describe('Type validation - MealSource', () => {
    it('should accept valid meal sources', () => {
      const validSources: MealSource[] = ['manual', 'ocr', 'barcode', 'api'];

      validSources.forEach(source => {
        const meal: MealEntry = {
          id: 'test',
          userId: 'user',
          name: 'Test',
          calories: 100,
          protein_g: 10,
          fat_g: 5,
          carbs_g: 10,
          mealType: 'breakfast' as MealType,
          timestamp: new Date(),
          source: source,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        expect(meal.source).toBe(source);
      });
    });
  });
});
