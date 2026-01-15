import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { MealCard } from '../MealCard';
import { MealConsumptionState } from '../../hooks/useMealTracking';

describe('MealCard', () => {
  const mockMealItem = {
    id: 'meal1',
    barcode: '123456789',
    name: 'Grilled Chicken Breast',
    serving: '100g',
    calories: 165,
    macros: {
      protein_g: 31,
      fat_g: 3.6,
      carbs_g: 0,
    },
  };

  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders meal information correctly', () => {
    render(
      <MealCard
        mealItem={mockMealItem}
        onPress={mockOnPress}
      />
    );

    expect(screen.getByText('Grilled Chicken Breast')).toBeTruthy();
    expect(screen.getByText('100g')).toBeTruthy();
    expect(screen.getByText('165 kcal')).toBeTruthy();
    expect(screen.getByText('P: 31g')).toBeTruthy();
    expect(screen.getByText('C: 0g')).toBeTruthy();
    expect(screen.getByText('F: 3.6g')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    render(
      <MealCard
        mealItem={mockMealItem}
        onPress={mockOnPress}
      />
    );

    const card = screen.getByText('Grilled Chicken Breast').parent?.parent;
    fireEvent.press(card!);

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('shows consumed state styling and icon', () => {
    const consumedState: MealConsumptionState = {
      itemId: 'meal1',
      status: 'consumed',
      retryCount: 0,
      consumedAt: new Date(),
    };

    render(
      <MealCard
        mealItem={mockMealItem}
        consumptionState={consumedState}
        onPress={mockOnPress}
      />
    );

    expect(screen.getByText('✅')).toBeTruthy();
    expect(screen.getByText('Consumed')).toBeTruthy();
  });

  it('shows consuming state with activity indicator', () => {
    const consumingState: MealConsumptionState = {
      itemId: 'meal1',
      status: 'consuming',
      retryCount: 0,
    };

    render(
      <MealCard
        mealItem={mockMealItem}
        consumptionState={consumingState}
        onPress={mockOnPress}
      />
    );

    // Check for activity indicator (it might be rendered as a component)
    expect(screen.getByText('Consuming...')).toBeTruthy();
  });

  it('shows failed state styling and error message', () => {
    const failedState: MealConsumptionState = {
      itemId: 'meal1',
      status: 'failed',
      retryCount: 2,
      lastError: 'Network timeout',
    };

    render(
      <MealCard
        mealItem={mockMealItem}
        consumptionState={failedState}
        onPress={mockOnPress}
      />
    );

    expect(screen.getByText('❌')).toBeTruthy();
    expect(screen.getByText('Failed to consume')).toBeTruthy();
    expect(screen.getByText('Network timeout')).toBeTruthy();
  });

  it('shows pending state with retry icon', () => {
    const pendingState: MealConsumptionState = {
      itemId: 'meal1',
      status: 'pending',
      retryCount: 1,
      lastError: 'Retrying in 1000ms... (Connection failed)',
    };

    render(
      <MealCard
        mealItem={mockMealItem}
        consumptionState={pendingState}
        onPress={mockOnPress}
      />
    );

    expect(screen.getByText('🔄')).toBeTruthy();
    expect(screen.getByText('Retrying...')).toBeTruthy();
    expect(screen.getByText('Retrying in 1000ms... (Connection failed)')).toBeTruthy();
  });

  it('renders with disabled prop', () => {
    render(
      <MealCard
        mealItem={mockMealItem}
        onPress={mockOnPress}
        disabled={true}
      />
    );

    // Component should render normally with disabled prop
    expect(screen.getByText('Grilled Chicken Breast')).toBeTruthy();
    expect(screen.getByText('165 kcal')).toBeTruthy();
  });

  it('renders with consuming state', () => {
    const consumingState: MealConsumptionState = {
      itemId: 'meal1',
      status: 'consuming',
      retryCount: 0,
    };

    render(
      <MealCard
        mealItem={mockMealItem}
        consumptionState={consumingState}
        onPress={mockOnPress}
      />
    );

    // Should show consuming state
    expect(screen.getByText('Consuming...')).toBeTruthy();
    expect(screen.getByText('Grilled Chicken Breast')).toBeTruthy();
  });

  it('truncates long meal names', () => {
    const longNameItem = {
      ...mockMealItem,
      name: 'Very Long Meal Name That Should Be Truncated In The UI Display',
    };

    render(
      <MealCard
        mealItem={longNameItem}
        onPress={mockOnPress}
      />
    );

    const nameElement = screen.getByText('Very Long Meal Name That Should Be Truncated In The UI Display');
    expect(nameElement.props.numberOfLines).toBe(1);
  });

  it('handles meal items with optional macros', () => {
    const minimalMacrosItem = {
      ...mockMealItem,
      macros: {
        protein_g: 10,
        fat_g: 5,
        carbs_g: 20,
      },
    };

    render(
      <MealCard
        mealItem={minimalMacrosItem}
        onPress={mockOnPress}
      />
    );

    expect(screen.getByText('P: 10g')).toBeTruthy();
    expect(screen.getByText('C: 20g')).toBeTruthy();
    expect(screen.getByText('F: 5g')).toBeTruthy();
  });

  it('does not show status container when no consumption state', () => {
    render(
      <MealCard
        mealItem={mockMealItem}
        onPress={mockOnPress}
      />
    );

    expect(screen.queryByText('Consumed')).toBeNull();
    expect(screen.queryByText('Consuming...')).toBeNull();
    expect(screen.queryByText('Failed to consume')).toBeNull();
  });

  it('renders with different disabled states', () => {
    const { rerender } = render(
      <MealCard
        mealItem={mockMealItem}
        onPress={mockOnPress}
        disabled={false}
      />
    );

    expect(screen.getByText('Grilled Chicken Breast')).toBeTruthy();

    rerender(
      <MealCard
        mealItem={mockMealItem}
        onPress={mockOnPress}
        disabled={true}
      />
    );

    expect(screen.getByText('Grilled Chicken Breast')).toBeTruthy();
  });
});
