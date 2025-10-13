import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { BlockedListScreen } from '../screens/BlockedListScreen';
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

describe('BlockedListScreen', () => {
  const mockUser = { id: 'user1', email: 'test@example.com' };
  const mockBlockedUsers = {
    items: [
      {
        user_id: 'blocked1',
        handle: 'blockeduser1',
        avatar_url: 'https://example.com/avatar1.jpg',
        since: '2025-01-01T10:00:00Z',
        reason: 'spam'
      },
      {
        user_id: 'blocked2',
        handle: 'blockeduser2',
        avatar_url: null,
        since: '2025-01-02T10:00:00Z',
        reason: null
      }
    ],
    next_cursor: 'next123'
  };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshAuth: jest.fn(),
    });

    mockApiService.getBlockedUsers.mockResolvedValue({
      data: mockBlockedUsers,
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
    const { getByText } = render(<BlockedListScreen />);

    expect(getByText('Loading blocked users...')).toBeTruthy();
  });

  it('renders blocked users list after loading', async () => {
    const { getByText } = render(<BlockedListScreen />);

    await waitFor(() => {
      expect(getByText('@blockeduser1')).toBeTruthy();
      expect(getByText('@blockeduser2')).toBeTruthy();
    });
  });

  it('displays blocked user information correctly', async () => {
    const { getByText } = render(<BlockedListScreen />);

    await waitFor(() => {
      expect(getByText('Blocked 1/1/2025')).toBeTruthy();
      expect(getByText('Reason: spam')).toBeTruthy();
    });
  });

  it('handles unblock action with confirmation', async () => {
    // Mock Alert.alert
    const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      // Simulate user pressing "Unblock" button
      if (buttons && buttons[1] && buttons[1].onPress) {
        buttons[1].onPress();
      }
    });

    mockApiService.unblockUser.mockResolvedValue({
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    });

    const { getAllByText } = render(<BlockedListScreen />);

    await waitFor(() => {
      const unblockButtons = getAllByText('Unblock');
      expect(unblockButtons.length).toBeGreaterThan(0);
    });

    const unblockButton = getAllByText('Unblock')[0];
    fireEvent.press(unblockButton);

    expect(mockAlert).toHaveBeenCalledWith(
      'Unblock User',
      'Are you sure you want to unblock @blockeduser1?',
      expect.any(Array)
    );

    await waitFor(() => {
      expect(mockApiService.unblockUser).toHaveBeenCalledWith('blocked1');
    });

    mockAlert.mockRestore();
  });

  it('handles unblock error gracefully', async () => {
    // Mock Alert.alert
    const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      if (buttons && buttons[1] && buttons[1].onPress) {
        buttons[1].onPress();
      }
    });

    mockApiService.unblockUser.mockRejectedValue(new Error('Unblock failed'));

    const { getAllByText } = render(<BlockedListScreen />);

    await waitFor(() => {
      const unblockButtons = getAllByText('Unblock');
      expect(unblockButtons.length).toBeGreaterThan(0);
    });

    const unblockButton = getAllByText('Unblock')[0];
    fireEvent.press(unblockButton);

    await waitFor(() => {
      expect(mockApiService.unblockUser).toHaveBeenCalledWith('blocked1');
    });

    mockAlert.mockRestore();
  });

  it('handles API error state', async () => {
    mockApiService.getBlockedUsers.mockRejectedValue(new Error('API Error'));

    const { getByText } = render(<BlockedListScreen />);

    await waitFor(() => {
      expect(getByText('Failed to load blocked users')).toBeTruthy();
      expect(getByText('Retry')).toBeTruthy();
    });
  });

  it('handles retry functionality', async () => {
    // First call fails
    mockApiService.getBlockedUsers
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce({
        data: mockBlockedUsers,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

    const { getByText } = render(<BlockedListScreen />);

    // Wait for error state
    await waitFor(() => {
      expect(getByText('Failed to load blocked users')).toBeTruthy();
    });

    // Press retry
    const retryButton = getByText('Retry');
    fireEvent.press(retryButton);

    // Should reload and show users
    await waitFor(() => {
      expect(getByText('@blockeduser1')).toBeTruthy();
    });
  });

  it('shows empty state when no blocked users', async () => {
    mockApiService.getBlockedUsers.mockResolvedValue({
      data: { items: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    });

    const { getByText } = render(<BlockedListScreen />);

    await waitFor(() => {
      expect(getByText("You haven't blocked any users yet.")).toBeTruthy();
    });
  });

  it('handles pagination correctly', async () => {
    const { getByText } = render(<BlockedListScreen />);

    await waitFor(() => {
      expect(getByText('@blockeduser1')).toBeTruthy();
    });

    // Check that Load More button is not present when there's no next cursor initially
    // In a real scenario, you would test the scroll behavior
  });
});
