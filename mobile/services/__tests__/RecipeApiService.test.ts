import { RecipeApiService, getCurrentAppLanguage, type RecipeGenerationRequest } from '../RecipeApiService';
import { apiClient } from '../ApiClient';

jest.mock('../ApiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
}));

jest.mock('../../utils/recipeLanguageHelper', () => ({
  getCurrentRecipeLanguage: jest.fn(() => 'es')
}));

describe('RecipeApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns current app language from helper', () => {
    expect(getCurrentAppLanguage()).toBe('es');
  });

  it('creates a singleton instance', () => {
    const instanceA = RecipeApiService.getInstance();
    const instanceB = RecipeApiService.getInstance();

    expect(instanceA).toBe(instanceB);
  });

  it('generates recipe with apiClient and returns data', async () => {
    const service = RecipeApiService.getInstance();
    const request: RecipeGenerationRequest = {
      cuisineTypes: ['Italian'],
      dietaryRestrictions: [],
      mealType: 'dinner',
      difficulty: 'beginner',
      cookingTime: 20,
      servings: 2,
    };

    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { id: 'gen-1', generationMetadata: { processingTime: 1 }, recipe: { id: 'recipe-1' } }
    });

    const result = await service.generateRecipe(request);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/recipe-ai/generate',
      request,
      expect.objectContaining({ timeout: 30000, retryable: false, mockResponse: expect.any(Object) })
    );
    expect(result.id).toBe('gen-1');
  });

  it('throws enhanced error on generation failure', async () => {
    const service = RecipeApiService.getInstance();
    (apiClient.post as jest.Mock).mockRejectedValue(new Error('boom'));

    await expect(service.generateRecipe({
      cuisineTypes: [],
      dietaryRestrictions: [],
      mealType: 'lunch',
      difficulty: 'beginner',
      cookingTime: 10,
      servings: 1,
    })).rejects.toMatchObject({
      message: 'Failed to generate recipe',
      code: 'GENERATION_FAILED'
    });
  });

  it('searches recipes with default paging', async () => {
    const service = RecipeApiService.getInstance();
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { recipes: [], totalCount: 0, page: 1, limit: 20, hasMore: false } });

    const result = await service.searchRecipes({ query: 'chicken' });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/recipes/search',
      expect.objectContaining({ query: 'chicken', page: 1, limit: 20 }),
      expect.objectContaining({ cache: true, mockResponse: expect.any(Object) })
    );
    expect(result.page).toBe(1);
  });

  it('fetches recipe details', async () => {
    const service = RecipeApiService.getInstance();
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { id: 'recipe-1', name: 'Test' } });

    const result = await service.getRecipe('recipe-1');

    expect(apiClient.get).toHaveBeenCalledWith('/recipes/recipe-1', undefined, expect.any(Object));
    expect(result.id).toBe('recipe-1');
  });

  it('saves and updates personal recipes', async () => {
    const service = RecipeApiService.getInstance();
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { recipe: { id: 'saved-1' }, collections: [] } });
    (apiClient.put as jest.Mock).mockResolvedValue({ data: { recipe: { id: 'saved-1', name: 'Updated' }, collections: [] } });

    const saved = await service.savePersonalRecipe({ recipe: { id: 'saved-1', name: 'Test' } });
    const updated = await service.updatePersonalRecipe('saved-1', { name: 'Updated' });

    expect(apiClient.post).toHaveBeenCalledWith('/user/recipes', expect.any(Object), expect.any(Object));
    expect(apiClient.put).toHaveBeenCalledWith('/user/recipes/saved-1', { name: 'Updated' }, expect.any(Object));
    expect(saved.recipe.id).toBe('saved-1');
    expect(updated.recipe.name).toBe('Updated');
  });

  it('deletes personal recipes', async () => {
    const service = RecipeApiService.getInstance();
    (apiClient.delete as jest.Mock).mockResolvedValue({ data: { success: true } });

    await service.deletePersonalRecipe('recipe-1');

    expect(apiClient.delete).toHaveBeenCalledWith('/user/recipes/recipe-1', { mockResponse: { success: true } });
  });

  it('creates, updates, and deletes collections', async () => {
    const service = RecipeApiService.getInstance();
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'col-1', name: 'Favorites' } });
    (apiClient.put as jest.Mock).mockResolvedValue({ data: { id: 'col-1', name: 'Updated' } });
    (apiClient.delete as jest.Mock).mockResolvedValue({ data: { success: true } });

    const created = await service.createCollection({ name: 'Favorites' });
    const updated = await service.updateCollection('col-1', { name: 'Updated' });
    await service.deleteCollection('col-1');

    expect(apiClient.post).toHaveBeenCalledWith('/user/collections', { name: 'Favorites' }, expect.any(Object));
    expect(apiClient.put).toHaveBeenCalledWith('/user/collections/col-1', { name: 'Updated' });
    expect(apiClient.delete).toHaveBeenCalledWith('/user/collections/col-1');
    expect(created.id).toBe('col-1');
    expect(updated.name).toBe('Updated');
  });

  it('manages collection recipe operations', async () => {
    const service = RecipeApiService.getInstance();
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { ok: true } });
    (apiClient.delete as jest.Mock).mockResolvedValue({ data: { ok: true } });

    await service.addRecipeToCollection('recipe-1', 'col-1');
    await service.removeRecipeFromCollection('recipe-1', 'col-1');

    expect(apiClient.post).toHaveBeenCalledWith('/user/collections/col-1/recipes', { recipeId: 'recipe-1' });
    expect(apiClient.delete).toHaveBeenCalledWith('/user/collections/col-1/recipes/recipe-1');
  });

  it('handles analytics, rating, sharing, export, and import', async () => {
    const service = RecipeApiService.getInstance();
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { totalRecipes: 0, favoriteCount: 0, recentlyAddedCount: 0, popularCuisines: [], cookingTimeDistribution: {} } });
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { ok: true } });
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { shareUrl: 'url', shareCode: 'code' } });
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { downloadUrl: 'url', expiresAt: 'soon' } });
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { imported: 1, skipped: 0, errors: [] } });

    const analytics = await service.getRecipeAnalytics();
    await service.rateRecipe('recipe-1', 5, 'Great');
    const share = await service.shareRecipe('recipe-1', { format: 'json' });
    const exportData = await service.exportRecipes(['recipe-1'], 'json');
    const importResult = await service.importRecipes([{ id: '1' }], 'json');

    expect(analytics.totalRecipes).toBe(0);
    expect(share.shareCode).toBe('code');
    expect(exportData.downloadUrl).toBe('url');
    expect(importResult.imported).toBe(1);
  });

  it('handles taste profile and personalization endpoints', async () => {
    const service = RecipeApiService.getInstance();
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { profile: { userId: 'u1' }, learningInsights: { strongPreferences: [], suggestions: [], nextRecommendations: 0 } } });
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { profile: { userId: 'u1' }, learningInsights: { strongPreferences: [], suggestions: [], nextRecommendations: 0 } } });
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { userId: 'u1', totalRatings: 1, requiredForAccuracy: 3, currentAccuracy: 0.1, targetAccuracy: 0.8, progressPercentage: 10, milestones: [], insights: { strongestPreferences: [], needsMoreData: [], recommendations: '' } } });
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { id: 'gen-2', recipe: { id: 'recipe-2' } } });

    const learned = await service.learnUserPreferences();
    const profile = await service.getUserTasteProfile('u1');
    const progress = await service.getUserLearningProgress('u1');
    const personalized = await service.generatePersonalizedRecipe({ userId: 'u1' });

    expect(learned.profile.userId).toBe('u1');
    expect(profile.profile.userId).toBe('u1');
    expect(progress.userId).toBe('u1');
    expect(personalized.id).toBe('gen-2');
  });

  it('handles shopping optimization and translations', async () => {
    const service = RecipeApiService.getInstance();
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { optimizationId: 'opt-1' } });
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { optimizationId: 'opt-1', recipeIds: [], consolidatedIngredients: [], bulkSuggestions: [], optimizationMetrics: {}, estimatedTotalCost: 0, estimatedSavings: 0, createdAt: new Date() } });
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { original_recipe_id: 'r1', translated_recipe: { id: 'r1' }, target_language: 'es', translation_timestamp: 'now', cached: false } });
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { translations: { r1: { id: 'r1' } }, target_language: 'es', total_count: 1, successful_count: 1, failed_count: 0, cached_count: 0 } });
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { languages: ['en', 'es'], count: 2 } });

    const optimized = await service.optimizeShoppingList({ recipeIds: ['r1'], userId: 'u1' });
    const optimization = await service.getShoppingOptimization('opt-1');
    const translation = await service.translateRecipeToSpanish('r1');
    const batch = await service.batchTranslateRecipesToSpanish(['r1']);
    const languages = await service.getSupportedLanguages();

    expect(optimized.optimizationId).toBe('opt-1');
    expect(optimization.optimizationId).toBe('opt-1');
    expect(translation.original_recipe_id).toBe('r1');
    expect(batch.total_count).toBe(1);
    expect(languages.count).toBe(2);
  });

  it('generates recipe with auto-detected language', async () => {
    const service = RecipeApiService.getInstance();
    (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: 'gen-3', generationMetadata: { processingTime: 1 }, recipe: { id: 'recipe-3' } } });

    await service.generateRecipeWithLanguage({
      cuisineTypes: ['Mexican'],
      dietaryRestrictions: [],
      mealType: 'dinner',
      difficulty: 'beginner',
      cookingTime: 30,
      servings: 2,
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/recipe-ai/generate',
      expect.objectContaining({ target_language: 'es' }),
      expect.objectContaining({ timeout: 30000, retryable: false })
    );
  });

  it('returns degraded response on health check failure', async () => {
    const service = RecipeApiService.getInstance();
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('down'));

    const result = await service.healthCheck();

    expect(result.status).toBe('down');
    expect(result.services.database).toBe(false);
  });
});
