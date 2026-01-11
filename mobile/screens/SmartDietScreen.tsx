import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Modal,
  FlatList,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { 
  smartDietService, 
  SmartDietContext, 
  type SmartDietResponse,
  type SmartDietRequest,
  type SmartSuggestion,
  type SmartDietInsights,
  type SmartDietOptimizations
} from '../services/SmartDietService';

// Extended SmartSuggestion interface to include legacy properties for backward compatibility
interface ExtendedSmartSuggestion extends SmartSuggestion {
  action_text?: string;
  metadata?: Record<string, any>;
}
import { apiService } from '../services/ApiService';
import { translateFoodNameSync, translateFoodName, translateFoodNames } from '../utils/foodTranslation';
import { getCurrentMealPlanId } from '../utils/mealPlanUtils';
import { notificationService, NotificationConfig } from '../services/NotificationService';
import { useAuth } from '../contexts/AuthContext';
import { smartDietScreenStyles as styles } from '../shared/ui/styles';

// Legacy interfaces for backward compatibility
interface LegacySmartSuggestion {
  id: string;
  suggestion_type: string;
  category: string;
  title: string;
  description: string;
  action_text?: string;
  confidence_score: number;
  priority: number;
  metadata: Record<string, any>;
  created_at: string;
}

interface LegacySmartDietResponse {
  user_id: string;
  context: string;
  suggestions: LegacySmartSuggestion[];
  total_suggestions: number;
  avg_confidence: number;
  generated_at: string;
  insights?: {
    calories_today: number;
    target_calories: number;
    macro_balance: {
      protein_percent: number;
      fat_percent: number;
      carbs_percent: number;
    };
    improvement_areas: string[];
    health_benefits: string[];
  };
  optimizations?: {
    meal_swaps: Array<{
      from_food: string;
      to_food: string;
      calorie_difference: number;
      benefit: string;
    }>;
    macro_adjustments: Array<{
      nutrient: string;
      current: number;
      target: number;
      suggestion: string;
    }>;
  };
}

interface SmartDietScreenProps {
  onBackPress: () => void;
  navigationContext?: {
    targetContext?: string;
    sourceScreen?: string;
    planId?: string;
  };
  navigateToTrack?: () => void;
  navigateToPlan?: () => void;
}

interface OptimizationChangePayload {
  change_type: 'meal_swap' | 'macro_adjustment';
  old_barcode?: string;
  new_barcode?: string;
  meal_name?: string;
  new_target?: number;
  nutrient?: string;
  current?: number;
  target?: number;
  suggestion?: string;
}

// Performance-optimized context configuration with SmartDietContext enum
const CONTEXT_CONFIG = Object.freeze({
  [SmartDietContext.TODAY]: {
    title: 'For You Today',
    emoji: '🌟',
    color: '#4A90E2',
    gradient: ['#4A90E2', '#357ABD']
  },
  [SmartDietContext.OPTIMIZE]: {
    title: 'Optimize Plan',
    emoji: '⚡',
    color: '#F39C12',
    gradient: ['#F39C12', '#E67E22']
  },
  [SmartDietContext.DISCOVER]: {
    title: 'Discover Foods',
    emoji: '🔍',
    color: '#27AE60',
    gradient: ['#27AE60', '#229954']
  },
  [SmartDietContext.INSIGHTS]: {
    title: 'Diet Insights',
    emoji: '📊',
    color: '#8E44AD',
    gradient: ['#8E44AD', '#7D3C98']
  }
});

// TypeScript type for context keys
type ContextType = SmartDietContext;

