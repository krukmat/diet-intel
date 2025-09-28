import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SmartDietScreen from '../screens/SmartDietScreen';
import { apiService } from '../services/ApiService';

// Mock the ApiService module properly (matches current implementation surface)
jest.mock('../services/ApiService', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    generateSmartRecommendations: jest.fn(),
    addProductToPlan: jest.fn(),
    recordSmartDietFeedback: jest.fn(),
  }
}));

// Mock the Auth context hook used inside SmartDietScreen
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test_user',
      email: 'test@example.com',
    },
    signIn: jest.fn(),
    signOut: jest.fn(),
  })
}));

// Provide an in-memory AsyncStorage mock to support SmartDietService caching
const mockAsyncStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store.clear();
      return Promise.resolve();
    }),
    __reset: () => store.clear(),
  };
})();

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock notification service to avoid touching Expo APIs during tests
jest.mock('../services/NotificationService', () => ({
  notificationService: {
    getConfig: jest.fn().mockResolvedValue({
      enabled: true,
      dailySuggestionTime: '09:00',
      reminderInterval: 24,
      preferredContexts: ['today', 'insights'],
    }),
    updateConfig: jest.fn(),
    triggerSmartDietNotification: jest.fn(),
  },
}));

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as any;

// Mock meal plan utils
jest.mock('../utils/mealPlanUtils', () => ({
  getCurrentMealPlanId: jest.fn(() => Promise.resolve('test_plan_123')),
  storeMealPlanId: jest.fn(),
}));

// Mock food translation utils
jest.mock('../utils/foodTranslation', () => ({
  translateFoodName: jest.fn((name) => Promise.resolve(name)),
  translateFoodNameSync: jest.fn((name) => name),
}));

// Mock environment config
jest.mock('../config/environment', () => ({
  API_BASE_URL: 'http://localhost:8000',
}));

// Enhanced i18n mock with translation mapping
const mockTranslations = {
  'smartDiet.title': 'Smart Diet',
  'smartDiet.loading': 'Loading recommendations...',
  'smartDiet.contexts.today': 'Today',
  'smartDiet.contexts.optimize': 'Optimize',
  'smartDiet.contexts.discover': 'Discover',
  'smartDiet.contexts.insights': 'Insights',
  'smartDiet.noSuggestions': 'No suggestions available at the moment.',
  'smartDiet.error.failed': 'Failed to generate suggestions. Please try again.',
  'smartDiet.retry': 'Retry',
  'smartDiet.preferences.apply': 'Apply',
  'common.back': 'Back',
};

// Override the i18n mock to use actual translations
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(() => ({
    t: jest.fn((key: string) => mockTranslations[key] || key),
    i18n: {
      language: 'en',
      changeLanguage: jest.fn(() => Promise.resolve())
    }
  })),
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn()
  }
}));

