import AsyncStorage from '@react-native-async-storage/async-storage';
import { recipeStorage, RecipeStorageService } from '../RecipeStorageService';
import { SYSTEM_COLLECTIONS } from '../../types/RecipeTypes';

const baseRecipe = {
  id: 'recipe-1',
  name: 'Test Recipe',
  imageUrl: 'https://example.com/1.png',
  cookingTime: 30,
  ingredients: [
    { name: 'Oats', amount: '1 cup' },
  ],
  instructions: ['Mix', 'Cook'],
};

describe('RecipeStorageService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    recipeStorage.clearCache();
  });

  it('initializes system collections when missing', async () => {
    await recipeStorage.initialize();
    const stored = await AsyncStorage.getItem('@collections/v2');
    expect(stored).toBeTruthy();
    const collections = JSON.parse(stored as string);
    expect(collections.find((item: any) => item.id === SYSTEM_COLLECTIONS.FAVORITES)).toBeTruthy();
  });

  it('saves and retrieves recipes with metadata', async () => {
    const saved = await recipeStorage.saveRecipe(baseRecipe, 'custom');
    expect(saved.personalMetadata.source).toBe('custom');

    const fetched = await recipeStorage.getRecipe('recipe-1');
    expect(fetched?.name).toBe('Test Recipe');
  });

  it('updates and deletes recipes', async () => {
    await recipeStorage.saveRecipe(baseRecipe, 'custom');
    const updated = await recipeStorage.updateRecipe('recipe-1', { name: 'Updated' });
    expect(updated.name).toBe('Updated');

    await recipeStorage.deleteRecipe('recipe-1');
    const fetched = await recipeStorage.getRecipe('recipe-1');
    expect(fetched).toBeNull();
  });

  it('throws when updating missing recipes', async () => {
    await expect(recipeStorage.updateRecipe('missing', { name: 'Nope' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('searches recipes with filters and sorting', async () => {
    await recipeStorage.saveRecipe({ ...baseRecipe, id: 'r1', name: 'Apple', cookingTime: 10 }, 'custom');
    await recipeStorage.saveRecipe({ ...baseRecipe, id: 'r2', name: 'Banana', cookingTime: 20 }, 'custom');

    const result = await recipeStorage.searchRecipes(
      { collections: [SYSTEM_COLLECTIONS.CUSTOM_RECIPES] },
      { field: 'name', direction: 'asc' },
      1,
      10
    );

    expect(result.items[0].name).toBe('Apple');
    expect(result.totalCount).toBe(2);
  });

  it('creates collections and updates recipes collections', async () => {
    await recipeStorage.saveRecipe(baseRecipe, 'custom');
    const collection = await recipeStorage.createCollection('My Collection');
    await recipeStorage.addToCollection('recipe-1', collection.id);

    const recipe = await recipeStorage.getRecipe('recipe-1');
    expect(recipe?.collections.includes(collection.id)).toBe(true);

    await recipeStorage.removeFromCollection('recipe-1', collection.id);
    const updated = await recipeStorage.getRecipe('recipe-1');
    expect(updated?.collections.includes(collection.id)).toBe(false);
  });

  it('provides cache stats', async () => {
    await recipeStorage.saveRecipe(baseRecipe, 'custom');
    const stats = recipeStorage.getCacheStats();
    expect(stats.recipesCached).toBeGreaterThan(0);
  });

  it('handles collection fetch errors', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('fail'));
    const collections = await recipeStorage.getCollections();
    expect(collections).toEqual([]);
  });

  it('supports multiple instances in tests', async () => {
    (RecipeStorageService as any).instance = undefined;
    const instance = RecipeStorageService.getInstance();
    await instance.initialize();
    expect(instance).toBeDefined();
    (RecipeStorageService as any).instance = recipeStorage;
  });
});
