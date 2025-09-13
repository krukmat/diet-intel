// Production-Ready API Client with Advanced Features
// Using modern patterns: Singleton, Interceptors, Request Queuing, Cache Management

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from 'react-native-netinfo';

// Environment Configuration
interface ApiConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  cacheTimeout: number;
  enableMockMode: boolean;
}

const getApiConfig = (): ApiConfig => {
  const isDev = __DEV__;
  
  return {
    baseURL: isDev ? 'http://localhost:8001/api' : 'https://api.dietintel.com/api',
    timeout: 15000,
    retryAttempts: 3,
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    enableMockMode: isDev, // Enable mock mode in development
  };
};

// Request/Response Types
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  status: 'success' | 'error';
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  cache?: boolean;
  retryable?: boolean;
  mockResponse?: any;
}

// Cache Entry Structure
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

// Request Queue for Offline Support
interface QueuedRequest {
  id: string;
  config: RequestConfig;
  timestamp: number;
  retryCount: number;
}

// Network Connection State
interface NetworkState {
  isConnected: boolean;
  type: string;
  isInternetReachable: boolean | null;
}

// Production-Ready API Client
export class ApiClient {
  private static instance: ApiClient;
  private config: ApiConfig;
  private authToken: string | null = null;
  private refreshToken: string | null = null;
  private requestQueue: QueuedRequest[] = [];
  private cache = new Map<string, CacheEntry>();
  private networkState: NetworkState = {
    isConnected: true,
    type: 'unknown',
    isInternetReachable: null,
  };

