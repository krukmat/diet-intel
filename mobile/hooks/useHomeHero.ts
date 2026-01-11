import { useEffect, useState } from 'react';
import { apiService } from '../services/ApiService';

export interface HomeHeroState {
  dailyCalories: number | null;
  plannedCalories: number | null;
  consumedCalories: number | null;
  planActive: boolean | null;
  loading: boolean;
}

export const useHomeHero = (userId?: string | null): HomeHeroState => {
  const [state, setState] = useState<HomeHeroState>({
    dailyCalories: null,
    plannedCalories: null,
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
        let fallbackPlan = activePlan;
        if (!fallbackPlan) {
          try {
            const plansResponse = await apiService.getUserPlans();
            const plans = plansResponse.data || [];
            fallbackPlan = plans.find((plan: any) => plan.is_active) ?? null;
          } catch (error) {
            console.warn('Home hero plan fallback failed:', error);
          }
        }

        if (!isMounted) return;
        setState({
          dailyCalories: fallbackPlan?.daily_calorie_target ?? null,
          plannedCalories: fallbackPlan?.metrics?.total_calories ?? null,
          consumedCalories,
          planActive: Boolean(fallbackPlan),
          loading: false,
        });
      } catch (error) {
        if (!isMounted) return;
        console.warn('Home hero load failed:', error);
        setState({
          dailyCalories: null,
          plannedCalories: null,
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
  }, [userId]);

  return state;
};
