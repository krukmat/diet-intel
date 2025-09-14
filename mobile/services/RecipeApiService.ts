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

// === NEW RECIPE AI INTERFACES (Tasks 4-12) ===

// Taste Preference Learning Interfaces
export interface UserTasteProfileRequest {
  cuisinePreferences?: string[];
  dietaryRestrictions?: string[];
  spiceLevel?: 'mild' | 'medium' | 'hot';
  ingredientLikes?: string[];
  ingredientDislikes?: string[];
  cookingTimePreference?: number;
  difficultyPreference?: 'beginner' | 'intermediate' | 'advanced';
}

export interface UserTasteProfile {
  userId: string;
  cuisinePreferences: string[];
  ingredientLikes: string[];
  ingredientDislikes: string[];
  spiceLevel: 'mild' | 'medium' | 'hot';
  dietaryRestrictions: string[];
  learningProgress: number;
  confidenceScore: number;
  totalRatings: number;
  lastUpdated: Date;
}

export interface UserTasteProfileResponse {
  profile: UserTasteProfile;
  learningInsights: {
    strongPreferences: string[];
    suggestions: string[];
    nextRecommendations: number;
  };
}

export interface UserLearningProgressResponse {
  userId: string;
  totalRatings: number;
  requiredForAccuracy: number;
  currentAccuracy: number;
  targetAccuracy: number;
  progressPercentage: number;
  milestones: Array<{
    name: string;
    achieved: boolean;
    date: Date | null;
  }>;
  insights: {
    strongestPreferences: string[];
    needsMoreData: string[];
    recommendations: string;
  };
}

export interface PersonalizedRecipeRequest {
  userId: string;
  mealType?: string;
  cuisineTypes?: string[];
  dietaryRestrictions?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  cookingTime?: number;
  servings?: number;
  usePersonalization?: boolean;
}

export interface GeneratedRecipeResponse {
  id: string;
  recipe: BaseRecipe;
  personalizationData?: {
    matchingPreferences: string[];
    confidenceScore: number;
    reasoningExplanation: string;
  };
}

// Shopping Optimization Interfaces
export interface ShoppingOptimizationRequest {
  recipeIds: string[];
  userId: string;
  preferredStoreId?: string;
  optimizationName?: string;
}

export interface ConsolidatedIngredient {
  id: string;
  name: string;
  totalQuantity: number;
  unit: string;
  sourceRecipes: Array<{
    recipeId: string;
    recipeName: string;
    quantity: number;
    unit: string;
  }>;
  estimatedCost: number;
  bulkDiscountAvailable: boolean;
}

export interface BulkBuyingSuggestion {
  id: string;
  shoppingOptimizationId: string;
  ingredientConsolidationId: string;
  suggestionType: 'bulk_discount' | 'family_pack' | 'warehouse_store' | 'subscription';
  currentNeededQuantity: number;
  suggestedBulkQuantity: number;
  bulkUnit: string;
  regularUnitPrice: number;
  bulkUnitPrice: number;
  immediateSavings: number;
  costPerUnitSavings: number;
  storageRequirements: 'pantry' | 'refrigerated' | 'frozen' | 'cool_dry';
  estimatedUsageTimeframeDays: number;
  perishabilityRisk: 'low' | 'medium' | 'high';
  recommendationScore: number;
  userPreferenceMatch: number;
  createdAt: Date;
}

export interface ShoppingOptimizationResponse {
  optimizationId: string;
  optimizationName: string;
  recipeIds: string[];
  consolidatedIngredients: ConsolidatedIngredient[];
  bulkSuggestions: BulkBuyingSuggestion[];
  optimizationMetrics: {
    totalIngredients: number;
    consolidatedTo: number;
    consolidationSavings: number;
    estimatedTotalCost: number;
    potentialSavings: number;
    optimizationScore: number;
  };
  estimatedTotalCost: number;
  estimatedSavings: number;
  createdAt: Date;
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
        '/recipe-ai/generate',
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

  // === NEW RECIPE AI FEATURES (Tasks 4-12) ===