  private constructor() {
    this.config = getApiConfig();
    this.initializeNetworkListener();
    this.loadAuthTokens();
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  // Initialize network state monitoring
  private initializeNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.networkState.isConnected;
      
      this.networkState = {
        isConnected: state.isConnected ?? false,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
      };

      // Process queued requests when coming back online
      if (wasOffline && this.networkState.isConnected) {
        this.processRequestQueue();
      }
    });
  }

  // Authentication Management
  public async setAuthTokens(accessToken: string, refreshToken?: string): Promise<void> {
    this.authToken = accessToken;
    this.refreshToken = refreshToken;
    
    await AsyncStorage.setItem('@auth_token', accessToken);
    if (refreshToken) {
      await AsyncStorage.setItem('@refresh_token', refreshToken);
    }
  }

  private async loadAuthTokens(): Promise<void> {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        AsyncStorage.getItem('@auth_token'),
        AsyncStorage.getItem('@refresh_token'),
      ]);
      
      this.authToken = accessToken;
      this.refreshToken = refreshToken;
    } catch (error) {
      console.warn('Failed to load auth tokens:', error);
    }
  }

  public async clearAuthTokens(): Promise<void> {
    this.authToken = null;
    this.refreshToken = null;
    
    await Promise.all([
      AsyncStorage.removeItem('@auth_token'),
      AsyncStorage.removeItem('@refresh_token'),
    ]);
  }

  // Core Request Method
  public async request<T = any>(config: RequestConfig): Promise<ApiResponse<T>> {
    // Check if we should use mock response in development
    if (this.config.enableMockMode && config.mockResponse) {
      return this.createMockResponse<T>(config.mockResponse);
    }

    // Check cache first for GET requests
    if (config.method === 'GET' && config.cache !== false) {
      const cached = this.getFromCache(config.url, config.params);
      if (cached) {
        return cached;
      }
    }

    // Check network connectivity
    if (!this.networkState.isConnected) {
      if (config.retryable !== false) {
        this.queueRequest(config);
        throw new Error('No internet connection. Request has been queued.');
      } else {
        throw new Error('No internet connection.');
      }
    }

    try {
      const response = await this.executeRequest<T>(config);
      
      // Cache successful GET responses
      if (config.method === 'GET' && config.cache !== false) {
        this.setCache(config.url, config.params, response);
      }

      return response;
    } catch (error) {
      // Handle token refresh for 401 errors
      if (this.isUnauthorizedError(error) && this.refreshToken) {
        try {
          await this.refreshAccessToken();
          return this.executeRequest<T>(config);
        } catch (refreshError) {
          await this.clearAuthTokens();
          throw this.createApiError('AUTH_FAILED', 'Authentication failed. Please login again.');
        }
      }

      // Retry logic for retryable requests
      if (config.retryable !== false && this.isRetryableError(error)) {
        return this.retryRequest<T>(config);
      }

      throw this.normalizeError(error);
    }
  }

  // Execute HTTP Request
  private async executeRequest<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const url = `${this.config.baseURL}${config.url}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...config.headers,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const requestInit: RequestInit = {
      method: config.method,
      headers,
      signal: AbortSignal.timeout(config.timeout || this.config.timeout),
    };

    // Add query parameters for GET requests
    const finalUrl = config.method === 'GET' && config.params 
      ? `${url}?${this.buildQueryString(config.params)}`
      : url;

    // Add body for non-GET requests
    if (config.method !== 'GET' && config.data) {
      requestInit.body = JSON.stringify(config.data);
    }

    const response = await fetch(finalUrl, requestInit);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        statusText: response.statusText,
        data: errorData,
      };
    }

    const responseData = await response.json();
    return {
      data: responseData,
      status: 'success',
      timestamp: new Date().toISOString(),
    };
  }

  // Token Refresh Logic
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.executeRequest({
      method: 'POST',
      url: '/auth/refresh',
      data: { refreshToken: this.refreshToken },
    });

    const { accessToken, refreshToken } = response.data;
    await this.setAuthTokens(accessToken, refreshToken);
  }

  // Retry Logic with Exponential Backoff
  private async retryRequest<T>(
    config: RequestConfig,
    attempt: number = 1
  ): Promise<ApiResponse<T>> {
    if (attempt > this.config.retryAttempts) {
      throw new Error(`Request failed after ${this.config.retryAttempts} attempts`);
    }

    // Exponential backoff: 1s, 2s, 4s, 8s...
    const delay = Math.pow(2, attempt - 1) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      return await this.executeRequest<T>(config);
    } catch (error) {
      if (this.isRetryableError(error)) {
        return this.retryRequest<T>(config, attempt + 1);
      }
      throw error;
    }
  }

  // Cache Management
  private getFromCache<T>(url: string, params?: Record<string, any>): ApiResponse<T> | null {
    const key = this.getCacheKey(url, params);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setCache<T>(url: string, params: Record<string, any> | undefined, data: ApiResponse<T>): void {
    const key = this.getCacheKey(url, params);
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: this.config.cacheTimeout,
    };
    
    this.cache.set(key, entry);
    
    // Cleanup old cache entries (simple LRU)
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  private getCacheKey(url: string, params?: Record<string, any>): string {
    const paramsString = params ? JSON.stringify(params) : '';
    return `${url}:${paramsString}`;
  }

  // Request Queue for Offline Support
  private queueRequest(config: RequestConfig): void {
    const queuedRequest: QueuedRequest = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      config,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    this.requestQueue.push(queuedRequest);
    
    // Limit queue size
    if (this.requestQueue.length > 50) {
      this.requestQueue = this.requestQueue.slice(-50);
    }
  }

  private async processRequestQueue(): Promise<void> {
    if (this.requestQueue.length === 0) return;

    console.log(`Processing ${this.requestQueue.length} queued requests...`);
    
    const requests = [...this.requestQueue];
    this.requestQueue = [];

    for (const queuedRequest of requests) {
      try {
        await this.executeRequest(queuedRequest.config);
        console.log(`Successfully processed queued request: ${queuedRequest.id}`);
      } catch (error) {
        console.warn(`Failed to process queued request ${queuedRequest.id}:`, error);
        
        // Requeue if retry attempts remain
        if (queuedRequest.retryCount < this.config.retryAttempts) {
          queuedRequest.retryCount++;
          this.requestQueue.push(queuedRequest);
        }
      }
    }
  }

  // Utility Methods
  private buildQueryString(params: Record<string, any>): string {
    return Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  private isUnauthorizedError(error: any): boolean {
    return error?.status === 401;
  }

  private isRetryableError(error: any): boolean {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(error?.status) || error?.name === 'AbortError';
  }

  private normalizeError(error: any): ApiError {
    if (error?.data?.code) {
      return {
        code: error.data.code,
        message: error.data.message || 'An error occurred',
        details: error.data.details,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      code: 'NETWORK_ERROR',
      message: error?.message || 'Network request failed',
      timestamp: new Date().toISOString(),
    };
  }

  private createApiError(code: string, message: string, details?: Record<string, any>): ApiError {
    return {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    };
  }

  private createMockResponse<T>(mockData: T): ApiResponse<T> {
    return {
      data: mockData,
      status: 'success',
      message: 'Mock response',
      timestamp: new Date().toISOString(),
    };
  }

  // HTTP Method Shortcuts
  public async get<T = any>(
    url: string, 
    params?: Record<string, any>, 
    options?: Partial<RequestConfig>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      params,
      ...options,
    });
  }

  public async post<T = any>(
    url: string, 
    data?: any, 
    options?: Partial<RequestConfig>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
      ...options,
    });
  }

  public async put<T = any>(
    url: string, 
    data?: any, 
    options?: Partial<RequestConfig>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
      ...options,
    });
  }

  public async delete<T = any>(
    url: string, 
    options?: Partial<RequestConfig>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
      ...options,
    });
  }

  // Public Utility Methods
  public clearCache(): void {
    this.cache.clear();
  }

  public getNetworkState(): NetworkState {
    return { ...this.networkState };
  }

  public getQueuedRequestCount(): number {
    return this.requestQueue.length;
  }

  public isAuthenticated(): boolean {
    return !!this.authToken;
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance();