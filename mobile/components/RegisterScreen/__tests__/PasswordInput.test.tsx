/**
 * Tests unitarios para PasswordInput component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PasswordInput } from '../PasswordInput';

// Mock de estilos
jest.mock('../../styles/RegisterScreen.styles', () => ({
  registerScreenStyles: {
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 16, fontWeight: '600' },
    input: { borderWidth: 2, paddingVertical: 14 },
    inputContainer: { position: 'relative' },
    inputError: { borderColor: '#FF3B30' },
    eyeButton: { position: 'absolute', right: 12, padding: 4 },
    eyeText: { fontSize: 18 },
    errorText: { color: '#FF3B30', fontSize: 12 },
    helperText: { color: '#666', fontSize: 12 },
  },
}));

describe('PasswordInput', () => {
  const mockOnChangeText = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default props', () => {
    const { getByText, getByPlaceholderText } = render(
      <PasswordInput value="" onChangeText={mockOnChangeText} />
    );

    expect(getByText('Password')).toBeTruthy();
    expect(getByPlaceholderText('Enter your password')).toBeTruthy();
  });

  it('displays the provided value', () => {
    const testValue = 'mypassword123';
    const { getByDisplayValue } = render(
      <PasswordInput value={testValue} onChangeText={mockOnChangeText} />
    );

    expect(getByDisplayValue(testValue)).toBeTruthy();
  });

  it('starts with password hidden (secureTextEntry)', () => {
    const { getByPlaceholderText } = render(
      <PasswordInput value="" onChangeText={mockOnChangeText} />
    );

    const input = getByPlaceholderText('Enter your password');
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('toggles password visibility when eye button is pressed', () => {
    const { getByPlaceholderText, getByText } = render(
      <PasswordInput value="password123" onChangeText={mockOnChangeText} />
    );

    const input = getByPlaceholderText('Enter your password');
    const eyeButton = getByText('👁️‍🗨️');

    // Initially hidden
    expect(input.props.secureTextEntry).toBe(true);

    // Press eye button to show
    fireEvent.press(eyeButton);

    // Should now be visible
    expect(input.props.secureTextEntry).toBe(false);
    expect(getByText('👁️')).toBeTruthy();

    // Press again to hide
    fireEvent.press(getByText('👁️'));

    // Should be hidden again
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('calls onChangeText when text changes', () => {
    const { getByPlaceholderText } = render(
      <PasswordInput value="" onChangeText={mockOnChangeText} />
    );

    const input = getByPlaceholderText('Enter your password');
    const newValue = 'newpassword123';

    fireEvent.changeText(input, newValue);

    expect(mockOnChangeText).toHaveBeenCalledWith(newValue);
    expect(mockOnChangeText).toHaveBeenCalledTimes(1);
  });

  it('shows error message when error prop is provided', () => {
    const errorMessage = 'Password too weak';
    const { getByText } = render(
      <PasswordInput
        value="weak"
        onChangeText={mockOnChangeText}
        error={errorMessage}
      />
    );

    expect(getByText(errorMessage)).toBeTruthy();
  });

  it('shows helper text by default', () => {
    const { getByText } = render(
      <PasswordInput value="" onChangeText={mockOnChangeText} />
    );

    expect(getByText('Must be at least 8 characters with uppercase, lowercase, number, and special character')).toBeTruthy();
  });

  it('accepts custom placeholder', () => {
    const customPlaceholder = 'Enter your secure password';
    const { getByPlaceholderText } = render(
      <PasswordInput
        value=""
        onChangeText={mockOnChangeText}
        placeholder={customPlaceholder}
      />
    );

    expect(getByPlaceholderText(customPlaceholder)).toBeTruthy();
  });
});
