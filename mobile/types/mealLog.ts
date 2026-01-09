/**
 * Meal Log Types - Data models for meal logging functionality
 * Following TDD approach: Define contracts first, then implement
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MealSource = 'manual' | 'ocr' | 'barcode' | 'api';

export interface MealEntry {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly description?: string;
  readonly calories: number;
  readonly protein_g: number;
  readonly fat_g: number;
  readonly carbs_g: number;
  readonly mealType: MealType;
  readonly timestamp: Date;
  readonly photoUrl?: string;
  readonly barcode?: string;
  readonly source: MealSource;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface MealLogState {
  readonly meals: readonly MealEntry[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly selectedMeal: MealEntry | null;
  readonly isCreating: boolean;
  readonly isUpdating: boolean;
  readonly isDeleting: boolean;
}

export interface CreateMealRequest {
  readonly name: string;
  readonly description?: string;
  readonly calories: number;
  readonly protein_g: number;
  readonly fat_g: number;
  readonly carbs_g: number;
  readonly mealType: MealType;
  readonly photoUrl?: string;
  readonly barcode?: string;
  readonly source: MealSource;
}

export interface UpdateMealRequest {
  readonly name?: string;
  readonly description?: string;
  readonly calories?: number;
  readonly protein_g?: number;
  readonly fat_g?: number;
  readonly carbs_g?: number;
  readonly mealType?: MealType;
  readonly photoUrl?: string;
}

export interface MealLogFilters {
  readonly date?: Date;
  readonly mealType?: MealType;
  readonly source?: MealSource;
  readonly minCalories?: number;
  readonly maxCalories?: number;
}

export interface MealLogStats {
  readonly totalMeals: number;
  readonly totalCalories: number;
  readonly averageCalories: number;
  readonly mealsByType: Record<MealType, number>;
  readonly dateRange: {
    readonly start: Date;
    readonly end: Date;
  };
}

// Factory functions for creating instances (following TDD)
export const createMealEntry = (
  id: string,
  userId: string,
  data: CreateMealRequest
): MealEntry => ({
  id,
  userId,
  ...data,
  timestamp: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const createEmptyMealLogState = (): MealLogState => ({
  meals: [],
  loading: false,
  error: null,
  selectedMeal: null,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
});

export const createMealLogState = (
  meals: readonly MealEntry[] = [],
  loading: boolean = false,
  error: string | null = null
): MealLogState => ({
  meals,
  loading,
  error,
  selectedMeal: null,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
});
