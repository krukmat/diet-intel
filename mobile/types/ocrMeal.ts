/**
 * OCR Meal Types - Optional OCR processing for meal logging
 * Following TDD approach: Define contracts first, then implement
 */

import { MealSource, MealType } from './mealLog';

export interface OCRProcessingResult {
  readonly success: boolean;
  readonly confidence: number; // 0-100
  readonly extractedData: ExtractedMealData;
  readonly rawText?: string;
  readonly error?: string;
}

export interface ExtractedMealData {
  readonly name?: string;
  readonly description?: string;
  readonly calories?: number;
  readonly protein_g?: number;
  readonly fat_g?: number;
  readonly carbs_g?: number;
  readonly servingSize?: string;
  readonly brand?: string;
  readonly ingredients?: readonly string[];
  readonly allergens?: readonly string[];
}

export interface OCRMealRequest {
  readonly imageUri: string;
  readonly mealType?: MealType;
  readonly expectedLanguage?: 'en' | 'es';
  readonly processingOptions?: OCRProcessingOptions;
}

export interface OCRProcessingOptions {
  readonly enhanceImage?: boolean;
  readonly detectLanguage?: boolean;
  readonly extractNutritionFacts?: boolean;
  readonly extractIngredients?: boolean;
  readonly confidenceThreshold?: number; // 0-100, default 70
}

export interface OCRMealState {
  readonly isProcessing: boolean;
  readonly lastResult: OCRProcessingResult | null;
  readonly processingHistory: readonly OCRProcessingResult[];
  readonly error: string | null;
}

export interface OCRValidationResult {
  readonly isValid: boolean;
  readonly issues: readonly string[];
  readonly suggestions: readonly string[];
  readonly confidence: number;
}

// Factory functions for creating instances (following TDD)
export const createOCRProcessingResult = (
  success: boolean,
  confidence: number,
  extractedData: ExtractedMealData,
  rawText?: string,
  error?: string
): OCRProcessingResult => ({
  success,
  confidence,
  extractedData,
  rawText,
  error,
});

export const createEmptyExtractedMealData = (): ExtractedMealData => ({
  name: undefined,
  description: undefined,
  calories: undefined,
  protein_g: undefined,
  fat_g: undefined,
  carbs_g: undefined,
  servingSize: undefined,
  brand: undefined,
  ingredients: undefined,
  allergens: undefined,
});

export const createOCRMealRequest = (
  imageUri: string,
  options?: Partial<OCRMealRequest>
): OCRMealRequest => ({
  imageUri,
  mealType: options?.mealType,
  expectedLanguage: options?.expectedLanguage || 'es',
  processingOptions: {
    enhanceImage: true,
    detectLanguage: true,
    extractNutritionFacts: true,
    extractIngredients: false,
    confidenceThreshold: 70,
    ...options?.processingOptions,
  },
});

export const createEmptyOCRMealState = (): OCRMealState => ({
  isProcessing: false,
  lastResult: null,
  processingHistory: [],
  error: null,
});

export const createOCRMealState = (
  isProcessing: boolean = false,
  lastResult: OCRProcessingResult | null = null,
  error: string | null = null
): OCRMealState => ({
  isProcessing,
  lastResult,
  processingHistory: lastResult ? [lastResult] : [],
  error,
});

// Utility functions for OCR validation
export const validateOCRConfidence = (confidence: number): boolean => {
  return confidence >= 70; // Default threshold
};

export const createOCRValidationResult = (
  isValid: boolean,
  issues: readonly string[] = [],
  suggestions: readonly string[] = [],
  confidence: number = 0
): OCRValidationResult => ({
  isValid,
  issues,
  suggestions,
  confidence,
});

// Type guards for runtime validation
export const isValidMealType = (value: string): value is MealType => {
  return ['breakfast', 'lunch', 'dinner', 'snack'].includes(value);
};

export const isValidMealSource = (value: string): value is MealSource => {
  return ['manual', 'ocr', 'barcode', 'api'].includes(value);
};

export const isOCRProcessingResult = (obj: any): obj is OCRProcessingResult => {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.success === 'boolean' &&
    typeof obj.confidence === 'number' &&
    typeof obj.extractedData === 'object' &&
    obj.confidence >= 0 &&
    obj.confidence <= 100
  );
};
