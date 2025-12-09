export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  is_developer: boolean;
  role: 'standard' | 'premium' | 'developer';
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  developer_code?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
}

export interface TokenStorage {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user: User;
}