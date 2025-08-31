import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
  Platform,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { apiService } from '../services/ApiService';

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
}

const CustomizeModal: React.FC<CustomizeModalProps> = ({ visible, onClose, onConfirm, mealType }) => {
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
          brand: product.brands || product.brand || '',
          serving_size: product.serving_size || '100g',
          calories_per_serving: product.nutriments?.energy_kcal_100g || 0,
          protein_g: product.nutriments?.proteins_100g || 0,
          fat_g: product.nutriments?.fat_100g || 0,
          carbs_g: product.nutriments?.carbohydrates_100g || 0,
        };
        onConfirm(newItem);
        resetModal();
      }
    } catch (error) {
      Alert.alert('Search Failed', 'Could not find product. Try manual entry instead.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualAdd = () => {
    if (!manualItem.name.trim()) {
      Alert.alert('Missing Name', 'Please enter a product name');
      return;
    }

    const newItem: MealItem = {
      barcode: `manual_${Date.now()}`,
      name: manualItem.name,
      brand: manualItem.brand || '',
      serving_size: manualItem.serving_size || '100g',
      calories_per_serving: parseFloat(manualItem.calories_per_serving) || 0,
      protein_g: parseFloat(manualItem.protein_g) || 0,
      fat_g: parseFloat(manualItem.fat_g) || 0,
      carbs_g: parseFloat(manualItem.carbs_g) || 0,
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
          <Text style={styles.modalTitle}>Customize {mealType}</Text>
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
              🔍 Search
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'manual' && styles.modeButtonActive]}
            onPress={() => setMode('manual')}
          >
            <Text style={[styles.modeButtonText, mode === 'manual' && styles.modeButtonTextActive]}>
              ✏️ Manual
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
                  <Text style={styles.searchTypeButtonText}>Barcode</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.searchTypeButton, searchType === 'text' && styles.searchTypeButtonActive]}
                  onPress={() => setSearchType('text')}
                >
                  <Text style={styles.searchTypeButtonText}>Text</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.searchInput}
                placeholder={searchType === 'barcode' ? 'Enter barcode...' : 'Enter product name...'}
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
                  <Text style={styles.actionButtonText}>Search Product</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.sectionTitle}>Add Manual Item</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={manualItem.name}
                  onChangeText={(text) => setManualItem(prev => ({ ...prev, name: text }))}
                  placeholder="Enter product name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Brand</Text>
                <TextInput
                  style={styles.textInput}
                  value={manualItem.brand}
                  onChangeText={(text) => setManualItem(prev => ({ ...prev, brand: text }))}
                  placeholder="Enter brand (optional)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Serving Size</Text>
                <TextInput
                  style={styles.textInput}
                  value={manualItem.serving_size}
                  onChangeText={(text) => setManualItem(prev => ({ ...prev, serving_size: text }))}
                  placeholder="e.g., 100g, 1 cup"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Calories per serving</Text>
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
                  <Text style={styles.inputLabel}>Protein (g)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={manualItem.protein_g}
                    onChangeText={(text) => setManualItem(prev => ({ ...prev, protein_g: text }))}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.macroInput}>
                  <Text style={styles.inputLabel}>Fat (g)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={manualItem.fat_g}
                    onChangeText={(text) => setManualItem(prev => ({ ...prev, fat_g: text }))}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.macroInput}>
                  <Text style={styles.inputLabel}>Carbs (g)</Text>
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
                <Text style={styles.actionButtonText}>Add Item</Text>
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
}

