import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig, AxiosHeaders } from 'axios';
import { getEnvironmentConfig } from '../config/environments';
import { authService } from './AuthService';
import { DiscoverFeedResponse } from '../types/feed';

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

    // Request interceptor for logging and attaching auth tokens when available
    instance.interceptors.request.use(
      async (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          environment: this.currentEnvironment,
          baseURL: this.axiosInstance.defaults.baseURL
        });

        try {
          const storedTokens = await authService.getStoredTokens();
          if (!storedTokens?.access_token) {
            return config;
          }

          let accessToken = storedTokens.access_token;
          if (authService.isTokenExpired(storedTokens.expires_at) && storedTokens.refresh_token) {
            const refreshed = await authService.refreshToken(storedTokens.refresh_token);
            accessToken = refreshed.tokens.access_token;
          }

          const headers = AxiosHeaders.from(config.headers ?? {});
          headers.set('Authorization', `Bearer ${accessToken}`);
          config.headers = headers;
        } catch (error) {
          console.warn('API Request Token Attach Error:', error);
        }

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

  public async addProductToPlan(data: { barcode: string; meal_type?: string; serving_size?: string }) {
    return this.post('/plan/add-product', data);
  }

  // Smart recommendations endpoints
  public async generateSmartRecommendations(requestData: any) {
    return this.post('/recommendations/generate', requestData);
  }

  public async recordRecommendationFeedback(feedbackData: any) {
    return this.post('/recommendations/feedback', feedbackData);
  }

  public async getRecommendationMetrics(days?: number, userId?: string) {
    const params = new URLSearchParams();
    if (days) params.append('days', days.toString());
    if (userId) params.append('user_id', userId);
    
    return this.get(`/recommendations/metrics${params.toString() ? '?' + params.toString() : ''}`);
  }

  public async getUserRecommendationPreferences(userId: string) {
    return this.get(`/recommendations/user-preferences/${userId}`);
  }

  // Smart Diet endpoints
  public async getSmartDietSuggestions(params: URLSearchParams) {
    return this.get(`/smart-diet/suggestions?${params.toString()}`);
  }

  public async recordSmartDietFeedback(feedbackData: any) {
    return this.post('/smart-diet/feedback', feedbackData);
  }

  public async getSmartDietInsights(userId?: string, days?: number) {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (days) params.append('days', days.toString());
    
    return this.get(`/smart-diet/insights${params.toString() ? '?' + params.toString() : ''}`);
  }

  public async applySmartDietOptimization(optimizationData: any) {
    return this.post('/smart-diet/apply-optimization', optimizationData);
  }

  public async getSmartDietMetrics(userId?: string, days?: number) {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (days) params.append('days', days.toString());
    
    return this.get(`/smart-diet/metrics${params.toString() ? '?' + params.toString() : ''}`);
  }

  public async getDiscoverFeed(params: {
    limit?: number;
    cursor?: string;
    surface?: 'mobile' | 'web';
  } = {}): Promise<AxiosResponse<DiscoverFeedResponse>> {
    const queryParams = new URLSearchParams();
    if (params.limit !== undefined) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params.cursor) {
      queryParams.append('cursor', params.cursor);
    }
    if (params.surface) {
      queryParams.append('surface', params.surface);
    }

    const queryString = queryParams.toString();
    const url = `/feed/discover${queryString ? `?${queryString}` : ''}`;
    return this.get<DiscoverFeedResponse>(url);
  }

  public async recordDiscoverInteraction(payload: {
    post_id: string;
    action: 'click' | 'dismiss';
    surface: 'mobile' | 'web';
    variant?: string;
    request_id?: string | null;
    rank_score?: number;
    reason?: string;
  }) {
    return this.post('/feed/discover/interactions', payload);
  }

  // Social Profile endpoints - EPIC_A.A1
  public async getProfile(userId: string) {
    return this.get(`/profiles/${userId}`);
  }

  public async updateProfile(data: { handle?: string; bio?: string; visibility?: 'public' | 'followers_only' }) {
    return this.patch('/profiles/me', data);
  }

  public async getCurrentUser() {
    return this.get('/auth/me');
  }

  // Follow/Unfollow functionality - EPIC_A.A2
  public async followUser(targetId: string): Promise<AxiosResponse<any>> {
    try {
      return await this.post(`/follows/${targetId}`, { action: 'follow' });
    } catch (error) {
      console.error('ApiService.followUser failed', { targetId, error });
      throw error;
    }
  }

  public async unfollowUser(targetId: string): Promise<AxiosResponse<any>> {
    try {
      return await this.post(`/follows/${targetId}`, { action: 'unfollow' });
    } catch (error) {
      console.error('ApiService.unfollowUser failed', { targetId, error });
      throw error;
    }
  }

  public async getFollowers(userId: string, options?: { limit?: number; cursor?: string }): Promise<AxiosResponse<any>> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.cursor) params.append('cursor', options.cursor);

    return this.get(`/profiles/${userId}/followers${params.toString() ? '?' + params.toString() : ''}`);
  }

  public async getFollowing(userId: string, options?: { limit?: number; cursor?: string }): Promise<AxiosResponse<any>> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.cursor) params.append('cursor', options.cursor);

    return this.get(`/profiles/${userId}/following${params.toString() ? '?' + params.toString() : ''}`);
  }

  // Block/Unblock functionality - EPIC_A.A3
  public async blockUser(targetId: string): Promise<AxiosResponse<any>> {
    try {
      return await this.post(`/blocks/${targetId}`, { action: 'block' });
    } catch (error) {
      console.error('ApiService.blockUser failed', { targetId, error });
      throw error;
    }
  }

  public async unblockUser(targetId: string): Promise<AxiosResponse<any>> {
    try {
      return await this.post(`/blocks/${targetId}`, { action: 'unblock' });
    } catch (error) {
      console.error('ApiService.unblockUser failed', { targetId, error });
      throw error;
    }
  }

  public async getBlockedUsers(userId: string, options?: { limit?: number; cursor?: string }): Promise<AxiosResponse<any>> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.cursor) params.append('cursor', options.cursor);

    try {
      return await this.get(`/profiles/${userId}/blocked${params.toString() ? '?' + params.toString() : ''}`);
    } catch (error) {
      console.error('ApiService.getBlockedUsers failed', { userId, options, error });
      throw error;
    }
  }

  public async getBlockers(userId: string, options?: { limit?: number; cursor?: string }): Promise<AxiosResponse<any>> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.cursor) params.append('cursor', options.cursor);

    try {
      return await this.get(`/profiles/${userId}/blockers${params.toString() ? '?' + params.toString() : ''}`);
    } catch (error) {
      console.error('ApiService.getBlockers failed', { userId, options, error });
      throw error;
    }
  }

  // Social Feed functionality - EPIC_A.A4
  public async getFeed(options?: { limit?: number; cursor?: string }): Promise<AxiosResponse<any>> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.cursor) params.append('cursor', options.cursor);

      return await this.get(`/feed${params.toString() ? '?' + params.toString() : ''}`);
    } catch (error) {
      console.error('ApiService.getFeed failed', { options, error });
      throw error;
    }
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
