import axios from 'axios';
import ApiService, { apiService } from '../ApiService';
import { environments } from '../../config/environments';
import { authService } from '../AuthService';

// Mock axios completely
jest.mock('axios', () => ({
  create: jest.fn(() => ({
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
  }))
}));

jest.mock('../AuthService', () => ({
  authService: {
    getStoredTokens: jest.fn(),
    isTokenExpired: jest.fn()
  }
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ApiService', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      interceptors: {
        request: { 
          use: jest.fn()
        },
        response: { 
          use: jest.fn()
        }
      },
      defaults: { baseURL: 'http://localhost:8000' }
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
  });

  describe('Service Initialization', () => {
    it('should create ApiService with default environment', () => {
      const service = new ApiService();
      
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: environments.android_dev.apiBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should create ApiService with specified environment', () => {
      const service = new ApiService('production');
      
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: environments.production.apiBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should setup interceptors during initialization', () => {
      const service = new ApiService();
      
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('Environment Management', () => {
    it('should switch environment correctly', () => {
      const service = new ApiService('dev');
      
      service.switchEnvironment('staging');
      
      // Should create new axios instance with staging config
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

    it('should handle environment switching with logging', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const service = new ApiService('dev');
      
      service.switchEnvironment('production');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "Switching API environment from 'dev' to 'production'"
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('HTTP Methods (Sync Testing)', () => {
    let service: ApiService;

    beforeEach(() => {
      service = new ApiService();
    });

    it('should have get method available', () => {
      expect(typeof service.get).toBe('function');
    });

    it('should have post method available', () => {
      expect(typeof service.post).toBe('function');
    });

    it('should have put method available', () => {
      expect(typeof service.put).toBe('function');
    });

    it('should have delete method available', () => {
      expect(typeof service.delete).toBe('function');
    });

    it('should have patch method available', () => {
      expect(typeof service.patch).toBe('function');
    });

    it('should call axios get with provided args', async () => {
      const response = { data: { ok: true } };
      mockAxiosInstance.get.mockResolvedValue(response);

      const result = await service.get('/test', { timeout: 1000 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', { timeout: 1000 });
      expect(result).toBe(response);
    });

    it('should call axios post with payload', async () => {
      const response = { data: { created: true } };
      mockAxiosInstance.post.mockResolvedValue(response);

      const payload = { name: 'test' };
      const result = await service.post('/test', payload, { headers: { 'X-Test': '1' } });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test', payload, { headers: { 'X-Test': '1' } });
      expect(result).toBe(response);
    });
  });

  describe('DietIntel Specific Methods', () => {
    let service: ApiService;

    beforeEach(() => {
      service = new ApiService();
    });

    it('should have getProductByBarcode method', () => {
      expect(typeof service.getProductByBarcode).toBe('function');
    });

    it('should have scanNutritionLabel method', () => {
      expect(typeof service.scanNutritionLabel).toBe('function');
    });

    it('should have scanNutritionLabelExternal method', () => {
      expect(typeof service.scanNutritionLabelExternal).toBe('function');
    });

    it('should have searchProduct method', () => {
      expect(typeof service.searchProduct).toBe('function');
    });

    it('should have generateMealPlan method', () => {
      expect(typeof service.generateMealPlan).toBe('function');
    });

    it('should have customizeMealPlan method', () => {
      expect(typeof service.customizeMealPlan).toBe('function');
    });

    it('should have healthCheck method', () => {
      expect(typeof service.healthCheck).toBe('function');
    });

    it('should build discover feed query params', async () => {
      const response = { data: { items: [] } };
      mockAxiosInstance.get.mockResolvedValue(response);

      await service.getDiscoverFeed({ limit: 10, cursor: 'abc', surface: 'mobile' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/feed/discover?limit=10&cursor=abc&surface=mobile', undefined);
    });

    it('should call scanNutritionLabel with form-data headers and timeout', async () => {
      const response = { data: { ok: true } };
      mockAxiosInstance.post.mockResolvedValue(response);

      (global as any).FormData = class {
        append = jest.fn();
      };

      const formData = new FormData();
      await service.scanNutritionLabel(formData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/product/scan-label',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        }
      );
    });

    it('should call product and plan endpoints with expected paths', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });
      mockAxiosInstance.post.mockResolvedValue({ data: {} });
      mockAxiosInstance.put.mockResolvedValue({ data: {} });

      await service.getProductByBarcode('123');
      await service.searchProduct('chicken & rice');
      await service.generateMealPlan({ calories: 2000 });
      await service.customizeMealPlan({ meal_type: 'lunch' });
      await service.getMealPlanConfig();
      await service.addProductToPlan({ barcode: '123', meal_type: 'breakfast' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/product/by-barcode/123', undefined);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/product/search?q=chicken%20%26%20rice', undefined);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/plan/generate', { calories: 2000 }, undefined);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/plan/customize', { meal_type: 'lunch' }, undefined);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/plan/config', undefined);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/plan/add-product', { barcode: '123', meal_type: 'breakfast' }, undefined);
    });

    it('should call recommendations endpoints with query params', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await service.generateSmartRecommendations({ goal: 'protein' });
      await service.recordRecommendationFeedback({ id: 'rec1' });
      await service.getRecommendationMetrics(7, 'user-1');
      await service.getUserRecommendationPreferences('user-1');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/recommendations/generate', { goal: 'protein' }, undefined);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/recommendations/feedback', { id: 'rec1' }, undefined);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/recommendations/metrics?days=7&user_id=user-1', undefined);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/recommendations/user-preferences/user-1', undefined);
    });

    it('should call smart diet endpoints with query params', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      const params = new URLSearchParams({ context: 'today' });
      await service.getSmartDietSuggestions(params);
      await service.recordSmartDietFeedback({ id: 'sd1' });
      await service.getSmartDietInsights('user-1', 14);
      await service.applySmartDietOptimization({ id: 'opt1' });
      await service.getSmartDietMetrics('user-1', 7);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/smart-diet/suggestions?context=today', undefined);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/smart-diet/feedback', { id: 'sd1' }, undefined);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/smart-diet/insights?user_id=user-1&days=14', undefined);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/smart-diet/apply-optimization', { id: 'opt1' }, undefined);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/smart-diet/metrics?user_id=user-1&days=7', undefined);
    });

    it('should call social profile endpoints and handle follow flows', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });
      mockAxiosInstance.post.mockResolvedValue({ data: {} });
      mockAxiosInstance.patch.mockResolvedValue({ data: {} });

      await service.getProfile('user-1');
      await service.updateProfile({ handle: 'new' });
      await service.getCurrentUser();
      await service.followUser('user-2');
      await service.unfollowUser('user-2');
      await service.getFollowers('user-1', { limit: 10, cursor: 'c1' });
      await service.getFollowing('user-1', { limit: 5, cursor: 'c2' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/profiles/user-1', undefined);
      expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/profiles/me', { handle: 'new' }, undefined);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/auth/me', undefined);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/follows/user-2', { action: 'follow' }, undefined);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/follows/user-2', { action: 'unfollow' }, undefined);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/profiles/user-1/followers?limit=10&cursor=c1', undefined);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/profiles/user-1/following?limit=5&cursor=c2', undefined);
    });

    it('should call blocking and feed endpoints', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await service.blockUser('user-2');
      await service.unblockUser('user-2');
      await service.getBlockedUsers('user-1', { limit: 2, cursor: 'c3' });
      await service.getBlockers('user-1', { limit: 2, cursor: 'c4' });
      await service.getFeed({ limit: 20, cursor: 'feed1' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/blocks/user-2', { action: 'block' }, undefined);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/blocks/user-2', { action: 'unblock' }, undefined);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/profiles/user-1/blocked?limit=2&cursor=c3', undefined);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/profiles/user-1/blockers?limit=2&cursor=c4', undefined);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/feed?limit=20&cursor=feed1', undefined);
    });
  });

  describe('Global Instance', () => {
    it('should export a global apiService instance', () => {
      expect(apiService).toBeDefined();
      expect(apiService).toBeInstanceOf(ApiService);
    });

    it('should allow method calls on global instance', () => {
      expect(typeof apiService.get).toBe('function');
      expect(typeof apiService.post).toBe('function');
      expect(typeof apiService.getCurrentEnvironment).toBe('function');
    });
  });

  describe('Configuration Validation', () => {
    it('should use valid environment configurations', () => {
      const envNames = ['dev', 'android_dev', 'ios_dev', 'staging', 'qa', 'production'];
      
      envNames.forEach(envName => {
        const service = new ApiService(envName);
        const envInfo = service.getCurrentEnvironment();
        
        expect(envInfo.name).toBe(envName);
        expect(envInfo.config).toBeDefined();
        expect(envInfo.config.apiBaseUrl).toBeDefined();
        expect(typeof envInfo.config.apiBaseUrl).toBe('string');
      });
    });

    it('should have consistent timeout configuration', () => {
      const service = new ApiService();
      
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000
        })
      );
    });

    it('should have proper content-type headers', () => {
      const service = new ApiService();
      
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
    });
  });

  describe('Health Check', () => {
    it('should return healthy response on success', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { status: 'ok' } });
      const service = new ApiService();

      const result = await service.healthCheck();

      expect(result).toEqual({ healthy: true, status: 'ok' });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health', { timeout: 5000 });
    });

    it('should return unhealthy response on error', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('down'));
      const service = new ApiService();

      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('down');
    });
  });
});
