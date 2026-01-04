import React from 'react';
import 'react-native/Libraries/Animated/NativeAnimatedHelper';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import RecipeGenerationScreen from '../RecipeGenerationScreen';
import { useRecipeGeneration, usePersonalRecipes, useNetworkStatus } from '../../hooks/useApiRecipes';

jest.mock('../../hooks/useApiRecipes', () => ({
  useRecipeGeneration: jest.fn(),
  usePersonalRecipes: jest.fn(),
  useNetworkStatus: jest.fn(),
}));

let mockTargetCalories = '400';

jest.mock('../../components/RecipeFormComponents', () => {
  const React = require('react');
  const { View, Pressable, Text } = require('react-native');

  const makeTestId = (title: string) => title.replace(/\s+/g, '-').toLowerCase();

  return {
    MultiSelect: ({ onSelectionChange, title }: any) => (
      <Pressable
        testID={`multi-${makeTestId(title)}`}
        onPress={() => onSelectionChange(['italian'])}
      >
        <Text>{title}</Text>
      </Pressable>
    ),
    CheckboxGroup: ({ onSelectionChange, title }: any) => (
      <Pressable
        testID={`checkbox-${makeTestId(title)}`}
        onPress={() =>
          onSelectionChange(title.includes('Special') ? ['high_protein'] : ['vegan'])
        }
      >
        <View />
      </Pressable>
    ),
    RadioGroup: ({ onSelectionChange, title }: any) => (
      <Pressable
        testID={`radio-${makeTestId(title)}`}
        onPress={() => onSelectionChange('advanced')}
      >
        <Text>{title}</Text>
      </Pressable>
    ),
    NumberInput: ({ onValueChange, title }: any) => (
      <Pressable
        testID={`number-${makeTestId(title)}`}
        onPress={() =>
          onValueChange(title.includes('Servings') ? 2 : 45)
        }
      >
        <Text>{title}</Text>
      </Pressable>
    ),
    ValidatedTextInput: ({ onValueChange, title }: any) => (
      <Pressable
        testID={`input-${makeTestId(title)}`}
        onPress={() => {
          if (title.includes('Target Calories')) {
            onValueChange(mockTargetCalories);
          } else if (title.includes('Include')) {
            onValueChange('chicken, basil');
          } else if (title.includes('Exclude')) {
            onValueChange('nuts');
          }
        }}
      >
        <Text>{title}</Text>
      </Pressable>
    ),
  };
});

jest.mock('../../components/RecipeLanguageToggle', () => {
  const React = require('react');
  const { Pressable } = require('react-native');

  return {
    RecipeLanguageToggle: ({ onLanguageChange }: any) => (
      <Pressable testID="mock-language-toggle" onPress={() => onLanguageChange('en')} />
    ),
  };
});

jest.mock('../../utils/recipeLanguageHelper', () => ({
  getCurrentRecipeLanguage: jest.fn(() => 'en'),
  getLocalizedCuisineTypes: jest.fn(() => ({
    italian: 'Italian',
    mexican: 'Mexican',
    spanish: 'Spanish',
    mediterranean: 'Mediterranean',
    american: 'American',
    chinese: 'Chinese',
    japanese: 'Japanese',
    indian: 'Indian',
    thai: 'Thai',
    french: 'French',
    greek: 'Greek',
    korean: 'Korean',
    middle_eastern: 'Middle Eastern',
    other: 'Other',
  })),
  getLocalizedDietaryRestrictions: jest.fn(() => ({
    vegetarian: 'Vegetarian',
    vegan: 'Vegan',
    gluten_free: 'Gluten Free',
    dairy_free: 'Dairy Free',
    nut_free: 'Nut Free',
    low_carb: 'Low Carb',
    low_fat: 'Low Fat',
    keto: 'Keto',
    paleo: 'Paleo',
  })),
  getLocalizedDifficultyLevels: jest.fn(() => ({
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  })),
  enhanceRequestWithLanguage: jest.fn((request) => ({ ...request, target_language: 'en' })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  })
}));

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    Alert: { alert: jest.fn() },
    TouchableOpacity: actual.Pressable,
  };
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
    mockTargetCalories = '400';
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
      const confirm = Array.isArray(buttons)
        ? buttons.find((button: any) => button.text === 'Save')
        : undefined;
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

  it('validates form and blocks generation on invalid calories', () => {
    mockTargetCalories = '50';
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText, getByTestId } = render(
      <RecipeGenerationScreen onBackPress={jest.fn()} />
    );

    fireEvent.press(getByTestId('multi-🌍-cuisine-types'));
    fireEvent.press(getByTestId('input-🎯-target-calories-(per-serving)'));

    fireEvent.press(getByText('🤖 Generate AI Recipe'));

    expect(alertSpy).toHaveBeenCalledWith(
      '⚠️ Form Validation',
      'Please fix the form errors before generating a recipe.'
    );
  });

  it('blocks generation when offline', () => {
    (useNetworkStatus as jest.Mock).mockReturnValue({ isConnected: false });
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByText, getByTestId } = render(
      <RecipeGenerationScreen onBackPress={jest.fn()} />
    );

    fireEvent.press(getByTestId('multi-🌍-cuisine-types'));
    fireEvent.press(getByText('🤖 Generate AI Recipe'));

    expect(alertSpy).toHaveBeenCalledWith(
      '📶 No Internet Connection',
      'Recipe generation requires an internet connection. Please check your network and try again.',
      expect.any(Array)
    );
  });

  it('submits a generation request with preferences', async () => {
    const generateRecipe = jest.fn().mockResolvedValue({
      recipe: { name: 'Test' },
    });
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      ...baseGeneration,
      generateRecipe,
    });

    const { getByText, getByTestId } = render(
      <RecipeGenerationScreen onBackPress={jest.fn()} />
    );

    fireEvent.press(getByTestId('multi-🌍-cuisine-types'));
    fireEvent.press(getByTestId('checkbox-🥗-dietary-restrictions'));
    fireEvent.press(getByTestId('radio-📈-difficulty-level'));
    fireEvent.press(getByTestId('number-👥-servings'));
    fireEvent.press(getByTestId('number-⏱️-max-cooking-time'));
    fireEvent.press(getByTestId('input-🎯-target-calories-(per-serving)'));
    fireEvent.press(getByTestId('input-✅-include-ingredients-(optional)'));
    fireEvent.press(getByTestId('input-❌-exclude-ingredients-(optional)'));
    fireEvent.press(getByTestId('checkbox-🎯-special-goals'));

    fireEvent.press(getByText('🤖 Generate AI Recipe'));

    await waitFor(() => {
      expect(generateRecipe).toHaveBeenCalledWith(
        expect.objectContaining({
          cuisineTypes: ['italian'],
          dietaryRestrictions: ['vegan'],
          difficulty: 'advanced',
          cookingTime: 45,
          servings: 2,
          ingredients: ['chicken', 'basil'],
          allergies: ['nuts'],
          nutritionalTargets: { calories: 400 },
          target_language: 'en',
        })
      );
    });
  });

  it('shows generation error when API fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const generateRecipe = jest.fn().mockRejectedValue({ code: 'GENERATION_FAILED' });
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      ...baseGeneration,
      generateRecipe,
    });

    const { getByText, getByTestId } = render(
      <RecipeGenerationScreen onBackPress={jest.fn()} />
    );

    fireEvent.press(getByTestId('multi-🌍-cuisine-types'));
    fireEvent.press(getByText('🤖 Generate AI Recipe'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        '❌ Generation Error',
        'The AI recipe generator is currently unavailable. Please try again later.'
      );
    });
  });
});