  // Taste Preference Learning (Tasks 4-8)
  public async learnUserPreferences(request?: UserTasteProfileRequest): Promise<UserTasteProfileResponse> {
    try {
      const response = await apiClient.post<UserTasteProfileResponse>(
        '/recipe-ai/learn-preferences',
        request || {},
        {
          mockResponse: {
            profile: {
              userId: 'user-123',
              cuisinePreferences: ['Italian', 'Mexican', 'Asian'],
              ingredientLikes: ['tomatoes', 'garlic', 'chicken'],
              ingredientDislikes: ['cilantro', 'mushrooms'],
              spiceLevel: 'medium',
              dietaryRestrictions: [],
              learningProgress: 0.65,
              confidenceScore: 0.78,
              totalRatings: 12,
              lastUpdated: new Date(),
            },
            learningInsights: {
              strongPreferences: ['Italian cuisine', 'tomato-based dishes'],
              suggestions: ['Try Mediterranean recipes', 'Explore more seafood dishes'],
              nextRecommendations: 3
            }
          }
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'PREFERENCE_LEARNING_FAILED', 'Failed to learn user preferences');
    }
  }

  public async getUserTasteProfile(userId: string): Promise<UserTasteProfileResponse> {
    try {
      const response = await apiClient.get<UserTasteProfileResponse>(
        `/recipe-ai/preferences/${userId}`,
        undefined,
        {
          mockResponse: {
            profile: {
              userId: userId,
              cuisinePreferences: ['Italian', 'Mexican'],
              ingredientLikes: ['tomatoes', 'garlic'],
              ingredientDislikes: ['cilantro'],
              spiceLevel: 'medium',
              dietaryRestrictions: [],
              learningProgress: 0.45,
              confidenceScore: 0.62,
              totalRatings: 8,
              lastUpdated: new Date(),
            },
            learningInsights: {
              strongPreferences: ['Italian cuisine'],
              suggestions: ['Rate more recipes to improve recommendations'],
              nextRecommendations: 5
            }
          }
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'GET_PROFILE_FAILED', 'Failed to get user taste profile');
    }
  }

  public async getUserLearningProgress(userId: string): Promise<UserLearningProgressResponse> {
    try {
      const response = await apiClient.get<UserLearningProgressResponse>(
        `/recipe-ai/preferences/${userId}/progress`,
        undefined,
        {
          mockResponse: {
            userId: userId,
            totalRatings: 8,
            requiredForAccuracy: 15,
            currentAccuracy: 0.62,
            targetAccuracy: 0.80,
            progressPercentage: 53,
            milestones: [
              { name: 'First Rating', achieved: true, date: new Date() },
              { name: '5 Ratings', achieved: true, date: new Date() },
              { name: '10 Ratings', achieved: false, date: null },
              { name: '20 Ratings', achieved: false, date: null }
            ],
            insights: {
              strongestPreferences: ['Italian', 'tomato-based'],
              needsMoreData: ['spice level', 'cooking time preferences'],
              recommendations: 'Rate 7 more recipes to reach 80% accuracy'
            }
          }
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'GET_PROGRESS_FAILED', 'Failed to get learning progress');
    }
  }

  public async generatePersonalizedRecipe(request: PersonalizedRecipeRequest): Promise<GeneratedRecipeResponse> {
    try {
      const response = await apiClient.post<GeneratedRecipeResponse>(
        '/recipe-ai/generate-personalized',
        request,
        {
          timeout: 30000,
          mockResponse: {
            id: 'pers-recipe-' + Date.now(),
            recipe: {
              id: 'recipe-personalized',
              name: 'Personalized Italian Pasta',
              description: 'A customized pasta recipe based on your preferences for Italian cuisine and tomato-based dishes',
              cookingTime: 25,
              servings: 4,
              difficulty: 'intermediate',
              ingredients: [
                { name: 'pasta', quantity: '400', unit: 'g' },
                { name: 'tomatoes', quantity: '6', unit: 'pieces' },
                { name: 'garlic', quantity: '3', unit: 'cloves' },
                { name: 'olive oil', quantity: '3', unit: 'tbsp' }
              ],
              instructions: [
                'Cook pasta according to package directions',
                'Sauté garlic in olive oil',
                'Add tomatoes and cook until soft',
                'Combine with pasta and serve'
              ],
              tags: ['Italian', 'tomato-based', 'personalized'],
              imageUrl: null,
              nutritionFacts: {
                calories: 320,
                protein: 12,
                carbs: 58,
                fat: 8
              }
            },
            personalizationData: {
              matchingPreferences: ['Italian cuisine', 'tomato-based dishes', 'garlic'],
              confidenceScore: 0.89,
              reasoningExplanation: 'This recipe matches your love for Italian cuisine and tomato-based dishes, while incorporating your favorite ingredient: garlic.'
            }
          }
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'PERSONALIZED_GENERATION_FAILED', 'Failed to generate personalized recipe');
    }
  }

  // Shopping Optimization (Tasks 9-12)
  public async optimizeShoppingList(request: ShoppingOptimizationRequest): Promise<ShoppingOptimizationResponse> {
    try {
      const response = await apiClient.post<ShoppingOptimizationResponse>(
        '/recipe-ai/shopping/optimize',
        request,
        {
          timeout: 15000,
          mockResponse: {
            optimizationId: 'opt-' + Date.now(),
            optimizationName: 'Shopping List for 3 Recipes',
            recipeIds: request.recipeIds,
            consolidatedIngredients: [
              {
                id: 'cons-1',
                name: 'olive_oil',
                totalQuantity: 150,
                unit: 'ml',
                sourceRecipes: [
                  { recipeId: 'recipe1', recipeName: 'Pasta', quantity: 50, unit: 'ml' },
                  { recipeId: 'recipe2', recipeName: 'Salad', quantity: 100, unit: 'ml' }
                ],
                estimatedCost: 8.50,
                bulkDiscountAvailable: true
              },
              {
                id: 'cons-2',
                name: 'tomatoes',
                totalQuantity: 8,
                unit: 'pieces',
                sourceRecipes: [
                  { recipeId: 'recipe1', recipeName: 'Pasta', quantity: 6, unit: 'pieces' },
                  { recipeId: 'recipe2', recipeName: 'Salad', quantity: 2, unit: 'pieces' }
                ],
                estimatedCost: 4.20,
                bulkDiscountAvailable: false
              }
            ],
            bulkSuggestions: [
              {
                id: 'bulk-1',
                shoppingOptimizationId: 'opt-123',
                ingredientConsolidationId: 'cons-1',
                suggestionType: 'bulk_discount',
                currentNeededQuantity: 150,
                suggestedBulkQuantity: 500,
                bulkUnit: 'ml',
                regularUnitPrice: 0.057,
                bulkUnitPrice: 0.044,
                immediateSavings: 1.95,
                costPerUnitSavings: 0.013,
                storageRequirements: 'pantry',
                estimatedUsageTimeframeDays: 60,
                perishabilityRisk: 'low',
                recommendationScore: 0.85,
                userPreferenceMatch: 0.70,
                createdAt: new Date()
              }
            ],
            optimizationMetrics: {
              totalIngredients: 12,
              consolidatedTo: 8,
              consolidationSavings: 4,
              estimatedTotalCost: 28.70,
              potentialSavings: 3.50,
              optimizationScore: 0.78
            },
            estimatedTotalCost: 28.70,
            estimatedSavings: 3.50,
            createdAt: new Date()
          }
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'SHOPPING_OPTIMIZATION_FAILED', 'Failed to optimize shopping list');
    }
  }

  public async getShoppingOptimization(optimizationId: string): Promise<ShoppingOptimizationResponse> {
    try {
      const response = await apiClient.get<ShoppingOptimizationResponse>(
        `/recipe-ai/shopping/${optimizationId}`,
        undefined,
        {
          mockResponse: {
            optimizationId: optimizationId,
            optimizationName: 'Saved Shopping List',
            recipeIds: ['recipe1', 'recipe2'],
            consolidatedIngredients: [],
            bulkSuggestions: [],
            optimizationMetrics: {
              totalIngredients: 10,
              consolidatedTo: 7,
              consolidationSavings: 3,
              estimatedTotalCost: 25.00,
              potentialSavings: 2.80,
              optimizationScore: 0.75
            },
            estimatedTotalCost: 25.00,
            estimatedSavings: 2.80,
            createdAt: new Date()
          }
        }
      );

      return response.data;
    } catch (error) {
      throw this.enhanceError(error, 'GET_SHOPPING_OPTIMIZATION_FAILED', 'Failed to get shopping optimization');
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