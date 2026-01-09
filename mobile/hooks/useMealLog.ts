/**
 * useMealLog Hook - Business logic for meal logging functionality
 * Following TDD approach: Define contracts first, then implement
 */

import { useState, useEffect, useCallback } from 'react';
import { mealLogService } from '../services/MealLogService';
import {
  MealEntry,
  MealLogState,
  CreateMealRequest,
  UpdateMealRequest,
  createEmptyMealLogState,
  createMealLogState,
} from '../types/mealLog';
import {
  OCRMealRequest,
  OCRProcessingResult,
  createOCRMealRequest,
  createEmptyOCRMealState,
} from '../types/ocrMeal';
import {
  MealFormData,
  MealFormState,
  MealFormValidationResult,
  createEmptyMealFormState,
  mealFormDataToCreateRequest,
  MEAL_FORM_VALIDATION_RULES,
} from '../types/mealForm';

export interface UseMealLogReturn {
  // State
  meals: readonly MealEntry[];
  loading: boolean;
  error: string | null;
  selectedMeal: MealEntry | null;

  // Form state
  formState: MealFormState;

  // OCR state
  ocrState: {
    isProcessing: boolean;
    lastResult: OCRProcessingResult | null;
    error: string | null;
  };

  // Actions
  loadMeals: (userId: string) => Promise<void>;
  createMeal: (userId: string, data: MealFormData) => Promise<MealEntry>;
  updateMeal: (id: string, data: Partial<MealFormData>) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;

  // Form actions
  updateFormField: (field: keyof MealFormData, value: string) => void;
  validateForm: () => MealFormValidationResult;
  resetForm: () => void;
  setSelectedMeal: (meal: MealEntry | null) => void;

  // OCR actions
  processOCR: (imageUri: string, mealType?: string) => Promise<void>;
  enableOCR: () => void;
  disableOCR: () => void;

  // Utility actions
  clearError: () => void;
  retryLastOperation: () => Promise<void>;
}

