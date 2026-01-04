import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import DeveloperSettingsModal from '../DeveloperSettingsModal';
import { developerSettingsService } from '../../services/DeveloperSettings';

jest.mock('../../services/DeveloperSettings', () => ({
  developerSettingsService: {
    getDeveloperConfig: jest.fn(),
    getFeatureToggles: jest.fn(),
    updateDeveloperConfig: jest.fn(),
    updateFeatureToggle: jest.fn(),
    resetToDefaults: jest.fn(),
    disableDeveloperMode: jest.fn(),
    trySecretGesture: jest.fn(),
    subscribeToConfigChanges: jest.fn(),
    subscribeToFeatureChanges: jest.fn(),
    getDebugInfo: jest.fn(),
  },
}));

const baseConfig = {
  isDeveloperModeEnabled: true,
  showApiConfiguration: true,
  showDebugFeatures: true,
  showAdvancedLogging: false,
  showPerformanceMetrics: true,
  enableBetaFeatures: false,
};

const baseToggles = {
  uploadLabelFeature: true,
  mealPlanFeature: true,
  trackingFeature: true,
  barcodeScanner: false,
  reminderNotifications: false,
  intelligentFlowFeature: false,
};

describe('DeveloperSettingsModal', () => {
  const mockOnClose = jest.fn();
  const mockOnOpenApiConfig = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (developerSettingsService.subscribeToConfigChanges as jest.Mock).mockImplementation(
      (cb: any) => {
        cb(baseConfig);
        return jest.fn();
      }
    );
    (developerSettingsService.subscribeToFeatureChanges as jest.Mock).mockImplementation(
      (cb: any) => {
        cb(baseToggles);
        return jest.fn();
      }
    );
    (developerSettingsService.getDeveloperConfig as jest.Mock).mockReturnValue(baseConfig);
    (developerSettingsService.getFeatureToggles as jest.Mock).mockReturnValue(baseToggles);
  });

  it('renders developer settings when enabled', async () => {
    const { getByText } = render(
      <DeveloperSettingsModal
        visible={true}
        onClose={mockOnClose}
        onOpenApiConfig={mockOnOpenApiConfig}
      />
    );

    await waitFor(() => {
      expect(getByText('👨‍💻 Developer Settings')).toBeTruthy();
      expect(getByText('⚙️ Developer Configuration')).toBeTruthy();
      expect(getByText('🎛️ Feature Toggles')).toBeTruthy();
    });
  });

  it('triggers api config handler when button tapped', async () => {
    const { getByText } = render(
      <DeveloperSettingsModal
        visible={true}
        onClose={mockOnClose}
        onOpenApiConfig={mockOnOpenApiConfig}
      />
    );

    await waitFor(() => {
      fireEvent.press(getByText('🔧 Open API Configuration'));
    });

    expect(mockOnOpenApiConfig).toHaveBeenCalled();
  });

  it('updates developer config via switches', async () => {
    const { getByText, UNSAFE_getAllByProps } = render(
      <DeveloperSettingsModal visible={true} onClose={mockOnClose} />
    );

    await waitFor(() => {
      expect(getByText('API Configuration Access')).toBeTruthy();
    });

    const switches = UNSAFE_getAllByProps({ value: true });
    switches[0].props.onValueChange(false);

    expect(developerSettingsService.updateDeveloperConfig).toHaveBeenCalledWith({
      showApiConfiguration: false,
    });
  });

  it('updates feature toggles via switches', async () => {
    const config = {
      ...baseConfig,
      showApiConfiguration: false,
      showDebugFeatures: false,
      showAdvancedLogging: false,
      showPerformanceMetrics: false,
      enableBetaFeatures: false,
    };
    const toggles = {
      ...baseToggles,
      uploadLabelFeature: true,
      mealPlanFeature: false,
      trackingFeature: false,
      barcodeScanner: false,
      reminderNotifications: false,
      intelligentFlowFeature: false,
    };

    (developerSettingsService.getDeveloperConfig as jest.Mock).mockReturnValue(config);
    (developerSettingsService.getFeatureToggles as jest.Mock).mockReturnValue(toggles);
    (developerSettingsService.subscribeToConfigChanges as jest.Mock).mockImplementation(
      (cb: any) => {
        cb(config);
        return jest.fn();
      }
    );
    (developerSettingsService.subscribeToFeatureChanges as jest.Mock).mockImplementation(
      (cb: any) => {
        cb(toggles);
        return jest.fn();
      }
    );

    const { UNSAFE_getAllByProps } = render(
      <DeveloperSettingsModal visible={true} onClose={mockOnClose} />
    );

    const switches = UNSAFE_getAllByProps({ value: true });
    expect(switches.length).toBeGreaterThan(0);
    switches[0].props.onValueChange(false);
    if ((developerSettingsService.updateFeatureToggle as jest.Mock).mock.calls.length === 0) {
      switches[1]?.props?.onValueChange?.(false);
    }

    expect(developerSettingsService.updateFeatureToggle).toHaveBeenCalledWith(
      'uploadLabelFeature',
      false
    );
  });

  it('handles secret code success', async () => {
    const disabledConfig = { ...baseConfig, isDeveloperModeEnabled: false };
    (developerSettingsService.getDeveloperConfig as jest.Mock).mockReturnValue(disabledConfig);
    (developerSettingsService.subscribeToConfigChanges as jest.Mock).mockImplementation(
      (cb: any) => {
        cb(disabledConfig);
        return jest.fn();
      }
    );
    (developerSettingsService.trySecretGesture as jest.Mock).mockResolvedValue(true);
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByText, getByPlaceholderText } = render(
      <DeveloperSettingsModal visible={true} onClose={mockOnClose} />
    );

    fireEvent.press(getByText('🔓 Enable Developer Mode'));
    fireEvent.changeText(getByPlaceholderText('Enter secret code'), 'secret');
    fireEvent.press(getByText('Submit'));

    await waitFor(() => {
      expect(developerSettingsService.trySecretGesture).toHaveBeenCalledWith('secret');
      expect(alertSpy).toHaveBeenCalledWith(
        '🔓 Developer Mode Enabled',
        'You now have access to developer features and API configuration.',
        [{ text: 'OK' }]
      );
    });

    alertSpy.mockRestore();
  });

  it('handles secret code failure', async () => {
    const disabledConfig = { ...baseConfig, isDeveloperModeEnabled: false };
    (developerSettingsService.getDeveloperConfig as jest.Mock).mockReturnValue(disabledConfig);
    (developerSettingsService.subscribeToConfigChanges as jest.Mock).mockImplementation(
      (cb: any) => {
        cb(disabledConfig);
        return jest.fn();
      }
    );
    (developerSettingsService.trySecretGesture as jest.Mock).mockResolvedValue(false);
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByText, getByPlaceholderText } = render(
      <DeveloperSettingsModal visible={true} onClose={mockOnClose} />
    );

    fireEvent.press(getByText('🔓 Enable Developer Mode'));
    fireEvent.changeText(getByPlaceholderText('Enter secret code'), 'wrong');
    fireEvent.press(getByText('Submit'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('❌ Invalid Code', 'The secret code is incorrect.');
    });

    alertSpy.mockRestore();
  });

  it('handles reset and disable actions', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_, __, buttons) => {
      buttons?.[1]?.onPress?.();
    });

    const { getByText } = render(
      <DeveloperSettingsModal visible={true} onClose={mockOnClose} />
    );

    fireEvent.press(getByText('🔄 Reset All Settings'));
    await waitFor(() => {
      expect(developerSettingsService.resetToDefaults).toHaveBeenCalled();
    });

    fireEvent.press(getByText('🔒 Disable Developer Mode'));
    await waitFor(() => {
      expect(developerSettingsService.disableDeveloperMode).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    alertSpy.mockRestore();
  });
});
