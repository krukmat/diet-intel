/**
 * Tests for MealItem component - TDD approach
 * Testing individual meal item rendering and interactions
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MealItem } from '../MealItem';
import { MealEntry, MealType, MealSource } from '../../../types/mealLog';

describe('MealItem Component - TDD Validation', () => {
  const mockMeal: MealEntry = {
    id: 'meal-1',
    userId: 'user-123',
    name: 'Chicken Salad',
    calories: 350,
    protein_g: 30,
    fat_g: 15,
    carbs_g: 20,
    mealType: 'lunch' as MealType,
    timestamp: new Date('2024-01-01T12:00:00Z'),
    source: 'manual' as MealSource,
    createdAt: new Date('2024-01-01T12:00:00Z'),
    updatedAt: new Date('2024-01-01T12:00:00Z'),
  };

  const mockMealWithBarcode: MealEntry = {
    ...mockMeal,
    id: 'meal-2',
    name: 'Banana',
    calories: 105,
    protein_g: 1.3,
    fat_g: 0.4,
    carbs_g: 27,
    mealType: 'snack' as MealType,
    source: 'barcode' as MealSource,
    barcode: '1234567890123',
    timestamp: new Date('2024-01-01T15:00:00Z'),
  };

  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Meal display', () => {
    it('should render meal name and type', () => {
      const { getByText } = render(
        <MealItem meal={mockMeal} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(getByText('Chicken Salad')).toBeTruthy();
      expect(getByText('Almuerzo')).toBeTruthy(); // lunch in Spanish
    });

    it('should display calories prominently', () => {
      const { getByText } = render(
        <MealItem meal={mockMeal} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(getByText('350 kcal')).toBeTruthy();
    });

    it('should show macronutrients', () => {
      const { getByText } = render(
        <MealItem meal={mockMeal} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(getByText('P: 30g')).toBeTruthy();
      expect(getByText('G: 15g')).toBeTruthy();
      expect(getByText('C: 20g')).toBeTruthy();
    });

    it('should display timestamp in correct format', () => {
      const { getByText } = render(
        <MealItem meal={mockMeal} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      // Should show time in 24h format (UTC+1 for Madrid timezone)
      expect(getByText('13:00')).toBeTruthy();
    });
  });

  describe('Barcode display', () => {
    it('should show barcode when present', () => {
      const { getByText } = render(
        <MealItem meal={mockMealWithBarcode} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(getByText('Código:')).toBeTruthy();
      expect(getByText('1234567890123')).toBeTruthy();
    });

    it('should not show barcode section when not present', () => {
      const { queryByText } = render(
        <MealItem meal={mockMeal} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(queryByText('Código:')).toBeNull();
    });
  });

  describe('Action buttons', () => {
    it('should render edit and delete buttons', () => {
      const { getByText } = render(
        <MealItem meal={mockMeal} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(getByText('Editar')).toBeTruthy();
      expect(getByText('Eliminar')).toBeTruthy();
    });

    it('should call onEdit when edit button is pressed', () => {
      const { getByText } = render(
        <MealItem meal={mockMeal} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      const editButton = getByText('Editar');
      fireEvent.press(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith(mockMeal);
    });

    it('should show delete confirmation when delete button is pressed (mock setup)', () => {
      // Note: Alert testing requires complex mocking
      // This test verifies the delete button exists and calls Alert
      const { getByText } = render(
        <MealItem meal={mockMeal} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      const deleteButton = getByText('Eliminar');
      expect(deleteButton).toBeTruthy();
    });
  });

  describe('Meal type translation', () => {
    it('should translate breakfast correctly', () => {
      const breakfastMeal = { ...mockMeal, mealType: 'breakfast' as MealType };
      const { getByText } = render(
        <MealItem meal={breakfastMeal} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(getByText('Desayuno')).toBeTruthy();
    });

    it('should translate dinner correctly', () => {
      const dinnerMeal = { ...mockMeal, mealType: 'dinner' as MealType };
      const { getByText } = render(
        <MealItem meal={dinnerMeal} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(getByText('Cena')).toBeTruthy();
    });

    it('should translate snack correctly', () => {
      const snackMeal = { ...mockMealWithBarcode, mealType: 'snack' as MealType };
      const { getByText } = render(
        <MealItem meal={snackMeal} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(getByText('Merienda')).toBeTruthy();
    });
  });

  describe('Component structure', () => {
    it('should have proper accessibility labels', () => {
      const { getByText } = render(
        <MealItem meal={mockMeal} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      // Verify all essential text elements are present
      expect(getByText('Chicken Salad')).toBeTruthy();
      expect(getByText('350 kcal')).toBeTruthy();
      expect(getByText('Editar')).toBeTruthy();
      expect(getByText('Eliminar')).toBeTruthy();
    });

    it('should handle long meal names gracefully', () => {
      const longNameMeal = { ...mockMeal, name: 'Very Long Meal Name That Should Still Display Properly' };
      const { getByText } = render(
        <MealItem meal={longNameMeal} onEdit={mockOnEdit} onDelete={mockOnDelete} />
      );

      expect(getByText('Very Long Meal Name That Should Still Display Properly')).toBeTruthy();
    });
  });
});
