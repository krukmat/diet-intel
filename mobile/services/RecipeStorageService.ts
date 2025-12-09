// Optimized Recipe Storage Service
// Using Singleton, Observer, Strategy patterns with memory optimization

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PersonalRecipe,
  RecipeCollection,
  LibrarySearchFilters,
  LibrarySortOptions,
  RecipeListItem,
  PaginatedRecipeResult,
  RecipeStorageEvent,
  RecipeStorageError,
  SYSTEM_COLLECTIONS,
  BaseRecipe,
  PersonalRecipeMetadata,
} from '../types/RecipeTypes';

// Storage keys with versioning for future migrations
const STORAGE_KEYS = {
  RECIPES: '@recipes/v2',
  COLLECTIONS: '@collections/v2',
  METADATA: '@recipe_metadata/v2',
  SETTINGS: '@library_settings/v1',
} as const;

// Event listener type
type StorageEventListener = (event: RecipeStorageEvent) => void;

// LRU Cache for performance optimization
class LRUCache<T> {
  private cache = new Map<string, T>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Recipe Storage Service (Singleton Pattern)
export class RecipeStorageService {
  private static instance: RecipeStorageService;
  private recipeCache = new LRUCache<PersonalRecipe>(50);
  private collectionsCache = new LRUCache<RecipeCollection[]>(1);
  private eventListeners = new Set<StorageEventListener>();
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): RecipeStorageService {
    if (!RecipeStorageService.instance) {
      RecipeStorageService.instance = new RecipeStorageService();
    }
    return RecipeStorageService.instance;
  }

