import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  LoginCredentials,
  RegisterData,
  AuthTokens,
  TokenStorage,
} from '../types/auth';

const API_BASE_URL = 'http://10.0.2.2:8000'; // Android emulator localhost

type AsyncStorageLike = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

let storageClient: AsyncStorageLike = AsyncStorage;

export const setAuthServiceStorage = (customStorage: AsyncStorageLike) => {
  storageClient = customStorage;
};

export const resetAuthServiceStorage = () => {
  storageClient = AsyncStorage;
};

export class AuthService {
  private readonly STORAGE_KEY = '@dietintel_auth';

  private get storage(): AsyncStorageLike {
    return storageClient;
  }

  async login(
    credentials: LoginCredentials,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const tokens: AuthTokens = await response.json();

      const user = await this.getCurrentUser(tokens.access_token);

      await this.storeTokens(tokens, user);

      return { user, tokens };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(
    data: RegisterData,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const tokens: AuthTokens = await response.json();

      const user = await this.getCurrentUser(tokens.access_token);

      await this.storeTokens(tokens, user);

      return { user, tokens };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async refreshToken(
    refreshToken: string,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Token refresh failed');
      }

      const tokens: AuthTokens = await response.json();

      const user = await this.getCurrentUser(tokens.access_token);

      await this.storeTokens(tokens, user);

      return { user, tokens };
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  async logout(refreshToken?: string): Promise<void> {
    try {
      if (refreshToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      await this.clearTokens();
    }
  }

  async getCurrentUser(accessToken: string): Promise<User> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get user profile');
      }

      const user: User = await response.json();
      return user;
    } catch (error) {
      console.error('Get user profile error:', error);
      throw error;
    }
  }

  async storeTokens(tokens: AuthTokens, user: User): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

      const storagePayload: TokenStorage = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        user,
      };

      await this.storage.setItem(
        this.STORAGE_KEY,
        JSON.stringify(storagePayload),
      );
    } catch (error) {
      console.error('Token storage error:', error);
      throw new Error('Failed to store authentication data');
    }
  }

  async getStoredTokens(): Promise<TokenStorage | null> {
    try {
      const stored = await this.storage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return null;
      }

      return JSON.parse(stored) as TokenStorage;
    } catch (error) {
      console.error('Token retrieval error:', error);
      return null;
    }
  }

  async clearTokens(): Promise<void> {
    try {
      await this.storage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Token clear error:', error);
    }
  }

  isTokenExpired(expiresAt: string): boolean {
    return new Date() >= new Date(expiresAt);
  }

  async isAuthenticated(): Promise<boolean> {
    const stored = await this.getStoredTokens();
    if (!stored) {
      return false;
    }

    return !this.isTokenExpired(stored.expires_at);
  }
}

export const authService = new AuthService();
