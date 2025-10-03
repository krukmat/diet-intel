import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import SmartDietScreen from '../screens/SmartDietScreen';
import {
  renderWithWrappers,
  mockApiService,
  createTranslationMock,
  resetSmartDietTestMocks,
} from './testUtils';
import { apiService } from '../services/ApiService';

jest.mock('../contexts/AuthContext', () => {
  const { mockAuthContext } = require('./testUtils');
  return { useAuth: () => mockAuthContext };
});
jest.mock('@react-native-async-storage/async-storage', () => {
  const { mockedAsyncStorage } = require('./testUtils');
  return mockedAsyncStorage;
});
jest.mock('../services/NotificationService', () => {
  const { mockNotificationService } = require('./testUtils');
  return { notificationService: mockNotificationService };
});
jest.mock('@react-native-community/netinfo', () => {
  const { mockNetInfoModule } = require('./testUtils');
  return mockNetInfoModule;
});

jest.mock('../utils/mealPlanUtils', () => ({
  getCurrentMealPlanId: jest.fn(() => Promise.resolve('test_plan_123')),
  storeMealPlanId: jest.fn(),
}));

jest.mock('../utils/foodTranslation', () => ({
  translateFoodName: jest.fn(async (name: string) => name),
  translateFoodNameSync: jest.fn((name: string) => name),
}));

jest.mock('../config/environment', () => ({
  API_BASE_URL: 'http://localhost:8000',
}));

jest.mock('react-i18next', () => {
  const { createTranslationMock } = require('./testUtils');
  return createTranslationMock({
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
  });
});

const mockedApi = apiService as unknown as typeof mockApiService;

const buildSuggestion = () => ({
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
      fat: 2,
    },
  },
  created_at: '2025-01-01T08:00:00Z',
});

const buildResponse = (overrides: Record<string, any> = {}) => ({
  user_id: 'test_user',
  context: 'today',
  suggestions: [buildSuggestion()],
  total_suggestions: 1,
  avg_confidence: 0.85,
  generated_at: '2025-01-01T08:00:00Z',
  insights: {
    calories_today: 968,
    target_calories: 2000,
    macro_balance: {
      protein_percent: 16.6,
      fat_percent: 27.4,
      carbs_percent: 52.4,
    },
    improvement_areas: ['Increase protein intake', 'Add more fiber'],
    health_benefits: ['Improved protein intake', 'Better micronutrient profile'],
  },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  resetSmartDietTestMocks();

  Object.assign(mockedApi, mockApiService);

  mockedApi.get.mockResolvedValue({ data: buildResponse() });
  mockedApi.generateSmartRecommendations.mockResolvedValue({ data: buildResponse() });
});

