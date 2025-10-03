import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import SmartDietScreen from '../../screens/SmartDietScreen';
import { SmartDietContext, smartDietService } from '../../services/SmartDietService';
import {
  renderWithWrappers,
  mockApiService,
  createSmartDietTestHarness,
  buildSmartDietResponse,
  type SmartDietScreenProps,
} from '../testUtils';

jest.mock('@react-native-async-storage/async-storage', () => {
  const { mockedAsyncStorage } = require('../testUtils');
  return mockedAsyncStorage;
});

jest.mock('../../services/ApiService', () => {
  const { mockApiService } = require('../testUtils');
  return {
    __esModule: true,
    apiService: mockApiService,
    default: jest.fn(() => mockApiService),
  };
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

const harness = createSmartDietTestHarness();

const getContextLabelMatcher = (context: SmartDietContext) => {
  const translationKey = `smartDiet.contexts.${context}`;
  const fallbackLabel = context.charAt(0).toUpperCase() + context.slice(1);
  const escapedKey = translationKey.replace(/\./g, '\\.');
  return new RegExp(`${escapedKey}|${fallbackLabel}`, 'i');
};

const renderSmartDietScreen = (
  overrides: Partial<SmartDietScreenProps> = {},
) => {
  const props = harness.buildScreenProps(overrides);
  const utils = renderWithWrappers(<SmartDietScreen {...props} />);

  return { ...utils, handlers: harness.navigation, props };
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
  harness.reset();
  jest.clearAllMocks();

  mockApiService.get.mockResolvedValue({ data: {} });
  mockApiService.post.mockResolvedValue({ data: {} });
  mockApiService.put.mockResolvedValue({ data: {} });
  mockApiService.delete.mockResolvedValue({ data: {} });

  getSmartSuggestionsSpy = jest
    .spyOn(smartDietService, 'getSmartSuggestions')
    .mockImplementation(async (context: SmartDietContext) => buildSmartDietResponse(context));
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
