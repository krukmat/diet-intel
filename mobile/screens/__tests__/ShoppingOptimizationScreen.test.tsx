import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ShoppingOptimizationScreen from '../ShoppingOptimizationScreen';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    FlatList: ({ data, renderItem, ...rest }: any) => (
      <actual.View testID="shopping-list" {...rest}>
        {data.map((item: any) => (
          <actual.View key={item.id}>{renderItem({ item })}</actual.View>
        ))}
      </actual.View>
    ),
  };
});

jest.mock('../../services/RecipeApiService', () => ({
  RecipeApiService: {
    getInstance: jest.fn(),
  },
}));

const { RecipeApiService } = jest.requireMock('../../services/RecipeApiService');

describe('ShoppingOptimizationScreen', () => {
  const selectedRecipes = [
    { id: 'r1', name: 'Recipe 1', servings: 2, cookingTime: 15 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads optimization and renders tabs', async () => {
    const optimizeShoppingList = jest.fn().mockResolvedValue({
      consolidatedIngredients: [
        {
          id: 'i1',
          name: 'tomato_sauce',
          totalQuantity: 2,
          unit: 'cups',
          estimatedCost: 4,
          sourceRecipes: [{ recipeName: 'Recipe 1', quantity: 2, unit: 'cups' }],
          bulkDiscountAvailable: true,
        },
      ],
      bulkSuggestions: [
        {
          id: 'b1',
          ingredientConsolidationId: 'i1',
          suggestionType: 'bulk_pack',
          immediateSavings: 2,
          currentNeededQuantity: 2,
          regularUnitPrice: 2,
          suggestedBulkQuantity: 4,
          bulkUnit: 'cups',
          bulkUnitPrice: 1.5,
          storageRequirements: 'cool',
          estimatedUsageTimeframeDays: 14,
          perishabilityRisk: 'low',
          recommendationScore: 0.8,
        },
      ],
      optimizationMetrics: {
        totalIngredients: 10,
        consolidatedTo: 5,
        optimizationScore: 0.5,
      },
      estimatedTotalCost: 20,
      estimatedSavings: 3,
    });

    RecipeApiService.getInstance.mockReturnValue({ optimizeShoppingList });

    const { getByText } = render(
      <ShoppingOptimizationScreen
        onBackPress={jest.fn()}
        selectedRecipes={selectedRecipes}
        userId="user-1"
      />
    );

    await waitFor(() => {
      expect(optimizeShoppingList).toHaveBeenCalled();
    });

    expect(getByText('Ingredients (1)')).toBeTruthy();
    expect(getByText('Bulk Savings (1)')).toBeTruthy();
    expect(getByText('Summary')).toBeTruthy();
  });

  it('shows bulk empty state when no suggestions', async () => {
    const optimizeShoppingList = jest.fn().mockResolvedValue({
      consolidatedIngredients: [],
      bulkSuggestions: [],
      optimizationMetrics: {
        totalIngredients: 1,
        consolidatedTo: 1,
        optimizationScore: 0.2,
      },
      estimatedTotalCost: 5,
      estimatedSavings: 0,
    });

    RecipeApiService.getInstance.mockReturnValue({ optimizeShoppingList });

    const { getByText } = render(
      <ShoppingOptimizationScreen
        onBackPress={jest.fn()}
        selectedRecipes={selectedRecipes}
        userId="user-1"
      />
    );

    await waitFor(() => {
      expect(optimizeShoppingList).toHaveBeenCalled();
    });

    fireEvent.press(getByText('Bulk Savings (0)'));
    expect(getByText('💡 No Bulk Opportunities')).toBeTruthy();
  });

  it('handles optimization error', async () => {
    const optimizeShoppingList = jest.fn().mockRejectedValue(new Error('fail'));
    RecipeApiService.getInstance.mockReturnValue({ optimizeShoppingList });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    render(
      <ShoppingOptimizationScreen
        onBackPress={jest.fn()}
        selectedRecipes={selectedRecipes}
        userId="user-1"
      />
    );

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Failed to optimize your shopping list. Please try again.'
      );
    });
  });
});
