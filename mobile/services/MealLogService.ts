/**
 * Meal Log Service - Data access layer for meal logging
 * Following TDD approach: Define contracts first, then implement
 * FASE 8 & 9: Weight Tracking & Photo Logs integration
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
import { WeightEntry, CreateWeightRequest } from '../types/weight';
import { PhotoLogEntry } from '../types/photoLog';

export class MealLogService {
  private readonly baseUrl = '/track';

  constructor() {
    // Service initialization if needed
  }

  // ============ MEAL METHODS ============

  /**
   * Get all meals for a user with optional filters
   */
  async getMeals(userId: string, filters?: MealLogFilters): Promise<MealEntry[]> {
    try {
      const params = new URLSearchParams({ user_id: userId });

      if (filters) {
        if (filters.date) {
          params.append('date', filters.date.toISOString().split('T')[0]);
        }
        if (filters.mealType) {
          params.append('meal_type', filters.mealType);
        }
        if (filters.source) {
          params.append('source', filters.source);
        }
        if (filters.minCalories !== undefined) {
          params.append('min_calories', filters.minCalories.toString());
        }
        if (filters.maxCalories !== undefined) {
          params.append('max_calories', filters.maxCalories.toString());
        }
      }

      const url = `/meals?${params.toString()}`;
      const response = await apiService.get<MealEntry[]>(url);

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

      const response = await apiService.post<MealEntry>('/meals', payload);

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
      await apiService.put(`/meals/${id}`, mealData);
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
      await apiService.delete(`/meals/${id}`);
    } catch (error) {
      console.error('MealLogService.deleteMeal failed:', error);
      throw new Error('Failed to delete meal');
    }
  }

  // ============ WEIGHT METHODS (FASE 8.2) ============

  /**
   * Create a new weight entry
   */
  async createWeight(data: CreateWeightRequest): Promise<WeightEntry> {
    try {
      const payload = {
        weight: data.weight,
        date: data.date?.toISOString() || new Date().toISOString(),
      };

      if (data.photo) {
        const formData = new FormData();
        formData.append('weight', payload.weight.toString());
        formData.append('date', payload.date);
        
        const filename = data.photo.split('/').pop() || 'weight-photo.jpg';
        formData.append('photo', {
          uri: data.photo,
          name: filename,
          type: 'image/jpeg',
        } as any);

        const response = await apiService.post<any>('/track/weight', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        return this.transformWeightResponse(response.data);
      }

      const response = await apiService.post<any>('/track/weight', payload);
      return this.transformWeightResponse(response.data);
    } catch (error) {
      console.error('MealLogService.createWeight failed:', error);
      throw new Error('Failed to create weight entry');
    }
  }

  /**
   * Get weight history
   */
  async getWeightHistory(limit: number = 30): Promise<WeightEntry[]> {
    try {
      const response = await apiService.get<{ entries: any[]; count: number }>(
        `/track/weight/history?limit=${limit}`
      );

      return response.data.entries.map(entry => this.transformWeightResponse(entry));
    } catch (error) {
      console.error('MealLogService.getWeightHistory failed:', error);
      throw new Error('Failed to load weight history');
    }
  }

  /**
   * Transform backend weight response to frontend type
   */
  private transformWeightResponse(data: any): WeightEntry {
    return {
      id: data.id,
      userId: data.userId || '',
      weight: data.weight,
      date: new Date(data.date || data.created_at),
      photoUrl: data.photo_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.created_at)
    };
  }

  // ============ PHOTO LOG METHODS (FASE 9.2) ============

  /**
   * Get photo logs
   */
  async getPhotoLogs(limit: number = 50): Promise<PhotoLogEntry[]> {
    try {
      const response = await apiService.get<{ logs: any[]; count: number }>(
        `/track/photos?limit=${limit}`
      );

      return response.data.logs.map(log => ({
        id: log.id,
        timestamp: new Date(log.timestamp || log.date),
        photoUrl: log.photo_url,
        type: log.type || 'meal',
        description: log.description
      }));
    } catch (error) {
      console.error('MealLogService.getPhotoLogs failed:', error);
      throw new Error('Failed to load photo logs');
    }
  }

  // ============ OTHER METHODS ============

  /**
   * Upload meal photo and return URL
   */
  async uploadMealPhoto(imageUri: string): Promise<string> {
    try {
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'meal-photo.jpg';
      formData.append('photo', {
        uri: imageUri,
        name: filename,
        type: 'image/jpeg',
      } as any);

      const response = await apiService.post<{ photoUrl: string }>(
        '/upload/meal-photo',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      return response.data.photoUrl;
    } catch (error) {
      console.error('MealLogService.uploadMealPhoto failed:', error);
      throw new Error('Failed to upload meal photo');
    }
  }

  /**
   * Process OCR on meal image
   */
  async processOCR(request: OCRMealRequest): Promise<OCRProcessingResult> {
    try {
      const formData = new FormData();
      const filename = request.imageUri.split('/').pop() || 'ocr-image.jpg';
      formData.append('image', {
        uri: request.imageUri,
        name: filename,
        type: 'image/jpeg',
      } as any);
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
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 }
      );

      return response.data;
    } catch (error) {
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

      const response = await apiService.get<MealLogStats>(`/meals/stats?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('MealLogService.getMealStats failed:', error);
      throw new Error('Failed to load meal statistics');
    }
  }

  /**
   * Validate meal data
   */
  validateMealData(data: Partial<CreateMealRequest>): string[] {
    const errors: string[] = [];
    if (!data.name?.trim()) errors.push('Name is required');
    else if (data.name.length > 100) errors.push('Name must be less than 100 characters');
    if (data.calories !== undefined) {
      if (data.calories < 0) errors.push('Calories cannot be negative');
      else if (data.calories > 5000) errors.push('Calories cannot exceed 5000');
    }
    if (data.protein_g !== undefined) {
      if (data.protein_g < 0) {
        errors.push('Protein cannot be negative');
      } else if (data.protein_g > 500) {
        errors.push('Protein cannot exceed 500g');
      }
    }
    if (data.fat_g !== undefined && data.fat_g < 0) {
      errors.push('Fat cannot be negative');
    }
    if (data.carbs_g !== undefined && data.carbs_g > 1000) {
      errors.push('Carbs cannot exceed 1000g');
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

export const mealLogService = new MealLogService();
