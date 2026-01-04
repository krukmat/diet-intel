import React from 'react';
import { Alert, Switch } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import RegisterScreen from '../RegisterScreen';

jest.mock('expo-status-bar', () => ({
  StatusBar: () => 'StatusBar',
}));

describe('RegisterScreen', () => {
  const mockOnRegister = jest.fn();
  const mockOnNavigateToLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const fillValidForm = (utils: ReturnType<typeof render>) => {
    fireEvent.changeText(utils.getByPlaceholderText('Enter your full name'), 'Alex Doe');
    fireEvent.changeText(utils.getByPlaceholderText('Enter your email'), 'alex@example.com');
    fireEvent.changeText(
      utils.getByPlaceholderText('Enter your password (min 8 characters)'),
      'password123'
    );
    fireEvent.changeText(utils.getByPlaceholderText('Confirm your password'), 'password123');
  };

  it('renders main CTA and navigates to login', () => {
    const { getByText } = render(
      <RegisterScreen
        onRegister={mockOnRegister}
        onNavigateToLogin={mockOnNavigateToLogin}
        isLoading={false}
      />
    );

    fireEvent.press(getByText('Sign In'));
    expect(mockOnNavigateToLogin).toHaveBeenCalledTimes(1);
  });

  it('shows validation alerts for empty or invalid fields', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText, getByPlaceholderText } = render(
      <RegisterScreen
        onRegister={mockOnRegister}
        onNavigateToLogin={mockOnNavigateToLogin}
        isLoading={false}
      />
    );

    fireEvent.press(getByText('Create Account'));
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please enter your full name');

    fireEvent.changeText(getByPlaceholderText('Enter your full name'), 'Alex Doe');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'invalid-email');
    fireEvent.press(getByText('Create Account'));
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please enter a valid email address');

    alertSpy.mockRestore();
  });

  it('validates password length and mismatch', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText, getByPlaceholderText } = render(
      <RegisterScreen
        onRegister={mockOnRegister}
        onNavigateToLogin={mockOnNavigateToLogin}
        isLoading={false}
      />
    );

    fireEvent.changeText(getByPlaceholderText('Enter your full name'), 'Alex Doe');
    fireEvent.changeText(getByPlaceholderText('Enter your email'), 'alex@example.com');
    fireEvent.changeText(
      getByPlaceholderText('Enter your password (min 8 characters)'),
      'short'
    );
    fireEvent.press(getByText('Create Account'));
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Password must be at least 8 characters long');

    fireEvent.changeText(
      getByPlaceholderText('Enter your password (min 8 characters)'),
      'password123'
    );
    fireEvent.changeText(getByPlaceholderText('Confirm your password'), 'password321');
    fireEvent.press(getByText('Create Account'));
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Passwords do not match');

    alertSpy.mockRestore();
  });

  it('submits valid registration data', async () => {
    const { getByText, ...utils } = render(
      <RegisterScreen
        onRegister={mockOnRegister}
        onNavigateToLogin={mockOnNavigateToLogin}
        isLoading={false}
      />
    );

    fillValidForm({ getByText, ...utils } as any);
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(mockOnRegister).toHaveBeenCalledWith({
        full_name: 'Alex Doe',
        email: 'alex@example.com',
        password: 'password123',
      });
    });
  });

  it('includes developer code when enabled', async () => {
    const { getByText, getByPlaceholderText, getByDisplayValue, UNSAFE_getByType } = render(
      <RegisterScreen
        onRegister={mockOnRegister}
        onNavigateToLogin={mockOnNavigateToLogin}
        isLoading={false}
      />
    );

    fillValidForm({ getByText, getByPlaceholderText } as any);

    fireEvent.press(getByText('Show Code'));
    expect(getByDisplayValue('DIETINTEL_DEV_2024')).toBeTruthy();

    const switchControl = UNSAFE_getByType(Switch);
    fireEvent(switchControl, 'valueChange', true);

    fireEvent.changeText(getByPlaceholderText('Enter developer code (optional)'), 'DEV_CODE');
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(mockOnRegister).toHaveBeenCalledWith({
        full_name: 'Alex Doe',
        email: 'alex@example.com',
        password: 'password123',
        developer_code: 'DEV_CODE',
      });
    });
  });

  it('shows registration error alerts', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockOnRegister.mockRejectedValueOnce(new Error('Registration failed'));

    const { getByText, ...utils } = render(
      <RegisterScreen
        onRegister={mockOnRegister}
        onNavigateToLogin={mockOnNavigateToLogin}
        isLoading={false}
      />
    );

    fillValidForm({ getByText, ...utils } as any);
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Registration Failed', 'Registration failed');
    });

    alertSpy.mockRestore();
  });
});
