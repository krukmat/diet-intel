import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { FollowingListScreen } from '../FollowingListScreen';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    FlatList: ({ data, renderItem, ...rest }: any) => (
      <actual.View testID="following-list" {...rest}>
        {data.map((item: any) => (
          <actual.View key={item.user_id}>{renderItem({ item })}</actual.View>
        ))}
      </actual.View>
    ),
  };
});

jest.mock('@react-navigation/native', () => {
  const navigation = { goBack: jest.fn() };
  return {
    useNavigation: () => navigation,
    useRoute: () => ({ params: { userId: 'user-1' } }),
    __navigation: navigation,
  };
});

jest.mock('../../services/ApiService', () => ({
  apiService: {
    getFollowing: jest.fn(),
  },
}));

const { apiService } = jest.requireMock('../../services/ApiService');
const { __navigation } = jest.requireMock('@react-navigation/native');

describe('FollowingListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    (apiService.getFollowing as jest.Mock).mockResolvedValue({
      data: { items: [], next_cursor: null },
    });

    const { getByText } = render(<FollowingListScreen />);
    expect(getByText('Loading following...')).toBeTruthy();

    await waitFor(() => {
      expect(apiService.getFollowing).toHaveBeenCalled();
    });
  });

  it('renders list items and unfollow prompt', async () => {
    (apiService.getFollowing as jest.Mock).mockResolvedValue({
      data: {
        items: [
          { user_id: 'u1', handle: 'alice', since: new Date().toISOString() },
        ],
        next_cursor: null,
      },
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByText, getAllByText } = render(<FollowingListScreen />);

    await waitFor(() => {
      expect(getByText('@alice')).toBeTruthy();
    });

    fireEvent.press(getAllByText('Following')[1]);
    expect(alertSpy).toHaveBeenCalled();
  });

  it('loads more when cursor exists', async () => {
    (apiService.getFollowing as jest.Mock)
      .mockResolvedValueOnce({
        data: {
          items: [{ user_id: 'u1', handle: 'alice', since: new Date().toISOString() }],
          next_cursor: 'next',
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ user_id: 'u2', handle: 'bob', since: new Date().toISOString() }],
          next_cursor: null,
        },
      });

    const { getByText, getByTestId } = render(<FollowingListScreen />);

    await waitFor(() => {
      expect(getByText('@alice')).toBeTruthy();
    });

    fireEvent(getByTestId('following-list'), 'onEndReached');

    await waitFor(() => {
      expect(apiService.getFollowing).toHaveBeenCalledTimes(2);
    });
  });

  it('shows error state and retries', async () => {
    (apiService.getFollowing as jest.Mock)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ data: { items: [], next_cursor: null } });

    const { getByText } = render(<FollowingListScreen />);

    await waitFor(() => {
      expect(getByText('Failed to load following')).toBeTruthy();
    });

    fireEvent.press(getByText('Retry'));

    await waitFor(() => {
      expect(apiService.getFollowing).toHaveBeenCalledTimes(2);
    });
  });

  it('handles unauthorized error with alert and back', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (apiService.getFollowing as jest.Mock).mockRejectedValue({ response: { status: 401 } });

    render(<FollowingListScreen />);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Please log in to view following');
    });
    expect(__navigation.goBack).toHaveBeenCalled();
  });
});
