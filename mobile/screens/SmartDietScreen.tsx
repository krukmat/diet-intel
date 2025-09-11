import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { 
  smartDietService, 
  SmartDietContext, 
  type SmartDietResponse,
  type SmartSuggestion,
  type SuggestionFeedback,
  type SmartDietInsights
} from '../services/SmartDietService';

// Extended SmartSuggestion interface to include legacy properties for backward compatibility
interface ExtendedSmartSuggestion extends SmartSuggestion {
  action_text?: string;
  metadata?: Record<string, any>;
}
import { apiService } from '../services/ApiService';
import { translateFoodNameSync, translateFoodName } from '../utils/foodTranslation';
import { getCurrentMealPlanId } from '../utils/mealPlanUtils';
import { notificationService, NotificationConfig } from '../services/NotificationService';
import axios from 'axios';
import { API_BASE_URL } from '../config/environment';

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
  
  // Performance-optimized state management with proper TypeScript types
  const [smartData, setSmartData] = useState<SmartDietResponse | null>(null);
  const [legacyData, setLegacyData] = useState<LegacySmartDietResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedContext, setSelectedContext] = useState<SmartDietContext>(SmartDietContext.TODAY);
  const [preferencesModal, setPreferencesModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<'fresh' | 'cached' | 'stale' | 'none'>('none');
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
  }, [selectedContext]);

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

  const generateSmartSuggestions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use the optimized SmartDietService with proper options
      const options = {
        dietary_restrictions: preferences.dietaryRestrictions,
        cuisine_preferences: preferences.cuisinePreferences,
        excluded_ingredients: preferences.excludedIngredients,
        max_suggestions: preferences.maxSuggestions,
        include_optimizations: preferences.includeHistory,
        include_recommendations: true,
        min_confidence: 0.3,
        lang: i18n.language
      };

      // Add meal plan ID for optimize context
      if (selectedContext === SmartDietContext.OPTIMIZE) {
        const currentPlanId = await getCurrentMealPlanId();
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
      const response = await smartDietService.getSmartSuggestions(
        selectedContext,
        'anonymous', // TODO: Get actual user ID
        options
      );
      
      setSmartData(response);
      setCacheStatus(response.generated_at ? 'fresh' : 'cached');
    } catch (error) {
      console.error('Smart Diet generation failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to load suggestions');
      
      // Fallback to legacy recommendations API for backward compatibility
      if (selectedContext === SmartDietContext.TODAY) {
        try {
          const legacyRequest = {
            meal_context: 'all',
            max_recommendations: preferences.maxSuggestions,
            min_confidence: 0.3,
            dietary_restrictions: preferences.dietaryRestrictions,
            cuisine_preferences: preferences.cuisinePreferences,
            excluded_ingredients: preferences.excludedIngredients,
            include_history: preferences.includeHistory,
          };

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
      
      const response = await axios.post(`${API_BASE_URL}/plan/add-product`, {
        barcode: barcode,
        meal_type: mealType,
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
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
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
        Alert.alert(
          t('smartDiet.actions.applyOptimization'),
          `${suggestion.description}\n\nWould you like to apply this optimization?`,
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.apply'),
              onPress: () => {
                // Check if optimization has actionable barcode data
                if (suggestion.metadata?.suggested_item?.barcode || 
                    suggestion.metadata?.barcode ||
                    suggestion.metadata?.product?.barcode) {
                  addRecommendationToPlan(suggestion);
                } else {
                  Alert.alert(t('common.success'), t('smartDiet.alerts.optimizationSuccess'));
                }
              }
            }
          ]
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
      const feedbackData = {
        user_id: smartData?.user_id || 'anonymous',
        suggestion_id: suggestion.id,
        feedback_type: helpful ? 'helpful' : 'not_helpful',
        context: selectedContext,
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

  const renderSuggestion = (suggestion: ExtendedSmartSuggestion, index?: number) => (
    <View key={`suggestion_${suggestion.id}_${index || 0}`} style={styles.suggestionCard}>
      <View style={styles.suggestionHeader}>
        <View style={styles.suggestionInfo}>
          <Text style={styles.suggestionTitle}>{translateFoodNameSync(suggestion.title)}</Text>
          <Text style={styles.suggestionCategory}>
            {typeof suggestion.category === 'string' 
              ? suggestion.category.replace('_', ' ').toUpperCase()
              : suggestion.meal_context?.toUpperCase() || 'RECOMMENDATION'
            }
          </Text>
        </View>
        <View style={styles.confidenceContainer}>
          <Text style={styles.confidenceScore}>
            {Math.round(suggestion.confidence_score * 100)}%
          </Text>
          <Text style={styles.confidenceLabel}>{t('smartDiet.confidence')}</Text>
        </View>
      </View>

      <Text style={styles.suggestionDescription}>{translateFoodNameSync(suggestion.description)}</Text>

      {(suggestion.nutritional_benefit || suggestion.metadata?.nutrition) && (
        <View style={styles.nutritionInfo}>
          <Text style={styles.nutritionText}>
            📊 {Math.round(suggestion.nutritional_benefit?.calories || suggestion.metadata?.nutrition?.calories || 0)} kcal • 
            P: {Math.round(suggestion.nutritional_benefit?.protein || suggestion.metadata?.nutrition?.protein || 0)}g • 
            F: {Math.round(suggestion.nutritional_benefit?.fat || suggestion.metadata?.nutrition?.fat || 0)}g • 
            C: {Math.round(suggestion.nutritional_benefit?.carbs || suggestion.metadata?.nutrition?.carbs || 0)}g
          </Text>
        </View>
      )}

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
        {(suggestion.action_text || suggestion.implementation_notes) && (
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => handleSuggestionAction(suggestion)}
          >
            <Text style={styles.primaryButtonText}>
              {suggestion.action_text || suggestion.implementation_notes || 'Apply'}
            </Text>
          </TouchableOpacity>
        )}
        
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
              onPress={() => navigateToPlan()}
            >
              <Text style={styles.navigationActionText}>📋 Plan</Text>
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
    if (!smartData?.nutritional_summary && selectedContext !== 'insights') return null;

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

  const renderOptimizations = () => {
    if (!smartData?.optimizations || selectedContext !== 'optimize') return null;

    const optimizations = smartData.optimizations;

    return (
      <View style={styles.optimizationsCard}>
        <Text style={styles.optimizationsTitle}>⚡ Suggested Optimizations</Text>

        {optimizations.meal_swaps && optimizations.meal_swaps.length > 0 && (
          <View style={styles.optimizationSection}>
            <Text style={styles.optimizationSectionTitle}>Meal Swaps:</Text>
            {optimizations.meal_swaps.map((swap, index) => (
              <View key={`swap_${swap.from_food}_${swap.to_food}_${index}`} style={styles.swapItem}>
                <Text style={styles.swapText}>
                  Replace {swap.from_food} with {swap.to_food}
                </Text>
                <Text style={styles.swapBenefit}>
                  {swap.calorie_difference > 0 ? '+' : ''}{swap.calorie_difference} kcal • {swap.benefit}
                </Text>
              </View>
            ))}
          </View>
        )}

        {optimizations.macro_adjustments && optimizations.macro_adjustments.length > 0 && (
          <View style={styles.optimizationSection}>
            <Text style={styles.optimizationSectionTitle}>Macro Adjustments:</Text>
            {optimizations.macro_adjustments.map((adj, index) => (
              <View key={`adj_${adj.nutrient}_${adj.current}_${index}`} style={styles.adjustmentItem}>
                <Text style={styles.adjustmentNutrient}>{adj.nutrient}:</Text>
                <Text style={styles.adjustmentValues}>
                  {adj.current}g → {adj.target}g
                </Text>
                <Text style={styles.adjustmentSuggestion}>{adj.suggestion}</Text>
              </View>
            ))}
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
              generateSmartSuggestions();
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

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>🏠</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{contextConfig.emoji} {t('smartDiet.title')}</Text>
          <Text style={styles.subtitle}>{t(`smartDiet.contexts.${selectedContext}`)}</Text>
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
        {smartData?.suggestions && smartData.suggestions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {contextConfig.emoji} {contextConfig.title}
            </Text>
            {smartData.suggestions.map((suggestion, index) => 
              renderSuggestion(suggestion, index)
            )}
          </View>
        )}

        {(!smartData || smartData.suggestions.length === 0) && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>🤔</Text>
            <Text style={styles.emptyStateTitle}>{t('smartDiet.noSuggestions')}</Text>
            <Text style={styles.emptyStateText}>
              Try adjusting your preferences or switching to a different context.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.regenerateButton} onPress={generateSmartSuggestions}>
          <Text style={styles.regenerateButtonText}>🔄 Refresh Suggestions</Text>
        </TouchableOpacity>
      </ScrollView>

      <PreferencesModal />
    </SafeAreaView>
  );
}

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
    paddingTop: Platform.OS === 'android' ? 40 : 20,
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  navigationButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    minWidth: 40,
    alignItems: 'center',
  },
  navigationButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  preferencesButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    minWidth: 40,
    alignItems: 'center',
  },
  preferencesButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  contextSelector: {
    marginTop: 15,
  },
  contextButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  contextButtonActive: {
    backgroundColor: '#007AFF',
  },
  contextEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  contextButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  contextButtonTextActive: {
    color: 'white',
  },
  insightsCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  insightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  insightLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  insightValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  macroDistribution: {
    marginBottom: 15,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  macroText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
    textAlign: 'center',
  },
  improvementAreas: {
    marginBottom: 15,
  },
  improvementText: {
    fontSize: 14,
    color: '#FF9800',
    marginBottom: 5,
  },
  healthBenefits: {
    marginTop: 10,
  },
  benefitText: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 5,
  },
  optimizationsCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  optimizationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  optimizationSection: {
    marginBottom: 20,
  },
  optimizationSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  swapItem: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  swapText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  swapBenefit: {
    fontSize: 12,
    color: '#FF9800',
  },
  adjustmentItem: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  adjustmentNutrient: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  adjustmentValues: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: 'bold',
    marginTop: 2,
  },
  adjustmentSuggestion: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  suggestionCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  suggestionCategory: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  confidenceContainer: {
    alignItems: 'center',
  },
  confidenceScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#666',
  },
  suggestionDescription: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    lineHeight: 20,
  },
  nutritionInfo: {
    marginBottom: 12,
  },
  nutritionText: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#F8F9FA',
    padding: 8,
    borderRadius: 8,
  },
  reasonsContainer: {
    marginBottom: 15,
  },
  reasonsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  reasonTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonTag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  reasonTagText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  feedbackButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  feedbackButtonText: {
    fontSize: 16,
  },
  navigationActionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  navigationActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  regenerateButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  regenerateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    backgroundColor: '#007AFF',
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 20,
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  preferenceSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  preferenceTag: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  preferenceTagActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  preferenceTagText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  preferenceTagTextActive: {
    color: 'white',
  },
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 12,
    opacity: 0.8,
  },
  notificationLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  notificationToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationToggleActive: {
    backgroundColor: '#4CAF50',
  },
  notificationToggleText: {
    fontSize: 20,
  },
  notificationTime: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  applyButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});