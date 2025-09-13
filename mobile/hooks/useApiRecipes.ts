// Custom React Hooks for Recipe API Integration
// Provides optimized, reusable hooks for all recipe-related API operations

import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { 
  recipeApi, 
  RecipeGenerationRequest, 
  RecipeSearchRequest, 
  GenerationProgress,
  RecipeGenerationResponse,
  RecipeSearchResponse,
} from '../services/RecipeApiService';
import { BaseRecipe, PersonalRecipe, RecipeCollection } from '../types/RecipeTypes';
import { apiClient } from '../services/ApiClient';
import { syncManager } from '../services/SyncManager';

// Hook State Types
interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

interface PaginatedApiState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  retry: () => void;
}

// Recipe Generation Hook
export function useRecipeGeneration() {
  const [state, setState] = useState<{
    data: RecipeGenerationResponse | null;
    loading: boolean;
    error: string | null;
    progress: GenerationProgress | null;
  }>({
    data: null,
    loading: false,
    error: null,
    progress: null,
  });

  const generationTimeoutRef = useRef<NodeJS.Timeout>();
  const progressIntervalRef = useRef<NodeJS.Timeout>();

  const generateRecipe = useCallback(async (request: RecipeGenerationRequest) => {
    setState(prev => ({ ...prev, loading: true, error: null, data: null, progress: null }));

    try {
      // Start the generation request
      const response = await recipeApi.generateRecipe(request);
      
      // If we get an immediate response, we're done
      if (response.generationMetadata.processingTime < 5) {
        setState(prev => ({
          ...prev,
          loading: false,
          data: response,
          progress: {
            id: response.id,
            status: 'complete',
            progress: 100,
            message: 'Recipe generation complete!',
          },
        }));
        return response;
      }

      // Otherwise, start polling for progress
      const pollProgress = async (generationId: string) => {
        try {
          const progress = await recipeApi.getGenerationProgress(generationId);
          
          setState(prev => ({ ...prev, progress }));

          if (progress.status === 'complete') {
            // Fetch the final result
            const finalResponse = await recipeApi.getRecipe(generationId);
            setState(prev => ({
              ...prev,
              loading: false,
              data: { ...response, recipe: finalResponse },
            }));
            
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
            }
          } else if (progress.status === 'error') {
            setState(prev => ({
              ...prev,
              loading: false,
              error: progress.message || 'Recipe generation failed',
            }));
            
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
            }
          }
        } catch (progressError) {
          console.warn('Failed to fetch generation progress:', progressError);
        }
      };

      // Poll every 2 seconds for progress updates
      progressIntervalRef.current = setInterval(() => {
        pollProgress(response.id);
      }, 2000);

      // Set a timeout for the entire generation process (2 minutes)
      generationTimeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Recipe generation timed out. Please try again.',
        }));
        
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      }, 120000);

      return response;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to generate recipe',
      }));
      throw error;
    }
  }, []);

  const cancelGeneration = useCallback(() => {
    if (generationTimeoutRef.current) {
      clearTimeout(generationTimeoutRef.current);
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    setState(prev => ({
      ...prev,
      loading: false,
      error: null,
      progress: null,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (generationTimeoutRef.current) {
        clearTimeout(generationTimeoutRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  return {
    ...state,
    generateRecipe,
    cancelGeneration,
    isGenerating: state.loading,
  };
}

// Recipe Search Hook
export function useRecipeSearch() {
  const [state, setState] = useState<{
    data: BaseRecipe[];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    totalCount: number;
    searchMetadata: any;
  }>({
    data: [],
    loading: false,
    error: null,
    hasMore: false,
    totalCount: 0,
    searchMetadata: null,
  });

  const [currentRequest, setCurrentRequest] = useState<RecipeSearchRequest>({});
  const [currentPage, setCurrentPage] = useState(1);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const searchRecipes = useCallback(async (
    request: RecipeSearchRequest,
    append: boolean = false
  ) => {
    // Debounce search requests
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    return new Promise<RecipeSearchResponse>((resolve, reject) => {
      searchTimeoutRef.current = setTimeout(async () => {
        const page = append ? currentPage + 1 : 1;
        const searchRequest = { ...request, page, limit: 20 };

        setState(prev => ({
          ...prev,
          loading: true,
          error: null,
        }));

        try {
          const response = await recipeApi.searchRecipes(searchRequest);

          setState(prev => ({
            ...prev,
            loading: false,
            data: append ? [...prev.data, ...response.recipes] : response.recipes,
            hasMore: response.hasMore,
            totalCount: response.totalCount,
            searchMetadata: response.searchMetadata,
          }));

          setCurrentRequest(request);
          setCurrentPage(page);
          resolve(response);
        } catch (error: any) {
          const errorMessage = error.message || 'Failed to search recipes';
          setState(prev => ({
            ...prev,
            loading: false,
            error: errorMessage,
          }));
          reject(error);
        }
      }, 300); // 300ms debounce
    });
  }, [currentPage]);

  const loadMore = useCallback(async () => {
    if (state.loading || !state.hasMore) return;
    
    try {
      await searchRecipes(currentRequest, true);
    } catch (error) {
      console.warn('Failed to load more results:', error);
    }
  }, [state.loading, state.hasMore, currentRequest, searchRecipes]);

  const refresh = useCallback(async () => {
    try {
      setCurrentPage(1);
      await searchRecipes(currentRequest, false);
    } catch (error) {
      console.warn('Failed to refresh search:', error);
    }
  }, [currentRequest, searchRecipes]);

  const retry = useCallback(async () => {
    await refresh();
  }, [refresh]);

  return {
    ...state,
    searchRecipes,
    loadMore,
    refresh,
    retry,
    isSearching: state.loading,
  };
}

// Personal Recipe Management Hook
export function usePersonalRecipes() {
  const [state, setState] = useState<{
    recipes: PersonalRecipe[];
    collections: RecipeCollection[];
    loading: boolean;
    error: string | null;
  }>({
    recipes: [],
    collections: [],
    loading: false,
    error: null,
  });

  // Load personal recipes
  const loadRecipes = useCallback(async (
    page: number = 1, 
    filters?: Record<string, any>,
    append: boolean = false
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await recipeApi.getPersonalRecipes(page, 20, filters);

      setState(prev => ({
        ...prev,
        loading: false,
        recipes: append ? [...prev.recipes, ...response.recipes] : response.recipes,
      }));

      return response;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load personal recipes',
      }));
      throw error;
    }
  }, []);

  // Load collections
  const loadCollections = useCallback(async () => {
    try {
      const collections = await recipeApi.getCollections();
      setState(prev => ({ ...prev, collections }));
      return collections;
    } catch (error: any) {
      console.warn('Failed to load collections:', error);
      return [];
    }
  }, []);

  // Save recipe
  const saveRecipe = useCallback(async (
    recipe: Partial<BaseRecipe>,
    options: {
      collections?: string[];
      personalTags?: string[];
      notes?: string;
      source?: 'generated' | 'search' | 'custom' | 'imported';
    } = {}
  ) => {
    try {
      const response = await recipeApi.savePersonalRecipe({
        recipe,
        ...options,
      });

      // Add to local state optimistically
      setState(prev => ({
        ...prev,
        recipes: [response.recipe, ...prev.recipes],
      }));

      // Queue for sync
      await syncManager.queueRecipeChange(response.recipe.id, 'create', response.recipe);

      return response.recipe;
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save recipe');
      throw error;
    }
  }, []);

  // Update recipe
  const updateRecipe = useCallback(async (
    recipeId: string,
    updates: Partial<PersonalRecipe>
  ) => {
    try {
      const response = await recipeApi.updatePersonalRecipe(recipeId, updates);

      // Update local state optimistically
      setState(prev => ({
        ...prev,
        recipes: prev.recipes.map(recipe =>
          recipe.id === recipeId ? response.recipe : recipe
        ),
      }));

      // Queue for sync
      await syncManager.queueRecipeChange(recipeId, 'update', response.recipe);

      return response.recipe;
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update recipe');
      throw error;
    }
  }, []);

  // Delete recipe
  const deleteRecipe = useCallback(async (recipeId: string) => {
    try {
      await recipeApi.deletePersonalRecipe(recipeId);

      // Remove from local state optimistically
      setState(prev => ({
        ...prev,
        recipes: prev.recipes.filter(recipe => recipe.id !== recipeId),
      }));

      // Queue for sync
      await syncManager.queueRecipeChange(recipeId, 'delete');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete recipe');
      throw error;
    }
  }, []);

  // Toggle favorite
  const toggleFavorite = useCallback(async (recipeId: string) => {
    const recipe = state.recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const isFavorite = recipe.personalMetadata.isFavorite;
    
    try {
      await updateRecipe(recipeId, {
        personalMetadata: {
          ...recipe.personalMetadata,
          isFavorite: !isFavorite,
        },
      });

      // Handle favorites collection
      if (!isFavorite) {
        await recipeApi.addRecipeToCollection(recipeId, 'favorites');
      } else {
        await recipeApi.removeRecipeFromCollection(recipeId, 'favorites');
      }
    } catch (error: any) {
      console.warn('Failed to toggle favorite:', error);
    }
  }, [state.recipes, updateRecipe]);

  // Collection management
  const createCollection = useCallback(async (
    name: string,
    description?: string,
    color?: string,
    icon?: string
  ) => {
    try {
      const collection = await recipeApi.createCollection({
        name,
        description,
        color,
        icon,
      });

      setState(prev => ({
        ...prev,
        collections: [...prev.collections, collection],
      }));

      // Queue for sync
      await syncManager.queueCollectionChange(collection.id, 'create', collection);

      return collection;
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create collection');
      throw error;
    }
  }, []);

  const addToCollection = useCallback(async (recipeId: string, collectionId: string) => {
    try {
      await recipeApi.addRecipeToCollection(recipeId, collectionId);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add recipe to collection');
      throw error;
    }
  }, []);

  const removeFromCollection = useCallback(async (recipeId: string, collectionId: string) => {
    try {
      await recipeApi.removeRecipeFromCollection(recipeId, collectionId);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to remove recipe from collection');
      throw error;
    }
  }, []);

  // Initialize data
  useEffect(() => {
    loadRecipes();
    loadCollections();
  }, []);

  return {
    ...state,
    loadRecipes,
    loadCollections,
    saveRecipe,
    updateRecipe,
    deleteRecipe,
    toggleFavorite,
    createCollection,
    addToCollection,
    removeFromCollection,
    refresh: () => Promise.all([loadRecipes(), loadCollections()]),
  };
}

// Recipe Details Hook
export function useRecipeDetails(recipeId?: string) {
  const [state, setState] = useState<ApiState<BaseRecipe>>({
    data: null,
    loading: false,
    error: null,
    retry: () => {},
  });

  const fetchRecipe = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const recipe = await recipeApi.getRecipe(id);
      setState(prev => ({ ...prev, loading: false, data: recipe }));
      return recipe;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load recipe';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  const retry = useCallback(() => {
    if (recipeId) {
      fetchRecipe(recipeId);
    }
  }, [recipeId, fetchRecipe]);

  useEffect(() => {
    if (recipeId) {
      fetchRecipe(recipeId);
    }
  }, [recipeId, fetchRecipe]);

  return {
    ...state,
    retry,
    fetchRecipe,
  };
}

// Network Status Hook
export function useNetworkStatus() {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    type: 'unknown',
    queuedRequests: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const clientState = apiClient.getNetworkState();
      const queuedRequests = apiClient.getQueuedRequestCount();
      
      setNetworkState({
        isConnected: clientState.isConnected,
        type: clientState.type,
        queuedRequests,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return networkState;
}

// Recipe Analytics Hook
export function useRecipeAnalytics() {
  const [analytics, setAnalytics] = useState<{
    totalRecipes: number;
    favoriteCount: number;
    recentlyAddedCount: number;
    mostCookedRecipe?: string;
    popularCuisines: Array<{ cuisine: string; count: number }>;
    cookingTimeDistribution: Record<string, number>;
    loading: boolean;
    error: string | null;
  }>({
    totalRecipes: 0,
    favoriteCount: 0,
    recentlyAddedCount: 0,
    popularCuisines: [],
    cookingTimeDistribution: {},
    loading: false,
    error: null,
  });

  const loadAnalytics = useCallback(async () => {
    setAnalytics(prev => ({ ...prev, loading: true, error: null }));

    try {
      const data = await recipeApi.getRecipeAnalytics();
      setAnalytics(prev => ({
        ...prev,
        loading: false,
        ...data,
      }));
    } catch (error: any) {
      setAnalytics(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load analytics',
      }));
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return {
    ...analytics,
    refresh: loadAnalytics,
  };
}