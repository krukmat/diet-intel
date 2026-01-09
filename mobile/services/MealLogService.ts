/**
 * Meal Log Service - Data access layer for meal logging
 * Following TDD approach: Define contracts first, then implement
 */

import { apiService } from './ApiService';
import {
  MealEntry,
  CreateMealRequest,
  UpdateMealRequest,
  MealLogFilters,
  MealLogStats,
} from '../types/mealLog';
import { OCRMealRequest, OCRProcessingResult } from '../types/ocrMeal';

export class MealLogService {
  private readonly baseUrl = '/meals';

  constructor() {
    // Service initialization if needed
  }

  /**
   * Get all meals for a user with optional filters
   */
  async getMeals(userId: string, filters?: MealLogFilters): Promise<MealEntry[]> {
    try {
      const params = new URLSearchParams();
      params.append('user_id', userId);

      if (filters?.date) {
        params.append('date', filters.date.toISOString().split('T')[0]);
      }
      if (filters?.mealType) {
        params.append('meal_type', filters.mealType);
      }
      if (filters?.source) {
        params.append('source', filters.source);
      }
      if (filters?.minCalories) {
        params.append('min_calories', filters.minCalories.toString());
      }
      if (filters?.maxCalories) {
        params.append('max_calories', filters.maxCalories.toString());
      }

      const response = await apiService.get<MealEntry[]>(
        `${this.baseUrl}?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error('MealLogService.getMeals failed:', error);
      throw new Error('Failed to load meals');
    }
  }

  /**
   * Create a new meal entry
   */
  async createMeal(mealData: CreateMealRequest): Promise<MealEntry> {
    try {
      const payload = {
        ...mealData,
        timestamp: new Date().toISOString(),
      };

      const response = await apiService.post<MealEntry>(this.baseUrl, payload);

      return response.data;
    } catch (error) {
      console.error('MealLogService.createMeal failed:', error);
      throw new Error('Failed to create meal');
    }
  }

  /**
   * Update an existing meal entry
   */
  async updateMeal(id: string, mealData: UpdateMealRequest): Promise<void> {
    try {
      await apiService.put(`${this.baseUrl}/${id}`, mealData);
    } catch (error) {
      console.error('MealLogService.updateMeal failed:', error);
      throw new Error('Failed to update meal');
    }
  }

  /**
   * Delete a meal entry
   */
  async deleteMeal(id: string): Promise<void> {
    try {
      await apiService.delete(`${this.baseUrl}/${id}`);
    } catch (error) {
      console.error('MealLogService.deleteMeal failed:', error);
      throw new Error('Failed to delete meal');
    }
  }

  /**
   * Upload meal photo and return URL
   */
  async uploadMealPhoto(imageUri: string): Promise<string> {
    try {
      const formData = new FormData();

      // Create file object from URI
      const filename = imageUri.split('/').pop() || 'meal-photo.jpg';
      const file = {
        uri: imageUri,
        name: filename,
        type: 'image/jpeg',
      } as any;

      formData.append('photo', file);

      const response = await apiService.post<{ photoUrl: string }>(
        '/upload/meal-photo',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data.photoUrl;
    } catch (error) {
      console.error('MealLogService.uploadMealPhoto failed:', error);
      throw new Error('Failed to upload meal photo');
    }
  }

  /**
   * Process OCR on meal image (optional feature)
   */
  async processOCR(request: OCRMealRequest): Promise<OCRProcessingResult> {
    try {
      const formData = new FormData();

      const filename = request.imageUri.split('/').pop() || 'ocr-image.jpg';
      const file = {
        uri: request.imageUri,
        name: filename,
        type: 'image/jpeg',
      } as any;

      formData.append('image', file);
      formData.append('meal_type', request.mealType || '');
      formData.append('expected_language', request.expectedLanguage || 'es');

      if (request.processingOptions) {
        Object.entries(request.processingOptions).forEach(([key, value]) => {
          if (value !== undefined) {
            formData.append(key, value.toString());
          }
        });
      }

      const response = await apiService.post<OCRProcessingResult>(
        '/ocr/process-meal',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000, // 30 seconds for OCR processing
        }
      );

      return response.data;
    } catch (error) {
      console.error('MealLogService.processOCR failed:', error);
      // Return failed result instead of throwing
      return {
        success: false,
        confidence: 0,
        extractedData: {
          name: undefined,
          calories: undefined,
          protein_g: undefined,
          fat_g: undefined,
          carbs_g: undefined,
        },
        error: error instanceof Error ? error.message : 'OCR processing failed',
      };
    }
  }

  /**
   * Get meal statistics
   */
  async getMealStats(userId: string, dateRange?: { start: Date; end: Date }): Promise<MealLogStats> {
    try {
      const params = new URLSearchParams();
      params.append('user_id', userId);

      if (dateRange) {
        params.append('start_date', dateRange.start.toISOString().split('T')[0]);
        params.append('end_date', dateRange.end.toISOString().split('T')[0]);
      }

      const response = await apiService.get<MealLogStats>(
        `/meals/stats?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error('MealLogService.getMealStats failed:', error);
      throw new Error('Failed to load meal statistics');
    }
  }

  /**
   * Validate meal data before operations
   */
  validateMealData(data: Partial<CreateMealRequest>): string[] {
    const errors: string[] = [];

    if (!data.name?.trim()) {
      errors.push('Name is required');
    } else if (data.name.length > 100) {
      errors.push('Name must be less than 100 characters');
    }

    if (data.calories !== undefined) {
      if (data.calories < 0) {
        errors.push('Calories cannot be negative');
      } else if (data.calories > 5000) {
        errors.push('Calories cannot exceed 5000');
      }
    }

    if (data.protein_g !== undefined) {
      if (data.protein_g < 0) {
        errors.push('Protein cannot be negative');
      } else if (data.protein_g > 500) {
        errors.push('Protein cannot exceed 500g');
      }
    }

    if (data.fat_g !== undefined) {
      if (data.fat_g < 0) {
        errors.push('Fat cannot be negative');
      } else if (data.fat_g > 500) {
        errors.push('Fat cannot exceed 500g');
      }
    }

    if (data.carbs_g !== undefined) {
      if (data.carbs_g < 0) {
        errors.push('Carbs cannot be negative');
      } else if (data.carbs_g > 1000) {
        errors.push('Carbs cannot exceed 1000g');
      }
    }

    if (data.barcode && !/^\d{8,18}$/.test(data.barcode)) {
      errors.push('Barcode must be 8-18 digits');
    }

    return errors;
  }

  /**
   * Sanitize meal data
   */
  sanitizeMealData(data: CreateMealRequest): CreateMealRequest {
    return {
      ...data,
      name: data.name.trim(),
      description: data.description?.trim(),
      barcode: data.barcode?.trim(),
    };
  }
}

// Create singleton instance
export const mealLogService = new MealLogService();
