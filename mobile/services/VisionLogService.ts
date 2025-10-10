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

      // Add image data
      formData.append('image', request.image);

      // Add optional meal type
      if (request.meal_type) {
        formData.append('meal_type', request.meal_type);
      }

      // Add optional user context
      if (request.user_context) {
        formData.append('user_context', JSON.stringify(request.user_context));
      }

      const response = await this.apiService.post('/food/vision-log', formData, {
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

      const response = await this.apiService.get('/food/vision-history', {
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
      const { log_id, ...dataToSend } = correctionData;
      const response = await this.apiService.put(`/food/vision-log/${log_id}/correct`, dataToSend);
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
      await this.apiService.get('/health');
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
    if (!request.image || request.image.trim().length === 0) {
      errors.push('Image data is required');
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
