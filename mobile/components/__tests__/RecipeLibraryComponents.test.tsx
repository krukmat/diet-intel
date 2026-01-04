import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import {
  CollectionCard,
  PersonalRecipeCard,
  LibrarySearchBar,
  CollectionSelectorModal,
  CreateCollectionModal,
  RecipeManagementModal,
  LibraryStats,
  BackupExportModal,
  EmptyLibraryState,
} from '../RecipeLibraryComponents';

const collection = {
  id: 'c1',
  name: 'Favorites',
  description: 'Top picks',
  color: '#FF0000',
  icon: '❤️',
  isSystem: true,
  sortOrder: 1,
};

const recipe = {
  id: 'r1',
  name: 'Pasta',
  imageUrl: '',
  cookingTime: 20,
  personalRating: 4.5,
  isFavorite: true,
};

describe('CollectionCard', () => {
  it('renders and triggers press handlers', () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    const { getByText } = render(
      <CollectionCard
        collection={collection as any}
        recipeCount={2}
        onPress={onPress}
        onLongPress={onLongPress}
        isSelected={true}
      />
    );

    fireEvent.press(getByText('Favorites'));
    fireEvent(getByText('Favorites'), 'longPress');

    expect(onPress).toHaveBeenCalled();
    expect(onLongPress).toHaveBeenCalled();
    expect(getByText('2 recipes')).toBeTruthy();
    expect(getByText('System')).toBeTruthy();
  });
});

describe('PersonalRecipeCard', () => {
  it('renders list view actions', () => {
    const onPress = jest.fn();
    const onFavorite = jest.fn();
    const onShare = jest.fn();
    const onAddToMealPlan = jest.fn();

    const { getByText } = render(
      <PersonalRecipeCard
        recipe={recipe as any}
        viewMode="list"
        onPress={onPress}
        onFavorite={onFavorite}
        onShare={onShare}
        onAddToMealPlan={onAddToMealPlan}
      />
    );

    fireEvent.press(getByText('Pasta'));
    fireEvent.press(getByText('❤️'));
    fireEvent.press(getByText('📤 Share'));
    fireEvent.press(getByText('📅 Add to Plan'));

    expect(onPress).toHaveBeenCalled();
    expect(onFavorite).toHaveBeenCalledWith('r1');
    expect(onShare).toHaveBeenCalled();
    expect(onAddToMealPlan).toHaveBeenCalled();
  });
});

describe('LibrarySearchBar', () => {
  it('handles search and filters', () => {
    const onSearchChange = jest.fn();
    const onFilterPress = jest.fn();
    const onSortPress = jest.fn();

    const { getByPlaceholderText, getByText } = render(
      <LibrarySearchBar
        searchQuery=""
        onSearchChange={onSearchChange}
        onFilterPress={onFilterPress}
        onSortPress={onSortPress}
        activeFiltersCount={2}
        currentSort={{ field: 'name', direction: 'asc' } as any}
        loading={true}
      />
    );

    fireEvent.changeText(getByPlaceholderText('Search your recipes...'), 'pa');
    fireEvent.press(getByText('🎛️ Filter (2)'));
    fireEvent.press(getByText('↕️ name ↑'));

    expect(onSearchChange).toHaveBeenCalledWith('pa');
    expect(onFilterPress).toHaveBeenCalled();
    expect(onSortPress).toHaveBeenCalled();
  });
});

describe('CollectionSelectorModal', () => {
  it('toggles collection selection', () => {
    const onSelectionChange = jest.fn();
    const { getByText } = render(
      <CollectionSelectorModal
        visible={true}
        onClose={jest.fn()}
        collections={[collection as any]}
        selectedCollections={[]}
        onSelectionChange={onSelectionChange}
        onCreateNew={jest.fn()}
      />
    );

    fireEvent.press(getByText('Favorites'));
    expect(onSelectionChange).toHaveBeenCalledWith(['c1']);
  });
});

describe('CreateCollectionModal', () => {
  it('submits new collection', () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <CreateCollectionModal visible={true} onClose={jest.fn()} onSubmit={onSubmit} />
    );

    fireEvent.changeText(getByPlaceholderText('Enter collection name'), 'Weekend');
    fireEvent.press(getByText('Create'));

    expect(onSubmit).toHaveBeenCalledWith('Weekend', '', '#007AFF', '📁');
  });
});

describe('RecipeManagementModal', () => {
  it('handles delete action', () => {
    const onDelete = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_, __, buttons) => {
      buttons?.[1]?.onPress?.();
    });

    const { getByText } = render(
      <RecipeManagementModal
        visible={true}
        onClose={jest.fn()}
        recipe={recipe as any}
        onEdit={jest.fn()}
        onShare={jest.fn()}
        onExport={jest.fn()}
        onDelete={onDelete}
        onDuplicate={jest.fn()}
        onAddToMealPlan={jest.fn()}
      />
    );

    fireEvent.press(getByText('Delete Recipe'));
    expect(onDelete).toHaveBeenCalledWith('r1');
    alertSpy.mockRestore();
  });
});

describe('LibraryStats', () => {
  it('renders stat cards', () => {
    const { getByText } = render(
      <LibraryStats
        totalRecipes={10}
        favoriteCount={2}
        recentlyAddedCount={1}
        mostCookedRecipe="Pasta"
      />
    );

    expect(getByText('10')).toBeTruthy();
    expect(getByText('Pasta')).toBeTruthy();
  });
});

describe('BackupExportModal', () => {
  it('triggers backup and export actions', () => {
    const onBackupAll = jest.fn();
    const onExportCollection = jest.fn();
    const onImportRecipes = jest.fn();

    const component = TestRenderer.create(
      <BackupExportModal
        visible={true}
        onClose={jest.fn()}
        onBackupAll={onBackupAll}
        onExportCollection={onExportCollection}
        onImportRecipes={onImportRecipes}
        collections={[collection as any]}
      />
    );

    const actions = component.root.findAll(
      (node) => typeof node.props?.onPress === 'function'
    );

    actions.find((node) => node.findAll?.((child: any) => child.children?.includes('💾 Create Full Backup')).length)?.props.onPress();
    actions.find((node) => node.findAll?.((child: any) => child.children?.includes('Favorites')).length)?.props.onPress();
    actions.find((node) => node.findAll?.((child: any) => child.children?.includes('📥 Import Recipes')).length)?.props.onPress();

    expect(onBackupAll).toHaveBeenCalled();
    expect(onExportCollection).toHaveBeenCalledWith('c1');
    expect(onImportRecipes).toHaveBeenCalled();
  });
});

describe('EmptyLibraryState', () => {
  it('renders empty state action', () => {
    const onAction = jest.fn();
    const { getByText } = render(
      <EmptyLibraryState
        title="No Recipes"
        message="Add your first recipe"
        actionText="Create Recipe"
        onAction={onAction}
      />
    );

    fireEvent.press(getByText('Create Recipe'));
    expect(onAction).toHaveBeenCalled();
  });
});
