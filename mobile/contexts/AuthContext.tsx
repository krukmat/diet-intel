import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginCredentials, RegisterData, AuthTokens, AuthContextType } from '../types/auth';
import { authService } from '../services/AuthService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize authentication state on app start
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      
      const storedTokens = await authService.getStoredTokens();
      if (!storedTokens) {
        setIsLoading(false);
        return;
      }

      // Check if tokens are expired
      if (authService.isTokenExpired(storedTokens.expires_at)) {
        // Try to refresh tokens
        try {
          const refreshResult = await authService.refreshToken(storedTokens.refresh_token);
          setUser(refreshResult.user);
          setTokens(refreshResult.tokens);
          setIsAuthenticated(true);
        } catch (error) {
          console.log('Token refresh failed, user needs to log in again');
          await authService.clearTokens();
        }
      } else {
        // Tokens are valid, restore auth state
        setUser(storedTokens.user);
        setTokens({
          access_token: storedTokens.access_token,
          refresh_token: storedTokens.refresh_token,
          token_type: 'bearer',
          expires_in: Math.floor((new Date(storedTokens.expires_at).getTime() - Date.now()) / 1000),
        });
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      await authService.clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      setIsLoading(true);
      const result = await authService.login(credentials);
      
      setUser(result.user);
      setTokens(result.tokens);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData): Promise<void> => {
    try {
      setIsLoading(true);
      const result = await authService.register(data);
      
      setUser(result.user);
      setTokens(result.tokens);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await authService.logout(tokens?.refresh_token);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local state regardless of API call success
      setUser(null);
      setTokens(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  const refreshTokens = async (): Promise<void> => {
    if (!tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    try {
      const result = await authService.refreshToken(tokens.refresh_token);
      setUser(result.user);
      setTokens(result.tokens);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Token refresh error:', error);
      // If refresh fails, logout user
      await logout();
      throw error;
    }
  };

  const contextValue: AuthContextType = {
    user,
    tokens,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshTokens,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}