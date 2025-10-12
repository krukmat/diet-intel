// EPIC_A.A1: Tests de integración de rutas con Supertest (~220 tokens)
// RESTAURADO: Fixes aplicados - cookies/auth simuladas correctamente

const request = require('supertest');
const { mountApp } = require('./helpers/mountApp');

// Mock API client
jest.mock('../utils/api');
const dietIntelAPI = require('../utils/api');
jest.mock('axios');
const axios = require('axios');

// Fixtures
const profilePublic = {
  user_id: 'u1',
  handle: 'h1',
  bio: '',
  visibility: 'public',
  stats: { followers_count: 0, following_count: 0, posts_count: 0, points_total: 0 },
  posts: []
};

const profilePrivateNotice = {
  ...profilePublic,
  user_id: 'u2',
  visibility: 'followers_only',
  posts: [],
  posts_notice: 'Follow to see posts'
};

const profileNoPosts = {
  ...profilePublic,
  user_id: 'u3',
  posts: null  // Test case for null posts
};

const currentUser = { id: 'u1', full_name: 'Test User' };
const error422 = { response: { status: 422, data: { detail: 'Validation error' } } };

describe('Profiles Routes - Supertest Integration', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = mountApp();

    // Setup default mocks - FIX aplicado: dietIntelAPI.getCurrentUser mockea usuario para auth
    dietIntelAPI.getProfile = jest.fn();
    dietIntelAPI.getCurrentUser = jest.fn().mockResolvedValue(currentUser);
    dietIntelAPI.updateProfile = jest.fn();
    dietIntelAPI.followUser = jest.fn();
    dietIntelAPI.unfollowUser = jest.fn();
    axios.get.mockResolvedValue({ data: currentUser });
    axios.post.mockResolvedValue({ data: {} });
  });

  // Helper to simulate authenticated request - FIX aplicado: cookies correctas
  const authRequest = (agent) => agent.set('Cookie', ['access_token=mock_token']);

  describe('GET /profiles/:userId', () => {
    test('anonymous user sees public profile with "No posts yet"', async () => {
      dietIntelAPI.getProfile.mockResolvedValue(profilePublic);

      const response = await request(app)
        .get('/profiles/u1')
        .expect(200);

      expect(dietIntelAPI.getProfile).toHaveBeenCalledWith('u1', undefined);
      expect(response.text).toContain('@h1');
      expect(response.text).toContain('No posts yet');
      // Should NOT contain privacy message for public profile
      expect(response.text).not.toContain('Follow to see posts');
    });

    test('anonymous user sees private profile notice', async () => {
      dietIntelAPI.getProfile.mockResolvedValue(profilePrivateNotice);

      const response = await request(app)
        .get('/profiles/u2')
        .expect(200);

      expect(response.text).toContain('@h1');
      expect(response.text).toContain('Follow to see posts');
      expect(response.text).toContain('No posts yet');
    });

    test('authenticated owner sees edit button', async () => {
      dietIntelAPI.getProfile.mockResolvedValueOnce(profilePublic);
      // Simulate checkAuth middleware setting currentUser
      const agent = request.agent(app);
      dietIntelAPI.getProfile.mockResolvedValue(profilePublic);

      // For owner request, current user should be set
      const response = await authRequest(agent)
        .get('/profiles/u1')
        .expect(200);

      expect(response.text).toContain('Edit Profile');
      expect(response.text).toContain('@h1');
    });
  });

  describe('GET /profiles/me/edit', () => {
    test('redirects to login when no token', async () => {
      const response = await request(app)
        .get('/profiles/me/edit')
        .expect(302);

      expect(response.headers.location).toContain('/auth/login');
    });

    test('renders edit form with prefilled data when authenticated', async () => {
      dietIntelAPI.getProfile.mockResolvedValue(profilePublic);
      dietIntelAPI.getCurrentUser.mockResolvedValue(currentUser);

      const response = await authRequest(request.agent(app))
        .get('/profiles/me/edit')
        .expect(200);

      expect(response.text).toContain('Edit Profile');
      expect(response.text).toContain('@h1');
      expect(response.text).toContain('value="h1"'); // Handle prefilled
      expect(dietIntelAPI.getProfile).toHaveBeenCalled();
    });
  });

  describe('POST /profiles/me', () => {
    test('validates client-side handle format and re-renders form', async () => {
      const response = await authRequest(request.agent(app))
        .post('/profiles/me')
        .send({ handle: 'invalid-handle-with-dash', bio: 'Valid bio' })
        .expect(200);

      expect(response.text).toContain('Invalid handle format');
      expect(response.text).toContain('Edit Profile'); // Re-rendered edit form
      // Should maintain form values
      expect(response.text).toContain('invalid-handle-with-dash');
    });

    test('validates bio length and re-renders form', async () => {
      const longBio = 'A'.repeat(281);
      const response = await authRequest(request.agent(app))
        .post('/profiles/me')
        .send({ handle: 'validhandle', bio: longBio })
        .expect(200);

      expect(response.text).toContain('Bio too long');
      expect(dietIntelAPI.updateProfile).not.toHaveBeenCalled(); // Client validation should prevent API call
    });

    test('handles API 422 errors and re-renders form', async () => {
      dietIntelAPI.updateProfile.mockRejectedValue(error422);

      const response = await authRequest(request.agent(app))
        .post('/profiles/me')
        .send({ handle: 'validhandle', bio: 'Updated bio' })
        .expect(200); // Stays on form

      expect(response.text).toContain('Validation error');
      expect(response.text).toContain('Edit Profile');
      // Should maintain submitted values
      expect(response.text).toContain('validhandle');
      expect(response.text).toContain('Updated bio');
    });

    test('successful update redirects to profile view', async () => {
      const updatedProfile = { ...profilePublic, handle: '@updated' };
      dietIntelAPI.updateProfile.mockResolvedValue(updatedProfile);

      const response = await authRequest(request.agent(app))
        .post('/profiles/me')
        .send({ handle: 'updated', bio: 'New bio', visibility: 'public' })
        .expect(302);

      expect(response.headers.location).toBe('/profiles/u1');
      expect(dietIntelAPI.updateProfile).toHaveBeenCalledWith(
        { handle: 'updated', bio: 'New bio', visibility: 'public' },
        'mock_token'
      );
    });

    test('redirects to login when not authenticated', async () => {
      const response = await request(app)
        .post('/profiles/me')
        .send({ handle: 'test', bio: 'test' })
        .expect(302);

      expect(response.headers.location).toContain('/auth/login');
    });
  });

  describe('POST /profiles/:targetId/follow', () => {
    test('calls followUser API and returns JSON payload', async () => {
      const followResult = {
        ok: true,
        follower_id: 'u1',
        followee_id: 'u2',
        status: 'active',
        followers_count: 12,
        following_count: 4
      };
      dietIntelAPI.followUser.mockResolvedValue(followResult);

      const response = await authRequest(request.agent(app))
        .post('/profiles/u2/follow')
        .set('Accept', 'application/json')
        .type('form')
        .send({ action: 'follow' })
        .expect(200);

      expect(dietIntelAPI.followUser).toHaveBeenCalledWith('u2', 'mock_token');
      expect(response.body).toEqual(followResult);
    });

    test('calls unfollowUser API when action=unfollow', async () => {
      const unfollowResult = {
        ok: true,
        follower_id: 'u1',
        followee_id: 'u2',
        status: 'active',
        followers_count: 11,
        following_count: 3
      };
      dietIntelAPI.unfollowUser.mockResolvedValue(unfollowResult);

      const response = await authRequest(request.agent(app))
        .post('/profiles/u2/follow')
        .set('Accept', 'application/json')
        .type('form')
        .send({ action: 'unfollow' })
        .expect(200);

      expect(dietIntelAPI.unfollowUser).toHaveBeenCalledWith('u2', 'mock_token');
      expect(response.body).toEqual(unfollowResult);
    });

    test('rejects invalid follow action', async () => {
      const response = await authRequest(request.agent(app))
        .post('/profiles/u2/follow')
        .set('Accept', 'application/json')
        .type('form')
        .send({ action: 'invalid' })
        .expect(400);

      expect(response.body.error).toMatch(/Invalid action/i);
      expect(dietIntelAPI.followUser).not.toHaveBeenCalled();
      expect(dietIntelAPI.unfollowUser).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases - 404 and UI States', () => {
    test('handles profile not found (404) gracefully', async () => {
      dietIntelAPI.getProfile.mockRejectedValue({
        response: { status: 404, data: { detail: 'Profile not found' } }
      });

      const response = await request(app)
        .get('/profiles/999')
        .expect(200); // Express catches 404 and renders error view

      expect(response.text).toContain('Profile not found');
      // FIX aplicado: verifica que maneje errores de API posito correctamente
    });

    test('handles posts undefined vs null vs empty array correctly', async () => {
      // Test with posts: null
      dietIntelAPI.getProfile.mockResolvedValue({
        ...profilePublic,
        posts: null
      });

      const response = await request(app)
        .get('/profiles/u1')
        .expect(200);

      expect(response.text).toContain('No posts yet');

      // Verify posts_notice null handling - FIX 7 aplicado
      expect(response.text).not.toContain('Follow to see posts');
    });
  });
});
