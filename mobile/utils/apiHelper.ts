import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { getEnvironmentConfig } from '../config/environments';

interface ApiConfig {
  baseURL: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

interface ProductResponse {
  id: string;
  name: string;
  barcode: string;
  nutriments: {
    energy_kcal?: number;
    proteins?: number;
    fat?: number;
    carbohydrates?: number;
    sugars?: number;
    salt?: number;
  };
  image_url?: string;
  brands?: string;
  categories?: string;
}

interface UserProfile {
  age: number;
  sex: 'male' | 'female';
  height_cm: number;
  weight_kg: number;
  activity_level: number;
  goal: 'lose' | 'maintain' | 'gain';
}

interface MealItem {
  barcode: string;
  name: string;
  brand?: string;
  serving_size: string;
  calories_per_serving: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

interface Meal {
  meal_type: string;
  target_calories: number;
  items: MealItem[];
  total_calories: number;
  total_protein: number;
  total_fat: number;
  total_carbs: number;
}

interface DailyPlan {
  date: string;
  daily_calories: number;
  daily_protein: number;
  daily_fat: number;
  daily_carbs: number;
  meals: Meal[];
}

interface CustomizeRequest {
  meal_type: string;
  action: 'add' | 'remove' | 'replace';
  item: MealItem;
  replace_index?: number;
}

interface AddToPlanRequest {
  barcode: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner';
}

class ApiHelper {
  private client: AxiosInstance;
  private config: ApiConfig;

  constructor(config: Partial<ApiConfig> = {}) {
    // Get environment configuration
    const envConfig = getEnvironmentConfig();

    this.config = {
      baseURL: envConfig.apiBaseUrl,
      timeout: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean; _retryCount?: number };
        
        if (this.shouldRetry(error) && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

          if (originalRequest._retryCount <= this.config.maxRetries) {
            const delay = this.calculateRetryDelay(originalRequest._retryCount);
            console.log(`Retrying request in ${delay}ms (attempt ${originalRequest._retryCount}/${this.config.maxRetries})`);
            
            await this.sleep(delay);
            return this.client(originalRequest);
          }
        }

        return Promise.reject(this.transformError(error));
      }
    );
  }

  private shouldRetry(error: AxiosError): boolean {
    if (!error.response) {
      return true;
    }

    const status = error.response.status;
    return status >= 500 || status === 408 || status === 429;
  }

  private calculateRetryDelay(retryCount: number): number {
    return this.config.retryDelay * Math.pow(2, retryCount - 1);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private transformError(error: AxiosError): Error & { status?: number; data?: any } {
    const transformedError = new Error(
      (error.response?.data as any)?.detail || 
      error.message || 
      'Network request failed'
    ) as Error & { status?: number; data?: any };

    transformedError.status = error.response?.status;
    transformedError.data = error.response?.data;

    return transformedError;
  }

  async getProductByBarcode(barcode: string): Promise<ProductResponse | null> {
    try {
      const response = await this.client.post('/product/by-barcode', {
        barcode: barcode.trim(),
      });

      if (response.data && response.data.found) {
        return this.transformProductResponse(response.data);
      }

      return null;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private transformProductResponse(data: any): ProductResponse {
    return {
      id: data.id || data.barcode,
      name: data.product_name || data.name || 'Unknown Product',
      barcode: data.barcode || data.code,
      nutriments: {
        energy_kcal: data.nutriments?.['energy-kcal_100g'] || data.nutriments?.energy_kcal,
        proteins: data.nutriments?.['proteins_100g'] || data.nutriments?.proteins,
        fat: data.nutriments?.['fat_100g'] || data.nutriments?.fat,
        carbohydrates: data.nutriments?.['carbohydrates_100g'] || data.nutriments?.carbohydrates,
        sugars: data.nutriments?.['sugars_100g'] || data.nutriments?.sugars,
        salt: data.nutriments?.['salt_100g'] || data.nutriments?.salt,
      },
      image_url: data.image_url || data.image_front_url,
      brands: data.brands,
      categories: data.categories,
    };
  }

  async uploadLabelImage(imageUri: string): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'label.jpg',
      } as any);

      const response = await this.client.post('/product/scan-label', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error) {
      throw this.transformError(error as AxiosError);
    }
  }

  async uploadLabelImageExternal(imageUri: string): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'label.jpg',
      } as any);

      const response = await this.client.post('/product/scan-label-external', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error) {
      throw this.transformError(error as AxiosError);
    }
  }

  async generateMealPlan(userProfile: UserProfile): Promise<DailyPlan> {
    try {
      const response = await this.client.post('/plan/generate', userProfile);
      return response.data;
    } catch (error) {
      throw this.transformError(error as AxiosError);
    }
  }

  async customizeMealPlan(planId: string, customizeRequest: CustomizeRequest): Promise<DailyPlan> {
    try {
      const response = await this.client.put(`/plan/customize/${planId}`, customizeRequest);
      return response.data;
    } catch (error) {
      throw this.transformError(error as AxiosError);
    }
  }

  async addProductToPlan(addRequest: AddToPlanRequest): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.post('/plan/add-product', addRequest);
      return response.data;
    } catch (error) {
      throw this.transformError(error as AxiosError);
    }
  }

  async getMealPlanConfig(): Promise<any> {
    try {
      const response = await this.client.get('/plan/config');
      return response.data;
    } catch (error) {
      throw this.transformError(error as AxiosError);
    }
  }

  async searchProducts(query: string): Promise<ProductResponse[]> {
    try {
      const response = await this.client.get(`/product/search?q=${encodeURIComponent(query)}`);
      return response.data.products?.map((product: any) => this.transformProductResponse(product)) || [];
    } catch (error) {
      throw this.transformError(error as AxiosError);
    }
  }

  updateConfig(newConfig: Partial<ApiConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.client.defaults.baseURL = this.config.baseURL;
    this.client.defaults.timeout = this.config.timeout;
  }

  setBaseURL(baseURL: string) {
    this.updateConfig({ baseURL });
  }
}

export const apiHelper = new ApiHelper();
// The ApiHelper constructor now automatically uses the correct environment configuration

export { ApiHelper };
export type { 
  ProductResponse, 
  ApiConfig, 
  UserProfile, 
  MealItem, 
  Meal, 
  DailyPlan, 
  CustomizeRequest, 
  AddToPlanRequest 
};
