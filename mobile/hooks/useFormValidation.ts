// Form Validation React Hook
// Provides comprehensive form validation with real-time feedback

import { useState, useCallback, useMemo } from 'react';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../services/ErrorHandler';

// Validation Rule Types
export type ValidationRule<T = any> = {
  validator: (value: T, formData?: Record<string, any>) => boolean | Promise<boolean>;
  message: string;
  type?: 'error' | 'warning';
  async?: boolean;
};

export type FieldConfig<T = any> = {
  required?: boolean;
  rules?: ValidationRule<T>[];
  sanitizer?: (value: T) => T;
  debounceMs?: number;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
};

export type FormConfig<T extends Record<string, any>> = {
  [K in keyof T]: FieldConfig<T[K]>;
};

// Field Error State
export interface FieldError {
  message: string;
  type: 'error' | 'warning';
  rule?: string;
}

// Form State
export interface FormState<T extends Record<string, any>> {
  values: T;
  errors: Partial<Record<keyof T, FieldError>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isValidating: boolean;
  isDirty: boolean;
}

// Built-in Validation Rules
export const validationRules = {
  // Text validation
  minLength: (min: number): ValidationRule<string> => ({
    validator: (value) => value.length >= min,
    message: `Must be at least ${min} characters long`,
  }),

  maxLength: (max: number): ValidationRule<string> => ({
    validator: (value) => value.length <= max,
    message: `Must be no more than ${max} characters long`,
  }),

  email: (): ValidationRule<string> => ({
    validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: 'Please enter a valid email address',
  }),

  url: (): ValidationRule<string> => ({
    validator: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: 'Please enter a valid URL',
  }),

  // Number validation
  min: (min: number): ValidationRule<number> => ({
    validator: (value) => value >= min,
    message: `Must be at least ${min}`,
  }),

  max: (max: number): ValidationRule<number> => ({
    validator: (value) => value <= max,
    message: `Must be no more than ${max}`,
  }),

  integer: (): ValidationRule<number> => ({
    validator: (value) => Number.isInteger(value),
    message: 'Must be a whole number',
  }),

  positive: (): ValidationRule<number> => ({
    validator: (value) => value > 0,
    message: 'Must be a positive number',
  }),

  // Array validation
  minItems: (min: number): ValidationRule<any[]> => ({
    validator: (value) => value.length >= min,
    message: `Must have at least ${min} item${min !== 1 ? 's' : ''}`,
  }),

  maxItems: (max: number): ValidationRule<any[]> => ({
    validator: (value) => value.length <= max,
    message: `Must have no more than ${max} item${max !== 1 ? 's' : ''}`,
  }),

  // Recipe-specific validation
  cookingTime: (): ValidationRule<number> => ({
    validator: (value) => value >= 1 && value <= 1440, // 1 minute to 24 hours
    message: 'Cooking time must be between 1 minute and 24 hours',
  }),

  servings: (): ValidationRule<number> => ({
    validator: (value) => value >= 1 && value <= 50,
    message: 'Servings must be between 1 and 50',
  }),

  calories: (): ValidationRule<number> => ({
    validator: (value) => value >= 0 && value <= 10000,
    message: 'Calories must be between 0 and 10,000',
  }),

  difficulty: (): ValidationRule<string> => ({
    validator: (value) => ['beginner', 'intermediate', 'advanced'].includes(value),
    message: 'Please select a valid difficulty level',
  }),

  cuisineType: (): ValidationRule<string> => ({
    validator: (value) => value.length >= 2 && value.length <= 50,
    message: 'Cuisine type must be between 2 and 50 characters',
  }),

  // Custom async validation (e.g., checking if recipe name exists)
  uniqueRecipeName: (): ValidationRule<string> => ({
    validator: async (value) => {
      // This would call an API to check uniqueness
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      return !['existing recipe', 'duplicate name'].includes(value.toLowerCase());
    },
    message: 'This recipe name already exists',
    async: true,
  }),
};

