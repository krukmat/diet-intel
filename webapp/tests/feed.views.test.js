const { renderTemplate } = require('./helpers/renderTemplate');

describe('Feed Views - EJS Template Snapshots', () => {
    describe('GET /feed - index.ejs', () => {
        const baseData = {
            title: 'Social Activity',
            user: { id: 'current-user', full_name: 'Test User' },
            activeFeedTab: 'following',
            surface: 'web',
            pagination: { limit: 20, cursor: null, hasMore: true },
            error: null,
            feed: { items: [], next_cursor: null }
        };

        test('renders feed with activity items and pagination', () => {
            const html = renderTemplate('feed/index', {
                ...baseData,
                feed: {
                    items: [
                        {
                            id: 'event-1',
                            actor_id: 'user-1',
                            event_name: 'UserAction.UserFollowed',
                            payload: { target_id: 'user-2' },
                            created_at: '2025-01-01T10:00:00Z'
                        },
                        {
                            id: 'event-2',
                            actor_id: 'user-3',
                            event_name: 'UserAction.UserBlocked',
                            payload: { blocked_id: 'user-4', reason: 'harassment' },
                            created_at: '2025-01-02T08:30:00Z'
                        }
                    ],
                            next_cursor: 'cursor123'
                }
            });

            expect(html).toContain('Social Activity');
            expect(html).toContain('Discover');
            expect(html).toContain('Following');
            expect(html).toContain('US'); // initials for user-1
            expect(html).toContain('was followed');
            expect(html).toContain('was blocked');
            expect(html).toContain('(harassment)');
            expect(html).toContain('Load More Activity');
        });

        test('renders empty feed state correctly', () => {
            const html = renderTemplate('feed/index', {
                ...baseData,
                feed: { items: [], next_cursor: null }
            });

            expect(html).toContain('No activity yet');
            expect(html).toContain('Start following people');
        });

        test('renders error state with retry option', () => {
            const html = renderTemplate('feed/index', {
                ...baseData,
                feed: { items: [], next_cursor: null },
                error: 'Service temporarily unavailable'
            });

            expect(html).toContain('Unable to load activity');
            expect(html).toContain('Service temporarily unavailable');
            expect(html).toContain('Try Again');
        });

        test('displays different action types correctly', () => {
            const html = renderTemplate('feed/index', {
                ...baseData,
                feed: {
                    items: [
                        {
                            id: 'event-1',
                            actor_id: 'user-1',
                            event_name: 'UserAction.UserFollowed',
                            payload: { target_id: 'user-2' },
                            created_at: '2025-01-01T10:00:00Z'
                        },
                        {
                            id: 'event-2',
                            actor_id: 'user-3',
                            event_name: 'UserAction.UserUnfollowed',
                            payload: { target_id: 'user-4' },
                            created_at: '2025-01-02T08:30:00Z'
                        }
                    ],
                    next_cursor: 'cursor123'
                }
            });

            expect(html).toContain('was followed');
            expect(html).toContain('was unfollowed');
        });

        test('handles undefined/null payload fields gracefully', () => {
            const html = renderTemplate('feed/index', {
                ...baseData,
                feed: {
                    items: [
                        {
                            id: 'event-1',
                            actor_id: 'user-1',
                            event_name: 'UserAction.UserFollowed',
                            payload: {},  // undefined target_id
                            created_at: '2025-01-01T10:00:00Z'
                        },
                        {
                            id: 'event-2',
                            actor_id: 'user-3',
                            event_name: 'Unknown.Action',
                            payload: {},
                            created_at: '2025-01-02T08:30:00Z'
                        }
                    ],
                    next_cursor: 'cursor123'
                }
            });

            expect(html).toContain('<span class="font-medium">someone</span>');
            expect(html).toContain('was followed'); // fallback for undefined target_id
            expect(html).toContain('Unknown activity'); // fallback for unknown event_name
        });

        test('includes proper navigation links', () => {
            const html = renderTemplate('feed/index', baseData);

            expect(html).toContain('← Back to Profile');
            expect(html).toContain('href="/dashboard/profile"');
        });

        test('renders pagination cursor data in JavaScript', () => {
            const html = renderTemplate('feed/index', {
                ...baseData,
                pagination: { limit: 10, cursor: 'test-cursor', hasMore: true }
            });

            expect(html).toContain('cursor=test-cursor');
            expect(html).toContain('limit=10');
        });
    });

    describe('GET /feed/discover - discover.ejs', () => {
        const baseData = {
            title: 'Discover Feed',
            user: { id: 'current-user', full_name: 'Test User' },
            activeFeedTab: 'discover',
            surface: 'web',
            variant: 'control',
            requestId: 'test-request',
            pagination: { limit: 20, cursor: null, hasMore: true },
            error: null,
            feed: { items: [], next_cursor: null }
        };

        test('renders discover cards with metadata', () => {
            const html = renderTemplate('feed/discover', {
                ...baseData,
                feed: {
                    items: [
                        {
                            id: 'post-1',
                            author_id: 'author-1',
                            author_handle: 'nutri_guru',
                            text: 'Try this post-workout smoothie!',
                            rank_score: 0.85,
                            reason: 'popular',
                            created_at: '2025-01-02T08:30:00Z',
                            metadata: { likes_count: 12, comments_count: 4 },
                            media: [
                                { type: 'image', url: 'https://example.com/smoothie.jpg' }
                            ]
                        }
                    ],
                    next_cursor: 'cursor123'
                }
            });

            expect(html).toContain('Discover Feed');
            expect(html).toContain('Variant: control');
            expect(html).toContain('nutri_guru');
            expect(html).toContain('Try this post-workout smoothie!');
            expect(html).toContain('0.85');
            expect(html).toContain('12 likes');
            expect(html).toContain('Load more discoveries');
            expect(html).toContain('/analytics/discover');
            expect(html).toContain('Dismiss suggestion');
            expect(html).toContain('View profile');
            expect(html).toContain('data-reason="popular"');
        });

        test('shows empty state when no items', () => {
            const html = renderTemplate('feed/discover', {
                ...baseData,
                feed: { items: [], next_cursor: null },
                pagination: { limit: 20, cursor: null, hasMore: false }
            });

            expect(html).toContain('Nothing to show (yet)');
            expect(html).toContain('Interact with more posts');
        });

        test('renders error state with retry button', () => {
            const html = renderTemplate('feed/discover', {
                ...baseData,
                feed: { items: [], next_cursor: null },
                error: 'Service unavailable'
            });

            expect(html).toContain('Unable to load discover feed');
            expect(html).toContain('Service unavailable');
            expect(html).toContain('Try again');
        });
    });
});
