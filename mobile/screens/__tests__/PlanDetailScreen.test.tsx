import React from 'react';
import { render } from '@testing-library/react-native';
import PlanDetailScreen from '../PlanDetailScreen';
import { apiService } from '../../services/ApiService';

jest.mock('../../services/ApiService', () => ({
  apiService: {
    getUserPlans: jest.fn(),
    getDashboard: jest.fn(),
  },
}));

jest.mock('../../utils/foodTranslation', () => ({
  translateFoodNameSync: (name: string) => name,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => {
      if (typeof fallback === 'string') {
        return fallback;
      }
      return key;
    },
  }),
}));

describe('PlanDetailScreen', () => {
  const getUserPlansMock = apiService.getUserPlans as jest.Mock;
  const getDashboardMock = apiService.getDashboard as jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks();
    getDashboardMock.mockResolvedValue({
      data: {
        progress: {
          calories: { consumed: 300, planned: 1800, percentage: 16 },
          protein: { consumed: 20, planned: 120, percentage: 16 },
          fat: { consumed: 10, planned: 60, percentage: 16 },
          carbs: { consumed: 40, planned: 200, percentage: 16 },
        },
      },
    });
  });

  it('renders plan details when plan is found', () => {
    const planData = {
      plan_id: 'plan-1',
      daily_calorie_target: 1800,
      meals: [
        {
          name: 'Breakfast',
          target_calories: 450,
          actual_calories: 420,
          items: [
            { barcode: '1', name: 'Eggs', serving: '2 units', calories: 150 },
          ],
        },
      ],
      metrics: {
        total_calories: 1800,
        protein_g: 120,
        fat_g: 60,
        carbs_g: 200,
      },
      created_at: '2026-01-10T00:00:00Z',
      flexibility_used: false,
      optional_products_used: 0,
      bmr: 0,
      tdee: 0,
    };

    const { queryByText } = render(<PlanDetailScreen planData={planData as any} />);

    expect(queryByText('plan.title')).not.toBeNull();
    expect(queryByText('Breakfast')).not.toBeNull();
    expect(queryByText('Eggs')).not.toBeNull();
  });

  it('shows not found when plan is missing', async () => {
    getUserPlansMock.mockResolvedValueOnce({ data: [] });

    const { findByText } = render(<PlanDetailScreen planId="missing" />);

    expect(await findByText('plan.detail.notFound')).toBeTruthy();
  });
});
