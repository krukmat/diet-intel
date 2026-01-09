/**
 * MealLogScreen - Pantalla principal para registrar comidas
 * Integra MealForm, MealList y funcionalidad OCR
 * Diseño scroll simple sin pestañas
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

// Import our meal logging components
import { MealForm } from '../components/mealLog/MealForm';
import { MealList } from '../components/mealLog/MealList';
import { MealEntry } from '../types/mealLog';

// Import OCR components
import VisionAnalysisModal from '../components/VisionAnalysisModal';
import { VisionLogResponse } from '../types/visionLog';

interface MealLogScreenProps {
  userId: string;
  onBackPress: () => void;
}

export default function MealLogScreen({ userId, onBackPress }: MealLogScreenProps) {
  const { t } = useTranslation();
  const [visionModalVisible, setVisionModalVisible] = useState(false);
  const [visionAnalysis, setVisionAnalysis] = useState<VisionLogResponse | null>(null);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);

  // Refs for scrolling
  const scrollViewRef = useRef<ScrollView>(null);
  const formRef = useRef<View>(null);

  // Handle OCR button press - this would integrate with camera/scanner
  const handleOCRPress = () => {
    Alert.alert(
      'Subir Etiqueta Nutricional',
      'Esta función procesará automáticamente la información nutricional de etiquetas de alimentos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () => {
            // Mock OCR processing for now
            setIsProcessingOCR(true);

            // Simulate OCR processing delay
            setTimeout(() => {
              setIsProcessingOCR(false);

              // Mock OCR result
              const mockAnalysis: VisionLogResponse = {
                id: 'vision-log-123',
                user_id: userId,
                image_url: 'mock-image-url',
                meal_type: 'lunch',
                identified_ingredients: [
                  {
                    name: 'Pollo a la parrilla',
                    category: 'protein',
                    estimated_grams: 150,
                    confidence_score: 0.95,
                    nutrition_per_100g: {
                      calories: 165,
                      protein_g: 31,
                      fat_g: 3.6,
                      carbs_g: 0,
                    },
                  },
                  {
                    name: 'Ensalada mixta',
                    category: 'vegetable',
                    estimated_grams: 100,
                    confidence_score: 0.88,
                    nutrition_per_100g: {
                      calories: 15,
                      protein_g: 1.4,
                      fat_g: 0.2,
                      carbs_g: 3.6,
                    },
                  },
                ],
                estimated_portions: {
                  total_calories: 320,
                  total_protein_g: 35,
                  total_fat_g: 12,
                  total_carbs_g: 15,
                  confidence_score: 0.91,
                },
                nutritional_analysis: {
                  total_calories: 320,
                  macro_distribution: {
                    protein_percent: 44,
                    fat_percent: 34,
                    carbs_percent: 22,
                  },
                  food_quality_score: 8.5,
                  health_benefits: [
                    'Alto en proteína',
                    'Bajo en grasas saturadas',
                    'Rico en vitaminas',
                  ],
                },
                exercise_suggestions: [],
                created_at: new Date().toISOString(),
                processing_time_ms: 1500,
              };

              setVisionAnalysis(mockAnalysis);
              setVisionModalVisible(true);
            }, 2000);
          },
        },
      ]
    );
  };

  // Handle OCR analysis completion
  const handleVisionAnalysisClose = () => {
    setVisionModalVisible(false);
    setVisionAnalysis(null);
  };

  // Handle meal editing from list
  const handleEditMeal = (meal: MealEntry) => {
    // Scroll to form when editing
    formRef.current?.measure((x, y, width, height, pageX, pageY) => {
      scrollViewRef.current?.scrollTo({ y: pageY - 100, animated: true });
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>🍽️ Registrar Comida</Text>
          <Text style={styles.subtitle}>Registra tus comidas manualmente o con OCR</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* OCR Action Button */}
        <View style={styles.ocrSection}>
          <TouchableOpacity
            style={[styles.ocrButton, isProcessingOCR && styles.ocrButtonDisabled]}
            onPress={handleOCRPress}
            disabled={isProcessingOCR}
          >
            <Text style={styles.ocrButtonText}>
              {isProcessingOCR ? '📷 Procesando...' : '📷 Subir Etiqueta Nutricional'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.ocrDescription}>
            Escanea etiquetas de alimentos para extraer automáticamente la información nutricional
          </Text>
        </View>

        {/* Meal Form Section */}
        <View ref={formRef} style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📝 Nueva Comida</Text>
            <Text style={styles.sectionSubtitle}>Ingresa los detalles de tu comida</Text>
          </View>

          <View style={styles.formContainer}>
            <MealForm userId={userId} />
          </View>
        </View>

        {/* Meals List Section */}
        <View style={styles.listSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📋 Mis Comidas</Text>
            <Text style={styles.sectionSubtitle}>Comidas registradas recientemente</Text>
          </View>

          <MealList
            userId={userId}
            onAddMeal={() => {
              // Scroll to form when adding new meal
              formRef.current?.measure((x, y, width, height, pageX, pageY) => {
                scrollViewRef.current?.scrollTo({ y: pageY - 100, animated: true });
              });
            }}
            onEditMeal={handleEditMeal}
          />
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* OCR Analysis Modal */}
      <VisionAnalysisModal
        visible={visionModalVisible}
        analysis={visionAnalysis!}
        onClose={handleVisionAnalysisClose}
        onRetry={() => {
          handleVisionAnalysisClose();
          handleOCRPress();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    textAlign: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  ocrSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  ocrButton: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  ocrButtonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  ocrButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  ocrDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  formSection: {
    marginTop: 16,
  },
  listSection: {
    marginTop: 24,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  formContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  bottomSpacing: {
    height: 40,
  },
});
