/**
 * Tests unitarios para ProductHeader component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProductHeader } from '../ProductHeader';

describe('ProductHeader', () => {
  it('renders title correctly', () => {
    const { getByText } = render(<ProductHeader />);
    expect(getByText('📦 Product Details')).toBeTruthy();
  });

  it('renders close button when onClose provided', () => {
    const mockOnClose = jest.fn();
    const { getByText } = render(<ProductHeader onClose={mockOnClose} />);
    expect(getByText('✕')).toBeTruthy();
  });

  it('does not render close button when onClose not provided', () => {
    const { queryByText } = render(<ProductHeader />);
    expect(queryByText('✕')).toBeNull();
  });

  it('calls onClose when close button pressed', () => {
    const mockOnClose = jest.fn();
    const { getByText } = render(<ProductHeader onClose={mockOnClose} />);
    fireEvent.press(getByText('✕'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders source text when source is not Product Database', () => {
    const { getByText } = render(<ProductHeader source="OCR Scan" confidence={0.85} />);
    expect(getByText('Source: OCR Scan (85% confidence)')).toBeTruthy();
  });

  it('does not render source text when source is Product Database', () => {
    const { queryByText } = render(<ProductHeader source="Product Database" />);
    expect(queryByText(/Source:/)).toBeNull();
  });

  it('does not render source text when source is not provided', () => {
    const { queryByText } = render(<ProductHeader />);
    expect(queryByText(/Source:/)).toBeNull();
  });
});
