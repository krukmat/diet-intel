const axios = require('axios');
const FormData = require('form-data');

class DietIntelAPI {
  constructor() {
    this.baseURL = process.env.DIETINTEL_API_URL || 'http://localhost:8000';
    this.timeout = process.env.API_TIMEOUT || 30000;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DietIntel-WebApp/1.0.0'
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`📤 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('📤 API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`📥 API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`📥 API Response Error: ${error.response?.status} ${error.config?.url}`, error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Health check for the API
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return {
        status: 'healthy',
        data: response.data
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        code: error.response?.status
      };
    }
  }

  /**
   * Look up product by barcode
   * @param {string} barcode - Product barcode
   * @returns {Promise<Object>} Product information
   */
  async lookupBarcode(barcode) {
    try {
      const response = await this.client.post('/product/by-barcode', {
        barcode: barcode
      });
      return response.data;
    } catch (error) {
      this.handleAPIError('Barcode lookup failed', error);
    }
  }

  /**
   * Scan nutrition label using local OCR
   * @param {Object} imageFile - Uploaded image file
   * @returns {Promise<Object>} OCR results with nutrition data
   */
  async scanLabel(imageFile) {
    try {
      const formData = new FormData();
      formData.append('image', imageFile.data, {
        filename: imageFile.name,
        contentType: imageFile.mimetype
      });

      const response = await this.client.post('/product/scan-label', formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Length': formData.getLengthSync()
        }
      });
      
      return response.data;
    } catch (error) {
      this.handleAPIError('Label scanning failed', error);
    }
  }

  /**
   * Scan nutrition label using external OCR service
   * @param {Object} imageFile - Uploaded image file
   * @param {string} provider - OCR provider (mindee, gpt4o, azure)
   * @returns {Promise<Object>} OCR results with nutrition data
   */
  async scanLabelExternal(imageFile, provider = 'mindee') {
    try {
      const formData = new FormData();
      formData.append('image', imageFile.data, {
        filename: imageFile.name,
        contentType: imageFile.mimetype
      });
      formData.append('provider', provider);

      const response = await this.client.post('/product/scan-label-external', formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Length': formData.getLengthSync()
        }
      });
      
      return response.data;
    } catch (error) {
      this.handleAPIError('External label scanning failed', error);
    }
  }

  /**
   * Generate a meal plan
   * @param {Object} planRequest - Meal plan generation request
   * @returns {Promise<Object>} Generated meal plan
   */
  async generateMealPlan(planRequest) {
    try {
      const response = await this.client.post('/plan/generate', planRequest);
      return response.data;
    } catch (error) {
      this.handleAPIError('Meal plan generation failed', error);
    }
  }

  /**
   * Get meal plan by ID
   * @param {string} planId - Meal plan ID
   * @returns {Promise<Object>} Meal plan details
   */
  async getMealPlan(planId) {
    try {
      const response = await this.client.get(`/plan/${planId}`);
      return response.data;
    } catch (error) {
      this.handleAPIError('Failed to fetch meal plan', error);
    }
  }

  /**
   * Customize meal plan
   * @param {string} planId - Meal plan ID
   * @param {Object} customization - Customization request
   * @returns {Promise<Object>} Updated meal plan
   */
  async customizeMealPlan(planId, customization) {
    try {
      const response = await this.client.put(`/plan/customize/${planId}`, customization);
      return response.data;
    } catch (error) {
      this.handleAPIError('Meal plan customization failed', error);
    }
  }

  /**
   * Delete meal plan
   * @param {string} planId - Meal plan ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteMealPlan(planId) {
    try {
      const response = await this.client.delete(`/plan/${planId}`);
      return response.data;
    } catch (error) {
      this.handleAPIError('Failed to delete meal plan', error);
    }
  }

  /**
   * Get user meal plans (mock implementation)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of meal plans
   */
  async getUserMealPlans(userId) {
    // This would be implemented when user authentication is added
    // For now, return mock data
    return [
      {
        id: '1',
        name: 'Weekly Plan',
        date: new Date().toISOString().split('T')[0],
        status: 'active'
      }
    ];
  }

  /**
   * Handle API errors consistently
   * @param {string} message - Error context message
   * @param {Error} error - Original error
   * @throws {Error} Formatted error
   */
  handleAPIError(message, error) {
    const statusCode = error.response?.status;
    const errorData = error.response?.data;
    
    let errorMessage = message;
    
    if (statusCode) {
      errorMessage += ` (HTTP ${statusCode})`;
    }
    
    if (errorData?.message) {
      errorMessage += `: ${errorData.message}`;
    } else if (errorData?.detail) {
      errorMessage += `: ${errorData.detail}`;
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }

    const apiError = new Error(errorMessage);
    apiError.statusCode = statusCode;
    apiError.originalError = error;
    apiError.apiResponse = errorData;
    
    throw apiError;
  }

  /**
   * Get API connection info
   * @returns {Object} Connection information
   */
  getConnectionInfo() {
    return {
      baseURL: this.baseURL,
      timeout: this.timeout,
      userAgent: 'DietIntel-WebApp/1.0.0'
    };
  }
}

module.exports = new DietIntelAPI();