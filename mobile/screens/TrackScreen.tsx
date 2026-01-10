import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
  Platform,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { translateFoodNameSync } from '../utils/foodTranslation';
// import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/ApiService';
import type { DashboardData } from '../services/ApiService';

interface MealItem {
  id: string;
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
  isConsumed?: boolean;
}

interface Meal {
  name: string;
  target_calories: number;
  actual_calories: number;
  items: MealItem[];
}

interface DailyPlan {
  daily_calorie_target: number;
  meals: Meal[];
  metrics: {
    total_calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  };
}

interface PlanMealItem {
  id: string;
  barcode: string;
  name: string;
  serving: string;
  calories: number;
  macros: Record<string, number>;
  meal_type: string;
  is_consumed?: boolean;
}

type RawMacroInput = Partial<{
  protein_g: number;
  protein: number;
  fat_g: number;
  fat: number;
  carbs_g: number;
  carbs: number;
}>;

interface PlanProgress {
  plan_id: string;
  daily_calorie_target: number;
  meals: PlanMealItem[];
  created_at: string;
}

interface WeightEntry {
  date: string;
  weight: number;
  photo?: string;
}

interface PhotoLog {
  id: string;
  timestamp: string;
  photo: string;
  type: 'meal' | 'weigh-in';
  description?: string;
}

const getTranslatedMealName = (t: TFunction, mealName: string): string => {
  const translationKey = `plan.meals.${mealName}`;
  const translatedName = t(translationKey);
  return translatedName !== translationKey ? translatedName : mealName;
};

const normalizeMealTypeLabel = (mealType: string): string => {
  if (!mealType) return 'Meal';
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
};

const buildDailyPlan = (plan: PlanProgress, consumedItems: string[]): DailyPlan => {
  const mealsByType = new Map<string, Meal>();

  plan.meals.forEach((item) =>
    appendPlanMealToGroup(mealsByType, item, consumedItems)
  );

  const meals = Array.from(mealsByType.values());
  const totalCalories = meals.reduce((sum, meal) => sum + meal.actual_calories, 0);
  return {
    daily_calorie_target: plan.daily_calorie_target,
    meals,
    metrics: {
      total_calories: totalCalories,
      protein_g: 0,
      fat_g: 0,
      carbs_g: 0,
    },
  };
};

const addMealItemToGroup = (
  mealsByType: Map<string, Meal>,
  label: string,
  normalizedItem: MealItem
) => {
  const existing = mealsByType.get(label);
  if (existing) {
    existing.items.push(normalizedItem);
    existing.actual_calories += normalizedItem.calories;
    existing.target_calories = existing.actual_calories;
    return;
  }

  mealsByType.set(label, {
    name: label,
    target_calories: normalizedItem.calories,
    actual_calories: normalizedItem.calories,
    items: [normalizedItem],
  });
};

const appendPlanMealToGroup = (
  mealsByType: Map<string, Meal>,
  item: PlanMealItem,
  consumedItems: string[]
) => {
  const mealType = item.meal_type || 'meal';
  const label = normalizeMealTypeLabel(mealType);
  const normalizedItem: MealItem = {
    id: item.id,
    barcode: item.barcode,
    name: item.name,
    serving: item.serving,
    calories: item.calories,
    macros: normalizeMealMacros(item.macros),
    isConsumed: item.is_consumed || consumedItems.includes(item.id),
  };

  addMealItemToGroup(mealsByType, label, normalizedItem);
};

const normalizeMealMacros = (macros?: Record<string, number>) => ({
  protein_g: getMacroValue(macros, 'protein_g', 'protein'),
  fat_g: getMacroValue(macros, 'fat_g', 'fat'),
  carbs_g: getMacroValue(macros, 'carbs_g', 'carbs'),
});

const getMacroValue = (
  macros: Record<string, number> | undefined,
  primary: string,
  fallback: string
): number => {
  const normalized = macros || {};
  return Number(normalized[primary] ?? normalized[fallback] ?? 0);
};

interface WeighInModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (weight: number, photo?: string) => void;
}

