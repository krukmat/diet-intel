import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Modal,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useConsumptionLogic } from '../hooks/useConsumptionLogic';
import { useDashboard } from '../hooks/useDashboard';
import { useMealPlan } from '../hooks/useMealPlan';
import { PlanHeader } from '../components/plan/PlanHeader';
import { ProgressSection } from '../components/plan/ProgressSection';
import { MealList } from '../components/plan/MealList';
import PlanScreen from './PlanScreen';

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

interface PlanScreenContainerProps {
  onBackPress: () => void;
  navigateToSmartDiet?: (context?: { planId?: string }) => void;
}

export default function PlanScreenContainer({
  onBackPress,
  navigateToSmartDiet
}: PlanScreenContainerProps) {
  const { t } = useTranslation();

  // User profile mock (should come from auth/profile context)
  const userProfile = {
    age: 30,
    sex: 'male' as const,
    height_cm: 175,
    weight_kg: 75,
    activity_level: 'moderately_active' as const,
    goal: 'maintain' as const,
  };

  // Hooks for business logic
  const consumptionLogic = useConsumptionLogic({
    t,
    onConsumptionSuccess: () => {
      // Refresh dashboard after consuming an item
      dashboardHook.refreshDashboard();
    },
  });

  const dashboardHook = useDashboard();

  const mealPlanHook = useMealPlan({
    t,
    userProfile,
  });

  // Modal states (should be moved to a hook if it grows)
  const [customizeModal, setCustomizeModal] = useState({
    visible: false,
    mealType: '',
    mealIndex: -1,
  });

  // Load dashboard on mount
  useEffect(() => {
    dashboardHook.loadDashboard();
  }, []);

  // Helper function to translate meal names
  const translateMealName = (mealName: string): string => {
    const translationKey = `plan.meals.${mealName}`;
    const translatedName = t(translationKey);
    return translatedName !== translationKey ? translatedName : mealName;
  };

  // Event handlers
  const handleCustomize = (mealIndex: number, mealType: string) => {
    setCustomizeModal({
      visible: true,
      mealType,
      mealIndex,
    });
  };

  const handleCustomizeConfirm = async (newItem: MealItem) => {
    await mealPlanHook.customizeMeal(customizeModal.mealType, 'add', newItem);
    setCustomizeModal(prev => ({ ...prev, visible: false }));
  };

  const handleOptimizePlan = () => {
    if (navigateToSmartDiet && mealPlanHook.currentPlanId) {
      navigateToSmartDiet({ planId: mealPlanHook.currentPlanId });
    } else {
      alert(t('plan.optimize.noPlan', 'No plan available for optimization'));
    }
  };

  // Loading states
  const isLoading = mealPlanHook.loading || dashboardHook.dashboardLoading;

  // Prepare data for presentation
  const presentationData = {
    // Header
    header: {
      title: t('plan.title', 'Meal Plan'),
      subtitle: mealPlanHook.dailyPlan
        ? t('plan.todaysCalories', {
            calories: Math.round(mealPlanHook.dailyPlan.daily_calorie_target)
          })
        : t('plan.loading', 'Loading...'),
    },

    // Progress
    progress: {
      dashboard: dashboardHook.dashboard,
      loading: dashboardHook.dashboardLoading,
      error: dashboardHook.dashboardError,
      onRetry: dashboardHook.refreshDashboard,
    },

    // Meals
    meals: {
      plan: mealPlanHook.dailyPlan,
      consumedItems: consumptionLogic.consumedItems,
      consumingItem: consumptionLogic.consumingItem,
      onConsumeItem: consumptionLogic.handleConsumeItem,
      onCustomizeMeal: handleCustomize,
    },

    // Actions
    actions: {
      onOptimize: handleOptimizePlan,
      onRegenerate: mealPlanHook.generatePlan,
      currentPlanId: mealPlanHook.currentPlanId,
    },

    // Modals
    modals: {
      customize: {
        visible: customizeModal.visible,
        onClose: () => setCustomizeModal(prev => ({ ...prev, visible: false })),
        onConfirm: handleCustomizeConfirm,
        mealType: customizeModal.mealType,
        translateMealName,
      },
    },
  };

  // Show loading screen
  if (isLoading && !mealPlanHook.dailyPlan) {
    return (
      <SafeAreaView style={styles.container}>
        <PlanHeader
          title={presentationData.header.title}
          subtitle={presentationData.header.subtitle}
          onBackPress={onBackPress}
          t={t}
        />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingSpinner} />
          <Text style={styles.loadingText}>
            {t('plan.generating', 'Generating your meal plan...')}
          </Text>
        </Text>
      </SafeAreaView>
    );
  }

  // Show error screen
  if (!mealPlanHook.dailyPlan && !isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <PlanHeader
          title={presentationData.header.title}
          subtitle={presentationData.header.subtitle}
          onBackPress={onBackPress}
          t={t}
        />
        <View style={styles.errorContainer}>
          <View style={styles.errorText}>
            {t('plan.failed', 'Failed to load meal plan')}
          </Text>
          <View style={styles.retryButton} onTouchEnd={mealPlanHook.generatePlan}>
            <View style={styles.retryButtonText}>
              {t('plan.retry', 'Retry')}
            </Text>
          </Text>
        </Text>
      </SafeAreaView>
    );
  }

  // Render main screen with presentation components
  return (
    <PlanScreen
      onBackPress={onBackPress}
      presentationData={presentationData}
      t={t}
      translateMealName={translateMealName}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSpinner: {
    width: 40,
    height: 40,
    borderWidth: 4,
    borderColor: '#007AFF',
    borderTopColor: 'transparent',
    borderRadius: 20,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
