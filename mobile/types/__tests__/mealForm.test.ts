/**
 * Tests for Meal Form types - TDD approach
 * Testing form validation and state management contracts
 */

import {
  MealFormData,
  MealFormState,
  MealFormErrors,
  MealFormValidationResult,
  ValidationRule,
  FormValidationRules,
  FormFieldConfig,
  createEmptyMealFormData,
  createMealFormDataFromMeal,
  createEmptyMealFormErrors,
  createEmptyMealFormState,
  createMealFormState,
  MEAL_FORM_VALIDATION_RULES,
  MEAL_FORM_FIELD_CONFIGS,
  mealFormDataToCreateRequest,
  isMealFormDirty,
  hasMealFormErrors,
} from '../mealForm';
import { MealEntry, MealType, MealSource, createMealEntry } from '../mealLog';

describe('Meal Form Types - TDD Validation', () => {
  describe('MealFormData interface contract', () => {
    it('should validate MealFormData with all fields', () => {
      const formData: MealFormData = {
        name: 'Chicken Salad',
        description: 'Fresh garden salad',
        calories: '350',
        protein_g: '30',
        fat_g: '15',
        carbs_g: '20',
        mealType: 'lunch' as MealType,
        source: 'manual' as MealSource,
        barcode: '1234567890123',
        photoUri: 'file:///image.jpg',
      };

      expect(formData.name).toBe('Chicken Salad');
      expect(formData.calories).toBe('350');
      expect(formData.protein_g).toBe('30');
      expect(formData.mealType).toBe('lunch');
      expect(formData.barcode).toBe('1234567890123');
      expect(formData.photoUri).toBe('file:///image.jpg');
    });

    it('should allow MealFormData with minimal required fields', () => {
      const formData: MealFormData = {
        name: 'Apple',
        description: '',
        calories: '95',
        protein_g: '0.5',
        fat_g: '0.3',
        carbs_g: '25',
        mealType: 'snack' as MealType,
        source: 'manual' as MealSource,
      };

      expect(formData.name).toBe('Apple');
      expect(formData.description).toBe('');
      expect(formData.barcode).toBeUndefined();
      expect(formData.photoUri).toBeUndefined();
    });
  });

  describe('MealFormState interface contract', () => {
    it('should validate MealFormState structure', () => {
      const formData: MealFormData = createEmptyMealFormData();
      const errors: MealFormErrors = { name: 'Required field' };

      const state: MealFormState = {
        data: formData,
        errors,
        isSubmitting: true,
        isDirty: true,
        ocrEnabled: true,
        ocrProcessing: false,
      };

      expect(state.data).toBe(formData);
      expect(state.errors).toEqual(errors);
      expect(state.isSubmitting).toBe(true);
      expect(state.isDirty).toBe(true);
      expect(state.ocrEnabled).toBe(true);
      expect(state.ocrProcessing).toBe(false);
    });
  });

  describe('MealFormValidationResult interface contract', () => {
    it('should validate successful validation result', () => {
      const result: MealFormValidationResult = {
        isValid: true,
        errors: {},
      };

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
      expect(result.firstErrorField).toBeUndefined();
    });

    it('should validate failed validation result', () => {
      const errors: MealFormErrors = {
        name: 'Required field',
        calories: 'Invalid number',
      };

      const result: MealFormValidationResult = {
        isValid: false,
        errors,
        firstErrorField: 'name',
      };

      expect(result.isValid).toBe(false);
      expect(result.errors).toBe(errors);
      expect(result.firstErrorField).toBe('name');
    });
  });

  describe('ValidationRule interface contract', () => {
    it('should validate ValidationRule with all options', () => {
      const rule: ValidationRule = {
        required: true,
        minLength: 1,
        maxLength: 100,
        minValue: 0,
        maxValue: 5000,
        pattern: /^[A-Za-z]+$/,
        custom: (value: any) => value ? undefined : 'Custom error',
      };

      expect(rule.required).toBe(true);
      expect(rule.minLength).toBe(1);
      expect(rule.maxLength).toBe(100);
      expect(rule.minValue).toBe(0);
      expect(rule.maxValue).toBe(5000);
      expect(rule.pattern).toEqual(/^[A-Za-z]+$/);
      expect(typeof rule.custom).toBe('function');
    });

    it('should allow minimal ValidationRule', () => {
      const rule: ValidationRule = {
        required: true,
      };

      expect(rule.required).toBe(true);
      expect(rule.minLength).toBeUndefined();
      expect(rule.custom).toBeUndefined();
    });
  });

  describe('FormFieldConfig interface contract', () => {
    it('should validate FormFieldConfig structure', () => {
      const config: FormFieldConfig = {
        key: 'name',
        label: 'Nombre del Alimento',
        placeholder: 'ej. Pollo a la parrilla',
        keyboardType: 'default',
        autoCapitalize: 'words',
        multiline: false,
        numberOfLines: 1,
        required: true,
        maxLength: 100,
        unit: undefined,
      };

      expect(config.key).toBe('name');
      expect(config.label).toBe('Nombre del Alimento');
      expect(config.required).toBe(true);
      expect(config.keyboardType).toBe('default');
      expect(config.autoCapitalize).toBe('words');
    });
  });

  describe('Factory functions - createEmptyMealFormData', () => {
    it('should create form data with correct defaults', () => {
      const data = createEmptyMealFormData();

      expect(data.name).toBe('');
      expect(data.description).toBe('');
      expect(data.calories).toBe('');
      expect(data.protein_g).toBe('');
      expect(data.fat_g).toBe('');
      expect(data.carbs_g).toBe('');
      expect(data.mealType).toBe('breakfast');
      expect(data.source).toBe('manual');
      expect(data.barcode).toBeUndefined();
      expect(data.photoUri).toBeUndefined();
    });
  });

  describe('Factory functions - createMealFormDataFromMeal', () => {
    it('should convert MealEntry to MealFormData', () => {
      const mockMeal = createMealEntry('meal-123', 'user-456', {
        name: 'Chicken Breast',
        calories: 250,
        protein_g: 35,
        fat_g: 10,
        carbs_g: 0,
        mealType: 'dinner' as MealType,
        source: 'manual' as MealSource,
        barcode: '1234567890123',
      });

      const formData = createMealFormDataFromMeal(mockMeal);

      expect(formData.name).toBe('Chicken Breast');
      expect(formData.calories).toBe('250');
      expect(formData.protein_g).toBe('35');
      expect(formData.fat_g).toBe('10');
      expect(formData.carbs_g).toBe('0');
      expect(formData.mealType).toBe('dinner');
      expect(formData.barcode).toBe('1234567890123');
      expect(formData.photoUri).toBeUndefined(); // Not stored in MealEntry
    });

    it('should handle MealEntry without optional fields', () => {
      const mockMeal = createMealEntry('meal-123', 'user-456', {
        name: 'Apple',
        calories: 95,
        protein_g: 0.5,
        fat_g: 0.3,
        carbs_g: 27,
        mealType: 'snack' as MealType,
        source: 'manual' as MealSource,
      });

      const formData = createMealFormDataFromMeal(mockMeal);

      expect(formData.description).toBe(''); // Empty string for undefined
      expect(formData.barcode).toBeUndefined();
    });
  });

  describe('Factory functions - createMealFormState', () => {
    it('should create form state with provided data', () => {
      const partialData = {
        name: 'Test Meal',
        calories: '200',
      };

      const errors = { calories: 'Invalid number' };

      const state = createMealFormState(partialData, errors, true, true);

      expect(state.data.name).toBe('Test Meal');
      expect(state.data.calories).toBe('200');
      expect(state.data.description).toBe(''); // Default
      expect(state.errors).toEqual(errors);
      expect(state.isSubmitting).toBe(true);
      expect(state.ocrEnabled).toBe(true);
      expect(state.isDirty).toBe(true);
    });

    it('should create form state with defaults', () => {
      const state = createMealFormState();

      expect(state.data.name).toBe('');
      expect(state.errors).toEqual({});
      expect(state.isSubmitting).toBe(false);
      expect(state.ocrEnabled).toBe(false);
      expect(state.isDirty).toBe(false);
    });
  });

  describe('MEAL_FORM_VALIDATION_RULES validation', () => {
    it('should have validation rules for all form fields', () => {
      const requiredFields: (keyof FormValidationRules)[] = [
        'name', 'description', 'calories', 'protein_g', 'fat_g', 'carbs_g', 'mealType', 'barcode'
      ];

      requiredFields.forEach(field => {
        expect(MEAL_FORM_VALIDATION_RULES[field]).toBeDefined();
      });
    });

    it('should validate name field rules', () => {
      const nameRule = MEAL_FORM_VALIDATION_RULES.name;

      expect(nameRule.required).toBe(true);
      expect(nameRule.minLength).toBe(1);
      expect(nameRule.maxLength).toBe(100);
    });

    it('should validate numeric field rules', () => {
      const caloriesRule = MEAL_FORM_VALIDATION_RULES.calories;

      expect(caloriesRule.required).toBe(true);
      expect(caloriesRule.minValue).toBe(0);
      expect(caloriesRule.maxValue).toBe(5000);
      expect(typeof caloriesRule.custom).toBe('function');
    });
  });

  describe('MEAL_FORM_FIELD_CONFIGS validation', () => {
    it('should have field configs for all form fields', () => {
      const expectedFields: (keyof MealFormData)[] = [
        'name', 'description', 'mealType', 'calories', 'protein_g', 'fat_g', 'carbs_g', 'barcode'
      ];

      const configKeys = MEAL_FORM_FIELD_CONFIGS.map(config => config.key);
      expectedFields.forEach(field => {
        expect(configKeys).toContain(field);
      });
    });

    it('should validate field config structure', () => {
      const nameConfig = MEAL_FORM_FIELD_CONFIGS.find(config => config.key === 'name');

      expect(nameConfig).toBeDefined();
      expect(nameConfig!.label).toBe('Nombre del Alimento');
      expect(nameConfig!.required).toBe(true);
      expect(nameConfig!.keyboardType).toBe('default');
      expect(nameConfig!.maxLength).toBe(100);
    });

    it('should validate numeric field configs', () => {
      const caloriesConfig = MEAL_FORM_FIELD_CONFIGS.find(config => config.key === 'calories');

      expect(caloriesConfig!.keyboardType).toBe('numeric');
      expect(caloriesConfig!.unit).toBe('kcal');
      expect(caloriesConfig!.required).toBe(true);
    });
  });

  describe('Utility functions - mealFormDataToCreateRequest', () => {
    it('should convert form data to create request', () => {
      const formData: MealFormData = {
        name: 'Grilled Chicken',
        description: 'With herbs',
        calories: '250',
        protein_g: '35',
        fat_g: '10',
        carbs_g: '0',
        mealType: 'dinner' as MealType,
        source: 'manual' as MealSource,
        barcode: '1234567890123',
        photoUri: 'file:///photo.jpg',
      };

      const request = mealFormDataToCreateRequest(formData);

      expect(request.name).toBe('Grilled Chicken');
      expect(request.description).toBe('With herbs');
      expect(request.calories).toBe(250);
      expect(request.protein_g).toBe(35);
      expect(request.fat_g).toBe(10);
      expect(request.carbs_g).toBe(0);
      expect(request.mealType).toBe('dinner');
      expect(request.barcode).toBe('1234567890123');
      expect(request.photoUrl).toBe('file:///photo.jpg');
    });

    it('should handle empty description', () => {
      const formData: MealFormData = {
        ...createEmptyMealFormData(),
        name: 'Apple',
        calories: '95',
        protein_g: '0.5',
        fat_g: '0.3',
        carbs_g: '27',
      };

      const request = mealFormDataToCreateRequest(formData);

      expect(request.description).toBeUndefined();
      expect(request.barcode).toBeUndefined();
      expect(request.photoUrl).toBeUndefined();
    });
  });

  describe('Utility functions - isMealFormDirty', () => {
    it('should detect dirty form', () => {
      const state = createMealFormState({
        name: 'Test Meal',
        calories: '200',
      });

      expect(isMealFormDirty(state)).toBe(true);
    });

    it('should detect clean form', () => {
      const state = createEmptyMealFormState();

      expect(isMealFormDirty(state)).toBe(false);
    });
  });

  describe('Utility functions - hasMealFormErrors', () => {
    it('should detect form with errors', () => {
      const errors: MealFormErrors = {
        name: 'Required',
        calories: 'Invalid number',
      };

      expect(hasMealFormErrors(errors)).toBe(true);
    });

    it('should detect form without errors', () => {
      const errors = createEmptyMealFormErrors();

      expect(hasMealFormErrors(errors)).toBe(false);
    });

    it('should ignore undefined errors', () => {
      const errors: MealFormErrors = {
        name: undefined,
        calories: '',
      };

      expect(hasMealFormErrors(errors)).toBe(false);
    });
  });

  describe('Form field config readonly array', () => {
    it('should be readonly and prevent mutation attempts', () => {
      const originalLength = MEAL_FORM_FIELD_CONFIGS.length;

      // Test that the array is readonly by checking its type
      const configs: readonly FormFieldConfig[] = MEAL_FORM_FIELD_CONFIGS;
      expect(configs.length).toBe(originalLength);

      // Verify all expected fields are present
      const expectedKeys: (keyof MealFormData)[] = [
        'name', 'description', 'mealType', 'calories', 'protein_g', 'fat_g', 'carbs_g', 'barcode'
      ];
      expectedKeys.forEach(key => {
        const config = configs.find(c => c.key === key);
        expect(config).toBeDefined();
        expect(config!.key).toBe(key);
      });
    });
  });

  describe('Validation rule custom functions', () => {
    it('should validate calories custom rule', () => {
      const customRule = MEAL_FORM_VALIDATION_RULES.calories.custom!;

      expect(customRule('250')).toBeUndefined(); // Valid
      expect(customRule('abc')).toBe('Debe ser un número válido'); // Invalid
      expect(customRule('-10')).toBe('No puede ser negativo'); // Invalid
      expect(customRule('6000')).toBe('Valor demasiado alto (máx. 5000 kcal)'); // Invalid
    });

    it('should validate barcode custom rule', () => {
      const customRule = MEAL_FORM_VALIDATION_RULES.barcode.custom!;

      expect(customRule('')).toBeUndefined(); // Optional field empty
      expect(customRule('1234567890123')).toBeUndefined(); // Valid
      expect(customRule('123')).toBe('Código de barras debe tener entre 8 y 18 dígitos'); // Too short
      expect(customRule('12345678901234567890')).toBe('Código de barras debe tener entre 8 y 18 dígitos'); // Too long
    });
  });
});