  // Initialization with lazy loading
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.initializeSystemCollections();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize RecipeStorageService:', error);
      throw error;
    }
  }

  // Observer Pattern: Event handling
  public addEventListener(listener: StorageEventListener): void {
    this.eventListeners.add(listener);
  }

  public removeEventListener(listener: StorageEventListener): void {
    this.eventListeners.delete(listener);
  }

  private notifyListeners(event: RecipeStorageEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in storage event listener:', error);
      }
    });
  }

  // Recipe Management
  public async saveRecipe(recipe: BaseRecipe, source: 'generated' | 'search' | 'custom' | 'imported' = 'custom'): Promise<PersonalRecipe> {
    try {
      const personalMetadata: PersonalRecipeMetadata = {
        dateAdded: new Date(),
        timesCooked: 0,
        source,
        isFavorite: false,
      };

      const personalRecipe: PersonalRecipe = {
        ...recipe,
        personalMetadata,
        collections: source === 'custom' ? [SYSTEM_COLLECTIONS.CUSTOM_RECIPES] : [],
        personalTags: [],
      };

      await this.storeRecipe(personalRecipe);
      this.recipeCache.set(recipe.id, personalRecipe);

      this.notifyListeners({
        type: 'added',
        recipeId: recipe.id,
        timestamp: new Date(),
        details: { source },
      });

      return personalRecipe;
    } catch (error) {
      throw this.createStorageError('INVALID_DATA', `Failed to save recipe: ${error}`, recipe.id);
    }
  }

  public async getRecipe(recipeId: string): Promise<PersonalRecipe | null> {
    // Check cache first
    const cached = this.recipeCache.get(recipeId);
    if (cached) return cached;

    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.RECIPES}/${recipeId}`);
      if (!stored) return null;

      const recipe: PersonalRecipe = JSON.parse(stored, this.dateReviver);
      this.recipeCache.set(recipeId, recipe);
      return recipe;
    } catch (error) {
      console.error(`Failed to get recipe ${recipeId}:`, error);
      return null;
    }
  }

  public async updateRecipe(recipeId: string, updates: Partial<PersonalRecipe>): Promise<PersonalRecipe> {
    const existingRecipe = await this.getRecipe(recipeId);
    if (!existingRecipe) {
      throw this.createStorageError('NOT_FOUND', 'Recipe not found', recipeId);
    }

    const updatedRecipe: PersonalRecipe = {
      ...existingRecipe,
      ...updates,
      id: recipeId, // Ensure ID doesn't change
    };

    await this.storeRecipe(updatedRecipe);
    this.recipeCache.set(recipeId, updatedRecipe);

    this.notifyListeners({
      type: 'updated',
      recipeId,
      timestamp: new Date(),
      details: { updates },
    });

    return updatedRecipe;
  }

  public async deleteRecipe(recipeId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${STORAGE_KEYS.RECIPES}/${recipeId}`);
      this.recipeCache.set(recipeId, undefined as any); // Invalidate cache

      this.notifyListeners({
        type: 'removed',
        recipeId,
        timestamp: new Date(),
      });
    } catch (error) {
      throw this.createStorageError('PERMISSION_DENIED', `Failed to delete recipe: ${error}`, recipeId);
    }
  }

  // Optimized search with pagination (Strategy Pattern)
  public async searchRecipes(
    filters: LibrarySearchFilters = {},
    sortOptions: LibrarySortOptions = { field: 'dateAdded', direction: 'desc' },
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedRecipeResult> {
    try {
      const allRecipeIds = await this.getAllRecipeIds();
      const filteredIds = await this.applyFilters(allRecipeIds, filters);
      const sortedIds = await this.applySorting(filteredIds, sortOptions);
      
      // Pagination
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedIds = sortedIds.slice(startIndex, endIndex);

      // Load only visible items for memory efficiency
      const items: RecipeListItem[] = [];
      for (const recipeId of paginatedIds) {
        const recipe = await this.getRecipe(recipeId);
        if (recipe) {
          items.push(this.toListItem(recipe));
        }
      }

      return {
        items,
        totalCount: sortedIds.length,
        hasMore: endIndex < sortedIds.length,
        currentPage: page,
      };
    } catch (error) {
      console.error('Search recipes error:', error);
      return {
        items: [],
        totalCount: 0,
        hasMore: false,
        currentPage: page,
      };
    }
  }

  // Collection Management
  public async getCollections(): Promise<RecipeCollection[]> {
    const cached = this.collectionsCache.get('all');
    if (cached) return cached;

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.COLLECTIONS);
      const collections = stored ? JSON.parse(stored, this.dateReviver) : [];
      this.collectionsCache.set('all', collections);
      return collections;
    } catch (error) {
      console.error('Failed to get collections:', error);
      return [];
    }
  }

  public async createCollection(name: string, description?: string, color: string = '#007AFF', icon: string = '📁'): Promise<RecipeCollection> {
    const collection: RecipeCollection = {
      id: `custom_${Date.now()}`,
      name,
      description,
      color,
      icon,
      isSystem: false,
      createdAt: new Date(),
      recipeCount: 0,
      sortOrder: 999,
    };

    const collections = await this.getCollections();
    const updatedCollections = [...collections, collection];
    
    await AsyncStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(updatedCollections));
    this.collectionsCache.clear(); // Invalidate cache

    return collection;
  }

  public async addToCollection(recipeId: string, collectionId: string): Promise<void> {
    const recipe = await this.getRecipe(recipeId);
    if (!recipe) throw this.createStorageError('NOT_FOUND', 'Recipe not found', recipeId);

    const newCollections = Array.from(new Set([...recipe.collections, collectionId]));
    await this.updateRecipe(recipeId, { collections: newCollections });

    this.notifyListeners({
      type: 'collection_changed',
      recipeId,
      timestamp: new Date(),
      details: { action: 'added', collectionId },
    });
  }

  public async removeFromCollection(recipeId: string, collectionId: string): Promise<void> {
    const recipe = await this.getRecipe(recipeId);
    if (!recipe) return;

    const newCollections = recipe.collections.filter(id => id !== collectionId);
    await this.updateRecipe(recipeId, { collections: newCollections });

    this.notifyListeners({
      type: 'collection_changed',
      recipeId,
      timestamp: new Date(),
      details: { action: 'removed', collectionId },
    });
  }

  // Helper methods
  private async storeRecipe(recipe: PersonalRecipe): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEYS.RECIPES}/${recipe.id}`, JSON.stringify(recipe));
  }

  private async getAllRecipeIds(): Promise<string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return keys
        .filter(key => key.startsWith(STORAGE_KEYS.RECIPES))
        .map(key => key.replace(`${STORAGE_KEYS.RECIPES}/`, ''));
    } catch (error) {
      console.error('Failed to get recipe IDs:', error);
      return [];
    }
  }

  private async applyFilters(recipeIds: string[], filters: LibrarySearchFilters): Promise<string[]> {
    const results: string[] = [];
    
    for (const recipeId of recipeIds) {
      const recipe = await this.getRecipe(recipeId);
      if (!recipe) continue;

      if (this.matchesFilters(recipe, filters)) {
        results.push(recipeId);
      }
    }

    return results;
  }

  private matchesFilters(recipe: PersonalRecipe, filters: LibrarySearchFilters): boolean {
    if (filters.collections && filters.collections.length > 0) {
      const hasCollection = filters.collections.some(collection => 
        recipe.collections.includes(collection)
      );
      if (!hasCollection) return false;
    }

    if (filters.personalTags && filters.personalTags.length > 0) {
      const hasTag = filters.personalTags.some(tag => 
        recipe.personalTags.includes(tag)
      );
      if (!hasTag) return false;
    }

    if (filters.personalRatingMin && recipe.personalMetadata?.personalRating) {
      if (recipe.personalMetadata.personalRating < filters.personalRatingMin) return false;
    }

    if (filters.cookingTimeRange) {
      const { min, max } = filters.cookingTimeRange;
      if (recipe.cookingTime < min || recipe.cookingTime > max) return false;
    }

    if (filters.source && filters.source.length > 0) {
      if (!filters.source.includes(recipe.personalMetadata.source)) return false;
    }

    return true;
  }

  private async applySorting(recipeIds: string[], sortOptions: LibrarySortOptions): Promise<string[]> {
    const recipesWithSortData = await Promise.all(
      recipeIds.map(async (id) => {
        const recipe = await this.getRecipe(id);
        return recipe ? { id, recipe } : null;
      })
    );

    const validRecipes = recipesWithSortData.filter(Boolean) as { id: string; recipe: PersonalRecipe }[];

    validRecipes.sort((a, b) => {
      const { field, direction } = sortOptions;
      let comparison = 0;

      switch (field) {
        case 'dateAdded':
          comparison = a.recipe.personalMetadata.dateAdded.getTime() - b.recipe.personalMetadata.dateAdded.getTime();
          break;
        case 'name':
          comparison = a.recipe.name.localeCompare(b.recipe.name);
          break;
        case 'personalRating':
          const aRating = a.recipe.personalMetadata?.personalRating || 0;
          const bRating = b.recipe.personalMetadata?.personalRating || 0;
          comparison = aRating - bRating;
          break;
        case 'timesCooked':
          comparison = (a.recipe.personalMetadata?.timesCooked || 0) - (b.recipe.personalMetadata?.timesCooked || 0);
          break;
        case 'lastCooked':
          const aLast = a.recipe.personalMetadata?.lastCooked?.getTime() || 0;
          const bLast = b.recipe.personalMetadata?.lastCooked?.getTime() || 0;
          comparison = aLast - bLast;
          break;
        case 'cookingTime':
          comparison = a.recipe.cookingTime - b.recipe.cookingTime;
          break;
      }

      return direction === 'desc' ? -comparison : comparison;
    });

    return validRecipes.map(item => item.id);
  }

  private toListItem(recipe: PersonalRecipe): RecipeListItem {
    return {
      id: recipe.id,
      name: recipe.name,
      imageUrl: recipe.imageUrl,
      cookingTime: recipe.cookingTime,
      personalRating: recipe.personalMetadata?.personalRating,
      isFavorite: recipe.personalMetadata?.isFavorite || false,
      collections: recipe.collections,
      lastCooked: recipe.personalMetadata?.lastCooked,
    };
  }

  private async initializeSystemCollections(): Promise<void> {
    const systemCollections: RecipeCollection[] = [
      {
        id: SYSTEM_COLLECTIONS.FAVORITES,
        name: 'Favorites',
        description: 'Your favorite recipes',
        color: '#FF3B30',
        icon: '❤️',
        isSystem: true,
        createdAt: new Date(),
        recipeCount: 0,
        sortOrder: 1,
      },
      {
        id: SYSTEM_COLLECTIONS.RECENTLY_ADDED,
        name: 'Recently Added',
        description: 'Recently saved recipes',
        color: '#34C759',
        icon: '🆕',
        isSystem: true,
        createdAt: new Date(),
        recipeCount: 0,
        sortOrder: 2,
      },
      {
        id: SYSTEM_COLLECTIONS.FREQUENTLY_COOKED,
        name: 'Frequently Cooked',
        description: 'Your most cooked recipes',
        color: '#FF9500',
        icon: '🔥',
        isSystem: true,
        createdAt: new Date(),
        recipeCount: 0,
        sortOrder: 3,
      },
      {
        id: SYSTEM_COLLECTIONS.WANT_TO_TRY,
        name: 'Want to Try',
        description: 'Recipes to try later',
        color: '#5856D6',
        icon: '📌',
        isSystem: true,
        createdAt: new Date(),
        recipeCount: 0,
        sortOrder: 4,
      },
      {
        id: SYSTEM_COLLECTIONS.CUSTOM_RECIPES,
        name: 'My Creations',
        description: 'Your custom recipes',
        color: '#007AFF',
        icon: '👨‍🍳',
        isSystem: true,
        createdAt: new Date(),
        recipeCount: 0,
        sortOrder: 5,
      },
    ];

    const existingCollections = await this.getCollections();
    const hasSystemCollections = existingCollections.some(c => c.isSystem);

    if (!hasSystemCollections) {
      await AsyncStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(systemCollections));
      this.collectionsCache.clear();
    }
  }

  private dateReviver(key: string, value: any): any {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return new Date(value);
    }
    return value;
  }

  private createStorageError(code: RecipeStorageError['code'], message: string, recipeId?: string): RecipeStorageError {
    return { code, message, recipeId };
  }

  // Memory management
  public clearCache(): void {
    this.recipeCache.clear();
    this.collectionsCache.clear();
  }

  public getCacheStats(): { recipesCached: number; collectionsCached: number } {
    return {
      recipesCached: this.recipeCache.size(),
      collectionsCached: this.collectionsCache.size(),
    };
  }
}

// Export singleton instance
export const recipeStorage = RecipeStorageService.getInstance();