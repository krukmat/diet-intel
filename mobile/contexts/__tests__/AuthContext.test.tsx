import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../AuthContext';
import { authService } from '../../services/AuthService';
import { User, AuthTokens, LoginCredentials, RegisterData } from '../../types/auth';

// Mock the AuthService
jest.mock('../../services/AuthService', () => ({
  authService: {
    getStoredTokens: jest.fn(),
    isTokenExpired: jest.fn(),
    refreshToken: jest.fn(),
    clearTokens: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
  }
}));

// Test component to interact with AuthContext
const TestComponent: React.FC<{ onAuthState?: (authState: any) => void }> = ({ onAuthState }) => {
  const auth = useAuth();
  
  useEffect(() => {
    if (onAuthState) {
      onAuthState(auth);
    }
  }, [auth.isAuthenticated, auth.isLoading, auth.user, onAuthState]);

  return <div data-testid="test-component">Test Component</div>;
};

describe('AuthContext Integration Tests', () => {
  const mockAuthService = authService as jest.Mocked<typeof authService>;
  let authState: any;

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

  beforeEach(() => {
    jest.clearAllMocks();
    authState = null;
  });

  describe('Context Provider Setup', () => {
    it('should provide auth context to children', async () => {
      mockAuthService.getStoredTokens.mockResolvedValue(null);
      
      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      expect(authState).toBeDefined();
      expect(authState.user).toBeNull();
      expect(authState.tokens).toBeNull();
      expect(authState.isAuthenticated).toBeFalsy();
      expect(typeof authState.login).toBe('function');
      expect(typeof authState.register).toBe('function');
      expect(typeof authState.logout).toBe('function');
    });

    it('should throw error when useAuth is used outside provider', () => {
      expect(() => {
        TestRenderer.create(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');
    });
  });

  describe('Authentication Initialization', () => {
    it('should initialize with no stored tokens', async () => {
      mockAuthService.getStoredTokens.mockResolvedValue(null);

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      expect(mockAuthService.getStoredTokens).toHaveBeenCalled();
      expect(authState.isAuthenticated).toBeFalsy();
      expect(authState.user).toBeNull();
      expect(authState.isLoading).toBeFalsy();
    });

    it('should restore valid stored tokens', async () => {
      const storedTokens = {
        access_token: 'stored_access_token',
        refresh_token: 'stored_refresh_token',
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        user: mockUser
      };

      mockAuthService.getStoredTokens.mockResolvedValue(storedTokens);
      mockAuthService.isTokenExpired.mockReturnValue(false);

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      expect(authState.isAuthenticated).toBeTruthy();
      expect(authState.user).toEqual(mockUser);
      expect(authState.tokens.access_token).toBe('stored_access_token');
    });

    it('should refresh expired tokens automatically', async () => {
      const storedTokens = {
        access_token: 'expired_access_token',
        refresh_token: 'valid_refresh_token',
        expires_at: new Date(Date.now() - 1000).toISOString(), // Expired
        user: mockUser
      };

      mockAuthService.getStoredTokens.mockResolvedValue(storedTokens);
      mockAuthService.isTokenExpired.mockReturnValue(true);
      mockAuthService.refreshToken.mockResolvedValue({
        user: mockUser,
        tokens: mockTokens
      });

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('valid_refresh_token');
      expect(authState.isAuthenticated).toBeTruthy();
      expect(authState.user).toEqual(mockUser);
    });

    it('should clear tokens when refresh fails', async () => {
      const storedTokens = {
        access_token: 'expired_access_token',
        refresh_token: 'invalid_refresh_token',
        expires_at: new Date(Date.now() - 1000).toISOString(),
        user: mockUser
      };

      mockAuthService.getStoredTokens.mockResolvedValue(storedTokens);
      mockAuthService.isTokenExpired.mockReturnValue(true);
      mockAuthService.refreshToken.mockRejectedValue(new Error('Refresh failed'));

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      expect(mockAuthService.clearTokens).toHaveBeenCalled();
      expect(authState.isAuthenticated).toBeFalsy();
    });
  });

  describe('Login Integration', () => {
    it('should successfully login user', async () => {
      mockAuthService.getStoredTokens.mockResolvedValue(null);
      mockAuthService.login.mockResolvedValue({
        user: mockUser,
        tokens: mockTokens
      });

      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      // Perform login
      await act(async () => {
        await authState.login(credentials);
      });

      expect(mockAuthService.login).toHaveBeenCalledWith(credentials);
      expect(authState.isAuthenticated).toBeTruthy();
      expect(authState.user).toEqual(mockUser);
      expect(authState.tokens).toEqual(mockTokens);
    });

    it('should handle login errors', async () => {
      mockAuthService.getStoredTokens.mockResolvedValue(null);
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      // Attempt login
      await expect(async () => {
        await act(async () => {
          await authState.login(credentials);
        });
      }).rejects.toThrow('Invalid credentials');

      expect(authState.isAuthenticated).toBeFalsy();
      expect(authState.user).toBeNull();
    });

    it('should set loading state during login', async () => {
      mockAuthService.getStoredTokens.mockResolvedValue(null);
      mockAuthService.login.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ user: mockUser, tokens: mockTokens }), 100)
        )
      );

      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      // Start login (don't await immediately)
      const loginPromise = act(async () => {
        await authState.login(credentials);
      });

      // Check loading state is true during login
      expect(authState.isLoading).toBeTruthy();

      await loginPromise;
      expect(authState.isLoading).toBeFalsy();
    });
  });

  describe('Registration Integration', () => {
    it('should successfully register user', async () => {
      mockAuthService.getStoredTokens.mockResolvedValue(null);
      mockAuthService.register.mockResolvedValue({
        user: mockUser,
        tokens: mockTokens
      });

      const registerData: RegisterData = {
        email: 'test@example.com',
        password: 'password123',
        full_name: 'Test User'
      };

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      // Perform registration
      await act(async () => {
        await authState.register(registerData);
      });

      expect(mockAuthService.register).toHaveBeenCalledWith(registerData);
      expect(authState.isAuthenticated).toBeTruthy();
      expect(authState.user).toEqual(mockUser);
      expect(authState.tokens).toEqual(mockTokens);
    });

    it('should handle registration errors', async () => {
      mockAuthService.getStoredTokens.mockResolvedValue(null);
      mockAuthService.register.mockRejectedValue(new Error('Email already exists'));

      const registerData: RegisterData = {
        email: 'existing@example.com',
        password: 'password123',
        full_name: 'Test User'
      };

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      await expect(async () => {
        await act(async () => {
          await authState.register(registerData);
        });
      }).rejects.toThrow('Email already exists');

      expect(authState.isAuthenticated).toBeFalsy();
    });

    it('should register with developer code', async () => {
      mockAuthService.getStoredTokens.mockResolvedValue(null);
      
      const developerUser = { ...mockUser, is_developer: true, role: 'developer' as const };
      mockAuthService.register.mockResolvedValue({
        user: developerUser,
        tokens: mockTokens
      });

      const registerData: RegisterData = {
        email: 'dev@example.com',
        password: 'password123',
        full_name: 'Developer User',
        developer_code: 'DEV_CODE_123'
      };

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      await act(async () => {
        await authState.register(registerData);
      });

      expect(mockAuthService.register).toHaveBeenCalledWith(registerData);
      expect(authState.user?.is_developer).toBeTruthy();
    });
  });

  describe('Logout Integration', () => {
    it('should successfully logout user', async () => {
      // Start with authenticated user
      const storedTokens = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        user: mockUser
      };

      mockAuthService.getStoredTokens.mockResolvedValue(storedTokens);
      mockAuthService.isTokenExpired.mockReturnValue(false);
      mockAuthService.logout.mockResolvedValue();

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      expect(authState.isAuthenticated).toBeTruthy();

      // Perform logout
      await act(async () => {
        await authState.logout();
      });

      expect(mockAuthService.logout).toHaveBeenCalledWith('refresh_token');
      expect(authState.isAuthenticated).toBeFalsy();
      expect(authState.user).toBeNull();
      expect(authState.tokens).toBeNull();
    });

    it('should handle logout API errors gracefully', async () => {
      const storedTokens = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        user: mockUser
      };

      mockAuthService.getStoredTokens.mockResolvedValue(storedTokens);
      mockAuthService.isTokenExpired.mockReturnValue(false);
      mockAuthService.logout.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      // Logout should still clear local state even if API fails
      await act(async () => {
        await authState.logout();
      });

      expect(authState.isAuthenticated).toBeFalsy();
      expect(authState.user).toBeNull();
    });
  });

  describe('Token Refresh Integration', () => {
    it('should successfully refresh tokens', async () => {
      const storedTokens = {
        access_token: 'old_access_token',
        refresh_token: 'refresh_token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        user: mockUser
      };

      const newTokens: AuthTokens = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        token_type: 'bearer',
        expires_in: 3600
      };

      mockAuthService.getStoredTokens.mockResolvedValue(storedTokens);
      mockAuthService.isTokenExpired.mockReturnValue(false);
      mockAuthService.refreshToken.mockResolvedValue({
        user: mockUser,
        tokens: newTokens
      });

      let currentAuthState: any = null;

      const TestComponentWithCapture = () => {
        const auth = useAuth();
        currentAuthState = auth;
        return <div data-testid="test-component">Test Component</div>;
      };

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponentWithCapture />
          </AuthProvider>
        );
      });

      // Perform token refresh
      await act(async () => {
        await currentAuthState.refreshTokens();
      });

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('refresh_token');
      expect(currentAuthState.tokens?.access_token).toBe('new_access_token');
      expect(currentAuthState.isAuthenticated).toBeTruthy();
    });

    it('should logout user when refresh fails', async () => {
      const storedTokens = {
        access_token: 'access_token',
        refresh_token: 'invalid_refresh_token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        user: mockUser
      };

      mockAuthService.getStoredTokens.mockResolvedValue(storedTokens);
      mockAuthService.isTokenExpired.mockReturnValue(false);
      mockAuthService.refreshToken.mockRejectedValue(new Error('Invalid refresh token'));
      mockAuthService.logout.mockResolvedValue();

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      await expect(async () => {
        await act(async () => {
          await authState.refreshTokens();
        });
      }).rejects.toThrow('Invalid refresh token');

      expect(authState.isAuthenticated).toBeFalsy();
      expect(authState.user).toBeNull();
    });

    it('should throw error when no refresh token available', async () => {
      mockAuthService.getStoredTokens.mockResolvedValue(null);

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      await expect(async () => {
        await act(async () => {
          await authState.refreshTokens();
        });
      }).rejects.toThrow('No refresh token available');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle auth initialization errors', async () => {
      mockAuthService.getStoredTokens.mockRejectedValue(new Error('Storage error'));

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      expect(mockAuthService.clearTokens).toHaveBeenCalled();
      expect(authState.isLoading).toBeFalsy();
      expect(authState.isAuthenticated).toBeFalsy();
    });

    it('should handle concurrent auth operations', async () => {
      mockAuthService.getStoredTokens.mockResolvedValue(null);
      mockAuthService.login.mockResolvedValue({
        user: mockUser,
        tokens: mockTokens
      });

      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      await act(async () => {
        TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      // Multiple concurrent logins should be handled properly
      await act(async () => {
        await Promise.all([
          authState.login(credentials),
          authState.login(credentials)
        ]);
      });

      expect(authState.isAuthenticated).toBeTruthy();
    });

    it('should maintain auth state consistency', async () => {
      const storedTokens = {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        user: mockUser
      };

      mockAuthService.getStoredTokens.mockResolvedValue(storedTokens);
      mockAuthService.isTokenExpired.mockReturnValue(false);

      let component: any;
      await act(async () => {
        component = TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      // Update component and verify state consistency
      await act(async () => {
        component.update(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      expect(authState.isAuthenticated).toBeTruthy();
      expect(authState.user).toEqual(mockUser);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle component unmounting during auth operations', async () => {
      mockAuthService.getStoredTokens.mockResolvedValue(null);
      mockAuthService.login.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ user: mockUser, tokens: mockTokens }), 100)
        )
      );

      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      let component: any;
      await act(async () => {
        component = TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      // Start login but unmount before completion
      const loginPromise = act(async () => {
        await authState.login(credentials);
      });

      component.unmount();

      // Should not cause memory leaks or errors
      await expect(loginPromise).resolves.not.toThrow();
    });

    it('should cleanup resources properly', async () => {
      mockAuthService.getStoredTokens.mockResolvedValue(null);

      let component: any;
      await act(async () => {
        component = TestRenderer.create(
          <AuthProvider>
            <TestComponent onAuthState={(state) => authState = state} />
          </AuthProvider>
        );
      });

      // Unmount should not cause errors
      expect(() => component.unmount()).not.toThrow();
    });
  });
});