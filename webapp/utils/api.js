const axios = require('axios');

class DietIntelAPI {
  constructor() {
    this.client = axios.create({
      baseURL: process.env.NODE_ENV === 'production'
        ? 'https://api.dietintel.com'
        : 'http://localhost:8000',
      timeout: 10000,
    });
  }

  // Profile methods - EPIC_A.A1 implementation
  async getProfile(userId, authToken) {
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    const response = await this.client.get(`/profiles/${userId}`, { headers });
    return response.data;
  }

  async updateProfile(profileData, authToken) {
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    const response = await this.client.patch('/profiles/me', profileData, { headers });
    return response.data;
  }

  async getCurrentUser(authToken) {
    const response = await this.client.get('/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    return response.data;
  }

  // Existing methods...
  async getMealPlan(userId, authToken) {
    // Existing implementation
    return [];
  }
}

const dietIntelAPI = new DietIntelAPI();
module.exports = dietIntelAPI;
