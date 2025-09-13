// Recipe API Service - Production Integration with Backend
// Comprehensive API integration for Recipe AI features

import { apiClient, ApiResponse } from './ApiClient';
import { BaseRecipe, PersonalRecipe, RecipeCollection } from '../types/RecipeTypes';

// API Request/Response Types
export interface RecipeGenerationRequest {
  cuisineTypes: string[];
  dietaryRestrictions: string[];
  mealType: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  cookingTime: number;
  servings: number;
  ingredients?: string[];
  allergies?: string[];
  nutritionalTargets?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  preferences?: {
    spiceLevel?: 'mild' | 'medium' | 'hot';
    cookingMethod?: string[];
    equipment?: string[];
  };
}

export interface RecipeGenerationResponse {
  id: string;
  recipe: BaseRecipe;
  generationMetadata: {
    processingTime: number;
    aiModel: string;
    confidence: number;
    alternativeCount: number;
  };
  alternatives?: BaseRecipe[];
}

export interface RecipeSearchRequest {
  query?: string;
  cuisineTypes?: string[];
  dietaryRestrictions?: string[];
  mealTypes?: string[];
  difficulty?: string[];
  cookingTimeRange?: { min: number; max: number };
  calorieRange?: { min: number; max: number };
  ingredients?: string[];
  excludeIngredients?: string[];
  minRating?: number;
  sortBy?: 'relevance' | 'rating' | 'popularity' | 'date' | 'cookingTime' | 'calories';
  sortDirection?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface RecipeSearchResponse {
  recipes: BaseRecipe[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
  searchMetadata: {
    processingTime: number;
    suggestedFilters?: Record<string, string[]>;
    relatedQueries?: string[];
  };
}

export interface PersonalRecipeRequest {
  recipe: Partial<BaseRecipe>;
  collections?: string[];
  personalTags?: string[];
  notes?: string;
  source?: 'generated' | 'search' | 'custom' | 'imported';
}

export interface PersonalRecipeResponse {
  recipe: PersonalRecipe;
  collections: RecipeCollection[];
}

export interface RecipeCollectionRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  recipeIds?: string[];
}

export interface BatchRecipeOperation {
  operation: 'add' | 'remove' | 'update';
  recipeIds: string[];
  collectionId?: string;
  data?: Partial<PersonalRecipe>;
}

// Recipe Generation Progress (for WebSocket/Server-Sent Events)
export interface GenerationProgress {
  id: string;
  status: 'initializing' | 'processing' | 'generating' | 'optimizing' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  currentStep?: string;
  estimatedTimeRemaining?: number;
}

// Mock Data for Development Mode
const MOCK_RECIPE_GENERATION: RecipeGenerationResponse = {
  id: 'gen_123456789',
  recipe: {
    id: 'recipe_ai_001',
    name: 'AI-Generated Mediterranean Bowl',
    description: 'A perfectly balanced Mediterranean bowl with quinoa, roasted vegetables, and tahini dressing.',
    cookingTime: 35,
    difficulty: 'intermediate',
    rating: 4.8,
    totalRatings: 127,
    calories: 420,
    cuisineType: 'mediterranean',
    tags: ['Mediterranean', 'Healthy', 'Vegetarian', 'AI-Generated'],
    ingredients: [
      { id: 'ing_001', name: 'Quinoa', amount: 1, unit: 'cup', category: 'grains' },
      { id: 'ing_002', name: 'Cherry tomatoes', amount: 200, unit: 'g', category: 'vegetables' },
      { id: 'ing_003', name: 'Cucumber', amount: 1, unit: 'medium', category: 'vegetables' },
      { id: 'ing_004', name: 'Red onion', amount: 0.5, unit: 'small', category: 'vegetables' },
      { id: 'ing_005', name: 'Tahini', amount: 3, unit: 'tbsp', category: 'condiments' },
    ],
    instructions: [
      { step: 1, instruction: 'Cook quinoa according to package directions.', timeMinutes: 15 },
      { step: 2, instruction: 'Roast vegetables in oven at 400°F for 20 minutes.', timeMinutes: 20 },
      { step: 3, instruction: 'Prepare tahini dressing by mixing tahini with lemon juice and water.' },
      { step: 4, instruction: 'Combine all ingredients in a bowl and serve.' },
    ],
  },
  generationMetadata: {
    processingTime: 2.3,
    aiModel: 'RecipeAI-v2.1',
    confidence: 0.94,
    alternativeCount: 3,
  },
};

const MOCK_SEARCH_RESULTS: RecipeSearchResponse = {
  recipes: [
    {
      id: 'recipe_001',
      name: 'Classic Italian Carbonara',
      description: 'Traditional Roman pasta with eggs, cheese, and pancetta.',
      cookingTime: 20,
      difficulty: 'intermediate',
      rating: 4.9,
      totalRatings: 345,
      calories: 520,
      cuisineType: 'italian',
      tags: ['Italian', 'Pasta', 'Classic'],
    },
    {
      id: 'recipe_002',
      name: 'Thai Green Curry',
      description: 'Authentic Thai curry with coconut milk and fresh herbs.',
      cookingTime: 30,
      difficulty: 'intermediate',
      rating: 4.7,
      totalRatings: 198,
      calories: 380,
      cuisineType: 'thai',
      tags: ['Thai', 'Curry', 'Spicy'],
    },
  ],
  totalCount: 156,
  page: 1,
  limit: 20,
  hasMore: true,
  searchMetadata: {
    processingTime: 0.8,
    suggestedFilters: {
      cuisineTypes: ['Italian', 'Thai', 'Mexican', 'Indian'],
      difficulty: ['beginner', 'intermediate'],
    },
    relatedQueries: ['pasta recipes', 'curry recipes', 'quick dinners'],
  },
};

// Production-Ready Recipe API Service
export class RecipeApiService {
  private static instance: RecipeApiService;

