import { VisionLogService } from '../services/VisionLogService';
import { apiService } from '../services/ApiService';
import type {
  VisionLogResponse,
  UploadVisionRequest,
  CorrectionRequest,
  VisionHistoryParams,
  VisionErrorResponse,
} from '../types/visionLog';

// Mock the ApiService
jest.mock('../services/ApiService');
const mockApiService = apiService as jest.Mocked<typeof apiService>;

describe('VisionLogService', () => {
  let visionLogService: VisionLogService;
  let mockFormData: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock FormData
    mockFormData = {
      append: jest.fn(),
    };
    global.FormData = jest.fn(() => mockFormData) as any;
    visionLogService = new VisionLogService();
  });

  describe('uploadImageForAnalysis', () => {
    const mockRequest: UploadVisionRequest = {
      image: 'base64_image_data',
      meal_type: 'lunch',
      user_context: {
        current_weight_kg: 70,
        activity_level: 'moderately_active',
        goal: 'lose_weight',
      },
    };

    const mockResponse: VisionLogResponse = {
      id: 'vision_log_123',
      user_id: 'user_456',
      image_url: 'https://example.com/image.jpg',
      meal_type: 'lunch',
      identified_ingredients: [
        {
          name: 'chicken breast',
          category: 'protein',
          estimated_grams: 200,
          confidence_score: 0.85,
          nutrition_per_100g: {
            calories: 165,
            protein_g: 31,
            fat_g: 3.6,
            carbs_g: 0,
          },
        },
      ],
      estimated_portions: {
        total_calories: 330,
        total_protein_g: 62,
        total_fat_g: 7.2,
        total_carbs_g: 0,
        confidence_score: 0.85,
      },
      nutritional_analysis: {
        total_calories: 330,
        macro_distribution: {
          protein_percent: 75,
          fat_percent: 20,
          carbs_percent: 5,
        },
        food_quality_score: 8.5,
        health_benefits: ['High protein content', 'Low fat'],
      },
      exercise_suggestions: [
        {
          activity_type: 'walking',
          duration_minutes: 30,
          estimated_calories_burned: 150,
          intensity_level: 'moderate',
          reasoning: 'To balance the calorie intake',
          health_benefits: ['Cardiovascular health', 'Weight management'],
        },
      ],
      created_at: '2025-01-07T12:00:00Z',
      processing_time_ms: 1500,
    };

    it('should successfully upload image and return analysis result', async () => {
      mockApiService.post.mockResolvedValueOnce({
        data: mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await visionLogService.uploadImageForAnalysis(mockRequest);

      expect(mockFormData.append).toHaveBeenCalledWith('image', mockRequest.image);
      expect(mockFormData.append).toHaveBeenCalledWith('meal_type', mockRequest.meal_type);
      expect(mockFormData.append).toHaveBeenCalledWith('user_context', JSON.stringify(mockRequest.user_context));

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/food/vision-log',
        mockFormData,
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle missing optional parameters', async () => {
      const minimalRequest: UploadVisionRequest = {
        image: 'base64_image_data',
      };

      mockApiService.post.mockResolvedValueOnce({
        data: mockResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await visionLogService.uploadImageForAnalysis(minimalRequest);

      expect(mockFormData.append).toHaveBeenCalledWith('image', minimalRequest.image);
      expect(mockFormData.append).not.toHaveBeenCalledWith('meal_type', expect.anything());
      expect(mockFormData.append).not.toHaveBeenCalledWith('user_context', expect.anything());

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/food/vision-log',
        mockFormData,
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors gracefully', async () => {
      const mockError: VisionErrorResponse = {
        error: 'Image processing failed',
        detail: 'Invalid image format',
        error_code: 'INVALID_IMAGE',
      };

      const axiosError = {
        response: {
          data: mockError,
          status: 400,
          statusText: 'Bad Request',
        },
        isAxiosError: true,
      };

      mockApiService.post.mockRejectedValueOnce(axiosError);

      await expect(visionLogService.uploadImageForAnalysis(mockRequest))
        .rejects.toBe(axiosError);

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/food/vision-log',
        mockFormData,
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        })
      );
    });

    it('should handle network errors', async () => {
      mockApiService.post.mockRejectedValueOnce(new Error('Network Error'));

      await expect(visionLogService.uploadImageForAnalysis(mockRequest))
        .rejects.toThrow('Network Error');
    });
  });

  describe('getAnalysisHistory', () => {
    const mockHistoryParams: VisionHistoryParams = {
      limit: 10,
      offset: 0,
      date_from: '2025-01-01',
      date_to: '2025-01-07',
    };

    const mockHistoryResponse: VisionLogResponse[] = [
      {
        id: 'vision_log_123',
        user_id: 'user_456',
        image_url: 'https://example.com/image1.jpg',
        meal_type: 'lunch',
        identified_ingredients: [],
        estimated_portions: {
          total_calories: 500,
          total_protein_g: 30,
          total_fat_g: 20,
          total_carbs_g: 50,
          confidence_score: 0.9,
        },
        nutritional_analysis: {
          total_calories: 500,
          macro_distribution: {
            protein_percent: 24,
            fat_percent: 36,
            carbs_percent: 40,
          },
          food_quality_score: 7.5,
          health_benefits: [],
        },
        exercise_suggestions: [],
        created_at: '2025-01-07T12:00:00Z',
        processing_time_ms: 1200,
      },
    ];

    const mockApiResponse = {
      data: {
        logs: mockHistoryResponse,
        total_count: 1,
        has_more: false,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should fetch analysis history with parameters', async () => {
      mockApiService.get.mockResolvedValueOnce(mockApiResponse);

      const result = await visionLogService.getAnalysisHistory(mockHistoryParams);

      expect(mockApiService.get).toHaveBeenCalledWith(
        '/food/vision-history',
        expect.objectContaining({
          params: mockHistoryParams,
        })
      );

      expect(result).toEqual({
        logs: mockHistoryResponse,
        total_count: 1,
        has_more: false,
      });
    });

    it('should handle default parameters', async () => {
      mockApiService.get.mockResolvedValueOnce(mockApiResponse);

      const result = await visionLogService.getAnalysisHistory();

      expect(mockApiService.get).toHaveBeenCalledWith(
        '/food/vision-history',
        expect.objectContaining({
          params: {
            limit: 20,
            offset: 0,
          },
        })
      );

      expect(result).toEqual({
        logs: mockHistoryResponse,
        total_count: 1,
        has_more: false,
      });
    });

    it('should handle API errors', async () => {
      mockApiService.get.mockRejectedValueOnce(new Error('API Error'));

      await expect(visionLogService.getAnalysisHistory())
        .rejects.toThrow('API Error');
    });
  });

  describe('submitCorrection', () => {
    const mockCorrectionRequest: CorrectionRequest = {
      log_id: 'vision_log_123',
      corrections: [
        {
          ingredient_name: 'chicken breast',
          estimated_grams: 200,
          actual_grams: 250,
        },
      ],
      feedback_type: 'portion_correction',
    };

    const mockCorrectionResponse = {
      success: true,
      message: 'Correction applied successfully',
      improvement_score: 0.1,
    };

    it('should successfully submit correction', async () => {
      mockApiService.put.mockResolvedValueOnce({
        data: mockCorrectionResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const result = await visionLogService.submitCorrection(mockCorrectionRequest);

      expect(mockApiService.put).toHaveBeenCalledWith(
        `/food/vision-log/${mockCorrectionRequest.log_id}/correct`,
        {
          corrections: mockCorrectionRequest.corrections,
          feedback_type: mockCorrectionRequest.feedback_type
        }
      );

      expect(result).toEqual(mockCorrectionResponse);
    });

    it('should handle correction errors', async () => {
      mockApiService.put.mockRejectedValueOnce(new Error('Correction failed'));

      await expect(visionLogService.submitCorrection(mockCorrectionRequest))
        .rejects.toThrow('Correction failed');
    });

    it('should validate upload request successfully', () => {
      const validRequest: UploadVisionRequest = {
        image: 'base64_image_data',
        meal_type: 'lunch',
        user_context: {
          current_weight_kg: 70,
          activity_level: 'moderately_active',
          goal: 'lose_weight',
        },
      };

      const result = visionLogService.validateUploadRequest(validRequest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate upload request with errors', () => {
      const invalidRequest = {
        image: '',
        meal_type: 'invalid_meal' as any,
        user_context: {
          current_weight_kg: -10,
          activity_level: 'invalid_activity' as any,
          goal: 'invalid_goal' as any,
        },
      } as UploadVisionRequest;

      const result = visionLogService.validateUploadRequest(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should get supported meal types', () => {
      const supportedTypes = visionLogService.getSupportedMealTypes();
      expect(supportedTypes).toEqual(['breakfast', 'lunch', 'dinner']);
    });

    it('should get supported activity levels', () => {
      const supportedLevels = visionLogService.getSupportedActivityLevels();
      expect(supportedLevels).toEqual(['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active']);
    });

    it('should get supported goals', () => {
      const supportedGoals = visionLogService.getSupportedGoals();
      expect(supportedGoals).toEqual(['lose_weight', 'maintain', 'gain_weight']);
    });
  });
});
