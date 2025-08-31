import axios from 'axios';
import ApiService, { apiService } from '../ApiService';
import { environments } from '../../config/environments';

// Mock axios
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ApiService', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      },
      defaults: { baseURL: 'http://localhost:8000' }
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
  });

  describe('Constructor and Initialization', () => {
    it('should create instance with default environment', () => {
      const service = new ApiService();
      
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: environments.android_dev.apiBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should create instance with specified environment', () => {
      const service = new ApiService('production');
      
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: environments.production.apiBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should setup request and response interceptors', () => {
      const service = new ApiService();
      
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('Environment Management', () => {
    it('should switch environment correctly', () => {
      const service = new ApiService('dev');
      
      service.switchEnvironment('staging');
      
      // Should create new axios instance with staging URL
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: environments.staging.apiBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should return current environment info', () => {
      const service = new ApiService('qa');
      
      const envInfo = service.getCurrentEnvironment();
      
      expect(envInfo.name).toBe('qa');
      expect(envInfo.config).toEqual(environments.qa);
    });

    it('should log environment switch', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const service = new ApiService('dev');
      
      service.switchEnvironment('production');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "Switching API environment from 'dev' to 'production'"
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Generic HTTP Methods', () => {
    let service: ApiService;

    beforeEach(() => {
      service = new ApiService();
    });

    it('should call GET method correctly', async () => {
      const mockResponse = { data: { test: 'data' } };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.get('/test-endpoint');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-endpoint', undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should call POST method correctly', async () => {
      const mockResponse = { data: { id: 1 } };
      const testData = { name: 'test' };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await service.post('/test-endpoint', testData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test-endpoint', testData, undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should call PUT method correctly', async () => {
      const mockResponse = { data: { updated: true } };
      const testData = { name: 'updated' };
      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await service.put('/test-endpoint', testData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/test-endpoint', testData, undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should call DELETE method correctly', async () => {
      const mockResponse = { data: { deleted: true } };
      mockAxiosInstance.delete.mockResolvedValue(mockResponse);

      const result = await service.delete('/test-endpoint');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/test-endpoint', undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should call PATCH method correctly', async () => {
      const mockResponse = { data: { patched: true } };
      const testData = { field: 'value' };
      mockAxiosInstance.patch.mockResolvedValue(mockResponse);

      const result = await service.patch('/test-endpoint', testData);

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/test-endpoint', testData, undefined);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('DietIntel Specific API Methods', () => {
    let service: ApiService;

    beforeEach(() => {
      service = new ApiService();
    });

    describe('Product Methods', () => {
      it('should get product by barcode', async () => {
        const mockProduct = { code: '123456', name: 'Test Product' };
        mockAxiosInstance.get.mockResolvedValue({ data: mockProduct });

        const result = await service.getProductByBarcode('123456');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/product/by-barcode/123456');
        expect(result.data).toEqual(mockProduct);
      });

      it('should scan nutrition label', async () => {
        const mockFormData = new FormData();
        const mockResponse = { data: { confidence: 0.8 } };
        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        const result = await service.scanNutritionLabel(mockFormData);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/product/scan-label', mockFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        });
        expect(result).toEqual(mockResponse);
      });

      it('should scan nutrition label with external OCR', async () => {
        const mockFormData = new FormData();
        const mockResponse = { data: { confidence: 0.9 } };
        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        const result = await service.scanNutritionLabelExternal(mockFormData);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/product/scan-label-external', mockFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 45000
        });
        expect(result).toEqual(mockResponse);
      });

      it('should search product by query', async () => {
        const mockResults = [{ name: 'Product 1' }, { name: 'Product 2' }];
        mockAxiosInstance.get.mockResolvedValue({ data: mockResults });

        const result = await service.searchProduct('test query');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/product/search?q=test%20query');
        expect(result.data).toEqual(mockResults);
      });

      it('should encode special characters in search query', async () => {
        mockAxiosInstance.get.mockResolvedValue({ data: [] });

        await service.searchProduct('coffee & tea');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/product/search?q=coffee%20%26%20tea');
      });
    });

    describe('Meal Planning Methods', () => {
      it('should generate meal plan', async () => {
        const mockRequest = {
          user_profile: { age: 30, sex: 'male' },
          preferences: {}
        };
        const mockPlan = { daily_calorie_target: 2000 };
        mockAxiosInstance.post.mockResolvedValue({ data: mockPlan });

        const result = await service.generateMealPlan(mockRequest);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/plan/generate', mockRequest);
        expect(result.data).toEqual(mockPlan);
      });

      it('should customize meal plan', async () => {
        const mockCustomizeData = {
          meal_type: 'breakfast',
          action: 'add',
          item: { name: 'Oatmeal' }
        };
        const mockResponse = { data: { success: true } };
        mockAxiosInstance.put.mockResolvedValue(mockResponse);

        const result = await service.customizeMealPlan(mockCustomizeData);

        expect(mockAxiosInstance.put).toHaveBeenCalledWith('/plan/customize', mockCustomizeData);
        expect(result).toEqual(mockResponse);
      });

      it('should get meal plan config', async () => {
        const mockConfig = { meal_distribution: { breakfast: 0.25 } };
        mockAxiosInstance.get.mockResolvedValue({ data: mockConfig });

        const result = await service.getMealPlanConfig();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/plan/config');
        expect(result.data).toEqual(mockConfig);
      });
    });

    describe('Health Check', () => {
      it('should return healthy status on successful response', async () => {
        const mockHealthData = { status: 'ok', version: '1.0.0' };
        mockAxiosInstance.get.mockResolvedValue({ data: mockHealthData });

        const result = await service.healthCheck();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health', { timeout: 5000 });
        expect(result).toEqual({
          healthy: true,
          status: 'ok',
          version: '1.0.0'
        });
      });

      it('should return unhealthy status on error', async () => {
        const error = new Error('Connection timeout');
        mockAxiosInstance.get.mockRejectedValue(error);

        const result = await service.healthCheck();

        expect(result).toEqual({
          healthy: false,
          error: 'Connection timeout'
        });
      });

      it('should handle unknown error types', async () => {
        mockAxiosInstance.get.mockRejectedValue('String error');

        const result = await service.healthCheck();

        expect(result).toEqual({
          healthy: false,
          error: 'Unknown error'
        });
      });
    });
  });

  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      expect(apiService).toBeInstanceOf(ApiService);
    });

    it('should allow environment switching on singleton', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      apiService.switchEnvironment('staging');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Switching API environment")
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    let service: ApiService;

    beforeEach(() => {
      service = new ApiService();
    });

    it('should propagate errors from HTTP methods', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(service.get('/test')).rejects.toThrow('Network error');
    });

    it('should handle axios errors with response', async () => {
      const axiosError = {
        response: { status: 404, data: { message: 'Not found' } },
        config: { url: '/test' },
        message: 'Request failed'
      };
      mockAxiosInstance.post.mockRejectedValue(axiosError);

      await expect(service.post('/test', {})).rejects.toEqual(axiosError);
    });
  });

  describe('Request Interceptors', () => {
    it('should log requests when interceptor is called', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const service = new ApiService('dev');
      
      // Get the request interceptor function
      const [[onFulfilled]] = mockAxiosInstance.interceptors.request.use.mock.calls;
      
      const mockConfig = {
        method: 'get',
        url: '/test-endpoint'
      };

      const result = onFulfilled(mockConfig);

      expect(consoleSpy).toHaveBeenCalledWith(
        'API Request: GET /test-endpoint',
        {
          environment: 'dev',
          baseURL: mockAxiosInstance.defaults.baseURL
        }
      );
      expect(result).toBe(mockConfig);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Response Interceptors', () => {
    it('should log successful responses', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const service = new ApiService();
      
      // Get the response interceptor success function
      const [[onFulfilled]] = mockAxiosInstance.interceptors.response.use.mock.calls;
      
      const mockResponse = {
        status: 200,
        config: { url: '/test-endpoint' }
      };

      const result = onFulfilled(mockResponse);

      expect(consoleSpy).toHaveBeenCalledWith('API Response: 200 /test-endpoint');
      expect(result).toBe(mockResponse);
      
      consoleSpy.mockRestore();
    });

    it('should log error responses', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const service = new ApiService('staging');
      
      // Get the response interceptor error function  
      const [[, onRejected]] = mockAxiosInstance.interceptors.response.use.mock.calls;
      
      const mockError = {
        response: { status: 500 },
        message: 'Server error',
        config: { url: '/test-endpoint' }
      };

      expect(() => onRejected(mockError)).toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith('API Response Error:', {
        status: 500,
        message: 'Server error',
        url: '/test-endpoint',
        environment: 'staging'
      });
      
      consoleSpy.mockRestore();
    });
  });
});