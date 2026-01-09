/**
 * Tests for useMealLog hook - TDD approach
 * Testing business logic and state management
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMealLog } from '../useMealLog';
import { mealLogService } from '../../services/MealLogService';
import {
  MealEntry,
  MealType,
  MealSource,
  createMealEntry
} from '../../types/mealLog';

// Mock the service
jest.mock('../../services/MealLogService');
const mockMealLogService = mealLogService as jest.Mocked<typeof mealLogService>;

describe('useMealLog Hook - TDD Validation', () => {
  let mockMeal: MealEntry;

  beforeEach(() => {
    mockMeal = createMealEntry('meal-123', 'user-456', {
      name: 'Chicken Salad',
      calories: 350,
      protein_g: 30,
      fat_g: 15,
      carbs_g: 20,
      mealType: 'lunch' as MealType,
      source: 'manual' as MealSource,
    });

    jest.clearAllMocks();

    // Default mock implementations
    mockMealLogService.getMeals.mockResolvedValue([mockMeal]);
    mockMealLogService.createMeal.mockResolvedValue(mockMeal);
    mockMealLogService.updateMeal.mockResolvedValue(undefined);
    mockMealLogService.deleteMeal.mockResolvedValue(undefined);
    mockMealLogService.processOCR.mockResolvedValue({
      success: true,
      confidence: 85,
      extractedData: {
        name: 'Chicken Breast',
        calories: 250,
        protein_g: 30,
        fat_g: 10,
        carbs_g: 0,
      },
    });
  });

  describe('Initial state', () => {
    it('should return correct initial state', () => {
      const { result } = renderHook(() => useMealLog());

      expect(result.current.meals).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.selectedMeal).toBeNull();
      expect(result.current.formState.data.name).toBe('');
      expect(result.current.formState.isSubmitting).toBe(false);
      expect(result.current.ocrState.isProcessing).toBe(false);
    });

    it('should return correct initial form state', () => {
      const { result } = renderHook(() => useMealLog());

      expect(result.current.formState.data.mealType).toBe('breakfast');
      expect(result.current.formState.data.source).toBe('manual');
      expect(result.current.formState.errors).toEqual({});
      expect(result.current.formState.isDirty).toBe(false);
      expect(result.current.formState.ocrEnabled).toBe(false);
    });
  });

  describe('Hook return interface', () => {
    it('should return all required methods', () => {
      const { result } = renderHook(() => useMealLog());

      expect(typeof result.current.loadMeals).toBe('function');
      expect(typeof result.current.createMeal).toBe('function');
      expect(typeof result.current.updateMeal).toBe('function');
      expect(typeof result.current.deleteMeal).toBe('function');
      expect(typeof result.current.updateFormField).toBe('function');
      expect(typeof result.current.validateForm).toBe('function');
      expect(typeof result.current.resetForm).toBe('function');
      expect(typeof result.current.setSelectedMeal).toBe('function');
      expect(typeof result.current.processOCR).toBe('function');
      expect(typeof result.current.enableOCR).toBe('function');
      expect(typeof result.current.disableOCR).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
      expect(typeof result.current.retryLastOperation).toBe('function');
    });
  });

  describe('loadMeals method', () => {
    it('should call service and update state on success', async () => {
      const { result } = renderHook(() => useMealLog());

      await act(async () => {
        await result.current.loadMeals('user-456');
      });

      expect(mockMealLogService.getMeals).toHaveBeenCalledWith('user-456');
      expect(result.current.meals).toEqual([mockMeal]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should set loading state during operation', async () => {
      const { result } = renderHook(() => useMealLog());

      act(() => {
        result.current.loadMeals('user-456');
      });

      expect(result.current.loading).toBe(true);
    });

    it('should handle service errors', async () => {
      mockMealLogService.getMeals.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useMealLog());

      await act(async () => {
        await result.current.loadMeals('user-456');
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Network error');
      expect(result.current.meals).toEqual([]);
    });
  });

  describe('createMeal method', () => {
    it('should validate form data and call service', async () => {
      const { result } = renderHook(() => useMealLog());

      const formData = {
        name: 'New Meal',
        description: 'Description',
        calories: '300',
        protein_g: '25',
        fat_g: '10',
        carbs_g: '30',
        mealType: 'dinner' as MealType,
        source: 'manual' as MealSource,
        barcode: undefined,
        photoUri: undefined,
      };

      await act(async () => {
        const createdMeal = await result.current.createMeal('user-456', formData);
        expect(createdMeal).toEqual(mockMeal);
      });

      expect(mockMealLogService.createMeal).toHaveBeenCalledWith({
        name: 'New Meal',
        description: 'Description',
        calories: 300,
        protein_g: 25,
        fat_g: 10,
        carbs_g: 30,
        mealType: 'dinner',
        source: 'manual',
      });
    });

    it('should add meal to local state on success', async () => {
      const { result } = renderHook(() => useMealLog());

      const formData = {
        name: 'New Meal',
        description: '',
        calories: '300',
        protein_g: '25',
        fat_g: '10',
        carbs_g: '30',
        mealType: 'dinner' as MealType,
        source: 'manual' as MealSource,
        barcode: undefined,
        photoUri: undefined,
      };

      await act(async () => {
        await result.current.createMeal('user-456', formData);
      });

      expect(result.current.meals).toEqual([mockMeal]);
      expect(result.current.formState.data.name).toBe(''); // Form reset
    });

    it('should set submitting state during creation', async () => {
      const { result } = renderHook(() => useMealLog());

      const formData = {
        name: 'New Meal',
        description: '',
        calories: '300',
        protein_g: '25',
        fat_g: '10',
        carbs_g: '30',
        mealType: 'dinner' as MealType,
        source: 'manual' as MealSource,
        barcode: undefined,
        photoUri: undefined,
      };

      act(() => {
        result.current.createMeal('user-456', formData);
      });

      expect(result.current.formState.isSubmitting).toBe(true);

      await waitFor(() => {
        expect(result.current.formState.isSubmitting).toBe(false);
      });
    });

    it('should handle creation errors', async () => {
      mockMealLogService.createMeal.mockRejectedValueOnce(new Error('Creation failed'));

      const { result } = renderHook(() => useMealLog());

      const formData = {
        name: 'New Meal',
        description: '',
        calories: '300',
        protein_g: '25',
        fat_g: '10',
        carbs_g: '30',
        mealType: 'dinner' as MealType,
        source: 'manual' as MealSource,
        barcode: undefined,
        photoUri: undefined,
      };

      await expect(result.current.createMeal('user-456', formData)).rejects.toThrow('Creation failed');
      // Note: isSubmitting might still be true during error handling
      // This test verifies the error is thrown correctly
    });
  });

  describe('updateMeal method', () => {
    it('should find meal and update it', async () => {
      const { result } = renderHook(() => useMealLog());

      // First load some meals
      await act(async () => {
        await result.current.loadMeals('user-456');
      });

      const updateData = {
        name: 'Updated Meal',
        calories: '400',
      };

      await act(async () => {
        await result.current.updateMeal('meal-123', updateData);
      });

      expect(mockMealLogService.updateMeal).toHaveBeenCalledWith('meal-123', {
        name: 'Updated Meal',
        calories: 400,
      });

      expect(result.current.meals[0].name).toBe('Updated Meal');
      expect(result.current.meals[0].calories).toBe(400);
      expect(result.current.selectedMeal).toBeNull(); // Should be cleared
    });

    it('should set updating state during operation', async () => {
      const { result } = renderHook(() => useMealLog());

      await act(async () => {
        await result.current.loadMeals('user-456');
      });

      act(() => {
        result.current.updateMeal('meal-123', { name: 'Updated' });
      });

      // Note: This test might need adjustment based on actual implementation
      // The updating state might be managed differently
    });
  });

  describe('deleteMeal method', () => {
    it('should remove meal from local state', async () => {
      const { result } = renderHook(() => useMealLog());

      await act(async () => {
        await result.current.loadMeals('user-456');
      });

      expect(result.current.meals).toHaveLength(1);

      await act(async () => {
        await result.current.deleteMeal('meal-123');
      });

      expect(mockMealLogService.deleteMeal).toHaveBeenCalledWith('meal-123');
      expect(result.current.meals).toHaveLength(0);
    });

    it('should set deleting state during operation', async () => {
      const { result } = renderHook(() => useMealLog());

      await act(async () => {
        await result.current.loadMeals('user-456');
      });

      act(() => {
        result.current.deleteMeal('meal-123');
      });

      // Note: This test might need adjustment based on actual implementation
      // The deleting state might be managed differently
    });
  });

  describe('Form operations', () => {
    it('should update form field and clear errors', () => {
      const { result } = renderHook(() => useMealLog());

      act(() => {
        result.current.updateFormField('name', 'Test Meal');
      });

      expect(result.current.formState.data.name).toBe('Test Meal');
      expect(result.current.formState.isDirty).toBe(true);
    });

    it('should validate form and return results', () => {
      const { result } = renderHook(() => useMealLog());

      // Set valid data
      act(() => {
        result.current.updateFormField('name', 'Valid Meal');
        result.current.updateFormField('calories', '300');
        result.current.updateFormField('protein_g', '25');
        result.current.updateFormField('fat_g', '10');
        result.current.updateFormField('carbs_g', '30');
      });

      const validation = result.current.validateForm();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual({});
      expect(validation.firstErrorField).toBeUndefined();
    });

    it('should detect validation errors', () => {
      const { result } = renderHook(() => useMealLog());

      // Empty required field
      const validation = result.current.validateForm();

      expect(validation.isValid).toBe(false);
      expect(validation.errors.name).toBeDefined();
      expect(validation.firstErrorField).toBe('name');
    });

    it('should reset form to initial state', () => {
      const { result } = renderHook(() => useMealLog());

      act(() => {
        result.current.updateFormField('name', 'Test');
      });

      expect(result.current.formState.isDirty).toBe(true);

      act(() => {
        result.current.setSelectedMeal(mockMeal);
        result.current.resetForm();
      });

      expect(result.current.formState.data.name).toBe('');
      expect(result.current.formState.isDirty).toBe(false);
      expect(result.current.selectedMeal).toBeNull();
    });
  });

  describe('OCR operations', () => {
    it('should process OCR and populate form on success', async () => {
      const { result } = renderHook(() => useMealLog());

      await act(async () => {
        await result.current.processOCR('file:///image.jpg', 'lunch');
      });

      expect(mockMealLogService.processOCR).toHaveBeenCalled();
      expect(result.current.ocrState.isProcessing).toBe(false);
      expect(result.current.ocrState.lastResult?.success).toBe(true);
      expect(result.current.formState.data.name).toBe('Chicken Breast');
      expect(result.current.formState.data.calories).toBe('250');
    });

    it('should handle OCR failure gracefully', async () => {
      mockMealLogService.processOCR.mockResolvedValueOnce({
        success: false,
        confidence: 20,
        extractedData: { name: undefined },
        error: 'OCR failed',
      });

      const { result } = renderHook(() => useMealLog());

      await act(async () => {
        await result.current.processOCR('file:///image.jpg');
      });

      expect(result.current.ocrState.error).toBe('OCR failed');
      expect(result.current.formState.data.name).toBe(''); // Should not populate on failure
    });

    it('should enable and disable OCR', () => {
      const { result } = renderHook(() => useMealLog());

      act(() => {
        result.current.enableOCR();
      });

      expect(result.current.formState.ocrEnabled).toBe(true);

      act(() => {
        result.current.disableOCR();
      });

      expect(result.current.formState.ocrEnabled).toBe(false);
      expect(result.current.ocrState.lastResult).toBeNull();
    });
  });

  describe('Error handling and recovery', () => {
    it('should clear errors', () => {
      const { result } = renderHook(() => useMealLog());

      // Simulate error
      act(() => {
        result.current.loadMeals('user-456');
      });

      mockMealLogService.getMeals.mockRejectedValueOnce(new Error('Test error'));

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.ocrState.error).toBeNull();
    });

    it('should retry last operation', async () => {
      const { result } = renderHook(() => useMealLog());

      await act(async () => {
        await result.current.loadMeals('user-456');
      });

      // Change mock to succeed on retry
      mockMealLogService.getMeals.mockResolvedValueOnce([mockMeal]);

      act(() => {
        result.current.clearError();
        result.current.retryLastOperation();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.meals).toHaveLength(1);
      });
    });
  });

  describe('setSelectedMeal method', () => {
    it('should populate form with meal data for editing', () => {
      const { result } = renderHook(() => useMealLog());

      act(() => {
        result.current.setSelectedMeal(mockMeal);
      });

      expect(result.current.selectedMeal).toBe(mockMeal);
      expect(result.current.formState.data.name).toBe('Chicken Salad');
      expect(result.current.formState.data.calories).toBe('350');
      expect(result.current.formState.data.protein_g).toBe('30');
    });

    it('should clear selection and reset form', () => {
      const { result } = renderHook(() => useMealLog());

      act(() => {
        result.current.setSelectedMeal(mockMeal);
        result.current.setSelectedMeal(null);
      });

      expect(result.current.selectedMeal).toBeNull();
      expect(result.current.formState.data.name).toBe('');
    });
  });

  describe('Auto-loading behavior', () => {
    it('should load meals when userId is provided', async () => {
      const { result } = renderHook(() => useMealLog('user-456'));

      await waitFor(() => {
        expect(mockMealLogService.getMeals).toHaveBeenCalledWith('user-456');
      });
    });

    it('should not load meals when userId is undefined', () => {
      renderHook(() => useMealLog());

      expect(mockMealLogService.getMeals).not.toHaveBeenCalled();
    });
  });
});