// Recipe Form Validation Presets
export const recipeFormConfig = {
  name: {
    required: true,
    rules: [
      validationRules.minLength(2),
      validationRules.maxLength(100),
    ],
    validateOnChange: true,
    debounceMs: 300,
  },
  description: {
    rules: [validationRules.maxLength(500)],
    validateOnBlur: true,
  },
  cookingTime: {
    required: true,
    rules: [validationRules.cookingTime()],
    validateOnChange: true,
  },
  servings: {
    required: true,
    rules: [validationRules.servings()],
    validateOnChange: true,
  },
  difficulty: {
    required: true,
    rules: [validationRules.difficulty()],
  },
  cuisineType: {
    required: true,
    rules: [validationRules.cuisineType()],
  },
  ingredients: {
    required: true,
    rules: [validationRules.minItems(1)],
  },
  instructions: {
    required: true,
    rules: [validationRules.minItems(1)],
  },
};

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  config: FormConfig<T>
) {
  const [state, setState] = useState<FormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    isValid: false,
    isValidating: false,
    isDirty: false,
  });

  // Validate single field
  const validateField = useCallback(async (
    fieldName: keyof T,
    value: any,
    formData?: T
  ): Promise<FieldError | null> => {
    const fieldConfig = config[fieldName];
    if (!fieldConfig) return null;

    // Required field validation
    if (fieldConfig.required && (value === '' || value == null || (Array.isArray(value) && value.length === 0))) {
      return {
        message: 'This field is required',
        type: 'error',
        rule: 'required',
      };
    }

    // Skip other validations if field is empty and not required
    if (!fieldConfig.required && (value === '' || value == null)) {
      return null;
    }

    // Apply sanitization
    if (fieldConfig.sanitizer) {
      value = fieldConfig.sanitizer(value);
    }

    // Run validation rules
    if (fieldConfig.rules) {
      for (const rule of fieldConfig.rules) {
        try {
          const isValid = rule.async 
            ? await rule.validator(value, formData)
            : rule.validator(value, formData);

          if (!isValid) {
            return {
              message: rule.message,
              type: rule.type || 'error',
              rule: rule.message, // Could be improved to have rule names
            };
          }
        } catch (error) {
          console.error(`Validation error for ${String(fieldName)}:`, error);
          return {
            message: 'Validation failed',
            type: 'error',
            rule: 'validation_error',
          };
        }
      }
    }

    return null;
  }, [config]);

  // Validate entire form
  const validateForm = useCallback(async (values: T): Promise<boolean> => {
    setState(prev => ({ ...prev, isValidating: true }));

    const errors: Partial<Record<keyof T, FieldError>> = {};
    const validationPromises: Promise<void>[] = [];

    // Validate all fields
    Object.keys(config).forEach(fieldName => {
      const promise = validateField(fieldName as keyof T, values[fieldName], values)
        .then(error => {
          if (error) {
            errors[fieldName as keyof T] = error;
          }
        });
      validationPromises.push(promise);
    });

    await Promise.all(validationPromises);

    const isValid = Object.keys(errors).length === 0;

    setState(prev => ({
      ...prev,
      errors,
      isValid,
      isValidating: false,
    }));

    return isValid;
  }, [config, validateField]);

  // Update field value
  const setFieldValue = useCallback(async (fieldName: keyof T, value: any) => {
    const fieldConfig = config[fieldName];
    let processedValue = value;

    // Apply sanitization
    if (fieldConfig?.sanitizer) {
      processedValue = fieldConfig.sanitizer(value);
    }

    const newValues = { ...state.values, [fieldName]: processedValue };

    setState(prev => ({
      ...prev,
      values: newValues,
      isDirty: true,
    }));

    // Validate on change if configured
    if (fieldConfig?.validateOnChange) {
      const error = await validateField(fieldName, processedValue, newValues);
      setState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [fieldName]: error || undefined,
        },
        isValid: !error && Object.values({ ...prev.errors, [fieldName]: error }).every(e => !e),
      }));
    }
  }, [config, state.values, validateField]);

  // Set field as touched
  const setFieldTouched = useCallback(async (fieldName: keyof T) => {
    setState(prev => ({
      ...prev,
      touched: { ...prev.touched, [fieldName]: true },
    }));

    const fieldConfig = config[fieldName];
    
    // Validate on blur if configured
    if (fieldConfig?.validateOnBlur) {
      const error = await validateField(fieldName, state.values[fieldName], state.values);
      setState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [fieldName]: error || undefined,
        },
      }));
    }
  }, [config, state.values, validateField]);

  // Get field props for easy integration with inputs
  const getFieldProps = useCallback((fieldName: keyof T) => {
    return {
      value: state.values[fieldName],
      error: state.errors[fieldName],
      touched: state.touched[fieldName],
      onChangeText: (value: any) => setFieldValue(fieldName, value),
      onBlur: () => setFieldTouched(fieldName),
      required: config[fieldName]?.required,
    };
  }, [state, config, setFieldValue, setFieldTouched]);

  // Submit form
  const handleSubmit = useCallback(async (onSubmit: (values: T) => void | Promise<void>) => {
    // Mark all fields as touched
    const allTouched = Object.keys(config).reduce((acc, key) => {
      acc[key as keyof T] = true;
      return acc;
    }, {} as Partial<Record<keyof T, boolean>>);

    setState(prev => ({ ...prev, touched: allTouched }));

    // Validate form
    const isValid = await validateForm(state.values);

    if (isValid) {
      try {
        await onSubmit(state.values);
      } catch (error) {
        errorHandler.handleError(
          error as Error,
          { formData: state.values },
          true
        );
      }
    } else {
      // Focus on first error field (if you have refs)
      const firstErrorField = Object.keys(state.errors)[0];
      if (firstErrorField) {
        console.log(`Focus on field: ${firstErrorField}`);
      }
    }

    return isValid;
  }, [config, state.values, state.errors, validateForm]);

  // Reset form
  const reset = useCallback((newValues?: Partial<T>) => {
    setState({
      values: { ...initialValues, ...newValues },
      errors: {},
      touched: {},
      isValid: false,
      isValidating: false,
      isDirty: false,
    });
  }, [initialValues]);

  // Set multiple values
  const setValues = useCallback((values: Partial<T>) => {
    setState(prev => ({
      ...prev,
      values: { ...prev.values, ...values },
      isDirty: true,
    }));
  }, []);

  // Get validation summary
  const validationSummary = useMemo(() => {
    const errors = Object.values(state.errors).filter(Boolean) as FieldError[];
    const errorCount = errors.filter(e => e.type === 'error').length;
    const warningCount = errors.filter(e => e.type === 'warning').length;

    return {
      totalErrors: errorCount,
      totalWarnings: warningCount,
      hasErrors: errorCount > 0,
      hasWarnings: warningCount > 0,
      firstError: errors.find(e => e.type === 'error'),
    };
  }, [state.errors]);

  return {
    // State
    values: state.values,
    errors: state.errors,
    touched: state.touched,
    isValid: state.isValid,
    isValidating: state.isValidating,
    isDirty: state.isDirty,
    
    // Actions
    setFieldValue,
    setFieldTouched,
    setValues,
    validateField,
    validateForm,
    handleSubmit,
    reset,
    
    // Helpers
    getFieldProps,
    validationSummary,
  };
}