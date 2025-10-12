const axios = require('axios');

class DietIntelAPI {
  constructor() {
    this.client = axios.create({
      baseURL: process.env.NODE_ENV === 'production'
        ? 'https://api.dietintel.com'
        : 'http://localhost:8000',
      timeout: 10000,
    });

    // Maintain existing interceptors for logging/error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  handleAPIError(error, context) {
    const message = `API Error in ${context}: ${error.response?.data?.detail || error.message}`;
    console.error(message);
    throw new Error(message);
  }

  // EPIC_A.A1: New social functionality methods
  async getProfile(userId, authToken) {
    try {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const response = await this.client.get(`/profiles/${userId}`, { headers });
      return response.data;
    } catch (error) {
      this.handleAPIError(error, 'getProfile');
    }
  }

  async updateProfile(profileData, authToken) {
    try {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const response = await this.client.patch('/profiles/me', profileData, { headers });
      return response.data;
    } catch (error) {
      this.handleAPIError(error, 'updateProfile');
    }
  }

  async getCurrentUser(authToken) {
    try {
      const response = await this.client.get('/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      return response.data;
    } catch (error) {
      this.handleAPIError(error, 'getCurrentUser');
    }
  }

  // Existing methods...
  async getMealPlan(userId, authToken) {
    // Existing implementation
    return [];
  }
}

const dietIntelAPI = new DietIntelAPI();
module.exports = dietIntelAPI;
