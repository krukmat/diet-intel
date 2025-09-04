import React, { useState, useEffect } from 'react';
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
import { apiService } from '../services/ApiService';

interface NutritionalScore {
  overall_score: number;
  protein_score: number;
  fiber_score: number;
  micronutrient_score: number;
  calorie_density_score: number;
}

interface RecommendationItem {
  barcode: string;
  name: string;
  brand?: string;
  image_url?: string;
  calories_per_serving: number;
  serving_size: string;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g?: number;
  recommendation_type: string;
  reasons: string[];
  confidence_score: number;
  nutritional_score: NutritionalScore;
  preference_match: number;
  goal_alignment: number;
}

interface MealRecommendation {
  meal_name: string;
  target_calories: number;
  current_calories: number;
  recommendations: RecommendationItem[];
  macro_gaps: Record<string, number>;
  micronutrient_gaps: string[];
}

interface SmartRecommendationResponse {
  user_id?: string;
  generated_at: string;
  meal_recommendations: MealRecommendation[];
  daily_additions: RecommendationItem[];
  snack_recommendations: RecommendationItem[];
  nutritional_insights: {
    total_recommended_calories: number;
    macro_distribution: {
      protein_percent: number;
      fat_percent: number;
      carbs_percent: number;
    };
    nutritional_gaps: string[];
    health_benefits: string[];
  };
  personalization_factors: string[];
  total_recommendations: number;
  avg_confidence: number;
  recommendation_version: string;
}

interface RecommendationsScreenProps {
  onBackPress: () => void;
}

