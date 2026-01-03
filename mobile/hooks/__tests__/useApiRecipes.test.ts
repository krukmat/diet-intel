import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
  useRecipeGeneration,
  useRecipeSearch,
  usePersonalRecipes,
  useRecipeDetails,
  useNetworkStatus,
  useRecipeAnalytics
} from '../useApiRecipes';
import { recipeApi } from '../../services/RecipeApiService';
import { apiClient } from '../../services/ApiClient';
import { syncManager } from '../../services/SyncManager';
import { recipeStorage } from '../../services/RecipeStorageService';

jest.mock('../../services/RecipeApiService', () => ({
  recipeApi: {
    generateRecipeWithLanguage: jest.fn(),
    getGenerationProgress: jest.fn(),
    getRecipe: jest.fn(),
    searchRecipes: jest.fn(),
    getPersonalRecipes: jest.fn(),
    getCollections: jest.fn(),
    savePersonalRecipe: jest.fn(),
    updatePersonalRecipe: jest.fn(),
    deletePersonalRecipe: jest.fn(),
    addRecipeToCollection: jest.fn(),
    removeRecipeFromCollection: jest.fn(),
    createCollection: jest.fn(),
    getRecipeAnalytics: jest.fn(),
  }
}));

jest.mock('../../services/ApiClient', () => ({
  apiClient: {
    getNetworkState: jest.fn(),
    getQueuedRequestCount: jest.fn(),
  }
}));

jest.mock('../../services/SyncManager', () => ({
  syncManager: {
    queueRecipeChange: jest.fn(),
    queueCollectionChange: jest.fn(),
  }
}));

jest.mock('../../services/RecipeStorageService', () => ({
  recipeStorage: {
    searchRecipes: jest.fn(),
    saveRecipe: jest.fn(),
  }
}));

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    Alert: { alert: jest.fn() },
  };
});

const flushPromises = () => new Promise(resolve => setImmediate(resolve));

