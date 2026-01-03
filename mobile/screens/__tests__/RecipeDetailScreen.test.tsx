import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import RecipeDetailScreen from '../RecipeDetailScreen';
import { Alert } from 'react-native';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return { ...actual, Alert: { alert: jest.fn() } };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, vars?: any) => {
      if (fallback && vars?.current && vars?.total) {
        return fallback.replace('{{current}}', String(vars.current)).replace('{{total}}', String(vars.total));
      }
      return fallback || _key;
    },
  }),
}));

jest.mock('../../components/RecipeDetailComponents', () => ({
  RecipeHeader: ({ onShare, onSave, onOptimize, onGenerateShoppingList }: any) => (
    <mock-recipe-header testID="mock-recipe-header">
      <mock-share testID="mock-share" onPress={onShare} />
      <mock-save testID="mock-save" onPress={onSave} />
      <mock-optimize testID="mock-optimize" onPress={onOptimize} />
      <mock-shopping testID="mock-shopping" onPress={onGenerateShoppingList} />
    </mock-recipe-header>
  ),
  InteractiveIngredients: ({ onServingsChange, onIngredientToggle }: any) => (
    <mock-ingredients testID="mock-ingredients">
      <mock-servings testID="mock-servings" onPress={() => onServingsChange(2)} />
      <mock-ingredient-toggle testID="mock-ingredient-toggle" onPress={() => onIngredientToggle(0, true)} />
    </mock-ingredients>
  ),
  Instructions: ({ onStartCookingMode, onStepComplete }: any) => (
    <mock-instructions testID="mock-instructions">
      <mock-cooking testID="mock-cooking" onPress={onStartCookingMode} />
      <mock-step testID="mock-step" onPress={() => onStepComplete(0, true)} />
    </mock-instructions>
  ),
  NutritionDisplay: () => <mock-nutrition testID="mock-nutrition" />,
  RatingSystem: ({ onRatingSubmit }: any) => (
    <mock-rating testID="mock-rating" onPress={() => onRatingSubmit(5, 'great')} />
  ),
}));

jest.mock('../../utils/recipeLanguageHelper', () => ({
  getCurrentRecipeLanguage: jest.fn(() => 'en'),
  formatRecipeTime: jest.fn((minutes: number) => `${minutes} min`),
}));

describe('RecipeDetailScreen', () => {
  const recipe = {
    id: 'r1',
    name: 'Test Recipe',
    description: 'Desc',
    cookingTime: 10,
    servings: 2,
    difficulty: 'beginner',
    cuisineType: 'italian',
    rating: 4.2,
    totalRatings: 10,
    tags: ['Tag'],
    ingredients: [{ name: 'Ingredient', quantity: 1, unit: 'cup' }],
    instructions: [{ step: 1, instruction: 'Do it' }],
    nutrition: {
      calories: 100,
      protein: 10,
      fat: 5,
      carbs: 20,
      fiber: 2,
      sugar: 1,
      sodium: 10,
      score: 0.9,
    },
  };

  it('renders tabs and switches to instructions', () => {
    const { getByText, getByTestId } = render(
      <RecipeDetailScreen recipe={recipe} onBackPress={jest.fn()} />
    );

    fireEvent.press(getByText('Instructions'));

    expect(getByTestId('mock-instructions')).toBeTruthy();
  });

  it('triggers share and save alerts', () => {
    const { getByTestId } = render(
      <RecipeDetailScreen recipe={recipe} onBackPress={jest.fn()} />
    );

    fireEvent.press(getByTestId('mock-share'));
    fireEvent.press(getByTestId('mock-save'));

    expect(Alert.alert).toHaveBeenCalled();
  });

  it('navigates to optimize when handler is provided', () => {
    const onNavigateToOptimize = jest.fn();
    const { getByTestId } = render(
      <RecipeDetailScreen recipe={recipe} onBackPress={jest.fn()} onNavigateToOptimize={onNavigateToOptimize} />
    );

    fireEvent.press(getByTestId('mock-optimize'));

    expect(onNavigateToOptimize).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
  });

  it('submits rating', () => {
    const { getByText, getByTestId } = render(
      <RecipeDetailScreen recipe={recipe} onBackPress={jest.fn()} />
    );

    fireEvent.press(getByText('Reviews'));
    fireEvent.press(getByTestId('mock-rating'));

    expect(Alert.alert).toHaveBeenCalled();
  });

  it('generates shopping list confirmation flow', () => {
    (Alert.alert as jest.Mock).mockImplementation((_title, _message, buttons) => {
      const confirm = buttons?.[1];
      if (confirm && typeof confirm.onPress === 'function') {
        confirm.onPress();
      }
    });

    const { getByTestId } = render(
      <RecipeDetailScreen recipe={recipe} onBackPress={jest.fn()} />
    );

    fireEvent.press(getByTestId('mock-shopping'));

    expect(Alert.alert).toHaveBeenCalled();
  });
});
