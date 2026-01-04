import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TestRenderer from 'react-test-renderer';
import {
  RecipeHeader,
  InteractiveIngredients,
  Instructions,
  NutritionDisplay,
  RatingSystem,
} from '../RecipeDetailComponents';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, vars?: any) => {
      if (vars?.completed !== undefined && vars?.total !== undefined) {
        return `${vars.completed} of ${vars.total} steps completed`;
      }
      return fallback || key;
    },
  }),
}));

jest.mock('../../utils/recipeLanguageHelper', () => ({
  getCurrentRecipeLanguage: jest.fn(() => 'en'),
  getLocalizedDifficultyLevels: jest.fn(() => ({
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    expert: 'Expert',
  })),
  formatRecipeTime: jest.fn((minutes: number) => `${minutes} min`),
  formatServings: jest.fn((servings: number) => `${servings} servings`),
}));

const baseRecipe = {
  name: 'Sample Recipe',
  description: 'Tasty meal',
  cookingTime: 30,
  servings: 2,
  difficulty: 'beginner',
  rating: 4.2,
  totalRatings: 12,
  tags: ['easy', 'quick', 'family', 'healthy', 'cheap'],
};

describe('RecipeHeader', () => {
  it('renders details and triggers actions', () => {
    const onShare = jest.fn();
    const onSave = jest.fn();
    const onOptimize = jest.fn();
    const onGenerateShoppingList = jest.fn();

    const { getByText } = render(
      <RecipeHeader
        recipe={baseRecipe}
        onShare={onShare}
        onSave={onSave}
        onOptimize={onOptimize}
        onGenerateShoppingList={onGenerateShoppingList}
        isFavorited={false}
      />
    );

    fireEvent.press(getByText('🤍'));
    fireEvent.press(getByText('🔗'));
    fireEvent.press(getByText('🛒 Shopping List'));
    fireEvent.press(getByText('⚡ Optimize'));

    expect(onSave).toHaveBeenCalled();
    expect(onShare).toHaveBeenCalled();
    expect(onGenerateShoppingList).toHaveBeenCalled();
    expect(onOptimize).toHaveBeenCalled();
    expect(getByText('+1')).toBeTruthy();
  });
});

describe('InteractiveIngredients', () => {
  it('scales servings and toggles ingredients', () => {
    const onServingsChange = jest.fn();
    const onIngredientToggle = jest.fn();

    const { getByText, getAllByText } = render(
      <InteractiveIngredients
        ingredients={[
          { name: 'Tomato', quantity: 2, unit: 'pcs' },
          { name: 'Salt', quantity: 1, unit: 'tsp', category: 'Spices' },
        ]}
        originalServings={2}
        onServingsChange={onServingsChange}
        onIngredientToggle={onIngredientToggle}
        checkedIngredients={[false, false]}
      />
    );

    fireEvent.press(getByText('+'));
    expect(onServingsChange).toHaveBeenCalledWith(3);

    fireEvent.press(getAllByText('⬜')[0]);
    expect(onIngredientToggle).toHaveBeenCalledWith(0, true);
  });
});

describe('Instructions', () => {
  it('marks steps and shows progress', () => {
    const onStepComplete = jest.fn();
    const onStartCookingMode = jest.fn();

    const { getByText } = render(
      <Instructions
        instructions={[
          { step: 1, instruction: 'Chop ingredients', timeMinutes: 5 },
          { step: 2, instruction: 'Cook meal', temperature: '180C' },
        ]}
        onStartCookingMode={onStartCookingMode}
        completedSteps={[false, false]}
        onStepComplete={onStepComplete}
      />
    );

    fireEvent.press(getByText('🔥 Cooking Mode'));
    expect(onStartCookingMode).toHaveBeenCalled();

    fireEvent.press(getByText('1'));
    expect(onStepComplete).toHaveBeenCalledWith(0, true);

    expect(getByText('0 of 2 steps completed')).toBeTruthy();
  });
});

describe('NutritionDisplay', () => {
  it('renders macro data', () => {
    const { getByText, getAllByText } = render(
      <NutritionDisplay
        nutrition={{ calories: 300, protein: 20, fat: 10, carbs: 40, fiber: 5 }}
        servings={2}
      />
    );

    expect(getByText('300')).toBeTruthy();
    expect(getAllByText('Protein').length).toBeGreaterThan(0);
    expect(getByText('Fiber')).toBeTruthy();
  });
});

describe('RatingSystem', () => {
  it('submits rating and review', async () => {
    const onRatingSubmit = jest.fn();
    const component = TestRenderer.create(
      <RatingSystem
        currentRating={4.5}
        totalRatings={10}
        onRatingSubmit={onRatingSubmit}
      />
    );

    const touchables = component.root.findAll(
      (node) => typeof node.props?.onPress === 'function'
    );
    touchables[0].props.onPress();

    const input = component.root.find(
      (node) => node.props?.placeholder === 'Share your experience with this recipe...'
    );
    input.props.onChangeText('Great!');

    const submitLabel = component.root.find(
      (node) => Array.isArray(node.children) && node.children.includes('Submit Review')
    );
    let submitParent: any = submitLabel;
    while (submitParent && typeof submitParent.props?.onPress !== 'function') {
      submitParent = submitParent.parent;
    }
    submitParent.props.onPress();

    expect(onRatingSubmit).toHaveBeenCalledWith(1, 'Great!');
  });
});
