import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ApiConfigModal from '../ApiConfigModal';
import { apiService } from '../../services/ApiService';

jest.mock('expo-status-bar', () => ({
  StatusBar: () => 'StatusBar',
}));

jest.mock('../../services/ApiService', () => ({
  apiService: {
    getCurrentEnvironment: jest.fn(),
    switchEnvironment: jest.fn(),
    healthCheck: jest.fn(),
  },
}));

jest.mock('../../config/environments', () => ({
  environments: {
    dev: {
      name: 'Development',
      apiBaseUrl: 'http://dev',
      description: 'Dev env',
    },
    prod: {
      name: 'Production',
      apiBaseUrl: 'https://prod',
    },
  },
  getEnvironmentNames: () => ['dev', 'prod'],
  DEFAULT_ENVIRONMENT: 'dev',
}));

describe('ApiConfigModal', () => {
  const mockOnClose = jest.fn();
  const mockApiService = apiService as jest.Mocked<typeof apiService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiService.getCurrentEnvironment.mockReturnValue({
      name: 'dev',
      config: { name: 'Development', apiBaseUrl: 'http://dev' },
    } as any);
  });

  it('renders current environment info when visible', () => {
    const { getByText, getAllByText } = render(
      <ApiConfigModal visible onClose={mockOnClose} />
    );

    expect(getByText('Development')).toBeTruthy();
    expect(getAllByText('http://dev').length).toBeGreaterThan(0);
  });

  it('runs health check for a single environment', async () => {
    mockApiService.healthCheck.mockResolvedValueOnce({
      healthy: true,
      responseTime: 100,
    } as any);

    const { getAllByText, queryByText } = render(
      <ApiConfigModal visible onClose={mockOnClose} />
    );

    fireEvent.press(getAllByText('🔍 Test')[0]);

    await waitFor(() => {
      expect(mockApiService.healthCheck).toHaveBeenCalled();
    });

    expect(queryByText(/ms/)).toBeTruthy();
  });

  it('switches environment after confirmation', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getAllByText } = render(
      <ApiConfigModal visible onClose={mockOnClose} />
    );

    const switchButtons = getAllByText('🔄 Switch');
    fireEvent.press(switchButtons[0]);

    const alertArgs = alertSpy.mock.calls[0];
    const actions = alertArgs[2] as { text: string; onPress?: () => void }[];
    const switchAction = actions.find(action => action.text === 'Switch');
    switchAction?.onPress?.();

    expect(mockApiService.switchEnvironment).toHaveBeenCalledWith('prod');
    alertSpy.mockRestore();
  });

  it('tests all environments sequentially', async () => {
    jest.useFakeTimers();
    mockApiService.healthCheck.mockResolvedValue({ healthy: true } as any);

    const { getByText } = render(
      <ApiConfigModal visible onClose={mockOnClose} />
    );

    fireEvent.press(getByText('🔍 Test All Environments'));

    await waitFor(() => {
      expect(mockApiService.healthCheck).toHaveBeenCalledTimes(1);
    });

    jest.runOnlyPendingTimers();

    await waitFor(() => {
      expect(mockApiService.healthCheck).toHaveBeenCalledTimes(2);
    });
    jest.useRealTimers();
  });
});
