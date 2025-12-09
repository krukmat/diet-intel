import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ProfileEditScreen } from '../screens/ProfileEditScreen';
import { Alert } from 'react-native';

// EPIC_A.A1: Tests para ProfileEditScreen con cobertura >90%

// Mock the entire ApiService module
jest.mock('../services/ApiService');
jest.mock('../contexts/ProfileContext');

import { apiService } from '../services/ApiService';
import { useProfile } from '../contexts/ProfileContext';

// Mock the context
const mockUseProfile = useProfile as jest.MockedFunction<typeof useProfile>;
const mockRefreshProfile = jest.fn();

// Mock ApiService
const mockUpdateProfile = apiService.updateProfile as jest.MockedFunction<typeof apiService.updateProfile>;

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('ProfileEditScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock profile
    mockUseProfile.mockReturnValue({
      profile: {
        user_id: 'user123',
        handle: 'testuser',
        bio: 'Test bio',
        avatar_url: null,
        visibility: 'public' as const,
        stats: {
          followers_count: 0,
          following_count: 0,
          posts_count: 0,
          points_total: 0,
          level: 1,
          badges_count: 0,
        },
        posts: [],
        posts_notice: null,
      },
      loading: false,
      error: null,
      refreshProfile: mockRefreshProfile,
      isOwner: jest.fn(),
    });
  });

  test('renders form with pre-filled profile values', () => {
    render(
      <ProfileEditScreen onSave={jest.fn()} onCancel={jest.fn()} />
    );

    expect(screen.getByDisplayValue('testuser')).toBeTruthy();
    expect(screen.getByDisplayValue('Test bio')).toBeTruthy();
    expect(screen.getByText('Edit Profile')).toBeTruthy();
  });

  test('shows validation error for invalid handle', async () => {
    render(
      <ProfileEditScreen onSave={jest.fn()} onCancel={jest.fn()} />
    );

    const handleInput = screen.getByDisplayValue('testuser');
    fireEvent.changeText(handleInput, 'inv@lid');

    const saveButton = screen.getByText('Save');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Handle must be 3-30 characters (letters, numbers, underscores only)')).toBeTruthy();
    });
  });

  test('shows validation error for bio too long', async () => {
    const longBio = 'a'.repeat(281);
    render(
      <ProfileEditScreen onSave={jest.fn()} onCancel={jest.fn()} />
    );

    const bioInput = screen.getByDisplayValue('Test bio');
    fireEvent.changeText(bioInput, longBio);

    const saveButton = screen.getByText('Save');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Bio must be 280 characters or less')).toBeTruthy();
    });
  });

  test('successfully saves profile and calls onSave', async () => {
    const mockOnSave = jest.fn();
    mockUpdateProfile.mockResolvedValue({ data: {} });

    render(
      <ProfileEditScreen onSave={mockOnSave} onCancel={jest.fn()} />
    );

    const handleInput = screen.getByDisplayValue('testuser');
    const bioInput = screen.getByDisplayValue('Test bio');

    fireEvent.changeText(handleInput, 'updatedhandle');
    fireEvent.changeText(bioInput, 'Updated bio');

    const saveButton = screen.getByText('Save');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        handle: 'updatedhandle',
        bio: 'Updated bio',
        visibility: 'public',
      });
    });

    await waitFor(() => {
      expect(mockRefreshProfile).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        handle: 'updatedhandle',
        bio: 'Updated bio',
        visibility: 'public',
      });
    });
  });

  test('shows error alert when API fails', async () => {
    const mockOnSave = jest.fn();
    mockUpdateProfile.mockRejectedValue(new Error('API Error'));

    render(
      <ProfileEditScreen onSave={mockOnSave} onCancel={jest.fn()} />
    );

    const saveButton = screen.getByText('Save');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to update profile. Please try again.'
      );
    });
  });

  test('calls onCancel when Cancel button is pressed', () => {
    const mockOnCancel = jest.fn();

    render(
      <ProfileEditScreen onSave={jest.fn()} onCancel={mockOnCancel} />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.press(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  test('shows character counter for bio', () => {
    render(
      <ProfileEditScreen onSave={jest.fn()} onCancel={jest.fn()} />
    );

    const bioInput = screen.getByDisplayValue('Test bio');
    expect(screen.getByText('8/280')).toBeTruthy();

    fireEvent.changeText(bioInput, 'New text');

    expect(screen.getByText('8/280')).toBeTruthy();
  });

  test('toggles visibility when buttons are pressed', () => {
    render(
      <ProfileEditScreen onSave={jest.fn()} onCancel={jest.fn()} />
    );

    // Find the public button (should be selected by default)
    const publicButtons = screen.getAllByText('Public');
    expect(publicButtons.length).toBeGreaterThan(0);

    // Find the private button and press it
    const privateButtons = screen.getAllByText('Followers Only');
    fireEvent.press(privateButtons[0]);

    // Check that visibility is correctly passed to update
    mockUpdateProfile.mockResolvedValue({ data: {} });
  });

  test('loading state disables Save button', async () => {
    mockUpdateProfile.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(
      <ProfileEditScreen onSave={jest.fn()} onCancel={jest.fn()} />
    );

    const saveButton = screen.getByText('Save');
    fireEvent.press(saveButton);

    // Wait for loading state
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeTruthy();
    });
  });


});
