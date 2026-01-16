/**
 * Custom hook para la lógica del HomeDashboard
 * Extrae la lógica de formateo y estado del componente principal
 */

import { useMemo } from 'react';
import { useHomeDashboardFormatters } from '../utils/homeDashboardFormatters';

export interface HomeDashboardData {
  heroDailyCalories?: number | null;
  heroPlannedCalories?: number | null;
  heroConsumedCalories?: number | null;
  heroPlanActive?: boolean | null;
}

export interface FormattedHomeDashboardData {
  caloriesText: string;
  plannedCaloriesText: string | null;
  progressText: string;
  planText: string;
}

/**
 * Hook personalizado que maneja la lógica de formateo del HomeDashboard
 */
export const useHomeDashboard = (data: HomeDashboardData): FormattedHomeDashboardData => {
  const formatters = useHomeDashboardFormatters();

  return useMemo(() => ({
    caloriesText: formatters.formatCaloriesText(data.heroDailyCalories),
    plannedCaloriesText: data.heroPlannedCalories !== null && data.heroPlannedCalories !== undefined
      ? formatters.formatProgressText(data.heroPlannedCalories, data.heroPlannedCalories)
      : null,
    progressText: formatters.formatProgressText(data.heroConsumedCalories, data.heroDailyCalories),
    planText: formatters.formatPlanStatus(data.heroPlanActive),
  }), [
    data.heroDailyCalories,
    data.heroPlannedCalories,
    data.heroConsumedCalories,
    data.heroPlanActive,
    formatters
  ]);
};
