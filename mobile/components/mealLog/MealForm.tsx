/**
 * MealForm Component - Form for creating new meal entries
 * Following TDD approach: Implementation after tests
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useMealLog } from '../../hooks/useMealLog';
import { MealType } from '../../types/mealLog';

interface MealFormProps {
  userId: string;
}

export const MealForm: React.FC<MealFormProps> = ({ userId }) => {
  const {
    formState,
    updateFormField,
    validateForm,
    createMeal,
  } = useMealLog(userId);

  const handleSubmit = async () => {
    try {
      const validation = validateForm();

      if (!validation.isValid) {
        // Show first error
        if (validation.firstErrorField) {
          const fieldName = getFieldDisplayName(validation.firstErrorField);
          const errorMessage = validation.errors[validation.firstErrorField];
          Alert.alert('Error de validación', `${fieldName}: ${errorMessage}`);
        }
        return;
      }

      await createMeal(userId, formState.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al guardar la comida';
      Alert.alert('Error', message);
    }
  };

  const handleMealTypeChange = (mealType: MealType) => {
    updateFormField('mealType', mealType);
  };

  const getMealTypeDisplayName = (mealType: MealType): string => {
    const names = {
      breakfast: 'Desayuno',
      lunch: 'Almuerzo',
      dinner: 'Cena',
      snack: 'Merienda',
    };
    return names[mealType] || mealType;
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.formContainer}>
        {/* Name Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Nombre del Alimento</Text>
          <TextInput
            style={[styles.textInput, formState.errors.name && styles.inputError]}
            value={formState.data.name}
            onChangeText={(value) => updateFormField('name', value)}
            placeholder="ej. Pollo a la parrilla"
            placeholderTextColor="#8E8E93"
            maxLength={100}
          />
          {formState.errors.name && (
            <Text style={styles.errorText}>{formState.errors.name}</Text>
          )}
        </View>

        {/* Description Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Descripción (opcional)</Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput, formState.errors.description && styles.inputError]}
            value={formState.data.description}
            onChangeText={(value) => updateFormField('description', value)}
            placeholder="Detalles adicionales..."
            placeholderTextColor="#8E8E93"
            multiline
            numberOfLines={2}
            maxLength={500}
          />
          {formState.errors.description && (
            <Text style={styles.errorText}>{formState.errors.description}</Text>
          )}
        </View>

        {/* Meal Type Selection */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Tipo de Comida</Text>
          <View style={styles.mealTypeContainer}>
            {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.mealTypeButton,
                  formState.data.mealType === type && styles.mealTypeButtonSelected,
                ]}
                onPress={() => handleMealTypeChange(type)}
              >
                <Text
                  style={[
                    styles.mealTypeButtonText,
                    formState.data.mealType === type && styles.mealTypeButtonTextSelected,
                  ]}
                >
                  {getMealTypeDisplayName(type)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {formState.errors.mealType && (
            <Text style={styles.errorText}>{formState.errors.mealType}</Text>
          )}
        </View>

        {/* Nutritional Information */}
        <Text style={styles.sectionTitle}>Información Nutricional</Text>

        {/* Calories */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Calorías <Text style={styles.unit}>kcal</Text></Text>
          <TextInput
            style={[styles.textInput, styles.numericInput, formState.errors.calories && styles.inputError]}
            value={formState.data.calories}
            onChangeText={(value) => updateFormField('calories', value)}
            placeholder="0"
            placeholderTextColor="#8E8E93"
            keyboardType="numeric"
            maxLength={5}
          />
          {formState.errors.calories && (
            <Text style={styles.errorText}>{formState.errors.calories}</Text>
          )}
        </View>

        {/* Macronutrients Row */}
        <View style={styles.macrosRow}>
          {/* Protein */}
          <View style={[styles.fieldContainer, styles.macroField]}>
            <Text style={styles.label}>Proteína <Text style={styles.unit}>g</Text></Text>
            <TextInput
              style={[styles.textInput, styles.numericInput, formState.errors.protein_g && styles.inputError]}
              value={formState.data.protein_g}
              onChangeText={(value) => updateFormField('protein_g', value)}
              placeholder="0"
              placeholderTextColor="#8E8E93"
              keyboardType="numeric"
              maxLength={4}
            />
            {formState.errors.protein_g && (
              <Text style={styles.errorText}>{formState.errors.protein_g}</Text>
            )}
          </View>

          {/* Fat */}
          <View style={[styles.fieldContainer, styles.macroField]}>
            <Text style={styles.label}>Grasa <Text style={styles.unit}>g</Text></Text>
            <TextInput
              style={[styles.textInput, styles.numericInput, formState.errors.fat_g && styles.inputError]}
              value={formState.data.fat_g}
              onChangeText={(value) => updateFormField('fat_g', value)}
              placeholder="0"
              placeholderTextColor="#8E8E93"
              keyboardType="numeric"
              maxLength={4}
            />
            {formState.errors.fat_g && (
              <Text style={styles.errorText}>{formState.errors.fat_g}</Text>
            )}
          </View>

          {/* Carbs */}
          <View style={[styles.fieldContainer, styles.macroField]}>
            <Text style={styles.label}>Carbohidratos <Text style={styles.unit}>g</Text></Text>
            <TextInput
              style={[styles.textInput, styles.numericInput, formState.errors.carbs_g && styles.inputError]}
              value={formState.data.carbs_g}
              onChangeText={(value) => updateFormField('carbs_g', value)}
              placeholder="0"
              placeholderTextColor="#8E8E93"
              keyboardType="numeric"
              maxLength={5}
            />
            {formState.errors.carbs_g && (
              <Text style={styles.errorText}>{formState.errors.carbs_g}</Text>
            )}
          </View>
        </View>

        {/* Barcode Field (Optional) */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Código de Barras (opcional)</Text>
          <TextInput
            style={[styles.textInput, formState.errors.barcode && styles.inputError]}
            value={formState.data.barcode || ''}
            onChangeText={(value) => updateFormField('barcode', value)}
            placeholder="1234567890123"
            placeholderTextColor="#8E8E93"
            keyboardType="numeric"
            maxLength={18}
          />
          {formState.errors.barcode && (
            <Text style={styles.errorText}>{formState.errors.barcode}</Text>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, formState.isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={formState.isSubmitting}
        >
          <Text style={[styles.submitButtonText, formState.isSubmitting && styles.submitButtonTextDisabled]}>
            {formState.isSubmitting ? 'Guardando...' : 'Guardar Comida'}
          </Text>
        </TouchableOpacity>

        {/* General Error */}
        {formState.errors.general && (
          <Text style={styles.generalErrorText}>{formState.errors.general}</Text>
        )}
      </View>
    </ScrollView>
  );
};

// Helper function for field display names
const getFieldDisplayName = (field: string): string => {
  const names: Record<string, string> = {
    name: 'Nombre del Alimento',
    calories: 'Calorías',
    protein_g: 'Proteína',
    fat_g: 'Grasa',
    carbs_g: 'Carbohidratos',
    mealType: 'Tipo de Comida',
    barcode: 'Código de Barras',
  };
  return names[field] || field;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  formContainer: {
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  unit: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8E8E93',
  },
  textInput: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  numericInput: {
    textAlign: 'center',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 8,
    marginBottom: 16,
  },
  mealTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealTypeButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  mealTypeButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  mealTypeButtonText: {
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  mealTypeButtonTextSelected: {
    color: '#007AFF',
  },
  macrosRow: {
    flexDirection: 'row',
    gap: 12,
  },
  macroField: {
    flex: 1,
    marginBottom: 0,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  submitButtonTextDisabled: {
    color: '#8E8E93',
  },
  generalErrorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 16,
  },
});
