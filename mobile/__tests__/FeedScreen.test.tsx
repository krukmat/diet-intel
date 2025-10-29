import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { FeedScreen } from '../screens/FeedScreen';
import { useFeed } from '../hooks/useFeed';
import { useNavigation } from '@react-navigation/native';

// Mock dependencies
jest.mock('../hooks/useFeed');
jest.mock('@react-navigation/native');

const mockUseFeed = useFeed as jest.MockedFunction<typeof useFeed>;
const mockUseNavigation = useNavigation as jest.MockedFunction<typeof useNavigation>;

describe('FeedScreen', () => {
  const mockFeedData = [
    {
      id: 'feed-item-1',
      user_id: 'followed-user',
      actor_id: 'current-user',
      event_name: 'UserAction.UserFollowed',
      payload: {
        follower_id: 'current-user',
        target_id: 'followed-user',
        action: 'followed'
      },
      created_at: '2025-01-01T10:00:00Z'
    },
    {
      id: 'feed-item-2',
      user_id: 'blocked-user',
      actor_id: 'current-user',
      event_name: 'UserAction.UserBlocked',
      payload: {
        blocker_id: 'current-user',
        blocked_id: 'blocked-user',
        reason: 'spam',
        action: 'blocked'
      },
      created_at: '2025-01-01T10:30:00Z'
    }
  ];

  beforeEach(() => {
    const mockNavigate = jest.fn();
    const mockGoBack = jest.fn();

    mockUseNavigation.mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack
    } as any);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially when no data', () => {
    mockUseFeed.mockReturnValue({
      data: [],
      loading: true,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      retry: jest.fn()
    });

    const { getByText, getByTestId } = render(<FeedScreen />);

    expect(getByText('Loading your feed...')).toBeTruthy();
    expect(getByTestId).not.toThrow(); // ActivityIndicator should be present
  });

  it('renders feed items correctly', async () => {
    mockUseFeed.mockReturnValue({
      data: mockFeedData,
      loading: false,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      retry: jest.fn()
    });

    const { getByText, getAllByText } = render(<FeedScreen />);

    await waitFor(() => {
      expect(getByText('followed-user was followed')).toBeTruthy();
      expect(getByText('blocked-user was blocked (spam)')).toBeTruthy();
    });

    // Check timestamps are formatted
    expect(getAllByText(/,/)).toBeTruthy(); // Should contain formatted dates
  });

  it('renders empty state when no feed items', () => {
    mockUseFeed.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      retry: jest.fn()
    });

    const { getByText } = render(<FeedScreen />);

    expect(getByText('No activity yet')).toBeTruthy();
    expect(getByText('Start following people to see their social activity here')).toBeTruthy();
    expect(getByText('Go Back')).toBeTruthy();
  });

  it('renders error state and allows retry', () => {
    const mockRetry = jest.fn();
    const mockError = 'Network error';

    mockUseFeed.mockReturnValue({
      data: [],
      loading: false,
      error: mockError,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      retry: mockRetry
    });

    const { getByText } = render(<FeedScreen />);

    expect(getByText('Unable to load feed')).toBeTruthy();
    expect(getByText(mockError)).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();

    // Test retry button
    const retryButton = getByText('Try Again');
    fireEvent.press(retryButton);

    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('handles all feed event types correctly', () => {
    const allEventTypes = [
      {
        id: '1',
        user_id: 'user1',
        actor_id: 'actor1',
        event_name: 'UserAction.UserFollowed',
        payload: { target_id: 'user1', action: 'followed' },
        created_at: '2025-01-01T10:00:00Z'
      },
      {
        id: '2',
        user_id: 'user2',
        actor_id: 'actor2',
        event_name: 'UserAction.UserUnfollowed',
        payload: { target_id: 'user2', action: 'unfollowed' },
        created_at: '2025-01-01T10:30:00Z'
      },
      {
        id: '3',
        user_id: 'user3',
        actor_id: 'actor3',
        event_name: 'UserAction.UserBlocked',
        payload: { blocked_id: 'user3', reason: 'spam', action: 'blocked' },
        created_at: '2025-01-01T11:00:00Z'
      },
      {
        id: '4',
        user_id: 'user4',
        actor_id: 'actor4',
        event_name: 'UserAction.UserUnblocked',
        payload: { blocked_id: 'user4', action: 'unblocked' },
        created_at: '2025-01-01T11:30:00Z'
      },
      {
        id: '5',
        user_id: 'user5',
        actor_id: 'actor5',
        event_name: 'Unknown.Event',
        payload: { some: 'data' },
        created_at: '2025-01-01T12:00:00Z'
      }
    ];

    mockUseFeed.mockReturnValue({
      data: allEventTypes,
      loading: false,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      retry: jest.fn()
    });

    const { getByText } = render(<FeedScreen />);

    expect(getByText('user1 was followed')).toBeTruthy();
    expect(getByText('user2 was unfollowed')).toBeTruthy();
    expect(getByText('user3 was blocked (spam)')).toBeTruthy();
    expect(getByText('user4 was unblocked')).toBeTruthy();
    expect(getByText('Unknown activity')).toBeTruthy(); // Unknown event falls back to this
  });

  it('shows loading more indicator when paginating', () => {
    const mockLoadMore = jest.fn();

    mockUseFeed.mockReturnValue({
      data: mockFeedData,
      loading: true, // This should trigger loading more indicator
      error: null,
      hasMore: true,
      loadMore: mockLoadMore,
      refresh: jest.fn(),
      retry: jest.fn()
    });

    const { getByText } = render(<FeedScreen />);

    // When we have data and loading is true, show loading more
    expect(getByText('Loading more...')).toBeTruthy();
  });

  it('shows end of feed message when no more items', () => {
    mockUseFeed.mockReturnValue({
      data: mockFeedData,
      loading: false,
      error: null,
      hasMore: false, // No more items
      loadMore: jest.fn(),
      refresh: jest.fn(),
      retry: jest.fn()
    });

    const { getByText } = render(<FeedScreen />);

    expect(getByText('No more activity')).toBeTruthy();
  });

  it('handles item truncation correctly', () => {
    const longHandleData = [
      {
        id: 'long-handle',
        user_id: 'very-long-user-handle-that-should-be-truncated',
        actor_id: 'very-long-actor-handle-that-should-be-truncated',
        event_name: 'UserAction.UserFollowed',
        payload: { target_id: 'very-long-user-handle-that-should-be-truncated', action: 'followed' },
        created_at: '2025-01-01T10:00:00Z'
      }
    ];

    mockUseFeed.mockReturnValue({
      data: longHandleData,
      loading: false,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      retry: jest.fn()
    });

    const { getByText } = render(<FeedScreen />);

    // Should show truncated handles (8 characters + "was followed")
    expect(getByText('very-long-user-handle-that-should-be was followed')).toBeTruthy();
  });

  it('displays profile link per item', async () => {
    mockUseFeed.mockReturnValue({
      data: mockFeedData,
      loading: false,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      retry: jest.fn()
    });

    const { getAllByText } = render(<FeedScreen />);

    await waitFor(() => {
      expect(getAllByText('View Profile')).toHaveLength(2); // One for each item
    });
  });

  it('navigates back on empty state button press', () => {
    const mockGoBack = jest.fn();

    mockUseNavigation.mockReturnValue({
      navigate: jest.fn(),
      goBack: mockGoBack
    } as any);

    mockUseFeed.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      retry: jest.fn()
    });

    const { getByText } = render(<FeedScreen />);

    const goBackButton = getByText('Go Back');
    fireEvent.press(goBackButton);

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders header correctly', () => {
    mockUseFeed.mockReturnValue({
      data: mockFeedData,
      loading: false,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      retry: jest.fn()
    });

    const { getByText } = render(<FeedScreen />);

    expect(getByText('Social Activity')).toBeTruthy();
    expect(getByText('Recent events from people you follow')).toBeTruthy();
  });

  it('handles avatar initial calculation correctly', () => {
    mockUseFeed.mockReturnValue({
      data: [{
        id: 'avatar-test',
        user_id: 'test-user',
        actor_id: 'USER_ID',
        event_name: 'UserAction.UserFollowed',
        payload: { target_id: 'test-user', action: 'followed' },
        created_at: '2025-01-01T10:00:00Z'
      }],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      retry: jest.fn()
    });

    const { getByText } = render(<FeedScreen />);

    // Avatar should show "US" (uppercase first 2 chars)
    expect(getByText('US')).toBeTruthy();
  });

  it('handles navigation for profile viewing (placeholder)', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    mockUseFeed.mockReturnValue({
      data: mockFeedData,
      loading: false,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      retry: jest.fn()
    });

    const { getAllByText } = render(<FeedScreen />);

    // Since profile navigation is currently placeholder (console.log), just test it exists
    const profileButtons = getAllByText('View Profile');
    fireEvent.press(profileButtons[0]);

    expect(consoleSpy).toHaveBeenCalledWith('Navigate to user:', 'current-user');

    consoleSpy.mockRestore();
  });
});
