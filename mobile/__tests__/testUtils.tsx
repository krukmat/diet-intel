import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import {
  SmartDietContext,
  type SmartDietResponse,
} from '../services/SmartDietService';

type TranslationDictionary = Record<string, string>;

interface MockAuthUser {
  id: string;
  email: string;
  [key: string]: unknown;
}

interface MockAuthContext {
  user: MockAuthUser;
  signIn: jest.Mock;
  signOut: jest.Mock;
  refreshUser: jest.Mock;
  updateProfile: jest.Mock;
  __setUser: (overrides: Partial<MockAuthUser>) => void;
  __reset: () => void;
}

interface MockApiService {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
  delete: jest.Mock;
  patch: jest.Mock;
  generateSmartRecommendations: jest.Mock;
  addProductToPlan: jest.Mock;
  recordSmartDietFeedback: jest.Mock;
  getSmartDietInsights: jest.Mock;
  applySmartDietOptimization: jest.Mock;
  getSmartDietSuggestions: jest.Mock;
  recordRecommendationFeedback: jest.Mock;
}

type NetInfoListener = (state: NetInfoState) => void;

interface NetInfoState {
  type: string;
  isConnected: boolean;
  isInternetReachable: boolean | null;
  [key: string]: unknown;
}

interface SmartDietScreenNavigationContext {
  targetContext?: SmartDietContext | string;
  sourceScreen?: string;
  planId?: string;
}

export interface SmartDietScreenProps {
  onBackPress: () => void;
  navigationContext?: SmartDietScreenNavigationContext;
  navigateToTrack?: () => void;
  navigateToPlan?: () => void;
}

const asyncStorageStore = new Map<string, string>();

const defaultAuthUser: MockAuthUser = {
  id: 'test_user',
  email: 'test@example.com',
};

const createMockAuthContext = (): MockAuthContext => {
  const context: MockAuthContext = {
    user: { ...defaultAuthUser },
    signIn: jest.fn(),
    signOut: jest.fn(),
    refreshUser: jest.fn(),
    updateProfile: jest.fn(),
    __setUser: (overrides: Partial<MockAuthUser>) => {
      context.user = { ...context.user, ...overrides };
    },
    __reset: () => {
      context.user = { ...defaultAuthUser };
      context.signIn.mockClear();
      context.signOut.mockClear();
      context.refreshUser.mockClear();
      context.updateProfile.mockClear();
    },
  };

  return context;
};

const createMockApiService = (): MockApiService => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  generateSmartRecommendations: jest.fn(),
  addProductToPlan: jest.fn(),
  recordSmartDietFeedback: jest.fn(),
  getSmartDietInsights: jest.fn(),
  applySmartDietOptimization: jest.fn(),
  getSmartDietSuggestions: jest.fn(),
  recordRecommendationFeedback: jest.fn(),
});

const defaultNetInfoState: NetInfoState = {
  type: 'wifi',
  isConnected: true,
  isInternetReachable: true,
};

let netInfoState: NetInfoState = { ...defaultNetInfoState };
const netInfoListeners = new Set<NetInfoListener>();

const snapshotNetInfoState = (): NetInfoState => ({ ...netInfoState });

const notifyNetInfoListeners = () => {
  const state = snapshotNetInfoState();
  netInfoListeners.forEach(listener => listener(state));
};

const createNetInfoMock = () => {
  const addEventListener = jest.fn((listener?: NetInfoListener) => {
    if (listener) {
      listener(snapshotNetInfoState());
      netInfoListeners.add(listener);
    }

    return () => {
      if (listener) {
        netInfoListeners.delete(listener);
      }
    };
  });

  const fetch = jest.fn(() => Promise.resolve(snapshotNetInfoState()));
  const refresh = jest.fn(() => Promise.resolve(snapshotNetInfoState()));
  const configure = jest.fn();
  const useNetInfo = jest.fn(() => snapshotNetInfoState());

  return { addEventListener, fetch, refresh, configure, useNetInfo };
};

const netInfoBase = createNetInfoMock();

export const mockedAsyncStorage = {
  getItem: jest.fn((key: string) => Promise.resolve(asyncStorageStore.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    asyncStorageStore.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    asyncStorageStore.delete(key);
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach(key => asyncStorageStore.delete(key));
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    asyncStorageStore.clear();
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Array.from(asyncStorageStore.keys()))),
  __reset: () => asyncStorageStore.clear(),
};

export const mockAuthContext = createMockAuthContext();
export const mockApiService = createMockApiService();

const resetMockApiService = () => {
  Object.values(mockApiService).forEach(mockFn => {
    if (jest.isMockFunction(mockFn)) {
      mockFn.mockReset();
    }
  });
};

const resetNetInfo = () => {
  netInfoState = { ...defaultNetInfoState };
  netInfoListeners.clear();
  Object.values(netInfoBase).forEach(mockFn => {
    if (jest.isMockFunction(mockFn)) {
      mockFn.mockClear();
    }
  });
};

const updateNetInfoState = (overrides: Partial<NetInfoState>) => {
  netInfoState = { ...netInfoState, ...overrides };
  notifyNetInfoListeners();
};

