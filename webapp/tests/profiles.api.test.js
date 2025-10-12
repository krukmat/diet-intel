// EPIC_A.A1: Tests unitarios del cliente API webapp/utils/api.js (~120 tokens)

const axios = require('axios');
const dietIntelAPI = require('../utils/api');

// Mock axios para tests
jest.mock('axios');
const mockedAxios = jest.mocked(axios);

describe('API Client - Social Profile Methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocked client por cada test
    dietIntelAPI.client = mockedAxios.create();
  });

  describe('getProfile(userId, authToken?)', () => {
    test('calls GET /profiles/{userId} without authorization header when no token', async () => {
      const mockResponse = { data: { user_id: '123', handle: '@test' } };
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await dietIntelAPI.getProfile('123');

      expect(mockedAxios.create).toHaveBeenCalledTimes(1);
      const clientInstance = mockedAxios.create.mock.results[0].value;
      expect(clientInstance.get).toHaveBeenCalledWith('/profiles/123', { headers: {} });
      expect(result).toEqual(mockResponse.data);
    });

    test('calls GET /profiles/{userId} with Authorization header when token provided', async () => {
      const mockResponse = { data: { user_id: '456' } };
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await dietIntelAPI.getProfile('456', 'bearer-token-123');

      expect(result).toEqual(mockResponse.data);
      const clientInstance = mockedAxios.create.mock.results[0].value;
      expect(clientInstance.get).toHaveBeenCalledWith('/profiles/456', {
        headers: { Authorization: 'Bearer bearer-token-123' }
      });
    });

    test('handles API errors correctly', async () => {
      const error = { response: { data: { detail: 'Not found' }, status: 404 } };
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(error)
      });

      await expect(dietIntelAPI.getProfile('999')).rejects.toThrow(
        'API Error in getProfile: {"detail":"Not found"}'
      );
    });
  });

  describe('updateProfile(profileData, authToken)', () => {
    test('calls PATCH /profiles/me with correct data and Authorization header', async () => {
      const profileData = { handle: 'newhandle', bio: 'Updated bio' };
      const mockResponse = { data: { user_id: '123', handle: '@newhandle' } };
      mockedAxios.create.mockReturnValue({
        patch: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await dietIntelAPI.updateProfile(profileData, 'token-456');

      expect(result).toEqual(mockResponse.data);
      const clientInstance = mockedAxios.create.mock.results[0].value;
      expect(clientInstance.patch).toHaveBeenCalledWith('/profiles/me', profileData, {
        headers: { Authorization: 'Bearer token-456' }
      });
    });

    test('handles 422 validation errors correctly', async () => {
      const error = { response: { status: 422, data: { detail: 'Handle already exists' } } };
      mockedAxios.create.mockReturnValue({
        patch: jest.fn().mockRejectedValue(error)
      });

      await expect(dietIntelAPI.updateProfile({ handle: 'taken' }, 'token')).rejects.toThrow(
        'API Error in updateProfile: {"detail":"Handle already exists"}'
      );
    });
  });

  describe('getCurrentUser(authToken)', () => {
    test('calls GET /auth/me with Authorization header', async () => {
      const mockResponse = { data: { id: '123', full_name: 'Test User' } };
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockResponse)
      });

      const result = await dietIntelAPI.getCurrentUser('auth-token-789');

      expect(result).toEqual(mockResponse.data);
      const clientInstance = mockedAxios.create.mock.results[0].value;
      expect(clientInstance.get).toHaveBeenCalledWith('/auth/me', {
        headers: { Authorization: 'Bearer auth-token-789' }
      });
    });

    test('handles authentication errors', async () => {
      const error = { response: { status: 401, data: { detail: 'Token expired' } } };
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(error)
      });

      await expect(dietIntelAPI.getCurrentUser('expired-token')).rejects.toThrow(
        'API Error in getCurrentUser: {"detail":"Token expired"}'
      );
    });
  });
});