export default function SmartDietScreen({ onBackPress, navigationContext, navigateToTrack, navigateToPlan }: SmartDietScreenProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  
  // Performance-optimized state management with proper TypeScript types
  const [smartData, setSmartData] = useState<SmartDietResponse | null>(null);
  const [legacyData, setLegacyData] = useState<LegacySmartDietResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const resolveInitialContext = () => {
    if (navigationContext?.targetContext) {
      return navigationContext.targetContext as SmartDietContext;
    }
    if (navigationContext?.planId || navigationContext?.sourceScreen === 'plan') {
      return SmartDietContext.OPTIMIZE;
    }
    return SmartDietContext.TODAY;
  };

  const [selectedContext, setSelectedContext] = useState<SmartDietContext>(resolveInitialContext);
  const [preferencesModal, setPreferencesModal] = useState(false);
  const [excludedOptimizations, setExcludedOptimizations] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<'fresh' | 'cached' | 'stale' | 'none'>('none');
  const [swapPickerVisible, setSwapPickerVisible] = useState(false);
  const [swapCandidates, setSwapCandidates] = useState<Array<{ id: string; barcode: string; name: string; meal: string }>>([]);
  const [swapTarget, setSwapTarget] = useState<Record<string, any> | null>(null);
  const [selectedSwapId, setSelectedSwapId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState({
    dietaryRestrictions: [] as string[],
    cuisinePreferences: [] as string[],
    excludedIngredients: [] as string[],
    maxSuggestions: 10,
    includeHistory: true,
  });
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig | null>(null);

  const availableDietaryRestrictions = [
    'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'low-sodium'
  ];

  const availableCuisines = [
    'Mediterranean', 'Asian', 'Mexican', 'Italian', 'Indian', 'American'
  ];

  useEffect(() => {
    generateSmartSuggestions();
  }, [selectedContext, user?.id]);

  // Handle navigation context (e.g., coming from meal plan optimization)
  useEffect(() => {
    if (navigationContext?.targetContext && navigationContext.targetContext !== selectedContext) {
      setSelectedContext(navigationContext.targetContext as SmartDietContext);
    }
  }, [navigationContext]);

  // Load notification configuration
  useEffect(() => {
    const loadNotificationConfig = async () => {
      try {
        const config = await notificationService.getConfig();
        setNotificationConfig(config);
      } catch (error) {
        console.error('Failed to load notification config:', error);
      }
    };
    
    loadNotificationConfig();
  }, []);

  const translateSuggestionNames = useCallback(async (data: SmartDietResponse) => {
    if (!data?.suggestions?.length) {
      return data;
    }

    if (i18n.language === 'en') {
      return data;
    }

    const nameSet = new Set<string>();
    data.suggestions.forEach((suggestion) => {
      if (suggestion.suggestion_type === 'insight') return;
      if (suggestion.title) nameSet.add(suggestion.title);
      if (suggestion.suggested_item?.name) nameSet.add(suggestion.suggested_item.name);
    });

    const names = Array.from(nameSet);
    if (names.length === 0) {
      return data;
    }

    try {
      const translations = await translateFoodNames(names);
      const translationMap = new Map<string, string>();
      names.forEach((name, index) => {
        translationMap.set(name, translations[index] || name);
      });

      const applyTranslations = (suggestions: SmartSuggestion[]) =>
        suggestions.map((suggestion) => {
          if (suggestion.suggestion_type === 'insight') return suggestion;
          const translatedTitle = translationMap.get(suggestion.title) || suggestion.title;
          const translatedSuggestedName =
            suggestion.suggested_item?.name && (translationMap.get(suggestion.suggested_item.name) || suggestion.suggested_item.name);
          return {
            ...suggestion,
            title: translatedTitle,
            suggested_item: suggestion.suggested_item
              ? {
                  ...suggestion.suggested_item,
                  name: translatedSuggestedName,
                }
              : suggestion.suggested_item,
          };
        });

      return {
        ...data,
        suggestions: applyTranslations(data.suggestions),
        discoveries: applyTranslations(data.discoveries),
        optimizations: Array.isArray(data.optimizations)
          ? applyTranslations(data.optimizations)
          : data.optimizations,
        today_highlights: applyTranslations(data.today_highlights),
      };
    } catch (error) {
      console.warn('Food name translation failed:', error);
      return data;
    }
  }, [i18n.language]);

  const generateSmartSuggestions = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    try {
      // Use the optimized SmartDietService with proper options
      const options: Partial<SmartDietRequest> = {
        dietary_restrictions: preferences.dietaryRestrictions,
        cuisine_preferences: preferences.cuisinePreferences,
        excluded_ingredients: preferences.excludedIngredients,
        max_suggestions: preferences.maxSuggestions,
        include_optimizations: preferences.includeHistory,
        include_recommendations: true,
        min_confidence: 0.3,
        lang: i18n.language,
        forceRefresh
      };

      // Add meal plan ID for optimize context
      if (selectedContext === SmartDietContext.OPTIMIZE) {
        const navigationPlanId = navigationContext?.planId;
        const storedPlanId = await getCurrentMealPlanId();
        const currentPlanId = navigationPlanId ?? storedPlanId;
        console.log('SmartDiet Debug - Retrieved meal plan ID:', currentPlanId);
        if (currentPlanId) {
          console.log('SmartDiet Debug - Adding meal plan ID to options:', currentPlanId);
          options.current_meal_plan_id = currentPlanId;
        } else {
          console.log('SmartDiet Debug - No meal plan ID found');
          throw new Error('No meal plan found. Please generate a meal plan first from the Plan tab.');
        }
      }

      // Use the performance-optimized SmartDietService
      const activeUserId = user?.id ?? 'anonymous';
      const response = await smartDietService.getSmartSuggestions(
        selectedContext,
        activeUserId,
        options
      );
      
      const translatedResponse = await translateSuggestionNames(response);
      setSmartData(translatedResponse);
      setCacheStatus(response.generated_at ? 'fresh' : 'cached');
    } catch (error) {
      console.error('Smart Diet generation failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to load suggestions');
      
      // Fallback to legacy recommendations API for backward compatibility
      if (selectedContext === SmartDietContext.TODAY) {
        try {
          const legacyRequest: {
            meal_context: string;
            max_recommendations: number;
            min_confidence: number;
            dietary_restrictions: string[];
            cuisine_preferences: string[];
            excluded_ingredients: string[];
            include_history: boolean;
            user_id?: string;
          } = {
            meal_context: 'all',
            max_recommendations: preferences.maxSuggestions,
            min_confidence: 0.3,
            dietary_restrictions: preferences.dietaryRestrictions,
            cuisine_preferences: preferences.cuisinePreferences,
            excluded_ingredients: preferences.excludedIngredients,
            include_history: preferences.includeHistory,
          };

          if (user?.id) {
            legacyRequest.user_id = user.id;
          }

          const legacyResponse = await apiService.generateSmartRecommendations(legacyRequest);
          
          // Transform legacy response to new Smart Diet format
          const transformedData: SmartDietResponse = {
            user_id: legacyResponse.data.user_id || 'anonymous',
            context_type: SmartDietContext.TODAY,
            generated_at: legacyResponse.data.generated_at || new Date().toISOString(),
            suggestions: [],
            today_highlights: [],
            optimizations: [],
            discoveries: [],
            insights: [],
            nutritional_summary: legacyResponse.data.nutritional_insights ? {
              total_recommended_calories: legacyResponse.data.nutritional_insights.total_recommended_calories,
              macro_distribution: legacyResponse.data.nutritional_insights.macro_distribution,
              nutritional_gaps: legacyResponse.data.nutritional_insights.nutritional_gaps || [],
              health_benefits: legacyResponse.data.nutritional_insights.health_benefits || []
            } : {},
            personalization_factors: [],
            total_suggestions: legacyResponse.data.total_recommendations || 0,
            avg_confidence: legacyResponse.data.avg_confidence || 0
          };

          // Transform recommendations to suggestions with async translations
          if (legacyResponse.data.meal_recommendations) {
            for (const meal of legacyResponse.data.meal_recommendations) {
              for (const [index, item] of meal.recommendations.entries()) {
                const translatedTitle = await translateFoodName(item.name);
                const newSuggestion: ExtendedSmartSuggestion = {
                  id: `meal_${meal.meal_name}_${index}`,
                  user_id: 'anonymous',
                  suggestion_type: 'recommendation' as any,
                  category: 'meal_addition' as any,
                  title: translatedTitle,
                  description: `${item.brand ? item.brand + ' - ' : ''}${Math.round(item.calories_per_serving)} kcal per ${item.serving_size}`,
                  reasoning: `Recommended for ${meal.meal_name} based on your nutritional needs`,
                  suggested_item: {
                    barcode: item.barcode,
                    name: item.name,
                    brand: item.brand,
                    serving_size: item.serving_size
                  },
                  nutritional_benefit: {
                    calories: item.calories_per_serving,
                    protein: item.protein_g,
                    fat: item.fat_g,
                    carbs: item.carbs_g
                  },
                  calorie_impact: item.calories_per_serving,
                  macro_impact: {
                    protein: item.protein_g,
                    fat: item.fat_g,
                    carbs: item.carbs_g
                  },
                  confidence_score: item.confidence_score,
                  priority_score: 1,
                  meal_context: meal.meal_name,
                  planning_context: SmartDietContext.TODAY,
                  implementation_complexity: 'simple' as const,
                  implementation_notes: `Add to ${meal.meal_name}`,
                  created_at: new Date().toISOString(),
                  tags: item.reasons || [],
                  // Legacy compatibility
                  action_text: `Add to ${meal.meal_name}`,
                  metadata: {
                    barcode: item.barcode,
                    nutrition: {
                      calories: item.calories_per_serving,
                      protein: item.protein_g,
                      fat: item.fat_g,
                      carbs: item.carbs_g
                    },
                    reasons: item.reasons
                  }
                };
                transformedData.suggestions.push(newSuggestion);
              }
            }
          }

          setSmartData(transformedData);
          return;
        } catch (legacyError) {
          console.error('Both Smart Diet and legacy APIs failed:', legacyError);
          setError('Failed to load suggestions from both new and legacy APIs');
        }
      } else {
        // For other contexts, just show the error
        setError(error instanceof Error ? error.message : 'Failed to load suggestions');
      }
    } finally {
      setLoading(false);
    }
  };

  const addRecommendationToPlan = async (suggestion: ExtendedSmartSuggestion) => {
    try {
      // Extract barcode from new Smart Diet format or legacy metadata
      const barcode = suggestion.suggested_item?.barcode || 
                    suggestion.metadata?.suggested_item?.barcode || 
                    suggestion.metadata?.barcode ||
                    suggestion.metadata?.product?.barcode;
      
      if (!barcode) {
        Alert.alert(
          'Cannot Add to Plan',
          'This recommendation cannot be added to your meal plan (no barcode information available).',
          [{ text: 'OK' }]
        );
        return;
      }

      if (!user?.id) {
        Alert.alert(
          'Sign In Required',
          'Please log in to modify your meal plan.'
        );
        return;
      }
      
      // Determine meal type from meal_context or category
      let mealType = 'lunch'; // default
      if (suggestion.meal_context) {
        const context = suggestion.meal_context.toLowerCase();
        if (context.includes('breakfast')) mealType = 'breakfast';
        else if (context.includes('dinner')) mealType = 'dinner';
        else if (context.includes('lunch')) mealType = 'lunch';
      } else if (typeof suggestion.category === 'string') {
        const cat = suggestion.category.toLowerCase();
        if (cat.includes('breakfast')) mealType = 'breakfast';
        else if (cat.includes('dinner')) mealType = 'dinner';
        else if (cat.includes('lunch')) mealType = 'lunch';
      }
      
      const response = await apiService.addProductToPlan({
        barcode,
        meal_type: mealType,
        serving_size: suggestion.suggested_item?.serving_size || suggestion.metadata?.serving_size,
      });
      
      const result = response.data;
      if (result.success) {
        Alert.alert(
          'Added to Plan!',
          result.message,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Could not add to plan',
          result.message || 'Failed to add recommendation to meal plan.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Add recommendation to plan failed:', error);
      
      let errorMessage = 'Failed to add recommendation to meal plan. Please try again.';
      if ((error as any).response?.data?.message) {
        errorMessage = (error as any).response.data.message;
      } else if ((error as any).response?.data?.detail) {
        errorMessage = (error as any).response.data.detail;
      }
      
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    }
  };

  const handleSuggestionAction = async (suggestion: ExtendedSmartSuggestion) => {
    try {
      if (suggestion.suggestion_type === 'recommendation' || suggestion.metadata?.suggestion_type === 'meal_recommendation') {
        Alert.alert(
          t('smartDiet.actions.addToPlan'),
          `Would you like to add ${suggestion.title} to your ${suggestion.meal_context || 'meal plan'}?`,
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.add'),
              onPress: () => addRecommendationToPlan(suggestion)
            }
          ]
        );
      } else if (suggestion.suggestion_type === 'optimization') {
        const suggestedBarcode =
          suggestion.suggested_item?.barcode ||
          suggestion.metadata?.suggested_item?.barcode ||
          suggestion.metadata?.barcode ||
          suggestion.metadata?.product?.barcode ||
          null;

        if (suggestedBarcode) {
          handleSwapApply({
            new_barcode: suggestedBarcode,
            to_food: suggestion.title,
          });
          return;
        }

        Alert.alert(
          t('smartDiet.actions.applyOptimization'),
          `${suggestion.description}\n\n${t('smartDiet.optimizations.applyEmptyBody')}`,
          [{ text: t('common.ok') }]
        );
      } else {
        Alert.alert(t('smartDiet.alerts.information'), suggestion.description);
      }
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to process suggestion.');
    }
  };

  const handleProvideFeedback = async (suggestion: ExtendedSmartSuggestion, helpful: boolean) => {
    try {
      if (!user?.id) {
        Alert.alert('Sign In Required', 'Please log in to share feedback.');
        return;
      }

      const feedbackUserId = user.id;
      const feedbackData = {
        user_id: feedbackUserId,
        suggestion_id: suggestion.id,
        action: helpful ? 'accepted' : 'rejected',
        feedback_reason: helpful ? 'helpful' : 'not_helpful',
        meal_context: suggestion.meal_context,
      };

      await apiService.post('/smart-diet/feedback', feedbackData);
      Alert.alert(t('smartDiet.feedback.thankYou'), t('smartDiet.feedback.message'));
    } catch (error) {
      console.error('Failed to record feedback:', error);
      Alert.alert('Note', t('smartDiet.feedback.recorded'));
    }
  };

  const toggleDietaryRestriction = (restriction: string) => {
    setPreferences(prev => ({
      ...prev,
      dietaryRestrictions: prev.dietaryRestrictions.includes(restriction)
        ? prev.dietaryRestrictions.filter(r => r !== restriction)
        : [...prev.dietaryRestrictions, restriction]
    }));
  };

  const toggleCuisinePreference = (cuisine: string) => {
    setPreferences(prev => ({
      ...prev,
      cuisinePreferences: prev.cuisinePreferences.includes(cuisine)
        ? prev.cuisinePreferences.filter(c => c !== cuisine)
        : [...prev.cuisinePreferences, cuisine]
    }));
  };

  const handleNotificationToggle = async () => {
    if (!notificationConfig) return;
    
    try {
      const newConfig = { ...notificationConfig, enabled: !notificationConfig.enabled };
      await notificationService.updateConfig(newConfig);
      setNotificationConfig(newConfig);
      
      if (newConfig.enabled) {
        // Trigger a test notification
        await notificationService.triggerSmartDietNotification(
          SmartDietContext.TODAY,
          {
            title: '🔔 Smart Diet Notifications Enabled',
            message: 'You\'ll receive daily nutrition suggestions'
          }
        );
      }
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    }
  };

  const handleNotificationTimeChange = async (time: string) => {
    if (!notificationConfig) return;
    
    try {
      const newConfig = { ...notificationConfig, dailySuggestionTime: time };
      await notificationService.updateConfig(newConfig);
      setNotificationConfig(newConfig);
    } catch (error) {
      console.error('Failed to update notification time:', error);
    }
  };

  const renderContextSelector = () => (
    <View style={styles.contextSelector}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {(Object.keys(CONTEXT_CONFIG) as ContextType[]).map(context => (
          <TouchableOpacity
            key={context}
            style={[
              styles.contextButton,
              selectedContext === context && styles.contextButtonActive
            ]}
            onPress={() => setSelectedContext(context)}
          >
            <Text style={styles.contextEmoji}>
              {CONTEXT_CONFIG[context].emoji}
            </Text>
            <Text style={[
              styles.contextButtonText,
              selectedContext === context && styles.contextButtonTextActive
            ]}>
              {t(`smartDiet.contexts.${context}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const extractNutrition = (suggestion: ExtendedSmartSuggestion) => {
    const suggestedNutrition = suggestion.suggested_item?.nutrition || {};
    const metaNutrition = suggestion.metadata?.nutrition || {};
    const benefitNutrition = suggestion.nutritional_benefit || {};
    const nutrition = {
      ...suggestedNutrition,
      ...metaNutrition,
      ...benefitNutrition,
    };

    return {
      calories:
        nutrition.calories ??
        nutrition.energy_kcal_per_100g ??
        nutrition.calories_per_serving ??
        suggestion.suggested_item?.calories ??
        suggestion.suggested_item?.calories_per_serving ??
        suggestion.suggested_item?.energy_kcal_per_100g,
      protein:
        nutrition.protein ??
        nutrition.protein_g ??
        nutrition.protein_g_per_100g ??
        suggestion.suggested_item?.protein_g ??
        suggestion.suggested_item?.protein_g_per_100g,
      fat:
        nutrition.fat ??
        nutrition.fat_g ??
        nutrition.fat_g_per_100g ??
        suggestion.suggested_item?.fat_g ??
        suggestion.suggested_item?.fat_g_per_100g,
      carbs:
        nutrition.carbs ??
        nutrition.carbs_g ??
        nutrition.carbs_g_per_100g ??
        suggestion.suggested_item?.carbs_g ??
        suggestion.suggested_item?.carbs_g_per_100g,
    };
  };

  const hasCompleteNutrition = (nutrition: ReturnType<typeof extractNutrition>) =>
    ['calories', 'protein', 'fat', 'carbs'].every((key) => typeof nutrition[key as keyof typeof nutrition] === 'number');

  const isReadableName = (name?: string | null) => {
    if (!name) return false;
    const letters = name.match(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/g)?.length ?? 0;
    return letters >= 2;
  };

  const visibleSuggestions = useMemo(() => {
    if (!smartData) return [];
    const pool = [
      ...(smartData.suggestions || []),
      ...(Array.isArray(smartData.optimizations) ? smartData.optimizations : []),
      ...(Array.isArray(smartData.discoveries) ? smartData.discoveries : []),
    ];
    const seen = new Set<string>();
    return pool
      .filter((suggestion) => suggestion && suggestion.suggestion_type !== 'insight')
      .filter((suggestion) => {
        if (suggestion.suggestion_type === 'optimization') return true;
        return hasCompleteNutrition(extractNutrition(suggestion));
      })
      .filter((suggestion) =>
        isReadableName(suggestion.title) || isReadableName(suggestion.suggested_item?.name)
      )
      .filter((suggestion) => {
        const key = suggestion.id ?? `${suggestion.title}-${suggestion.category}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [smartData]);

  const renderSuggestion = (suggestion: ExtendedSmartSuggestion, index?: number) => (
    <View key={`suggestion_${suggestion.id}_${index || 0}`} style={styles.suggestionCard}>
      <View style={styles.suggestionHeader}>
        <View style={styles.suggestionInfo}>
          <Text style={styles.suggestionTitle}>{translateFoodNameSync(suggestion.title)}</Text>
          <View style={styles.suggestionMetaRow}>
            {suggestion.suggestion_type === 'optimization' && (
              <Text style={styles.suggestionCategory}>SWAP</Text>
            )}
            {(suggestion.suggestion_type === 'recommendation' ||
              suggestion.suggestion_type === 'optimization') && (
              <View
                style={[
                  styles.suggestionTypeBadge,
                  suggestion.suggestion_type === 'optimization'
                    ? styles.suggestionTypeBadgeSwap
                    : styles.suggestionTypeBadgeDiscovery,
                ]}
              >
                <Text style={styles.suggestionTypeBadgeText}>
                  {suggestion.suggestion_type === 'optimization'
                    ? suggestion.meal_context?.toUpperCase() ||
                      suggestion.category?.replace('_', ' ').toUpperCase() ||
                      'OPTIMIZE'
                    : typeof suggestion.category === 'string'
                      ? suggestion.category.replace('_', ' ').toUpperCase()
                      : 'DISCOVERY'}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.confidenceContainer}>
          <Text style={styles.confidenceScore}>
            {Math.round(suggestion.confidence_score * 100)}%
          </Text>
          <Text style={styles.confidenceLabel}>{t('smartDiet.confidence')}</Text>
        </View>
      </View>

      <Text style={styles.suggestionDescription}>{translateFoodNameSync(suggestion.description)}</Text>

      {(() => {
        const nutrition = extractNutrition(suggestion);
        if (!hasCompleteNutrition(nutrition)) return null;
        return (
          <View style={styles.nutritionInfo}>
            <Text style={styles.nutritionText}>
              📊 {Math.round(nutrition.calories || 0)} kcal • 
              P: {Math.round(nutrition.protein || 0)}g • 
              F: {Math.round(nutrition.fat || 0)}g • 
              C: {Math.round(nutrition.carbs || 0)}g
            </Text>
          </View>
        );
      })()}

      {(suggestion.tags?.length > 0 || suggestion.metadata?.reasons) && (
        <View style={styles.reasonsContainer}>
          <Text style={styles.reasonsLabel}>{t('smartDiet.whySuggested')}</Text>
          <View style={styles.reasonTags}>
            {(suggestion.tags || suggestion.metadata?.reasons || []).slice(0, 3).map((reason: string, index: number) => (
              <View key={`reason_${reason}_${index}`} style={styles.reasonTag}>
                <Text style={styles.reasonTagText}>{reason.replace('_', ' ')}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.actionButtons}>
        {(() => {
          let label: string | null = null;
          if (suggestion.suggestion_type === 'recommendation') {
            label = t('smartDiet.actions.addToPlan');
          } else if (suggestion.suggestion_type === 'optimization') {
            label = t('smartDiet.actions.applyOptimization');
          } else if (suggestion.action_text || suggestion.implementation_notes) {
            label = suggestion.action_text || suggestion.implementation_notes || null;
          }

          if (!label) return null;

          return (
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => handleSuggestionAction(suggestion)}
            >
              <Text style={styles.primaryButtonText}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })()}
        
        <View style={styles.feedbackButtons}>
          {/* Cross-navigation buttons */}
          {(suggestion.suggestion_type === 'recommendation' || suggestion.metadata?.suggestion_type === 'meal_recommendation') && navigateToTrack && (
            <TouchableOpacity 
              style={[styles.feedbackButton, styles.navigationActionButton]}
              onPress={() => navigateToTrack()}
            >
              <Text style={styles.navigationActionText}>📊 Track</Text>
            </TouchableOpacity>
          )}
          
          {suggestion.suggestion_type === 'optimization' && navigateToPlan && (
            <TouchableOpacity 
              style={[styles.feedbackButton, styles.navigationActionButton]}
              onPress={() => {
                if (selectedContext === SmartDietContext.OPTIMIZE) {
                  const suggestedBarcode =
                    suggestion.suggested_item?.barcode ||
                    suggestion.metadata?.suggested_item?.barcode ||
                    suggestion.metadata?.barcode ||
                    suggestion.metadata?.product?.barcode ||
                    null;

                  if (suggestedBarcode) {
                    handleSwapApply({
                      new_barcode: suggestedBarcode,
                      to_food: suggestion.title,
                    });
                    return;
                  }

                  Alert.alert(
                    t('smartDiet.optimizations.applyEmptyTitle'),
                    t('smartDiet.optimizations.applyEmptyBody')
                  );
                  return;
                }

                navigateToPlan();
              }}
            >
              <Text style={styles.navigationActionText}>
                {selectedContext === SmartDietContext.OPTIMIZE
                  ? t('smartDiet.optimizations.applyOne')
                  : '📋 Plan'}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.feedbackButton}
            onPress={() => handleProvideFeedback(suggestion, true)}
          >
            <Text style={styles.feedbackButtonText}>👍</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.feedbackButton}
            onPress={() => handleProvideFeedback(suggestion, false)}
          >
            <Text style={styles.feedbackButtonText}>👎</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderInsights = () => {
    if (selectedContext !== 'insights') return null;
    if (!smartData?.nutritional_summary) return null;

    const nutritionalSummary = smartData?.nutritional_summary;
    if (!nutritionalSummary) return null;

    return (
      <View style={styles.insightsCard}>
        <Text style={styles.insightsTitle}>{t('smartDiet.insights.title')}</Text>
        
        <View style={styles.insightRow}>
          <Text style={styles.insightLabel}>{t('smartDiet.insights.calories')}</Text>
          <Text style={styles.insightValue}>
            {nutritionalSummary.total_recommended_calories} / {nutritionalSummary.total_recommended_calories} kcal
          </Text>
        </View>

        <View style={styles.macroDistribution}>
          <Text style={styles.insightLabel}>{t('smartDiet.insights.macroBalance')}</Text>
          <View style={styles.macroRow}>
            <Text style={styles.macroText}>
              🥩 {nutritionalSummary.macro_distribution?.protein_percent || 0}%
            </Text>
            <Text style={styles.macroText}>
              🥑 {nutritionalSummary.macro_distribution?.fat_percent || 0}%
            </Text>
            <Text style={styles.macroText}>
              🍞 {nutritionalSummary.macro_distribution?.carbs_percent || 0}%
            </Text>
          </View>
        </View>

        {nutritionalSummary.nutritional_gaps && nutritionalSummary.nutritional_gaps.length > 0 && (
          <View style={styles.improvementAreas}>
            <Text style={styles.insightLabel}>{t('smartDiet.insights.nutritionalGaps')}</Text>
            {nutritionalSummary.nutritional_gaps.map((gap, index) => (
              <Text key={`gap_${gap}_${index}`} style={styles.improvementText}>• {gap}</Text>
            ))}
          </View>
        )}

        {nutritionalSummary.health_benefits && nutritionalSummary.health_benefits.length > 0 && (
          <View style={styles.healthBenefits}>
            <Text style={styles.insightLabel}>{t('smartDiet.insights.healthBenefits')}</Text>
            {nutritionalSummary.health_benefits.map((benefit, index) => (
              <Text key={`benefit_${benefit}_${index}`} style={styles.benefitText}>• {benefit}</Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  const toggleOptimizationExcluded = (key: string) => {
    setExcludedOptimizations((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resolvePlanId = async () => {
    const navigationPlanId = navigationContext?.planId;
    const storedPlanId = await getCurrentMealPlanId();
    return navigationPlanId ?? storedPlanId ?? null;
  };

  const loadPlanItems = async (planId: string) => {
    const response = await apiService.getUserPlans();
    const plan = (response.data || []).find((entry: any) =>
      entry.plan_id === planId || entry.planId === planId
    );
    const meals = plan?.meals ?? [];
    const items = meals.flatMap((meal: any) =>
      (meal.items ?? []).map((item: any, index: number) => ({
        id: `${meal.name}-${item.barcode}-${index}`,
        barcode: item.barcode,
        name: item.name,
        meal: meal.name,
      }))
    );
    setSwapCandidates(items);
  };

  const buildSwapChange = (swap: Record<string, any>): OptimizationChangePayload | null => {
    const oldBarcode =
      swap.old_barcode ??
      swap.from_barcode ??
      swap.fromBarcode ??
      swap.metadata?.old_barcode ??
      swap.metadata?.from_barcode ??
      null;
    const newBarcode =
      swap.new_barcode ??
      swap.to_barcode ??
      swap.toBarcode ??
      swap.metadata?.new_barcode ??
      swap.metadata?.to_barcode ??
      null;

    if (!oldBarcode || !newBarcode) return null;

    return {
      change_type: 'meal_swap',
      old_barcode: oldBarcode,
      new_barcode: newBarcode
    };
  };

  const buildMacroChange = (adjustment: Record<string, any>): OptimizationChangePayload | null => {
    const mealName = adjustment.meal_name ?? adjustment.mealName ?? null;
    const newTarget = adjustment.new_target ?? adjustment.target ?? null;

    if (!mealName || newTarget === null || newTarget === undefined) return null;

    return {
      change_type: 'macro_adjustment',
      meal_name: mealName,
      new_target: newTarget,
      nutrient: adjustment.nutrient,
      current: adjustment.current,
      target: adjustment.target,
      suggestion: adjustment.suggestion
    };
  };

  const buildOptimizationChanges = (optimizations: SmartDietOptimizations) => {
    const changes: OptimizationChangePayload[] = [];

    optimizations.meal_swaps?.forEach((swap, index) => {
      const key = `swap_${swap.from_food}_${swap.to_food}_${index}`;
      if (excludedOptimizations[key]) return;

      const change = buildSwapChange(swap as Record<string, any>);
      if (change) {
        changes.push(change);
      }
    });

    optimizations.macro_adjustments?.forEach((adjustment, index) => {
      const key = `adj_${adjustment.nutrient}_${adjustment.current}_${index}`;
      if (excludedOptimizations[key]) return;

      const change = buildMacroChange(adjustment as Record<string, any>);
      if (change) {
        changes.push(change);
      }
    });

    return changes;
  };

  const applyOptimizations = async (changes: OptimizationChangePayload[]) => {
    if (!user?.id) {
      Alert.alert('Sign In Required', 'Please log in to apply optimizations.');
      return;
    }

    const planId = await resolvePlanId();
    if (!planId) {
      Alert.alert(
        t('smartDiet.optimizations.applyMissingPlanTitle'),
        t('smartDiet.optimizations.applyMissingPlanBody')
      );
      return;
    }

    if (changes.length === 0) {
      Alert.alert(
        t('smartDiet.optimizations.applyEmptyTitle'),
        t('smartDiet.optimizations.applyEmptyBody')
      );
      return;
    }

    try {
      const response = await apiService.applySmartDietOptimization({
        plan_id: planId,
        changes
      });
      const appliedCount = response?.data?.applied ?? 0;

      Alert.alert(
        t('smartDiet.optimizations.applySuccessTitle'),
        t('smartDiet.optimizations.applySuccessBody', { count: appliedCount })
      );

      setExcludedOptimizations({});
      await generateSmartSuggestions(true);
    } catch (error) {
      console.error('Apply optimizations failed:', error);
      Alert.alert(
        t('smartDiet.optimizations.applyErrorTitle'),
        t('smartDiet.optimizations.applyErrorBody')
      );
    }
  };

  const handleApplySelected = async () => {
    if (!smartData?.optimizations || Array.isArray(smartData.optimizations)) return;
    const changes = buildOptimizationChanges(smartData.optimizations);
    if (changes.length === 0 && (smartData.optimizations.meal_swaps?.length ?? 0) > 0) {
      Alert.alert(
        t('smartDiet.optimizations.applyManualTitle'),
        t('smartDiet.optimizations.applyManualBody')
      );
      return;
    }
    await applyOptimizations(changes);
  };

  const handleSwapApply = async (swap: Record<string, any>) => {
    const planId = await resolvePlanId();
    if (!planId) {
      Alert.alert(
        t('smartDiet.optimizations.applyMissingPlanTitle'),
        t('smartDiet.optimizations.applyMissingPlanBody')
      );
      return;
    }

    const newBarcode =
      swap.new_barcode ??
      swap.to_barcode ??
      swap.toBarcode ??
      swap.metadata?.new_barcode ??
      swap.metadata?.to_barcode ??
      null;

    if (!newBarcode) {
      Alert.alert(
        t('smartDiet.optimizations.applyEmptyTitle'),
        t('smartDiet.optimizations.applyEmptyBody')
      );
      return;
    }

    try {
      await loadPlanItems(planId);
      setSwapTarget({ ...swap, planId, new_barcode: newBarcode });
      setSelectedSwapId(null);
      setSwapPickerVisible(true);
    } catch (error) {
      console.error('Failed to load plan items:', error);
      Alert.alert(
        t('smartDiet.optimizations.applyErrorTitle'),
        t('smartDiet.optimizations.applyErrorBody')
      );
    }
  };

  const confirmSwapSelection = async () => {
    if (!swapTarget || !selectedSwapId) return;
    const selectedItem = swapCandidates.find((item) => item.id === selectedSwapId);
    if (!selectedItem) return;
    const change: OptimizationChangePayload = {
      change_type: 'meal_swap',
      old_barcode: selectedItem.barcode,
      new_barcode: swapTarget.new_barcode,
    };
    setSwapPickerVisible(false);
    await applyOptimizations([change]);
  };

  const renderOptimizations = () => {
    if (!smartData?.optimizations || selectedContext !== 'optimize') return null;

    const optimizations = smartData.optimizations;
    if (Array.isArray(optimizations)) return null;
    const totalOptimizations =
      (optimizations.meal_swaps?.length ?? 0) +
      (optimizations.macro_adjustments?.length ?? 0);
    const excludedCount = Object.values(excludedOptimizations).filter(Boolean).length;
    const selectedCount = Math.max(totalOptimizations - excludedCount, 0);

    return (
      <View style={styles.optimizationsCard}>
        <Text style={styles.optimizationsTitle}>{t('smartDiet.optimizations.title')}</Text>
        <Text style={styles.optimizationsSubtitle}>{t('smartDiet.optimizations.subtitle')}</Text>

        {optimizations.meal_swaps && optimizations.meal_swaps.length > 0 && (
          <View style={styles.optimizationSection}>
            <Text style={styles.optimizationSectionTitle}>{t('smartDiet.optimizations.mealSwaps')}</Text>
            {optimizations.meal_swaps.map((swap, index) => {
              const key = `swap_${swap.from_food}_${swap.to_food}_${index}`;
              const excluded = Boolean(excludedOptimizations[key]);

              return (
                <View key={key} style={styles.swapItem}>
                  <Text style={styles.swapText}>
                    {swap.from_food} → {swap.to_food}
                  </Text>
                  <Text style={styles.swapBenefit}>
                    {swap.calorie_difference > 0 ? '+' : ''}{swap.calorie_difference} kcal • {swap.benefit}
                  </Text>
                  <View style={styles.optimizationActions}>
                    <TouchableOpacity
                      style={styles.optimizationCta}
                      onPress={() => handleSwapApply(swap as Record<string, any>)}
                    >
                      <Text style={styles.optimizationCtaText}>
                        {t('smartDiet.optimizations.applyOne')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.optimizationCta, excluded && styles.optimizationCtaExcluded]}
                      onPress={() => toggleOptimizationExcluded(key)}
                    >
                      <Text
                        style={[styles.optimizationCtaText, excluded && styles.optimizationCtaTextExcluded]}
                      >
                        {t('smartDiet.optimizations.exclude')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {optimizations.macro_adjustments && optimizations.macro_adjustments.length > 0 && (
          <View style={styles.optimizationSection}>
            <Text style={styles.optimizationSectionTitle}>{t('smartDiet.optimizations.macroAdjustments')}</Text>
            <Text style={styles.optimizationSectionHint}>
              {t('smartDiet.optimizations.macroAdjustmentsHint')}
            </Text>
            {optimizations.macro_adjustments.map((adj, index) => {
              const key = `adj_${adj.nutrient}_${adj.current}_${index}`;
              const excluded = Boolean(excludedOptimizations[key]);

              return (
                <View key={key} style={styles.adjustmentItem}>
                  <Text style={styles.adjustmentNutrient}>{adj.nutrient}:</Text>
                  <Text style={styles.adjustmentValues}>
                    {adj.current}g → {adj.target}g
                  </Text>
                  <Text style={styles.adjustmentSuggestion}>{adj.suggestion}</Text>
                  <View style={styles.optimizationActions}>
                    <TouchableOpacity style={[styles.optimizationCta, styles.optimizationCtaDisabled]}>
                      <Text style={[styles.optimizationCtaText, styles.optimizationCtaTextDisabled]}>
                        {t('smartDiet.optimizations.infoOnly')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.optimizationCta, excluded && styles.optimizationCtaExcluded]}
                      onPress={() => toggleOptimizationExcluded(key)}
                    >
                      <Text
                        style={[styles.optimizationCtaText, excluded && styles.optimizationCtaTextExcluded]}
                      >
                        {t('smartDiet.optimizations.exclude')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {totalOptimizations > 0 && (
          <View style={styles.optimizationSummaryRow}>
            <Text style={styles.optimizationSummaryText}>
              {t('smartDiet.optimizations.selectionCount', { count: selectedCount })}
            </Text>
            <TouchableOpacity
              style={styles.optimizationApplyButton}
              onPress={handleApplySelected}
            >
              <Text style={styles.optimizationApplyText}>
                {t('smartDiet.optimizations.applySelected')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const PreferencesModal = () => (
    <Modal 
      visible={preferencesModal} 
      animationType="slide" 
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('smartDiet.preferences.title')}</Text>
          <TouchableOpacity onPress={() => setPreferencesModal(false)}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.preferenceSection}>
            <Text style={styles.sectionTitle}>Dietary Restrictions</Text>
            <View style={styles.tagContainer}>
              {availableDietaryRestrictions.map((restriction, index) => (
                <TouchableOpacity
                  key={`dietary_${restriction}_${index}`}
                  style={[
                    styles.preferenceTag,
                    preferences.dietaryRestrictions.includes(restriction) && styles.preferenceTagActive
                  ]}
                  onPress={() => toggleDietaryRestriction(restriction)}
                >
                  <Text style={[
                    styles.preferenceTagText,
                    preferences.dietaryRestrictions.includes(restriction) && styles.preferenceTagTextActive
                  ]}>
                    {restriction}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.preferenceSection}>
            <Text style={styles.sectionTitle}>Cuisine Preferences</Text>
            <View style={styles.tagContainer}>
              {availableCuisines.map((cuisine, index) => (
                <TouchableOpacity
                  key={`cuisine_${cuisine}_${index}`}
                  style={[
                    styles.preferenceTag,
                    preferences.cuisinePreferences.includes(cuisine) && styles.preferenceTagActive
                  ]}
                  onPress={() => toggleCuisinePreference(cuisine)}
                >
                  <Text style={[
                    styles.preferenceTagText,
                    preferences.cuisinePreferences.includes(cuisine) && styles.preferenceTagTextActive
                  ]}>
                    {cuisine}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notification Settings */}
          <View style={styles.preferenceSection}>
            <Text style={styles.sectionTitle}>📱 Daily Notifications</Text>
            
            <View style={styles.notificationRow}>
              <Text style={styles.notificationLabel}>Enable daily suggestions</Text>
              <TouchableOpacity 
                style={[
                  styles.notificationToggle,
                  notificationConfig?.enabled && styles.notificationToggleActive
                ]}
                onPress={handleNotificationToggle}
              >
                <Text style={styles.notificationToggleText}>
                  {notificationConfig?.enabled ? '🔔' : '🔕'}
                </Text>
              </TouchableOpacity>
            </View>

            {notificationConfig?.enabled && (
              <View style={styles.notificationTimeRow}>
                <Text style={styles.notificationLabel}>Reminder time</Text>
                <Text style={styles.notificationTime}>
                  {notificationConfig.dailySuggestionTime || '09:00'}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity 
            style={styles.applyButton}
            onPress={() => {
              setPreferencesModal(false);
              generateSmartSuggestions(true);
            }}
          >
            <Text style={styles.applyButtonText}>{t('smartDiet.preferences.apply')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>
            {t('smartDiet.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const contextConfig = CONTEXT_CONFIG[selectedContext];
  const headerTitle =
    selectedContext === SmartDietContext.OPTIMIZE
      ? t('smartDiet.contexts.optimize')
      : t('smartDiet.title');

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>🏠</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{contextConfig.emoji} {headerTitle}</Text>
          {selectedContext !== SmartDietContext.OPTIMIZE && (
            <Text style={styles.subtitle}>{t(`smartDiet.contexts.${selectedContext}`)}</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {navigationContext?.sourceScreen && (
            <TouchableOpacity 
              style={styles.navigationButton} 
              onPress={() => {
                if (navigationContext.sourceScreen === 'plan' && navigateToPlan) {
                  navigateToPlan();
                } else if (navigateToTrack) {
                  navigateToTrack();
                }
              }}
            >
              <Text style={styles.navigationButtonText}>
                {navigationContext.sourceScreen === 'plan' ? '📋' : '📊'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.preferencesButton} 
            onPress={() => setPreferencesModal(true)}
          >
            <Text style={styles.preferencesButtonText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderContextSelector()}
        {renderInsights()}
        {renderOptimizations()}

        {/* Main suggestions */}
        {visibleSuggestions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {contextConfig.emoji} {contextConfig.title}
            </Text>
            {visibleSuggestions.map((suggestion, index) => 
              renderSuggestion(suggestion, index)
            )}
          </View>
        )}

        {selectedContext !== SmartDietContext.OPTIMIZE &&
          (!smartData || visibleSuggestions.length === 0) &&
          !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>🤔</Text>
            <Text style={styles.emptyStateTitle}>{t('smartDiet.noSuggestions')}</Text>
            <Text style={styles.emptyStateText}>
              Try adjusting your preferences or switching to a different context.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.regenerateButton} onPress={() => generateSmartSuggestions(true)}>
          <Text style={styles.regenerateButtonText}>🔄 Refresh Suggestions</Text>
        </TouchableOpacity>
      </ScrollView>

      <PreferencesModal />

      <Modal transparent visible={swapPickerVisible} animationType="fade">
        <View style={styles.swapModalOverlay}>
          <View style={styles.swapModalCard}>
            <Text style={styles.swapModalTitle}>{t('smartDiet.optimizations.swapSelectTitle')}</Text>
            <Text style={styles.swapModalSubtitle}>
              {t('smartDiet.optimizations.swapSelectSubtitle')}
            </Text>
            <ScrollView style={styles.swapModalList}>
              {swapCandidates.map((item) => {
                const selected = selectedSwapId === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.swapModalItem, selected && styles.swapModalItemSelected]}
                    onPress={() => setSelectedSwapId(item.id)}
                  >
                    <Text style={[styles.swapModalItemName, selected && styles.swapModalItemNameSelected]}>
                      {translateFoodNameSync(item.name)}
                    </Text>
                    <Text style={[styles.swapModalItemMeta, selected && styles.swapModalItemMetaSelected]}>
                      {item.meal}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.swapModalActions}>
              <TouchableOpacity
                style={[styles.swapModalButton, styles.swapModalCancel]}
                onPress={() => setSwapPickerVisible(false)}
              >
                <Text style={styles.swapModalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.swapModalButton,
                  styles.swapModalConfirm,
                  !selectedSwapId && styles.swapModalButtonDisabled,
                ]}
                onPress={confirmSwapSelection}
                disabled={!selectedSwapId}
              >
                <Text style={styles.swapModalConfirmText}>{t('smartDiet.optimizations.swapSelectConfirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
