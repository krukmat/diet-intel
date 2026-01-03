import analyticsService from '../AnalyticsService';
import { apiService } from '../ApiService';
import { authService } from '../AuthService';

jest.mock('../ApiService', () => ({
  apiService: {
    recordDiscoverInteraction: jest.fn(),
  },
}));

jest.mock('../AuthService', () => ({
  authService: {
    getStoredTokens: jest.fn(),
    validateToken: jest.fn(),
  },
}));

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    analyticsService.clearEvents();
  });

  it('tracks discover view and load more events', async () => {
    (authService.getStoredTokens as jest.Mock).mockResolvedValue({ access_token: 'token' });
    (authService.validateToken as jest.Mock).mockResolvedValue({ id: 'user-1' });

    await analyticsService.trackDiscoverView(10, 'mobile');
    await analyticsService.trackDiscoverLoadMore(5, 'web', 'cursor');

    const events = analyticsService.getRecentEvents();
    expect(events.length).toBe(2);
    expect(events[0].type).toBe('discover_view');
    expect(events[1].type).toBe('discover_load_more');
  });

  it('tracks surface switch and summarizes events', async () => {
    await analyticsService.trackDiscoverSurfaceSwitch('mobile', 'web');
    const summary = analyticsService.getEventSummary();
    expect(summary['discover_surface_switch_unknown']).toBe(1);
  });

  it('tracks item interactions and forwards to api', async () => {
    (apiService.recordDiscoverInteraction as jest.Mock).mockResolvedValue({});
    const item = {
      id: 'post-1',
      author_id: 'author',
      text: 'hello',
      rank_score: 0.8,
      reason: 'fresh',
      created_at: '2024-01-01',
      metadata: { likes_count: 1, comments_count: 0 },
    };

    await analyticsService.trackDiscoverItemInteraction(item, {
      action: 'click',
      surface: 'mobile',
      variant: 'v1',
      requestId: 'req',
    });

    expect(apiService.recordDiscoverInteraction).toHaveBeenCalledWith(
      expect.objectContaining({ post_id: 'post-1', action: 'click' })
    );
  });

  it('handles failed api forwarding gracefully', async () => {
    (apiService.recordDiscoverInteraction as jest.Mock).mockRejectedValue(new Error('fail'));
    const item = {
      id: 'post-2',
      author_id: 'author',
      text: 'hello',
      rank_score: 0.6,
      reason: 'fresh',
      created_at: '2024-01-01',
      metadata: { likes_count: 1, comments_count: 0 },
    };

    await analyticsService.trackDiscoverItemInteraction(item, {
      action: 'dismiss',
      surface: 'web',
    });

    expect(apiService.recordDiscoverInteraction).toHaveBeenCalled();
  });

  it('falls back to anonymous when user id lookup fails', async () => {
    (authService.getStoredTokens as jest.Mock).mockRejectedValue(new Error('fail'));
    await analyticsService.trackDiscoverView(1, 'mobile');

    const events = analyticsService.getRecentEvents();
    expect(events[0].user_id).toBe('anonymous');
  });
});
