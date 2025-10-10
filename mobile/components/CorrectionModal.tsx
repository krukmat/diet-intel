import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { visionLogService } from '../services/VisionLogService';
import type { VisionLogResponse } from '../types/visionLog';

interface CorrectionModalProps {
  visible: boolean;
  logId: string;
  originalData: VisionLogResponse;
  onClose: () => void;
  onSubmit: (corrections: any) => void;
}

const CorrectionModal: React.FC<CorrectionModalProps> = ({
  visible,
  logId,
  originalData,
  onClose,
}) => {
  const { t } = useTranslation();

  // Estado del formulario según last_sprint.md
  const [formState, setFormState] = useState<{
    corrections: Array<{
      ingredient_name: string;
      estimated_grams: number;
      actual_grams: number;
    }>;
    feedback_type: 'portion_correction' | 'ingredient_misidentification' | 'missing_ingredient';
    notes: string;
    isSubmitting: boolean;
  }>({
    corrections: [],
    feedback_type: 'portion_correction',
    notes: '',
    isSubmitting: false,
  });

  // Efecto para inicializar corrections desde props
  useEffect(() => {
    if (originalData?.identified_ingredients) {
      const corrections = originalData.identified_ingredients.map(ingredient => ({
        ingredient_name: ingredient.name,
        estimated_grams: ingredient.estimated_grams,
        actual_grams: ingredient.estimated_grams, // Valor inicial igual
      }));
      setFormState(prev => ({ ...prev, corrections }));
    }
  }, [originalData]);

  // Función updateCorrection según last_sprint.md
  const updateCorrection = (index: number, field: string, value: number) => {
    setFormState(prev => ({
      ...prev,
      corrections: prev.corrections.map((correction, i) =>
        i === index ? { ...correction, [field]: value } : correction
      ),
    }));
  };

  // Función validateAndSubmit según last_sprint.md
  const validateAndSubmit = async () => {
    // Validación: al menos una corrección debe ser diferente al valor original
    const hasRealCorrections = formState.corrections.some(
      correction => correction.actual_grams !== correction.estimated_grams
    );

    if (!hasRealCorrections) {
      Alert.alert(t('correction.error.title', 'Correction Required'),
                  t('correction.error.message', 'Please correct at least one ingredient'));
      return;
    }

    try {
      setFormState(prev => ({ ...prev, isSubmitting: true }));

      await visionLogService.submitCorrection({
        log_id: logId,
        corrections: formState.corrections,
        feedback_type: formState.feedback_type,
      });

      // Success feedback
      Alert.alert(
        t('correction.success.title', 'Correction Submitted'),
        t('correction.success.message', 'Thank you for helping improve our analysis!'),
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      Alert.alert(
        t('correction.error.submitFailed', 'Submission Failed'),
        t('correction.error.tryAgain', 'Please try again')
      );
    } finally {
      setFormState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  if (!originalData) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('correction.modal.title', 'Submit Correction')}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {formState.corrections.map((correction, index) => (
              <View key={index} style={styles.correctionItem}>
                <Text style={styles.ingredientName}>{correction.ingredient_name}</Text>
                <View style={styles.correctionInputs}>
                  <TextInput
                    style={styles.input}
                    placeholder={t('correction.estimated', 'Estimated')}
                    value={correction.estimated_grams.toString()}
                    editable={false}
                    keyboardType="numeric"
                  />
                  <Text style={styles.arrow}>→</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t('correction.actual', 'Actual')}
                    value={correction.actual_grams.toString()}
                    onChangeText={(text) => updateCorrection(index, 'actual_grams', parseFloat(text) || 0)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.submitButton, formState.isSubmitting && styles.buttonDisabled]}
              onPress={validateAndSubmit}
              disabled={formState.isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {formState.isSubmitting ?
                  t('common.submitting', 'Submitting...') :
                  t('common.submit', 'Submit')
                }
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  contentContainer: {
    flexGrow: 1,
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
    padding: 20,
  },
  correctionItem: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  correctionInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: 'white',
    textAlign: 'center',
  },
  arrow: {
    marginHorizontal: 10,
    fontSize: 16,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#34C759',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CorrectionModal;
