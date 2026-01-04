import { createEmptyDiscoverFeedResponse, createFeedMetadata } from '../feed';

describe('feed types', () => {
  it('supports creating feed-shaped data', () => {
    const item = {
      id: 'feed-1',
      author_id: 'author-1',
      text: 'hello',
      rank_score: 0.9,
      reason: 'fresh',
      created_at: '2024-01-01T00:00:00Z',
      metadata: createFeedMetadata(2, 1),
    };

    const response = {
      items: [item],
      next_cursor: null,
      variant: 'a',
      request_id: 'req-1',
    };

    expect(response.items[0].id).toBe('feed-1');
    expect(response.items[0].metadata.likes_count).toBe(2);
    expect(createEmptyDiscoverFeedResponse()).toEqual({ items: [], next_cursor: null });
  });
});
