/**
 * Meal Form Types - Form validation and state management for meal logging
 * Following TDD approach: Define contracts first, then implement
 */

import { MealType, MealSource, MealEntry, CreateMealRequest } from './mealLog';

export interface MealFormData {
  readonly name: string;
  readonly description: string;
  readonly calories: string; // String for form input
  readonly protein_g: string;
  readonly fat_g: string;
  readonly carbs_g: string;
  readonly mealType: MealType;
  readonly source: MealSource;
  readonly barcode?: string;
  readonly photoUri?: string;
}

export interface MealFormState {
  readonly data: MealFormData;
  readonly errors: MealFormErrors;
  readonly isSubmitting: boolean;
  readonly isDirty: boolean;
  readonly ocrEnabled: boolean;
  readonly ocrProcessing: boolean;
}

export interface MealFormErrors {
  readonly name?: string;
  readonly description?: string;
  readonly calories?: string;
  readonly protein_g?: string;
  readonly fat_g?: string;
  readonly carbs_g?: string;
  readonly mealType?: string;
  readonly barcode?: string;
  readonly general?: string;
}

export interface MealFormValidationResult {
  readonly isValid: boolean;
  readonly errors: MealFormErrors;
  readonly firstErrorField?: keyof MealFormData;
}

export interface MealFormActions {
  readonly updateField: (field: keyof MealFormData, value: string | MealType | MealSource) => void;
  readonly validateField: (field: keyof MealFormData) => string | undefined;
  readonly validateForm: () => MealFormValidationResult;
  readonly resetForm: () => void;
  readonly submitForm: () => Promise<MealEntry>;
  readonly enableOCR: () => void;
  readonly processOCR: (imageUri: string) => Promise<void>;
  readonly setPhoto: (uri: string) => void;
  readonly clearPhoto: () => void;
}

// Validation rules
export interface ValidationRule {
  readonly required?: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly pattern?: RegExp;
  readonly custom?: (value: any) => string | undefined;
}

export interface FormValidationRules {
  readonly name: ValidationRule;
  readonly description: ValidationRule;
  readonly calories: ValidationRule;
  readonly protein_g: ValidationRule;
  readonly fat_g: ValidationRule;
  readonly carbs_g: ValidationRule;
  readonly mealType: ValidationRule;
  readonly barcode: ValidationRule;
}

// Form field metadata for UI rendering
export interface FormFieldConfig {
  readonly key: keyof MealFormData;
  readonly label: string;
  readonly placeholder: string;
  readonly keyboardType: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  readonly autoCapitalize: 'none' | 'sentences' | 'words' | 'characters';
  readonly multiline?: boolean;
  readonly numberOfLines?: number;
  readonly required: boolean;
  readonly maxLength?: number;
  readonly unit?: string; // For numeric fields (g, kcal, etc.)
}

// Factory functions for creating instances (following TDD)
export const createEmptyMealFormData = (): MealFormData => ({
  name: '',
  description: '',
  calories: '',
  protein_g: '',
  fat_g: '',
  carbs_g: '',
  mealType: 'breakfast',
  source: 'manual',
});

export const createMealFormDataFromMeal = (meal: MealEntry): MealFormData => ({
  name: meal.name,
  description: meal.description || '',
  calories: meal.calories.toString(),
  protein_g: meal.protein_g.toString(),
  fat_g: meal.fat_g.toString(),
  carbs_g: meal.carbs_g.toString(),
  mealType: meal.mealType,
  source: meal.source,
  barcode: meal.barcode,
  photoUri: undefined, // Not stored in MealEntry
});

export const createEmptyMealFormErrors = (): MealFormErrors => ({});

export const createEmptyMealFormState = (): MealFormState => ({
  data: createEmptyMealFormData(),
  errors: createEmptyMealFormErrors(),
  isSubmitting: false,
  isDirty: false,
  ocrEnabled: false,
  ocrProcessing: false,
});

export const createMealFormState = (
  data: Partial<MealFormData> = {},
  errors: MealFormErrors = {},
  isSubmitting: boolean = false,
  ocrEnabled: boolean = false
): MealFormState => ({
  data: { ...createEmptyMealFormData(), ...data },
  errors,
  isSubmitting,
  isDirty: Object.keys(data).length > 0,
  ocrEnabled,
  ocrProcessing: false,
});

