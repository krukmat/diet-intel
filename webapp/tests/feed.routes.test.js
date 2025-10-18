const request = require('supertest');
const { mountApp } = require('./helpers/mountApp');

jest.mock('../utils/api');
const dietIntelAPI = require('../utils/api');

describe('Feed Routes - Supertest Integration', () => {
  let app;
  let server;
  const AUTH_COOKIE = ['access_token=mock_token'];

  beforeEach(() => {
    jest.clearAllMocks();
    app = mountApp();

    server = app.listen(0, '127.0.0.1');

    dietIntelAPI.getFeed = jest.fn();
    dietIntelAPI.getDiscoverFeed = jest.fn();
    dietIntelAPI.getCurrentUser = jest.fn().mockResolvedValue({
      id: 'test-user-id',
      full_name: 'Test User',
    });
  });

  afterEach((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('GET /feed', () => {
    test('requires authentication', async () => {
      const response = await request(server)
        .get('/feed')
        .expect(302);

      expect(response.headers.location).toContain('/auth/login');
    });

    test('renders feed with data', async () => {
      const mockFeed = {
        items: [
          {
            id: 'event-1',
            type: 'follow',
            actor_id: 'user-1',
            created_at: '2025-01-01T10:00:00Z'
          }
        ],
        next_cursor: 'cursor-123'
      };

      dietIntelAPI.getFeed.mockResolvedValue(mockFeed);

      const response = await request(server)
        .get('/feed?limit=10')
        .set('Cookie', AUTH_COOKIE)
        .expect(200);

      expect(dietIntelAPI.getFeed).toHaveBeenCalledWith('mock_token', {
        limit: 10,
        cursor: undefined
      });
      expect(response.text).toContain('Social Activity');
      expect(response.text).toContain('Following');
    });

    test('handles API errors gracefully', async () => {
      dietIntelAPI.getFeed.mockRejectedValue(new Error('API failure'));

      const response = await request(server)
        .get('/feed')
        .set('Cookie', AUTH_COOKIE)
        .expect(200);

      expect(response.text).toContain('Unable to load feed');
      expect(response.text).toContain('Try again');
    });
  });

  describe('GET /feed/discover', () => {
    test('requires authentication', async () => {
      const response = await request(server)
        .get('/feed/discover')
        .expect(302);

      expect(response.headers.location).toContain('/auth/login');
    });

    test('renders discover feed with data', async () => {
      const mockDiscover = {
        items: [
          {
            id: 'post-1',
            author_id: 'author-1',
            author_handle: 'nutri_guru',
            text: 'High-protein breakfast ideas',
            rank_score: 0.92,
            reason: 'fresh',
            created_at: '2025-01-01T12:00:00Z',
            metadata: { likes_count: 5, comments_count: 2 },
            media: []
          }
        ],
        next_cursor: 'cursor-xyz'
      };

      dietIntelAPI.getDiscoverFeed.mockResolvedValue(mockDiscover);

      const response = await request(server)
        .get('/feed/discover?limit=10')
        .set('Cookie', AUTH_COOKIE)
        .expect(200);

      expect(dietIntelAPI.getDiscoverFeed).toHaveBeenCalledWith('mock_token', {
        limit: 10,
        cursor: undefined,
        surface: 'web'
      });
      expect(response.text).toContain('Discover Feed');
      expect(response.text).toContain('High-protein breakfast ideas');
    });

    test('passes surface parameter and cursor', async () => {
      dietIntelAPI.getDiscoverFeed.mockResolvedValue({ items: [], next_cursor: null });

      await request(server)
        .get('/feed/discover?limit=5&cursor=abc123&surface=mobile')
        .set('Cookie', AUTH_COOKIE)
        .expect(200);

      expect(dietIntelAPI.getDiscoverFeed).toHaveBeenCalledWith('mock_token', {
        limit: 5,
        cursor: 'abc123',
        surface: 'mobile'
      });
    });

    test('handles API errors gracefully', async () => {
      dietIntelAPI.getDiscoverFeed.mockRejectedValue(new Error('boom'));

      const response = await request(server)
        .get('/feed/discover')
        .set('Cookie', AUTH_COOKIE)
        .expect(200);

      expect(response.text).toContain('Unable to load discover feed');
      expect(response.text).toContain('Try again');
    });
  });
});
