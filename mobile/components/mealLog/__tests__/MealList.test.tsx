/**
 * Tests for MealList component - TDD approach
 * Testing meal list rendering and interactions
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MealList } from '../MealList';
import { MealEntry, MealType, MealSource } from '../../../types/mealLog';

// Mock the useMealLog hook
const mockLoadMeals = jest.fn();
const mockSetSelectedMeal = jest.fn();
const mockDeleteMeal = jest.fn();

jest.mock('../../../hooks/useMealLog', () => ({
  useMealLog: () => ({
    meals: [],
    loading: false,
    error: null,
    loadMeals: mockLoadMeals,
    setSelectedMeal: mockSetSelectedMeal,
    deleteMeal: mockDeleteMeal,
    formState: { data: {}, errors: {}, isSubmitting: false, isDirty: false, ocrEnabled: false, ocrProcessing: false },
    updateFormField: jest.fn(),
    validateForm: jest.fn(),
    resetForm: jest.fn(),
    createMeal: jest.fn(),
    processOCR: jest.fn(),
    enableOCR: jest.fn(),
    disableOCR: jest.fn(),
    clearError: jest.fn(),
    retryLastOperation: jest.fn(),
  }),
}));

describe('MealList Component - TDD Validation', () => {
  const mockMeals: MealEntry[] = [
    {
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
    },
    {
      id: 'meal-2',
      userId: 'user-123',
      name: 'Banana',
      calories: 105,
      protein_g: 1.3,
      fat_g: 0.4,
      carbs_g: 27,
      mealType: 'snack' as MealType,
      timestamp: new Date('2024-01-01T15:00:00Z'),
      source: 'barcode' as MealSource,
      barcode: '1234567890123',
      createdAt: new Date('2024-01-01T15:00:00Z'),
      updatedAt: new Date('2024-01-01T15:00:00Z'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Empty state', () => {
    it('should render empty state when no meals', () => {
      const { getByText } = render(<MealList userId="user-123" />);

      expect(getByText('No hay comidas registradas')).toBeTruthy();
      expect(getByText('Registra tu primera comida para comenzar')).toBeTruthy();
    });

    it('should show add button in empty state when onAddMeal provided', () => {
      const { getByText } = render(<MealList userId="user-123" onAddMeal={() => {}} />);

      expect(getByText('Agregar Comida')).toBeTruthy();
    });
  });

  describe('Component props', () => {
    it('should call loadMeals with correct userId on mount', () => {
      render(<MealList userId="user-456" />);

      expect(mockLoadMeals).toHaveBeenCalledWith('user-456');
    });
  });

  describe('Component rendering', () => {
    it('should render component without crashing', () => {
      const { getByText } = render(<MealList userId="user-123" />);

      expect(getByText('No hay comidas registradas')).toBeTruthy();
    });

    it('should show add button when onAddMeal prop is provided', () => {
      const mockOnAddMeal = jest.fn();
      const { getByText } = render(<MealList userId="user-123" onAddMeal={mockOnAddMeal} />);

      expect(getByText('Agregar Comida')).toBeTruthy();
    });
  });
});
