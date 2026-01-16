/**
 * Tests unitarios para ActionsSection component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ActionsSection } from '../ActionsSection';

describe('ActionsSection', () => {
  const mockOnAddToPlan = jest.fn();

  it('renders add to plan button when showAddToPlan is true', () => {
    const { getByText } = render(
      <ActionsSection
        showAddToPlan={true}
        addingToPlan={false}
        barcode="123456789012"
        onAddToPlan={mockOnAddToPlan}
      />
    );
    expect(getByText('🍽️ Add to Meal Plan')).toBeTruthy();
  });

  it('does not render when showAddToPlan is false', () => {
    const { queryByText } = render(
      <ActionsSection
        showAddToPlan={false}
        addingToPlan={false}
        barcode="123456789012"
        onAddToPlan={mockOnAddToPlan}
      />
    );
    expect(queryByText('🍽️ Add to Meal Plan')).toBeNull();
  });

  it('shows loading indicator when addingToPlan is true', () => {
    const { queryByText } = render(
      <ActionsSection
        showAddToPlan={true}
        addingToPlan={true}
        barcode="123456789012"
        onAddToPlan={mockOnAddToPlan}
      />
    );
    // Loading state - text should not be visible
    expect(queryByText('🍽️ Add to Meal Plan')).toBeNull();
  });

  it('calls onAddToPlan when button pressed', () => {
    const { getByText } = render(
      <ActionsSection
        showAddToPlan={true}
        addingToPlan={false}
        barcode="123456789012"
        onAddToPlan={mockOnAddToPlan}
      />
    );
    fireEvent.press(getByText('🍽️ Add to Meal Plan'));
    expect(mockOnAddToPlan).toHaveBeenCalledTimes(1);
  });

  it('renders subtitle text', () => {
    const { getByText } = render(
      <ActionsSection
        showAddToPlan={true}
        addingToPlan={false}
        barcode="123456789012"
        onAddToPlan={mockOnAddToPlan}
      />
    );
    expect(getByText('Will be added to lunch by default')).toBeTruthy();
  });
});
