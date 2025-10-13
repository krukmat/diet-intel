// EPIC_A.A4: Tests de rutas de feed webapp con Supertest

const request = require('supertest');
const { mountApp } = require('./helpers/mountApp');

// Mock API client
jest.mock('../utils/api');
const dietIntelAPI = require('../utils/api');

describe('Feed Routes - Supertest Integration', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = mountApp();

    // Setup default mocks
    dietIntelAPI.getFeed = jest.fn();
    dietIntelAPI.getCurrentUser = jest.fn().mockResolvedValue({
      id: 'test-user-id',
      full_name: 'Test User'
    });
  });

  // Helper to simulate authenticated request
  const authRequest = (agent) => agent.set('Cookie', ['access_token=mock_token']);

  describe('GET /feed', () => {
    test('requires authentication and redirects to login', async () => {
      const response = await request(app)
        .get('/feed')
        .expect(302);

      expect(response.headers.location).toContain('/auth/login');
    });

    test('authenticated user gets feed data and renders view', async () => {
      const mockFeedData = {
        items: [
          {
            id: 'feed-item-1',
            user_id: 'user2',
            actor_id: 'test-user-id',
            event_name: 'UserAction.UserFollowed',
            payload: {
              follower_id: 'test-user-id',
              target_id: 'user2',
              action: 'followed',
              ts: '2025-01-01T10:00:00Z'
            },
            created_at: '2025-01-01T10:00:00Z'
          }
        ],
        next_cursor: 'cursor123'
      };

      const userData = {
        id: 'test-user-id',
        full_name: 'Test User'
      };

      dietIntelAPI.getFeed.mockResolvedValue(mockFeedData);
      dietIntelAPI.getCurrentUser.mockResolvedValue(userData);

      const response = await authRequest(request.agent(app))
        .get('/feed')
        .expect(200);

      // Verify API was called with correct token
      expect(dietIntelAPI.getFeed).toHaveBeenCalledWith('mock_token', {
        limit: 20,
        cursor: undefined
      });

      // Verify view renders with feed data
      expect(response.text).toContain('Social Activity');
      expect(response.text).toContain('Test User'); // User name
      expect(response.text).toContain('user2'); // Feed item content
      expect(response.text).toContain('followed'); // Action text
      expect(response.text).toContain('Load More Activity'); // Pagination button present
    });

    test('handles pagination parameters correctly', async () => {
      const mockFeedData = { items: [], next_cursor: null };
      dietIntelAPI.getFeed.mockResolvedValue(mockFeedData);

      const response = await authRequest(request.agent(app))
        .get('/feed?limit=50&cursor=test-cursor')
        .expect(200);

      expect(dietIntelAPI.getFeed).toHaveBeenCalledWith('mock_token', {
        limit: 50,
        cursor: 'test-cursor'
      });
    });

    test('handles invalid limit parameter gracefully', async () => {
      const mockFeedData = { items: [], next_cursor: null };
      dietIntelAPI.getFeed.mockResolvedValue(mockFeedData);

      const response = await authRequest(request.agent(app))
        .get('/feed?limit=invalid')
        .expect(200);

      // Should default to 20 on invalid limit
      expect(dietIntelAPI.getFeed).toHaveBeenCalledWith('mock_token', {
        limit: 20,
        cursor: undefined
      });
    });

    test('renders empty state when no feed items', async () => {
      const emptyFeedData = { items: [], next_cursor: null };
      dietIntelAPI.getFeed.mockResolvedValue(emptyFeedData);

      const response = await authRequest(request.agent(app))
        .get('/feed')
        .expect(200);

      expect(response.text).toContain('No activity yet');
      expect(response.text).toContain('Start following people');
      expect(response.text).not.toContain('Load More Activity'); // No pagination button
    });

    test('handles API errors gracefully with error message', async () => {
      dietIntelAPI.getFeed.mockRejectedValue(new Error('API Error'));
      dietIntelAPI.getCurrentUser.mockResolvedValue({
        id: 'test-user-id',
        full_name: 'Test User'
      });

      const response = await authRequest(request.agent(app))
        .get('/feed')
        .expect(200); // Should still render, but with error

      expect(response.text).toContain('Unable to load feed');
      expect(response.text).toContain('Please try again later');
      expect(response.text).toContain('Try Again');
    });

    test('hides load more button when no next_cursor', async () => {
      const mockFeedData = {
        items: [
          {
            id: 'feed-item-1',
            user_id: 'user2',
            actor_id: 'test-user-id',
            event_name: 'UserAction.UserFollowed',
            payload: { follower_id: 'test-user-id', target_id: 'user2', action: 'followed' },
            created_at: '2025-01-01T10:00:00Z'
          }
        ],
        next_cursor: null // No more pages
      };

      dietIntelAPI.getFeed.mockResolvedValue(mockFeedData);

      const response = await authRequest(request.agent(app))
        .get('/feed')
        .expect(200);

      expect(response.text).toContain('followed'); // Has feed item
      expect(response.text).not.toContain('Load More Activity'); // No pagination button
    });
  });
});
