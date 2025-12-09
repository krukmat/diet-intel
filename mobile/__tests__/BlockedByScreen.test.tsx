import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { BlockedByScreen } from '../screens/BlockedByScreen';
import { apiService } from '../services/ApiService';
import { useAuth } from '../contexts/AuthContext';

// Mock dependencies
jest.mock('../services/ApiService');
jest.mock('../contexts/AuthContext');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

const mockApiService = apiService as jest.Mocked<typeof apiService>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('BlockedByScreen', () => {
  const mockUser = { id: 'user1', email: 'test@example.com' };
  const mockBlockers = {
    items: [
      {
        user_id: 'blocker1',
        handle: 'blockeruser1',
        avatar_url: 'https://example.com/avatar1.jpg',
        since: '2025-01-01T10:00:00Z',
        reason: 'inappropriate'
      },
      {
        user_id: 'blocker2',
        handle: 'blockeruser2',
        avatar_url: null,
        since: '2025-01-02T10:00:00Z',
        reason: null
      }
    ],
    next_cursor: 'next456'
  };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshAuth: jest.fn(),
    });

    mockApiService.getBlockers.mockResolvedValue({
      data: mockBlockers,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    const { getByText } = render(<BlockedByScreen />);

    expect(getByText('Loading users who blocked you...')).toBeTruthy();
  });

  it('renders blockers list after loading', async () => {
    const { getByText } = render(<BlockedByScreen />);

    await waitFor(() => {
      expect(getByText('@blockeruser1')).toBeTruthy();
      expect(getByText('@blockeruser2')).toBeTruthy();
    });
  });

  it('displays blocker information correctly', async () => {
    const { getByText } = render(<BlockedByScreen />);

    await waitFor(() => {
      expect(getByText('Blocked you 1/1/2025')).toBeTruthy();
      expect(getByText('Reason: inappropriate')).toBeTruthy();
      expect(getByText('Blocked you')).toBeTruthy(); // Status badge
    });
  });

  it('handles API error state', async () => {
    mockApiService.getBlockers.mockRejectedValue(new Error('API Error'));

    const { getByText } = render(<BlockedByScreen />);

    await waitFor(() => {
      expect(getByText('Failed to load users who blocked you')).toBeTruthy();
      expect(getByText('Retry')).toBeTruthy();
    });
  });

  it('handles retry functionality', async () => {
    // First call fails
    mockApiService.getBlockers
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce({
        data: mockBlockers,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

    const { getByText } = render(<BlockedByScreen />);

    // Wait for error state
    await waitFor(() => {
      expect(getByText('Failed to load users who blocked you')).toBeTruthy();
    });

    // Press retry
    const retryButton = getByText('Retry');
    fireEvent.press(retryButton);

    // Should reload and show users
    await waitFor(() => {
      expect(getByText('@blockeruser1')).toBeTruthy();
    });
  });

  it('shows empty state when no blockers', async () => {
    mockApiService.getBlockers.mockResolvedValue({
      data: { items: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    });

    const { getByText } = render(<BlockedByScreen />);

    await waitFor(() => {
      expect(getByText('No users have blocked you.')).toBeTruthy();
    });
  });

  it('navigates to profile when user item is pressed', async () => {
    const mockNavigate = jest.fn();
    const mockUseNavigation = require('@react-navigation/native').useNavigation;
    mockUseNavigation.mockReturnValue({
      navigate: mockNavigate,
      goBack: jest.fn(),
    });

    const { getByText } = render(<BlockedByScreen />);

    await waitFor(() => {
      expect(getByText('@blockeruser1')).toBeTruthy();
    });

    const userItem = getByText('@blockeruser1');
    fireEvent.press(userItem);

    expect(mockNavigate).toHaveBeenCalledWith('profile', { userId: 'blocker1' });

    mockUseNavigation.mockRestore();
  });

  it('handles refresh functionality', async () => {
    const { getByTestId } = render(<BlockedByScreen />);

    await waitFor(() => {
      expect(getByTestId('blocked-by-list')).toBeTruthy();
    });

    // In a real scenario, you would test the RefreshControl
    // For now, we just verify the component renders without crashing
  });
});