export default function PlanScreen({ onBackPress }: PlanScreenProps) {
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [customizeModal, setCustomizeModal] = useState({
    visible: false,
    mealType: '',
    mealIndex: -1,
  });
  
  // Mock consumed values for progress tracking
  const [consumed] = useState({
    calories: 850,
    protein: 35,
    fat: 25,
    carbs: 120,
  });

  const mockUserProfile: UserProfile = {
    age: 30,
    sex: 'male',
    height_cm: 175,
    weight_kg: 75,
    activity_level: 'moderately_active',
    goal: 'maintain',
  };

  useEffect(() => {
    generatePlan();
  }, []);

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
      setDailyPlan(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate meal plan. Please try again.');
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
      meal.total_calories = meal.items.reduce((sum, item) => sum + item.calories_per_serving, 0);
      meal.total_protein = meal.items.reduce((sum, item) => sum + item.protein_g, 0);
      meal.total_fat = meal.items.reduce((sum, item) => sum + item.fat_g, 0);
      meal.total_carbs = meal.items.reduce((sum, item) => sum + item.carbs_g, 0);
      
      setDailyPlan(updatedPlan);
      Alert.alert('Success', 'Item added to meal plan!');
    } catch (error) {
      Alert.alert('Error', 'Failed to customize meal plan.');
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
           meal.name === 'Lunch' ? '🌞' : '🌙'} {meal.name}
        </Text>
        <Text style={styles.mealCalories}>{Math.round(meal.actual_calories)} kcal</Text>
      </View>

      {meal.items.map((item, itemIndex) => (
        <View key={itemIndex} style={styles.mealItem}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemServing}>{item.serving} • {Math.round(item.calories)} kcal</Text>
            <Text style={styles.macroText}>P: {Math.round(item.macros.protein_g)}g F: {Math.round(item.macros.fat_g)}g C: {Math.round(item.macros.carbs_g)}g</Text>
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={styles.customizeButton}
        onPress={() => handleCustomize(index, meal.name)}
      >
        <Text style={styles.customizeButtonText}>🔧 Customize</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Generating your meal plan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!dailyPlan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load meal plan</Text>
          <TouchableOpacity style={styles.retryButton} onPress={generatePlan}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>🏠</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>🍽️ Daily Meal Plan</Text>
          <Text style={styles.subtitle}>Today's Plan ({dailyPlan.daily_calorie_target} kcal)</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Daily Progress */}
        <View style={styles.progressSection}>
          <Text style={styles.sectionTitle}>Daily Progress</Text>
          
          <View style={styles.progressItem}>
            <Text style={styles.progressLabel}>Calories</Text>
            {renderProgressBar(consumed.calories, dailyPlan.metrics.total_calories, '#FF6B6B')}
          </View>
          
          <View style={styles.progressItem}>
            <Text style={styles.progressLabel}>Protein</Text>
            {renderProgressBar(consumed.protein, dailyPlan.metrics.protein_g, '#4ECDC4')}
          </View>
          
          <View style={styles.progressItem}>
            <Text style={styles.progressLabel}>Fat</Text>
            {renderProgressBar(consumed.fat, dailyPlan.metrics.fat_g, '#45B7D1')}
          </View>
          
          <View style={styles.progressItem}>
            <Text style={styles.progressLabel}>Carbs</Text>
            {renderProgressBar(consumed.carbs, dailyPlan.metrics.carbs_g, '#F9CA24')}
          </View>
        </View>

        {/* Meals */}
        <View style={styles.mealsSection}>
          <Text style={styles.sectionTitle}>Planned Meals</Text>
          {dailyPlan.meals.map(renderMeal)}
        </View>

        <TouchableOpacity style={styles.regenerateButton} onPress={generatePlan}>
          <Text style={styles.regenerateButtonText}>🔄 Generate New Plan</Text>
        </TouchableOpacity>
      </ScrollView>

      <CustomizeModal
        visible={customizeModal.visible}
        onClose={() => setCustomizeModal(prev => ({ ...prev, visible: false }))}
        onConfirm={handleCustomizeConfirm}
        mealType={customizeModal.mealType}
      />
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
  headerSpacer: {
    width: 60, // Same width as back button to center content
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  progressItem: {
    marginBottom: 15,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    minWidth: 60,
    textAlign: 'right',
  },
  mealsSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  mealCard: {
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
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mealTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  mealCalories: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  macroSummary: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  macroText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  mealItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  itemBrand: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  itemServing: {
    fontSize: 12,
    color: '#999',
  },
  customizeButton: {
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  customizeButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  regenerateButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 12,
    alignItems: 'center',
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
    padding: 5,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 12,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#007AFF',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  modeButtonTextActive: {
    color: 'white',
  },
  searchTypeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  searchTypeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  searchTypeButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  searchTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  searchInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    backgroundColor: '#BDC3C7',
    shadowColor: 'transparent',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  macroInput: {
    flex: 1,
  },
});