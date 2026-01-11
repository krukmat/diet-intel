import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SmartDietScreen from '../screens/SmartDietScreen';
import * as mealPlanUtils from '../utils/mealPlanUtils';
import {
  mockApiService,
  mockedAsyncStorage,
  renderWithWrappers,
  createTranslationMock,
  resetSmartDietTestMocks,
} from '../testUtils';
import { apiService } from '../services/ApiService';
jest.mock('../contexts/AuthContext', () => {
  const { mockAuthContext } = require('../testUtils');
  return { useAuth: () => mockAuthContext };
});
jest.mock('@react-native-async-storage/async-storage', () => {
  const { mockedAsyncStorage } = require('../testUtils');
  return mockedAsyncStorage;
});
jest.mock('../services/NotificationService', () => {
  const { mockNotificationService } = require('../testUtils');
  return { notificationService: mockNotificationService };
});
jest.mock('@react-native-community/netinfo', () => {
  const { mockNetInfoModule } = require('../testUtils');
  return mockNetInfoModule;
});
jest.mock('../utils/mealPlanUtils', () => ({
  getCurrentMealPlanId: jest.fn(() => Promise.resolve('plan_123')),
  storeMealPlanId: jest.fn(),
}));
jest.mock('../utils/foodTranslation', () => ({
  translateFoodName: jest.fn(async (name: string) => name),
  translateFoodNameSync: jest.fn((name: string) => name),
}));

jest.mock('react-i18next', () => {
  const { createTranslationMock } = require('../testUtils');
  return createTranslationMock({
    'smartDiet.title': 'Smart Diet',
    'smartDiet.loading': 'Loading recommendations...',
    'smartDiet.contexts.today': 'Today',
    'smartDiet.contexts.optimize': 'Optimize',
    'smartDiet.contexts.discover': 'Discover',
    'smartDiet.contexts.insights': 'Insights',
    'smartDiet.confidence': 'Confidence',
    'smartDiet.whySuggested': 'Why this was suggested',
    'smartDiet.insights.title': 'Nutrition Insights',
    'smartDiet.insights.calories': 'Calories',
    'smartDiet.insights.macroBalance': 'Macro balance',
    'smartDiet.insights.nutritionalGaps': 'Nutritional gaps',
    'smartDiet.insights.healthBenefits': 'Health benefits',
    'smartDiet.preferences.title': 'Preferences',
    'smartDiet.preferences.apply': 'Apply',
    'smartDiet.noSuggestions': 'No suggestions available at the moment.',
    'smartDiet.feedback.thankYou': 'Thanks for your feedback!',
    'smartDiet.feedback.message': 'We updated your preferences',
    'smartDiet.feedback.recorded': 'Feedback recorded',
    'smartDiet.actions.addToPlan': 'Add to plan',
    'smartDiet.actions.applyOptimization': 'Apply optimization',
    'smartDiet.alerts.optimizationSuccess': 'Optimization applied',
    'smartDiet.alerts.information': 'Information',
    'common.cancel': 'Cancel',
    'common.add': 'Add',
    'common.apply': 'Apply',
    'common.success': 'Success',
    'common.error': 'Error',
  });
});

const mockedApi = apiService as unknown as typeof mockApiService;
const mockedMealPlan = mealPlanUtils as jest.Mocked<typeof mealPlanUtils>;

const BASE_TIMESTAMP = '2025-01-01T08:00:00Z';

const buildSuggestion = (overrides: Record<string, any> = {}) => ({
  id: 'suggestion_001',
  user_id: 'test_user',
  suggestion_type: 'recommendation',
  category: 'meal_addition',
  title: 'Greek Yogurt with Berries',
  description: 'Add this protein-packed breakfast option',
  reasoning: 'Helps increase morning protein intake',
  suggested_item: {
    barcode: '1234567890123',
    name: 'Greek Yogurt',
    serving_size: '150g',
  },
  current_item: null,
  nutritional_benefit: {
    calories: 180,
    protein: 17,
    fat: 4,
    carbs: 18,
  },
  calorie_impact: 180,
  macro_impact: {
    protein: 17,
    fat: 4,
    carbs: 18,
  },
  confidence_score: 0.87,
  priority_score: 0.9,
  meal_context: 'breakfast',
  planning_context: 'today',
  implementation_complexity: 'simple',
  implementation_notes: 'Add to breakfast',
  created_at: BASE_TIMESTAMP,
  expires_at: null,
  tags: ['High protein', 'Low sugar'],
  ...overrides,
});

