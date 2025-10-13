// EPIC_A.A4: Tests de vistas EJS de feed con Jest snapshots

const { renderTemplate } = require('./helpers/renderTemplate');

// Mock external dependencies
jest.mock('../utils/api');

describe('Feed Views - EJS Template Snapshots', () => {
  describe('GET /feed - index.ejs', () => {
    test('renders feed with activity items and pagination', () => {
      const mockData = {
        title: 'Social Activity',
        feed: {
          items: [
            {
              id: 'feed-item-1',
              user_id: 'user2',
              actor_id: 'current-user',
              event_name: 'UserAction.UserFollowed',
              payload: {
                follower_id: 'current-user',
                target_id: 'user2',
                action: 'followed',
                ts: '2025-01-01T10:00:00Z'
              },
              created_at: '2025-01-01T10:00:00Z'
            },
            {
              id: 'feed-item-2',
              user_id: 'user3',
              actor_id: 'current-user',
              event_name: 'UserAction.UserBlocked',
              payload: {
                blocker_id: 'current-user',
                blocked_id: 'user3',
                reason: 'spam',
                action: 'blocked'
              },
              created_at: '2025-01-01T10:30:00Z'
            }
          ],
          next_cursor: 'cursor-123'
        },
        user: { id: 'current-user', full_name: 'Test User' },
        pagination: {
          limit: 20,
          cursor: null,
          hasMore: true
        }
      };

      const html = renderTemplate('feed/index', mockData);

      // Verify basic structure
      expect(html).toContain('Social Activity');
      expect(html).toContain('Test User');
      expect(html).toContain('Recent social events');

      // Verify feed items
      expect(html).toContain('user2'); // Followed user
      expect(html).toContain('was followed');
      expect(html).toContain('user3'); // Blocked user
      expect(html).toContain('was blocked');
      expect(html).toContain('spam'); // Block reason

      // Verify pagination
      expect(html).toContain('Load More Activity');
      expect(html).toContain('load-more-btn');

      // Verify timestamps
      expect(html).toContain(new Date('2025-01-01T10:00:00Z').toLocaleString());
      expect(html).toContain(new Date('2025-01-01T10:30:00Z').toLocaleString());
    });

    test('renders empty feed state correctly', () => {
      const mockData = {
        title: 'Social Activity',
        feed: { items: [], next_cursor: null },
        user: { id: 'current-user', full_name: 'Test User' },
        pagination: { limit: 20, cursor: null, hasMore: false }
      };

      const html = renderTemplate('feed/index', mockData);

      expect(html).toContain('Social Activity');
      expect(html).toContain('No activity yet');
      expect(html).toContain('Start following people');
      expect(html).not.toContain('Load More Activity'); // No pagination on empty
    });

    test('renders error state with retry option', () => {
      const mockData = {
        title: 'Social Activity',
        feed: { items: [], next_cursor: null },
        user: { id: 'current-user', full_name: 'Test User' },
        error: 'Failed to load feed',
        pagination: { limit: 20, cursor: null, hasMore: false }
      };

      const html = renderTemplate('feed/index', mockData);

      expect(html).toContain('Unable to load feed');
      expect(html).toContain('Failed to load feed');
      expect(html).toContain('Please try again later');
      expect(html).toContain('Try Again');
      expect(html).toContain('window.location.reload()'); // Retry action
    });

    test('displays different action types correctly', () => {
      const mockData = {
        title: 'Social Activity',
        feed: {
          items: [
            {
              event_name: 'UserAction.UserFollowed',
              payload: { target_id: 'alice', action: 'followed' }
            },
            {
              event_name: 'UserAction.UserUnfollowed',
              payload: { target_id: 'bob', action: 'unfollowed' }
            },
            {
              event_name: 'UserAction.UserBlocked',
              payload: { blocked_id: 'spam-user', reason: 'spam', action: 'blocked' }
            },
            {
              event_name: 'UserAction.UserUnblocked',
              payload: { blocked_id: 'old-user', action: 'unblocked' }
            },
            {
              event_name: 'Unknown.Event', // Unknown event
              payload: { some: 'data' }
            }
          ],
          next_cursor: null
        },
        user: { id: 'current-user', full_name: 'Test User' },
        pagination: { limit: 20, cursor: null, hasMore: false }
      };

      const html = renderTemplate('feed/index', mockData);

      // Known actions
      expect(html).toContain('alice was followed');
      expect(html).toContain('bob was unfollowed');
      expect(html).toContain('spam-user was blocked');
      expect(html).toContain('old-user was unblocked');
      expect(html).toContain('(spam)'); // Block reason

      // Unknown actions
      expect(html).toContain('Unknown activity');
    });

    test('handles undefined/null payload fields gracefully', () => {
      const mockData = {
        title: 'Social Activity',
        feed: {
          items: [
            {
              event_name: 'UserAction.UserBlocked',
              payload: { blocked_id: null, reason: null, action: 'blocked' },
              actor_id: null
            }
          ],
          next_cursor: null
        },
        user: { id: 'current-user', full_name: 'Test User' },
        pagination: { limit: 20, cursor: null, hasMore: false }
      };

      const html = renderTemplate('feed/index', mockData);

      // Should handle null values without breaking
      expect(html).toContain('was blocked');
      expect(html).toContain('TU'); // Initials from null actor_id -> substring safe
    });

    test('includes proper navigation links', () => {
      const mockData = {
        title: 'Social Activity',
        feed: { items: [], next_cursor: null },
        user: { id: 'current-user', full_name: 'Test User' },
        pagination: { limit: 20, cursor: null, hasMore: false }
      };

      const html = renderTemplate('feed/index', mockData);

      expect(html).toContain('← Back to Profile');
      expect(html).toContain('/dashboard/profile');
    });

    test('renders pagination cursor data in JavaScript', () => {
      const mockData = {
        title: 'Social Activity',
        feed: { items: [], next_cursor: 'test-cursor' },
        user: { id: 'current-user', full_name: 'Test User' },
        pagination: { limit: 50, cursor: 'test-cursor', hasMore: true }
      };

      const html = renderTemplate('feed/index', mockData);

      // Should contain JavaScript with cursor data
      expect(html).toContain('test-cursor');
      expect(html).toContain('/feed?cursor=');
      expect(html).toContain('limit=50');
    });
  });
});
