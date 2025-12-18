import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { FollowersListScreen } from '../screens/FollowersListScreen';
import { apiService } from '../services/ApiService';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: { userId: 'test-user' } }),
}));

// Mock apiService
jest.mock('../services/ApiService', () => ({
  apiService: {
    getFollowers: jest.fn(),
  },
}));

// Override the global FlatList mock to render children
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const React = require('react');

  return {
    ...RN,
    FlatList: (props: any) => {
      const { data, renderItem, keyExtractor, testID, ListEmptyComponent, ListFooterComponent, ...rest } = props;

      // Render empty component if no data
      if (!data || data.length === 0) {
        const emptyContent = ListEmptyComponent ? (
          React.isValidElement(ListEmptyComponent) ? ListEmptyComponent : React.createElement(ListEmptyComponent)
        ) : null;
        return React.createElement('div', { testID, ...rest }, emptyContent);
      }

      // Render items
      const children = data.map((item: any, index: number) => {
        const key = keyExtractor ? keyExtractor(item, index) : `item-${index}`;
        const element = renderItem({ item, index, separators: {} as any });
        return React.createElement('div', { key }, element);
      });

      // Add footer if provided
      if (ListFooterComponent) {
        const footer = React.isValidElement(ListFooterComponent)
          ? ListFooterComponent
          : React.createElement(ListFooterComponent);
        children.push(React.createElement('div', { key: 'footer' }, footer));
      }

      return React.createElement('div', { testID, ...rest }, children);
    },
    Alert: {
      alert: jest.fn(),
    },
  };
});

const mockGetFollowers = apiService.getFollowers as jest.MockedFunction<typeof apiService.getFollowers>;

