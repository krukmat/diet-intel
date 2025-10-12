// EPIC_A.A1: Tests Jest para funcionalidad social de perfiles

const request = require('supertest');
const app = require('../app');

// Mock de la API para evitar llamadas reales durante tests
jest.mock('../utils/api');
const dietIntelAPI = require('../utils/api');

describe('Social Profile Routes', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock exitoso por defecto
    dietIntelAPI.getProfile = jest.fn().mockResolvedValue({
      user_id: '123',
      handle: '@testuser',
      bio: 'Test bio',
      avatar_url: null,
      visibility: 'public',
      stats: {
        followers_count: 10,
        following_count: 5,
        posts_count: 3,
        points_total: 150
      },
      posts: [
        {
          post_id: 'post1',
          text: 'Test post',
          counters: { likes: 2, comments: 3 },
          created_at: new Date()
        }
      ],
      posts_notice: null
    });

    dietIntelAPI.getCurrentUser = jest.fn().mockResolvedValue({
      id: '123',
      full_name: 'Test User',
      is_developer: false
    });

    dietIntelAPI.updateProfile = jest.fn().mockResolvedValue({
      user_id: '123',
      handle: '@updateduser'
    });
  });

  describe('GET /profiles/:userId - Profile view', () => {
    test('should render profile with posts when public', async () => {
      // Mock perfil público con posts
      dietIntelAPI.getProfile.mockResolvedValue({
        user_id: '456',
        handle: '@publicuser',
        visibility: 'public',
        posts: [{ post_id: '1', text: 'Public post' }],
        posts_notice: null
      });

      const response = await request(app)
        .get('/profiles/456')
        .expect(200);

      expect(response.text).toContain('@publicuser');
      expect(response.text).toContain('Public post');
      expect(dietIntelAPI.getProfile).toHaveBeenCalledWith('456', undefined);
    });

    test('should show "Follow to see posts" message for private profiles', async () => {
      // Mock perfil privado sin posts
      dietIntelAPI.getProfile.mockResolvedValue({
        user_id: '789',
        handle: '@privateuser',
        visibility: 'followers_only',
        posts: [],
        posts_notice: 'Follow to see posts'
      });

      const response = await request(app)
        .get('/profiles/789')
        .expect(200);

      expect(response.text).toContain('@privateuser');
      expect(response.text).toContain('Follow to see posts');
      expect(response.text).toContain('No posts yet');
    });

    test('should show edit button for profile owner', async () => {
      // Simular autenticación - el middleware checkAuth pone currentUser
      const appWithAuth = request.agent(app);

      const response = await appWithAuth
        .get('/profiles/123')
        .set('Cookie', ['access_token=mock_token']) // Mock cookie
        .expect(200);

      expect(response.text).toContain('@testuser');
      expect(response.text).toContain('Edit Profile');
    });

    test('should handle 404 for non-existent profiles', async () => {
      dietIntelAPI.getProfile.mockRejectedValue({
        response: { status: 404 }
      });

      const response = await request(app)
        .get('/profiles/999')
        .expect(200); // Express maneja como 200 con página de error custom

      expect(response.text).toContain('Profile not found');
    });
  });

  describe('GET /profiles/me/edit - Profile edit form', () => {
    test('should render edit form with prefilled data', async () => {
      const appWithAuth = request.agent(app);

      const response = await appWithAuth
        .get('/profiles/me/edit')
        .set('Cookie', ['access_token=mock_token'])
        .expect(200);

      expect(dietIntelAPI.getCurrentUser).toHaveBeenCalled();
      expect(dietIntelAPI.getProfile).toHaveBeenCalled();
      expect(response.text).toContain('Edit Profile');
      expect(response.text).toContain('@testuser');
      expect(response.text).toContain('Test bio');
    });

    test('should redirect to login when not authenticated', async () => {
      const response = await request(app)
        .get('/profiles/me/edit')
        .expect(302); // Redirect

      expect(response.headers.location).toContain('/auth/login');
    });
  });

  describe('POST /profiles/me - Profile update', () => {
    test('should update profile and redirect to profile view', async () => {
      const appWithAuth = request.agent(app);

      const response = await appWithAuth
        .post('/profiles/me')
        .set('Cookie', ['access_token=mock_token'])
        .send({
          handle: 'newhandle',
          bio: 'Updated bio',
          visibility: 'followers_only'
        })
        .expect(302); // Redirect after save

      expect(dietIntelAPI.updateProfile).toHaveBeenCalledWith({
        handle: 'newhandle',
        bio: 'Updated bio',
        visibility: 'followers_only'
      }, 'mock_token');

      expect(response.headers.location).toContain('/profiles/');
    });

    test('should validate handle format', async () => {
      const appWithAuth = request.agent(app);

      const response = await appWithAuth
        .post('/profiles/me')
        .set('Cookie', ['access_token=mock_token'])
        .send({
          handle: 'invalid-handle-with-dash', // Debe fallar
          bio: 'Valid bio'
        })
        .expect(200); // No redirect, renders form with error

      expect(response.text).toContain('Invalid handle format');
    });

    test('should validate bio length', async () => {
      const appWithAuth = request.agent(app);

      const response = await appWithAuth
        .post('/profiles/me')
        .set('Cookie', ['access_token=mock_token'])
        .send({
          handle: 'validhandle',
          bio: 'A'.repeat(281) // Excede límite de 280
        })
        .expect(200); // No redirect, renders form with error

      expect(response.text).toContain('Bio too long');
    });

    test('should redirect to login when not authenticated', async () => {
      const response = await request(app)
        .post('/profiles/me')
        .send({ handle: 'test', bio: 'test' })
        .expect(302); // Redirect

      expect(response.headers.location).toContain('/auth/login');
    });
  });
});
