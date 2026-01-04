import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import TastePreferencesScreen from '../TastePreferencesScreen';

jest.mock('../../services/RecipeApiService', () => ({
  RecipeApiService: {
    getInstance: jest.fn(),
  },
}));

const { RecipeApiService } = jest.requireMock('../../services/RecipeApiService');

describe('TastePreferencesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads user preferences and toggles options', async () => {
    const getUserLearningProgress = jest.fn().mockResolvedValue({
      progressPercentage: 50,
      totalRatings: 10,
      requiredForAccuracy: 20,
      insights: { recommendations: 'Keep rating' },
    });
    const getUserTasteProfile = jest.fn().mockResolvedValue({
      profile: {
        cuisinePreferences: ['Italian'],
        spiceLevel: 'medium',
        dietaryRestrictions: ['Vegan'],
        confidenceScore: 0.7,
        totalRatings: 12,
      },
    });
    const learnUserPreferences = jest.fn().mockResolvedValue({});

    RecipeApiService.getInstance.mockReturnValue({
      getUserLearningProgress,
      getUserTasteProfile,
      learnUserPreferences,
    });

    const { getByText } = render(
      <TastePreferencesScreen onBackPress={jest.fn()} userId="user-1" />
    );

    await waitFor(() => {
      expect(getUserLearningProgress).toHaveBeenCalled();
      expect(getUserTasteProfile).toHaveBeenCalled();
    });

    fireEvent.press(getByText('Mexican'));
    fireEvent.press(getByText('🌶️ Mild'));
    fireEvent.press(getByText('Gluten-Free'));

    fireEvent.press(getByText('✅ Save Preferences'));

    await waitFor(() => {
      expect(learnUserPreferences).toHaveBeenCalled();
    });
  });

  it('handles load error', async () => {
    const getUserLearningProgress = jest.fn().mockRejectedValue(new Error('fail'));
    const getUserTasteProfile = jest.fn().mockResolvedValue({ profile: {} });

    RecipeApiService.getInstance.mockReturnValue({
      getUserLearningProgress,
      getUserTasteProfile,
      learnUserPreferences: jest.fn(),
    });

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    render(<TastePreferencesScreen onBackPress={jest.fn()} userId="user-1" />);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Failed to load your taste preferences. Please try again.'
      );
    });
  });

  it('handles save error', async () => {
    const getUserLearningProgress = jest.fn().mockResolvedValue({
      progressPercentage: 10,
      totalRatings: 1,
      requiredForAccuracy: 10,
      insights: { recommendations: 'Keep rating' },
    });
    const getUserTasteProfile = jest.fn().mockResolvedValue({
      profile: {
        cuisinePreferences: [],
        spiceLevel: 'medium',
        dietaryRestrictions: [],
        confidenceScore: 0.2,
        totalRatings: 1,
      },
    });
    const learnUserPreferences = jest.fn().mockRejectedValue(new Error('fail'));

    RecipeApiService.getInstance.mockReturnValue({
      getUserLearningProgress,
      getUserTasteProfile,
      learnUserPreferences,
    });

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByText } = render(
      <TastePreferencesScreen onBackPress={jest.fn()} userId="user-1" />
    );

    await waitFor(() => {
      expect(getUserTasteProfile).toHaveBeenCalled();
    });

    fireEvent.press(getByText('✅ Save Preferences'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Failed to save your preferences. Please try again.'
      );
    });
  });
});
