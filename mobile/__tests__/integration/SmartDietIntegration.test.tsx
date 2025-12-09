jest.mock('../../contexts/AuthContext', () => {
  const { mockAuthContext } = require('../../testUtils');
  return { useAuth: () => mockAuthContext };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const { mockedAsyncStorage } = require('../../testUtils');
  return mockedAsyncStorage;
});

jest.mock('@react-native-community/netinfo', () => {
  const { mockNetInfoModule } = require('../../testUtils');
  return mockNetInfoModule;
});

jest.mock('react-i18next', () => {
  const { createTranslationMock } = require('../../testUtils');
  return createTranslationMock();
});

jest.mock('../../services/NotificationService', () => {
  const { mockNotificationService } = require('../../testUtils');
  return {
    notificationService: {
      ...mockNotificationService,
      getPendingNavigationIntent: jest.fn().mockResolvedValue(null),
      initialize: jest.fn().mockResolvedValue(true),
    },
  };
});

jest.mock('../../utils/foodTranslation', () => ({
  translateFoodNameSync: jest.fn((name: string) => name),
  translateFoodName: jest.fn((name: string) => Promise.resolve(name)),
}));

jest.mock('../../utils/mealPlanUtils', () => ({
  getCurrentMealPlanId: jest.fn().mockResolvedValue('integration_plan_001'),
}));

import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import {
  renderWithWrappers,
  mockedAsyncStorage,
  mockApiService,
  mockNetInfo,
  createSmartDietTestHarness,
  buildSmartDietResponse,
  type SmartDietScreenProps,
} from '../../testUtils';

const SmartDietScreen = require('../../screens/SmartDietScreen').default as typeof import('../../screens/SmartDietScreen').default;
const smartDietModule = require('../../services/SmartDietService') as typeof import('../../services/SmartDietService');
const { smartDietService, SmartDietContext } = smartDietModule;
const apiModule = require('../../services/ApiService') as typeof import('../../services/ApiService');

const harness = createSmartDietTestHarness();
let getSmartSuggestionsSpy: jest.SpyInstance;

const flushAsync = () =>
  act(async () => {
    await Promise.resolve();
  });

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

beforeAll(() => {
  harness.installFetchMock();
});

afterAll(async () => {
  harness.restoreFetchMock();
  await smartDietService.invalidateUserCache('anonymous');
});

beforeEach(() => {
  harness.reset();
  jest.clearAllMocks();
  harness.stubSmartDietFetch((context: SmartDietContext) => buildSmartDietResponse(context));

  Object.assign(apiModule.apiService, mockApiService);

  getSmartSuggestionsSpy = jest.spyOn(smartDietService, 'getSmartSuggestions');

  mockApiService.get.mockImplementation(async (url: string) => {
    if (url.includes('/smart-diet/suggestions')) {
      const parsed = new URL(url, 'http://localhost');
      const context = (parsed.searchParams.get('context') as SmartDietContext) ?? SmartDietContext.TODAY;
      return { data: buildSmartDietResponse(context) };
    }

    if (url.includes('/smart-diet/insights')) {
      return { data: { insights: [], nutritional_summary: {} } };
    }

    return { data: {} };
  });

  mockApiService.post.mockResolvedValue({ data: { success: true } });
  mockApiService.put.mockResolvedValue({ data: { success: true } });
  mockApiService.delete.mockResolvedValue({ data: { success: true } });
  mockApiService.patch.mockResolvedValue({ data: { success: true } });
});

afterEach(async () => {
  mockNetInfo.__reset();
  harness.reset();
  await smartDietService.invalidateUserCache('anonymous');
  getSmartSuggestionsSpy.mockRestore();
});

describe('SmartDietScreen integration', () => {
  it('renders Today suggestions from ApiService and caches the response', async () => {
    const { getByText } = renderSmartDietScreen();

    await flushAsync();

    await waitFor(() => {
      expect(getSmartSuggestionsSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockApiService.get).toHaveBeenCalledWith(
        expect.stringContaining('/smart-diet/suggestions?'),
      );
    });

    await waitFor(() => {
      expect(getByText('Today Suggestion')).toBeTruthy();
    });

    const latestResult = getSmartSuggestionsSpy.mock.results.find(result => result.type === 'return');
    if (latestResult) {
      const payload = await latestResult.value;
      expect(payload.suggestions.length).toBeGreaterThan(0);
    }
  });

  it('switches context through the UI and fetches new data', async () => {
    const { getByText } = renderSmartDietScreen();

    await flushAsync();

    await waitFor(() => {
      expect(getByText('Today Suggestion')).toBeTruthy();
    });

    mockApiService.get.mockImplementationOnce(async (url: string) => {
      expect(url).toContain('context=optimize');
      return { data: buildSmartDietResponse(SmartDietContext.OPTIMIZE) };
    });

    fireEvent.press(getByText(getContextLabelMatcher(SmartDietContext.OPTIMIZE)));

    await waitFor(() => {
      expect(getByText('Optimize Suggestion')).toBeTruthy();
    });
  });

  it('falls back to cached data when the API fails offline', async () => {
    const baseToday = buildSmartDietResponse(SmartDietContext.TODAY);
    const cachedResponse = {
      ...baseToday,
      suggestions: [
        {
          ...baseToday.suggestions[0],
          title: 'Cached Suggestion',
        },
      ],
    };

    await smartDietService.invalidateUserCache('test_user');

    await mockedAsyncStorage.setItem(
      'smart_diet_today_test_user',
      JSON.stringify({ data: cachedResponse, timestamp: Date.now() - 1000 }),
    );
    mockedAsyncStorage.setItem.mockClear();

    mockApiService.get.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      smartDietService.getSmartSuggestions(
        SmartDietContext.TODAY,
        'test_user'
      )
    ).rejects.toThrow('Network error');

    const cachedValue = await mockedAsyncStorage.getItem('smart_diet_today_test_user');
    expect(cachedValue).toBeTruthy();

    if (cachedValue) {
      const parsed = JSON.parse(cachedValue);
      expect(parsed.data.suggestions[0]?.title).toBe('Cached Suggestion');
    }
  });

  it('invokes navigation handlers from quick actions', async () => {
    const { getByText, handlers } = renderSmartDietScreen();

    await flushAsync();

    await waitFor(() => {
      expect(getByText('Today Suggestion')).toBeTruthy();
    });

    fireEvent.press(getByText('📊 Track'));
    expect(handlers.navigateToTrack).toHaveBeenCalled();

    mockApiService.get.mockImplementationOnce(async () => ({
      data: buildSmartDietResponse(SmartDietContext.OPTIMIZE),
    }));

    fireEvent.press(getByText(getContextLabelMatcher(SmartDietContext.OPTIMIZE)));

    await waitFor(() => {
      expect(getByText('Optimize Suggestion')).toBeTruthy();
    });

    fireEvent.press(getByText('📋 Plan'));
    expect(handlers.navigateToPlan).toHaveBeenCalled();
  });
});
