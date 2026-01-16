/**
 * Tests unitarios para ConfirmPasswordInput component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConfirmPasswordInput } from '../ConfirmPasswordInput';

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

describe('ConfirmPasswordInput', () => {
  const mockOnChangeText = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default props', () => {
    const { getByText, getByPlaceholderText } = render(
      <ConfirmPasswordInput value="" onChangeText={mockOnChangeText} />
    );

    expect(getByText('Confirm Password')).toBeTruthy();
    expect(getByPlaceholderText('Re-enter your password')).toBeTruthy();
  });

  it('displays the provided value', () => {
    const testValue = 'confirmpassword123';
    const { getByDisplayValue } = render(
      <ConfirmPasswordInput value={testValue} onChangeText={mockOnChangeText} />
    );

    expect(getByDisplayValue(testValue)).toBeTruthy();
  });

  it('calls onChangeText when text changes', () => {
    const { getByPlaceholderText } = render(
      <ConfirmPasswordInput value="" onChangeText={mockOnChangeText} />
    );

    const input = getByPlaceholderText('Re-enter your password');
    const newValue = 'newconfirm123';

    fireEvent.changeText(input, newValue);

    expect(mockOnChangeText).toHaveBeenCalledWith(newValue);
    expect(mockOnChangeText).toHaveBeenCalledTimes(1);
  });

  it('shows error message when error prop is provided', () => {
    const errorMessage = 'Passwords do not match';
    const { getByText } = render(
      <ConfirmPasswordInput
        value="differentpassword"
        onChangeText={mockOnChangeText}
        error={errorMessage}
      />
    );

    expect(getByText(errorMessage)).toBeTruthy();
  });

  it('does not show error message when no error', () => {
    const { queryByText } = render(
      <ConfirmPasswordInput value="matchingpassword" onChangeText={mockOnChangeText} />
    );

    expect(queryByText(/error|match/i)).toBeNull();
  });

  it('is always secure text entry', () => {
    const { getByPlaceholderText } = render(
      <ConfirmPasswordInput value="password123" onChangeText={mockOnChangeText} />
    );

    const input = getByPlaceholderText('Re-enter your password');
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('disables input when disabled prop is true', () => {
    const { getByPlaceholderText } = render(
      <ConfirmPasswordInput
        value="password123"
        onChangeText={mockOnChangeText}
        disabled={true}
      />
    );

    const input = getByPlaceholderText('Re-enter your password');
    expect(input.props.editable).toBe(false);
  });

  it('enables input when disabled prop is false or undefined', () => {
    const { getByPlaceholderText } = render(
      <ConfirmPasswordInput value="password123" onChangeText={mockOnChangeText} />
    );

    const input = getByPlaceholderText('Re-enter your password');
    expect(input.props.editable).toBe(true);
  });
});
