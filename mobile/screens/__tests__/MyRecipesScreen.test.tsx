import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MyRecipesScreen from '../MyRecipesScreen';
import { usePersonalRecipes, useNetworkStatus } from '../../hooks/useApiRecipes';
import { Alert } from 'react-native';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    Alert: { alert: jest.fn() },
  };
});

jest.mock('../../hooks/useApiRecipes', () => ({
  usePersonalRecipes: jest.fn(),
  useNetworkStatus: jest.fn(),
}));

jest.mock('../../components/RecipeLanguageToggle', () => ({
  RecipeLanguageToggle: ({ onLanguageChange }: { onLanguageChange: (lang: string) => void }) => (
    <mock-language-toggle onPress={() => onLanguageChange('en')} />
  )
}));

jest.mock('../../components/SyncStatusComponents', () => ({
  SyncStatusIndicator: () => <mock-sync-indicator />,
  SyncStatusBanner: () => <mock-sync-banner />,
}));

jest.mock('../../components/RecipeLibraryComponents', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    CollectionCard: ({ collection, onPress }: any) => (
      <mock-collection-card testID={`collection-${collection.id}`} onPress={() => onPress(collection)}>
        <Text>{collection.name}</Text>
      </mock-collection-card>
    ),
    PersonalRecipeCard: ({ recipe, onFavorite }: any) => (
      <mock-recipe-card testID={`recipe-${recipe.id}`} onPress={() => onFavorite(recipe.id)}>
        <Text>{recipe.name}</Text>
      </mock-recipe-card>
    ),
  LibrarySearchBar: ({ searchQuery, onSearchChange, onFilterPress, onSortPress }: any) => (
    <mock-search-bar>
      <mock-search-value>{searchQuery}</mock-search-value>
      <mock-search-change testID="search-change" onPress={() => onSearchChange('chicken')} />
      <mock-filter testID="filter-button" onPress={onFilterPress} />
      <mock-sort testID="sort-button" onPress={onSortPress} />
    </mock-search-bar>
  ),
  CollectionSelectorModal: ({ visible }: any) => (visible ? <mock-collection-selector /> : null),
  CreateCollectionModal: ({ visible, onSubmit }: any) => (
    visible ? <mock-create-collection testID="create-collection-modal" onPress={() => onSubmit('New', '', '#fff', 'folder')} /> : null
  ),
  EmptyLibraryState: ({ title, actionText, onAction }: any) => (
    <mock-empty-state>
      <mock-empty-title>{title}</mock-empty-title>
      <mock-empty-action onPress={onAction}>{actionText}</mock-empty-action>
    </mock-empty-state>
  ),
  RecipeManagementModal: ({ visible, onDelete }: any) => (
    visible ? <mock-management-modal onPress={() => onDelete('r1')} /> : null
  ),
  LibraryStats: () => <mock-library-stats />,
    BackupExportModal: ({ visible }: any) => (visible ? <mock-backup-modal /> : null),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  })
}));

describe('MyRecipesScreen', () => {
  const baseHookState = {
    recipes: [],
    collections: [],
    loading: false,
    error: null,
    loadRecipes: jest.fn(),
    loadCollections: jest.fn(),
    saveRecipe: jest.fn(),
    updateRecipe: jest.fn(),
    deleteRecipe: jest.fn(),
    toggleFavorite: jest.fn(),
    createCollection: jest.fn(),
    addToCollection: jest.fn(),
    removeFromCollection: jest.fn(),
    refresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (usePersonalRecipes as jest.Mock).mockReturnValue(baseHookState);
    (useNetworkStatus as jest.Mock).mockReturnValue({ isConnected: true });
  });

  it('renders header and search bar', () => {
    const { getByText } = render(<MyRecipesScreen onBackPress={jest.fn()} />);

    expect(getByText(/My Recipes/)).toBeTruthy();
    expect(getByText(/Back/)).toBeTruthy();
  });

  it('handles back press', () => {
    const onBackPress = jest.fn();
    const { getByText } = render(<MyRecipesScreen onBackPress={onBackPress} />);

    fireEvent.press(getByText('← Back'));

    expect(onBackPress).toHaveBeenCalled();
  });

  it('shows offline banner when disconnected', () => {
    (useNetworkStatus as jest.Mock).mockReturnValue({ isConnected: false });

    const { getByText } = render(<MyRecipesScreen onBackPress={jest.fn()} />);

    expect(getByText(/Offline Mode - Personal recipes available from local storage/)).toBeTruthy();
  });

  it('opens create collection modal from button', async () => {
    (usePersonalRecipes as jest.Mock).mockReturnValue({
      ...baseHookState,
      collections: [{ id: 'c1', name: 'Favorites', icon: '⭐', recipeCount: 1 }],
    });

    const { getByText, getByTestId } = render(
      <MyRecipesScreen onBackPress={jest.fn()} />
    );

    fireEvent.press(getByText('+ New Collection'));

    await waitFor(() => {
      expect(getByTestId('create-collection-modal')).toBeTruthy();
    });
  });

  it('filters recipes by search query', async () => {
    (usePersonalRecipes as jest.Mock).mockReturnValue({
      ...baseHookState,
      recipes: [
        { id: 'r1', name: 'Chicken Soup', cookingTime: 10, difficulty: 'beginner', cuisineType: 'american', tags: [], personalMetadata: { collections: [], dateAdded: new Date().toISOString() } },
        { id: 'r2', name: 'Beef Stew', cookingTime: 20, difficulty: 'beginner', cuisineType: 'american', tags: [], personalMetadata: { collections: [], dateAdded: new Date().toISOString() } },
      ],
    });

    const { getByTestId, queryByTestId } = render(
      <MyRecipesScreen onBackPress={jest.fn()} />
    );

    fireEvent.press(getByTestId('search-change'));

    await waitFor(() => {
      expect(queryByTestId('recipe-r1')).toBeTruthy();
      expect(queryByTestId('recipe-r2')).toBeNull();
    });
  });

  it('toggles collection selection', async () => {
    (usePersonalRecipes as jest.Mock).mockReturnValue({
      ...baseHookState,
      recipes: [
        { id: 'r1', name: 'Chicken Soup', cookingTime: 10, difficulty: 'beginner', cuisineType: 'american', tags: [], personalMetadata: { collections: ['c1'], dateAdded: new Date().toISOString() } },
      ],
      collections: [{ id: 'c1', name: 'Favorites', icon: 'F', recipeCount: 1 }],
    });

    const { getByTestId, getByText } = render(
      <MyRecipesScreen onBackPress={jest.fn()} />
    );

    fireEvent.press(getByTestId('collection-c1'));

    await waitFor(() => {
      expect(getByText('Chicken Soup')).toBeTruthy();
    });
  });

  it('handles favorite error', async () => {
    const toggleFavorite = jest.fn().mockRejectedValue(new Error('fail'));
    (usePersonalRecipes as jest.Mock).mockReturnValue({
      ...baseHookState,
      toggleFavorite,
      recipes: [
        { id: 'r1', name: 'Chicken Soup', cookingTime: 10, difficulty: 'beginner', cuisineType: 'american', tags: [], personalMetadata: { collections: [], dateAdded: new Date().toISOString() } },
      ],
    });

    const { getByTestId } = render(
      <MyRecipesScreen onBackPress={jest.fn()} />
    );

    fireEvent.press(getByTestId('recipe-r1'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalled();
    });
  });
});
