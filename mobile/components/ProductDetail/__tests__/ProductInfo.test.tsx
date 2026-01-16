/**
 * Tests unitarios para ProductInfo component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { ProductInfo } from '../ProductInfo';

describe('ProductInfo', () => {
  const defaultProps = {
    name: 'Test Product',
    barcode: '123456789012',
    servingSize: '100g'
  };

  it('renders product name', () => {
    const { getByText } = render(<ProductInfo {...defaultProps} />);
    expect(getByText('Test Product')).toBeTruthy();
  });

  it('renders barcode', () => {
    const { getByText } = render(<ProductInfo {...defaultProps} />);
    expect(getByText('123456789012')).toBeTruthy();
  });

  it('renders serving size', () => {
    const { getByText } = render(<ProductInfo {...defaultProps} />);
    expect(getByText('100g')).toBeTruthy();
  });

  it('renders brand when provided', () => {
    const { getByText } = render(<ProductInfo {...defaultProps} brand="Test Brand" />);
    expect(getByText('Test Brand')).toBeTruthy();
  });

  it('does not render brand section when brand not provided', () => {
    const { queryByText } = render(<ProductInfo {...defaultProps} />);
    expect(queryByText('Test Brand')).toBeNull();
  });

  it('renders categories when provided', () => {
    const { getByText } = render(<ProductInfo {...defaultProps} categories="Snacks" />);
    expect(getByText('Snacks')).toBeTruthy();
  });

  it('does not render categories section when categories not provided', () => {
    const { queryByText } = render(<ProductInfo {...defaultProps} />);
    expect(queryByText('Snacks')).toBeNull();
  });

  it('renders all labels correctly', () => {
    const { getByText } = render(<ProductInfo {...defaultProps} />);
    expect(getByText('Barcode:')).toBeTruthy();
    expect(getByText('Serving Size:')).toBeTruthy();
  });
});