export const useMealLog = (userId?: string): UseMealLogReturn => {
  // Core state
  const [state, setState] = useState<MealLogState>(createEmptyMealLogState());

  // Form state
  const [formState, setFormState] = useState<MealFormState>(createEmptyMealFormState());

  // OCR state
  const [ocrState, setOcrState] = useState(createEmptyOCRMealState());

  // Last operation tracking for retry functionality
  const [lastOperation, setLastOperation] = useState<{
    type: 'load' | 'create' | 'update' | 'delete';
    params: any;
  } | null>(null);

  // Load meals for user
  const loadMeals = useCallback(async (targetUserId: string) => {
    setLastOperation({ type: 'load', params: { userId: targetUserId } });

    setState(prev => createMealLogState(prev.meals, true, null));

    try {
      const meals = await mealLogService.getMeals(targetUserId);
      setState(prev => createMealLogState(meals, false, null));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load meals';
      setState(prev => createMealLogState(prev.meals, false, errorMessage));
    }
  }, []);

  // Create new meal
  const createMeal = useCallback(async (targetUserId: string, formData: MealFormData): Promise<MealEntry> => {
    const createData = mealFormDataToCreateRequest(formData);
    setLastOperation({ type: 'create', params: { userId: targetUserId, data: createData } });

    setFormState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const newMeal = await mealLogService.createMeal(createData);

      // Add to local state
      setState(prev => createMealLogState([...prev.meals, newMeal], false, null));

      // Reset form
      setFormState(createEmptyMealFormState());

      return newMeal;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create meal';
      setFormState(prev => ({ ...prev, isSubmitting: false }));
      throw error; // Re-throw the original error
    }
  }, []);

  // Update existing meal
  const updateMeal = useCallback(async (id: string, formData: Partial<MealFormData>) => {
    // Create a new update object to avoid readonly property assignment errors
    const updateData: UpdateMealRequest = {};

    if (formData.name !== undefined) {
      updateData.name = formData.name;
    }
    if (formData.description !== undefined) {
      updateData.description = formData.description;
    }
    if (formData.calories !== undefined) {
      updateData.calories = parseFloat(formData.calories);
    }
    if (formData.protein_g !== undefined) {
      updateData.protein_g = parseFloat(formData.protein_g);
    }
    if (formData.fat_g !== undefined) {
      updateData.fat_g = parseFloat(formData.fat_g);
    }
    if (formData.carbs_g !== undefined) {
      updateData.carbs_g = parseFloat(formData.carbs_g);
    }
    if (formData.mealType !== undefined) {
      updateData.mealType = formData.mealType;
    }
    if (formData.photoUri !== undefined) {
      updateData.photoUrl = formData.photoUri;
    }

    setLastOperation({ type: 'update', params: { id, data: updateData } });

    setState(prev => ({ ...prev, isUpdating: true }));

    try {
      await mealLogService.updateMeal(id, updateData);

      // Update local state
      setState(prev => ({
        ...prev,
        meals: prev.meals.map(meal =>
          meal.id === id
            ? {
                ...meal,
                name: updateData.name ?? meal.name,
                description: updateData.description ?? meal.description,
                calories: updateData.calories ?? meal.calories,
                protein_g: updateData.protein_g ?? meal.protein_g,
                fat_g: updateData.fat_g ?? meal.fat_g,
                carbs_g: updateData.carbs_g ?? meal.carbs_g,
                mealType: updateData.mealType ?? meal.mealType,
                photoUrl: updateData.photoUrl ?? meal.photoUrl,
                updatedAt: new Date()
              }
            : meal
        ),
        isUpdating: false,
      }));

      setFormState(createEmptyMealFormState());
      setState(prev => ({ ...prev, selectedMeal: null }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update meal';
      setState(prev => ({ ...prev, isUpdating: false, error: errorMessage }));
      throw new Error(errorMessage);
    }
  }, []);

  // Delete meal
  const deleteMeal = useCallback(async (id: string) => {
    setLastOperation({ type: 'delete', params: { id } });

    setState(prev => ({ ...prev, isDeleting: true }));

    try {
      await mealLogService.deleteMeal(id);

      // Remove from local state
      setState(prev => ({
        ...prev,
        meals: prev.meals.filter(meal => meal.id !== id),
        isDeleting: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete meal';
      setState(prev => ({ ...prev, isDeleting: false, error: errorMessage }));
      throw new Error(errorMessage);
    }
  }, []);

  // Form field updates
  const updateFormField = useCallback((field: keyof MealFormData, value: string) => {
    setFormState(prev => {
      const newData = { ...prev.data, [field]: value };
      const newErrors = { ...prev.errors };

      // Clear field error when user starts typing
      if (newErrors[field]) {
        delete newErrors[field];
      }

      return {
        ...prev,
        data: newData,
        errors: newErrors,
        isDirty: true,
      };
    });
  }, []);

  // Form validation
  const validateForm = useCallback((): MealFormValidationResult => {
    const errors: Record<string, string> = {};
    let firstErrorField: keyof MealFormData | undefined;

    // Validate each field
    Object.entries(MEAL_FORM_VALIDATION_RULES).forEach(([field, rules]) => {
      const value = formState.data[field as keyof MealFormData];

      // Required validation
      if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        errors[field] = `${field} is required`;
        if (!firstErrorField) firstErrorField = field as keyof MealFormData;
        return;
      }

      // Skip other validations if field is empty and not required
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return;
      }

      // Length validation
      if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
        errors[field] = `${field} must be at least ${rules.minLength} characters`;
        if (!firstErrorField) firstErrorField = field as keyof MealFormData;
        return;
      }

      if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
        errors[field] = `${field} must be less than ${rules.maxLength} characters`;
        if (!firstErrorField) firstErrorField = field as keyof MealFormData;
        return;
      }

      // Pattern validation
      if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
        errors[field] = `${field} format is invalid`;
        if (!firstErrorField) firstErrorField = field as keyof MealFormData;
        return;
      }

      // Custom validation
      if (rules.custom) {
        const customError = rules.custom(value);
        if (customError) {
          errors[field] = customError;
          if (!firstErrorField) firstErrorField = field as keyof MealFormData;
        }
      }
    });

    setFormState(prev => ({ ...prev, errors }));

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      firstErrorField,
    };
  }, [formState.data]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormState(createEmptyMealFormState());
    setState(prev => ({ ...prev, selectedMeal: null }));
  }, []);

  // Set selected meal for editing
  const setSelectedMeal = useCallback((meal: MealEntry | null) => {
    setState(prev => ({ ...prev, selectedMeal: meal }));

    if (meal) {
      // Populate form with meal data for editing
      setFormState({
        data: {
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
        },
        errors: {},
        isSubmitting: false,
        isDirty: false,
        ocrEnabled: false,
        ocrProcessing: false,
      });
    } else {
      resetForm();
    }
  }, [resetForm]);

  // OCR processing
  const processOCR = useCallback(async (imageUri: string, mealType?: string) => {
    setOcrState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      const ocrRequest = createOCRMealRequest(imageUri, {
        mealType: mealType as any,
        expectedLanguage: 'es',
      });

      const result = await mealLogService.processOCR(ocrRequest);

      setOcrState(prev => ({
        ...prev,
        isProcessing: false,
        lastResult: result,
      }));

      // If OCR was successful, populate form with extracted data
      if (result.success && result.confidence >= 70) {
        setFormState(prev => ({
          ...prev,
          data: {
            ...prev.data,
            name: result.extractedData.name || prev.data.name,
            calories: result.extractedData.calories?.toString() || prev.data.calories,
            protein_g: result.extractedData.protein_g?.toString() || prev.data.protein_g,
            fat_g: result.extractedData.fat_g?.toString() || prev.data.fat_g,
            carbs_g: result.extractedData.carbs_g?.toString() || prev.data.carbs_g,
            photoUri: imageUri, // Store the image URI
          },
          ocrEnabled: true,
        }));
      } else {
        // OCR failed or low confidence
        setOcrState(prev => ({
          ...prev,
          error: result.error || 'OCR processing failed or low confidence',
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'OCR processing failed';
      setOcrState(prev => ({
        ...prev,
        isProcessing: false,
        error: errorMessage,
      }));
    }
  }, []);

  // OCR enable/disable
  const enableOCR = useCallback(() => {
    setFormState(prev => ({ ...prev, ocrEnabled: true }));
  }, []);

  const disableOCR = useCallback(() => {
    setFormState(prev => ({ ...prev, ocrEnabled: false }));
    setOcrState(createEmptyOCRMealState());
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
    setOcrState(prev => ({ ...prev, error: null }));
  }, []);

  // Retry last operation
  const retryLastOperation = useCallback(async () => {
    if (!lastOperation) return;

    clearError();

    switch (lastOperation.type) {
      case 'load':
        await loadMeals(lastOperation.params.userId);
        break;
      case 'create':
        await createMeal(lastOperation.params.userId, lastOperation.params.data);
        break;
      case 'update':
        await updateMeal(lastOperation.params.id, lastOperation.params.data);
        break;
      case 'delete':
        await deleteMeal(lastOperation.params.id);
        break;
    }
  }, [lastOperation, loadMeals, createMeal, updateMeal, deleteMeal, clearError]);

  // Auto-load meals when userId changes
  useEffect(() => {
    if (userId) {
      loadMeals(userId);
    }
  }, [userId, loadMeals]);

  return {
    // State
    meals: state.meals,
    loading: state.loading,
    error: state.error,
    selectedMeal: state.selectedMeal,

    // Form state
    formState,

    // OCR state
    ocrState: {
      isProcessing: ocrState.isProcessing,
      lastResult: ocrState.lastResult,
      error: ocrState.error,
    },

    // Actions
    loadMeals,
    createMeal,
    updateMeal,
    deleteMeal,

    // Form actions
    updateFormField,
    validateForm,
    resetForm,
    setSelectedMeal,

    // OCR actions
    processOCR,
    enableOCR,
    disableOCR,

    // Utility actions
    clearError,
    retryLastOperation,
  };
};