  private constructor() {}

  public static getInstance(): RecipeApiService {
    if (!RecipeApiService.instance) {
      RecipeApiService.instance = new RecipeApiService();
    }
    return RecipeApiService.instance;
  }

  // Recipe Generation
  public async generateRecipe(request: RecipeGenerationRequest): Promise<RecipeGenerationResponse> {
    try {
      const response = await apiClient.post<RecipeGenerationResponse>(
        '/recipes/generate',
        request,
        {
          timeout: 30000, // 30 seconds for AI generation
          retryable: false, // Don't retry generation requests
          mockResponse: MOCK_RECIPE_GENERATION,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Recipe generation failed:', error);
      throw this.enhanceError(error, 'GENERATION_FAILED', 'Failed to generate recipe');
    }
  }

  // Recipe Generation Progress (for real-time updates)
  public async getGenerationProgress(generationId: string): Promise<GenerationProgress> {
    try {
      const response = await apiClient.get<GenerationProgress>(
        `/recipes/generate/${generationId}/progress`,
        undefined,
        {
          cache: false,
          mockResponse: {
            id: generationId,
            status: 'processing',
            progress: 75,
            message: 'Optimizing recipe nutritional balance...',
            currentStep: 'Nutritional Analysis',
            estimatedTimeRemaining: 8,
          },
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'PROGRESS_FETCH_FAILED', 'Failed to get generation progress');
    }
  }

  // Recipe Search & Discovery
  public async searchRecipes(request: RecipeSearchRequest = {}): Promise<RecipeSearchResponse> {
    try {
      const response = await apiClient.get<RecipeSearchResponse>(
        '/recipes/search',
        {
          ...request,
          page: request.page || 1,
          limit: request.limit || 20,
        },
        {
          cache: true,
          mockResponse: MOCK_SEARCH_RESULTS,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Recipe search failed:', error);
      throw this.enhanceError(error, 'SEARCH_FAILED', 'Failed to search recipes');
    }
  }

  // Get Single Recipe Details
  public async getRecipe(recipeId: string): Promise<BaseRecipe> {
    try {
      const response = await apiClient.get<BaseRecipe>(
        `/recipes/${recipeId}`,
        undefined,
        {
          cache: true,
          mockResponse: MOCK_RECIPE_GENERATION.recipe,
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'RECIPE_FETCH_FAILED', 'Failed to fetch recipe details');
    }
  }

  // Personal Recipe Management
  public async savePersonalRecipe(request: PersonalRecipeRequest): Promise<PersonalRecipeResponse> {
    try {
      const response = await apiClient.post<PersonalRecipeResponse>(
        '/user/recipes',
        request,
        {
          mockResponse: {
            recipe: {
              ...MOCK_RECIPE_GENERATION.recipe,
              personalMetadata: {
                dateAdded: new Date(),
                timesCooked: 0,
                source: request.source || 'custom',
                isFavorite: false,
              },
              collections: request.collections || [],
              personalTags: request.personalTags || [],
            },
            collections: [],
          },
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'SAVE_RECIPE_FAILED', 'Failed to save recipe');
    }
  }

  public async updatePersonalRecipe(
    recipeId: string, 
    updates: Partial<PersonalRecipe>
  ): Promise<PersonalRecipeResponse> {
    try {
      const response = await apiClient.put<PersonalRecipeResponse>(
        `/user/recipes/${recipeId}`,
        updates,
        {
          mockResponse: {
            recipe: { ...MOCK_RECIPE_GENERATION.recipe, ...updates } as PersonalRecipe,
            collections: [],
          },
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'UPDATE_RECIPE_FAILED', 'Failed to update recipe');
    }
  }

  public async deletePersonalRecipe(recipeId: string): Promise<void> {
    try {
      await apiClient.delete(`/user/recipes/${recipeId}`, {
        mockResponse: { success: true },
      });
    } catch (error) {
      throw this.enhanceError(error, 'DELETE_RECIPE_FAILED', 'Failed to delete recipe');
    }
  }

  // Personal Recipe Library
  public async getPersonalRecipes(
    page: number = 1,
    limit: number = 20,
    filters?: Record<string, any>
  ): Promise<{ recipes: PersonalRecipe[]; totalCount: number; hasMore: boolean }> {
    try {
      const response = await apiClient.get(
        '/user/recipes',
        { page, limit, ...filters },
        {
          cache: true,
          mockResponse: {
            recipes: [],
            totalCount: 0,
            hasMore: false,
          },
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'FETCH_PERSONAL_RECIPES_FAILED', 'Failed to fetch personal recipes');
    }
  }

  // Collection Management
  public async getCollections(): Promise<RecipeCollection[]> {
    try {
      const response = await apiClient.get<RecipeCollection[]>(
        '/user/collections',
        undefined,
        {
          cache: true,
          mockResponse: [],
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'FETCH_COLLECTIONS_FAILED', 'Failed to fetch collections');
    }
  }

  public async createCollection(request: RecipeCollectionRequest): Promise<RecipeCollection> {
    try {
      const response = await apiClient.post<RecipeCollection>(
        '/user/collections',
        request,
        {
          mockResponse: {
            id: `collection_${Date.now()}`,
            name: request.name,
            description: request.description,
            color: request.color || '#007AFF',
            icon: request.icon || '📁',
            isSystem: false,
            createdAt: new Date(),
            recipeCount: 0,
            sortOrder: 999,
          },
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'CREATE_COLLECTION_FAILED', 'Failed to create collection');
    }
  }

  public async updateCollection(
    collectionId: string, 
    updates: Partial<RecipeCollectionRequest>
  ): Promise<RecipeCollection> {
    try {
      const response = await apiClient.put<RecipeCollection>(
        `/user/collections/${collectionId}`,
        updates
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'UPDATE_COLLECTION_FAILED', 'Failed to update collection');
    }
  }

  public async deleteCollection(collectionId: string): Promise<void> {
    try {
      await apiClient.delete(`/user/collections/${collectionId}`);
    } catch (error) {
      throw this.enhanceError(error, 'DELETE_COLLECTION_FAILED', 'Failed to delete collection');
    }
  }

  // Collection Recipe Management
  public async addRecipeToCollection(recipeId: string, collectionId: string): Promise<void> {
    try {
      await apiClient.post(`/user/collections/${collectionId}/recipes`, { recipeId });
    } catch (error) {
      throw this.enhanceError(error, 'ADD_TO_COLLECTION_FAILED', 'Failed to add recipe to collection');
    }
  }

  public async removeRecipeFromCollection(recipeId: string, collectionId: string): Promise<void> {
    try {
      await apiClient.delete(`/user/collections/${collectionId}/recipes/${recipeId}`);
    } catch (error) {
      throw this.enhanceError(error, 'REMOVE_FROM_COLLECTION_FAILED', 'Failed to remove recipe from collection');
    }
  }

  // Batch Operations
  public async batchUpdateRecipes(operations: BatchRecipeOperation[]): Promise<void> {
    try {
      await apiClient.post('/user/recipes/batch', { operations });
    } catch (error) {
      throw this.enhanceError(error, 'BATCH_UPDATE_FAILED', 'Failed to perform batch recipe operations');
    }
  }

  // Recipe Analytics & Insights
  public async getRecipeAnalytics(): Promise<{
    totalRecipes: number;
    favoriteCount: number;
    recentlyAddedCount: number;
    mostCookedRecipe?: string;
    popularCuisines: Array<{ cuisine: string; count: number }>;
    cookingTimeDistribution: Record<string, number>;
  }> {
    try {
      const response = await apiClient.get(
        '/user/recipes/analytics',
        undefined,
        {
          cache: true,
          mockResponse: {
            totalRecipes: 0,
            favoriteCount: 0,
            recentlyAddedCount: 0,
            popularCuisines: [],
            cookingTimeDistribution: {},
          },
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'ANALYTICS_FAILED', 'Failed to fetch recipe analytics');
    }
  }

  // Recipe Rating & Reviews
  public async rateRecipe(recipeId: string, rating: number, review?: string): Promise<void> {
    try {
      await apiClient.post(`/recipes/${recipeId}/rating`, { 
        rating, 
        review,
      });
    } catch (error) {
      throw this.enhanceError(error, 'RATING_FAILED', 'Failed to rate recipe');
    }
  }

  // Recipe Sharing
  public async shareRecipe(recipeId: string, shareOptions: {
    format: 'json' | 'text' | 'pdf';
    includeNotes?: boolean;
    includeRating?: boolean;
  }): Promise<{ shareUrl: string; shareCode: string }> {
    try {
      const response = await apiClient.post(
        `/recipes/${recipeId}/share`,
        shareOptions,
        {
          mockResponse: {
            shareUrl: `https://share.dietintel.com/recipe/${recipeId}`,
            shareCode: 'DIET-' + recipeId.slice(-6).toUpperCase(),
          },
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'SHARE_FAILED', 'Failed to create recipe share');
    }
  }

  // Import/Export
  public async exportRecipes(
    recipeIds: string[], 
    format: 'json' | 'csv'
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    try {
      const response = await apiClient.post(
        '/user/recipes/export',
        { recipeIds, format },
        {
          mockResponse: {
            downloadUrl: `https://api.dietintel.com/exports/recipes-${Date.now()}.${format}`,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          },
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'EXPORT_FAILED', 'Failed to export recipes');
    }
  }

  public async importRecipes(
    data: any[], 
    source: 'json' | 'csv' | 'external'
  ): Promise<{ 
    imported: number; 
    skipped: number; 
    errors: Array<{ index: number; error: string }> 
  }> {
    try {
      const response = await apiClient.post(
        '/user/recipes/import',
        { data, source },
        {
          timeout: 60000, // 1 minute for large imports
          mockResponse: {
            imported: data.length,
            skipped: 0,
            errors: [],
          },
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'IMPORT_FAILED', 'Failed to import recipes');
    }
  }

  // Utility Methods
  private enhanceError(error: any, code: string, message: string): Error {
    const enhancedError = new Error(message);
    (enhancedError as any).code = code;
    (enhancedError as any).originalError = error;
    return enhancedError;
  }

  // Health Check
  public async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'down'; services: Record<string, boolean> }> {
    try {
      const response = await apiClient.get(
        '/health',
        undefined,
        {
          timeout: 5000,
          cache: false,
          mockResponse: {
            status: 'healthy',
            services: {
              database: true,
              ai_service: true,
              search_engine: true,
              cache: true,
            },
          },
        }
      );

      return response.data;
    } catch (error) {
      return {
        status: 'down',
        services: {
          database: false,
          ai_service: false,
          search_engine: false,
          cache: false,
        },
      };
    }
  }
}

// Export singleton instance
export const recipeApi = RecipeApiService.getInstance();