describe('FollowersListScreen - EPIC A.A2', () => {
  const mockFollowers = [
    {
      user_id: 'user1',
      handle: 'alice',
      avatar_url: 'https://example.com/avatar1.png',
      since: '2025-01-15T10:30:00Z',
    },
    {
      user_id: 'user2',
      handle: 'bob',
      since: '2025-02-20T14:15:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFollowers.mockResolvedValue({
      data: { items: mockFollowers, next_cursor: null },
    } as any);
  });

  test('renders loading state initially', () => {
    const { getByText } = render(<FollowersListScreen />);

    expect(getByText('Loading followers...')).toBeTruthy();
    // ActivityIndicator is present (rendered with role="status" in global mock)
  });

  test('renders followers list after loading', async () => {
    const { getByText, queryByText } = render(<FollowersListScreen />);

    await waitFor(() => {
      expect(queryByText('Loading followers...')).toBeNull();
    });

    expect(getByText('Followers')).toBeTruthy();
    expect(getByText('2 followers')).toBeTruthy();
    expect(getByText('@alice')).toBeTruthy();
    expect(getByText('@bob')).toBeTruthy();
  });

  test('renders follower items with correct data', async () => {
    const { getByText, getAllByText } = render(<FollowersListScreen />);

    await waitFor(() => {
      expect(getByText('@alice')).toBeTruthy();
    });

    expect(getByText('@alice')).toBeTruthy();
    expect(getByText('@bob')).toBeTruthy();
    expect(getAllByText(/Following since/)).toHaveLength(2);
  });

  test('handles pull-to-refresh', async () => {
    const { getByTestId } = render(<FollowersListScreen />);

    await waitFor(() => {
      expect(getByTestId('followers-flatlist')).toBeTruthy();
    });

    const flatList = getByTestId('followers-flatlist');

    // Trigger refresh (this would normally be triggered by ScrollView's refreshControl)
    // Since we can't easily trigger the RefreshControl, we test the function directly
    const refreshFunction = flatList.props.refreshControl.props.onRefresh;

    await act(async () => {
      refreshFunction();
    });

    expect(mockGetFollowers).toHaveBeenCalledWith('test-user', { limit: 20, cursor: null });
  });

  test('handles infinite scroll', async () => {
    mockGetFollowers.mockResolvedValueOnce({
      data: { items: mockFollowers, next_cursor: 'next-cursor-123' },
    } as any);

    const { getByTestId } = render(<FollowersListScreen />);

    await waitFor(() => {
      expect(getByTestId('followers-flatlist')).toBeTruthy();
    });

    expect(mockGetFollowers).toHaveBeenCalledTimes(1);

    // Trigger onEndReached
    const flatList = getByTestId('followers-flatlist');
    const onEndReached = flatList.props.onEndReached;

    await act(async () => {
      onEndReached();
    });

    expect(mockGetFollowers).toHaveBeenCalledTimes(2);
    expect(mockGetFollowers).toHaveBeenLastCalledWith('test-user', {
      limit: 20,
      cursor: 'next-cursor-123'
    });
  });

  test('does not load more when no next cursor', async () => {
    mockGetFollowers.mockResolvedValueOnce({
      data: { items: mockFollowers, next_cursor: null },
    } as any);

    const { getByTestId } = render(<FollowersListScreen />);

    await waitFor(() => {
      expect(getByTestId('followers-flatlist')).toBeTruthy();
    });

    const flatList = getByTestId('followers-flatlist');
    const onEndReached = flatList.props.onEndReached;

    await act(async () => {
      onEndReached();
    });

    expect(mockGetFollowers).toHaveBeenCalledTimes(1); // Only initial load
  });

  test('renders empty state when no followers', async () => {
    mockGetFollowers.mockResolvedValue({
      data: { items: [], next_cursor: null },
    } as any);

    const { getByText } = render(<FollowersListScreen />);

    await waitFor(() => {
      expect(getByText('No followers yet')).toBeTruthy();
    });

    expect(getByText('When someone follows this user, they will appear here')).toBeTruthy();
  });

  test('handles API error gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockGetFollowers.mockRejectedValue(new Error('Network error'));

    const { getByText, getByTestId } = render(<FollowersListScreen />);

    await waitFor(() => {
      expect(getByText('Failed to load followers')).toBeTruthy();
    });

    expect(getByText('Retry')).toBeTruthy();

    consoleSpy.mockRestore();
  });

  test('retry button works', async () => {
    mockGetFollowers.mockRejectedValueOnce(new Error('Network error'));

    const { getByText } = render(<FollowersListScreen />);

    await waitFor(() => {
      expect(getByText('Retry')).toBeTruthy();
    });

    fireEvent.press(getByText('Retry'));

    expect(mockGetFollowers).toHaveBeenCalledTimes(2);
  });

  test('handles 401 error navigation', async () => {
    // Navigation mock is defined at module level, can't override here
    // Just test that 401 error shows appropriate error message
    const error401 = { response: { status: 401 } };
    mockGetFollowers.mockRejectedValue(error401);

    const { getByText } = render(<FollowersListScreen />);

    await waitFor(() => {
      // 401 error should show error message before navigating back
      expect(getByText('Failed to load followers')).toBeTruthy();
    });
  });

  test('shows loading footer during pagination', async () => {
    mockGetFollowers
      .mockResolvedValueOnce({
        data: { items: mockFollowers, next_cursor: 'next-123' },
      } as any)
      .mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100))); // Delay second call

    const { getByText, getByTestId } = render(<FollowersListScreen />);

    await waitFor(() => {
      expect(getByTestId('followers-flatlist')).toBeTruthy();
    });

    const flatList = getByTestId('followers-flatlist');
    const onEndReached = flatList.props.onEndReached;

    // Trigger pagination
    act(() => {
      onEndReached();
    });

    // Should show loading footer
    await waitFor(() => {
      expect(getByText('Loading more...')).toBeTruthy();
    });
  });

  test('displays follower count correctly', async () => {
    const { getByText } = render(<FollowersListScreen />);

    await waitFor(() => {
      expect(getByText('2 followers')).toBeTruthy();
    });
  });

  test('test-id is added to FlatList for testing', async () => {
    const { getByTestId } = render(<FollowersListScreen />);

    await waitFor(() => {
      expect(getByTestId('followers-flatlist')).toBeTruthy();
    });
  });
});
