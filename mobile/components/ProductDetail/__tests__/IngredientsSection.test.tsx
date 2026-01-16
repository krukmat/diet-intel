/**
 * Tests unitarios para IngredientsSection component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { IngredientsSection } from '../IngredientsSection';

describe('IngredientsSection', () => {
  it('renders ingredients when provided', () => {
    const ingredients = 'Water, sugar, citric acid';
    const { getByText } = render(<IngredientsSection ingredients={ingredients} />);
    expect(getByText('Ingredients')).toBeTruthy();
    expect(getByText(ingredients)).toBeTruthy();
  });

  it('renders nothing when ingredients not provided', () => {
    const { queryByText } = render(<IngredientsSection />);
    expect(queryByText('Ingredients')).toBeNull();
  });

  it('renders nothing when ingredients is empty string', () => {
    const { queryByText } = render(<IngredientsSection ingredients="" />);
    expect(queryByText('Ingredients')).toBeNull();
  });
});
