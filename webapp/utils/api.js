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

  // EPIC_A.A2: Follow/Unfollow functionality
  async followUser(targetId, authToken) {
    try {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const response = await this.client.post(
        `/follows/${targetId}`,
        { action: 'follow' },
        { headers }
      );
      return response.data;
    } catch (error) {
      this.handleAPIError(error, 'followUser');
    }
  }

  async unfollowUser(targetId, authToken) {
    try {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const response = await this.client.post(
        `/follows/${targetId}`,
        { action: 'unfollow' },
        { headers }
      );
      return response.data;
    } catch (error) {
      this.handleAPIError(error, 'unfollowUser');
    }
  }

  async getFollowers(userId, authToken, options = {}) {
    try {
      const { limit = 20, cursor } = options;
      const params = { limit };
      if (cursor) params.cursor = cursor;

      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const response = await this.client.get(`/profiles/${userId}/followers`, {
        headers,
        params
      });
      return response.data;
    } catch (error) {
      this.handleAPIError(error, 'getFollowers');
    }
  }

  async getFollowing(userId, authToken, options = {}) {
    try {
      const { limit = 20, cursor } = options;
      const params = { limit };
      if (cursor) params.cursor = cursor;

      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const response = await this.client.get(`/profiles/${userId}/following`, {
        headers,
        params
      });
      return response.data;
    } catch (error) {
      this.handleAPIError(error, 'getFollowing');
    }
  }

  // EPIC_A.A3: Block/Unblock functionality
  async blockUser(targetId, authToken) {
    try {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const response = await this.client.post(
        `/blocks/${targetId}`,
        { action: 'block' },
        { headers }
      );
      return response.data;
    } catch (error) {
      this.handleAPIError(error, 'blockUser');
    }
  }

  async unblockUser(targetId, authToken) {
    try {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const response = await this.client.post(
        `/blocks/${targetId}`,
        { action: 'unblock' },
        { headers }
      );
      return response.data;
    } catch (error) {
      this.handleAPIError(error, 'unblockUser');
    }
  }

  async getBlockedUsers(userId, authToken, options = {}) {
    try {
      const { limit = 20, cursor } = options;
      const params = { limit };
      if (cursor) params.cursor = cursor;

      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const response = await this.client.get(`/profiles/${userId}/blocked`, {
        headers,
        params
      });
      return response.data;
    } catch (error) {
      this.handleAPIError(error, 'getBlockedUsers');
    }
  }

  async getBlockers(userId, authToken, options = {}) {
    try {
      const { limit = 20, cursor } = options;
      const params = { limit };
      if (cursor) params.cursor = cursor;

      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const response = await this.client.get(`/profiles/${userId}/blockers`, {
        headers,
        params
      });
      return response.data;
    } catch (error) {
      this.handleAPIError(error, 'getBlockers');
    }
  }

  // EPIC_A.A4: Social feed functionality
  async getFeed(authToken, options = {}) {
    try {
      const { limit = 20, cursor } = options;
      const params = { limit };
      if (cursor) params.cursor = cursor;

      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const response = await this.client.get('/feed', {
        headers,
        params
      });
      return response.data;
    } catch (error) {
      this.handleAPIError(error, 'getFeed');
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