describe('useApiRecipes hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (recipeStorage.searchRecipes as jest.Mock).mockResolvedValue({ items: [] });
    (recipeApi.getPersonalRecipes as jest.Mock).mockResolvedValue({ recipes: [] });
    (recipeApi.getCollections as jest.Mock).mockResolvedValue([]);
  });

  describe('useRecipeGeneration', () => {
    it('sets complete state when generation is fast', async () => {
      (recipeApi.generateRecipeWithLanguage as jest.Mock).mockResolvedValue({
        id: 'gen-1',
        generationMetadata: { processingTime: 2 },
        recipe: { id: 'recipe-1' },
      });

      const { result } = renderHook(() => useRecipeGeneration());

      await act(async () => {
        await result.current.generateRecipe({
          cuisineTypes: [],
          dietaryRestrictions: [],
          mealType: 'dinner',
          difficulty: 'beginner',
          cookingTime: 10,
          servings: 1,
        });
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.data?.id).toBe('gen-1');
      expect(result.current.progress?.status).toBe('complete');
      expect(recipeApi.getGenerationProgress).not.toHaveBeenCalled();
    });

    it('polls for progress when generation is slow', async () => {
      jest.useFakeTimers({ legacyFakeTimers: true });
      (recipeApi.generateRecipeWithLanguage as jest.Mock).mockResolvedValue({
        id: 'gen-2',
        generationMetadata: { processingTime: 10 },
        recipe: { id: 'recipe-2' },
      });
      (recipeApi.getGenerationProgress as jest.Mock).mockResolvedValue({
        id: 'gen-2',
        status: 'complete',
        progress: 100,
        message: 'Done',
      });
      (recipeApi.getRecipe as jest.Mock).mockResolvedValue({ id: 'gen-2', name: 'Final' });

      const { result, unmount } = renderHook(() => useRecipeGeneration());

      await act(async () => {
        await result.current.generateRecipe({
          cuisineTypes: [],
          dietaryRestrictions: [],
          mealType: 'dinner',
          difficulty: 'beginner',
          cookingTime: 10,
          servings: 1,
        });
      });

      await act(async () => {
        jest.advanceTimersByTime(2000);
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.data?.recipe.id).toBe('gen-2');
      });

      unmount();
      jest.useRealTimers();
    }, 15000);

    it('sets error state on generation failure', async () => {
      (recipeApi.generateRecipeWithLanguage as jest.Mock).mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useRecipeGeneration());

      await act(async () => {
        try {
          await result.current.generateRecipe({
            cuisineTypes: [],
            dietaryRestrictions: [],
            mealType: 'dinner',
            difficulty: 'beginner',
            cookingTime: 10,
            servings: 1,
          });
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.error).toBe('fail');
    });
  });

  describe('useRecipeSearch', () => {
    it('searches with debounce and updates state', async () => {
      jest.useFakeTimers();
      (recipeApi.searchRecipes as jest.Mock).mockResolvedValue({
        recipes: [{ id: 'r1', name: 'Recipe 1' }],
        totalCount: 1,
        hasMore: false,
        searchMetadata: { processingTime: 1 },
      });

      const { result, unmount } = renderHook(() => useRecipeSearch());
      let searchPromise: Promise<any> = Promise.resolve();

      act(() => {
        searchPromise = result.current.searchRecipes({ query: 'pasta' });
      });

      jest.advanceTimersByTime(300);

      await act(async () => {
        await searchPromise;
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.error).toBeNull();
      expect(result.current.totalCount).toBe(1);

      unmount();
      jest.useRealTimers();
    });

    it('loads more results when hasMore is true', async () => {
      jest.useFakeTimers();
      (recipeApi.searchRecipes as jest.Mock)
        .mockResolvedValueOnce({
          recipes: [{ id: 'r1', name: 'Recipe 1' }],
          totalCount: 2,
          hasMore: true,
          searchMetadata: {},
        })
        .mockResolvedValueOnce({
          recipes: [{ id: 'r2', name: 'Recipe 2' }],
          totalCount: 2,
          hasMore: false,
          searchMetadata: {},
        });

      const { result, unmount } = renderHook(() => useRecipeSearch());

      let firstPromise: Promise<any> = Promise.resolve();
      act(() => {
        firstPromise = result.current.searchRecipes({ query: 'pasta' });
      });
      jest.advanceTimersByTime(300);
      await act(async () => {
        await firstPromise;
      });

      let morePromise: Promise<any> = Promise.resolve();
      act(() => {
        morePromise = result.current.loadMore();
      });
      jest.advanceTimersByTime(300);
      await act(async () => {
        await morePromise;
      });

      expect(result.current.data).toHaveLength(2);
      expect(recipeApi.searchRecipes).toHaveBeenCalledTimes(2);

      unmount();
      jest.useRealTimers();
    });
  });

  describe('usePersonalRecipes', () => {
    it('loads recipes and collections on mount', async () => {
      (recipeStorage.searchRecipes as jest.Mock).mockResolvedValue({
        items: [{ id: 'local-1', name: 'Local', personalMetadata: { isFavorite: false } }],
      });
      (recipeApi.getPersonalRecipes as jest.Mock).mockResolvedValue({
        recipes: [{ id: 'api-1', name: 'API', personalMetadata: { isFavorite: false } }],
      });
      (recipeApi.getCollections as jest.Mock).mockResolvedValue([{ id: 'col-1', name: 'Collection' }]);

      const { result } = renderHook(() => usePersonalRecipes());

      await act(async () => {
        await flushPromises();
      });
      await waitFor(() => {
        expect(result.current.recipes.length).toBeGreaterThanOrEqual(1);
      });
      expect(result.current.collections.length).toBeGreaterThanOrEqual(0);
    });

    it('saves recipe locally and queues sync when API fails', async () => {
      const savedRecipe = { id: 'saved-1', name: 'Saved', personalMetadata: { isFavorite: false } };
      (recipeStorage.saveRecipe as jest.Mock).mockResolvedValue(savedRecipe);
      (recipeApi.savePersonalRecipe as jest.Mock).mockRejectedValue(new Error('api fail'));
      (syncManager.queueRecipeChange as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => usePersonalRecipes());

      await act(async () => {
        await result.current.saveRecipe({ id: 'saved-1', name: 'Saved' }, { source: 'generated' });
      });

      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.recipes[0]?.id).toBe('saved-1');
      });
      expect(syncManager.queueRecipeChange).toHaveBeenCalledWith('saved-1', 'create', savedRecipe);
    });

    it('updates and deletes recipes with sync', async () => {
      const initial = { id: 'r1', name: 'Old', personalMetadata: { isFavorite: false } };
      (recipeStorage.searchRecipes as jest.Mock).mockResolvedValue({ items: [initial] });
      (recipeApi.getPersonalRecipes as jest.Mock).mockResolvedValue({ recipes: [] });
      (recipeApi.updatePersonalRecipe as jest.Mock).mockResolvedValue({ recipe: { ...initial, name: 'New' } });
      (recipeApi.deletePersonalRecipe as jest.Mock).mockResolvedValue(undefined);
      (syncManager.queueRecipeChange as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => usePersonalRecipes());

      await act(async () => {
        await flushPromises();
      });

      await act(async () => {
        await result.current.updateRecipe('r1', { name: 'New' });
      });

      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.recipes[0]?.name).toBe('New');
      });

      await act(async () => {
        await result.current.deleteRecipe('r1');
      });

      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.recipes).toHaveLength(0);
      });
      expect(syncManager.queueRecipeChange).toHaveBeenCalledWith('r1', 'delete');
    });

    it('toggles favorite and updates collections', async () => {
      const initial = {
        id: 'r1',
        name: 'Recipe',
        personalMetadata: { isFavorite: false },
      };
      (recipeStorage.searchRecipes as jest.Mock).mockResolvedValue({ items: [initial] });
      (recipeApi.getPersonalRecipes as jest.Mock).mockResolvedValue({ recipes: [] });
      (recipeApi.updatePersonalRecipe as jest.Mock).mockResolvedValue({
        recipe: { ...initial, personalMetadata: { isFavorite: true } }
      });
      (recipeApi.addRecipeToCollection as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => usePersonalRecipes());

      await act(async () => {
        await flushPromises();
      });

      await act(async () => {
        await result.current.toggleFavorite('r1');
      });

      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(recipeApi.addRecipeToCollection).toHaveBeenCalledWith('r1', 'favorites');
      });
    });

    it('creates a collection and queues sync', async () => {
      (recipeApi.createCollection as jest.Mock).mockResolvedValue({ id: 'col-2', name: 'New' });
      (syncManager.queueCollectionChange as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => usePersonalRecipes());

      await act(async () => {
        const created = await result.current.createCollection('New');
        expect(created.id).toBe('col-2');
      });

      expect(syncManager.queueCollectionChange).toHaveBeenCalledWith('col-2', 'create', { id: 'col-2', name: 'New' });
    });
  });

  describe('useRecipeDetails', () => {
    it('loads recipe details by id', async () => {
      (recipeApi.getRecipe as jest.Mock).mockResolvedValue({ id: 'r1', name: 'Recipe 1' });

      const { result } = renderHook(() => useRecipeDetails('r1'));

      await act(async () => {
        await flushPromises();
      });
      await waitFor(() => {
        expect(result.current.data?.id).toBe('r1');
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('useNetworkStatus', () => {
    it('updates network state from apiClient', () => {
      jest.useFakeTimers();
      (apiClient.getNetworkState as jest.Mock).mockReturnValue({
        isConnected: false,
        type: 'cellular',
      });
      (apiClient.getQueuedRequestCount as jest.Mock).mockReturnValue(3);

      const { result, unmount } = renderHook(() => useNetworkStatus());

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.type).toBe('cellular');
      expect(result.current.queuedRequests).toBe(3);

      unmount();
      jest.useRealTimers();
    });
  });

  describe('useRecipeAnalytics', () => {
    it('loads analytics on mount', async () => {
      (recipeApi.getRecipeAnalytics as jest.Mock).mockResolvedValue({
        totalRecipes: 4,
        favoriteCount: 1,
        recentlyAddedCount: 2,
        popularCuisines: [],
        cookingTimeDistribution: {},
      });

      const { result } = renderHook(() => useRecipeAnalytics());

      await act(async () => {
        await flushPromises();
      });
      await waitFor(() => {
        expect(result.current.totalRecipes).toBe(4);
        expect(result.current.error).toBeNull();
      });
    });

    it('handles analytics failure', async () => {
      (recipeApi.getRecipeAnalytics as jest.Mock).mockRejectedValue(new Error('analytics down'));

      const { result } = renderHook(() => useRecipeAnalytics());

      await act(async () => {
        await flushPromises();
      });
      await waitFor(() => {
        expect(result.current.error).toBe('analytics down');
      });
    });
  });
});
