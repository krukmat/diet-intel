/**
 * Smart Diet Service Test Suite
 * Comprehensive testing for mobile service layer integration
 */

import {
  SmartDietService,
  SmartDietContext,
  SuggestionType,
  SuggestionCategory,
  smartDietService,
  type SmartDietResponse,
  type SmartSuggestion,
  type SuggestionFeedback,
  type SmartDietInsights,
  type OptimizationSuggestion,
} from '../SmartDietService';
import { apiService } from '../ApiService';
import {
  mockedAsyncStorage,
  mockApiService,
  resetSmartDietTestMocks,
} from '../../testUtils';

jest.mock('@react-native-async-storage/async-storage', () => {
  const { mockedAsyncStorage } = require('../../testUtils');
  return mockedAsyncStorage;
});

jest.mock('../ApiService', () => {
  const { mockApiService } = require('../../testUtils');
  return { apiService: mockApiService };
});

const mockedApiService = apiService as unknown as typeof mockApiService;

describe('SmartDietService', () => {
  let service: SmartDietService;
  const testUserId = 'test_user_123';

  beforeEach(() => {
    jest.clearAllMocks();
    resetSmartDietTestMocks();
    service = SmartDietService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SmartDietService.getInstance();
      const instance2 = SmartDietService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should use the exported singleton', () => {
      expect(smartDietService).toBeInstanceOf(SmartDietService);
    });
  });

  describe('getSmartSuggestions', () => {
    const mockSuggestion: SmartSuggestion = {
      id: 'today_suggestion_1',
      suggestion_type: SuggestionType.RECOMMENDATION,
      category: SuggestionCategory.MEAL_ADDITION,
      title: 'Greek Yogurt with Berries',
      description: 'Swap a sugary cereal for Greek yogurt topped with berries to boost protein and antioxidants.',
      reasoning: 'Keeps breakfast protein high while adding fiber-rich berries.',
      suggested_item: {
        name: 'Plain Greek Yogurt',
        barcode: '123456789',
        serving_size: '170g cup',
      },
      current_item: {
        name: 'Sweetened Yogurt',
        barcode: '987654321',
      },
      nutritional_benefit: {
        calories: 250,
        protein: 22,
        fat: 4,
        carbs: 29,
        fiber: 5,
      },
      calorie_impact: -60,
      macro_impact: {
        protein: 9,
        fat: -3,
        carbs: -15,
      },
      confidence_score: 0.85,
      priority_score: 0.8,
      meal_context: 'breakfast',
      planning_context: SmartDietContext.TODAY,
      implementation_complexity: 'simple',
      implementation_notes: 'Prepare the bowl the night before for easier mornings.',
      created_at: '2025-09-10T12:00:00Z',
      expires_at: '2025-09-11T12:00:00Z',
      tags: ['high_protein', 'antioxidants'],
    };

    const mockHighlight: SmartSuggestion = {
      ...mockSuggestion,
      id: 'highlight_today_1',
      title: 'Smoked Salmon Toast',
      description: 'Add smoked salmon to whole-grain toast for extra omega-3s at breakfast.',
      nutritional_benefit: {
        calories: 320,
        protein: 24,
        fat: 10,
        carbs: 32,
      },
      tags: ['omega_3', 'heart_health'],
    };

    const mockOptimization: OptimizationSuggestion = {
      ...mockSuggestion,
      id: 'optimization_today_1',
      suggestion_type: SuggestionType.OPTIMIZATION,
      category: SuggestionCategory.FOOD_SWAP,
      title: 'Swap granola for mixed nuts',
      description: 'Replace sugary granola with a portion of mixed nuts to improve fat quality.',
      reasoning: 'Reduces added sugars while improving healthy fat intake.',
      planning_context: SmartDietContext.OPTIMIZE,
      implementation_complexity: 'moderate',
      implementation_notes: 'Make the swap for afternoon snacks three times this week.',
      tags: ['food_swap', 'healthy_fats'],
      optimization_type: 'food_swap',
      target_improvement: {
        carbs: -18,
        fat: 9,
        protein: 4,
      },
    };

    const mockDiscovery: SmartSuggestion = {
      ...mockSuggestion,
      id: 'discover_snack_1',
      suggestion_type: SuggestionType.RECOMMENDATION,
      category: SuggestionCategory.DISCOVERY,
      title: 'Roasted Edamame Snack',
      description: 'Try roasted edamame for a crunchy, protein-rich afternoon snack.',
      planning_context: SmartDietContext.DISCOVER,
      tags: ['snack', 'fiber'],
    };

    const mockInsight: SmartSuggestion = {
      ...mockSuggestion,
      id: 'insight_macro_1',
      suggestion_type: SuggestionType.INSIGHT,
      category: SuggestionCategory.NUTRITIONAL_GAP,
      title: 'Increase daily omega-3 intake',
      description: 'Omega-3 intake has been below target for four consecutive days.',
      planning_context: SmartDietContext.INSIGHTS,
      tags: ['insight', 'trend'],
    };

    const mockResponse: SmartDietResponse = {
      user_id: testUserId,
      context_type: SmartDietContext.TODAY,
      generated_at: '2025-09-10T12:05:00Z',
      suggestions: [mockSuggestion],
      today_highlights: [mockHighlight],
      optimizations: [mockOptimization],
      discoveries: [mockDiscovery],
      insights: [mockInsight],
      nutritional_summary: {
        total_recommended_calories: 2100,
        macro_distribution: {
          protein_percent: 30,
          fat_percent: 30,
          carbs_percent: 40,
        },
        nutritional_gaps: ['omega-3', 'fiber'],
        health_benefits: ['Supports lean muscle', 'Improves satiety'],
      },
      personalization_factors: ['high_protein_focus', 'balanced_breakfasts'],
      total_suggestions: 1,
      avg_confidence: 0.85,
      generation_time_ms: 150,
    };

    it('should fetch suggestions from API when cache miss', async () => {
      // Setup cache miss
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      
      // Setup API response
      mockedApiService.get.mockResolvedValue({ data: mockResponse });

      const result = await service.getSmartSuggestions(SmartDietContext.TODAY, testUserId);

      expect(result).toEqual(mockResponse);
      expect(mockedApiService.get).toHaveBeenCalledWith(
        expect.stringContaining('/smart-diet/suggestions')
      );
      expect(mockedAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should return cached data when cache hit', async () => {
      // Setup cache hit
      const cachedData = {
        data: mockResponse,
        timestamp: Date.now() - 10000 // 10 seconds ago
      };
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.getSmartSuggestions(SmartDietContext.TODAY, testUserId);

      expect(result).toEqual(mockResponse);
      expect(mockedApiService.get).not.toHaveBeenCalled();
    });

    it('should handle expired cache correctly', async () => {
      // Setup expired cache
      const expiredCachedData = {
        data: mockResponse,
        timestamp: Date.now() - (31 * 60 * 1000) // 31 minutes ago (expired for TODAY context)
      };
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(expiredCachedData));
      mockedApiService.get.mockResolvedValue({ data: mockResponse });

      const result = await service.getSmartSuggestions(SmartDietContext.TODAY, testUserId);

      expect(result).toEqual(mockResponse);
      expect(mockedApiService.get).toHaveBeenCalled();
    });

    it('should use different TTL for different contexts', async () => {
      const discoverContext = SmartDietContext.DISCOVER;
      
      // Setup cache that's 1 hour old (should be valid for DISCOVER context)
      const cachedData = {
        data: { ...mockResponse, context_type: discoverContext },
        timestamp: Date.now() - (60 * 60 * 1000) // 1 hour ago
      };
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.getSmartSuggestions(discoverContext, testUserId);

      expect(result.context_type).toBe(discoverContext);
      expect(mockedApiService.get).not.toHaveBeenCalled(); // Should use cache
    });

    it('supports flexible options object signature with camelCase keys', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);

      const optimizeSuggestion: OptimizationSuggestion = {
        ...mockOptimization,
        id: 'optimize_primary_1',
        title: 'Rebalance lunch macros',
        description: 'Shift 15g of carbs to protein at lunch for better satiety.',
        target_improvement: {
          protein: 15,
          carbs: -20,
        },
        tags: ['macro_balance'],
      };

      const optimizeResponse: SmartDietResponse = {
        ...mockResponse,
        context_type: SmartDietContext.OPTIMIZE,
        suggestions: [optimizeSuggestion],
        today_highlights: [],
        optimizations: [optimizeSuggestion],
        discoveries: [],
        insights: [],
        personalization_factors: ['optimize_plan_focus'],
        total_suggestions: 1,
        avg_confidence: optimizeSuggestion.confidence_score,
      };

      mockedApiService.get.mockResolvedValue({ data: optimizeResponse });

      const result = await service.getSmartSuggestions(SmartDietContext.OPTIMIZE, {
        userId: testUserId,
        max_suggestions: 5,
        includeHistory: false,
        includeRecommendations: false,
        mealContext: 'lunch',
        currentMealPlanId: 'plan_42',
        calorieBudget: 1800,
        targetMacros: { protein: 120 },
        preferences: {
          dietaryRestrictions: ['vegetarian'],
          cuisinePreferences: ['mediterranean'],
          excludedIngredients: ['nuts'],
        },
      });

      expect(result).toEqual(optimizeResponse);

      const [calledUrl] = mockedApiService.get.mock.calls[0] ?? [];
      expect(typeof calledUrl).toBe('string');

      const queryString = String(calledUrl).split('?')[1];
      expect(queryString).toBeDefined();
      const params = new URLSearchParams(queryString ?? '');

      expect(params.get('context')).toBe(SmartDietContext.OPTIMIZE);
      expect(params.get('user_id')).toBe(testUserId);
      expect(params.get('max_suggestions')).toBe('5');
      expect(params.get('include_optimizations')).toBe('false');
      expect(params.get('include_recommendations')).toBe('false');
      expect(params.get('meal_context')).toBe('lunch');
      expect(params.get('current_meal_plan_id')).toBe('plan_42');
      expect(params.get('calorie_budget')).toBe('1800');
      expect(params.get('dietary_restrictions')).toBe('vegetarian');
      expect(params.get('cuisine_preferences')).toBe('mediterranean');
      expect(params.get('excluded_ingredients')).toBe('nuts');
      expect(params.get('target_macros')).toBe(JSON.stringify({ protein: 120 }));
    });

    it('should fallback to expired cache when API fails', async () => {
      // Setup expired cache
      const expiredCachedData = {
        data: mockResponse,
        timestamp: Date.now() - (2 * 60 * 60 * 1000) // 2 hours ago
      };
      mockedAsyncStorage.getItem
        .mockResolvedValueOnce(JSON.stringify(expiredCachedData)) // First call (normal cache check)
        .mockResolvedValueOnce(JSON.stringify(expiredCachedData)); // Second call (fallback)

      // Setup API failure
      mockedApiService.get.mockRejectedValue(new Error('Network error'));

      const result = await service.getSmartSuggestions(SmartDietContext.TODAY, testUserId);

      expect(result).toEqual(mockResponse);
      expect(mockedApiService.get).toHaveBeenCalled();
    });

    it('should throw error when both API and cache fail', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      mockedApiService.get.mockRejectedValue(new Error('Network error'));

      await expect(
        service.getSmartSuggestions(SmartDietContext.TODAY, testUserId)
      ).rejects.toThrow('Failed to fetch Smart Diet suggestions');
    });
  });

  describe('submitSuggestionFeedback', () => {
    const mockFeedback: SuggestionFeedback = {
      suggestion_id: 'test_suggestion_1',
      user_id: testUserId,
      action: 'accepted',
      satisfaction_rating: 5,
      meal_context: 'breakfast'
    };

    it('should submit feedback successfully', async () => {
      mockedApiService.post.mockResolvedValue({ data: { success: true } });
      mockedAsyncStorage.multiRemove.mockResolvedValue();

      await service.submitSuggestionFeedback(mockFeedback);

      expect(mockedApiService.post).toHaveBeenCalledWith(
        expect.stringContaining('/smart-diet/feedback'),
        mockFeedback
      );
      expect(mockedAsyncStorage.multiRemove).toHaveBeenCalled(); // Cache invalidation
    });

    it('should handle feedback submission errors', async () => {
      mockedApiService.post.mockRejectedValue(new Error('Server error'));

      await expect(
        service.submitSuggestionFeedback(mockFeedback)
      ).rejects.toThrow('Failed to submit feedback');
    });
  });

  describe('getDietInsights', () => {
    const mockInsights: SmartDietInsights = {
      period: 'week',
      user_id: testUserId,
      analysis_date: '2025-09-10T12:00:00Z',
      nutritional_gaps: { protein: -10, fiber: 5 },
      macro_trends: { protein: [20, 25, 30], carbs: [50, 45, 40] },
      calorie_trends: [1800, 2000, 1900],
      eating_patterns: { meals_per_day: 3.2 },
      successful_suggestions: [],
      ignored_suggestions: [],
      priority_improvements: ['increase_protein', 'add_fiber'],
      suggested_changes: [],
      goal_progress: { weight_loss: 0.75 },
      improvement_score: 0.8
    };

    it('should fetch insights from API when cache miss', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      mockedApiService.get.mockResolvedValue({ data: mockInsights });

      const result = await service.getDietInsights(testUserId, 'week');

      expect(result).toEqual(mockInsights);
      expect(mockedApiService.get).toHaveBeenCalledWith(
        expect.stringContaining('/smart-diet/insights'),
        expect.objectContaining({
          params: { user_id: testUserId, period: 'week' }
        })
      );
    });

    it('should return cached insights when available', async () => {
      const cachedData = {
        data: mockInsights,
        timestamp: Date.now() - 1000 // 1 second ago
      };
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.getDietInsights(testUserId, 'week');

      expect(result).toEqual(mockInsights);
      expect(mockedApiService.get).not.toHaveBeenCalled();
    });

    it('should use default period when not specified', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      mockedApiService.get.mockResolvedValue({ data: mockInsights });

      await service.getDietInsights(testUserId);

      expect(mockedApiService.get).toHaveBeenCalledWith(
        expect.stringContaining('/smart-diet/insights'),
        expect.objectContaining({
          params: { user_id: testUserId, period: 'week' }
        })
      );
    });
  });

  describe('optimizeMealPlan', () => {
    const mockApplyResponse = {
      success: true,
      applied: 1,
      plan: { plan_id: 'plan_123', meals: [] }
    };

    it('should optimize meal plan successfully', async () => {
      mockedApiService.post.mockResolvedValue({
        data: mockApplyResponse
      });

      const result = await service.optimizeMealPlan('plan_123', [
        { change_type: 'meal_swap', old_barcode: '111', new_barcode: '222' }
      ]);

      expect(result).toEqual(mockApplyResponse);
      expect(mockedApiService.post).toHaveBeenCalledWith(
        expect.stringContaining('/smart-diet/optimizations/apply'),
        {
          plan_id: 'plan_123',
          changes: [{ change_type: 'meal_swap', old_barcode: '111', new_barcode: '222' }]
        }
      );
    });

    it('should handle empty optimization response', async () => {
      mockedApiService.post.mockResolvedValue({ data: {} });

      const result = await service.optimizeMealPlan('plan_123', [
        { change_type: 'meal_swap', old_barcode: '111', new_barcode: '222' }
      ]);

      expect(result).toEqual({});
    });

    it('should handle optimization errors', async () => {
      mockedApiService.post.mockRejectedValue(new Error('Optimization failed'));

      await expect(
        service.optimizeMealPlan('plan_123', [
          { change_type: 'meal_swap', old_barcode: '111', new_barcode: '222' }
        ])
      ).rejects.toThrow('Failed to optimize meal plan');
    });
  });

  describe('invalidateUserCache', () => {
    it('should remove all user-specific cache keys', async () => {
      mockedAsyncStorage.multiRemove.mockResolvedValue();

      await service.invalidateUserCache(testUserId);

      expect(mockedAsyncStorage.multiRemove).toHaveBeenCalledWith(
        expect.arrayContaining([
          `smart_diet_today_${testUserId}`,
          `smart_diet_optimize_${testUserId}`,
          `smart_diet_discover_${testUserId}`,
          `smart_diet_insights_${testUserId}`,
          `insights_${testUserId}_day`,
          `insights_${testUserId}_week`,
          `insights_${testUserId}_month`
        ])
      );
    });

    it('should handle cache invalidation errors gracefully', async () => {
      mockedAsyncStorage.multiRemove.mockRejectedValue(new Error('Storage error'));

      // Should not throw
      await expect(service.invalidateUserCache(testUserId)).resolves.toBeUndefined();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics for user', async () => {
      // Mock cache data for TODAY context
      const todayCacheData = {
        data: { test: 'data' },
        timestamp: Date.now() - 10000 // 10 seconds ago
      };
      
      mockedAsyncStorage.getItem
        .mockImplementation((key: string) => {
          if (key.includes('smart_diet_today')) {
            return Promise.resolve(JSON.stringify(todayCacheData));
          }
          return Promise.resolve(null);
        });

      const stats = await service.getCacheStats(testUserId);

      expect(stats.userId).toBe(testUserId);
      expect(stats.contexts.today.exists).toBe(true);
      expect(stats.contexts.today.expired).toBe(false);
      expect(stats.contexts.optimize.exists).toBe(false);
    });

    it('should handle cache stats errors gracefully', async () => {
      mockedAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const stats = await service.getCacheStats(testUserId);

      expect(stats.userId).toBe(testUserId);
      expect(stats.contexts).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    it('should measure API response time', async () => {
      const mockResponse = {
        user_id: testUserId,
        context_type: SmartDietContext.TODAY,
        suggestions: [],
        total_suggestions: 0,
        avg_confidence: 0
      };

      mockedAsyncStorage.getItem.mockResolvedValue(null);
      
      // Simulate slow API response
      mockedApiService.get.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: mockResponse }), 100)
        )
      );

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.getSmartSuggestions(SmartDietContext.TODAY, testUserId);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/⚡ Smart Diet API response time: \d+ms/)
      );

      consoleSpy.mockRestore();
    });

    it('should prefer cache over API for performance', async () => {
      const cachedData = {
        data: { test: 'cached data' },
        timestamp: Date.now() - 5000 // 5 seconds ago
      };
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(cachedData));

      const startTime = Date.now();
      await service.getSmartSuggestions(SmartDietContext.TODAY, testUserId);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
      expect(mockedApiService.get).not.toHaveBeenCalled();
    });
  });
});
