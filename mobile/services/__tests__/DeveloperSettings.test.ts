import AsyncStorage from '@react-native-async-storage/async-storage';
import { developerSettingsService } from '../DeveloperSettings';

describe('DeveloperSettingsService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('initializes with defaults when no stored config', async () => {
    await developerSettingsService.initialize();
    const config = developerSettingsService.getDeveloperConfig();
    expect(config.isDeveloperModeEnabled).toBe(true);
  });

  it('updates developer config and toggles', async () => {
    await developerSettingsService.updateDeveloperConfig({ showAdvancedLogging: true });
    const config = developerSettingsService.getDeveloperConfig();
    expect(config.showAdvancedLogging).toBe(true);

    await developerSettingsService.updateFeatureToggle('intelligentFlowFeature', true);
    expect(developerSettingsService.isFeatureEnabled('intelligentFlowFeature')).toBe(true);
  });

  it('updates multiple feature toggles', async () => {
    await developerSettingsService.updateMultipleFeatureToggles({
      barcodeScanner: false,
      reminderNotifications: false,
    });
    const toggles = developerSettingsService.getFeatureToggles();
    expect(toggles.barcodeScanner).toBe(false);
    expect(toggles.reminderNotifications).toBe(false);
  });

  it('notifies listeners and supports unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = developerSettingsService.subscribeToConfigChanges(listener);
    await developerSettingsService.enableDeveloperMode();
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('handles secret gesture', async () => {
    const success = await developerSettingsService.trySecretGesture('DIETINTEL_DEV_2024');
    const fail = await developerSettingsService.trySecretGesture('BAD');
    expect(success).toBe(true);
    expect(fail).toBe(false);
  });

  it('resets to defaults', async () => {
    await developerSettingsService.updateDeveloperConfig({ showDebugFeatures: false });
    await developerSettingsService.resetToDefaults();
    const config = developerSettingsService.getDeveloperConfig();
    expect(config.showDebugFeatures).toBe(true);
  });

  it('returns debug info', () => {
    const info = developerSettingsService.getDebugInfo();
    expect(info).toHaveProperty('developerConfig');
    expect(info).toHaveProperty('featureToggles');
  });
});
