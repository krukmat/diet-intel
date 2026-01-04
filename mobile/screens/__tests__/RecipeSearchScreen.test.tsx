import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RecipeSearchScreen from '../RecipeSearchScreen';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    FlatList: ({ data, renderItem, ...rest }: any) => (
      <actual.View {...rest}>
        {data.map((item: any) => (
          <actual.View key={item.id}>{renderItem({ item })}</actual.View>
        ))}
      </actual.View>
    ),
  };
});

jest.mock('../../components/RecipeSearchComponents', () => {
  const React = require('react');
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    SearchBar: ({ searchQuery, onSearchChange, onVoiceSearch, onCameraSearch, onSuggestionSelect }: any) => (
      <View>
        <Text testID="search-query">{searchQuery}</Text>
        <TouchableOpacity testID="voice-search" onPress={onVoiceSearch}>
          <Text>Voice</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="camera-search" onPress={onCameraSearch}>
          <Text>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="suggestion" onPress={() => onSuggestionSelect('suggested')}>
          <Text>Suggestion</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="search-change" onPress={() => onSearchChange('pasta')}>
          <Text>Change</Text>
        </TouchableOpacity>
      </View>
    ),
    QuickFilters: ({ onFilterRemove, onClearAll, onQuickFilterSelect }: any) => (
      <View>
        <TouchableOpacity testID="filter-remove" onPress={() => onFilterRemove('cuisineTypes')}>
          <Text>Remove</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="filter-clear" onPress={onClearAll}>
          <Text>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="filter-quick" onPress={() => onQuickFilterSelect('difficulty', ['beginner'])}>
          <Text>Quick</Text>
        </TouchableOpacity>
      </View>
    ),
    FilterModal: ({ visible, onClose, onApplyFilters }: any) => (
      <View testID={visible ? 'filter-open' : 'filter-closed'}>
        <TouchableOpacity testID="filter-close" onPress={onClose}>
          <Text>Close</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="filter-apply" onPress={onApplyFilters}>
          <Text>Apply</Text>
        </TouchableOpacity>
      </View>
    ),
    RecipeCard: ({ recipe, onPress, onSave, onShare }: any) => (
      <View>
        <TouchableOpacity testID={`recipe-${recipe.id}`} onPress={onPress}>
          <Text>{recipe.name}</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`save-${recipe.id}`} onPress={onSave}>
          <Text>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`share-${recipe.id}`} onPress={onShare}>
          <Text>Share</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock('../../hooks/useApiRecipes', () => ({
  useRecipeSearch: jest.fn(),
  useNetworkStatus: jest.fn(),
}));

const { useRecipeSearch, useNetworkStatus } = jest.requireMock('../../hooks/useApiRecipes');

describe('RecipeSearchScreen', () => {
  const searchRecipes = jest.fn();
  const loadMore = jest.fn();
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNetworkStatus as jest.Mock).mockReturnValue({ isConnected: true, queuedRequests: 0 });
    (useRecipeSearch as jest.Mock).mockReturnValue({
      searchRecipes,
      data: [],
      loading: false,
      error: null,
      hasMore: false,
      totalCount: 0,
      searchMetadata: null,
      loadMore,
      refresh,
      isSearching: false,
    });
  });

  it('triggers initial search and handles view toggle', async () => {
    const { getByText } = render(<RecipeSearchScreen onBackPress={jest.fn()} />);

    await waitFor(() => {
      expect(searchRecipes).toHaveBeenCalled();
    });

    fireEvent.press(getByText('☰'));
    expect(getByText('⊞')).toBeTruthy();
  });

  it('handles offline search with alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (useNetworkStatus as jest.Mock).mockReturnValue({ isConnected: false, queuedRequests: 2 });

    const { getByTestId } = render(<RecipeSearchScreen onBackPress={jest.fn()} />);

    fireEvent.press(getByTestId('search-change'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
  });

  it('handles suggestion and filters', () => {
    const { getByTestId } = render(<RecipeSearchScreen onBackPress={jest.fn()} />);

    fireEvent.press(getByTestId('suggestion'));
    fireEvent.press(getByTestId('filter-quick'));
    fireEvent.press(getByTestId('filter-remove'));
    fireEvent.press(getByTestId('filter-clear'));
  });

  it('renders recipe cards and supports save/share', () => {
    (useRecipeSearch as jest.Mock).mockReturnValue({
      searchRecipes,
      data: [{ id: 'r1', name: 'Recipe 1' }],
      loading: false,
      error: null,
      hasMore: false,
      totalCount: 1,
      searchMetadata: null,
      loadMore,
      refresh,
      isSearching: false,
    });

    const { getByTestId } = render(<RecipeSearchScreen onBackPress={jest.fn()} />);

    fireEvent.press(getByTestId('recipe-r1'));
    fireEvent.press(getByTestId('share-r1'));
    fireEvent.press(getByTestId('save-r1'));

    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('opens and closes filter modal', () => {
    const { getByText, getByTestId } = render(<RecipeSearchScreen onBackPress={jest.fn()} />);

    fireEvent.press(getByText('🎛️ More Filters'));
    expect(getByTestId('filter-open')).toBeTruthy();

    fireEvent.press(getByTestId('filter-close'));
    expect(getByTestId('filter-closed')).toBeTruthy();
  });
});