describe('SmartDietScreen POC Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.__reset();

    // Mock successful API response
    apiService.get.mockResolvedValue({
      data: {
        user_id: 'test_user',
        context: 'today',
        suggestions: [
          {
            id: 'suggestion_001',
            suggestion_type: 'meal_recommendation',
            category: 'breakfast',
            title: 'Greek Yogurt with Berries',
            description: 'High-protein breakfast option with antioxidants',
            action_text: 'Add to breakfast',
            confidence_score: 0.85,
            priority: 1,
            metadata: {
              reasons: ['High protein content', 'Low calories', 'Fits breakfast profile'],
              meal_timing: 'breakfast',
              nutrition: {
                calories: 150,
                protein: 15,
                carbs: 20,
                fat: 2
              }
            },
            created_at: '2025-01-01T08:00:00Z'
          }
        ],
        total_suggestions: 1,
        avg_confidence: 0.85,
        generated_at: '2025-01-01T08:00:00Z',
        insights: {
          calories_today: 968,
          target_calories: 2000,
          macro_balance: {
            protein_percent: 16.6,
            fat_percent: 27.4,
            carbs_percent: 52.4
          },
          improvement_areas: ['Increase protein intake', 'Add more fiber'],
          health_benefits: ['Improved protein intake', 'Better micronutrient profile']
        }
      }
    });
  });

  describe('Basic Rendering and Navigation', () => {
    it('renders correctly with proper structure', async () => {
      const { findByText, getAllByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );
      
      // Check main elements are present once loading completes
      expect(await findByText(/Smart Diet/)).toBeTruthy();
      await waitFor(() => {
        expect(getAllByText('Today').length).toBeGreaterThan(0);
        expect(getAllByText('Optimize').length).toBeGreaterThan(0);
        expect(getAllByText('Discover').length).toBeGreaterThan(0);
        expect(getAllByText('Insights').length).toBeGreaterThan(0);
      });
    });

    it('shows loading state initially', () => {
      const { getByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );
      
      expect(getByText('Loading recommendations...')).toBeTruthy();
    });

    it('displays suggestions after loading completes', async () => {
      const { getByText, queryByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(queryByText('Loading recommendations...')).toBeNull();
      });
      
      // Check suggestion content is displayed
      expect(getByText('Greek Yogurt with Berries')).toBeTruthy();
      expect(getByText('High-protein breakfast option with antioxidants')).toBeTruthy();
    });
  });

  describe('Context Switching', () => {
    it('switches between different contexts', async () => {
      const { getByText, findByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );
      
      // Wait for initial load
      await waitFor(() => {
        expect(apiService.get).toHaveBeenCalledWith(
          expect.stringContaining('context=today')
        );
      });
      
      const optimizeButton = await findByText('Optimize');
      fireEvent.press(optimizeButton);
      
      await waitFor(() => {
        expect(apiService.get).toHaveBeenCalledWith(
          expect.stringContaining('context=optimize')
        );
      });
    });

    it('handles context switching with loading states', async () => {
      let resolvePromise: (value: any) => void;
      const delayedPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      apiService.get.mockReturnValueOnce(delayedPromise);

      const { getByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );
      
      // Should show loading initially
      expect(getByText('Loading recommendations...')).toBeTruthy();
      
      // Resolve the promise
      resolvePromise!({
        data: {
          suggestions: [],
          total_suggestions: 0,
          avg_confidence: 0,
          generated_at: '2025-01-01T08:00:00Z'
        }
      });
      
      // Loading should disappear
      await waitFor(() => {
        expect(getByText('No suggestions available at the moment.')).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      apiService.get.mockRejectedValueOnce(new Error('Network error'));
      apiService.generateSmartRecommendations.mockResolvedValueOnce({
        data: {
          user_id: 'test_user',
          total_recommendations: 0,
          avg_confidence: 0,
          generated_at: '2025-01-01T08:00:00Z',
          meal_recommendations: [],
          nutritional_insights: {
            total_recommended_calories: 0,
            macro_distribution: {}
          }
        }
      });

      const { findByText, findAllByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );

      await waitFor(() => {
        expect(apiService.generateSmartRecommendations).toHaveBeenCalled();
      });

      expect(await findByText('No suggestions available at the moment.')).toBeTruthy();
    });

    it('refreshes suggestions when retrying after an error', async () => {
      apiService.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          data: {
            suggestions: [],
            total_suggestions: 0,
            avg_confidence: 0,
            generated_at: '2025-01-01T08:05:00Z'
          }
        });

      const { findByText, findAllByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );

      const refreshButton = await findByText('🔄 Refresh Suggestions');
      fireEvent.press(refreshButton);

      await waitFor(() => {
        expect(apiService.get).toHaveBeenCalledTimes(2);
      });
    });

    it('handles optimize context without meal plan gracefully', async () => {
      // Mock no meal plan available
      const { getCurrentMealPlanId } = require('../utils/mealPlanUtils');
      getCurrentMealPlanId.mockResolvedValue(null);

      const { findByText, getAllByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );

      const optimizeButton = await findByText('Optimize');
      fireEvent.press(optimizeButton);

      await waitFor(() => {
        expect(getCurrentMealPlanId).toHaveBeenCalled();
      });

      expect(apiService.get).toHaveBeenCalledTimes(1);
      expect(apiService.generateSmartRecommendations).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(getAllByText('Optimize').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Legacy API Fallback', () => {
    it('falls back to legacy recommendations API when smart diet fails', async () => {
      // Mock smart diet API failure
      apiService.get.mockRejectedValue(new Error('Smart Diet API not available'));
      
      // Mock legacy API success
      apiService.generateSmartRecommendations.mockResolvedValue({
        data: {
          user_id: 'test_user',
          total_recommendations: 1,
          avg_confidence: 0.8,
          generated_at: '2025-01-01T08:00:00Z',
          meal_recommendations: [
            {
              meal_name: 'breakfast',
              recommendations: [
                {
                  name: 'Oatmeal',
                  brand: 'Quaker',
                  calories_per_serving: 150,
                  serving_size: '1 cup',
                  confidence_score: 0.8,
                  protein_g: 5,
                  fat_g: 3,
                  carbs_g: 27,
                  barcode: '9876543210',
                  reasons: ['Fiber rich']
                }
              ]
            }
          ],
          nutritional_insights: {
            total_recommended_calories: 1800,
            macro_distribution: {
              protein_percent: 20,
              fat_percent: 25,
              carbs_percent: 55
            }
          }
        }
      });
      
      const { getByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );
      
      await waitFor(() => {
        expect(apiService.generateSmartRecommendations).toHaveBeenCalled();
        expect(getByText('Oatmeal')).toBeTruthy();
      });
    });
  });

  describe('API Integration', () => {
    it('uses correct API endpoint format', async () => {
      render(<SmartDietScreen onBackPress={jest.fn()} />);
      
      await waitFor(() => {
        expect(apiService.get).toHaveBeenCalledWith(
          expect.stringMatching(/\/smart-diet\/suggestions\?/)
        );
      });
    });

    it('includes proper query parameters', async () => {
      render(<SmartDietScreen onBackPress={jest.fn()} />);
      
      await waitFor(() => {
        const callArgs = apiService.get.mock.calls[0][0];
        expect(callArgs).toContain('context=today');
        expect(callArgs).toContain('max_suggestions=10');
        expect(callArgs).toContain('include_history=true');
        expect(callArgs).toContain('lang=en');
      });
    });
  });

  describe('AsyncStorage Integration', () => {
    it('retrieves meal plan ID for optimize context', async () => {
      const { getCurrentMealPlanId } = require('../utils/mealPlanUtils');
      getCurrentMealPlanId.mockResolvedValue('meal_plan_456');

      const { findByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );

      const optimizeButton = await findByText('Optimize');
      fireEvent.press(optimizeButton);

      await waitFor(() => {
        expect(getCurrentMealPlanId).toHaveBeenCalled();
        expect(apiService.get).toHaveBeenCalledWith(
          expect.stringContaining('context=optimize')
        );
      });

      await expect(findByText('No meal plan found. Please generate a meal plan first from the Plan tab.')).rejects.toThrow();
    });
  });
});
