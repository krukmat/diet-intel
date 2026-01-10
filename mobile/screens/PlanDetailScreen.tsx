import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/ApiService';
import { translateFoodNameSync } from '../utils/foodTranslation';

interface MealItem {
  barcode: string;
  name: string;
  serving: string;
  calories: number;
}

interface Meal {
  name: string;
  target_calories: number;
  actual_calories: number;
  items: MealItem[];
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
  };
  created_at: string;
  flexibility_used: boolean;
  optional_products_used: number;
}

interface PlanDetailScreenProps {
  onBackPress?: () => void;
  planId?: string;
  planData?: DailyPlan;
}

interface PlanProgress {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

const renderProgressBar = (current: number, target: number, color: string) => {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
      <Text style={styles.progressText}>{Math.round(current)} / {Math.round(target)}</Text>
    </View>
  );
};

const PlanDetailScreen: React.FC<PlanDetailScreenProps> = ({ onBackPress, planId, planData }) => {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<DailyPlan | null>(planData ?? null);
  const [progress, setProgress] = useState<PlanProgress>({
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  });
  const [loading, setLoading] = useState(false);

  const loadPlan = async () => {
    if (!planId || planData) return;
    setLoading(true);
    try {
      const response = await apiService.getUserPlans();
      const matched = (response.data || []).find((entry: any) => entry.plan_id === planId);
      if (matched && matched.meals && matched.metrics) {
        setPlan(matched);
      }
    } catch (error) {
      console.error('Plan detail fetch failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    try {
      const response = await apiService.getDashboard();
      const progressData = response.data?.progress;
      setProgress({
        calories: progressData?.calories?.consumed ?? 0,
        protein: progressData?.protein?.consumed ?? 0,
        fat: progressData?.fat?.consumed ?? 0,
        carbs: progressData?.carbs?.consumed ?? 0,
      });
    } catch (error) {
      console.error('Plan detail progress fetch failed:', error);
    }
  };

  useEffect(() => {
    if (planData) {
      setPlan(planData);
    }
    loadPlan();
  }, [planId, planData]);

  useEffect(() => {
    loadProgress();
  }, []);

  const meals = useMemo(() => plan?.meals ?? [], [plan]);

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>🏠</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{t('plan.title')}</Text>
          <Text style={styles.subtitle}>
            {plan
              ? t('plan.todaysCalories', { calories: Math.round(plan.daily_calorie_target) })
              : t('plan.detail.subtitle')}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>{t('plan.detail.loading')}</Text>
          </View>
        )}

        {!loading && !plan && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{t('plan.detail.notFound')}</Text>
          </View>
        )}

        {!loading && plan && (
          <>
            <View style={styles.progressSection}>
              <Text style={styles.sectionTitle}>{t('plan.dailyProgress')}</Text>

              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>{t('plan.calories')}</Text>
                {renderProgressBar(progress.calories, plan.metrics.total_calories, '#FF6B6B')}
              </View>

              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>{t('plan.protein')}</Text>
                {renderProgressBar(progress.protein, plan.metrics.protein_g, '#4ECDC4')}
              </View>

              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>{t('plan.fat')}</Text>
                {renderProgressBar(progress.fat, plan.metrics.fat_g, '#45B7D1')}
              </View>

              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>{t('plan.carbs')}</Text>
                {renderProgressBar(progress.carbs, plan.metrics.carbs_g, '#F9CA24')}
              </View>
            </View>

            <View style={styles.mealsSection}>
              <Text style={styles.sectionTitle}>{t('plan.plannedMeals')}</Text>
              {meals.map((meal, index) => (
                <View key={`${meal.name}-${index}`} style={styles.mealCard}>
                  <View style={styles.mealHeader}>
                    <Text style={styles.mealTitle}>{meal.name}</Text>
                    <Text style={styles.mealCalories}>{Math.round(meal.actual_calories)} kcal</Text>
                  </View>
                  {meal.items.map((item, itemIndex) => (
                    <View key={`${item.barcode}-${itemIndex}`} style={styles.mealItem}>
                      <Text style={styles.mealItemName}>{translateFoodNameSync(item.name)}</Text>
                      <Text style={styles.mealItemMeta}>
                        {item.serving} • {Math.round(item.calories)} kcal
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 40,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    minWidth: 40,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
  },
  progressSection: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  progressItem: {
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  progressBarContainer: {
    height: 18,
    backgroundColor: '#EAEAEA',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 10,
  },
  progressText: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    fontSize: 10,
    color: '#333',
  },
  mealsSection: {
    marginTop: 20,
    marginBottom: 30,
  },
  mealCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  mealCalories: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  mealItem: {
    marginBottom: 6,
  },
  mealItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  mealItemMeta: {
    fontSize: 11,
    color: '#777',
  },
});

export default PlanDetailScreen;