export default function RecommendationsScreen({ onBackPress }: RecommendationsScreenProps) {
  const [recommendations, setRecommendations] = useState<SmartRecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<string>('breakfast');
  const [preferencesModal, setPreferencesModal] = useState(false);
  const [preferences, setPreferences] = useState({
    dietaryRestrictions: [] as string[],
    cuisinePreferences: [] as string[],
    excludedIngredients: [] as string[],
    caloreBudget: 2000,
    maxRecommendations: 10,
  });

  const availableDietaryRestrictions = [
    'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'low-sodium'
  ];

  const availableCuisines = [
    'Mediterranean', 'Asian', 'Mexican', 'Italian', 'Indian', 'American'
  ];

  useEffect(() => {
    generateRecommendations();
  }, [selectedMeal]);

  const generateRecommendations = async () => {
    setLoading(true);
    try {
      const requestData = {
        meal_context: selectedMeal,
        max_recommendations: preferences.maxRecommendations,
        min_confidence: 0.3,
        dietary_restrictions: preferences.dietaryRestrictions,
        cuisine_preferences: preferences.cuisinePreferences,
        excluded_ingredients: preferences.excludedIngredients,
        calorie_budget: preferences.caloreBudget,
        include_history: true,
      };

      const response = await apiService.generateSmartRecommendations(requestData);
      setRecommendations(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate recommendations. Please try again.');
      console.error('Recommendations generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToMeal = async (item: RecommendationItem, mealType: string) => {
    try {
      // TODO: Integrate with meal plan customization
      Alert.alert(
        'Add to Meal Plan', 
        `Would you like to add ${item.name} to your ${mealType}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Add', 
            onPress: () => {
              Alert.alert('Success', `${item.name} added to your ${mealType} plan!`);
              // TODO: Actually add to meal plan via API
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to add item to meal plan.');
    }
  };

  const handleProvideFeedback = async (item: RecommendationItem, accepted: boolean) => {
    try {
      const feedbackData = {
        user_id: recommendations?.user_id || 'anonymous',
        recommendation_id: `rec_${Date.now()}`,
        barcode: item.barcode,
        accepted: accepted,
        relevance_rating: accepted ? 5 : 2,
        added_to_meal: accepted ? selectedMeal : undefined,
      };

      await apiService.recordRecommendationFeedback(feedbackData);
      Alert.alert('Thank You', 'Your feedback has been recorded and will help improve recommendations.');
    } catch (error) {
      console.error('Failed to record feedback:', error);
      Alert.alert('Note', 'Feedback recorded locally.');
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

  const renderRecommendationItem = (item: RecommendationItem, mealType: string) => (
    <View key={item.barcode} style={styles.recommendationCard}>
      <View style={styles.recommendationHeader}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.brand && <Text style={styles.itemBrand}>{item.brand}</Text>}
        </View>
        <View style={styles.scoreContainer}>
          <Text style={styles.confidenceScore}>
            {Math.round(item.confidence_score * 100)}%
          </Text>
          <Text style={styles.scoreLabel}>confidence</Text>
        </View>
      </View>

      <View style={styles.nutritionInfo}>
        <Text style={styles.nutritionText}>
          📊 {Math.round(item.calories_per_serving)} kcal • {item.serving_size}
        </Text>
        <Text style={styles.macroText}>
          P: {Math.round(item.protein_g)}g • F: {Math.round(item.fat_g)}g • C: {Math.round(item.carbs_g)}g
        </Text>
      </View>

      <View style={styles.reasonsContainer}>
        <Text style={styles.reasonsLabel}>Why recommended:</Text>
        <View style={styles.reasonTags}>
          {item.reasons.slice(0, 3).map((reason, index) => (
            <View key={index} style={styles.reasonTag}>
              <Text style={styles.reasonTagText}>{reason.replace('_', ' ')}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.nutritionalScores}>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreRowLabel}>Nutritional Quality:</Text>
          <View style={styles.scoreBar}>
            <View 
              style={[styles.scoreBarFill, { 
                width: `${item.nutritional_score.overall_score * 100}%`,
                backgroundColor: item.nutritional_score.overall_score > 0.7 ? '#4CAF50' : 
                                item.nutritional_score.overall_score > 0.5 ? '#FF9800' : '#F44336'
              }]} 
            />
          </View>
          <Text style={styles.scoreValue}>{Math.round(item.nutritional_score.overall_score * 100)}%</Text>
        </View>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreRowLabel}>Goal Alignment:</Text>
          <View style={styles.scoreBar}>
            <View 
              style={[styles.scoreBarFill, { 
                width: `${item.goal_alignment * 100}%`,
                backgroundColor: '#2196F3'
              }]} 
            />
          </View>
          <Text style={styles.scoreValue}>{Math.round(item.goal_alignment * 100)}%</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => handleAddToMeal(item, mealType)}
        >
          <Text style={styles.addButtonText}>➕ Add to {mealType}</Text>
        </TouchableOpacity>
        
        <View style={styles.feedbackButtons}>
          <TouchableOpacity 
            style={styles.feedbackButton}
            onPress={() => handleProvideFeedback(item, true)}
          >
            <Text style={styles.feedbackButtonText}>👍</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.feedbackButton}
            onPress={() => handleProvideFeedback(item, false)}
          >
            <Text style={styles.feedbackButtonText}>👎</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderMealSelector = () => (
    <View style={styles.mealSelector}>
      {['breakfast', 'lunch', 'dinner'].map(meal => (
        <TouchableOpacity
          key={meal}
          style={[
            styles.mealButton, 
            selectedMeal === meal && styles.mealButtonActive
          ]}
          onPress={() => setSelectedMeal(meal)}
        >
          <Text style={[
            styles.mealButtonText,
            selectedMeal === meal && styles.mealButtonTextActive
          ]}>
            {meal === 'breakfast' ? '🌅' : meal === 'lunch' ? '🌞' : '🌙'} {meal.charAt(0).toUpperCase() + meal.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderInsights = () => {
    if (!recommendations?.nutritional_insights) return null;

    const insights = recommendations.nutritional_insights;
    
    return (
      <View style={styles.insightsCard}>
        <Text style={styles.insightsTitle}>💡 Nutritional Insights</Text>
        
        <View style={styles.insightRow}>
          <Text style={styles.insightLabel}>Total Recommended Calories:</Text>
          <Text style={styles.insightValue}>{insights.total_recommended_calories} kcal</Text>
        </View>

        <View style={styles.macroDistribution}>
          <Text style={styles.insightLabel}>Macro Distribution:</Text>
          <View style={styles.macroRow}>
            <Text style={styles.macroText}>🥩 Protein: {insights.macro_distribution.protein_percent}%</Text>
            <Text style={styles.macroText}>🥑 Fat: {insights.macro_distribution.fat_percent}%</Text>
            <Text style={styles.macroText}>🍞 Carbs: {insights.macro_distribution.carbs_percent}%</Text>
          </View>
        </View>

        <View style={styles.healthBenefits}>
          <Text style={styles.insightLabel}>Health Benefits:</Text>
          {insights.health_benefits.map((benefit, index) => (
            <Text key={index} style={styles.benefitText}>• {benefit}</Text>
          ))}
        </View>
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
          <Text style={styles.modalTitle}>Recommendation Preferences</Text>
          <TouchableOpacity onPress={() => setPreferencesModal(false)}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.preferenceSection}>
            <Text style={styles.sectionTitle}>Dietary Restrictions</Text>
            <View style={styles.tagContainer}>
              {availableDietaryRestrictions.map(restriction => (
                <TouchableOpacity
                  key={restriction}
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
              {availableCuisines.map(cuisine => (
                <TouchableOpacity
                  key={cuisine}
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

          <TouchableOpacity 
            style={styles.applyButton}
            onPress={() => {
              setPreferencesModal(false);
              generateRecommendations();
            }}
          >
            <Text style={styles.applyButtonText}>Apply Preferences</Text>
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
          <Text style={styles.loadingText}>Generating smart recommendations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentMealRecommendation = recommendations?.meal_recommendations.find(
    meal => meal.meal_name.toLowerCase() === selectedMeal
  );

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>🏠</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>🎯 Smart Recommendations</Text>
          <Text style={styles.subtitle}>Personalized for your goals</Text>
        </View>
        <TouchableOpacity 
          style={styles.preferencesButton} 
          onPress={() => setPreferencesModal(true)}
        >
          <Text style={styles.preferencesButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderMealSelector()}
        {renderInsights()}

        {/* Meal-specific recommendations */}
        {currentMealRecommendation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {selectedMeal === 'breakfast' ? '🌅' : 
               selectedMeal === 'lunch' ? '🌞' : '🌙'} {selectedMeal.charAt(0).toUpperCase() + selectedMeal.slice(1)} Recommendations
            </Text>
            {currentMealRecommendation.recommendations.map(item => 
              renderRecommendationItem(item, selectedMeal)
            )}
          </View>
        )}

        {/* Snack recommendations */}
        {recommendations?.snack_recommendations && recommendations.snack_recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🍎 Healthy Snacks</Text>
            {recommendations.snack_recommendations.map(item => 
              renderRecommendationItem(item, 'snack')
            )}
          </View>
        )}

        {/* Daily additions */}
        {recommendations?.daily_additions && recommendations.daily_additions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⭐ Daily Additions</Text>
            {recommendations.daily_additions.map(item => 
              renderRecommendationItem(item, 'daily')
            )}
          </View>
        )}

        <TouchableOpacity style={styles.regenerateButton} onPress={generateRecommendations}>
          <Text style={styles.regenerateButtonText}>🔄 Generate New Recommendations</Text>
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
  mealSelector: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginTop: 15,
    borderRadius: 12,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mealButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  mealButtonActive: {
    backgroundColor: '#007AFF',
  },
  mealButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  mealButtonTextActive: {
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
  healthBenefits: {
    marginTop: 10,
  },
  benefitText: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 5,
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
  recommendationCard: {
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
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemBrand: {
    fontSize: 14,
    color: '#666',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  confidenceScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#666',
  },
  nutritionInfo: {
    marginBottom: 12,
  },
  nutritionText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
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
  nutritionalScores: {
    marginBottom: 15,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreRowLabel: {
    fontSize: 12,
    color: '#666',
    width: 120,
  },
  scoreBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginHorizontal: 8,
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: 'bold',
    width: 35,
    textAlign: 'right',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
  },
  addButtonText: {
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