const buildSmartDietResponse = (context: string = 'today', overrides: Record<string, any> = {}) => ({
  user_id: 'test_user',
  context_type: context,
  generated_at: BASE_TIMESTAMP,
  suggestions: context === 'insights' ? [] : [buildSuggestion({ planning_context: context })],
  today_highlights: [],
  optimizations:
    context === 'optimize'
      ? {
          meal_swaps: [
            {
              from_food: 'White rice',
              to_food: 'Quinoa',
              from_barcode: '111',
              to_barcode: '222',
              calorie_difference: -50,
              benefit: 'Adds fibre and protein',
            },
          ],
          macro_adjustments: [
            {
              nutrient: 'Protein',
              current: 60,
              target: 90,
              suggestion: 'Add chickpeas at lunch',
            },
          ],
        }
      : {
          meal_swaps: [],
          macro_adjustments: [],
        },
  discoveries: [],
  insights: [],
  nutritional_summary: {
    total_recommended_calories: 1800,
    macro_distribution: {
      protein_percent: 30,
      fat_percent: 25,
      carbs_percent: 45,
    },
    nutritional_gaps: context === 'insights' ? ['Fibre'] : [],
    health_benefits: ['Improved energy'],
  },
  personalization_factors: ['High protein goal'],
  total_suggestions: context === 'insights' ? 0 : 1,
  avg_confidence: 0.88,
  ...overrides,
});

const buildLegacyResponse = () => ({
  user_id: 'test_user',
  total_recommendations: 1,
  avg_confidence: 0.8,
  generated_at: BASE_TIMESTAMP,
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
          barcode: '987654321',
          reasons: ['Fibre rich'],
        },
      ],
    },
  ],
  nutritional_insights: {
    total_recommended_calories: 1700,
    macro_distribution: {
      protein_percent: 28,
      fat_percent: 27,
      carbs_percent: 45,
    },
    nutritional_gaps: ['Iron'],
    health_benefits: ['Supports recovery'],
  },
});

const renderScreen = (overrideProps: Record<string, any> = {}) => {
  const props = {
    onBackPress: jest.fn(),
    navigateToTrack: jest.fn(),
    navigateToPlan: jest.fn(),
    ...overrideProps,
  };

  const utils = renderWithWrappers(<SmartDietScreen {...props} />);
  return {
    ...utils,
    props,
  };
};

