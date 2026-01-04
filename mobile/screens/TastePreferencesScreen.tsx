import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { RecipeApiService, UserTasteProfile, UserLearningProgressResponse } from '../services/RecipeApiService';

interface TastePreferencesScreenProps {
  onBackPress: () => void;
  userId: string;
}

const TastePreferencesScreen: React.FC<TastePreferencesScreenProps> = ({
  onBackPress,
  userId,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [learningProgress, setLearningProgress] = useState<UserLearningProgressResponse | null>(null);
  const [tasteProfile, setTasteProfile] = useState<UserTasteProfile | null>(null);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedSpiceLevel, setSelectedSpiceLevel] = useState<'mild' | 'medium' | 'hot'>('medium');
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);

  const cuisineOptions = [
    'Italian', 'Mexican', 'Asian', 'Mediterranean', 'Indian', 'American',
    'French', 'Thai', 'Japanese', 'Chinese', 'Greek', 'Spanish'
  ];

  const dietaryOptions = [
    'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo',
    'Low-Carb', 'Low-Fat', 'Nut-Free', 'Soy-Free'
  ];

  const spiceLevels = [
    { value: 'mild', label: '🌶️ Mild', description: 'Little to no spice' },
    { value: 'medium', label: '🌶️🌶️ Medium', description: 'Some heat, balanced flavor' },
    { value: 'hot', label: '🌶️🌶️🌶️ Hot', description: 'Spicy and bold flavors' }
  ] as const;

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const recipeApi = RecipeApiService.getInstance();

      // Load learning progress and current taste profile
      const [progressData, profileData] = await Promise.all([
        recipeApi.getUserLearningProgress(userId),
        recipeApi.getUserTasteProfile(userId)
      ]);

      setLearningProgress(progressData);
      setTasteProfile(profileData.profile);

      // Set current preferences
      setSelectedCuisines(profileData.profile.cuisinePreferences);
      setSelectedSpiceLevel(profileData.profile.spiceLevel);
      setSelectedDietary(profileData.profile.dietaryRestrictions);
    } catch (error) {
      console.error('Failed to load user data:', error);
      Alert.alert('Error', 'Failed to load your taste preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setLoading(true);
    try {
      const recipeApi = RecipeApiService.getInstance();

      await recipeApi.learnUserPreferences({
        cuisinePreferences: selectedCuisines,
        spiceLevel: selectedSpiceLevel,
        dietaryRestrictions: selectedDietary,
      });

      Alert.alert(
        '✅ Preferences Saved!',
        'Your taste preferences have been updated. Generate new recipes to see personalized recommendations.',
        [{ text: 'OK', onPress: onBackPress }]
      );
    } catch (error) {
      console.error('Failed to save preferences:', error);
      Alert.alert('Error', 'Failed to save your preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines(prev =>
      prev.includes(cuisine)
        ? prev.filter(c => c !== cuisine)
        : [...prev, cuisine]
    );
  };

  const toggleDietary = (restriction: string) => {
    setSelectedDietary(prev =>
      prev.includes(restriction)
        ? prev.filter(d => d !== restriction)
        : [...prev, restriction]
    );
  };

  if (loading && !tasteProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your taste preferences...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🍽️ Taste Preferences</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Learning Progress Card */}
        {learningProgress && (
          <View style={styles.progressCard}>
            <Text style={styles.cardTitle}>🎯 Learning Progress</Text>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${learningProgress.progressPercentage}%` }]}
              />
            </View>
            <Text style={styles.progressText}>
              {learningProgress.progressPercentage}% complete • {learningProgress.totalRatings}/{learningProgress.requiredForAccuracy} ratings
            </Text>
            <Text style={styles.progressSubtext}>
              {learningProgress.insights.recommendations}
            </Text>
          </View>
        )}

        {/* Current Profile Insights */}
        {tasteProfile && (
          <View style={styles.insightsCard}>
            <Text style={styles.cardTitle}>🧠 Your Taste Profile</Text>
            <Text style={styles.insightText}>
              <Text style={styles.insightLabel}>Confidence: </Text>
              <Text style={styles.insightValue}>{Math.round(tasteProfile.confidenceScore * 100)}%</Text>
            </Text>
            <Text style={styles.insightText}>
              <Text style={styles.insightLabel}>Recipes Rated: </Text>
              <Text style={styles.insightValue}>{tasteProfile.totalRatings}</Text>
            </Text>
          </View>
        )}

        {/* Cuisine Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌍 Favorite Cuisines</Text>
          <Text style={styles.sectionSubtitle}>Select all cuisines you enjoy</Text>
          <View style={styles.optionsGrid}>
            {cuisineOptions.map((cuisine) => (
              <TouchableOpacity
                key={cuisine}
                style={[
                  styles.optionChip,
                  selectedCuisines.includes(cuisine) && styles.optionChipSelected
                ]}
                onPress={() => toggleCuisine(cuisine)}
              >
                <Text style={[
                  styles.optionChipText,
                  selectedCuisines.includes(cuisine) && styles.optionChipTextSelected
                ]}>
                  {cuisine}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Spice Level */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌶️ Spice Level Preference</Text>
          <Text style={styles.sectionSubtitle}>How spicy do you like your food?</Text>
          {spiceLevels.map((level) => (
            <TouchableOpacity
              key={level.value}
              style={[
                styles.spiceLevelOption,
                selectedSpiceLevel === level.value && styles.spiceLevelSelected
              ]}
              onPress={() => setSelectedSpiceLevel(level.value)}
            >
              <View style={styles.spiceLevelContent}>
                <Text style={[
                  styles.spiceLevelLabel,
                  selectedSpiceLevel === level.value && styles.spiceLevelLabelSelected
                ]}>
                  {level.label}
                </Text>
                <Text style={[
                  styles.spiceLevelDescription,
                  selectedSpiceLevel === level.value && styles.spiceLevelDescriptionSelected
                ]}>
                  {level.description}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Dietary Restrictions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🥗 Dietary Restrictions</Text>
          <Text style={styles.sectionSubtitle}>Select any dietary requirements you follow</Text>
          <View style={styles.optionsGrid}>
            {dietaryOptions.map((restriction) => (
              <TouchableOpacity
                key={restriction}
                style={[
                  styles.optionChip,
                  selectedDietary.includes(restriction) && styles.optionChipSelected
                ]}
                onPress={() => toggleDietary(restriction)}
              >
                <Text style={[
                  styles.optionChipText,
                  selectedDietary.includes(restriction) && styles.optionChipTextSelected
                ]}>
                  {restriction}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSavePreferences}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>✅ Save Preferences</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightsCard: {
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#d6ebff',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e1e5e9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  progressSubtext: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  insightText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  insightLabel: {
    fontWeight: '500',
  },
  insightValue: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    marginRight: 8,
    marginBottom: 8,
  },
  optionChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionChipText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  optionChipTextSelected: {
    color: '#fff',
  },
  spiceLevelOption: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  spiceLevelSelected: {
    backgroundColor: '#fff5f5',
    borderColor: '#ff6b6b',
  },
  spiceLevelContent: {
    flexDirection: 'column',
  },
  spiceLevelLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  spiceLevelLabelSelected: {
    color: '#ff6b6b',
  },
  spiceLevelDescription: {
    fontSize: 13,
    color: '#666',
  },
  spiceLevelDescriptionSelected: {
    color: '#ff6b6b',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  bottomPadding: {
    height: 32,
  },
});

export default TastePreferencesScreen;
