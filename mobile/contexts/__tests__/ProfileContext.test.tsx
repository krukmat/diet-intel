import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ProfileProvider, useProfile } from '../ProfileContext';
import { apiService } from '../../services/ApiService';

jest.mock('../../services/ApiService', () => ({
  apiService: {
    getCurrentUser: jest.fn(),
    getProfile: jest.fn(),
  },
}));

const ProfileConsumer = () => {
  const { profile, loading, error, refreshProfile, isOwner } = useProfile();
  return (
    <>
      <Text testID="loading">{loading ? 'loading' : 'idle'}</Text>
      <Text testID="error">{error || ''}</Text>
      <Text testID="handle">{profile?.handle || ''}</Text>
      <Text testID="owner">{profile ? String(isOwner(profile.user_id)) : 'false'}</Text>
      <TouchableOpacity testID="refresh" onPress={refreshProfile} />
    </>
  );
};

describe('ProfileContext', () => {
  const mockApiService = apiService as jest.Mocked<typeof apiService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads profile and updates state', async () => {
    mockApiService.getCurrentUser.mockResolvedValueOnce({ data: { id: 'user-1' } });
    mockApiService.getProfile.mockResolvedValueOnce({
      data: {
        user_id: 'user-1',
        handle: 'alex',
        visibility: 'public',
        stats: {
          followers_count: 0,
          following_count: 0,
          posts_count: 0,
          points_total: 0,
          level: 1,
          badges_count: 0,
        },
      },
    });

    const { getByTestId } = render(
      <ProfileProvider>
        <ProfileConsumer />
      </ProfileProvider>
    );

    fireEvent.press(getByTestId('refresh'));

    await waitFor(() => {
      expect(getByTestId('loading').children[0]).toBe('idle');
      expect(getByTestId('handle').children[0]).toBe('alex');
      expect(getByTestId('owner').children[0]).toBe('true');
    });
  });

  it('handles errors when loading profile fails', async () => {
    mockApiService.getCurrentUser.mockRejectedValueOnce(new Error('fail'));

    const { getByTestId } = render(
      <ProfileProvider>
        <ProfileConsumer />
      </ProfileProvider>
    );

    fireEvent.press(getByTestId('refresh'));

    await waitFor(() => {
      expect(getByTestId('error').children[0]).toBe('Failed to load profile');
      expect(getByTestId('handle').children?.[0]).toBeUndefined();
    });
  });

  it('throws when useProfile is used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<ProfileConsumer />)).toThrow(
      'useProfile must be used within a ProfileProvider'
    );

    consoleError.mockRestore();
  });
});
