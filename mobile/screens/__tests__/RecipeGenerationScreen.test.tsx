import React from 'react';
import 'react-native/Libraries/Animated/NativeAnimatedHelper';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RecipeGenerationScreen from '../RecipeGenerationScreen';
import { useRecipeGeneration, usePersonalRecipes, useNetworkStatus } from '../../hooks/useApiRecipes';

jest.mock('../../hooks/useApiRecipes', () => ({
  useRecipeGeneration: jest.fn(),
  usePersonalRecipes: jest.fn(),
  useNetworkStatus: jest.fn(),
}));

jest.mock('../../components/RecipeFormComponents', () => ({
  MultiSelect: () => <mock-multiselect testID="multi-select" />,
  CheckboxGroup: () => <mock-checkbox-group />,
  RadioGroup: () => <mock-radio-group />,
  NumberInput: () => <mock-number-input />,
  ValidatedTextInput: ({ onValueChange }: any) => (
    <mock-text-input testID="validated-input" onPress={() => onValueChange('400')} />
  ),
}));

jest.mock('../../components/RecipeLanguageToggle', () => ({
  RecipeLanguageToggle: ({ onLanguageChange }: any) => (
    <mock-language-toggle onPress={() => onLanguageChange('en')} />
  )
}));

jest.mock('../../utils/recipeLanguageHelper', () => ({
  getCurrentRecipeLanguage: jest.fn(() => 'en'),
  getLocalizedCuisineTypes: jest.fn(() => ({ italian: 'Italian', mexican: 'Mexican', spanish: 'Spanish', mediterranean: 'Mediterranean', american: 'American', chinese: 'Chinese', japanese: 'Japanese', indian: 'Indian', thai: 'Thai', french: 'French', greek: 'Greek', korean: 'Korean', middle_eastern: 'Middle Eastern', other: 'Other' })),
  getLocalizedDietaryRestrictions: jest.fn(() => ({ vegetarian: 'Vegetarian', vegan: 'Vegan', gluten_free: 'Gluten Free', dairy_free: 'Dairy Free', nut_free: 'Nut Free', low_carb: 'Low Carb', low_fat: 'Low Fat', keto: 'Keto', paleo: 'Paleo' })),
  getLocalizedDifficultyLevels: jest.fn(() => ({ beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' })),
  enhanceRequestWithLanguage: jest.fn((request) => ({ ...request, target_language: 'en' })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  })
}));

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return { ...actual, Alert: { alert: jest.fn() } };
});

describe('RecipeGenerationScreen', () => {
  const baseGeneration = {
    generateRecipe: jest.fn(),
    cancelGeneration: jest.fn(),
    data: null,
    loading: false,
    error: null,
    progress: null,
    isGenerating: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRecipeGeneration as jest.Mock).mockReturnValue(baseGeneration);
    (usePersonalRecipes as jest.Mock).mockReturnValue({ saveRecipe: jest.fn() });
    (useNetworkStatus as jest.Mock).mockReturnValue({ isConnected: true });
  });

  it('renders results view and navigates to detail', () => {
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      ...baseGeneration,
      data: {
        recipe: {
          name: 'Generated',
          description: 'Desc',
          cookingTime: 10,
          rating: 4.5,
          calories: 400,
          ingredients: [{ amount: 1, unit: 'cup', name: 'Rice' }],
          instructions: [{ step: 1, instruction: 'Cook' }],
        },
        generationMetadata: { aiModel: 'model', processingTime: 1, confidence: 0.9 },
      },
    });

    const onNavigateToDetail = jest.fn();

    const { getByText } = render(
      <RecipeGenerationScreen onBackPress={jest.fn()} onNavigateToDetail={onNavigateToDetail} />
    );

    fireEvent.press(getByText(/View Full Recipe/));

    expect(onNavigateToDetail).toHaveBeenCalled();
  });

  it('saves and shares recipe from results view', async () => {
    const saveRecipe = jest.fn().mockResolvedValue(undefined);
    (usePersonalRecipes as jest.Mock).mockReturnValue({ saveRecipe });
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      ...baseGeneration,
      data: {
        recipe: {
          name: 'Generated',
          description: 'Desc',
          cookingTime: 10,
          rating: 4.5,
          calories: 400,
          ingredients: [{ amount: 1, unit: 'cup', name: 'Rice' }],
          instructions: [{ step: 1, instruction: 'Cook' }],
        },
        generationMetadata: { aiModel: 'model', processingTime: 1, confidence: 0.9 },
      },
    });

    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const confirm = buttons?.find((button: any) => button.text === 'Save');
      if (confirm && typeof confirm.onPress === 'function') {
        confirm.onPress();
      }
    });

    const { getByText } = render(
      <RecipeGenerationScreen onBackPress={jest.fn()} />
    );

    fireEvent.press(getByText(/Save/));
    fireEvent.press(getByText(/Share/));

    await waitFor(() => {
      expect(saveRecipe).toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalled();
    });
  });

  it('shows generation progress and cancels', () => {
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      ...baseGeneration,
      isGenerating: true,
      progress: { progress: 50, message: 'Working' },
    });

    const { getByText } = render(
      <RecipeGenerationScreen onBackPress={jest.fn()} />
    );

    fireEvent.press(getByText(/Cancel Generation/));

    expect(baseGeneration.cancelGeneration).toHaveBeenCalled();
  });
});
