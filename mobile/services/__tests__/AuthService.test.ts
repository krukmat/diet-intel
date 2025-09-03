import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../AuthService';
import { User, LoginCredentials, RegisterData, AuthTokens } from '../../types/auth';

// Mock AsyncStorage
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// Mock fetch
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('AuthService Integration Tests', () => {
  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    full_name: 'Test User',
    is_developer: false,
    role: 'standard',
    is_active: true,
    email_verified: true,
    created_at: '2024-01-01T00:00:00Z'
  };

  const mockTokens: AuthTokens = {
    access_token: 'access_token_123',
    refresh_token: 'refresh_token_123',
    token_type: 'bearer',
    expires_in: 3600
  };

  // Helper function to create mock responses
  const createMockResponse = (data: any, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data)
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    mockAsyncStorage.getItem.mockClear();
    mockAsyncStorage.setItem.mockClear();
    mockAsyncStorage.removeItem.mockClear();
  });

  describe('Login Service', () => {
    it('should successfully login with valid credentials', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Mock successful login response
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify(mockTokens), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockUser), { status: 200 }));

      mockAsyncStorage.setItem.mockResolvedValue();

      const result = await authService.login(credentials);

      expect(mockFetch).toHaveBeenCalledWith('http://10.0.2.2:8000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      expect(mockFetch).toHaveBeenCalledWith('http://10.0.2.2:8000/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer access_token_123',
          'Content-Type': 'application/json'
        }
      });

      expect(result.user).toEqual(mockUser);
      expect(result.tokens).toEqual(mockTokens);
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should handle login API errors', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ detail: 'Invalid credentials' }),
        { status: 401 }
      ));

      await expect(authService.login(credentials)).rejects.toThrow('Invalid credentials');
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle network errors during login', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(authService.login(credentials)).rejects.toThrow('Network error');
    });

    it('should handle user profile fetch errors after successful login', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify(mockTokens), { status: 200 }))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ detail: 'User profile not found' }),
          { status: 404 }
        ));

      await expect(authService.login(credentials)).rejects.toThrow('User profile not found');
    });
  });

  describe('Registration Service', () => {
    it('should successfully register with valid data', async () => {
      const registerData: RegisterData = {
        email: 'newuser@example.com',
        password: 'password123',
        full_name: 'New User'
      };

      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify(mockTokens), { status: 201 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockUser), { status: 200 }));

      mockAsyncStorage.setItem.mockResolvedValue();

      const result = await authService.register(registerData);

      expect(mockFetch).toHaveBeenCalledWith('http://10.0.2.2:8000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData)
      });

      expect(result.user).toEqual(mockUser);
      expect(result.tokens).toEqual(mockTokens);
    });

    it('should register with developer code', async () => {
      const registerData: RegisterData = {
        email: 'dev@example.com',
        password: 'password123',
        full_name: 'Developer User',
        developer_code: 'DEV_CODE_123'
      };

      const developerUser = { ...mockUser, is_developer: true, role: 'developer' as const };

      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify(mockTokens), { status: 201 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(developerUser), { status: 200 }));

      mockAsyncStorage.setItem.mockResolvedValue();

      const result = await authService.register(registerData);

      expect(result.user.is_developer).toBeTruthy();
      expect(result.user.role).toBe('developer');
    });

    it('should handle registration errors', async () => {
      const registerData: RegisterData = {
        email: 'existing@example.com',
        password: 'password123',
        full_name: 'Test User'
      };

      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ detail: 'Email already registered' }),
        { status: 400 }
      ));

      await expect(authService.register(registerData)).rejects.toThrow('Email already registered');
    });

    it('should handle registration network errors', async () => {
      const registerData: RegisterData = {
        email: 'test@example.com',
        password: 'password123',
        full_name: 'Test User'
      };

      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(authService.register(registerData)).rejects.toThrow('Connection refused');
    });
  });

  describe('Token Refresh Service', () => {
    it('should successfully refresh tokens', async () => {
      const refreshToken = 'valid_refresh_token';

      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify(mockTokens), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockUser), { status: 200 }));

      mockAsyncStorage.setItem.mockResolvedValue();

      const result = await authService.refreshToken(refreshToken);

      expect(mockFetch).toHaveBeenCalledWith('http://10.0.2.2:8000/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      expect(result.user).toEqual(mockUser);
      expect(result.tokens).toEqual(mockTokens);
    });

    it('should handle invalid refresh token', async () => {
      const refreshToken = 'invalid_refresh_token';

      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ detail: 'Invalid refresh token' }),
        { status: 401 }
      ));

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow('Invalid refresh token');
    });

    it('should handle refresh token network errors', async () => {
      const refreshToken = 'valid_refresh_token';

      mockFetch.mockRejectedValue(new Error('Service unavailable'));

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow('Service unavailable');
    });
  });

  describe('Logout Service', () => {
    it('should successfully logout with refresh token', async () => {
      const refreshToken = 'valid_refresh_token';

      mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));
      mockAsyncStorage.removeItem.mockResolvedValue();

      await authService.logout(refreshToken);

      expect(mockFetch).toHaveBeenCalledWith('http://10.0.2.2:8000/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@dietintel_auth');
    });

    it('should logout without refresh token', async () => {
      mockAsyncStorage.removeItem.mockResolvedValue();

      await authService.logout();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('should clear local storage even if API call fails', async () => {
      const refreshToken = 'valid_refresh_token';

      mockFetch.mockRejectedValue(new Error('Network error'));
      mockAsyncStorage.removeItem.mockResolvedValue();

      await authService.logout(refreshToken);

      expect(mockAsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('should handle storage clear errors gracefully', async () => {
      mockAsyncStorage.removeItem.mockRejectedValue(new Error('Storage error'));

      // Should not throw error
      await expect(authService.logout()).resolves.not.toThrow();
    });
  });

  describe('User Profile Service', () => {
    it('should get current user with valid token', async () => {
      const accessToken = 'valid_access_token';

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockUser), { status: 200 }));

      const result = await authService.getCurrentUser(accessToken);

      expect(mockFetch).toHaveBeenCalledWith('http://10.0.2.2:8000/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid_access_token',
          'Content-Type': 'application/json'
        }
      });

      expect(result).toEqual(mockUser);
    });

    it('should handle unauthorized user profile request', async () => {
      const accessToken = 'invalid_access_token';

      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ detail: 'Invalid token' }),
        { status: 401 }
      ));

      await expect(authService.getCurrentUser(accessToken)).rejects.toThrow('Invalid token');
    });

    it('should handle user profile network errors', async () => {
      const accessToken = 'valid_access_token';

      mockFetch.mockRejectedValue(new Error('Connection timeout'));

      await expect(authService.getCurrentUser(accessToken)).rejects.toThrow('Connection timeout');
    });
  });

  describe('Token Storage Management', () => {
    it('should store tokens with correct expiration', async () => {
      const tokens = { ...mockTokens, expires_in: 3600 }; // 1 hour
      const user = mockUser;

      mockAsyncStorage.setItem.mockResolvedValue();

      await authService.storeTokens(tokens, user);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@dietintel_auth',
        expect.stringContaining('"access_token":"access_token_123"')
      );

      const storedDataCall = mockAsyncStorage.setItem.mock.calls[0][1];
      const storedData = JSON.parse(storedDataCall);
      
      expect(storedData.user).toEqual(user);
      expect(storedData.access_token).toBe(tokens.access_token);
      expect(storedData.refresh_token).toBe(tokens.refresh_token);
      expect(new Date(storedData.expires_at)).toBeInstanceOf(Date);
    });

    it('should handle token storage errors', async () => {
      const tokens = mockTokens;
      const user = mockUser;

      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage full'));

      await expect(authService.storeTokens(tokens, user)).rejects.toThrow('Failed to store authentication data');
    });

    it('should retrieve stored tokens', async () => {
      const storedData = {
        access_token: 'stored_access_token',
        refresh_token: 'stored_refresh_token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        user: mockUser
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(storedData));

      const result = await authService.getStoredTokens();

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@dietintel_auth');
      expect(result).toEqual(storedData);
    });

    it('should return null when no stored tokens', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await authService.getStoredTokens();

      expect(result).toBeNull();
    });

    it('should handle corrupted stored tokens', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid json');

      const result = await authService.getStoredTokens();

      expect(result).toBeNull();
    });

    it('should handle storage retrieval errors', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const result = await authService.getStoredTokens();

      expect(result).toBeNull();
    });

    it('should clear stored tokens', async () => {
      mockAsyncStorage.removeItem.mockResolvedValue();

      await authService.clearTokens();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@dietintel_auth');
    });
  });

  describe('Token Validation Utilities', () => {
    it('should correctly identify expired tokens', () => {
      const expiredDate = new Date(Date.now() - 1000).toISOString(); // 1 second ago
      const result = authService.isTokenExpired(expiredDate);
      expect(result).toBeTruthy();
    });

    it('should correctly identify valid tokens', () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      const result = authService.isTokenExpired(futureDate);
      expect(result).toBeFalsy();
    });

    it('should handle malformed date strings', () => {
      const malformedDate = 'invalid-date';
      const result = authService.isTokenExpired(malformedDate);
      expect(result).toBeFalsy(); // Invalid dates return false in JS comparisons
    });

    it('should check authentication status with valid tokens', async () => {
      const validStoredData = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        user: mockUser
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(validStoredData));

      const result = await authService.isAuthenticated();
      expect(result).toBeTruthy();
    });

    it('should check authentication status with expired tokens', async () => {
      const expiredStoredData = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: new Date(Date.now() - 1000).toISOString(),
        user: mockUser
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(expiredStoredData));

      const result = await authService.isAuthenticated();
      expect(result).toBeFalsy();
    });

    it('should return false for authentication status with no stored tokens', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await authService.isAuthenticated();
      expect(result).toBeFalsy();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete login flow', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Mock complete flow
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify(mockTokens), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockUser), { status: 200 }));

      mockAsyncStorage.setItem.mockResolvedValue();

      const result = await authService.login(credentials);

      // Verify complete flow
      expect(result.user).toEqual(mockUser);
      expect(result.tokens).toEqual(mockTokens);

      // Verify tokens are stored
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@dietintel_auth',
        expect.any(String)
      );
    });

    it('should handle complete logout flow', async () => {
      const refreshToken = 'valid_refresh_token';

      mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));
      mockAsyncStorage.removeItem.mockResolvedValue();

      await authService.logout(refreshToken);

      // Verify API logout call
      expect(mockFetch).toHaveBeenCalledWith('http://10.0.2.2:8000/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      // Verify local cleanup
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@dietintel_auth');
    });

    it('should handle token refresh flow', async () => {
      const refreshToken = 'valid_refresh_token';
      const newTokens = { ...mockTokens, access_token: 'new_access_token' };

      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify(newTokens), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockUser), { status: 200 }));

      mockAsyncStorage.setItem.mockResolvedValue();

      const result = await authService.refreshToken(refreshToken);

      expect(result.tokens.access_token).toBe('new_access_token');
      expect(result.user).toEqual(mockUser);
    });

    it('should handle rapid sequential API calls', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Mock responses for sequential calls
      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockTokens) as any)
        .mockResolvedValueOnce(createMockResponse(mockUser) as any);

      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      // Make rapid sequential login calls
      const result1 = await authService.login(credentials);
      
      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockTokens) as any)
        .mockResolvedValueOnce(createMockResponse(mockUser) as any);
      
      const result2 = await authService.login(credentials);

      expect(result1.user).toEqual(mockUser);
      expect(result2.user).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledTimes(4); // 2 login + 2 getCurrentUser calls
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(2); // Both calls should store tokens
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary network failures', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockTokens), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockUser), { status: 200 }));

      mockAsyncStorage.setItem.mockResolvedValue();

      // First attempt should fail
      await expect(authService.login(credentials)).rejects.toThrow('Network timeout');

      // Second attempt should succeed
      const result = await authService.login(credentials);
      expect(result.user).toEqual(mockUser);
    });

    it('should handle partial failures gracefully', async () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Login succeeds but user profile fetch fails
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify(mockTokens), { status: 200 }))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ detail: 'Profile service unavailable' }),
          { status: 503 }
        ));

      await expect(authService.login(credentials)).rejects.toThrow('Profile service unavailable');
    });
  });
});