const WeighInModal: React.FC<WeighInModalProps> = ({ visible, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [weight, setWeight] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(t('permissions.title'), t('permissions.cameraRequired'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const compressedImage = await compressImage(result.assets[0].uri);
      setPhoto(compressedImage);
    }
  };

  const compressImage = async (uri: string) => {
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return compressed.uri;
  };

  const handleConfirm = async () => {
    const weightNum = parseFloat(weight);
    if (!weightNum || weightNum <= 0) {
      Alert.alert(t('common.error'), t('track.modal.invalidWeight'));
      return;
    }

    setLoading(true);
    try {
      await onConfirm(weightNum, photo || undefined);
      setWeight('');
      setPhoto(null);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setWeight('');
    setPhoto(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('track.modal.weighInTitle')}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('track.modal.weightKg')}</Text>
            <TextInput
              style={styles.weightInput}
              value={weight}
              onChangeText={setWeight}
              placeholder={t('scanner.input.weightPlaceholder')}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>{t('track.modal.addPhotoOptional')}</Text>
            {photo ? (
              <View style={styles.photoPreview}>
                <Image source={{ uri: photo }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={() => setPhoto(null)}
                >
                  <Text style={styles.retakeButtonText}>{t('track.modal.removePhoto')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
                <Text style={styles.photoButtonText}>{t('track.modal.takePhoto')}</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.confirmButton, (!weight || loading) && styles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={!weight || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.confirmButtonText}>{t('track.modal.saveWeight')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

interface TrackScreenProps {
  onBackPress: () => void;
}

export default function TrackScreen({ onBackPress }: TrackScreenProps) {
  const { t } = useTranslation();
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [consumedItems, setConsumedItems] = useState<string[]>([]);
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [photoLogs, setPhotoLogs] = useState<PhotoLog[]>([]);
  const [weighInModal, setWeighInModal] = useState({ visible: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDashboard(),
        loadWeightHistory(),
        loadPhotoLogs(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const response = await apiService.getDashboard();
      const dashboard: DashboardData = response.data;
      const activePlan = dashboard.active_plan as PlanProgress | null;
      const consumed = dashboard.consumed_items || [];
      setConsumedItems(consumed);

      if (!activePlan) {
        setDailyPlan(null);
        return;
      }

      setDailyPlan(buildDailyPlan(activePlan, consumed));
    } catch (error) {
      console.error('Failed to load daily plan:', error);
      setDailyPlan(null);
    }
  };

  const loadWeightHistory = async () => {
    try {
      const response = await apiService.get('/track/weight/history?limit=30');
      const apiWeightHistory = response.data.entries.map((entry: any) => ({
        date: entry.date.split('T')[0], // Convert to YYYY-MM-DD format
        weight: entry.weight,
        photo: entry.photo_url
      }));
      setWeightHistory(apiWeightHistory);
    } catch (error) {
      console.error('Failed to load weight history from API:', error);
      // Fallback to mock data if API fails
      const mockData: WeightEntry[] = [
        { date: '2024-01-01', weight: 75.2 },
        { date: '2024-01-08', weight: 74.8 },
        { date: '2024-01-15', weight: 74.5 },
        { date: '2024-01-22', weight: 74.3 },
        { date: '2024-01-29', weight: 74.0 },
      ];
      setWeightHistory(mockData);
    }
  };

  const loadPhotoLogs = async () => {
    try {
      const response = await apiService.get('/track/photos?limit=50');
      const apiPhotoLogs = response.data.logs.map((log: any) => ({
        id: log.id,
        timestamp: log.timestamp,
        photo: log.photo_url,
        type: log.type,
        description: log.description
      }));
      setPhotoLogs(apiPhotoLogs);
    } catch (error) {
      console.error('Failed to load photo logs from API:', error);
      setPhotoLogs([]); // Start with empty array if API fails
    }
  };

  const handleConsumePlanItem = async (itemId: string) => {
    try {
      const consumedAt = new Date().toISOString();
      const response = await apiService.consumePlanItem(itemId, consumedAt);
      if (response.data?.updated_progress) {
        // Future: update progress widgets when they are shown in TrackScreen.
      }
      setConsumedItems((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
      Alert.alert(t('common.success'), t('track.modal.mealMarkedEaten'));
    } catch (error) {
      console.error('Failed to track meal:', error);
      Alert.alert(t('common.error'), t('track.modal.failedToTrackMeal'));
    }
  };

  const handleWeighIn = async (weight: number, photo?: string) => {
    try {
      const weightData = {
        weight: weight,
        date: new Date().toISOString(),
        photo: photo,
      };

      await apiService.post('/track/weight', weightData);

      const newEntry: WeightEntry = {
        date: new Date().toISOString().split('T')[0],
        weight: weight,
        photo: photo,
      };

      const updatedHistory = [...weightHistory, newEntry].slice(-10); // Keep last 10 entries
      setWeightHistory(updatedHistory);
      await AsyncStorage.setItem('weight_history', JSON.stringify(updatedHistory));

      if (photo) {
        const newPhotoLog: PhotoLog = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          photo: photo,
          type: 'weigh-in',
          description: `${t('track.weight')}: ${weight} kg`,
        };

        const updatedPhotoLogs = [newPhotoLog, ...photoLogs];
        setPhotoLogs(updatedPhotoLogs);
        await AsyncStorage.setItem('photo_logs', JSON.stringify(updatedPhotoLogs));
      }

      Alert.alert(t('common.success'), t('track.modal.weightRecorded'));
    } catch (error) {
      console.error('Failed to record weight:', error);
      Alert.alert(t('common.error'), t('track.modal.failedToRecordWeight'));
    }
  };

  const renderPhotoLog = ({ item }: { item: PhotoLog }) => (
    <TouchableOpacity style={styles.photoLogItem}>
      <Image source={{ uri: item.photo }} style={styles.photoThumbnail} />
      <View style={styles.photoLogInfo}>
        <Text style={styles.photoLogType}>
          {item.type === 'meal' ? '🍽️' : '⚖️'} {item.type === 'meal' ? t('track.photoLog.meal') : t('track.photoLog.weighIn')}
        </Text>
        <Text style={styles.photoLogDescription}>{item.description}</Text>
        <Text style={styles.photoLogTimestamp}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderWeightChart = () => {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderText}>
          {t('track.chartPlaceholder')}
        </Text>
        <Text style={styles.chartPlaceholderSubtext}>
          {t('track.chartSubtext')}
        </Text>
        {weightHistory.length > 0 && (
          <View style={styles.weightDataList}>
            {weightHistory.slice(-5).map((entry, index) => (
              <Text key={index} style={styles.weightDataItem}>
                {new Date(entry.date).toLocaleDateString()}: {entry.weight} kg
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>{t('track.loading')}</Text>
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
          <Text style={styles.title}>{t('track.title')}</Text>
          <Text style={styles.subtitle}>{t('track.subtitle')}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Today's Meals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('track.todaysPlannedMeals')}</Text>
          {!dailyPlan && (
            <Text style={styles.emptyPlanText}>{t('track.noActivePlan')}</Text>
          )}
          {dailyPlan?.meals.map((meal, index) => (
            <View key={meal.name} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                  <Text style={styles.mealTitle}>
                    {meal.name === 'Breakfast' ? '🌅' : 
                   meal.name === 'Lunch' ? '🌞' : '🌙'} {getTranslatedMealName(t, meal.name)}
                  </Text>
                <Text style={styles.mealCalories}>{Math.round(meal.actual_calories)} kcal</Text>
              </View>

              {meal.items.map((item, itemIndex) => {
                const isConsumed = Boolean(item.isConsumed || consumedItems.includes(item.id));
                return (
                  <View key={itemIndex} style={styles.mealItem}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{translateFoodNameSync(item.name)}</Text>
                      <Text style={styles.itemDetails}>
                        {item.serving} • {Math.round(item.calories)} kcal
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.consumeItemButton, isConsumed && styles.consumeItemButtonDisabled]}
                      onPress={() => handleConsumePlanItem(item.id)}
                      disabled={isConsumed}
                    >
                      <Text
                        style={[
                          styles.consumeItemButtonText,
                          isConsumed && styles.consumeItemButtonTextDisabled,
                        ]}
                      >
                        {isConsumed ? t('track.itemConsumed') : t('track.markAsEaten')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Weight Tracking */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('track.weightProgress')}</Text>
            <TouchableOpacity
              style={styles.weighInButton}
              onPress={() => setWeighInModal({ visible: true })}
            >
              <Text style={styles.weighInButtonText}>{t('track.weighIn')}</Text>
            </TouchableOpacity>
          </View>

          {renderWeightChart()}

          {weightHistory.length > 0 && (
            <View style={styles.currentWeight}>
              <Text style={styles.currentWeightLabel}>{t('track.currentWeight')}</Text>
              <Text style={styles.currentWeightValue}>
                {weightHistory[weightHistory.length - 1].weight} kg
              </Text>
            </View>
          )}
        </View>

        {/* Photo Logs */}
        {photoLogs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('track.photoLogs')}</Text>
            <FlatList
              data={photoLogs.slice(0, 10)}
              renderItem={renderPhotoLog}
              keyExtractor={(item) => item.id}
              horizontal={false}
              showsVerticalScrollIndicator={false}
              style={styles.photoLogsList}
            />
          </View>
        )}
      </ScrollView>

      <WeighInModal
        visible={weighInModal.visible}
        onClose={() => setWeighInModal({ visible: false })}
        onConfirm={handleWeighIn}
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
    width: 60,
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
  section: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  mealCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    backgroundColor: '#FAFAFA',
  },
  emptyPlanText: {
    fontSize: 14,
    color: '#777',
    marginBottom: 10,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  mealCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  itemDetails: {
    fontSize: 12,
    color: '#666',
  },
  consumeItemButton: {
    backgroundColor: '#34C759',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  consumeItemButtonDisabled: {
    backgroundColor: '#D0D5DD',
  },
  consumeItemButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  consumeItemButtonTextDisabled: {
    color: '#667085',
  },
  weighInButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  weighInButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  chart: {
    marginVertical: 10,
    borderRadius: 16,
  },
  chartPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    marginVertical: 10,
  },
  chartPlaceholderText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 5,
  },
  chartPlaceholderSubtext: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 15,
  },
  weightDataList: {
    alignItems: 'center',
  },
  weightDataItem: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '500',
    marginVertical: 2,
  },
  currentWeight: {
    alignItems: 'center',
    marginTop: 15,
  },
  currentWeightLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  currentWeightValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  photoLogsList: {
    maxHeight: 300,
  },
  photoLogItem: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  photoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 10,
  },
  photoLogInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  photoLogType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  photoLogDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  photoLogTimestamp: {
    fontSize: 10,
    color: '#999',
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
  mealSummary: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  mealName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  photoSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  photoButton: {
    backgroundColor: '#F0F8FF',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    paddingVertical: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  photoButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  photoPreview: {
    alignItems: 'center',
  },
  previewImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 10,
  },
  retakeButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  retakeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#34C759',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    backgroundColor: '#BDC3C7',
    shadowColor: 'transparent',
  },
  inputGroup: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  weightInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
});
