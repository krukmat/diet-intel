import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import SmartDietScreen from '../screens/SmartDietScreen';

// Mock the ApiService module properly
jest.mock('../services/ApiService', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    generateSmartRecommendations: jest.fn(),
  }
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
  translateFoodName: jest.fn((name) => Promise.resolve(`Translated ${name}`)),
  translateFoodNameSync: jest.fn((name) => `Translated ${name}`),
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
  const { apiService } = require('../services/ApiService');

  beforeEach(() => {
    jest.clearAllMocks();
    
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
      const { getByText, getByTestId } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );
      
      // Check main elements are present
      expect(getByText('Smart Diet')).toBeTruthy();
      expect(getByText('Today')).toBeTruthy();
      expect(getByText('Optimize')).toBeTruthy();
      expect(getByText('Discover')).toBeTruthy();
      expect(getByText('Insights')).toBeTruthy();
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
      const { getByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );
      
      // Wait for initial load
      await waitFor(() => {
        expect(apiService.get).toHaveBeenCalledWith(
          expect.stringContaining('context=today')
        );
      });
      
      // Switch to Optimize context
      fireEvent.press(getByText('Optimize'));
      
      await waitFor(() => {
        expect(apiService.get).toHaveBeenCalledWith(
          expect.stringContaining('context=optimize')
        );
        expect(apiService.get).toHaveBeenCalledWith(
          expect.stringContaining('current_meal_plan_id=test_plan_123')
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
      apiService.get.mockRejectedValue(new Error('Network error'));
      
      const { getByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );
      
      await waitFor(() => {
        expect(getByText('Failed to generate suggestions. Please try again.')).toBeTruthy();
        expect(getByText('Retry')).toBeTruthy();
      });
    });

    it('retries API call when retry button is pressed', async () => {
      // Mock initial error, then success
      apiService.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          data: {
            suggestions: [],
            total_suggestions: 0,
            avg_confidence: 0,
            generated_at: '2025-01-01T08:00:00Z'
          }
        });
      
      const { getByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );
      
      // Wait for error state
      await waitFor(() => {
        expect(getByText('Retry')).toBeTruthy();
      });
      
      // Press retry button
      fireEvent.press(getByText('Retry'));
      
      // Should make another API call
      await waitFor(() => {
        expect(apiService.get).toHaveBeenCalledTimes(2);
      });
    });

    it('handles optimize context without meal plan gracefully', async () => {
      // Mock no meal plan available
      const { getCurrentMealPlanId } = require('../utils/mealPlanUtils');
      getCurrentMealPlanId.mockResolvedValue(null);

      const { getByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );
      
      // Switch to optimize context
      fireEvent.press(getByText('Optimize'));
      
      await waitFor(() => {
        expect(getByText('Failed to generate suggestions. Please try again.')).toBeTruthy();
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
                  confidence_score: 0.8
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
        expect(getByText('Translated Oatmeal')).toBeTruthy();
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
    it('retrieves and uses meal plan ID for optimize context', async () => {
      const { getCurrentMealPlanId } = require('../utils/mealPlanUtils');
      getCurrentMealPlanId.mockResolvedValue('meal_plan_456');

      const { getByText } = render(
        <SmartDietScreen onBackPress={jest.fn()} />
      );
      
      fireEvent.press(getByText('Optimize'));
      
      await waitFor(() => {
        expect(getCurrentMealPlanId).toHaveBeenCalled();
        expect(apiService.get).toHaveBeenCalledWith(
          expect.stringContaining('current_meal_plan_id=meal_plan_456')
        );
      });
    });
  });
});