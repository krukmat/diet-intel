import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import {
  SearchBar,
  QuickFilters,
  FilterModal,
  RecipeCard,
} from '../RecipeSearchComponents';

const baseRecipe = {
  id: 'r1',
  name: 'Test Recipe',
  description: 'Tasty and quick',
  cookingTime: 20,
  rating: 4.5,
  totalRatings: 120,
  difficulty: 'Beginner',
  calories: 350,
  tags: ['easy', 'quick', 'healthy'],
};

describe('SearchBar', () => {
  it('handles search input and suggestion selection', () => {
    jest.useFakeTimers();
    const onSearchChange = jest.fn();
    const onSuggestionSelect = jest.fn();

    const { getByPlaceholderText, getByText, queryByText } = render(
      <SearchBar
        searchQuery="ch"
        onSearchChange={onSearchChange}
        onVoiceSearch={jest.fn()}
        onCameraSearch={jest.fn()}
        suggestions={['chicken', 'chili']}
        searchHistory={[]}
        onSuggestionSelect={onSuggestionSelect}
        loading={false}
      />
    );

    fireEvent.changeText(getByPlaceholderText('Search recipes...'), 'chi');
    expect(onSearchChange).toHaveBeenCalledWith('chi');

    fireEvent(getByPlaceholderText('Search recipes...'), 'focus');
    expect(getByText('Suggestions')).toBeTruthy();

    fireEvent.press(getByText('chicken'));
    expect(onSuggestionSelect).toHaveBeenCalledWith('chicken');

    act(() => {
      fireEvent(getByPlaceholderText('Search recipes...'), 'blur');
      jest.runOnlyPendingTimers();
    });

    expect(queryByText('Suggestions')).toBeNull();
    jest.useRealTimers();
  });

  it('triggers voice and camera actions', () => {
    const onVoiceSearch = jest.fn();
    const onCameraSearch = jest.fn();

    const { getByText } = render(
      <SearchBar
        searchQuery=""
        onSearchChange={jest.fn()}
        onVoiceSearch={onVoiceSearch}
        onCameraSearch={onCameraSearch}
        suggestions={[]}
        searchHistory={[]}
        onSuggestionSelect={jest.fn()}
        loading={true}
      />
    );

    fireEvent.press(getByText('🎤'));
    fireEvent.press(getByText('📷'));

    expect(onVoiceSearch).toHaveBeenCalled();
    expect(onCameraSearch).toHaveBeenCalled();
  });
});

describe('QuickFilters', () => {
  it('renders active filters and clears them', () => {
    const onFilterRemove = jest.fn();
    const onClearAll = jest.fn();
    const onQuickFilterSelect = jest.fn();

    const { getByText, getAllByText } = render(
      <QuickFilters
        activeFilters={{
          cuisine: ['italian', 'mexican'],
          difficulty: 'easy',
        }}
        onFilterRemove={onFilterRemove}
        onClearAll={onClearAll}
        quickFilterOptions={[
          { key: 'difficulty', label: 'Easy', value: 'easy' },
        ]}
        onQuickFilterSelect={onQuickFilterSelect}
      />
    );

    fireEvent.press(getAllByText('✕')[0]);
    expect(onFilterRemove).toHaveBeenCalledWith('cuisine');

    fireEvent.press(getByText('Clear All'));
    expect(onClearAll).toHaveBeenCalled();

    fireEvent.press(getByText('Easy'));
    expect(onQuickFilterSelect).toHaveBeenCalledWith('difficulty', 'easy');
  });
});

describe('FilterModal', () => {
  it('updates filters and applies', () => {
    const onFiltersChange = jest.fn();
    const onApplyFilters = jest.fn();
    const onClose = jest.fn();

    const { getByText } = render(
      <FilterModal
        visible={true}
        onClose={onClose}
        filters={{}}
        onFiltersChange={onFiltersChange}
        onApplyFilters={onApplyFilters}
        onClearFilters={jest.fn()}
      />
    );

    fireEvent.press(getByText('🥗 Dietary Restrictions'));
    fireEvent.press(getByText('🥬 Vegetarian'));
    fireEvent.press(getByText('Apply Filters'));

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dietaryRestrictions: ['vegetarian'],
      })
    );
    expect(onApplyFilters).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('clears filters', () => {
    const onClearFilters = jest.fn();
    const { getByText } = render(
      <FilterModal
        visible={true}
        onClose={jest.fn()}
        filters={{ calories: { min: 100, max: 500 } }}
        onFiltersChange={jest.fn()}
        onApplyFilters={jest.fn()}
        onClearFilters={onClearFilters}
      />
    );

    fireEvent.press(getByText('Clear'));
    expect(onClearFilters).toHaveBeenCalled();
  });
});

describe('RecipeCard', () => {
  it('renders list view and handles actions', () => {
    const onPress = jest.fn();
    const onSave = jest.fn();
    const onShare = jest.fn();

    const { getByText } = render(
      <RecipeCard
        recipe={baseRecipe as any}
        onPress={onPress}
        onSave={onSave}
        onShare={onShare}
        isFavorited={false}
        viewMode="list"
      />
    );

    fireEvent.press(getByText('Test Recipe'));
    fireEvent.press(getByText('🤍'));
    fireEvent.press(getByText('🔗'));

    expect(onPress).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
    expect(onShare).toHaveBeenCalled();
  });

  it('renders grid view with tags', () => {
    const { getByText } = render(
      <RecipeCard
        recipe={baseRecipe as any}
        onPress={jest.fn()}
        onSave={jest.fn()}
        onShare={jest.fn()}
        isFavorited={true}
        viewMode="grid"
      />
    );

    expect(getByText('easy')).toBeTruthy();
    expect(getByText('+1')).toBeTruthy();
    expect(getByText('❤️')).toBeTruthy();
  });
});
