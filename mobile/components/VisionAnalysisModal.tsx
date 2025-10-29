import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { VisionLogResponse } from '../types/visionLog';

interface VisionAnalysisModalProps {
  visible: boolean;
  analysis: VisionLogResponse;
  onClose: () => void;
  onRetry: () => void;
}

const VisionAnalysisModal: React.FC<VisionAnalysisModalProps> = ({
  visible,
  analysis,
  onClose,
  onRetry,
}) => {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('vision.analysis.modal.title', 'Analysis Results')}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.mealType}>
            {t('vision.mealType.title', 'Meal Type')}: {analysis.meal_type}
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('vision.analysis.ingredients', 'Detected Ingredients')}</Text>
            {analysis.identified_ingredients.map((ingredient, index) => (
              <View key={index} style={styles.ingredientItem}>
                <Text style={styles.ingredientName}>{ingredient.name}</Text>
                <Text style={styles.ingredientAmount}>{ingredient.estimated_grams}g</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('vision.analysis.nutrition', 'Nutrition Facts')}</Text>
            <Text style={styles.calories}>
              {analysis.estimated_portions.total_calories} {t('nutrition.calories', 'calories')}
            </Text>
            <Text style={styles.nutritionText}>
              {t('nutrition.protein', 'Protein')}: {analysis.estimated_portions.total_protein_g}g
            </Text>
            <Text style={styles.nutritionText}>
              {t('nutrition.fat', 'Fat')}: {analysis.estimated_portions.total_fat_g}g
            </Text>
            <Text style={styles.nutritionText}>
              {t('nutrition.carbs', 'Carbs')}: {analysis.estimated_portions.total_carbs_g}g
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('vision.analysis.health', 'Health Insights')}</Text>
            <Text style={styles.qualityScore}>
              {t('vision.analysis.quality', 'Quality Score')}: {analysis.nutritional_analysis.food_quality_score}/10
            </Text>
            <View style={styles.benefitsList}>
              {analysis.nutritional_analysis.health_benefits.map((benefit, index) => (
                <Text key={index} style={styles.benefitItem}>• {benefit}</Text>
              ))}
            </View>
          </View>

          {analysis.exercise_suggestions?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('vision.analysis.exercise', 'Exercise Suggestions')}</Text>
              {analysis.exercise_suggestions.map((exercise, index) => (
                <View key={index} style={styles.exerciseItem}>
                  <Text style={styles.exerciseType}>{exercise.activity_type}</Text>
                  <Text style={styles.exerciseDetails}>
                    {exercise.duration_minutes} min • {exercise.estimated_calories_burned} cal • {exercise.intensity_level}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.closeModalButton} onPress={onClose}>
            <Text style={styles.closeModalButtonText}>
              {t('common.close', 'Close')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#007AFF',
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  mealType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  section: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 15,
  },
  ingredientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  ingredientName: {
    fontSize: 14,
    color: '#333',
  },
  ingredientAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  calories: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#34C759',
    textAlign: 'center',
    marginBottom: 15,
  },
  nutritionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  qualityScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 10,
  },
  benefitsList: {
    marginTop: 5,
  },
  benefitItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  exerciseItem: {
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginBottom: 10,
  },
  exerciseType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 5,
  },
  exerciseDetails: {
    fontSize: 14,
    color: '#666',
  },
  closeModalButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
  },
  closeModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VisionAnalysisModal;
