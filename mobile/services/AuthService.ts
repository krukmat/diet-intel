/**
 * AuthService - Servicio de autenticación
 * Maneja operaciones de login, registro y gestión de tokens
 */

import axios, { AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEnvironmentConfig } from '../config/environments';
import { AuthTokens, LoginCredentials, RegisterData, TokenStorage, User } from '../types/auth';

// Tipos de respuesta
export interface RegisterResult {
  success: boolean;
  message: string;
  user_id?: string;
  error?: string;
}

export interface LoginResult {
  success: boolean;
  message: string;
  token?: string;
  user?: any;
  error?: string;
}

interface AuthResponse {
  user?: User;
  tokens?: AuthTokens;
  access_token?: string;
  refresh_token?: string;
  token?: string;
  token_type?: string;
  expires_in?: number;
  expires_at?: string;
}

// Clase principal del servicio
export class AuthService {
  private baseURL: string;
  private currentEnvironment: string;
  private readonly tokenStorageKey = '@auth_tokens';

  constructor() {
    const config = getEnvironmentConfig();
    this.baseURL = config.apiBaseUrl;
    this.currentEnvironment = config.name || 'android_dev';
  }

  setEnvironment(environment: string): void {
    this.currentEnvironment = environment;
    this.baseURL = getEnvironmentConfig(environment).apiBaseUrl;
  }

