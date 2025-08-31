import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Platform,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { 
  developerSettingsService, 
  DeveloperConfig, 
  FeatureToggle 
} from '../services/DeveloperSettings';

interface DeveloperSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenApiConfig?: () => void;
}

export default function DeveloperSettingsModal({ 
  visible, 
  onClose, 
  onOpenApiConfig 
}: DeveloperSettingsModalProps) {
  const [developerConfig, setDeveloperConfig] = useState<DeveloperConfig | null>(null);
  const [featureToggles, setFeatureToggles] = useState<FeatureToggle | null>(null);
  const [secretInput, setSecretInput] = useState('');
  const [showSecretInput, setShowSecretInput] = useState(false);

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  useEffect(() => {
    const unsubscribeConfig = developerSettingsService.subscribeToConfigChanges(setDeveloperConfig);
    const unsubscribeFeatures = developerSettingsService.subscribeToFeatureChanges(setFeatureToggles);

    return () => {
      unsubscribeConfig();
      unsubscribeFeatures();
    };
  }, []);

  const loadSettings = () => {
    setDeveloperConfig(developerSettingsService.getDeveloperConfig());
    setFeatureToggles(developerSettingsService.getFeatureToggles());
  };

  const handleDeveloperConfigChange = async (key: keyof DeveloperConfig, value: boolean) => {
    await developerSettingsService.updateDeveloperConfig({ [key]: value });
  };

  const handleFeatureToggle = async (feature: keyof FeatureToggle, enabled: boolean) => {
    await developerSettingsService.updateFeatureToggle(feature, enabled);
  };

  const handleSecretInputSubmit = async () => {
    const success = await developerSettingsService.trySecretGesture(secretInput);
    if (success) {
      Alert.alert(
        '🔓 Developer Mode Enabled',
        'You now have access to developer features and API configuration.',
        [{ text: 'OK' }]
      );
      setSecretInput('');
      setShowSecretInput(false);
    } else {
      Alert.alert('❌ Invalid Code', 'The secret code is incorrect.');
      setSecretInput('');
    }
  };

  const handleResetSettings = () => {
    Alert.alert(
      '⚠️ Reset All Settings',
      'This will reset all developer settings and feature toggles to default values. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await developerSettingsService.resetToDefaults();
            Alert.alert('✅ Settings Reset', 'All settings have been reset to defaults.');
          }
        },
      ]
    );
  };

  const handleDisableDeveloperMode = () => {
    Alert.alert(
      '🔒 Disable Developer Mode',
      'This will hide all developer features. You will need the secret code to re-enable.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            await developerSettingsService.disableDeveloperMode();
            onClose();
          }
        },
      ]
    );
  };

  const exportDebugInfo = () => {
    const debugInfo = developerSettingsService.getDebugInfo();
    Alert.alert(
      '🐛 Debug Information',
      JSON.stringify(debugInfo, null, 2),
      [{ text: 'OK' }]
    );
  };

  if (!developerConfig || !featureToggles) {
    return null;
  }

  const isDeveloperModeEnabled = developerConfig.isDeveloperModeEnabled;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <ExpoStatusBar style="light" backgroundColor="#6B46C1" />
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <Text style={styles.backButtonText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>👨‍💻 Developer Settings</Text>
            <Text style={styles.subtitle}>
              {isDeveloperModeEnabled ? 'Developer Mode Active' : 'Developer Mode Disabled'}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {!isDeveloperModeEnabled ? (
            <View style={styles.authSection}>
              <Text style={styles.sectionTitle}>🔒 Authentication Required</Text>
              <Text style={styles.authDescription}>
                Developer mode is currently disabled. Enter the secret code to enable developer features.
              </Text>
              
              {!showSecretInput ? (
                <TouchableOpacity
                  style={styles.enableButton}
                  onPress={() => setShowSecretInput(true)}
                >
                  <Text style={styles.enableButtonText}>🔓 Enable Developer Mode</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.secretInputContainer}>
                  <TextInput
                    style={styles.secretInput}
                    placeholder="Enter secret code"
                    value={secretInput}
                    onChangeText={setSecretInput}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <View style={styles.secretButtonRow}>
                    <TouchableOpacity
                      style={styles.secretSubmitButton}
                      onPress={handleSecretInputSubmit}
                    >
                      <Text style={styles.secretSubmitButtonText}>Submit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secretCancelButton}
                      onPress={() => {
                        setShowSecretInput(false);
                        setSecretInput('');
                      }}
                    >
                      <Text style={styles.secretCancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <>
              {/* Developer Configuration */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⚙️ Developer Configuration</Text>
                
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>API Configuration Access</Text>
                    <Text style={styles.settingDescription}>Show API configuration settings</Text>
                  </View>
                  <Switch
                    value={developerConfig.showApiConfiguration}
                    onValueChange={(value) => handleDeveloperConfigChange('showApiConfiguration', value)}
                  />
                </View>

                {developerConfig.showApiConfiguration && onOpenApiConfig && (
                  <TouchableOpacity style={styles.apiConfigButton} onPress={onOpenApiConfig}>
                    <Text style={styles.apiConfigButtonText}>🔧 Open API Configuration</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Debug Features</Text>
                    <Text style={styles.settingDescription}>Enable debug logging and tools</Text>
                  </View>
                  <Switch
                    value={developerConfig.showDebugFeatures}
                    onValueChange={(value) => handleDeveloperConfigChange('showDebugFeatures', value)}
                  />
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Advanced Logging</Text>
                    <Text style={styles.settingDescription}>Enable detailed console logging</Text>
                  </View>
                  <Switch
                    value={developerConfig.showAdvancedLogging}
                    onValueChange={(value) => handleDeveloperConfigChange('showAdvancedLogging', value)}
                  />
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Performance Metrics</Text>
                    <Text style={styles.settingDescription}>Show performance monitoring</Text>
                  </View>
                  <Switch
                    value={developerConfig.showPerformanceMetrics}
                    onValueChange={(value) => handleDeveloperConfigChange('showPerformanceMetrics', value)}
                  />
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Beta Features</Text>
                    <Text style={styles.settingDescription}>Enable experimental features</Text>
                  </View>
                  <Switch
                    value={developerConfig.enableBetaFeatures}
                    onValueChange={(value) => handleDeveloperConfigChange('enableBetaFeatures', value)}
                  />
                </View>
              </View>

              {/* Feature Toggles */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎛️ Feature Toggles</Text>
                <Text style={styles.sectionDescription}>
                  Control which features are visible to end users
                </Text>

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Upload Label Feature</Text>
                    <Text style={styles.settingDescription}>OCR nutrition label scanning</Text>
                  </View>
                  <Switch
                    value={featureToggles.uploadLabelFeature}
                    onValueChange={(value) => handleFeatureToggle('uploadLabelFeature', value)}
                  />
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Meal Plan Feature</Text>
                    <Text style={styles.settingDescription}>AI-powered meal planning</Text>
                  </View>
                  <Switch
                    value={featureToggles.mealPlanFeature}
                    onValueChange={(value) => handleFeatureToggle('mealPlanFeature', value)}
                  />
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Tracking Feature</Text>
                    <Text style={styles.settingDescription}>Nutrition tracking dashboard</Text>
                  </View>
                  <Switch
                    value={featureToggles.trackingFeature}
                    onValueChange={(value) => handleFeatureToggle('trackingFeature', value)}
                  />
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Barcode Scanner</Text>
                    <Text style={styles.settingDescription}>Camera barcode scanning</Text>
                  </View>
                  <Switch
                    value={featureToggles.barcodeScanner}
                    onValueChange={(value) => handleFeatureToggle('barcodeScanner', value)}
                  />
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Reminder Notifications</Text>
                    <Text style={styles.settingDescription}>Push notifications and reminders</Text>
                  </View>
                  <Switch
                    value={featureToggles.reminderNotifications}
                    onValueChange={(value) => handleFeatureToggle('reminderNotifications', value)}
                  />
                </View>
              </View>

              {/* Actions */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🛠️ Actions</Text>
                
                <TouchableOpacity style={styles.actionButton} onPress={exportDebugInfo}>
                  <Text style={styles.actionButtonText}>🐛 Export Debug Info</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleResetSettings}>
                  <Text style={styles.actionButtonText}>🔄 Reset All Settings</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.dangerButton} onPress={handleDisableDeveloperMode}>
                  <Text style={styles.dangerButtonText}>🔒 Disable Developer Mode</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>💡 Developer Information</Text>
            <Text style={styles.infoText}>
              • <Text style={styles.bold}>Secret Code:</Text> Contact the development team{'\n'}
              • <Text style={styles.bold}>API Config:</Text> Only visible in developer mode{'\n'}
              • <Text style={styles.bold}>Feature Toggles:</Text> Control end-user feature visibility{'\n'}
              • <Text style={styles.bold}>Debug Tools:</Text> Advanced logging and performance metrics
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#6B46C1',
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 20,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    minWidth: 40,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  authSection: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  authDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  enableButton: {
    backgroundColor: '#6B46C1',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  enableButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  secretInputContainer: {
    marginTop: 10,
  },
  secretInput: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  secretButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secretSubmitButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secretSubmitButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  secretCancelButton: {
    flex: 1,
    backgroundColor: '#6B7280',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secretCancelButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingInfo: {
    flex: 1,
    paddingRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
  },
  apiConfigButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  apiConfigButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#6B7280',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginTop: 15,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
    color: '#333',
  },
});