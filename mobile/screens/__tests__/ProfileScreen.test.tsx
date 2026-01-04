import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ProfileScreen } from '../ProfileScreen';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    Platform: { ...actual.Platform, OS: 'ios' },
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('../../contexts/ProfileContext', () => ({
  useProfile: jest.fn(),
}));

jest.mock('../../services/ApiService', () => ({
  apiService: {
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
  },
}));

const { useProfile } = jest.requireMock('../../contexts/ProfileContext');
const { apiService } = jest.requireMock('../../services/ApiService');

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    (useProfile as jest.Mock).mockReturnValue({
      profile: null,
      loading: true,
      error: null,
      refreshProfile: jest.fn(),
      isOwner: jest.fn(),
    });

    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Loading...')).toBeTruthy();
  });

  it('renders error state', () => {
    (useProfile as jest.Mock).mockReturnValue({
      profile: null,
      loading: false,
      error: 'Error',
      refreshProfile: jest.fn(),
      isOwner: jest.fn(),
    });

    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Error')).toBeTruthy();
  });

  it('renders empty state', () => {
    (useProfile as jest.Mock).mockReturnValue({
      profile: null,
      loading: false,
      error: null,
      refreshProfile: jest.fn(),
      isOwner: jest.fn(),
    });

    const { getByText } = render(<ProfileScreen />);
    expect(getByText('No profile data')).toBeTruthy();
  });

  it('handles follow and unfollow', async () => {
    const profile = {
      user_id: 'user-1',
      handle: 'test',
      follow_relation: null,
      block_relation: null,
      stats: { followers_count: 1, following_count: 2, posts_count: 3, points_total: 4 },
      visibility: 'public',
      bio: 'bio',
    };
    (useProfile as jest.Mock).mockReturnValue({
      profile,
      loading: false,
      error: null,
      refreshProfile: jest.fn(),
      isOwner: jest.fn().mockReturnValue(false),
    });
    (apiService.followUser as jest.Mock).mockResolvedValue({ data: { ok: true } });
    (apiService.unfollowUser as jest.Mock).mockResolvedValue({});
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId, getByText } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('follow-toggle-button'));
    await waitFor(() => {
      expect(apiService.followUser).toHaveBeenCalledWith('user-1');
    });

    fireEvent.press(getByTestId('follow-toggle-button'));
    await waitFor(() => {
      expect(apiService.unfollowUser).toHaveBeenCalledWith('user-1');
    });

    expect(getByText('@test')).toBeTruthy();
    expect(alertSpy).toHaveBeenCalled();
  });

  it('handles block toggle and blocked-by guard', () => {
    const profile = {
      user_id: 'user-1',
      handle: 'test',
      follow_relation: null,
      block_relation: 'blocked_by',
      stats: { followers_count: 1, following_count: 2, posts_count: 3, points_total: 4 },
      visibility: 'public',
    };
    (useProfile as jest.Mock).mockReturnValue({
      profile,
      loading: false,
      error: null,
      refreshProfile: jest.fn(),
      isOwner: jest.fn().mockReturnValue(false),
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId, getByText } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('block-toggle-button'));

    expect(apiService.blockUser).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
    expect(getByText('This user has blocked you')).toBeTruthy();
  });
});
