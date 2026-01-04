import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { DiscoverFeedScreen } from '../DiscoverFeedScreen';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    FlatList: ({ data, renderItem, ...rest }: any) => (
      <actual.View {...rest}>
        {data.map((item: any) => (
          <actual.View key={item.id}>{renderItem({ item })}</actual.View>
        ))}
      </actual.View>
    ),
  };
});

jest.mock('../../hooks/useDiscoverFeed', () => ({
  useDiscoverFeed: jest.fn(),
}));

jest.mock('../../services/AnalyticsService', () => ({
  analyticsService: {
    trackDiscoverItemInteraction: jest.fn(),
  },
}));

const { useDiscoverFeed } = jest.requireMock('../../hooks/useDiscoverFeed');
const { analyticsService } = jest.requireMock('../../services/AnalyticsService');

const buildItem = (id: string) => ({
  id,
  reason: 'SIMILAR_TO_YOU',
  author_handle: 'author',
  author_id: 'author-id-123',
  created_at: new Date().toISOString(),
  rank_score: 1.2,
  text: 'Post text',
  media: [],
  metadata: { likes_count: 1, comments_count: 2 },
});

describe('DiscoverFeedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    (useDiscoverFeed as jest.Mock).mockReturnValue({
      items: [],
      loading: true,
      error: null,
      hasMore: false,
      surface: 'mobile',
      variant: 'v1',
      requestId: 'req-1',
      refresh: jest.fn(),
      loadMore: jest.fn(),
      switchSurface: jest.fn(),
      clearError: jest.fn(),
    });

    const { getByText } = render(<DiscoverFeedScreen />);
    expect(getByText('Discovering great posts...')).toBeTruthy();
  });

  it('renders error state and retries', () => {
    const refresh = jest.fn();
    const clearError = jest.fn();
    (useDiscoverFeed as jest.Mock).mockReturnValue({
      items: [],
      loading: false,
      error: 'Boom',
      hasMore: false,
      surface: 'mobile',
      variant: 'v1',
      requestId: 'req-1',
      refresh,
      loadMore: jest.fn(),
      switchSurface: jest.fn(),
      clearError,
    });

    const { getByText } = render(<DiscoverFeedScreen />);
    fireEvent.press(getByText('Try Again'));

    expect(clearError).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it('renders empty state when no items', () => {
    (useDiscoverFeed as jest.Mock).mockReturnValue({
      items: [],
      loading: false,
      error: null,
      hasMore: false,
      surface: 'mobile',
      variant: 'v1',
      requestId: 'req-1',
      refresh: jest.fn(),
      loadMore: jest.fn(),
      switchSurface: jest.fn(),
      clearError: jest.fn(),
    });

    const { getByText } = render(<DiscoverFeedScreen />);
    expect(getByText('Nothing to show (yet)')).toBeTruthy();
  });

  it('tracks item interactions and loads more', async () => {
    const loadMore = jest.fn();
    (useDiscoverFeed as jest.Mock).mockReturnValue({
      items: [buildItem('item-1')],
      loading: false,
      error: null,
      hasMore: true,
      surface: 'mobile',
      variant: 'v1',
      requestId: 'req-1',
      refresh: jest.fn(),
      loadMore,
      switchSurface: jest.fn(),
      clearError: jest.fn(),
    });

    const { getByTestId, getByText } = render(<DiscoverFeedScreen onBackPress={jest.fn()} />);

    fireEvent.press(getByTestId('discover-card-item-1'));
    fireEvent.press(getByText('Load more discoveries'));

    await waitFor(() => {
      expect(analyticsService.trackDiscoverItemInteraction).toHaveBeenCalled();
    });
    expect(loadMore).toHaveBeenCalled();
  });

  it('tracks dismiss interaction', async () => {
    (useDiscoverFeed as jest.Mock).mockReturnValue({
      items: [buildItem('item-1')],
      loading: false,
      error: null,
      hasMore: false,
      surface: 'mobile',
      variant: 'v1',
      requestId: 'req-1',
      refresh: jest.fn(),
      loadMore: jest.fn(),
      switchSurface: jest.fn(),
      clearError: jest.fn(),
    });

    const { getByTestId } = render(<DiscoverFeedScreen />);

    fireEvent.press(getByTestId('dismiss-item-1'), { stopPropagation: jest.fn() });

    await waitFor(() => {
      expect(analyticsService.trackDiscoverItemInteraction).toHaveBeenCalled();
    });
  });

  it('switches surface tabs', () => {
    const switchSurface = jest.fn();
    (useDiscoverFeed as jest.Mock).mockReturnValue({
      items: [buildItem('item-1')],
      loading: false,
      error: null,
      hasMore: false,
      surface: 'mobile',
      variant: 'v1',
      requestId: 'req-1',
      refresh: jest.fn(),
      loadMore: jest.fn(),
      switchSurface,
      clearError: jest.fn(),
    });

    const { getByText } = render(<DiscoverFeedScreen />);

    fireEvent.press(getByText('Web preview'));
    expect(switchSurface).toHaveBeenCalledWith('web');
  });
});
