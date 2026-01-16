/**
 * Tests unitarios para NutritionSection component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { NutritionSection } from '../NutritionSection';

describe('NutritionSection', () => {
  const mockNutriments = {
    energy: 250,
    protein: 10,
    fat: 5,
    carbs: 30,
    sugars: 15,
    salt: 1.2,
    fiber: 3,
    sodium: 480
  };

  it('renders section title', () => {
    const { getByText } = render(<NutritionSection nutriments={mockNutriments} />);
    expect(getByText('Nutrition Facts (per 100g)')).toBeTruthy();
  });

  it('renders energy value', () => {
    const { getByText } = render(<NutritionSection nutriments={mockNutriments} />);
    expect(getByText('250.0')).toBeTruthy();
    expect(getByText('kcal')).toBeTruthy();
  });

  it('renders protein value', () => {
    const { getByText } = render(<NutritionSection nutriments={mockNutriments} />);
    expect(getByText('10.0')).toBeTruthy();
  });

  it('renders fat value', () => {
    const { getByText } = render(<NutritionSection nutriments={mockNutriments} />);
    expect(getByText('5.0')).toBeTruthy();
  });

  it('renders carbs value', () => {
    const { getByText } = render(<NutritionSection nutriments={mockNutriments} />);
    expect(getByText('30.0')).toBeTruthy();
  });

  it('renders fiber when > 0', () => {
    const { getByText } = render(<NutritionSection nutriments={mockNutriments} />);
    expect(getByText('3.0')).toBeTruthy();
  });

  it('renders sodium when > 0', () => {
    const { getByText } = render(<NutritionSection nutriments={mockNutriments} />);
    expect(getByText('480.0')).toBeTruthy();
    expect(getByText('mg')).toBeTruthy();
  });

  it('does not render zero values', () => {
    const zeroNutriments = {
      energy: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      sugars: 0,
      salt: 0,
      fiber: 0,
      sodium: 0
    };
    const { queryByText } = render(<NutritionSection nutriments={zeroNutriments} />);
    expect(queryByText('0.0')).toBeNull();
  });

  it('renders labels correctly', () => {
    const { getByText } = render(<NutritionSection nutriments={mockNutriments} />);
    expect(getByText('Energy')).toBeTruthy();
    expect(getByText('Protein')).toBeTruthy();
    expect(getByText('Fat')).toBeTruthy();
    expect(getByText('Carbohydrates')).toBeTruthy();
  });
});
