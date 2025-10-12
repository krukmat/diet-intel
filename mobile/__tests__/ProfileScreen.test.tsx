// Mock Navigation before importing anything
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

// Skip Alert mocking as it causes jest spy issues

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ProfileScreen } from '../screens/ProfileScreen';

// EPIC_A.A1: Tests completos para ProfileScreen con mocks y assertions de orden

// Mock the entire ApiService module
jest.mock('../services/ApiService');
jest.mock('../contexts/ProfileContext');

import { apiService } from '../services/ApiService';
import { useProfile } from '../contexts/ProfileContext';

// Mock the context
const mockUseProfile = useProfile as jest.MockedFunction<typeof useProfile>;
const mockRefreshProfile = jest.fn();
const mockIsOwner = jest.fn();

// Mock ApiService methods
const mockGetCurrentUser = apiService.getCurrentUser as jest.MockedFunction<typeof apiService.getCurrentUser>;
const mockGetProfile = apiService.getProfile as jest.MockedFunction<typeof apiService.getProfile>;
const mockFollowUser = apiService.followUser as jest.MockedFunction<typeof apiService.followUser>;
const mockUnfollowUser = apiService.unfollowUser as jest.MockedFunction<typeof apiService.unfollowUser>;

describe('ProfileScreen', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockIsOwner.mockReturnValue(true);

    // Setup default mock implementations
    mockUseProfile.mockReturnValue({
      profile: null,
      loading: true,
      error: null,
      refreshProfile: mockRefreshProfile,
      isOwner: mockIsOwner,
    });
  });

  test('shows initial loading state', () => {
    // Arrange
    mockUseProfile.mockReturnValue({
      profile: null,
      loading: true,
      error: null,
      refreshProfile: mockRefreshProfile,
      isOwner: mockIsOwner,
    });

    // Act
    render(<ProfileScreen />);

    // Assert
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  test('displays profile data correctly when loaded', () => {
    // Arrange
    const mockProfile = {
      user_id: 'user123',
      handle: 'testuser',
      bio: 'Test bio',
      avatar_url: null,
      visibility: 'public' as const,
      stats: {
        followers_count: 10,
        following_count: 5,
        posts_count: 3,
      points_total: 100,
      level: 2,
      badges_count: 1,
    },
      follow_relation: null,
      posts: [],
      posts_notice: null,
    };

    mockUseProfile.mockReturnValue({
      profile: mockProfile,
      loading: false,
      error: null,
      refreshProfile: mockRefreshProfile,
      isOwner: mockIsOwner,
    });

    // Act
    render(<ProfileScreen />);

    // Assert - Profile data is displayed
    expect(screen.getByText('@testuser')).toBeTruthy();
    expect(screen.getByText('Test bio')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy(); // followers count
    expect(screen.getByText('5')).toBeTruthy();  // following count
    expect(screen.getByText('3')).toBeTruthy();  // posts count
    expect(screen.getByText('Edit Profile')).toBeTruthy();
  });

  test('shows privacy notice when profile has posts_notice', () => {
    // Arrange
    const mockProfile = {
      user_id: 'user123',
      handle: 'privateuser',
      bio: null,
      avatar_url: null,
      visibility: 'followers_only' as const,
      stats: {
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
      points_total: 50,
      level: 1,
      badges_count: 0,
    },
      follow_relation: null,
      posts: [],
      posts_notice: 'Follow to see posts',
    };

    mockUseProfile.mockReturnValue({
      profile: mockProfile,
      loading: false,
      error: null,
      refreshProfile: mockRefreshProfile,
      isOwner: mockIsOwner,
    });

    // Act
    render(<ProfileScreen />);

    // Assert - Privacy notice is displayed
    expect(screen.getByText('Follow to see posts')).toBeTruthy();
  });

  test('displays error message when loading fails', () => {
    // Arrange
    mockUseProfile.mockReturnValue({
      profile: null,
      loading: false,
      error: 'Failed to load profile',
      refreshProfile: mockRefreshProfile,
      isOwner: mockIsOwner,
    });

    // Act
    render(<ProfileScreen />);

    // Assert - Error message is displayed
    expect(screen.getByText('Failed to load profile')).toBeTruthy();
  });

  test('shows No Profile Data message when no profile and not loading', () => {
    // Arrange
    mockUseProfile.mockReturnValue({
      profile: null,
      loading: false,
      error: null,
      refreshProfile: mockRefreshProfile,
      isOwner: mockIsOwner,
    });

    // Act
    render(<ProfileScreen />);

    // Assert - No profile data message
    expect(screen.getByText('No profile data')).toBeTruthy();
  });

  test('renders avatar placeholder when no avatar_url', () => {
    // Arrange
    const mockProfile = {
      user_id: 'user123',
      handle: 'testuser',
      bio: 'Test bio',
      avatar_url: null,
      visibility: 'public' as const,
      stats: {
        followers_count: 1,
        following_count: 1,
        posts_count: 1,
      points_total: 1,
      level: 1,
      badges_count: 1,
    },
      follow_relation: null,
      posts: [],
      posts_notice: null,
    };

    mockUseProfile.mockReturnValue({
      profile: mockProfile,
      loading: false,
      error: null,
      refreshProfile: mockRefreshProfile,
      isOwner: mockIsOwner,
    });

    // Act
    render(<ProfileScreen />);

    // Assert - Avatar placeholder exists
    expect(screen.getByTestId('avatar-placeholder')).toBeTruthy();
  });

  test('renders stats labels correctly', () => {
    // Arrange
    const mockProfile = {
      user_id: 'user123',
      handle: 'testuser',
      bio: null,
      avatar_url: null,
      visibility: 'public' as const,
      stats: {
        followers_count: 50,
        following_count: 30,
        posts_count: 15,
      points_total: 200,
      level: 3,
      badges_count: 2,
    },
      follow_relation: null,
      posts: [],
      posts_notice: null,
    };

    mockUseProfile.mockReturnValue({
      profile: mockProfile,
      loading: false,
      error: null,
      refreshProfile: mockRefreshProfile,
      isOwner: mockIsOwner,
    });

    // Act
    render(<ProfileScreen />);

    // Assert - Stats labels are present
    expect(screen.getByText('Followers')).toBeTruthy();
    expect(screen.getByText('Following')).toBeTruthy();
    expect(screen.getByText('Posts')).toBeTruthy();
  });

  test('refreshProfile is called on component mount', () => {
    // Arrange
    mockUseProfile.mockReturnValue({
      profile: null,
      loading: true,
      error: null,
      refreshProfile: mockRefreshProfile,
      isOwner: mockIsOwner,
    });

    // Act
    render(<ProfileScreen />);

    // Assert - refreshProfile should have been called
    expect(mockRefreshProfile).toHaveBeenCalledTimes(1);
  });

  test('shows Follow button for non-owner viewers', () => {
    const mockProfile = {
      user_id: 'other-user',
      handle: 'someoneelse',
      bio: null,
      avatar_url: null,
      visibility: 'public' as const,
      stats: {
        followers_count: 3,
        following_count: 2,
        posts_count: 1,
        points_total: 20,
        level: 1,
        badges_count: 0,
      },
      follow_relation: null,
      posts: [],
      posts_notice: null,
    };

    mockIsOwner.mockReturnValue(false);
    mockUseProfile.mockReturnValue({
      profile: mockProfile,
      loading: false,
      error: null,
      refreshProfile: mockRefreshProfile,
      isOwner: mockIsOwner,
    });

    render(<ProfileScreen />);

    expect(screen.getByTestId('follow-toggle-button')).toBeTruthy();
    expect(screen.getByText('Follow')).toBeTruthy();
    expect(screen.queryByText('Edit Profile')).toBeNull();
  });

  test('shows Unfollow button when viewer already follows', () => {
    const mockProfile = {
      user_id: 'other-user',
      handle: 'followeduser',
      bio: null,
      avatar_url: null,
      visibility: 'public' as const,
      stats: {
        followers_count: 8,
        following_count: 4,
        posts_count: 2,
        points_total: 60,
        level: 2,
        badges_count: 0,
      },
      follow_relation: 'active' as const,
      posts: [],
      posts_notice: null,
    };

    mockIsOwner.mockReturnValue(false);
    mockUseProfile.mockReturnValue({
      profile: mockProfile,
      loading: false,
      error: null,
      refreshProfile: mockRefreshProfile,
      isOwner: mockIsOwner,
    });

    render(<ProfileScreen />);

    expect(screen.getByTestId('follow-toggle-button')).toBeTruthy();
    expect(screen.getByText('Unfollow')).toBeTruthy();
  });

  test('calls API followUser and refreshes profile on follow tap', async () => {
    const mockProfile = {
      user_id: 'other-user',
      handle: 'newfriend',
      bio: null,
      avatar_url: null,
      visibility: 'public' as const,
      stats: {
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        points_total: 0,
        level: 0,
        badges_count: 0,
      },
      follow_relation: null,
      posts: [],
      posts_notice: 'Follow to see posts',
    };

    mockIsOwner.mockReturnValue(false);
    mockFollowUser.mockResolvedValue({ data: { ok: true, status: 'active' } } as any);

    mockUseProfile.mockReturnValue({
      profile: mockProfile,
      loading: false,
      error: null,
      refreshProfile: mockRefreshProfile,
      isOwner: mockIsOwner,
    });

    render(<ProfileScreen />);

    fireEvent.press(screen.getByTestId('follow-toggle-button'));

    await waitFor(() => {
      expect(mockFollowUser).toHaveBeenCalledWith('other-user');
      expect(mockRefreshProfile).toHaveBeenCalled();
    });

    expect(screen.getByText('Unfollow')).toBeTruthy();
  });

  test('calls API unfollowUser and refreshes profile on unfollow tap', async () => {
    const mockProfile = {
      user_id: 'other-user',
      handle: 'existingfriend',
      bio: null,
      avatar_url: null,
      visibility: 'public' as const,
      stats: {
        followers_count: 4,
        following_count: 2,
        posts_count: 1,
        points_total: 15,
        level: 1,
        badges_count: 0,
      },
      follow_relation: 'active' as const,
      posts: [],
      posts_notice: null,
    };

    mockIsOwner.mockReturnValue(false);
    mockUnfollowUser.mockResolvedValue({ data: { ok: true } } as any);

    mockUseProfile.mockReturnValue({
      profile: mockProfile,
      loading: false,
      error: null,
      refreshProfile: mockRefreshProfile,
      isOwner: mockIsOwner,
    });

    render(<ProfileScreen />);

    fireEvent.press(screen.getByTestId('follow-toggle-button'));

    await waitFor(() => {
      expect(mockUnfollowUser).toHaveBeenCalledWith('other-user');
      expect(mockRefreshProfile).toHaveBeenCalled();
    });

    expect(screen.getByText('Follow')).toBeTruthy();
  });
});
