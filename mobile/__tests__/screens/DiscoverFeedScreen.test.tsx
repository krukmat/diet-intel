import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { DiscoverFeedScreen } from '../../screens/DiscoverFeedScreen';

// Mock hooks
jest.mock('../../hooks/useDiscoverFeed');
jest.mock('../../services/AnalyticsService', () => ({
  analyticsService: {
    trackDiscoverItemInteraction: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockUseDiscoverFeed = jest.requireMock('../../hooks/useDiscoverFeed');
const mockAnalyticsService = jest.requireMock('../../services/AnalyticsService').analyticsService;

// Mock Alert
jest.spyOn(Alert, 'alert');

// Sample mock data
const mockItems = [
  {
    id: 'post-1',
    author_id: 'author-1',
    author_handle: 'healthy_chef',
    text: 'Protein-rich breakfast ideas!',
    rank_score: 0.85,
    reason: 'fresh',
    created_at: '2025-01-01T08:30:00Z',
    metadata: { likes_count: 12, comments_count: 4 },
  },
  {
    id: 'post-2',
    author_id: 'author-2',
    author_handle: 'fitness_guru',
    text: 'High intensity workout routine',
    rank_score: 0.72,
    reason: 'popular',
    created_at: '2025-01-02T14:15:00Z',
    metadata: { likes_count: 25, comments_count: 8 },
  }
];

describe('DiscoverFeedScreen', () => {
  const mockUseDiscoverFeedResult = {
    items: [],
    loading: false,
    error: null,
    hasMore: false,
    surface: 'mobile',
    variant: 'control',
    requestId: 'req-123',
    refresh: jest.fn(),
    loadMore: jest.fn(),
    switchSurface: jest.fn(),
    clearError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyticsService.trackDiscoverItemInteraction.mockResolvedValue(undefined);
    mockUseDiscoverFeed.useDiscoverFeed.mockReturnValue(mockUseDiscoverFeedResult);
  });

  test('renders loading state initially when no items and loading', () => {
    mockUseDiscoverFeed.useDiscoverFeed.mockReturnValue({
      ...mockUseDiscoverFeedResult,
      loading: true,
      items: [],
    });

    const { getByText } = render(<DiscoverFeedScreen />);

    expect(getByText('Discovering great posts...')).toBeTruthy();
  });

  test('renders error state when no items and error exists', () => {
    const errorMessage = 'Failed to load feed';
    mockUseDiscoverFeed.useDiscoverFeed.mockReturnValue({
      ...mockUseDiscoverFeedResult,
      error: errorMessage,
      items: [],
    });

    const { getByText } = render(<DiscoverFeedScreen />);

    expect(getByText('Unable to load discover feed')).toBeTruthy();
    expect(getByText(errorMessage)).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
  });

  test('renders empty state when no items and no error', () => {
    mockUseDiscoverFeed.useDiscoverFeed.mockReturnValue({
      ...mockUseDiscoverFeedResult,
      items: [],
    });

    const { getByText } = render(<DiscoverFeedScreen />);

    expect(getByText('Nothing to show (yet)')).toBeTruthy();
    expect(getByText('Interact with more posts so we can personalize discoveries for you')).toBeTruthy();
    expect(getByText('Refresh')).toBeTruthy();
  });

  test('renders header with tabs correctly', () => {
    mockUseDiscoverFeed.useDiscoverFeed.mockReturnValue({
      ...mockUseDiscoverFeedResult,
      items: mockItems,
    });

    const { getByText } = render(<DiscoverFeedScreen />);

    expect(getByText('Discover Feed')).toBeTruthy();
    expect(getByText('AI-powered suggestions beyond your network')).toBeTruthy();
    expect(getByText('Variant: control')).toBeTruthy();
    expect(getByText('Mobile view')).toBeTruthy();
    expect(getByText('Web preview')).toBeTruthy();
  });

  test('shows load more button when hasMore is true', () => {
    mockUseDiscoverFeed.useDiscoverFeed.mockReturnValue({
      ...mockUseDiscoverFeedResult,
      items: mockItems,
      hasMore: true,
    });

    const { getByText } = render(<DiscoverFeedScreen />);

    const button = getByText('Load more discoveries');
    fireEvent.press(button);
    expect(mockUseDiscoverFeedResult.loadMore).toHaveBeenCalled();
  });

  test('shows loading bar during loadMore', () => {
    mockUseDiscoverFeed.useDiscoverFeed.mockReturnValue({
      ...mockUseDiscoverFeedResult,
      items: mockItems.length > 0 ? mockItems : [],
      loading: true,
      hasMore: true,
    });

    const { getByText } = render(<DiscoverFeedScreen />);

    expect(getByText('Discovering more posts...')).toBeTruthy();
  });

  test('shows no more discoveries when hasMore is false', () => {
    mockUseDiscoverFeed.useDiscoverFeed.mockReturnValue({
      ...mockUseDiscoverFeedResult,
      items: mockItems,
      hasMore: false,
    });

    const { getByText } = render(<DiscoverFeedScreen />);

    expect(getByText('No more discoveries')).toBeTruthy();
  });

  test('handles surface switching correctly', () => {
    mockUseDiscoverFeed.useDiscoverFeed.mockReturnValue({
      ...mockUseDiscoverFeedResult,
      items: mockItems,
    });

    const { getByText } = render(<DiscoverFeedScreen />);
    const webTab = getByText('Web preview');

    fireEvent.press(webTab);
    expect(mockUseDiscoverFeedResult.switchSurface).toHaveBeenCalledWith('web');
  });

  test('handles loadMore button press', () => {
    mockUseDiscoverFeed.useDiscoverFeed.mockReturnValue({
      ...mockUseDiscoverFeedResult,
      items: mockItems,
      hasMore: true,
    });

    const { getByText } = render(<DiscoverFeedScreen />);
    const loadMoreButton = getByText('Load more discoveries');

    fireEvent.press(loadMoreButton);

    expect(mockUseDiscoverFeedResult.loadMore).toHaveBeenCalled();
  });

  test('handles retry button press in error state', () => {
    const errorMessage = 'Network failed';
    mockUseDiscoverFeed.useDiscoverFeed.mockReturnValue({
      ...mockUseDiscoverFeedResult,
      error: errorMessage,
      items: [],
    });

    const { getByText } = render(<DiscoverFeedScreen />);
    const retryButton = getByText('Try Again');

    fireEvent.press(retryButton);

    expect(mockUseDiscoverFeedResult.clearError).toHaveBeenCalled();
    expect(mockUseDiscoverFeedResult.refresh).toHaveBeenCalled();
  });

  test('handles retry button press in empty state', () => {
    mockUseDiscoverFeed.useDiscoverFeed.mockReturnValue({
      ...mockUseDiscoverFeedResult,
      items: [],
    });

    const { getByText } = render(<DiscoverFeedScreen />);
    const refreshButton = getByText('Refresh');

    fireEvent.press(refreshButton);

    expect(mockUseDiscoverFeedResult.refresh).toHaveBeenCalled();
  });

  test('tracks click interactions and avoids duplicates', async () => {
    mockUseDiscoverFeed.useDiscoverFeed.mockReturnValue({
      ...mockUseDiscoverFeedResult,
      items: mockItems,
    });

    const { getByTestId } = render(<DiscoverFeedScreen />);
    const flatList = getByTestId('discover-feed-list');
    const { renderItem, data } = flatList.props;
    const itemElement = renderItem({ item: data[0], index: 0 });

    await act(async () => {
      await itemElement.props.onPress(mockItems[0]);
    });

    await waitFor(() => {
      expect(mockAnalyticsService.trackDiscoverItemInteraction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'post-1' }),
        expect.objectContaining({
          action: 'click',
          surface: 'mobile',
          variant: 'control',
          requestId: 'req-123',
        }),
      );
    });

    await act(async () => {
      await itemElement.props.onPress(mockItems[0]);
    });
    expect(mockAnalyticsService.trackDiscoverItemInteraction).toHaveBeenCalledTimes(1);
  });

  test('tracks dismiss interactions and removes card from list', async () => {
    mockUseDiscoverFeed.useDiscoverFeed.mockReturnValue({
      ...mockUseDiscoverFeedResult,
      items: mockItems,
    });

    const { getByTestId, queryByText } = render(<DiscoverFeedScreen />);
    const flatList = getByTestId('discover-feed-list');
    const { renderItem, data } = flatList.props;
    const itemElement = renderItem({ item: data[0], index: 0 });

    await act(async () => {
      await itemElement.props.onDismiss(mockItems[0]);
    });

    await waitFor(() => {
      expect(mockAnalyticsService.trackDiscoverItemInteraction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'post-1' }),
        expect.objectContaining({
          action: 'dismiss',
          surface: 'mobile',
          variant: 'control',
          requestId: 'req-123',
        }),
      );
    });

    expect(queryByText('Protein-rich breakfast ideas!')).toBeNull();
  });

});
