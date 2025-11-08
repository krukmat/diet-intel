import {
  IntelligentFlowService,
  intelligentFlowService,
  type IntelligentFlowRequestPayload,
  type IntelligentFlowResponse,
  type IntelligentFlowJobStatus,
} from '../IntelligentFlowService';
import { apiService } from '../ApiService';
import { mockApiService } from '../../testUtils';

jest.mock('../ApiService', () => {
  const { mockApiService } = require('../../testUtils');
  return { apiService: mockApiService };
});

const mockedApiService = apiService as unknown as typeof mockApiService;

describe('IntelligentFlowService', () => {
  let service: IntelligentFlowService;

  const payload: IntelligentFlowRequestPayload = {
    image_base64: 'base64data',
    meal_type: 'lunch',
  };

  const mockResponse: IntelligentFlowResponse = {
    status: 'complete',
    vision_result: {
      id: 'vision-1',
      user_id: 'user-1',
      meal_type: 'lunch',
      identified_ingredients: [],
      estimated_portions: {},
      nutritional_analysis: {},
      exercise_suggestions: [],
      created_at: new Date().toISOString(),
      processing_time_ms: 1200,
    },
    recipe_result: null,
    smart_diet_result: null,
    timings: {},
    metadata: {
      user_id: 'user-1',
      meal_type: 'lunch',
      total_duration_ms: 1200,
      warnings: [],
    },
  };

  const mockJob: IntelligentFlowJobStatus = {
    job_id: 'job-1',
    status: 'queued',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    result: null,
    error: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = IntelligentFlowService.getInstance();
  });

  it('should return singleton instance', () => {
    const instanceA = IntelligentFlowService.getInstance();
    const instanceB = IntelligentFlowService.getInstance();
    expect(instanceA).toBe(instanceB);
    expect(intelligentFlowService).toBe(instanceA);
  });

  it('runFlow should POST to /intelligent-flow', async () => {
    mockedApiService.post.mockResolvedValueOnce({ data: mockResponse });

    const response = await service.runFlow(payload);

    expect(response).toEqual(mockResponse);
    expect(mockedApiService.post).toHaveBeenCalledWith('/intelligent-flow', payload);
  });

  it('startFlow should POST with async flag', async () => {
    mockedApiService.post.mockResolvedValueOnce({ data: mockJob });

    const job = await service.startFlow(payload);

    expect(job).toEqual(mockJob);
    expect(mockedApiService.post).toHaveBeenCalledWith('/intelligent-flow?async_mode=true', payload);
  });

  it('getJobStatus should fetch job metadata', async () => {
    mockedApiService.get.mockResolvedValueOnce({ data: mockJob });

    const job = await service.getJobStatus('job-1');

    expect(job).toEqual(mockJob);
    expect(mockedApiService.get).toHaveBeenCalledWith('/intelligent-flow/job-1');
  });
});
