import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Alert,
  Modal,
  Platform,
  Image,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import { translateFoodNameSync } from '../utils/foodTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/ApiService';
import {
  Container,
  Section,
  Button,
  InputNumber,
  Card,
  CardHeader,
  CardBody,
  Input,
  tokens
} from '../components/ui';

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
  daily_calorie_target: number;
  meals: Meal[];
  metrics: {
    total_calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  };
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

interface MarkMealEatenModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (photo?: string) => void;
  meal: Meal | null;
}

const MarkMealEatenModal: React.FC<MarkMealEatenModalProps> = ({
  visible,
  onClose,
  onConfirm,
  meal,
}) => {
  const { t } = useTranslation();
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
    setLoading(true);
    try {
      await onConfirm(photo || undefined);
      setPhoto(null);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPhoto(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('track.modal.markEatenTitle')}</Text>
          <Button
            variant="tertiary"
            size="sm"
            onPress={handleClose}
            title="✕"
            style={{ backgroundColor: 'transparent', padding: tokens.spacing.xs }}
          />
        </View>

        <ScrollView style={styles.modalContent}>
          {meal && (
            <View style={styles.mealSummary}>
              <Text style={styles.mealName}>{translateMealName(meal.name)}</Text>
              <Text style={styles.mealCalories}>{Math.round(meal.actual_calories)} kcal</Text>
              {meal.items.map((item, index) => (
                <Text key={index} style={styles.mealItem}>
                  • {translateFoodNameSync(item.name)} ({item.serving})
                </Text>
              ))}
            </View>
          )}

          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>{t('track.modal.addPhotoOptional')}</Text>
            {photo ? (
              <View style={styles.photoPreview}>
                <Image source={{ uri: photo }} style={styles.previewImage} />
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => setPhoto(null)}
                  title={t('track.modal.removePhoto')}
                  style={{ marginTop: tokens.spacing.sm }}
                />
              </View>
            ) : (
              <Button
                variant="secondary"
                size="md"
                onPress={takePhoto}
                title={t('track.modal.takePhoto')}
                style={{ marginTop: tokens.spacing.md }}
              />
            )}
          </View>

          <TouchableOpacity
            style={[styles.confirmButton, loading && styles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.confirmButtonText}>{t('track.modal.confirmEaten')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
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
          <Button
            variant="tertiary"
            size="sm"
            onPress={handleClose}
            title="✕"
            style={{ backgroundColor: 'transparent', padding: tokens.spacing.xs }}
          />
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <InputNumber
              label={t('track.modal.weightKg')}
              value={parseFloat(weight) || 0}
              onChangeValue={(value) => setWeight(value.toString())}
              placeholder={t('scanner.input.weightPlaceholder')}
              min={0}
              max={500}
              step={0.1}
              unit="kg"
              state={weight && parseFloat(weight) <= 0 ? 'error' : 'default'}
              errorMessage={weight && parseFloat(weight) <= 0 ? t('track.modal.invalidWeight') : undefined}
            />
          </View>

          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>{t('track.modal.addPhotoOptional')}</Text>
            {photo ? (
              <View style={styles.photoPreview}>
                <Image source={{ uri: photo }} style={styles.previewImage} />
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => setPhoto(null)}
                  title={t('track.modal.removePhoto')}
                  style={{ marginTop: tokens.spacing.sm }}
                />
              </View>
            ) : (
              <Button
                variant="secondary"
                size="md"
                onPress={takePhoto}
                title={t('track.modal.takePhoto')}
                style={{ marginTop: tokens.spacing.md }}
              />
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

  const translateMealName = (mealName: string): string => {
    const translationKey = `plan.meals.${mealName}`;
    const translatedName = t(translationKey);
    return translatedName !== translationKey ? translatedName : mealName;
  };
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [photoLogs, setPhotoLogs] = useState<PhotoLog[]>([]);
  const [markMealModal, setMarkMealModal] = useState({
    visible: false,
    meal: null as Meal | null,
  });
  const [weighInModal, setWeighInModal] = useState({ visible: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDailyPlan(),
        loadWeightHistory(),
        loadPhotoLogs(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadDailyPlan = async () => {
    try {
      const mockPlan: DailyPlan = {
        daily_calorie_target: 2000,
        meals: [
          {
            name: 'Breakfast', // This will be translated in display
            target_calories: 500,
            actual_calories: 480,
            items: [
              {
                barcode: '1234567890123',
                name: 'Oatmeal with Berries',
                serving: '1 bowl',
                calories: 300,
                macros: { protein_g: 8, fat_g: 6, carbs_g: 55 }
              },
              {
                barcode: '9876543210987',
                name: 'Greek Yogurt',
                serving: '150g',
                calories: 180,
                macros: { protein_g: 15, fat_g: 10, carbs_g: 8 }
              }
            ]
          },
          {
            name: 'Lunch', // This will be translated in display
            target_calories: 700,
            actual_calories: 680,
            items: [
              {
                barcode: '5432109876543',
                name: 'Grilled Chicken Salad',
                serving: '1 portion',
                calories: 420,
                macros: { protein_g: 35, fat_g: 18, carbs_g: 12 }
              },
              {
                barcode: '1111222233334',
                name: 'Whole Wheat Bread',
                serving: '2 slices',
                calories: 260,
                macros: { protein_g: 8, fat_g: 4, carbs_g: 48 }
              }
            ]
          },
          {
            name: 'Dinner', // This will be translated in display
            target_calories: 800,
            actual_calories: 750,
            items: [
              {
                barcode: '7777888899990',
                name: 'Salmon with Rice',
                serving: '1 portion',
                calories: 550,
                macros: { protein_g: 40, fat_g: 22, carbs_g: 35 }
              },
              {
                barcode: '4444555566667',
                name: 'Steamed Vegetables',
                serving: '1 cup',
                calories: 200,
                macros: { protein_g: 8, fat_g: 2, carbs_g: 40 }
              }
            ]
          }
        ],
        metrics: {
          total_calories: 1910,
          protein_g: 114,
          fat_g: 62,
          carbs_g: 198,
        }
      };
      setDailyPlan(mockPlan);
    } catch (error) {
      console.error('Failed to load daily plan:', error);
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

  const handleMarkMealEaten = async (photo?: string) => {
    try {
      const mealData = {
        meal_name: markMealModal.meal?.name,
        items: markMealModal.meal?.items,
        photo: photo,
        timestamp: new Date().toISOString(),
      };

      await apiService.post('/track/meal', mealData);

      if (photo) {
        const newPhotoLog: PhotoLog = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          photo: photo,
          type: 'meal',
          description: `${markMealModal.meal?.name} - ${Math.round(markMealModal.meal?.actual_calories || 0)} kcal`,
        };

        const updatedPhotoLogs = [newPhotoLog, ...photoLogs];
        setPhotoLogs(updatedPhotoLogs);
        await AsyncStorage.setItem('photo_logs', JSON.stringify(updatedPhotoLogs));
      }

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
    <Container flex={1} backgroundColor={tokens.colors.primary[500]} safeArea>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />

      <Section
        flexDirection="row"
        alignItems="center"
        padding="md"
        backgroundColor={tokens.colors.primary[500]}
        noDivider
      >
        <Button
          variant="tertiary"
          size="sm"
          onPress={onBackPress}
          title="🏠"
          style={{ backgroundColor: 'transparent' }}
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: tokens.colors.text.onDark }]}>{t('track.title')}</Text>
          <Text style={[styles.subtitle, { color: tokens.colors.text.onDark }]}>{t('track.subtitle')}</Text>
        </View>
        <View style={{ width: 50 }} />
      </Section>

      <Container flex={1} backgroundColor={tokens.colors.background.primary} scrollable>
        {/* Today's Meals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('track.todaysPlannedMeals')}</Text>
          {dailyPlan?.meals.map((meal, index) => (
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
                  <Text style={styles.itemName}>{translateFoodNameSync(item.name)}</Text>
                  <Text style={styles.itemDetails}>
                    {item.serving} • {Math.round(item.calories)} kcal
                  </Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.markEatenButton}
                onPress={() => setMarkMealModal({ visible: true, meal })}
              >
                <Text style={styles.markEatenButtonText}>{t('track.markAsEaten')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Section spacing="md">
          <Section
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            noDivider
            style={{ marginBottom: tokens.spacing.md }}
          >
            <Text style={[styles.sectionTitle, { color: tokens.colors.text.primary }]}>{t('track.weightProgress')}</Text>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => setWeighInModal({ visible: true })}
              title={t('track.weighIn')}
            />
          </Section>

          {renderWeightChart()}

          {weightHistory.length > 0 && (
            <View style={styles.currentWeight}>
              <Text style={styles.currentWeightLabel}>{t('track.currentWeight')}</Text>
              <Text style={styles.currentWeightValue}>
                {weightHistory[weightHistory.length - 1].weight} kg
              </Text>
            </View>
          )}
        </Section>

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
      </Container>

      <MarkMealEatenModal
        visible={markMealModal.visible}
        onClose={() => setMarkMealModal({ visible: false, meal: null })}
        onConfirm={handleMarkMealEaten}
        meal={markMealModal.meal}
      />

      <WeighInModal
        visible={weighInModal.visible}
        onClose={() => setWeighInModal({ visible: false })}
        onConfirm={handleWeighIn}
      />
    </Container>
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
    paddingVertical: 5,
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
  markEatenButton: {
    backgroundColor: '#34C759',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  markEatenButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
  mealCalories: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 10,
  },
  mealItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
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