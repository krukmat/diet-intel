/**
 * Utilidades de formateo para HomeDashboard
 * Funciones puras para formatear datos del dashboard
 */

import { useTranslation } from 'react-i18next';

/**
 * Formatea el texto de calorías diarias
 */
export const formatCaloriesText = (calories?: number | null): string => {
  if (calories === null || calories === undefined) {
    return 'Sin objetivo';
  }

  return `${Math.round(calories)} kcal`;
};

/**
 * Formatea el texto de progreso diario
 */
export const formatProgressText = (
  consumed?: number | null,
  daily?: number | null
): string => {
  if (consumed === null || consumed === undefined) {
    return 'Sin datos';
  }

  const consumedRounded = Math.round(consumed);

  if (daily === null || daily === undefined) {
    return `${consumedRounded} kcal`;
  }

  const dailyRounded = Math.round(daily);
  return `${consumedRounded} / ${dailyRounded} kcal`;
};

/**
 * Formatea el texto de progreso simple (solo calorías consumidas)
 */
export const formatSimpleProgressText = (consumed?: number | null): string => {
  if (consumed === null || consumed === undefined) {
    return 'Sin datos';
  }

  return `${Math.round(consumed)} kcal`;
};

/**
 * Formatea el texto del plan de alimentación
 */
export const formatPlanStatus = (active?: boolean | null): string => {
  if (active === true) {
    return 'Plan activo';
  }

  if (active === false) {
    return 'Plan inactivo';
  }

  return 'Sin datos';
};

/**
 * Hook personalizado que proporciona formateadores con traducciones
 */
export const useHomeDashboardFormatters = () => {
  const { t } = useTranslation();

  return {
    formatCaloriesText: (calories?: number | null) => {
      if (calories !== null && calories !== undefined) {
        return `${Math.round(calories)} kcal`;
      }
      return t('home.hero.noCalories');
    },

    formatProgressText: (consumed?: number | null, daily?: number | null) => {
      if (consumed === null || consumed === undefined) {
        return t('home.hero.noProgress');
      }

      const consumedRounded = Math.round(consumed);

      if (daily === null || daily === undefined) {
        return `${consumedRounded} kcal`;
      }

      const dailyRounded = Math.round(daily);
      return `${consumedRounded} / ${dailyRounded} kcal`;
    },

    formatPlanStatus: (active?: boolean | null) => {
      if (active === true) {
        return t('home.hero.planActive');
      }

      if (active === false) {
        return t('home.hero.planInactive');
      }

      return t('home.hero.planUnknown');
    },

    // Método para obtener traducciones (fallback)
    t: (key: string, options?: any) => t(key, options)
  };
};
