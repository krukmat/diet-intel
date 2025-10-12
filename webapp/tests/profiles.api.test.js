// EPIC_A.A1: Tests unitarios del cliente API webapp/utils/api.js (~120 tokens)
// RESTAURADO: Cambios según Plan de fixes aplicado correctamente

const dietIntelAPI = require('../utils/api');

// No mockeamos axios directamente, usamos spies del cliente existente
describe('API Client - Social Profile Methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile(userId, authToken?)', () => {
    test('calls GET /profiles/{userId} without authorization header when no token', async () => {
      const mockResponse = { data: { user_id: '123', handle: '@test' } };
      jest.spyOn(dietIntelAPI.client, 'get').mockResolvedValue(mockResponse);

      const result = await dietIntelAPI.getProfile('123');

      expect(dietIntelAPI.client.get).toHaveBeenCalledWith('/profiles/123', { headers: {} });
      expect(result).toEqual(mockResponse.data);
    });

    test('calls GET /profiles/{userId} with Authorization header when token provided', async () => {
      const mockResponse = { data: { user_id: '456' } };
      jest.spyOn(dietIntelAPI.client, 'get').mockResolvedValue(mockResponse);

      const result = await dietIntelAPI.getProfile('456', 'bearer-token-123');

      expect(result).toEqual(mockResponse.data);
      expect(dietIntelAPI.client.get).toHaveBeenCalledWith('/profiles/456', {
        headers: { Authorization: 'Bearer bearer-token-123' }
      });
    });

    test('handles API errors correctly', async () => {
      const error = { response: { data: { detail: 'Not found' }, status: 404 } };
      jest.spyOn(dietIntelAPI.client, 'get').mockRejectedValue(error);

      await expect(dietIntelAPI.getProfile('999')).rejects.toThrow(
        'API Error in getProfile: {"detail":"Not found"}'
      );
      // Verifica que handleAPIError se llame
      expect(dietIntelAPI.client.get).toHaveBeenCalled();
    });
  });

  describe('updateProfile(profileData, authToken)', () => {
    test('calls PATCH /profiles/me with correct data and Authorization header', async () => {
      const profileData = { handle: 'newhandle', bio: 'Updated bio' };
      const mockResponse = { data: { user_id: '123', handle: '@newhandle' } };
      jest.spyOn(dietIntelAPI.client, 'patch').mockResolvedValue(mockResponse);

      const result = await dietIntelAPI.updateProfile(profileData, 'token-456');

      expect(result).toEqual(mockResponse.data);
      expect(dietIntelAPI.client.patch).toHaveBeenCalledWith('/profiles/me', profileData, {
        headers: { Authorization: 'Bearer token-456' }
      });
    });

    test('handles 422 validation errors correctly', async () => {
      const error = { response: { status: 422, data: { detail: 'Handle already exists' } } };
      jest.spyOn(dietIntelAPI.client, 'patch').mockRejectedValue(error);

      await expect(dietIntelAPI.updateProfile({ handle: 'taken' }, 'token')).rejects.toThrow(
        'API Error in updateProfile: {"detail":"Handle already exists"}'
      );
    });
  });

  describe('getCurrentUser(authToken)', () => {
    test('calls GET /auth/me with Authorization header', async () => {
      const mockResponse = { data: { id: '123', full_name: 'Test User' } };
      jest.spyOn(dietIntelAPI.client, 'get').mockResolvedValue(mockResponse);

      const result = await dietIntelAPI.getCurrentUser('auth-token-789');

      expect(result).toEqual(mockResponse.data);
      expect(dietIntelAPI.client.get).toHaveBeenCalledWith('/auth/me', {
        headers: { Authorization: 'Bearer auth-token-789' }
      });
    });

    test('handles authentication errors', async () => {
      const error = { response: { status: 401, data: { detail: 'Token expired' } } };
      jest.spyOn(dietIntelAPI.client, 'get').mockRejectedValue(error);

      await expect(dietIntelAPI.getCurrentUser('expired-token')).rejects.toThrow(
        'API Error in getCurrentUser: {"detail":"Token expired"}'
      );
    });
  });
});