// Validation rules definition
export const MEAL_FORM_VALIDATION_RULES: FormValidationRules = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  description: {
    maxLength: 500,
  },
  calories: {
    required: true,
    minValue: 0,
    maxValue: 5000,
    custom: (value: string) => {
      const num = parseFloat(value);
      if (isNaN(num)) return 'Debe ser un número válido';
      if (num < 0) return 'No puede ser negativo';
      if (num > 5000) return 'Valor demasiado alto (máx. 5000 kcal)';
      return undefined;
    },
  },
  protein_g: {
    required: true,
    minValue: 0,
    maxValue: 500,
    custom: (value: string) => {
      const num = parseFloat(value);
      if (isNaN(num)) return 'Debe ser un número válido';
      if (num < 0) return 'No puede ser negativo';
      if (num > 500) return 'Valor demasiado alto (máx. 500g)';
      return undefined;
    },
  },
  fat_g: {
    required: true,
    minValue: 0,
    maxValue: 500,
    custom: (value: string) => {
      const num = parseFloat(value);
      if (isNaN(num)) return 'Debe ser un número válido';
      if (num < 0) return 'No puede ser negativo';
      if (num > 500) return 'Valor demasiado alto (máx. 500g)';
      return undefined;
    },
  },
  carbs_g: {
    required: true,
    minValue: 0,
    maxValue: 1000,
    custom: (value: string) => {
      const num = parseFloat(value);
      if (isNaN(num)) return 'Debe ser un número válido';
      if (num < 0) return 'No puede ser negativo';
      if (num > 1000) return 'Valor demasiado alto (máx. 1000g)';
      return undefined;
    },
  },
  mealType: {
    required: true,
  },
  barcode: {
    pattern: /^\d{8,18}$/,
    custom: (value: string) => {
      if (!value) return undefined; // Optional field
      if (!/^\d{8,18}$/.test(value)) {
        return 'Código de barras debe tener entre 8 y 18 dígitos';
      }
      return undefined;
    },
  },
};

// Form field configurations for UI
export const MEAL_FORM_FIELD_CONFIGS: readonly FormFieldConfig[] = [
  {
    key: 'name',
    label: 'Nombre del Alimento',
    placeholder: 'ej. Pollo a la parrilla',
    keyboardType: 'default',
    autoCapitalize: 'words',
    required: true,
    maxLength: 100,
  },
  {
    key: 'description',
    label: 'Descripción (opcional)',
    placeholder: 'Detalles adicionales...',
    keyboardType: 'default',
    autoCapitalize: 'sentences',
    multiline: true,
    numberOfLines: 2,
    required: false,
    maxLength: 500,
  },
  {
    key: 'mealType',
    label: 'Tipo de Comida',
    placeholder: 'Seleccionar tipo',
    keyboardType: 'default',
    autoCapitalize: 'none',
    required: true,
  },
  {
    key: 'calories',
    label: 'Calorías',
    placeholder: '0',
    keyboardType: 'numeric',
    autoCapitalize: 'none',
    required: true,
    unit: 'kcal',
  },
  {
    key: 'protein_g',
    label: 'Proteína',
    placeholder: '0',
    keyboardType: 'numeric',
    autoCapitalize: 'none',
    required: true,
    unit: 'g',
  },
  {
    key: 'fat_g',
    label: 'Grasa',
    placeholder: '0',
    keyboardType: 'numeric',
    autoCapitalize: 'none',
    required: true,
    unit: 'g',
  },
  {
    key: 'carbs_g',
    label: 'Carbohidratos',
    placeholder: '0',
    keyboardType: 'numeric',
    autoCapitalize: 'none',
    required: true,
    unit: 'g',
  },
  {
    key: 'barcode',
    label: 'Código de Barras (opcional)',
    placeholder: '1234567890123',
    keyboardType: 'numeric',
    autoCapitalize: 'none',
    required: false,
    maxLength: 18,
  },
];

// Utility functions for form operations
export const mealFormDataToCreateRequest = (formData: MealFormData): CreateMealRequest => ({
  name: formData.name,
  description: formData.description || undefined,
  calories: parseFloat(formData.calories),
  protein_g: parseFloat(formData.protein_g),
  fat_g: parseFloat(formData.fat_g),
  carbs_g: parseFloat(formData.carbs_g),
  mealType: formData.mealType,
  source: formData.source,
  barcode: formData.barcode || undefined,
  photoUrl: formData.photoUri,
});

export const isMealFormDirty = (formState: MealFormState): boolean => {
  const emptyData = createEmptyMealFormData();
  return !Object.keys(emptyData).every(key =>
    formState.data[key as keyof MealFormData] === emptyData[key as keyof MealFormData]
  );
};

export const hasMealFormErrors = (errors: MealFormErrors): boolean => {
  return Object.values(errors).some(error => error !== undefined && error !== '');
};
