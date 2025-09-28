import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import SmartDietScreen from '../../screens/SmartDietScreen';
import {
  SmartDietContext,
  smartDietService,
  type SmartDietResponse,
} from '../../services/SmartDietService';
import {
  renderWithWrappers,
  resetSmartDietTestMocks,
  mockApiService,
} from '../testUtils';

jest.mock('@react-native-async-storage/async-storage', () => {
  const { mockedAsyncStorage } = require('../testUtils');
  return mockedAsyncStorage;
});

jest.mock('../../services/ApiService', () => {
  const { mockApiService } = require('../testUtils');
  return { apiService: mockApiService };
});

jest.mock('../../contexts/AuthContext', () => {
  const { mockAuthContext } = require('../testUtils');
  return { useAuth: () => mockAuthContext };
});

jest.mock('@react-native-community/netinfo', () => {
  const { mockNetInfoModule } = require('../testUtils');
  return mockNetInfoModule;
});

jest.mock('react-i18next', () => {
  const { createTranslationMock } = require('../testUtils');
  return createTranslationMock();
});

jest.mock('../../services/NotificationService', () => {
  const { mockNotificationService } = require('../testUtils');
  return {
    notificationService: {
      ...mockNotificationService,
      getPendingNavigationIntent: jest.fn().mockResolvedValue(null),
      initialize: jest.fn().mockResolvedValue(true),
    },
  };
});

jest.mock('../../utils/mealPlanUtils', () => ({
  getCurrentMealPlanId: jest.fn().mockResolvedValue('test_plan_001'),
  storeCurrentMealPlanId: jest.fn(),
}));

const getContextLabelMatcher = (context: SmartDietContext) => {
  const translationKey = `smartDiet.contexts.${context}`;
  const fallbackLabel = context.charAt(0).toUpperCase() + context.slice(1);
  const escapedKey = translationKey.replace(/\./g, '\\.');
  return new RegExp(`${escapedKey}|${fallbackLabel}`, 'i');
};

type NavigationHandlers = ReturnType<typeof createNavigationHandlers>;

const createNavigationHandlers = () => ({
  onBackPress: jest.fn(),
  navigateToTrack: jest.fn(),
  navigateToPlan: jest.fn(),
  navigationContext: {
    targetContext: SmartDietContext.TODAY,
    sourceScreen: 'smartDiet',
    planId: undefined as string | undefined,
  },
});

const buildMockResponse = (context: SmartDietContext): SmartDietResponse => {
  const titles: Record<SmartDietContext, string> = {
    [SmartDietContext.TODAY]: 'Today Suggestion',
    [SmartDietContext.OPTIMIZE]: 'Optimize Suggestion',
    [SmartDietContext.DISCOVER]: 'Discover Suggestion',
    [SmartDietContext.INSIGHTS]: 'Insights Suggestion',
  };

  return {
    user_id: 'test_user',
    context_type: context,
    generated_at: new Date().toISOString(),
    suggestions: [
      {
        id: `${context}_suggestion_1`,
        suggestion_type: context === SmartDietContext.OPTIMIZE ? 'optimization' : 'recommendation',
        category: context === SmartDietContext.DISCOVER ? 'discovery' : 'meal_addition',
        title: titles[context],
        description: `Description for ${context}`,
        reasoning: 'Based on your preferences',
        suggested_item: {
          name: 'Mock Food',
          calories: 320,
          serving_size: '1 bowl',
        },
        nutritional_benefit: {
          calories: 320,
          protein: 18,
          fat: 9,
          carbs: 38,
        },
        calorie_impact: 320,
        macro_impact: {
          protein: 18,
          fat: 9,
          carbs: 38,
        },
        confidence_score: 0.82,
        priority_score: 0.7,
        meal_context: 'breakfast',
        planning_context: context,
        implementation_complexity: 'simple',
        implementation_notes: 'Enjoy this meal',
        tags: ['high_protein', 'balanced'],
        action_text: 'Add to meal plan',
      },
    ],
    today_highlights: [],
    optimizations: context === SmartDietContext.OPTIMIZE
      ? [{
          id: 'opt_1',
          suggestion_type: 'optimization',
          category: 'food_swap',
          title: 'Swap refined grains',
          description: 'Replace white rice with quinoa',
          reasoning: 'Improves nutrient density',
          suggested_item: { name: 'Quinoa' },
          nutritional_benefit: { calories: -50, protein: 5, fat: 1, carbs: -10 },
          calorie_impact: -50,
          macro_impact: { protein: 5, fat: -1, carbs: -10 },
          confidence_score: 0.78,
          priority_score: 0.75,
          planning_context: SmartDietContext.OPTIMIZE,
          implementation_complexity: 'moderate',
          tags: ['optimization'],
        }]
      : [],
    discoveries: [],
    insights: [],
    nutritional_summary: {
      total_recommended_calories: 2000,
    },
    personalization_factors: ['High protein focus'],
    total_suggestions: 1,
    avg_confidence: 0.82,
  };
};

const renderSmartDietScreen = (overrides: Partial<NavigationHandlers> = {}) => {
  const handlers = { ...createNavigationHandlers(), ...overrides };
  const utils = renderWithWrappers(
    <SmartDietScreen
      onBackPress={handlers.onBackPress}
      navigateToTrack={handlers.navigateToTrack}
      navigateToPlan={handlers.navigateToPlan}
      navigationContext={handlers.navigationContext}
    />
  );

  return { ...utils, handlers };
};