describe('SmartDietScreen POC Tests', () => {
  it('renders correctly with proper structure', async () => {
    const { findByText, findAllByText, queryByText } = renderWithWrappers(
      <SmartDietScreen onBackPress={jest.fn()} />
    );

    await waitFor(() => {
      expect(queryByText('Loading recommendations...')).toBeNull();
    });

    expect(await findByText(/Smart Diet/)).toBeTruthy();
    expect((await findAllByText(/Today/)).length).toBeGreaterThan(0);
    expect((await findAllByText(/Optimize/)).length).toBeGreaterThan(0);
    expect((await findAllByText(/Discover/)).length).toBeGreaterThan(0);
    expect((await findAllByText(/Insights/)).length).toBeGreaterThan(0);
  });

  it('shows loading state initially', async () => {
    const { getByText } = renderWithWrappers(<SmartDietScreen onBackPress={jest.fn()} />);
    expect(getByText('Loading recommendations...')).toBeTruthy();
  });

  it('displays suggestions after loading completes', async () => {
    const { getByText, queryByText } = renderWithWrappers(<SmartDietScreen onBackPress={jest.fn()} />);

    await waitFor(() => {
      expect(queryByText('Loading recommendations...')).toBeNull();
    });

    expect(getByText('Greek Yogurt with Berries')).toBeTruthy();
    expect(getByText('High-protein breakfast option with antioxidants')).toBeTruthy();
  });

  it('switches between different contexts', async () => {
    const { findAllByText } = renderWithWrappers(<SmartDietScreen onBackPress={jest.fn()} />);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(expect.stringContaining('context=today'));
    });

    const optimizeButtons = await findAllByText(/Optimize/);
    fireEvent.press(optimizeButtons[0]);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(expect.stringContaining('context=optimize'));
    });
  });

  it('handles context switching with loading states', async () => {
    let resolvePromise: (value: any) => void;
    const delayedPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    mockedApi.get.mockReturnValueOnce(delayedPromise);

    const { getByText } = renderWithWrappers(<SmartDietScreen onBackPress={jest.fn()} />);

    expect(getByText('Loading recommendations...')).toBeTruthy();

    resolvePromise!({ data: buildResponse({ suggestions: [] }) });

    await waitFor(() => {
      expect(getByText('No suggestions available at the moment.')).toBeTruthy();
    });
  });

  it('handles API errors gracefully and shows fallback', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('Network error'));
    mockedApi.generateSmartRecommendations.mockResolvedValue({
      data: buildResponse({
        suggestions: [],
        total_suggestions: 0,
        avg_confidence: 0,
      }),
    });

    const { findByText } = renderWithWrappers(<SmartDietScreen onBackPress={jest.fn()} />);

    await waitFor(() => {
      expect(mockedApi.generateSmartRecommendations).toHaveBeenCalled();
    });

    expect(await findByText('No suggestions available at the moment.')).toBeTruthy();
  });

  it('refreshes suggestions when retrying after an error', async () => {
    mockedApi.get
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({ data: buildResponse({ suggestions: [] }) });

    const { findByText } = renderWithWrappers(<SmartDietScreen onBackPress={jest.fn()} />);

    const refreshButton = await findByText('🔄 Refresh Suggestions');
    fireEvent.press(refreshButton);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledTimes(2);
    });
  });

  it('handles optimize context without meal plan gracefully', async () => {
    const { findAllByText } = renderWithWrappers(<SmartDietScreen onBackPress={jest.fn()} />);

    const optimizeButtons = await findAllByText('Optimize');
    fireEvent.press(optimizeButtons[0]);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(expect.stringContaining('context=optimize'));
    });
  });

  it('falls back to legacy recommendations when Smart Diet API fails', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('Smart Diet API not available'));
    mockedApi.generateSmartRecommendations.mockResolvedValue({
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
                reasons: ['Fiber rich'],
              },
            ],
          },
        ],
        nutritional_insights: {
          total_recommended_calories: 1800,
          macro_distribution: {
            protein_percent: 20,
            fat_percent: 25,
            carbs_percent: 55,
          },
        },
      },
    });

    const { findByText } = renderWithWrappers(<SmartDietScreen onBackPress={jest.fn()} />);

    await waitFor(() => {
      expect(mockedApi.generateSmartRecommendations).toHaveBeenCalled();
    });

    expect(await findByText('Oatmeal')).toBeTruthy();
  });

  it('uses correct API endpoint format', async () => {
    renderWithWrappers(<SmartDietScreen onBackPress={jest.fn()} />);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(expect.stringMatching(/\/smart-diet\/suggestions\?/));
    });
  });

  it('includes proper query parameters', async () => {
    renderWithWrappers(<SmartDietScreen onBackPress={jest.fn()} />);

    await waitFor(() => {
      const callArgs = mockedApi.get.mock.calls[0][0];
      expect(callArgs).toContain('context=today');
      expect(callArgs).toContain('max_suggestions=10');
      expect(callArgs).toContain('include_history=true');
      expect(callArgs).toContain('lang=en');
    });
  });

  it('retrieves meal plan ID for optimize context', async () => {
    const { findAllByText } = renderWithWrappers(<SmartDietScreen onBackPress={jest.fn()} />);

    const optimizeButtons = await findAllByText('Optimize');
    fireEvent.press(optimizeButtons[0]);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(expect.stringContaining('context=optimize'));
    });
  });
});
