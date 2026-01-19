import { apiService } from './ApiService';
import type {
  VisionLogResponse,
  UploadVisionRequest,
  CorrectionRequest,
  VisionHistoryParams,
  VisionHistoryState,
  VisionErrorResponse,
} from '../types/visionLog';

export class VisionLogService {
  private apiService = apiService;
  /**
   * Upload image for vision analysis
   * @param request UploadVisionRequest with image data and context
   * @returns Promise<VisionLogResponse>
   */
  async uploadImageForAnalysis(request: UploadVisionRequest): Promise<VisionLogResponse> {
    try {
      const formData = new FormData();
      const file = {
        uri: request.imageUri,
        name: 'vision.jpg',
        type: 'image/jpeg',
      };

      // Add image data
      formData.append('file', file as any);

      // Add optional meal type
      if (request.meal_type) {
        formData.append('meal_type', request.meal_type);
      }

      // Add optional user context as separate fields for backend compatibility
      if (request.user_context?.current_weight_kg !== undefined) {
        formData.append('current_weight_kg', String(request.user_context.current_weight_kg));
      }
      if (request.user_context?.activity_level) {
        formData.append('activity_level', request.user_context.activity_level);
      }
      if (request.user_context?.goal) {
        formData.append('goal', request.user_context.goal);
      }

      const response = await this.apiService.post('/api/v1/food/vision/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 seconds for image processing
      });

      return response.data;
    } catch (error) {
      console.error('Vision analysis upload failed:', error);
      throw error;
    }
  }

  /**
   * Get analysis history for the current user
   * @param params Optional pagination and filter parameters
   * @returns Promise<VisionHistoryState>
   */
  async getAnalysisHistory(params?: VisionHistoryParams): Promise<VisionHistoryState> {
    try {
      const defaultParams = {
        limit: 20,
        offset: 0,
        ...params,
      };

      const response = await this.apiService.get('/api/v1/food/vision/history', {
        params: defaultParams,
      });

      return response.data;
    } catch (error) {
      console.error('Fetching vision history failed:', error);
      throw error;
    }
  }

  /**
   * Submit corrections for a vision analysis
   * @param correctionData Correction data (including log_id)
   * @returns Promise<any>
   */
  async submitCorrection(correctionData: CorrectionRequest): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('log_id', correctionData.log_id);
      formData.append('feedback_type', correctionData.feedback_type);

      const correctionNotes =
        correctionData.correction_notes ??
        (correctionData.corrections.length > 0
          ? JSON.stringify(correctionData.corrections)
          : '');
      if (correctionNotes) {
        formData.append('correction_notes', correctionNotes);
      }

      const response = await this.apiService.post('/api/v1/food/vision/correction', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Submitting correction failed:', error);
      throw error;
    }
  }

  /**
   * Check if the service is available
   * @returns Promise<boolean>
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      await this.apiService.get('/api/v1/food/vision/health');
      return true;
    } catch (error) {
      console.warn('Vision service health check failed:', error);
      return false;
    }
  }

  /**
   * Get supported meal types
   * @returns string[]
   */
  getSupportedMealTypes(): string[] {
    return ['breakfast', 'lunch', 'dinner'];
  }

  /**
   * Get supported activity levels for user context
   * @returns string[]
   */
  getSupportedActivityLevels(): string[] {
    return ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'];
  }

  /**
   * Get supported goals for user context
   * @returns string[]
   */
  getSupportedGoals(): string[] {
    return ['lose_weight', 'maintain', 'gain_weight'];
  }

  /**
   * Validate upload request before sending
   * @param request UploadVisionRequest
   * @returns { isValid: boolean; errors: string[] }
   */
  validateUploadRequest(request: UploadVisionRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate image
    if (!request.imageUri || request.imageUri.trim().length === 0) {
      errors.push('Image URI is required');
    }

    // Validate meal type if provided
    if (request.meal_type && !this.getSupportedMealTypes().includes(request.meal_type)) {
      errors.push(`Invalid meal type. Supported types: ${this.getSupportedMealTypes().join(', ')}`);
    }

    // Validate user context if provided
    if (request.user_context) {
      const { current_weight_kg, activity_level, goal } = request.user_context;

      if (current_weight_kg !== undefined && (current_weight_kg <= 0 || current_weight_kg > 500)) {
        errors.push('Current weight must be between 1-500 kg');
      }

      if (activity_level && !this.getSupportedActivityLevels().includes(activity_level)) {
        errors.push(`Invalid activity level. Supported levels: ${this.getSupportedActivityLevels().join(', ')}`);
      }

      if (goal && !this.getSupportedGoals().includes(goal)) {
        errors.push(`Invalid goal. Supported goals: ${this.getSupportedGoals().join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Create and export a singleton instance
export const visionLogService = new VisionLogService();
