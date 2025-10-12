// EPIC_A.A1: Tests de renderizado de vistas EJS con Supertest (~120 tokens)

const request = require('supertest');
const { mountApp } = require('./helpers/mountApp');

// Mock API client
jest.mock('../utils/api');
const dietIntelAPI = require('../utils/api');

// Mock EJS templates if needed (but we'll use mountApp which includes them)

describe('Profile Views - EJS Rendering', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = mountApp();

    // Basic mocks
    dietIntelAPI.getProfile = jest.fn();
    dietIntelAPI.getCurrentUser = jest.fn().mockResolvedValue({ id: 'u1', full_name: 'Test User' });
    dietIntelAPI.updateProfile = jest.fn();
  });

  describe('show.ejs rendering', () => {
    test('renders posts_notice when profile has privacy message', async () => {
      const profileWithNotice = {
        user_id: 'u2',
        handle: 'secretuser',
        bio: 'Private account',
        posts: [],
        posts_notice: 'Follow to see posts'
      };
      dietIntelAPI.getProfile.mockResolvedValue(profileWithNotice);

      const response = await request(app)
        .get('/profiles/u2')
        .expect(200);

      expect(response.text).toContain('Follow to see posts');
      expect(response.text).toContain('No posts yet');
      expect(response.text).toContain('secretuser');
    });

    test('does not show posts_notice on public profiles', async () => {
      const publicProfile = {
        user_id: 'u1',
        handle: 'publicuser',
        bio: 'I am public',
        posts: [],
        posts_notice: null
      };
      dietIntelAPI.getProfile.mockResolvedValue(publicProfile);

      const response = await request(app)
        .get('/profiles/u1')
        .expect(200);

      expect(response.text).toContain('publicuser');
      expect(response.text).toContain('No posts yet');
      expect(response.text).not.toContain('Follow to see posts');
    });
  });

  describe('edit.ejs rendering', () => {
    test('includes script tag for profile.js', async () => {
      const profile = {
        user_id: 'u1',
        handle: 'edittest',
        bio: 'Test bio',
        visibility: 'public'
      };

      dietIntelAPI.getProfile.mockResolvedValue(profile);

      const response = await request(app)
        .get('/profiles/me/edit')
        .set('Cookie', ['access_token=mock_token'])
        .expect(200);

      expect(response.text).toContain('<script src="/js/profile.js"></script>');
      expect(response.text).toContain('Edit Profile');
      expect(response.text).toContain('edittest'); // Handle present
    });

    test('layout includes main CSS file', async () => {
      // This tests that the layout template includes the required CSS
      // Since we use express-ejs-layouts, the layout.ejs should have the CSS link
      const response = await request(app)
        .get('/profiles/me/edit')
        .set('Cookie', ['access_token=mock_token'])
        .expect(200);

      // The layout should include the main CSS file
      expect(response.text).toContain('<link rel="stylesheet" href="/stylesheets/main.css">');
      expect(response.text).toContain('DietIntel'); // App name in layout
    });
  });

  describe('Error handling in views', () => {
    test('handles profile API errors gracefully', async () => {
      dietIntelAPI.getProfile.mockRejectedValue({
        response: { status: 500, data: { detail: 'Internal error' } }
      });

      const response = await request(app)
        .get('/profiles/u3')
        .expect(500);

      expect(response.text).toContain('Error loading profile');
    });

    test('render function handles missing template variables', async () => {
      const incompleteProfile = {
        user_id: 'u4',
        handle: null,
        bio: null,
        posts: []
      };
      dietIntelAPI.getProfile.mockResolvedValue(incompleteProfile);

      // Should not crash, should handle null values
      await request(app)
        .get('/profiles/u4')
        .expect(200);
    });
  });
});
