/**
 * Tests for MealLogService - TDD approach
 * Testing data access layer with mocked API calls
 */

import { MealLogService } from '../MealLogService';
import { apiService } from '../ApiService';
import {
  MealEntry,
  CreateMealRequest,
  UpdateMealRequest,
  MealLogFilters,
  MealType,
  MealSource,
} from '../../types/mealLog';
import { OCRMealRequest, OCRProcessingResult } from '../../types/ocrMeal';

// Mock the API service
jest.mock('../ApiService');
const mockApiService = apiService as jest.Mocked<typeof apiService>;

describe('MealLogService - TDD Validation', () => {
  let service: MealLogService;
  let mockMeal: MealEntry;

  beforeEach(() => {
    service = new MealLogService();
    mockMeal = {
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

    jest.clearAllMocks();
  });

  describe('Constructor and initialization', () => {
    it('should create service instance correctly', () => {
      expect(service).toBeInstanceOf(MealLogService);
      expect(service).toHaveProperty('getMeals');
      expect(service).toHaveProperty('createMeal');
      expect(service).toHaveProperty('updateMeal');
      expect(service).toHaveProperty('deleteMeal');
    });
  });

  describe('getMeals method', () => {
    it('should call API with correct endpoint and return meals', async () => {
      const mockMeals = [mockMeal];
      mockApiService.get.mockResolvedValueOnce({
        data: mockMeals,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { url: '/meals' } as any,
      });

      const result = await service.getMeals('user-456');

      expect(mockApiService.get).toHaveBeenCalledWith('/meals?user_id=user-456');
      expect(result).toEqual(mockMeals);
    });

    it('should apply filters correctly in API call', async () => {
      const filters: MealLogFilters = {
        date: new Date('2024-01-01'),
        mealType: 'lunch' as MealType,
        source: 'manual' as MealSource,
        minCalories: 100,
        maxCalories: 500,
      };

      mockApiService.get.mockResolvedValueOnce({
        data: [mockMeal],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { url: '/meals' } as any,
      });

      await service.getMeals('user-456', filters);

      const expectedUrl = '/meals?user_id=user-456&date=2024-01-01&meal_type=lunch&source=manual&min_calories=100&max_calories=500';
      expect(mockApiService.get).toHaveBeenCalledWith(expectedUrl);
    });

    it('should handle API errors and throw user-friendly error', async () => {
      mockApiService.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.getMeals('user-456')).rejects.toThrow('Failed to load meals');
      expect(mockApiService.get).toHaveBeenCalledWith('/meals?user_id=user-456');
    });
  });

  describe('createMeal method', () => {
    it('should send correct data to API and return created meal', async () => {
      const createData: CreateMealRequest = {
        name: 'New Meal',
        calories: 300,
        protein_g: 25,
        fat_g: 10,
        carbs_g: 30,
        mealType: 'dinner' as MealType,
        source: 'manual' as MealSource,
      };

      const createdMeal = { ...mockMeal, ...createData, id: 'new-meal-id' };

      mockApiService.post.mockResolvedValueOnce({
        data: createdMeal,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: { url: '/meals' } as any,
      });

      const result = await service.createMeal(createData);

      expect(mockApiService.post).toHaveBeenCalledWith('/meals', {
        ...createData,
        timestamp: expect.any(String), // Should add timestamp
      });
      expect(result).toEqual(createdMeal);
    });

    it('should handle API errors and throw user-friendly error', async () => {
      const createData: CreateMealRequest = {
        name: 'Test Meal',
        calories: 200,
        protein_g: 20,
        fat_g: 10,
        carbs_g: 15,
        mealType: 'breakfast' as MealType,
        source: 'manual' as MealSource,
      };

      mockApiService.post.mockRejectedValueOnce(new Error('Server error'));

      await expect(service.createMeal(createData)).rejects.toThrow('Failed to create meal');
    });
  });

  describe('updateMeal method', () => {
    it('should call API with correct endpoint and data', async () => {
      const updateData: UpdateMealRequest = {
        name: 'Updated Meal',
        calories: 400,
      };

      mockApiService.put.mockResolvedValueOnce({
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { url: '/meals/meal-123' } as any,
      });

      await service.updateMeal('meal-123', updateData);

      expect(mockApiService.put).toHaveBeenCalledWith('/meals/meal-123', updateData);
    });

    it('should handle API errors and throw user-friendly error', async () => {
      const updateData: UpdateMealRequest = { calories: 300 };

      mockApiService.put.mockRejectedValueOnce(new Error('Update failed'));

      await expect(service.updateMeal('meal-123', updateData)).rejects.toThrow('Failed to update meal');
    });
  });

  describe('deleteMeal method', () => {
    it('should call API with correct endpoint', async () => {
      mockApiService.delete.mockResolvedValueOnce({
        data: {},
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: { url: '/meals/meal-123' } as any,
      });

      await service.deleteMeal('meal-123');

      expect(mockApiService.delete).toHaveBeenCalledWith('/meals/meal-123');
    });

    it('should handle API errors and throw user-friendly error', async () => {
      mockApiService.delete.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(service.deleteMeal('meal-123')).rejects.toThrow('Failed to delete meal');
    });
  });

  describe('uploadMealPhoto method', () => {
    it('should upload photo and return URL', async () => {
      const imageUri = 'file:///path/to/photo.jpg';
      const expectedUrl = 'https://cdn.example.com/photos/meal-123.jpg';

      // Mock FormData
      const mockFormData = {
        append: jest.fn(),
      };
      global.FormData = jest.fn(() => mockFormData) as any;

      mockApiService.post.mockResolvedValueOnce({
        data: { photoUrl: expectedUrl },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { url: '/upload/meal-photo' } as any,
      });

      const result = await service.uploadMealPhoto(imageUri);

      expect(mockFormData.append).toHaveBeenCalledWith('photo', {
        uri: imageUri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });
      expect(mockApiService.post).toHaveBeenCalledWith(
        '/upload/meal-photo',
        mockFormData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      expect(result).toBe(expectedUrl);
    });

    it('should handle API errors and throw user-friendly error', async () => {
      const imageUri = 'file:///path/to/photo.jpg';

      mockApiService.post.mockRejectedValueOnce(new Error('Upload failed'));

      await expect(service.uploadMealPhoto(imageUri)).rejects.toThrow('Failed to upload meal photo');
    });
  });

  describe('processOCR method', () => {
    it('should process OCR and return successful result', async () => {
      const ocrRequest: OCRMealRequest = {
        imageUri: 'file:///path/to/label.jpg',
        mealType: 'lunch' as MealType,
        expectedLanguage: 'es',
        processingOptions: {
          enhanceImage: true,
          confidenceThreshold: 80,
        },
      };

      const expectedResult: OCRProcessingResult = {
        success: true,
        confidence: 85,
        extractedData: {
          name: 'Chicken Breast',
          calories: 250,
          protein_g: 30,
          fat_g: 10,
          carbs_g: 0,
        },
        rawText: 'Extracted nutrition data...',
      };

      // Mock FormData
      const mockFormData = {
        append: jest.fn(),
      };
      global.FormData = jest.fn(() => mockFormData) as any;

      mockApiService.post.mockResolvedValueOnce({
        data: expectedResult,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { url: '/ocr/process-meal' } as any,
      });

      const result = await service.processOCR(ocrRequest);

      expect(mockFormData.append).toHaveBeenCalledWith('image', {
        uri: 'file:///path/to/label.jpg',
        name: 'label.jpg',
        type: 'image/jpeg',
      });
      expect(mockFormData.append).toHaveBeenCalledWith('meal_type', 'lunch');
      expect(mockFormData.append).toHaveBeenCalledWith('expected_language', 'es');
      expect(mockFormData.append).toHaveBeenCalledWith('enhanceImage', 'true');
      expect(mockFormData.append).toHaveBeenCalledWith('confidenceThreshold', '80');

      expect(result).toEqual(expectedResult);
    });

    it('should return failed result when OCR API fails', async () => {
      const ocrRequest: OCRMealRequest = {
        imageUri: 'file:///path/to/label.jpg',
      };

      mockApiService.post.mockRejectedValueOnce(new Error('OCR service unavailable'));

      const result = await service.processOCR(ocrRequest);

      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.error).toBe('OCR service unavailable');
      expect(result.extractedData.name).toBeUndefined();
    });
  });

  describe('validateMealData method', () => {
    it('should return empty array for valid data', () => {
      const validData: Partial<CreateMealRequest> = {
        name: 'Valid Meal',
        calories: 300,
        protein_g: 25,
        fat_g: 10,
        carbs_g: 30,
        barcode: '1234567890123',
      };

      const errors = service.validateMealData(validData);

      expect(errors).toEqual([]);
    });

    it('should validate required name field', () => {
      const invalidData = { calories: 300 };

      const errors = service.validateMealData(invalidData);

      expect(errors).toContain('Name is required');
    });

    it('should validate name length', () => {
      const longName = 'a'.repeat(101);
      const invalidData = { name: longName };

      const errors = service.validateMealData(invalidData);

      expect(errors).toContain('Name must be less than 100 characters');
    });

    it('should validate numeric fields ranges', () => {
      const invalidData = {
        name: 'Test',
        calories: -100, // Negative
        protein_g: 600, // Too high
        fat_g: -5, // Negative
        carbs_g: 1500, // Too high
      };

      const errors = service.validateMealData(invalidData);

      expect(errors).toContain('Calories cannot be negative');
      expect(errors).toContain('Protein cannot exceed 500g');
      expect(errors).toContain('Fat cannot be negative');
      expect(errors).toContain('Carbs cannot exceed 1000g');
    });

    it('should validate barcode format', () => {
      const invalidData = {
        name: 'Test',
        barcode: '123', // Too short
      };

      const errors = service.validateMealData(invalidData);

      expect(errors).toContain('Barcode must be 8-18 digits');
    });
  });

  describe('sanitizeMealData method', () => {
    it('should trim string fields', () => {
      const unsanitizedData: CreateMealRequest = {
        name: '  Chicken Salad  ',
        description: '  Fresh salad  ',
        calories: 350,
        protein_g: 30,
        fat_g: 15,
        carbs_g: 20,
        mealType: 'lunch' as MealType,
        source: 'manual' as MealSource,
        barcode: '  1234567890123  ',
      };

      const sanitized = service.sanitizeMealData(unsanitizedData);

      expect(sanitized.name).toBe('Chicken Salad');
      expect(sanitized.description).toBe('Fresh salad');
      expect(sanitized.barcode).toBe('1234567890123');
    });

    it('should handle undefined optional fields', () => {
      const dataWithUndefined: CreateMealRequest = {
        name: 'Test Meal',
        calories: 200,
        protein_g: 20,
        fat_g: 10,
        carbs_g: 15,
        mealType: 'breakfast' as MealType,
        source: 'manual' as MealSource,
        description: undefined,
        barcode: undefined,
        photoUrl: undefined,
      };

      const sanitized = service.sanitizeMealData(dataWithUndefined);

      expect(sanitized.description).toBeUndefined();
      expect(sanitized.barcode).toBeUndefined();
      expect(sanitized.photoUrl).toBeUndefined();
    });
  });

  describe('getMealStats method', () => {
    it('should call API with correct parameters', async () => {
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-07'),
      };

      const mockStats = {
        totalMeals: 10,
        totalCalories: 2500,
        averageCalories: 250,
        mealsByType: { breakfast: 3, lunch: 4, dinner: 3 },
        dateRange,
      };

      mockApiService.get.mockResolvedValueOnce({
        data: mockStats,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { url: '/meals/stats' } as any,
      });

      const result = await service.getMealStats('user-456', dateRange);

      const expectedUrl = '/meals/stats?user_id=user-456&start_date=2024-01-01&end_date=2024-01-07';
      expect(mockApiService.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockStats);
    });

    it('should handle API errors', async () => {
      mockApiService.get.mockRejectedValueOnce(new Error('Stats error'));

      await expect(service.getMealStats('user-456')).rejects.toThrow('Failed to load meal statistics');
    });
  });
});