describe('SmartDietScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSmartDietTestMocks();

    Object.assign(mockedApi, mockApiService);
    mockedMealPlan.getCurrentMealPlanId.mockResolvedValue('plan_123');

    mockedApi.get.mockImplementation((url: string) => {
      const parsed = new URL(url, 'http://localhost');
      const context = parsed.searchParams.get('context') ?? 'today';
      return Promise.resolve({ data: buildSmartDietResponse(context) });
    });

    mockedApi.post.mockResolvedValue({ data: { success: true, message: 'Recorded' } });
    mockedApi.addProductToPlan.mockResolvedValue({ data: { success: true, message: 'Added to plan' } });
    mockedApi.generateSmartRecommendations.mockResolvedValue({ data: buildLegacyResponse() });
    mockedApi.applySmartDietOptimization.mockResolvedValue({ data: { applied: 1 } });
  });

  it('renders core tabs and initial suggestion', async () => {
    const { findAllByText, queryByText, findByText } = renderScreen();

    await waitFor(() => {
      expect(queryByText('Loading recommendations...')).toBeNull();
    });

    expect((await findAllByText(/Smart Diet/i)).length).toBeGreaterThan(0);
    expect((await findAllByText(/Today/i)).length).toBeGreaterThan(0);
    expect((await findAllByText(/Optimize/i)).length).toBeGreaterThan(0);
    expect((await findAllByText(/Discover/i)).length).toBeGreaterThan(0);
    expect((await findAllByText(/Insights/i)).length).toBeGreaterThan(0);
    expect(await findByText('Greek Yogurt with Berries')).toBeTruthy();
  });

  it('switches to optimize context and calls API with proper query params', async () => {
    const { findAllByText } = renderScreen();

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(expect.stringContaining('context=today'));
    });

    const optimizeButtons = await findAllByText(/Optimize/i);
    fireEvent.press(optimizeButtons[0]);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(expect.stringContaining('context=optimize'));
      expect(mockedMealPlan.getCurrentMealPlanId).toHaveBeenCalled();
    });
  });

  it('refreshes suggestions when the user taps refresh button', async () => {
    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledTimes(1);
    });

    await mockedAsyncStorage.clear();
    fireEvent.press(getByText('🔄 Refresh Suggestions'));

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledTimes(2);
    });
  });

  it('falls back to legacy recommendations when smart diet API fails', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('Primary API down'));

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(mockedApi.generateSmartRecommendations).toHaveBeenCalled();
      expect(getByText('Oatmeal')).toBeTruthy();
    });
  });

  it('handles optimize context gracefully when no meal plan exists', async () => {
    mockedMealPlan.getCurrentMealPlanId.mockResolvedValueOnce(null);
    const { findAllByText } = renderScreen();

    const optimizeButtons = await findAllByText('Optimize');
    fireEvent.press(optimizeButtons[0]);

    await waitFor(() => {
      // API should not be called for optimize when plan is missing
      const optimizeCalls = mockedApi.get.mock.calls.filter(([url]) => (url as string).includes('context=optimize'));
      expect(optimizeCalls.length).toBe(0);
    });
  });

  it('opens preferences modal when settings button is pressed', async () => {
    const { findByText } = renderScreen();

    const settingsButton = await findByText('⚙️');
    fireEvent.press(settingsButton);

    expect(await findByText('Preferences')).toBeTruthy();
    expect(await findByText('Apply')).toBeTruthy();
  });

  it('invokes navigation callbacks', async () => {
    const navigateToTrack = jest.fn();
    const onBackPress = jest.fn();

    const { findByText, getByText } = renderScreen({ navigateToTrack, onBackPress });

    const backButton = await findByText('🏠');
    fireEvent.press(backButton);
    expect(onBackPress).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(getByText('Greek Yogurt with Berries')).toBeTruthy();
    });

    fireEvent.press(getByText('📊 Track'));
    expect(navigateToTrack).toHaveBeenCalledTimes(1);
  });

  it('submits feedback using the feedback endpoint', async () => {
    const { findAllByText } = renderScreen();

    const positiveButtons = await findAllByText('👍');
    fireEvent.press(positiveButtons[0]);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/smart-diet/feedback', expect.objectContaining({ suggestion_id: 'suggestion_001', user_id: 'test_user' }));
    });
  });

  it('navigates to plan screen when plan navigation button is pressed', async () => {
    const navigateToPlan = jest.fn();
    const { findByText } = renderScreen({ navigateToPlan, navigationContext: { sourceScreen: 'plan', targetContext: 'optimize' } });

    const planButton = await findByText('📋');
    fireEvent.press(planButton);
    expect(navigateToPlan).toHaveBeenCalledTimes(1);
  });

  it('displays insights data when Insights context is selected', async () => {
    const { findAllByText, findByText } = renderScreen();

    const insightsButtons = await findAllByText('Insights');
    fireEvent.press(insightsButtons[0]);

    expect(await findByText('Nutrition Insights')).toBeTruthy();
    expect(await findByText('Macro balance')).toBeTruthy();
    expect(await findByText('Health benefits')).toBeTruthy();
    expect(await findByText(/Improved energy/)).toBeTruthy();
  });

  it('shows optimization data when Optimize context is selected', async () => {
    const { findAllByText, findByText } = renderScreen();

    const optimizeButtons = await findAllByText('Optimize');
    fireEvent.press(optimizeButtons[0]);

    expect(await findByText('smartDiet.optimizations.title')).toBeTruthy();
    expect(await findByText('smartDiet.optimizations.mealSwaps')).toBeTruthy();
    expect(await findByText('White rice → Quinoa')).toBeTruthy();
    expect(await findByText('smartDiet.optimizations.applySelected')).toBeTruthy();
  });

  it('applies selected optimizations with plan id', async () => {
    const { findAllByText, findByText } = renderScreen();

    const optimizeButtons = await findAllByText('Optimize');
    fireEvent.press(optimizeButtons[0]);

    const applyButton = await findByText('smartDiet.optimizations.applySelected');
    fireEvent.press(applyButton);

    await waitFor(() => {
      expect(mockedApi.applySmartDietOptimization).toHaveBeenCalledWith({
        plan_id: 'plan_123',
        changes: [
          {
            change_type: 'meal_swap',
            old_barcode: '111',
            new_barcode: '222'
          }
        ]
      });
    });
  });

  it('alerts when adding recommendation without barcode', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const confirm = buttons?.[1];
      if (confirm && typeof confirm.onPress === 'function') {
        confirm.onPress();
      }
    });
    mockedApi.get.mockResolvedValueOnce({
      data: buildSmartDietResponse('today', {
        suggestions: [buildSuggestion({ suggested_item: undefined, metadata: {} })],
      }),
    });

    const { findByText } = renderScreen();

    await findByText('Greek Yogurt with Berries');
    fireEvent.press(await findByText('Add to breakfast'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Cannot Add to Plan',
      'This recommendation cannot be added to your meal plan (no barcode information available).',
      [{ text: 'OK' }]
    );
    alertSpy.mockRestore();
  });

  it('prompts sign-in when user tries to add to plan', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const confirm = buttons?.[1];
      if (confirm && typeof confirm.onPress === 'function') {
        confirm.onPress();
      }
    });
    const { mockAuthContext } = require('../testUtils');
    mockAuthContext.user = null;

    const { findByText } = renderScreen();

    await findByText('Greek Yogurt with Berries');
    fireEvent.press(await findByText('Add to breakfast'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Sign In Required',
      'Please log in to modify your meal plan.'
    );
    alertSpy.mockRestore();
  });

  it('handles optimization action without barcode by showing success', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedApi.get.mockResolvedValueOnce({
      data: buildSmartDietResponse('today', {
        suggestions: [
          buildSuggestion({
            suggestion_type: 'optimization',
            suggested_item: undefined,
            metadata: {},
            action_text: 'Apply Optimization',
          }),
        ],
      }),
    });

    const { findByText } = renderScreen();

    await findByText('Greek Yogurt with Berries');
    fireEvent.press(await findByText('Apply Optimization'));

    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows sign-in notice when feedback is submitted without user', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { mockAuthContext } = require('../testUtils');
    mockAuthContext.user = null;

    const { findAllByText } = renderScreen();

    const positiveButtons = await findAllByText('👍');
    fireEvent.press(positiveButtons[0]);

    expect(alertSpy).toHaveBeenCalledWith('Sign In Required', 'Please log in to share feedback.');
    alertSpy.mockRestore();
  });

  it('toggles notification preferences and triggers notification', async () => {
    const { mockNotificationService } = require('../testUtils');
    mockNotificationService.getConfig.mockResolvedValueOnce({
      enabled: false,
      dailySuggestionTime: '09:00',
      reminderInterval: 24,
      preferredContexts: ['today'],
    });

    const { findByText } = renderScreen();

    const settingsButton = await findByText('⚙️');
    fireEvent.press(settingsButton);

    const toggleButton = await findByText('🔕');
    fireEvent.press(toggleButton);

    await waitFor(() => {
      expect(mockNotificationService.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      );
      expect(mockNotificationService.triggerSmartDietNotification).toHaveBeenCalled();
    });
  });
});
