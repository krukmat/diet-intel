import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';

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
