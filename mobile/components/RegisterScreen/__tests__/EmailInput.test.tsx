/**
 * Tests unitarios para EmailInput component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EmailInput } from '../EmailInput';

// Mock de estilos
jest.mock('../../styles/RegisterScreen.styles', () => ({
  registerScreenStyles: {
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 16, fontWeight: '600' },
    input: { borderWidth: 2, paddingVertical: 14 },
    inputError: { borderColor: '#FF3B30' },
    errorText: { color: '#FF3B30', fontSize: 12 },
  },
}));

describe('EmailInput', () => {
  const mockOnChangeText = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default props', () => {
    const { getByText, getByPlaceholderText } = render(
      <EmailInput value="" onChangeText={mockOnChangeText} />
    );

    expect(getByText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Enter your email')).toBeTruthy();
  });

  it('displays the provided value', () => {
    const testValue = 'test@example.com';
    const { getByDisplayValue } = render(
      <EmailInput value={testValue} onChangeText={mockOnChangeText} />
    );

    expect(getByDisplayValue(testValue)).toBeTruthy();
  });

  it('calls onChangeText when text changes', () => {
    const { getByPlaceholderText } = render(
      <EmailInput value="" onChangeText={mockOnChangeText} />
    );

    const input = getByPlaceholderText('Enter your email');
    const newValue = 'user@test.com';

    fireEvent.changeText(input, newValue);

    expect(mockOnChangeText).toHaveBeenCalledWith(newValue);
    expect(mockOnChangeText).toHaveBeenCalledTimes(1);
  });

  it('shows error message when error prop is provided', () => {
    const errorMessage = 'Invalid email format';
    const { getByText } = render(
      <EmailInput
        value="invalid-email"
        onChangeText={mockOnChangeText}
        error={errorMessage}
      />
    );

    expect(getByText(errorMessage)).toBeTruthy();
  });

  it('does not show error message when no error', () => {
    const { queryByText } = render(
      <EmailInput value="valid@email.com" onChangeText={mockOnChangeText} />
    );

    expect(queryByText(/error|invalid/i)).toBeNull();
  });

  it('disables input when disabled prop is true', () => {
    const { getByPlaceholderText } = render(
      <EmailInput
        value="test@example.com"
        onChangeText={mockOnChangeText}
        disabled={true}
      />
    );

    const input = getByPlaceholderText('Enter your email');
    expect(input.props.editable).toBe(false);
  });

  it('enables input when disabled prop is false or undefined', () => {
    const { getByPlaceholderText } = render(
      <EmailInput value="test@example.com" onChangeText={mockOnChangeText} />
    );

    const input = getByPlaceholderText('Enter your email');
    expect(input.props.editable).toBe(true);
  });

  it('has correct keyboard type for email', () => {
    const { getByPlaceholderText } = render(
      <EmailInput value="" onChangeText={mockOnChangeText} />
    );

    const input = getByPlaceholderText('Enter your email');
    expect(input.props.keyboardType).toBe('email-address');
  });
});
