import axios from 'axios';
import ApiService, { apiService } from '../ApiService';
import { environments } from '../../config/environments';

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
        request: { use: jest.fn() },
        response: { use: jest.fn() }
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
});