import { AUTH_ROLE_OPTIONS, buildEmptyAuthTokens, hasValidAuthTokens } from '../auth';

describe('auth types', () => {
  it('supports creating auth-shaped data', () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      full_name: 'Test User',
      is_developer: false,
      role: 'standard',
      is_active: true,
      email_verified: false,
      created_at: '2024-01-01T00:00:00Z',
    };

    const tokens = {
      access_token: 'access',
      refresh_token: 'refresh',
      token_type: 'bearer',
      expires_in: 3600,
    };

    const storage = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: '2024-01-02T00:00:00Z',
      user,
    };

    expect(user.email).toBe('user@example.com');
    expect(tokens.expires_in).toBe(3600);
    expect(storage.user.id).toBe('user-1');
    expect(AUTH_ROLE_OPTIONS).toContain('standard');
    expect(buildEmptyAuthTokens()).toEqual({
      access_token: '',
      refresh_token: '',
      token_type: 'bearer',
      expires_in: 0,
    });
    expect(hasValidAuthTokens(tokens)).toBe(true);
  });
});
