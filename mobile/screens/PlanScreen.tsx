import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/ApiService';
import { translateFoodNameSync } from '../utils/foodTranslation';
import { clearCurrentMealPlanId, storeCurrentMealPlanId } from '../utils/mealPlanUtils';
import { PlanSelectionList, PlanSummary } from '../components/plan/PlanSelectionList';
import { planScreenStyles as styles } from '../shared/ui/styles';
import type { NavigationContext } from '../core/navigation/NavigationTypes';

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

interface CustomizeModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (newItem: MealItem) => void;
  mealType: string;
  translateMealName: (mealName: string) => string;
}

export const CustomizeModal: React.FC<CustomizeModalProps> = ({
  visible,
  onClose,
  onConfirm,
  mealType,
  translateMealName,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'barcode' | 'text'>('barcode');
  const [loading, setLoading] = useState(false);
  const [manualItem, setManualItem] = useState({
    name: '',
    brand: '',
    serving_size: '',
    calories_per_serving: '',
    protein_g: '',
    fat_g: '',
    carbs_g: '',
  });
  const [mode, setMode] = useState<'search' | 'manual'>('search');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const endpoint = searchType === 'barcode' 
        ? `/product/by-barcode/${searchQuery.trim()}`
        : `/product/search?q=${encodeURIComponent(searchQuery.trim())}`;
        
      const response = searchType === 'barcode' 
        ? await apiService.getProductByBarcode(searchQuery.trim())
        : await apiService.searchProduct(searchQuery.trim());
      
      if (response.data) {
        const product = response.data;
        const newItem: MealItem = {
          barcode: product.code || `manual_${Date.now()}`,
          name: product.product_name || product.name || 'Unknown Product',
          serving: product.serving_size || '100g',
          calories: product.nutriments?.energy_kcal_100g || 0,
          macros: {
            protein_g: product.nutriments?.proteins_100g || 0,
            fat_g: product.nutriments?.fat_100g || 0,
            carbs_g: product.nutriments?.carbohydrates_100g || 0,
          },
        };
        onConfirm(newItem);
        resetModal();
      }
    } catch (error) {
      Alert.alert(t('common.error'), 'Could not find product. Try manual entry instead.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualAdd = () => {
    if (!manualItem.name.trim()) {
      Alert.alert(t('common.error'), 'Please enter a product name');
      return;
    }

    const newItem: MealItem = {
      barcode: `manual_${Date.now()}`,
      name: manualItem.name,
      serving: manualItem.serving_size || '100g',
      calories: parseFloat(manualItem.calories_per_serving) || 0,
      macros: {
        protein_g: parseFloat(manualItem.protein_g) || 0,
        fat_g: parseFloat(manualItem.fat_g) || 0,
        carbs_g: parseFloat(manualItem.carbs_g) || 0,
      },
    };

    onConfirm(newItem);
    resetModal();
  };

  const resetModal = () => {
    setSearchQuery('');
    setManualItem({
      name: '',
      brand: '',
      serving_size: '',
      calories_per_serving: '',
      protein_g: '',
      fat_g: '',
      carbs_g: '',
    });
    setMode('search');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('plan.customize')} {translateMealName(mealType)}</Text>
          <TouchableOpacity onPress={resetModal} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'search' && styles.modeButtonActive]}
            onPress={() => setMode('search')}
          >
            <Text style={[styles.modeButtonText, mode === 'search' && styles.modeButtonTextActive]}>
              🔍 {t('plan.modal.search')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'manual' && styles.modeButtonActive]}
            onPress={() => setMode('manual')}
          >
            <Text style={[styles.modeButtonText, mode === 'manual' && styles.modeButtonTextActive]}>
              ✏️ {t('plan.modal.manual')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {mode === 'search' ? (
            <View>
              <View style={styles.searchTypeSelector}>
                <TouchableOpacity
                  style={[styles.searchTypeButton, searchType === 'barcode' && styles.searchTypeButtonActive]}
                  onPress={() => setSearchType('barcode')}
                >
                  <Text style={styles.searchTypeButtonText}>{t('plan.modal.barcode')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.searchTypeButton, searchType === 'text' && styles.searchTypeButtonActive]}
                  onPress={() => setSearchType('text')}
                >
                  <Text style={styles.searchTypeButtonText}>{t('plan.modal.text')}</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.searchInput}
                placeholder={searchType === 'barcode' ? t('scanner.manual.placeholder') : t('plan.modal.searchProduct')}
                value={searchQuery}
                onChangeText={setSearchQuery}
                keyboardType={searchType === 'barcode' ? 'numeric' : 'default'}
              />

              <TouchableOpacity
                style={[styles.actionButton, (!searchQuery.trim() || loading) && styles.buttonDisabled]}
                onPress={handleSearch}
                disabled={!searchQuery.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.actionButtonText}>{t('plan.modal.searchProduct')}</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.sectionTitle}>{t('plan.modal.addManualItem')}</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('plan.modal.productName')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={manualItem.name}
                  onChangeText={(text) => setManualItem(prev => ({ ...prev, name: text }))}
                  placeholder={t('plan.modal.productNamePlaceholder')}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('plan.modal.brand')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={manualItem.brand}
                  onChangeText={(text) => setManualItem(prev => ({ ...prev, brand: text }))}
                  placeholder={t('plan.modal.brandPlaceholder')}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('plan.modal.servingSize')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={manualItem.serving_size}
                  onChangeText={(text) => setManualItem(prev => ({ ...prev, serving_size: text }))}
                  placeholder={t('plan.modal.servingSizePlaceholder')}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('plan.modal.caloriesPerServing')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={manualItem.calories_per_serving}
                  onChangeText={(text) => setManualItem(prev => ({ ...prev, calories_per_serving: text }))}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.macroRow}>
                <View style={styles.macroInput}>
                  <Text style={styles.inputLabel}>{t('plan.modal.proteinG')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={manualItem.protein_g}
                    onChangeText={(text) => setManualItem(prev => ({ ...prev, protein_g: text }))}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.macroInput}>
                  <Text style={styles.inputLabel}>{t('plan.modal.fatG')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={manualItem.fat_g}
                    onChangeText={(text) => setManualItem(prev => ({ ...prev, fat_g: text }))}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.macroInput}>
                  <Text style={styles.inputLabel}>{t('plan.modal.carbsG')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={manualItem.carbs_g}
                    onChangeText={(text) => setManualItem(prev => ({ ...prev, carbs_g: text }))}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.actionButton, !manualItem.name.trim() && styles.buttonDisabled]}
                onPress={handleManualAdd}
                disabled={!manualItem.name.trim()}
              >
                <Text style={styles.actionButtonText}>{t('plan.modal.addItem')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

interface PlanScreenProps {
  onBackPress: () => void;
  onViewPlan?: (planId: string) => void;
  navigateToSmartDiet?: (context?: { planId?: string }) => void;
  navigationContext?: NavigationContext;
}

export default function PlanScreen({
  onBackPress,
  onViewPlan,
  navigateToSmartDiet,
  navigationContext,
}: PlanScreenProps) {
  const { t } = useTranslation();
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [planList, setPlanList] = useState<PlanSummary[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [optimizeModalVisible, setOptimizeModalVisible] = useState(false);
  
  // Helper function to translate meal names
  const translateMealName = (mealName: string): string => {
    const translationKey = `plan.meals.${mealName}`;
    const translatedName = t(translationKey);
    // If translation doesn't exist, fall back to original name
    return translatedName !== translationKey ? translatedName : mealName;
  };

  
  const [customizeModal, setCustomizeModal] = useState({
    visible: false,
    mealType: '',
    mealIndex: -1,
  });
  
  const [consumed, setConsumed] = useState({
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  });

  const mockUserProfile: UserProfile = {
    age: 30,
    sex: 'male',
    height_cm: 175,
    weight_kg: 75,
    activity_level: 'moderately_active',
    goal: 'maintain',
  };

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const response = await apiService.getUserPlans();
      const plans = (response.data || []).map((plan: any) => ({
        planId: plan.plan_id,
        isActive: Boolean(plan.is_active),
        createdAt: plan.created_at,
        dailyCalorieTarget: plan.daily_calorie_target ?? 0,
      }));
      setPlanList(plans);
      const activePlan = (response.data || []).find((plan: any) => plan.is_active);
      if (activePlan?.plan_id && activePlan?.meals && activePlan?.metrics) {
        setDailyPlan(activePlan);
        setCurrentPlanId(activePlan.plan_id);
      }
    } catch (error) {
      console.error('Plan list fetch failed:', error);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await apiService.getDashboard();
      const progress = response.data?.progress;
      setConsumed({
        calories: progress?.calories?.consumed ?? 0,
        protein: progress?.protein?.consumed ?? 0,
        fat: progress?.fat?.consumed ?? 0,
        carbs: progress?.carbs?.consumed ?? 0,
      });
    } catch (error) {
      console.error('Dashboard fetch failed:', error);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard, currentPlanId]);
  
  useEffect(() => {
    if (!navigationContext) return;
    fetchPlans();
    fetchDashboard();
  }, [navigationContext, fetchDashboard, fetchPlans]);

  const togglePlanActive = useCallback(
    async (planId: string, currentlyActive: boolean) => {
      setPlansLoading(true);
      try {
        const response = await apiService.setPlanActive(planId, !currentlyActive);
        const updated = response.data;
        if (updated?.is_active) {
          setCurrentPlanId(updated.plan_id);
          await storeCurrentMealPlanId(updated.plan_id);
        } else if (currentPlanId === planId) {
          setCurrentPlanId(null);
          await clearCurrentMealPlanId();
        }
        await fetchPlans();
      } catch (error) {
        Alert.alert(t('common.error'), 'No se pudo cambiar el estado del plan.');
      } finally {
        setPlansLoading(false);
      }
    },
    [currentPlanId, fetchPlans, t]
  );

  const handleDeletePlan = useCallback(
    (planId: string, isActive: boolean) => {
      Alert.alert(
        t('plan.list.deleteConfirmTitle'),
        t('plan.list.deleteConfirmBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              setPlansLoading(true);
              try {
                await apiService.deleteMealPlan(planId);
                if (isActive && currentPlanId === planId) {
                  setCurrentPlanId(null);
                  setDailyPlan(null);
                  await clearCurrentMealPlanId();
                }
                await fetchPlans();
              } catch (error) {
                Alert.alert(t('common.error'), t('plan.list.deleteError'));
              } finally {
                setPlansLoading(false);
              }
            },
          },
        ]
      );
    },
    [currentPlanId, fetchPlans, t]
  );

  const handleOptimizePlan = () => {
    if (navigateToSmartDiet && currentPlanId) {
      setOptimizeModalVisible(true);
    } else {
      Alert.alert(
        t('plan.optimize.title'),
        t('plan.optimize.noPlan'),
        [{ text: t('common.ok') }]
      );
    }
  };

  const handleConfirmOptimize = () => {
    if (!currentPlanId) {
      setOptimizeModalVisible(false);
      return;
    }
    setOptimizeModalVisible(false);
    navigateToSmartDiet?.({ planId: currentPlanId, targetContext: 'optimize' });
  };

  const activePlanSummary = planList.find((plan) => plan.planId === currentPlanId);
  const activePlanDate = activePlanSummary?.createdAt
    ? new Date(activePlanSummary.createdAt).toLocaleDateString()
    : null;

  const generatePlan = async () => {
    setLoading(true);
    try {
      const request: MealPlanRequest = {
        user_profile: mockUserProfile,
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
      await fetchPlans();
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to generate meal plan. Please try again.');
      console.error('Plan generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomize = (mealIndex: number, mealType: string) => {
    setCustomizeModal({
      visible: true,
      mealType,
      mealIndex,
    });
  };

  const handleCustomizeConfirm = async (newItem: MealItem) => {
    if (!dailyPlan) return;

    try {
      const customizeData = {
        meal_type: customizeModal.mealType.toLowerCase(),
        action: 'add',
        item: newItem,
      };

      await apiService.customizeMealPlan(customizeData);
      
      // Update local state
      const updatedPlan = { ...dailyPlan };
      const meal = updatedPlan.meals[customizeModal.mealIndex];
      meal.items.push(newItem);
      
      // Recalculate totals
      meal.actual_calories = meal.items.reduce((sum, item) => sum + item.calories, 0);
      
      setDailyPlan(updatedPlan);
      Alert.alert(t('common.success'), 'Item added to meal plan!');
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to customize meal plan.');
    }
  };

  const renderProgressBar = (current: number, target: number, color: string) => {
    const percentage = Math.min((current / target) * 100, 100);
    return (
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { backgroundColor: `${color}20` }]}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${percentage}%`, backgroundColor: color }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {Math.round(current)}/{Math.round(target)}
        </Text>
      </View>
    );
  };

  const renderMeal = (meal: Meal, index: number) => (
    <View key={meal.name} style={styles.mealCard}>
      <View style={styles.mealHeader}>
        <Text style={styles.mealTitle}>
          {meal.name === 'Breakfast' ? '🌅' : 
           meal.name === 'Lunch' ? '🌞' : '🌙'} {translateMealName(meal.name)}
        </Text>
        <Text style={styles.mealCalories}>{Math.round(meal.actual_calories)} kcal</Text>
      </View>

      {meal.items.map((item, itemIndex) => (
        <View key={itemIndex} style={styles.mealItem}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{translateFoodNameSync(item.name)}</Text>
            <Text style={styles.itemServing}>{item.serving} • {Math.round(item.calories)} kcal</Text>
            <Text style={styles.macroText}>P: {Math.round(item.macros.protein_g)}g F: {Math.round(item.macros.fat_g)}g C: {Math.round(item.macros.carbs_g)}g</Text>
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={styles.customizeButton}
        onPress={() => handleCustomize(index, meal.name)}
      >
        <Text style={styles.customizeButtonText}>{t('plan.customize')}</Text>
      </TouchableOpacity>
    </View>
  );

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
            {dailyPlan
              ? t('plan.todaysCalories', { calories: Math.round(dailyPlan.daily_calorie_target) })
              : t('plan.emptySubtitle')}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <PlanSelectionList
        plans={planList}
        loading={plansLoading}
        onToggleActive={togglePlanActive}
        onDeletePlan={handleDeletePlan}
        onViewPlan={onViewPlan}
      />

      <View style={styles.activePlanSummary}>
        <Text style={styles.activePlanLabel}>
          {currentPlanId ? t('plan.optimize.activePlanLabel') : t('plan.optimize.noActiveHelper')}
        </Text>
        {currentPlanId ? (
          <Text style={styles.activePlanMeta}>
            {activePlanDate ?? t('plan.optimize.dateUnknown')} •{' '}
            {activePlanSummary?.dailyCalorieTarget
              ? `${Math.round(activePlanSummary.dailyCalorieTarget)} kcal`
              : t('plan.optimize.caloriesUnknown')}
          </Text>
        ) : (
          <TouchableOpacity style={styles.inlineCta} onPress={generatePlan}>
            <Text style={styles.inlineCtaText}>{t('plan.optimize.ctaGenerate')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.optimizeButton, !currentPlanId && styles.disabledButton]}
          onPress={handleOptimizePlan}
          accessibilityState={{ disabled: !currentPlanId }}
        >
          <Text style={[styles.actionButtonText, styles.optimizeButtonText]}>
            ⚡ {t('plan.optimize.button')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.regenerateButton]} onPress={generatePlan}>
          <Text style={[styles.actionButtonText, styles.regenerateButtonText]}>
            🔄 {t('plan.generateNewPlan')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>{t('plan.generating')}</Text>
          </View>
        )}

        {!loading && !dailyPlan && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{t('plan.empty')}</Text>
          </View>
        )}

        {!loading && dailyPlan && (
          <>
            {/* Daily Progress */}
            <View style={styles.progressSection}>
              <Text style={styles.sectionTitle}>{t('plan.dailyProgress')}</Text>
              
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>{t('plan.calories')}</Text>
                {renderProgressBar(consumed.calories, dailyPlan.metrics.total_calories, '#FF6B6B')}
              </View>
              
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>{t('plan.protein')}</Text>
                {renderProgressBar(consumed.protein, dailyPlan.metrics.protein_g, '#4ECDC4')}
              </View>
              
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>{t('plan.fat')}</Text>
                {renderProgressBar(consumed.fat, dailyPlan.metrics.fat_g, '#45B7D1')}
              </View>
              
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>{t('plan.carbs')}</Text>
                {renderProgressBar(consumed.carbs, dailyPlan.metrics.carbs_g, '#F9CA24')}
              </View>
            </View>

            {/* Meals */}
            <View style={styles.mealsSection}>
              <Text style={styles.sectionTitle}>{t('plan.plannedMeals')}</Text>
              {dailyPlan.meals.map(renderMeal)}
            </View>

          </>
        )}
      </ScrollView>

      <CustomizeModal
        visible={customizeModal.visible}
        onClose={() => setCustomizeModal(prev => ({ ...prev, visible: false }))}
        onConfirm={handleCustomizeConfirm}
        mealType={customizeModal.mealType}
        translateMealName={translateMealName}
      />

      <Modal transparent visible={optimizeModalVisible} animationType="fade">
        <View style={styles.optimizeModalOverlay}>
          <View style={styles.optimizeModalCard}>
            <Text style={styles.optimizeModalTitle}>{t('plan.optimize.confirmTitle')}</Text>
            <Text style={styles.optimizeModalSubtitle}>{t('plan.optimize.confirmSubtitle')}</Text>
            <View style={styles.optimizeModalSummary}>
              <Text style={styles.optimizeModalSummaryLabel}>{t('plan.optimize.summaryPlan')}</Text>
              <Text style={styles.optimizeModalSummaryValue}>
                {currentPlanId ?? t('plan.optimize.planUnknown')}
              </Text>
              <Text style={styles.optimizeModalSummaryLabel}>{t('plan.optimize.summaryCalories')}</Text>
              <Text style={styles.optimizeModalSummaryValue}>
                {activePlanSummary?.dailyCalorieTarget
                  ? `${Math.round(activePlanSummary.dailyCalorieTarget)} kcal`
                  : t('plan.optimize.caloriesUnknown')}
              </Text>
            </View>
            <View style={styles.optimizeModalActions}>
              <TouchableOpacity
                style={[styles.optimizeModalButton, styles.optimizeModalCancel]}
                onPress={() => setOptimizeModalVisible(false)}
              >
                <Text style={styles.optimizeModalCancelText}>{t('plan.optimize.confirmCancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optimizeModalButton, styles.optimizeModalConfirm]}
                onPress={handleConfirmOptimize}
              >
                <Text style={styles.optimizeModalConfirmText}>{t('plan.optimize.confirmCta')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
