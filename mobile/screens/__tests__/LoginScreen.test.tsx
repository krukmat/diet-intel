import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';
import { DEMO_CREDENTIALS } from '../../config/demoCredentials';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

describe('LoginScreen', () => {
  const onLogin = jest.fn();
  const onNavigateToRegister = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits demo credentials', async () => {
    onLogin.mockResolvedValue(undefined);

    const { getByText } = render(
      <LoginScreen
        onLogin={onLogin}
        onNavigateToRegister={onNavigateToRegister}
        isLoading={false}
      />
    );

    fireEvent.press(getByText('Use Demo Account'));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith({
        email: DEMO_CREDENTIALS.email,
        password: DEMO_CREDENTIALS.password,
      });
    });
  });

  it('shows demo login error', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    onLogin.mockRejectedValue(new Error('Demo failed'));

    const { getByText } = render(
      <LoginScreen
        onLogin={onLogin}
        onNavigateToRegister={onNavigateToRegister}
        isLoading={false}
      />
    );

    fireEvent.press(getByText('Use Demo Account'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Demo Login Failed', 'Demo failed');
    });
  });

  it('shows email validation error', () => {
    const { getByPlaceholderText, getByText } = render(
      <LoginScreen
        onLogin={onLogin}
        onNavigateToRegister={onNavigateToRegister}
        isLoading={false}
      />
    );

    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'bad-email');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'pass');

    expect(getByText('Please enter a valid email address')).toBeTruthy();
  });

  it('submits trimmed credentials', async () => {
    onLogin.mockResolvedValue(undefined);

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen
        onLogin={onLogin}
        onNavigateToRegister={onNavigateToRegister}
        isLoading={false}
      />
    );

    fireEvent.changeText(getByPlaceholderText('Enter your email'), ' user@example.com ');
    fireEvent.changeText(getByPlaceholderText('Enter your password'), 'pass');

    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'pass',
      });
    });
  });

  it('navigates to register', () => {
    const { getByText } = render(
      <LoginScreen
        onLogin={onLogin}
        onNavigateToRegister={onNavigateToRegister}
        isLoading={false}
      />
    );

    fireEvent.press(getByText('Create Account'));
    expect(onNavigateToRegister).toHaveBeenCalled();
  });
});
