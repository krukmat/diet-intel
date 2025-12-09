import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DeveloperConfig {
  isDeveloperModeEnabled: boolean;
  showApiConfiguration: boolean;
  showDebugFeatures: boolean;
  showAdvancedLogging: boolean;
  showPerformanceMetrics: boolean;
  enableBetaFeatures: boolean;
}

export interface FeatureToggle {
  uploadLabelFeature: boolean;
  mealPlanFeature: boolean;
  trackingFeature: boolean;
  barcodeScanner: boolean;
  reminderNotifications: boolean;
  intelligentFlowFeature: boolean;
}

const DEVELOPER_CONFIG_KEY = '@dietintel_developer_config';
const FEATURE_TOGGLES_KEY = '@dietintel_feature_toggles';

const DEFAULT_DEVELOPER_CONFIG: DeveloperConfig = {
  isDeveloperModeEnabled: true,
  showApiConfiguration: true,
  showDebugFeatures: true,
  showAdvancedLogging: false,
  showPerformanceMetrics: false,
  enableBetaFeatures: false,
};

const DEFAULT_FEATURE_TOGGLES: FeatureToggle = {
  uploadLabelFeature: true,
  mealPlanFeature: true,
  trackingFeature: true,
  barcodeScanner: true,
  reminderNotifications: true,
  intelligentFlowFeature: false,
};

class DeveloperSettingsService {
  private developerConfig: DeveloperConfig = DEFAULT_DEVELOPER_CONFIG;
  private featureToggles: FeatureToggle = DEFAULT_FEATURE_TOGGLES;
  private listeners: Array<(config: DeveloperConfig) => void> = [];
  private featureListeners: Array<(toggles: FeatureToggle) => void> = [];

  async initialize(): Promise<void> {
    try {
      await this.loadDeveloperConfig();
      await this.loadFeatureToggles();
    } catch (error) {
      console.warn('Failed to load developer settings:', error);
    }
  }

  private async loadDeveloperConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(DEVELOPER_CONFIG_KEY);
      if (stored) {
        this.developerConfig = { ...DEFAULT_DEVELOPER_CONFIG, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load developer config:', error);
      this.developerConfig = DEFAULT_DEVELOPER_CONFIG;
    }
  }

  private async loadFeatureToggles(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(FEATURE_TOGGLES_KEY);
      if (stored) {
        this.featureToggles = { ...DEFAULT_FEATURE_TOGGLES, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load feature toggles:', error);
      this.featureToggles = DEFAULT_FEATURE_TOGGLES;
    }
  }

  private async saveDeveloperConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(DEVELOPER_CONFIG_KEY, JSON.stringify(this.developerConfig));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save developer config:', error);
    }
  }

  private async saveFeatureToggles(): Promise<void> {
    try {
      await AsyncStorage.setItem(FEATURE_TOGGLES_KEY, JSON.stringify(this.featureToggles));
      this.notifyFeatureListeners();
    } catch (error) {
      console.error('Failed to save feature toggles:', error);
    }
  }

  getDeveloperConfig(): DeveloperConfig {
    return { ...this.developerConfig };
  }

  getFeatureToggles(): FeatureToggle {
    return { ...this.featureToggles };
  }

  isDeveloperModeEnabled(): boolean {
    return this.developerConfig.isDeveloperModeEnabled;
  }

  isApiConfigurationVisible(): boolean {
    return this.developerConfig.isDeveloperModeEnabled && this.developerConfig.showApiConfiguration;
  }

  isFeatureEnabled(feature: keyof FeatureToggle): boolean {
    return this.featureToggles[feature];
  }

  async enableDeveloperMode(): Promise<void> {
    this.developerConfig = {
      ...this.developerConfig,
      isDeveloperModeEnabled: true,
      showApiConfiguration: true,
      showDebugFeatures: true,
    };
    await this.saveDeveloperConfig();
  }

  async disableDeveloperMode(): Promise<void> {
    this.developerConfig = {
      ...DEFAULT_DEVELOPER_CONFIG,
      isDeveloperModeEnabled: false,
    };
    await this.saveDeveloperConfig();
  }

  async updateDeveloperConfig(updates: Partial<DeveloperConfig>): Promise<void> {
    this.developerConfig = { ...this.developerConfig, ...updates };
    await this.saveDeveloperConfig();
  }

  async updateFeatureToggle(feature: keyof FeatureToggle, enabled: boolean): Promise<void> {
    this.featureToggles = { ...this.featureToggles, [feature]: enabled };
    await this.saveFeatureToggles();
  }

  async updateMultipleFeatureToggles(updates: Partial<FeatureToggle>): Promise<void> {
    this.featureToggles = { ...this.featureToggles, ...updates };
    await this.saveFeatureToggles();
  }

  subscribeToConfigChanges(listener: (config: DeveloperConfig) => void): () => void {
    this.listeners.push(listener);
    listener(this.developerConfig);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  subscribeToFeatureChanges(listener: (toggles: FeatureToggle) => void): () => void {
    this.featureListeners.push(listener);
    listener(this.featureToggles);
    
    return () => {
      const index = this.featureListeners.indexOf(listener);
      if (index > -1) {
        this.featureListeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.developerConfig));
  }

  private notifyFeatureListeners(): void {
    this.featureListeners.forEach(listener => listener(this.featureToggles));
  }

  async resetToDefaults(): Promise<void> {
    this.developerConfig = DEFAULT_DEVELOPER_CONFIG;
    this.featureToggles = DEFAULT_FEATURE_TOGGLES;
    await Promise.all([
      this.saveDeveloperConfig(),
      this.saveFeatureToggles()
    ]);
  }

  // Secret gesture sequence to enable developer mode
  // This would be called when user performs the secret gesture
  async trySecretGesture(sequence: string): Promise<boolean> {
    const SECRET_SEQUENCE = 'DIETINTEL_DEV_2024'; // Secret sequence
    
    if (sequence === SECRET_SEQUENCE) {
      await this.enableDeveloperMode();
      return true;
    }
    
    return false;
  }

  // Generate debug information for developers
  getDebugInfo(): object {
    return {
      developerConfig: this.developerConfig,
      featureToggles: this.featureToggles,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}

export const developerSettingsService = new DeveloperSettingsService();
