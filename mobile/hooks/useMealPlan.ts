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
    if (!dailyPlan) return;

    try {
      const customizeData = {
        meal_type: mealType.toLowerCase(),
        action,
        item,
      };

      await apiService.customizeMealPlan(customizeData);

      // Update local state
      const updatedPlan = { ...dailyPlan };
      const mealIndex = updatedPlan.meals.findIndex(m => m.name.toLowerCase() === mealType.toLowerCase());

      if (mealIndex >= 0) {
        const meal = updatedPlan.meals[mealIndex];
        if (action === 'add') {
          meal.items.push(item);
        }
        // Recalculate totals
        meal.actual_calories = meal.items.reduce((sum, item) => sum + item.calories, 0);
        setDailyPlan(updatedPlan);
      }

      Alert.alert(t('common.success'), 'Item added to meal plan!');
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to customize meal plan.');
    }
  }, [dailyPlan, t]);

  return {
    dailyPlan,
    loading,
    currentPlanId,
    generatePlan,
    customizeMeal,
  };
};