export const mockNetInfo = {
  ...netInfoBase,
  __setState: updateNetInfoState,
  __emitState: updateNetInfoState,
  __reset: resetNetInfo,
  __getState: () => snapshotNetInfoState(),
};

export const mockNetInfoModule = {
  __esModule: true as const,
  default: mockNetInfo,
  ...mockNetInfo,
};

export const mockNotificationService = {
  getConfig: jest.fn().mockResolvedValue({
    enabled: true,
    dailySuggestionTime: '09:00',
    reminderInterval: 24,
    preferredContexts: ['today', 'insights'],
  }),
  updateConfig: jest.fn().mockResolvedValue(undefined),
  triggerSmartDietNotification: jest.fn().mockResolvedValue(undefined),
};

export const createFetchMock = () => {
  const handlers: Array<{
    matcher: (input: RequestInfo | URL, init?: RequestInit) => boolean;
    responder: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  }> = [];

  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const handler = handlers.find(({ matcher }) => matcher(input, init));
    if (!handler) {
      throw new Error(`Unhandled fetch request for ${input}`);
    }
    return handler.responder(input, init);
  });

  const setHandler = (
    matcher: (input: RequestInfo | URL, init?: RequestInit) => boolean,
    responder: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  ) => {
    handlers.push({ matcher, responder });
  };

  const resetHandlers = () => {
    handlers.length = 0;
  };

  return {
    fetchMock,
    setHandler,
    resetHandlers,
  };
};

export const createNavigationStubs = () => ({
  onBackPress: jest.fn(),
  navigateToTrack: jest.fn(),
  navigateToPlan: jest.fn(),
});

export const createTranslationMock = (translations: TranslationDictionary = {}) => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] || key,
    i18n: {
      language: 'en',
      changeLanguage: jest.fn(),
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
});

export const renderWithWrappers = (
  ui: React.ReactElement,
  options?: RenderOptions
) => render(ui, options);

export const resetSmartDietTestMocks = () => {
  mockedAsyncStorage.__reset();
  mockedAsyncStorage.getItem.mockClear();
  mockedAsyncStorage.setItem.mockClear();
  mockedAsyncStorage.removeItem.mockClear();
  mockedAsyncStorage.multiRemove.mockClear();
  mockedAsyncStorage.clear.mockClear();
  mockedAsyncStorage.getAllKeys.mockClear();
  mockAuthContext.__reset();
  resetMockApiService();
  mockNetInfo.__reset();
  mockNotificationService.getConfig.mockClear();
  mockNotificationService.updateConfig.mockClear();
  mockNotificationService.triggerSmartDietNotification.mockClear();
};

const defaultNavigationContext: SmartDietScreenNavigationContext = {
  targetContext: SmartDietContext.TODAY,
  sourceScreen: 'smartDiet',
  planId: undefined,
};

const resolveRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  if (typeof (input as { url?: string })?.url === 'string') {
    return (input as { url?: string }).url as string;
  }

  return String(input);
};

const createMockFetchResponse = <T>(payload: T, status = 200): Response => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(payload),
  text: () => Promise.resolve(JSON.stringify(payload)),
}) as unknown as Response;