const flushAsync = () => act(async () => {
  await Promise.resolve();
});

let getSmartSuggestionsSpy: jest.SpiedFunction<typeof smartDietService.getSmartSuggestions>;
let submitSuggestionFeedbackSpy: jest.SpiedFunction<typeof smartDietService.submitSuggestionFeedback>;
let getDietInsightsSpy: jest.SpiedFunction<typeof smartDietService.getDietInsights>;
let invalidateUserCacheSpy: jest.SpiedFunction<typeof smartDietService.invalidateUserCache>;

beforeEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  resetSmartDietTestMocks();

  mockApiService.get.mockResolvedValue({ data: {} });
  mockApiService.post.mockResolvedValue({ data: {} });
  mockApiService.put.mockResolvedValue({ data: {} });
  mockApiService.delete.mockResolvedValue({ data: {} });

  getSmartSuggestionsSpy = jest
    .spyOn(smartDietService, 'getSmartSuggestions')
    .mockImplementation(async (context: SmartDietContext) => buildMockResponse(context));
  submitSuggestionFeedbackSpy = jest
    .spyOn(smartDietService, 'submitSuggestionFeedback')
    .mockResolvedValue(undefined);
  getDietInsightsSpy = jest
    .spyOn(smartDietService, 'getDietInsights')
    .mockResolvedValue({ insights: [], nutritional_summary: {} });
  invalidateUserCacheSpy = jest
    .spyOn(smartDietService, 'invalidateUserCache')
    .mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SmartDietScreen navigation flows', () => {
  it('renders default context with navigation controls', async () => {
    const { getAllByText, getByText } = renderSmartDietScreen();

    await flushAsync();

    await waitFor(() => {
      expect(getAllByText(getContextLabelMatcher(SmartDietContext.TODAY))[0]).toBeTruthy();
    });

    await waitFor(() => {
      expect(getSmartSuggestionsSpy).toHaveBeenCalled();
    });

    expect(getByText('🏠')).toBeTruthy();
    expect(getAllByText(getContextLabelMatcher(SmartDietContext.OPTIMIZE))[0]).toBeTruthy();
  });

  it('invokes navigation to Track for recommendation suggestions', async () => {
    const { getAllByText, getByText, handlers } = renderSmartDietScreen();

    await flushAsync();

    await waitFor(() => {
      expect(getAllByText(getContextLabelMatcher(SmartDietContext.TODAY))[0]).toBeTruthy();
      expect(getByText('Today Suggestion')).toBeTruthy();
    });

    fireEvent.press(getByText('📊 Track'));
    expect(handlers.navigateToTrack).toHaveBeenCalledTimes(1);
  });

  it('invokes navigation to Plan for optimization suggestions', async () => {
    const { getAllByText, getByText, handlers } = renderSmartDietScreen({
      navigationContext: {
        targetContext: SmartDietContext.OPTIMIZE,
        sourceScreen: 'plan',
        planId: 'plan_123',
      },
    });

    await flushAsync();

    await waitFor(() => {
      expect(getAllByText(getContextLabelMatcher(SmartDietContext.OPTIMIZE))[0]).toBeTruthy();
      expect(getByText('Optimize Suggestion')).toBeTruthy();
    });

    fireEvent.press(getByText('📋 Plan'));
    expect(handlers.navigateToPlan).toHaveBeenCalledTimes(1);
  });

  it('switches context when selecting another tab', async () => {
    const { getAllByText, getByText } = renderSmartDietScreen();

    await flushAsync();

    await waitFor(() => {
      expect(getAllByText(getContextLabelMatcher(SmartDietContext.TODAY))[0]).toBeTruthy();
    });

    fireEvent.press(getByText(getContextLabelMatcher(SmartDietContext.OPTIMIZE)));

    await waitFor(() => {
      expect(getAllByText(getContextLabelMatcher(SmartDietContext.OPTIMIZE))[0]).toBeTruthy();
      expect(getByText('Optimize Suggestion')).toBeTruthy();
    });
  });

  it('preselects context based on navigation context', async () => {
    const { getAllByText, getByText } = renderSmartDietScreen({
      navigationContext: {
        targetContext: SmartDietContext.DISCOVER,
        sourceScreen: 'smartDiet',
        planId: undefined,
      },
    });

    await flushAsync();

    await waitFor(() => {
      expect(getAllByText(getContextLabelMatcher(SmartDietContext.DISCOVER))[0]).toBeTruthy();
      expect(getByText('Discover Suggestion')).toBeTruthy();
    });
  });

  it('refreshes suggestions when tapping refresh control', async () => {
    const { getByText } = renderSmartDietScreen();

    await flushAsync();

    await waitFor(() => {
      expect(getByText('🔄 Refresh Suggestions')).toBeTruthy();
    });

    getSmartSuggestionsSpy.mockClear();

    fireEvent.press(getByText('🔄 Refresh Suggestions'));

    await waitFor(() => {
      expect(getSmartSuggestionsSpy).toHaveBeenCalledWith(
        SmartDietContext.TODAY,
        expect.any(String),
        expect.any(Object)
      );
    });
  });
});