  /**
   * Registra un nuevo usuario
   */
  async registerUser(email: string, password: string): Promise<RegisterResult> {
    try {
      const response: AxiosResponse<RegisterResult> = await axios.post(
        `${this.baseURL}/auth/register`,
        {
          email,
          password,
        }
      );

      return {
        success: true,
        message: response.data.message || 'Account created successfully',
        user_id: response.data.user_id,
      };
    } catch (error: any) {
      console.error('AuthService.registerUser error:', error);

      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed',
        error: error.response?.data?.error || 'Unknown error',
      };
    }
  }

  /**
   * Inicia sesión de usuario
   */
  async loginUser(email: string, password: string): Promise<LoginResult> {
    try {
      const response: AxiosResponse<LoginResult> = await axios.post(
        `${this.baseURL}/auth/login`,
        {
          email,
          password,
        }
      );

      // Guardar token si el login fue exitoso
      if (response.data.token) {
        await this.saveToken(response.data.token);
      }

      return {
        success: true,
        message: response.data.message || 'Login successful',
        token: response.data.token,
        user: response.data.user,
      };
    } catch (error: any) {
      console.error('AuthService.loginUser error:', error);

      return {
        success: false,
        message: error.response?.data?.message || 'Login failed',
        error: error.response?.data?.error || 'Unknown error',
      };
    }
  }

  /**
   * Cierra sesión del usuario
   */
  async logoutUser(): Promise<void> {
    try {
      await this.removeToken();
    } catch (error) {
      console.error('AuthService.logoutUser error:', error);
    }
  }

  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const response: AxiosResponse<AuthResponse> = await axios.post(
        `${this.baseURL}/auth/login`,
        credentials
      );

      const { user, tokens, expires_at } = this.normalizeAuthResponse(response.data);
      const resolvedUser = user ?? (tokens.access_token ? await this.getCurrentUser(tokens.access_token) : undefined);
      if (!resolvedUser) {
        throw new Error('Missing user data in login response');
      }

      await this.storeTokens(tokens, resolvedUser, expires_at);
      return { user: resolvedUser, tokens };
    } catch (error) {
      console.error('AuthService.login error:', error);
      throw error;
    }
  }

  async register(data: RegisterData): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const response: AxiosResponse<AuthResponse> = await axios.post(
        `${this.baseURL}/auth/register`,
        data
      );

      const { user, tokens, expires_at } = this.normalizeAuthResponse(response.data);
      const resolvedUser = user ?? (tokens.access_token ? await this.getCurrentUser(tokens.access_token) : undefined);
      if (!resolvedUser) {
        throw new Error('Missing user data in registration response');
      }

      await this.storeTokens(tokens, resolvedUser, expires_at);
      return { user: resolvedUser, tokens };
    } catch (error) {
      console.error('AuthService.register error:', error);
      throw error;
    }
  }

  async logout(refreshToken?: string | null): Promise<void> {
    try {
      if (refreshToken) {
        await axios.post(`${this.baseURL}/auth/logout`, { refresh_token: refreshToken });
      }
    } catch (error) {
      console.warn('AuthService.logout error:', error);
    } finally {
      await this.clearTokens();
    }
  }

  async refreshToken(refreshToken: string): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const response: AxiosResponse<AuthResponse> = await axios.post(
        `${this.baseURL}/auth/refresh`,
        { refresh_token: refreshToken, refreshToken }
      );

      const { user, tokens, expires_at } = this.normalizeAuthResponse(response.data, refreshToken);
      if (!user) {
        throw new Error('Missing user data in refresh response');
      }

      await this.storeTokens(tokens, user, expires_at);
      return { user, tokens };
    } catch (error) {
      console.error('AuthService.refreshToken error:', error);
      throw error;
    }
  }

  async getStoredTokens(): Promise<TokenStorage | null> {
    try {
      const stored = await AsyncStorage.getItem(this.tokenStorageKey);
      if (!stored) {
        return null;
      }
      return JSON.parse(stored) as TokenStorage;
    } catch (error) {
      console.warn('AuthService.getStoredTokens error:', error);
      return null;
    }
  }

  async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.tokenStorageKey);
    } catch (error) {
      console.warn('AuthService.clearTokens error:', error);
    }
  }

  isTokenExpired(expiresAt: string): boolean {
    const expirationTime = new Date(expiresAt).getTime();
    if (Number.isNaN(expirationTime)) {
      return true;
    }
    return expirationTime <= Date.now();
  }

  async getCurrentUser(accessToken: string): Promise<User | null> {
    try {
      const response: AxiosResponse<User> = await axios.get(`${this.baseURL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.warn('AuthService.getCurrentUser error:', error);
      return null;
    }
  }

  /**
   * Obtiene el token guardado
   */
  async getToken(): Promise<string | null> {
    // En una implementación real, esto vendría de AsyncStorage o SecureStore
    return null;
  }

  /**
   * Guarda el token
   */
  private async saveToken(token: string): Promise<void> {
    // En una implementación real, guardar en AsyncStorage o SecureStore
    console.log('Token saved:', token);
  }

  /**
   * Remueve el token
   */
  private async removeToken(): Promise<void> {
    // En una implementación real, remover de AsyncStorage o SecureStore
    console.log('Token removed');
  }

  /**
   * Verifica si el usuario está autenticado
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  }

  private async storeTokens(tokens: AuthTokens, user: User, expiresAt?: string): Promise<void> {
    const resolvedExpiresAt = expiresAt || new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const payload: TokenStorage = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: resolvedExpiresAt,
      user,
    };
    await AsyncStorage.setItem(this.tokenStorageKey, JSON.stringify(payload));
  }

  private normalizeAuthResponse(
    data: AuthResponse,
    fallbackRefreshToken?: string
  ): { user?: User; tokens: AuthTokens; expires_at: string } {
    const accessToken = data.access_token || data.token || data.tokens?.access_token || '';
    const refreshToken = data.refresh_token || data.tokens?.refresh_token || fallbackRefreshToken || '';
    const tokenType = data.token_type || data.tokens?.token_type || 'bearer';
    const expiresIn = data.expires_in || data.tokens?.expires_in || 3600;
    const expiresAt = data.expires_at || new Date(Date.now() + expiresIn * 1000).toISOString();

    return {
      user: data.user,
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: tokenType,
        expires_in: expiresIn,
      },
      expires_at: expiresAt,
    };
  }
}

// Instancia singleton del servicio
export const authService = new AuthService();