export const buildSmartDietResponse = (
  context: SmartDietContext,
  overrides: Partial<SmartDietResponse> = {},
): SmartDietResponse => {
  const titles: Record<SmartDietContext, string> = {
    [SmartDietContext.TODAY]: 'Today Suggestion',
    [SmartDietContext.OPTIMIZE]: 'Optimize Suggestion',
    [SmartDietContext.DISCOVER]: 'Discover Suggestion',
    [SmartDietContext.INSIGHTS]: 'Insights Suggestion',
  };

  const suggestionContext = context ?? SmartDietContext.TODAY;

  const baseResponse: SmartDietResponse = {
    user_id: 'test_user',
    context_type: suggestionContext,
    generated_at: new Date('2024-01-01T00:00:00Z').toISOString(),
    suggestions: [
      {
        id: `${suggestionContext}_suggestion_1`,
        suggestion_type:
          suggestionContext === SmartDietContext.OPTIMIZE ? 'optimization' : 'recommendation',
        category:
          suggestionContext === SmartDietContext.DISCOVER ? 'discovery' : 'meal_addition',
        title: titles[suggestionContext],
        description: `Description for ${suggestionContext}`,
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
        planning_context: suggestionContext,
        implementation_complexity: 'simple',
        implementation_notes: 'Enjoy this meal',
        tags: ['high_protein', 'balanced'],
        action_text: 'Add to meal plan',
        created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
      },
    ],
    today_highlights: [],
    optimizations:
      suggestionContext === SmartDietContext.OPTIMIZE
        ? [
            {
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
              created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
            },
          ]
        : [],
    discoveries:
      suggestionContext === SmartDietContext.DISCOVER
        ? [
            {
              id: 'discover_1',
              suggestion_type: 'recommendation',
              category: 'discovery',
              title: 'Discover a new snack',
              description: 'Try roasted chickpeas',
              reasoning: 'High protein snack',
              suggested_item: { name: 'Roasted Chickpeas' },
              nutritional_benefit: { calories: 150, protein: 6, fat: 4, carbs: 18 },
              calorie_impact: 150,
              macro_impact: { protein: 6, fat: 4, carbs: 18 },
              confidence_score: 0.65,
              priority_score: 0.6,
              planning_context: SmartDietContext.DISCOVER,
              implementation_complexity: 'simple',
              tags: ['snack'],
              created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
            },
          ]
        : [],
    insights:
      suggestionContext === SmartDietContext.INSIGHTS
        ? [
            {
              id: 'insight_1',
              suggestion_type: 'insight',
              category: 'nutritional_gap',
              title: 'Increase fiber intake',
              description: 'Add more leafy greens to your meals',
              reasoning: 'Fiber intake below target',
              suggested_item: { name: 'Spinach' },
              nutritional_benefit: { fiber: 5 },
              calorie_impact: 50,
              macro_impact: { fiber: 5 },
              confidence_score: 0.7,
              priority_score: 0.8,
              planning_context: SmartDietContext.INSIGHTS,
              implementation_complexity: 'simple',
              tags: ['insight'],
              created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
            },
          ]
        : [],
    nutritional_summary: {
      total_recommended_calories: 2000,
    },
    personalization_factors: ['High protein focus'],
    total_suggestions: 1,
    avg_confidence: 0.82,
  };

  return {
    ...baseResponse,
    ...overrides,
    suggestions: overrides.suggestions ?? baseResponse.suggestions,
    today_highlights: overrides.today_highlights ?? baseResponse.today_highlights,
    optimizations: overrides.optimizations ?? baseResponse.optimizations,
    discoveries: overrides.discoveries ?? baseResponse.discoveries,
    insights: overrides.insights ?? baseResponse.insights,
    nutritional_summary: overrides.nutritional_summary ?? baseResponse.nutritional_summary,
    personalization_factors:
      overrides.personalization_factors ?? baseResponse.personalization_factors,
    total_suggestions: overrides.total_suggestions ?? baseResponse.total_suggestions,
    avg_confidence: overrides.avg_confidence ?? baseResponse.avg_confidence,
  };
};

interface SmartDietHarnessOptions {
  navigationContext?: SmartDietScreenNavigationContext;
}

interface SmartDietHarness {
  navigation: ReturnType<typeof createNavigationStubs>;
  fetchMock: ReturnType<typeof createFetchMock>;
  installFetchMock: () => void;
  restoreFetchMock: () => void;
  stubSmartDietFetch: (
    response:
      | SmartDietResponse
      | ((context: SmartDietContext, params: URLSearchParams) => SmartDietResponse),
  ) => void;
  buildScreenProps: (overrides?: Partial<SmartDietScreenProps>) => SmartDietScreenProps;
  reset: () => void;
}

export const createSmartDietTestHarness = (
  options: SmartDietHarnessOptions = {},
): SmartDietHarness => {
  const navigation = createNavigationStubs();
  const fetchMock = createFetchMock();
  let originalFetch: typeof fetch | undefined;

  const installFetchMock = () => {
    if (!originalFetch) {
      originalFetch = global.fetch as typeof fetch | undefined;
    }

    global.fetch = fetchMock.fetchMock as typeof fetch;
  };

  const restoreFetchMock = () => {
    fetchMock.resetHandlers();
    if (originalFetch) {
      global.fetch = originalFetch;
      originalFetch = undefined;
    }
  };

  const stubSmartDietFetch = (
    response:
      | SmartDietResponse
      | ((context: SmartDietContext, params: URLSearchParams) => SmartDietResponse),
  ) => {
    fetchMock.setHandler(
      input => resolveRequestUrl(input).includes('/smart-diet/suggestions'),
      async input => {
        const url = new URL(resolveRequestUrl(input), 'http://localhost');
        const context = (url.searchParams.get('context') as SmartDietContext) ?? SmartDietContext.TODAY;
        const payload =
          typeof response === 'function' ? response(context, url.searchParams) : response;
        return createMockFetchResponse(payload);
      },
    );
  };

  const buildScreenProps = (
    overrides: Partial<SmartDietScreenProps> = {},
  ): SmartDietScreenProps => ({
    onBackPress: overrides.onBackPress ?? navigation.onBackPress,
    navigateToTrack: overrides.navigateToTrack ?? navigation.navigateToTrack,
    navigateToPlan: overrides.navigateToPlan ?? navigation.navigateToPlan,
    navigationContext: {
      ...defaultNavigationContext,
      ...options.navigationContext,
      ...overrides.navigationContext,
    },
  });

  const reset = () => {
    resetSmartDietTestMocks();
    navigation.onBackPress.mockClear();
    navigation.navigateToTrack.mockClear();
    navigation.navigateToPlan.mockClear();
    fetchMock.resetHandlers();
  };

  return {
    navigation,
    fetchMock,
    installFetchMock,
    restoreFetchMock,
    stubSmartDietFetch,
    buildScreenProps,
    reset,
  };
};
