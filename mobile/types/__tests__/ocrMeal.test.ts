/**
 * Tests for OCR Meal types - TDD approach
 * Testing OCR processing contracts and validation
 */

import {
  OCRProcessingResult,
  ExtractedMealData,
  OCRMealRequest,
  OCRProcessingOptions,
  OCRMealState,
  OCRValidationResult,
  createOCRProcessingResult,
  createEmptyExtractedMealData,
  createOCRMealRequest,
  createEmptyOCRMealState,
  createOCRMealState,
  validateOCRConfidence,
  createOCRValidationResult,
  isValidMealType,
  isValidMealSource,
  isOCRProcessingResult,
} from '../ocrMeal';
import { MealType, MealSource } from '../mealLog';

describe('OCR Meal Types - TDD Validation', () => {
  describe('OCRProcessingResult interface contract', () => {
    it('should validate OCRProcessingResult structure for success', () => {
      const extractedData: ExtractedMealData = {
        name: 'Chicken Breast',
        calories: 250,
        protein_g: 30,
        fat_g: 10,
        carbs_g: 0,
      };

      const result: OCRProcessingResult = {
        success: true,
        confidence: 85,
        extractedData,
        rawText: 'Extracted nutrition facts...',
      };

      expect(result.success).toBe(true);
      expect(result.confidence).toBe(85);
      expect(result.extractedData).toBe(extractedData);
      expect(result.rawText).toBe('Extracted nutrition facts...');
      expect(result.error).toBeUndefined();
    });

    it('should validate OCRProcessingResult structure for failure', () => {
      const extractedData = createEmptyExtractedMealData();

      const result: OCRProcessingResult = {
        success: false,
        confidence: 15,
        extractedData,
        error: 'OCR processing failed',
      };

      expect(result.success).toBe(false);
      expect(result.confidence).toBe(15);
      expect(result.extractedData).toEqual(extractedData);
      expect(result.error).toBe('OCR processing failed');
      expect(result.rawText).toBeUndefined();
    });
  });

  describe('ExtractedMealData interface contract', () => {
    it('should validate ExtractedMealData with all optional fields', () => {
      const data: ExtractedMealData = {
        name: 'Greek Yogurt',
        description: 'Plain Greek yogurt',
        calories: 150,
        protein_g: 15,
        fat_g: 5,
        carbs_g: 10,
        servingSize: '200g',
        brand: 'Chobani',
        ingredients: ['milk', 'cultures'],
        allergens: ['dairy'],
      };

      expect(data.name).toBe('Greek Yogurt');
      expect(data.calories).toBe(150);
      expect(data.protein_g).toBe(15);
      expect(data.servingSize).toBe('200g');
      expect(data.brand).toBe('Chobani');
      expect(data.ingredients).toEqual(['milk', 'cultures']);
      expect(data.allergens).toEqual(['dairy']);
    });

    it('should allow ExtractedMealData with only undefined values', () => {
      const data = createEmptyExtractedMealData();

      expect(data.name).toBeUndefined();
      expect(data.calories).toBeUndefined();
      expect(data.protein_g).toBeUndefined();
      expect(data.fat_g).toBeUndefined();
      expect(data.carbs_g).toBeUndefined();
      expect(data.servingSize).toBeUndefined();
      expect(data.brand).toBeUndefined();
      expect(data.ingredients).toBeUndefined();
      expect(data.allergens).toBeUndefined();
    });
  });

  describe('OCRMealRequest interface contract', () => {
    it('should validate OCRMealRequest with minimal data', () => {
      const request: OCRMealRequest = {
        imageUri: 'file:///path/to/image.jpg',
      };

      expect(request.imageUri).toBe('file:///path/to/image.jpg');
      expect(request.mealType).toBeUndefined();
      expect(request.expectedLanguage).toBeUndefined();
      expect(request.processingOptions).toBeUndefined();
    });

    it('should validate OCRMealRequest with full options', () => {
      const processingOptions: OCRProcessingOptions = {
        enhanceImage: true,
        detectLanguage: true,
        extractNutritionFacts: true,
        extractIngredients: true,
        confidenceThreshold: 80,
      };

      const request: OCRMealRequest = {
        imageUri: 'file:///path/to/image.jpg',
        mealType: 'lunch' as MealType,
        expectedLanguage: 'es',
        processingOptions,
      };

      expect(request.imageUri).toBe('file:///path/to/image.jpg');
      expect(request.mealType).toBe('lunch');
      expect(request.expectedLanguage).toBe('es');
      expect(request.processingOptions).toBe(processingOptions);
    });
  });

  describe('OCRMealState interface contract', () => {
    it('should validate empty OCRMealState', () => {
      const state: OCRMealState = {
        isProcessing: false,
        lastResult: null,
        processingHistory: [],
        error: null,
      };

      expect(state.isProcessing).toBe(false);
      expect(state.lastResult).toBeNull();
      expect(state.processingHistory).toEqual([]);
      expect(state.error).toBeNull();
    });

    it('should validate OCRMealState with data', () => {
      const mockResult: OCRProcessingResult = {
        success: true,
        confidence: 90,
        extractedData: createEmptyExtractedMealData(),
      };

      const state: OCRMealState = {
        isProcessing: true,
        lastResult: mockResult,
        processingHistory: [mockResult],
        error: 'Test error',
      };

      expect(state.isProcessing).toBe(true);
      expect(state.lastResult).toBe(mockResult);
      expect(state.processingHistory).toHaveLength(1);
      expect(state.error).toBe('Test error');
    });
  });

  describe('OCRValidationResult interface contract', () => {
    it('should validate OCRValidationResult structure', () => {
      const result: OCRValidationResult = {
        isValid: false,
        issues: ['Low confidence', 'Missing data'],
        suggestions: ['Try better lighting', 'Use clearer image'],
        confidence: 45,
      };

      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(['Low confidence', 'Missing data']);
      expect(result.suggestions).toEqual(['Try better lighting', 'Use clearer image']);
      expect(result.confidence).toBe(45);
    });
  });

  describe('Factory functions - createOCRProcessingResult', () => {
    it('should create successful OCRProcessingResult', () => {
      const extractedData = createEmptyExtractedMealData();
      const result = createOCRProcessingResult(true, 88, extractedData, 'raw text');

      expect(result.success).toBe(true);
      expect(result.confidence).toBe(88);
      expect(result.extractedData).toBe(extractedData);
      expect(result.rawText).toBe('raw text');
      expect(result.error).toBeUndefined();
    });

    it('should create failed OCRProcessingResult', () => {
      const extractedData = createEmptyExtractedMealData();
      const result = createOCRProcessingResult(false, 20, extractedData, undefined, 'Processing failed');

      expect(result.success).toBe(false);
      expect(result.confidence).toBe(20);
      expect(result.extractedData).toBe(extractedData);
      expect(result.rawText).toBeUndefined();
      expect(result.error).toBe('Processing failed');
    });
  });

  describe('Factory functions - createOCRMealRequest', () => {
    it('should create OCRMealRequest with minimal data', () => {
      const request = createOCRMealRequest('file:///image.jpg');

      expect(request.imageUri).toBe('file:///image.jpg');
      expect(request.expectedLanguage).toBe('es');
      expect(request.processingOptions?.enhanceImage).toBe(true);
      expect(request.processingOptions?.confidenceThreshold).toBe(70);
    });

    it('should create OCRMealRequest with custom options', () => {
      const request = createOCRMealRequest('file:///image.jpg', {
        mealType: 'dinner' as MealType,
        expectedLanguage: 'en',
        processingOptions: {
          enhanceImage: false,
          confidenceThreshold: 85,
        },
      });

      expect(request.imageUri).toBe('file:///image.jpg');
      expect(request.mealType).toBe('dinner');
      expect(request.expectedLanguage).toBe('en');
      expect(request.processingOptions?.enhanceImage).toBe(false);
      expect(request.processingOptions?.confidenceThreshold).toBe(85);
    });
  });

  describe('Factory functions - createOCRMealState', () => {
    it('should create empty state with defaults', () => {
      const state = createEmptyOCRMealState();

      expect(state.isProcessing).toBe(false);
      expect(state.lastResult).toBeNull();
      expect(state.processingHistory).toEqual([]);
      expect(state.error).toBeNull();
    });

    it('should create state with provided parameters', () => {
      const mockResult: OCRProcessingResult = {
        success: true,
        confidence: 95,
        extractedData: createEmptyExtractedMealData(),
      };

      const state = createOCRMealState(true, mockResult, 'Test error');

      expect(state.isProcessing).toBe(true);
      expect(state.lastResult).toBe(mockResult);
      expect(state.processingHistory).toEqual([mockResult]);
      expect(state.error).toBe('Test error');
    });

    it('should create state without history when lastResult is null', () => {
      const state = createOCRMealState(false, null, null);

      expect(state.isProcessing).toBe(false);
      expect(state.lastResult).toBeNull();
      expect(state.processingHistory).toEqual([]);
      expect(state.error).toBeNull();
    });
  });

  describe('Utility functions - validateOCRConfidence', () => {
    it('should validate confidence above threshold', () => {
      expect(validateOCRConfidence(85)).toBe(true);
      expect(validateOCRConfidence(70)).toBe(true);
    });

    it('should reject confidence below threshold', () => {
      expect(validateOCRConfidence(50)).toBe(false);
      expect(validateOCRConfidence(0)).toBe(false);
    });
  });

  describe('Utility functions - createOCRValidationResult', () => {
    it('should create validation result with all parameters', () => {
      const result = createOCRValidationResult(
        false,
        ['Issue 1', 'Issue 2'],
        ['Suggestion 1'],
        60
      );

      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(['Issue 1', 'Issue 2']);
      expect(result.suggestions).toEqual(['Suggestion 1']);
      expect(result.confidence).toBe(60);
    });

    it('should create validation result with defaults', () => {
      const result = createOCRValidationResult(true);

      expect(result.isValid).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.suggestions).toEqual([]);
      expect(result.confidence).toBe(0);
    });
  });

  describe('Type guards - isValidMealType', () => {
    it('should validate correct meal types', () => {
      expect(isValidMealType('breakfast')).toBe(true);
      expect(isValidMealType('lunch')).toBe(true);
      expect(isValidMealType('dinner')).toBe(true);
      expect(isValidMealType('snack')).toBe(true);
    });

    it('should reject invalid meal types', () => {
      expect(isValidMealType('invalid')).toBe(false);
      expect(isValidMealType('')).toBe(false);
      expect(isValidMealType('BREAKFAST')).toBe(false);
    });
  });

  describe('Type guards - isValidMealSource', () => {
    it('should validate correct meal sources', () => {
      expect(isValidMealSource('manual')).toBe(true);
      expect(isValidMealSource('ocr')).toBe(true);
      expect(isValidMealSource('barcode')).toBe(true);
      expect(isValidMealSource('api')).toBe(true);
    });

    it('should reject invalid meal sources', () => {
      expect(isValidMealSource('invalid')).toBe(false);
      expect(isValidMealSource('')).toBe(false);
      expect(isValidMealSource('MANUAL')).toBe(false);
    });
  });

  describe('Type guards - isOCRProcessingResult', () => {
    it('should validate correct OCRProcessingResult objects', () => {
      const validResult: OCRProcessingResult = {
        success: true,
        confidence: 80,
        extractedData: createEmptyExtractedMealData(),
      };

      expect(isOCRProcessingResult(validResult)).toBe(true);
    });

    it('should reject invalid objects', () => {
      expect(isOCRProcessingResult(null)).toBe(false);
      expect(isOCRProcessingResult({})).toBe(false);
      expect(isOCRProcessingResult({ success: true })).toBe(false);
      expect(isOCRProcessingResult({
        success: true,
        confidence: 150, // Invalid confidence
        extractedData: createEmptyExtractedMealData(),
      })).toBe(false);
    });
  });

  describe('OCR confidence range validation', () => {
    it('should accept confidence within valid range', () => {
      const validResult = createOCRProcessingResult(true, 75, createEmptyExtractedMealData());
      expect(validResult.confidence).toBeGreaterThanOrEqual(0);
      expect(validResult.confidence).toBeLessThanOrEqual(100);
    });

    it('should handle edge cases', () => {
      expect(() => createOCRProcessingResult(true, -1, createEmptyExtractedMealData())).not.toThrow();
      expect(() => createOCRProcessingResult(true, 101, createEmptyExtractedMealData())).not.toThrow();
    });
  });
});
