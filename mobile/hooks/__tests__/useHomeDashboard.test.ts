/**
 * Tests unitarios para useHomeDashboard.ts
 */

import { renderHook } from '@testing-library/react-native';
import { useHomeDashboard, HomeDashboardData } from '../useHomeDashboard';

// Mock de react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: jest.fn((key: string) => key) // Mock simple que retorna la key
  })
}));

describe('useHomeDashboard hook', () => {
  it('should format complete data correctly', () => {
    const data: HomeDashboardData = {
      heroDailyCalories: 2000,
      heroPlannedCalories: 1800,
      heroConsumedCalories: 1200,
      heroPlanActive: true
    };

    const { result } = renderHook(() => useHomeDashboard(data));

    expect(result.current).toEqual({
      caloriesText: '2000 kcal',
      plannedCaloriesText: '1800 / 1800 kcal',
      progressText: '1200 / 2000 kcal',
      planText: 'Plan active'
    });
  });

  it('should handle null values', () => {
    const data: HomeDashboardData = {
      heroDailyCalories: null,
      heroPlannedCalories: null,
      heroConsumedCalories: null,
      heroPlanActive: null
    };

    const { result } = renderHook(() => useHomeDashboard(data));

    expect(result.current).toEqual({
      caloriesText: 'No calories set',
      plannedCaloriesText: null,
      progressText: 'No progress',
      planText: 'Plan unknown'
    });
  });

  it('should handle undefined values', () => {
    const data: HomeDashboardData = {
      heroDailyCalories: undefined,
      heroPlannedCalories: undefined,
      heroConsumedCalories: undefined,
      heroPlanActive: undefined
    };

    const { result } = renderHook(() => useHomeDashboard(data));

    expect(result.current).toEqual({
      caloriesText: 'No calories set',
      plannedCaloriesText: null,
      progressText: 'No progress',
      planText: 'Plan unknown'
    });
  });

  it('should handle partial data', () => {
    const data: HomeDashboardData = {
      heroDailyCalories: 2000,
      heroConsumedCalories: 1200,
      // plannedCalories y planActive son undefined
    };

    const { result } = renderHook(() => useHomeDashboard(data));

    expect(result.current).toEqual({
      caloriesText: '2000 kcal',
      plannedCaloriesText: null,
      progressText: '1200 / 2000 kcal',
      planText: 'Plan unknown'
    });
  });

  it('should handle inactive plan', () => {
    const data: HomeDashboardData = {
      heroPlanActive: false
    };

    const { result } = renderHook(() => useHomeDashboard(data));

    expect(result.current.planText).toBe('Plan inactive');
  });

  it('should round decimal values', () => {
    const data: HomeDashboardData = {
      heroDailyCalories: 2000.7,
      heroConsumedCalories: 1200.3,
      heroPlannedCalories: 1800.9
    };

    const { result } = renderHook(() => useHomeDashboard(data));

    expect(result.current).toEqual({
      caloriesText: '2001 kcal',
      plannedCaloriesText: '1801 / 1801 kcal',
      progressText: '1200 / 2001 kcal',
      planText: 'Plan unknown'
    });
  });

  it('should memoize results correctly', () => {
    const data: HomeDashboardData = {
      heroDailyCalories: 2000,
      heroConsumedCalories: 1200
    };

    const { result, rerender } = renderHook(
      (props) => useHomeDashboard(props),
      { initialProps: data }
    );

    const firstResult = result.current;

    // Re-render con los mismos datos
    rerender(data);

    // Debería ser el mismo objeto (memoizado) - verificar valores
    expect(result.current).toEqual(firstResult);

    // Cambiar datos
    const newData: HomeDashboardData = {
      heroDailyCalories: 2500,
      heroConsumedCalories: 1200
    };

    rerender(newData);

    // Debería tener valores diferentes
    expect(result.current).not.toEqual(firstResult);
    expect(result.current.caloriesText).toBe('2500 kcal');
  });
});
