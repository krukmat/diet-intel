import { useState, useCallback } from 'react';
import { apiService } from '../services/ApiService';
import { TFunction } from 'i18next';
import { Alert } from 'react-native';
import { storeCurrentMealPlanId } from '../utils/mealPlanUtils';

interface UserProfile {
  age: number;
  sex: 'male' | 'female';
  height_cm: number;
  weight_kg: number;
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
  goal: 'lose_weight' | 'maintain' | 'gain_weight';
}

interface MealPlanRequest {
  user_profile: UserProfile;
  preferences?: {
    dietary_restrictions?: string[];
    excludes?: string[];
    prefers?: string[];
  };
  optional_products?: string[];
  flexibility?: boolean;
}

interface MealItem {
  barcode: string;
  name: string;
  serving: string;
  calories: number;
  macros: {
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    sugars_g?: number;
    salt_g?: number;
  };
}

interface DailyPlan {
  bmr: number;
  tdee: number;
  daily_calorie_target: number;
  meals: Meal[];
  metrics: {
    total_calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    sugars_g: number;
    salt_g: number;
    protein_percent: number;
    fat_percent: number;
    carbs_percent: number;
  };
  created_at: string;
  flexibility_used: boolean;
  optional_products_used: number;
}

interface Meal {
  name: string;
  target_calories: number;
  actual_calories: number;
  items: MealItem[];
}

export interface UseMealPlanProps {
  t: TFunction;
  userProfile: UserProfile;
}

export interface UseMealPlanReturn {
  dailyPlan: DailyPlan | null;
  loading: boolean;
  currentPlanId: string | null;
  generatePlan: () => Promise<void>;
  customizeMeal: (mealType: string, action: string, item: MealItem) => Promise<void>;
}

export const useMealPlan = ({ t, userProfile }: UseMealPlanProps): UseMealPlanReturn => {
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  const generatePlan = useCallback(async () => {
    setLoading(true);
    try {
      const request: MealPlanRequest = {
        user_profile: userProfile,
        preferences: {
          dietary_restrictions: [],
          excludes: [],
          prefers: [],
        },
        optional_products: [],
        flexibility: false,
      };

      const response = await apiService.generateMealPlan(request);
      console.log('PlanScreen Debug - Full response structure:', JSON.stringify(response.data, null, 2));
      setDailyPlan(response.data);

      // Store the plan ID for use in Smart Diet optimization
      if (response.data && response.data.plan_id) {
        try {
          await storeCurrentMealPlanId(response.data.plan_id);
          setCurrentPlanId(response.data.plan_id);
          console.log('PlanScreen Debug - Successfully stored meal plan ID:', response.data.plan_id);
        } catch (error) {
          console.error('PlanScreen Debug - Failed to store meal plan ID:', error);
        }
      } else {
        console.log('PlanScreen Debug - No plan_id found in response. response.data:', response.data ? 'exists' : 'null', 'plan_id:', response.data?.plan_id);
      }
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to generate meal plan. Please try again.');
      console.error('Plan generation failed:', error);
    } finally {
      setLoading(false);
    }
  }, [t, userProfile]);

  const customizeMeal = useCallback(async (mealType: string, action: string, item: MealItem) => {
    if (!dailyPlan || !currentPlanId) return;

    try {
      const customizeData = action === 'add'
        ? {
            add_manual: {
              barcode: item.barcode,
              name: item.name,
              calories: item.calories,
              protein_g: item.macros.protein_g,
              fat_g: item.macros.fat_g,
              carbs_g: item.macros.carbs_g,
              sugars_g: item.macros.sugars_g,
              salt_g: item.macros.salt_g,
              serving: item.serving,
            },
          }
        : {};

      const response = await apiService.customizeMealPlan(currentPlanId, customizeData);

      // Update local state
      if (response.data?.plan) {
        setDailyPlan(response.data.plan);
      }

      Alert.alert(t('common.success'), 'Item added to meal plan!');
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to customize meal plan.');
    }
  }, [currentPlanId, dailyPlan, t]);

  return {
    dailyPlan,
    loading,
    currentPlanId,
    generatePlan,
    customizeMeal,
  };
};
