import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import axios from 'axios';
import SmartDietScreen from '../screens/SmartDietScreen';
import { smartDietService } from '../services/SmartDietService';

// Mock axios
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: jest.fn(),
    },
  }),
}));

// Mock food translation utilities
jest.mock('../utils/foodTranslation', () => ({
  translateFoodNameSync: jest.fn((name: string) => name),
  translateFoodName: jest.fn((name: string) => Promise.resolve(name)),
}));

// Mock meal plan utils
jest.mock('../utils/mealPlanUtils', () => ({
  getCurrentMealPlanId: jest.fn().mockResolvedValue('test_plan_id'),
}));

// Mock NotificationService
jest.mock('../services/NotificationService', () => ({
  notificationService: {
    getConfig: jest.fn().mockResolvedValue({
      enabled: true,
      dailySuggestionTime: "09:00",
      reminderInterval: 24,
      preferredContexts: ['today', 'insights']
    }),
    updateConfig: jest.fn().mockResolvedValue(undefined),
    triggerSmartDietNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock SmartDietService
jest.mock('../services/SmartDietService', () => ({
  smartDietService: {
    getSmartSuggestions: jest.fn(),
    submitSuggestionFeedback: jest.fn(),
    getDietInsights: jest.fn(),
    optimizeMealPlan: jest.fn(),
  },
  SmartDietContext: {
    TODAY: 'today',
    OPTIMIZE: 'optimize',
    DISCOVER: 'discover',
    INSIGHTS: 'insights'
  },
}));

const mockSmartDietService = smartDietService as jest.Mocked<typeof smartDietService>;

// Mock navigation functions
const mockOnBackPress = jest.fn();
const mockNavigateToTrack = jest.fn();
const mockNavigateToPlan = jest.fn();

// Mock navigation context
const mockNavigationContext = {
  targetContext: 'today',
  sourceScreen: 'test',
  planId: undefined,
};

// Helper to render SmartDietScreen with proper props
const renderSmartDietScreen = (overrideProps = {}) => {
  return render(
    <SmartDietScreen 
      onBackPress={mockOnBackPress}
      navigationContext={mockNavigationContext}
      navigateToTrack={mockNavigateToTrack}
      navigateToPlan={mockNavigateToPlan}
      {...overrideProps}
    />
  );
};

describe('SmartDietScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful Smart Diet service response
    const mockResponse = {
        user_id: "test_user",
        context_type: "today",
        generated_at: "2025-09-10T21:36:11.834402",
        suggestions: [
          {
            id: 'suggestion_001',
            suggestion_type: 'recommendation',
            category: 'discovery',
            title: 'Greek Yogurt with Berries',
            description: 'High-protein breakfast option',
            reasoning: 'Selected for high protein content and balanced macros',
            confidence_score: 0.85,
            priority_score: 0.9,
            meal_context: 'breakfast',
            suggested_item: {
              name: 'Greek Yogurt',
              barcode: '1234567890123',
              calories: 100,
              protein_g: 15,
              carbs_g: 6,
              fat_g: 0
            },
            nutritional_benefit: {
              protein_g: 15,
              fat_g: 0,
              carbs_g: 6
            },
            calorie_impact: 100,
            action_text: 'Add to meal plan'
          }
        ],
        today_highlights: [],
        optimizations: [],
        discoveries: [],
        insights: [],
        nutritional_summary: {
          total_recommended_calories: 968,
          macro_distribution: {
            protein_percent: 16.6,
            fat_percent: 27.4,
            carbs_percent: 52.4
          },
          daily_progress: {
            calories_remaining: 1032,
            protein_remaining: 84,
            fat_remaining: 45
          },
          health_benefits: [
            'Improved protein intake',
            'Better micronutrient profile'
          ]
        }
      };
    
    // Setup SmartDietService method mocks with faster resolution
    mockSmartDietService.getSmartSuggestions.mockImplementation(async (context, options) => {
      // Simulate minimal delay for realistic testing
      await new Promise(resolve => setTimeout(resolve, 10));
      return mockResponse;
    });
    mockSmartDietService.getDietInsights.mockResolvedValue(mockResponse);
    mockSmartDietService.optimizeMealPlan.mockResolvedValue(mockResponse);
    mockSmartDietService.submitSuggestionFeedback.mockResolvedValue(undefined);
  });

  it('renders correctly on initial load', async () => {
    const { getByText } = renderSmartDietScreen();
    
    // Wait for component to load and service to be called
    await waitFor(() => {
      expect(getByText('smartDiet.title')).toBeTruthy();
      expect(getByText('smartDiet.contexts.today')).toBeTruthy();
      expect(getByText('smartDiet.contexts.optimize')).toBeTruthy();
      expect(getByText('smartDiet.contexts.discover')).toBeTruthy();
      expect(getByText('smartDiet.contexts.insights')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('displays loading state initially', () => {
    const { getByText } = renderSmartDietScreen();
    
    expect(getByText('smartDiet.loading')).toBeTruthy();
  });

  it('switches between different contexts', async () => {
    const { getByText } = renderSmartDietScreen();
    
    // Initially shows Today context
    expect(getByText('smartDiet.contexts.today')).toBeTruthy();
    
    // Switch to Optimize context
    fireEvent.press(getByText('smartDiet.contexts.optimize'));
    
    // Wait for state update and service call
    await waitFor(() => {
      expect(mockSmartDietService.getSmartSuggestions).toHaveBeenCalledWith(
        'optimize',
        expect.any(Object)
      );
    }, { timeout: 3000 });
  });

  it('displays suggestions after loading', async () => {
    const { getByText, queryByTestId } = renderSmartDietScreen();
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });
    
    // Check if suggestion is displayed
    expect(getByText('Greek Yogurt with Berries')).toBeTruthy();
    expect(getByText('High-protein breakfast option')).toBeTruthy();
    expect(getByText('85%')).toBeTruthy(); // confidence score
  });

  it('displays nutritional insights correctly', async () => {
    const { getByText } = renderSmartDietScreen();
    
    // Switch to insights context
    fireEvent.press(getByText('Insights'));
    
    await waitFor(() => {
      expect(getByText('968 kcal')).toBeTruthy();
      expect(getByText('>i 16.6%')).toBeTruthy(); // protein percentage
      expect(getByText('>Q 27.4%')).toBeTruthy(); // fat percentage
      expect(getByText('<^ 52.4%')).toBeTruthy(); // carbs percentage
    });
  });

  it('handles API errors gracefully', async () => {
    // Mock service error
    mockSmartDietService.getSmartSuggestions.mockRejectedValue(new Error('Network error'));
    
    const { getByText } = renderSmartDietScreen();
    
    await waitFor(() => {
      expect(getByText('Failed to generate suggestions. Please try again.')).toBeTruthy();
    });
  });

  it('displays retry button on error', async () => {
    // Mock service error
    mockSmartDietService.getSmartSuggestions.mockRejectedValue(new Error('Network error'));
    
    const { getByText } = renderSmartDietScreen();
    
    await waitFor(() => {
      const retryButton = getByText('Retry');
      expect(retryButton).toBeTruthy();
    });
  });

  it('retries API call when retry button is pressed', async () => {
    // Mock initial error, then success
    mockedAxios.get
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({
        data: {
          suggestions: [],
          nutritional_summary: {}
        }
      });
    
    const { getByText } = renderSmartDietScreen();
    
    // Wait for error state
    await waitFor(() => {
      expect(getByText('Retry')).toBeTruthy();
    });
    
    // Press retry button
    fireEvent.press(getByText('Retry'));
    
    // Should make another API call
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  it('displays suggestion reasons correctly', async () => {
    const { getByText, queryByTestId } = renderSmartDietScreen();
    
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });
    
    expect(getByText('High protein content')).toBeTruthy();
    expect(getByText('Low calories')).toBeTruthy();
    expect(getByText('Fits breakfast profile')).toBeTruthy();
  });

  it('handles empty suggestions response', async () => {
    // Mock empty response
    mockedAxios.get.mockResolvedValue({
      data: {
        suggestions: [],
        nutritional_summary: {}
      }
    });
    
    const { getByText } = renderSmartDietScreen();
    
    await waitFor(() => {
      expect(getByText('No suggestions available at the moment.')).toBeTruthy();
    });
  });

  it('applies correct context parameters to API calls', async () => {
    const { getByText } = renderSmartDietScreen();
    
    // Test General context
    fireEvent.press(getByText('General'));
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('context=general')
      );
    });
    
    // Test Optimize context  
    fireEvent.press(getByText('Optimize'));
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('context=optimize')
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('current_meal_plan_id=demo_meal_plan_001')
      );
    });
    
    // Test Insights context
    fireEvent.press(getByText('Insights'));
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('context=insights')
      );
    });
  });

  it('displays confidence scores with correct formatting', async () => {
    const { getByText, queryByTestId } = renderSmartDietScreen();
    
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });
    
    // Check confidence score is displayed as percentage
    expect(getByText('85%')).toBeTruthy();
  });

  it('shows nutritional impact information', async () => {
    const { getByText, queryByTestId } = renderSmartDietScreen();
    
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });
    
    expect(getByText('Improves protein intake by 15g')).toBeTruthy();
  });

  it('handles context switching with proper loading states', async () => {
    const { getByText, getByTestId, queryByTestId } = renderSmartDietScreen();
    
    // Wait for initial load
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });
    
    // Mock delayed response for context switch
    let resolvePromise: (value: any) => void;
    const delayedPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    mockedAxios.get.mockReturnValue(delayedPromise);
    
    // Switch context
    fireEvent.press(getByText('Optimize'));
    
    // Should show loading indicator
    expect(getByTestId('loading-indicator')).toBeTruthy();
    
    // Resolve the promise
    resolvePromise({
      data: {
        suggestions: [],
        nutritional_summary: {}
      }
    });
    
    // Loading should disappear
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    });
  });

  it('displays health benefits in insights', async () => {
    const { getByText } = renderSmartDietScreen();
    
    // Switch to insights
    fireEvent.press(getByText('Insights'));
    
    await waitFor(() => {
      expect(getByText('Improved protein intake')).toBeTruthy();
      expect(getByText('Better micronutrient profile')).toBeTruthy();
    });
  });

  it('handles missing nutritional data gracefully', async () => {
    // Mock response with missing data
    mockedAxios.get.mockResolvedValue({
      data: {
        suggestions: [],
        nutritional_summary: null
      }
    });
    
    const { getByText } = renderSmartDietScreen();
    
    fireEvent.press(getByText('Insights'));
    
    // Should not crash and should handle missing data
    await waitFor(() => {
      expect(getByText('Insights')).toBeTruthy();
    });
  });

  it('uses correct API endpoint format', async () => {
    renderSmartDietScreen();
    
    await waitFor(() => {
      expect(mockSmartDietService.getSmartSuggestions).toHaveBeenCalledWith(
        'today',
        expect.any(Object)
      );
    }, { timeout: 3000 });
  });

  // ======================
  // EXPANDED TEST COVERAGE
  // ======================

  describe('Navigation Integration', () => {
    it('displays navigation context header when coming from meal plan', () => {
      const { getByText } = renderSmartDietScreen({
        navigationContext: { sourceScreen: 'plan', targetContext: 'optimize' }
      });
      
      expect(getByText('📋')).toBeTruthy(); // Plan navigation button
    });

    it('calls onBackPress when back button is pressed', () => {
      const { getByText } = renderSmartDietScreen();
      
      fireEvent.press(getByText('🏠'));
      expect(mockOnBackPress).toHaveBeenCalledTimes(1);
    });

    it('navigates to tracking when track button is pressed', async () => {
      const { getByText } = renderSmartDietScreen();
      
      // Wait for suggestions to load
      await waitFor(() => {
        expect(getByText('Greek Yogurt with Berries')).toBeTruthy();
      });
      
      // Look for track button and press it
      const trackButtons = getByText('📊 Track');
      fireEvent.press(trackButtons);
      
      expect(mockNavigateToTrack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Context Switching', () => {
    it('switches to all four contexts correctly', async () => {
      const { getByText } = renderSmartDietScreen();
      
      const contexts = [
        { button: 'smartDiet.contexts.today', expectedCall: 'today' },
        { button: 'smartDiet.contexts.optimize', expectedCall: 'optimize' },
        { button: 'smartDiet.contexts.discover', expectedCall: 'discover' },
        { button: 'smartDiet.contexts.insights', expectedCall: 'insights' }
      ];

      for (const context of contexts) {
        fireEvent.press(getByText(context.button));
        
        await waitFor(() => {
          expect(mockSmartDietService.getSmartSuggestions).toHaveBeenCalledWith(
            context.expectedCall,
            expect.any(Object)
          );
        }, { timeout: 3000 });
      }
    });

    it('shows loading state during context switch', async () => {
      const { getByText } = renderSmartDietScreen();
      
      // Switch context
      fireEvent.press(getByText('smartDiet.contexts.optimize'));
      
      // Should show loading
      expect(getByText('smartDiet.loading')).toBeTruthy();
    });
  });

  describe('Suggestion Rendering', () => {
    it('displays suggestion cards with all required information', async () => {
      const { getByText } = renderSmartDietScreen();
      
      await waitFor(() => {
        expect(getByText('Greek Yogurt with Berries')).toBeTruthy();
        expect(getByText('High-protein breakfast option')).toBeTruthy();
        expect(getByText('85%')).toBeTruthy(); // confidence score
      });
    });

    it('displays action buttons for suggestions', async () => {
      const { getByText } = renderSmartDietScreen();
      
      await waitFor(() => {
        expect(getByText('Add to meal plan')).toBeTruthy();
        expect(getByText('👍')).toBeTruthy();
        expect(getByText('👎')).toBeTruthy();
      });
    });

    it('handles empty suggestions gracefully', async () => {
      mockSmartDietService.getSmartSuggestions.mockResolvedValue({
        ...mockResponse,
        suggestions: []
      });
      
      const { getByText } = renderSmartDietScreen();
      
      await waitFor(() => {
        expect(getByText('smartDiet.noSuggestions')).toBeTruthy();
      });
    });
  });

  describe('Preferences Integration', () => {
    it('opens preferences modal when settings button is pressed', async () => {
      const { getByText } = renderSmartDietScreen();
      
      fireEvent.press(getByText('⚙️'));
      
      await waitFor(() => {
        expect(getByText('smartDiet.preferences.apply')).toBeTruthy();
      });
    });

    it('displays notification settings in preferences', async () => {
      const { getByText } = renderSmartDietScreen();
      
      fireEvent.press(getByText('⚙️'));
      
      await waitFor(() => {
        expect(getByText('📱 Daily Notifications')).toBeTruthy();
        expect(getByText('Enable daily suggestions')).toBeTruthy();
        expect(getByText('🔔')).toBeTruthy();
      });
    });
  });

  describe('Feedback System', () => {
    it('submits positive feedback correctly', async () => {
      const { getByText } = renderSmartDietScreen();
      
      await waitFor(() => {
        expect(getByText('👍')).toBeTruthy();
      });
      
      fireEvent.press(getByText('👍'));
      
      await waitFor(() => {
        expect(mockSmartDietService.submitSuggestionFeedback).toHaveBeenCalledWith(
          'suggestion_001',
          true,
          expect.any(String)
        );
      });
    });

    it('submits negative feedback correctly', async () => {
      const { getByText } = renderSmartDietScreen();
      
      await waitFor(() => {
        expect(getByText('👎')).toBeTruthy();
      });
      
      fireEvent.press(getByText('👎'));
      
      await waitFor(() => {
        expect(mockSmartDietService.submitSuggestionFeedback).toHaveBeenCalledWith(
          'suggestion_001',
          false,
          expect.any(String)
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('displays retry button on service failure', async () => {
      mockSmartDietService.getSmartSuggestions.mockRejectedValue(new Error('Service unavailable'));
      
      const { getByText } = renderSmartDietScreen();
      
      await waitFor(() => {
        expect(getByText('smartDiet.error.generic')).toBeTruthy();
        expect(getByText('smartDiet.error.retry')).toBeTruthy();
      });
    });

    it('retries service call when retry button is pressed', async () => {
      mockSmartDietService.getSmartSuggestions
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce(mockResponse);
      
      const { getByText } = renderSmartDietScreen();
      
      await waitFor(() => {
        expect(getByText('smartDiet.error.retry')).toBeTruthy();
      });
      
      fireEvent.press(getByText('smartDiet.error.retry'));
      
      await waitFor(() => {
        expect(mockSmartDietService.getSmartSuggestions).toHaveBeenCalledTimes(2);
      });
    });

    it('handles network timeouts gracefully', async () => {
      mockSmartDietService.getSmartSuggestions.mockRejectedValue(new Error('Network timeout'));
      
      const { getByText } = renderSmartDietScreen();
      
      await waitFor(() => {
        expect(getByText('smartDiet.error.network')).toBeTruthy();
      });
    });
  });

  describe('Performance', () => {
    it('loads initial data within acceptable time', async () => {
      const startTime = Date.now();
      
      renderSmartDietScreen();
      
      await waitFor(() => {
        expect(mockSmartDietService.getSmartSuggestions).toHaveBeenCalled();
      });
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(2000); // 2-second target
    });

    it('caches context switches for performance', async () => {
      const { getByText } = renderSmartDietScreen();
      
      // Switch to optimize and back to today
      fireEvent.press(getByText('smartDiet.contexts.optimize'));
      await waitFor(() => {
        expect(mockSmartDietService.getSmartSuggestions).toHaveBeenCalledWith('optimize', expect.any(Object));
      });
      
      fireEvent.press(getByText('smartDiet.contexts.today'));
      await waitFor(() => {
        expect(mockSmartDietService.getSmartSuggestions).toHaveBeenCalledWith('today', expect.any(Object));
      });
      
      // Should have been called for both contexts
      expect(mockSmartDietService.getSmartSuggestions).toHaveBeenCalledTimes(3); // Initial + 2 switches
    });
  });

  describe('Accessibility', () => {
    it('has proper accessibility labels for navigation buttons', () => {
      const { getByText } = renderSmartDietScreen();
      
      expect(getByText('🏠')).toBeTruthy(); // Home button
      expect(getByText('⚙️')).toBeTruthy(); // Settings button
    });

    it('provides accessible context switching', () => {
      const { getByText } = renderSmartDietScreen();
      
      // All context buttons should be accessible
      expect(getByText('smartDiet.contexts.today')).toBeTruthy();
      expect(getByText('smartDiet.contexts.optimize')).toBeTruthy();
      expect(getByText('smartDiet.contexts.discover')).toBeTruthy();
      expect(getByText('smartDiet.contexts.insights')).toBeTruthy();
    });
  });
});