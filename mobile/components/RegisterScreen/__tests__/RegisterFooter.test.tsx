/**
 * Tests unitarios para RegisterFooter component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RegisterFooter } from '../RegisterFooter';

// Mock de estilos
jest.mock('../../styles/RegisterScreen.styles', () => ({
  registerScreenStyles: {
    footer: { alignItems: 'center', marginTop: 20 },
    loginSection: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    loginText: { color: '#666', fontSize: 14 },
    loginLink: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
    footerText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center' },
  },
}));

describe('RegisterFooter', () => {
  const mockOnLoginPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login section with default text', () => {
    const { getByText } = render(<RegisterFooter />);

    expect(getByText('Already have an account?')).toBeTruthy();
    expect(getByText('Sign In')).toBeTruthy();
  });

  it('renders terms and privacy text', () => {
    const { getByText } = render(<RegisterFooter />);

    expect(getByText('By creating an account, you agree to our Terms of Service and Privacy Policy')).toBeTruthy();
  });

  it('calls onLoginPress when Sign In is pressed', () => {
    const { getByText } = render(<RegisterFooter onLoginPress={mockOnLoginPress} />);

    const signInButton = getByText('Sign In');
    fireEvent.press(signInButton);

    expect(mockOnLoginPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onLoginPress when prop is not provided', () => {
    const { getByText } = render(<RegisterFooter />);

    const signInButton = getByText('Sign In');
    fireEvent.press(signInButton);

    expect(mockOnLoginPress).not.toHaveBeenCalled();
  });

  it('renders correctly without onLoginPress prop', () => {
    const { getByText } = render(<RegisterFooter />);

    expect(getByText('Already have an account?')).toBeTruthy();
    expect(getByText('Sign In')).toBeTruthy();
    expect(getByText('By creating an account, you agree to our Terms of Service and Privacy Policy')).toBeTruthy();
  });
});
