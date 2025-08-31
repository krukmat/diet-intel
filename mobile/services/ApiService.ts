import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getEnvironmentConfig } from '../config/environments';

class ApiService {
  private axiosInstance: AxiosInstance;
  private currentEnvironment: string;

  constructor(environment?: string) {
    this.currentEnvironment = environment || 'android_dev';
    this.axiosInstance = this.createAxiosInstance();
  }

  private createAxiosInstance(): AxiosInstance {
    const config = getEnvironmentConfig(this.currentEnvironment);
    
    const instance = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: 30000, // 30 seconds default timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging and potential auth tokens
    instance.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          environment: this.currentEnvironment,
          baseURL: this.axiosInstance.defaults.baseURL
        });
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    instance.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('API Response Error:', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
          environment: this.currentEnvironment
        });
        return Promise.reject(error);
      }
    );

    return instance;
  }

  // Switch environment dynamically
  public switchEnvironment(environment: string): void {
    console.log(`Switching API environment from '${this.currentEnvironment}' to '${environment}'`);
    this.currentEnvironment = environment;
    this.axiosInstance = this.createAxiosInstance();
  }

  // Get current environment info
  public getCurrentEnvironment(): { name: string; config: any } {
    return {
      name: this.currentEnvironment,
      config: getEnvironmentConfig(this.currentEnvironment)
    };
  }

  // Generic API methods
  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get<T>(url, config);
  }

  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post<T>(url, data, config);
  }

  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.put<T>(url, data, config);
  }

  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete<T>(url, config);
  }

  public async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.patch<T>(url, data, config);
  }

  // Specific DietIntel API methods
  
  // Product endpoints
  public async getProductByBarcode(barcode: string) {
    return this.get(`/product/by-barcode/${barcode}`);
  }

  public async scanNutritionLabel(imageFormData: FormData) {
    return this.post('/product/scan-label', imageFormData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    });
  }

  public async scanNutritionLabelExternal(imageFormData: FormData) {
    return this.post('/product/scan-label-external', imageFormData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 45000,
    });
  }

  public async searchProduct(query: string) {
    return this.get(`/product/search?q=${encodeURIComponent(query)}`);
  }

  // Meal planning endpoints
  public async generateMealPlan(planRequest: any) {
    return this.post('/plan/generate', planRequest);
  }

  public async customizeMealPlan(customizeData: any) {
    return this.put('/plan/customize', customizeData);
  }

  public async getMealPlanConfig() {
    return this.get('/plan/config');
  }

  // Health check
  public async healthCheck() {
    try {
      const response = await this.get('/health', { timeout: 5000 });
      return { healthy: true, ...response.data };
    } catch (error) {
      return { healthy: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Create and export a singleton instance
// Users can change the environment by calling apiService.switchEnvironment('environment_name')
export const apiService = new ApiService();

// Export the class for custom instances if needed
export default ApiService;