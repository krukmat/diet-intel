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
      const response = await apiService.get<{ meals: any[]; count: number }>(
        `/track/meals?limit=50`
      );

      return response.data.meals.map(meal => ({
        id: meal.id,
        userId: meal.userId,
        name: meal.meal_name || '',
        description: '',
        calories: meal.total_calories || 0,
        protein_g: meal.items?.[0]?.macros?.protein || 0,
        fat_g: meal.items?.[0]?.macros?.fat || 0,
        carbs_g: meal.items?.[0]?.macros?.carbs || 0,
        mealType: 'breakfast',
        timestamp: new Date(meal.timestamp || meal.created_at),
        photoUrl: meal.photo_url,
        barcode: meal.items?.[0]?.barcode,
        source: 'manual',
        createdAt: new Date(meal.created_at),
        updatedAt: new Date(meal.created_at)
      }));
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
        meal_name: mealData.name,
        items: [{
          barcode: mealData.barcode || '',
          name: mealData.name,
          serving: '1 serving',
          calories: mealData.calories,
          macros: {
            protein: mealData.protein_g,
            fat: mealData.fat_g,
            carbs: mealData.carbs_g
          }
        }],
        timestamp: new Date().toISOString(),
      };

      const response = await apiService.post<any>(`/track/meal`, payload);

      return {
        id: response.data.id,
        userId: response.data.userId,
        name: response.data.meal_name || '',
        description: '',
        calories: response.data.total_calories || 0,
        protein_g: response.data.items?.[0]?.macros?.protein || 0,
        fat_g: response.data.items?.[0]?.macros?.fat || 0,
        carbs_g: response.data.items?.[0]?.macros?.carbs || 0,
        mealType: 'breakfast',
        timestamp: new Date(response.data.timestamp || response.data.created_at),
        photoUrl: response.data.photo_url,
        barcode: response.data.items?.[0]?.barcode,
        source: 'manual',
        createdAt: new Date(response.data.created_at),
        updatedAt: new Date(response.data.created_at)
      };
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
      await apiService.put(`/track/meal/${id}`, mealData);
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
      await apiService.delete(`/track/meal/${id}`);
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
    if (data.calories !== undefined && (data.calories < 0 || data.calories > 5000)) {
      errors.push('Calories must be between 0 and 5000');
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
