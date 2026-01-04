import AsyncStorage from '@react-native-async-storage/async-storage';
import { developerSettingsService } from '../DeveloperSettings';

describe('DeveloperSettingsService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await developerSettingsService.resetToDefaults();
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

  it('notifies feature listeners and supports unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = developerSettingsService.subscribeToFeatureChanges(listener);

    await developerSettingsService.updateFeatureToggle('barcodeScanner', false);

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

  it('disables developer mode', async () => {
    await developerSettingsService.disableDeveloperMode();

    expect(developerSettingsService.isDeveloperModeEnabled()).toBe(false);
    expect(developerSettingsService.isApiConfigurationVisible()).toBe(false);
  });

  it('returns debug info', () => {
    const info = developerSettingsService.getDebugInfo();
    expect(info).toHaveProperty('developerConfig');
    expect(info).toHaveProperty('featureToggles');
  });

  it('falls back to defaults when config load fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    await developerSettingsService.initialize();

    expect(developerSettingsService.getDeveloperConfig().isDeveloperModeEnabled).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('falls back to defaults when feature toggles load fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (AsyncStorage.getItem as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('boom'));

    await developerSettingsService.initialize();

    expect(developerSettingsService.getFeatureToggles().trackingFeature).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('logs when save fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('fail'));

    await developerSettingsService.updateDeveloperConfig({ showPerformanceMetrics: true });

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs when saving feature toggles fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('fail'));

    await developerSettingsService.updateFeatureToggle('mealPlanFeature', false);

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
