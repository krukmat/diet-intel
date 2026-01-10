import { useEffect, useState } from 'react';
import { apiService } from '../services/ApiService';

export interface HomeHeroState {
  dailyCalories: number | null;
  consumedCalories: number | null;
  planActive: boolean | null;
  loading: boolean;
}

export const useHomeHero = (): HomeHeroState => {
  const [state, setState] = useState<HomeHeroState>({
    dailyCalories: null,
    consumedCalories: null,
    planActive: null,
    loading: true,
  });

  useEffect(() => {
    let isMounted = true;

    const loadHeroData = async () => {
      try {
        const response = await apiService.getDashboard();
        const activePlan = response.data?.active_plan ?? null;
        const consumedCalories = response.data?.progress?.calories?.consumed ?? null;
        if (!isMounted) return;
        setState({
          dailyCalories: activePlan?.daily_calorie_target ?? null,
          consumedCalories,
          planActive: Boolean(activePlan),
          loading: false,
        });
      } catch (error) {
        if (!isMounted) return;
        console.warn('Home hero load failed:', error);
        setState({
          dailyCalories: null,
          consumedCalories: null,
          planActive: null,
          loading: false,
        });
      }
    };

    loadHeroData();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
};
