/**
 * Tests unitarios para RegisterButton component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ActivityIndicator, TouchableOpacity } from 'react-native';
import { RegisterButton } from '../RegisterButton';

// Mock de estilos
jest.mock('../../styles/RegisterScreen.styles', () => ({
  registerScreenStyles: {
    registerButton: { paddingVertical: 16, alignItems: 'center' },
    buttonDisabled: { backgroundColor: '#BDC3C7' },
    registerButtonText: { fontSize: 18, fontWeight: '700' },
  },
}));

describe('RegisterButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default text', () => {
    const { getByText } = render(<RegisterButton onPress={mockOnPress} loading={false} />);

    expect(getByText('Create Account')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const { getByText } = render(<RegisterButton onPress={mockOnPress} loading={false} />);

    const button = getByText('Create Account');
    fireEvent.press(button);

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('shows loading state correctly', () => {
    const { queryByText } = render(
      <RegisterButton onPress={mockOnPress} loading={true} />
    );

    // Text should not be visible when loading
    expect(queryByText('Create Account')).toBeNull();
  });

  it('shows text when not loading', () => {
    const { getByText } = render(
      <RegisterButton onPress={mockOnPress} loading={false} />
    );

    expect(getByText('Create Account')).toBeTruthy();
  });

  it('handles disabled state', () => {
    const { getByText } = render(
      <RegisterButton onPress={mockOnPress} loading={false} disabled={true} />
    );

    const button = getByText('Create Account');
    // When disabled, the TouchableOpacity should have disabled=true
    // This is a basic smoke test that the component renders with disabled prop
    expect(button).toBeTruthy();
  });
});
