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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { apiService } from '../services/ApiService';
import { environments, getEnvironmentNames, DEFAULT_ENVIRONMENT } from '../config/environments';

interface ApiConfigModalProps {
  visible: boolean;
  onClose: () => void;
}

interface HealthStatus {
  environment: string;
  healthy: boolean;
  responseTime: number;
  error?: string;
}

export default function ApiConfigModal({ visible, onClose }: ApiConfigModalProps) {
  const [currentEnv, setCurrentEnv] = useState<string>(DEFAULT_ENVIRONMENT);
  const [healthStatuses, setHealthStatuses] = useState<Record<string, HealthStatus>>({});
  const [testingHealth, setTestingHealth] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visible) {
      loadCurrentEnvironment();
    }
  }, [visible]);

  const loadCurrentEnvironment = () => {
    const envInfo = apiService.getCurrentEnvironment();
    setCurrentEnv(envInfo.name);
  };

  const testEnvironmentHealth = async (envName: string) => {
    setTestingHealth(prev => ({ ...prev, [envName]: true }));
    
    const startTime = Date.now();
    
    // Temporarily switch to test environment
    const originalEnv = apiService.getCurrentEnvironment().name;
    apiService.switchEnvironment(envName);
    
    try {
      const healthResult = await apiService.healthCheck();
      const responseTime = Date.now() - startTime;
      
      setHealthStatuses(prev => ({
        ...prev,
        [envName]: {
          environment: envName,
          healthy: healthResult.healthy,
          responseTime,
          error: healthResult.error,
        },
      }));
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      setHealthStatuses(prev => ({
        ...prev,
        [envName]: {
          environment: envName,
          healthy: false,
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }));
    } finally {
      // Switch back to original environment
      apiService.switchEnvironment(originalEnv);
      setTestingHealth(prev => ({ ...prev, [envName]: false }));
    }
  };

  const testAllEnvironments = async () => {
    const envNames = getEnvironmentNames();
    for (const envName of envNames) {
      await testEnvironmentHealth(envName);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const switchEnvironment = (envName: string) => {
    Alert.alert(
      'Switch Environment?',
      `Are you sure you want to switch to ${environments[envName].name}?\n\nURL: ${environments[envName].apiBaseUrl}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Switch', 
          onPress: () => {
            apiService.switchEnvironment(envName);
            setCurrentEnv(envName);
            Alert.alert('Environment Switched', `Now using: ${environments[envName].name}`);
          }
        },
      ]
    );
  };

  const renderEnvironmentCard = (envName: string) => {
    const env = environments[envName];
    const status = healthStatuses[envName];
    const isTesting = testingHealth[envName];
    const isCurrent = envName === currentEnv;

    return (
      <View key={envName} style={[styles.envCard, isCurrent && styles.currentEnvCard]}>
        <View style={styles.envHeader}>
          <View style={styles.envInfo}>
            <Text style={[styles.envName, isCurrent && styles.currentEnvText]}>
              {env.name} {isCurrent && '(Current)'}
            </Text>
            <Text style={styles.envUrl}>{env.apiBaseUrl}</Text>
            {env.description && (
              <Text style={styles.envDescription}>{env.description}</Text>
            )}
          </View>
          
          {status && (
            <View style={styles.statusIndicator}>
              <View style={[
                styles.statusDot,
                { backgroundColor: status.healthy ? '#34C759' : '#FF3B30' }
              ]} />
              <Text style={styles.responseTime}>{status.responseTime}ms</Text>
            </View>
          )}
        </View>

        {status?.error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>❌ {status.error}</Text>
          </View>
        )}

        <View style={styles.envActions}>
          <TouchableOpacity
            style={[styles.testButton, isTesting && styles.testingButton]}
            onPress={() => testEnvironmentHealth(envName)}
            disabled={isTesting}
          >
            {isTesting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.testButtonText}>🔍 Test</Text>
            )}
          </TouchableOpacity>

          {!isCurrent && (
            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => switchEnvironment(envName)}
            >
              <Text style={styles.switchButtonText}>🔄 Switch</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <ExpoStatusBar style="light" backgroundColor="#007AFF" />
        
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <Text style={styles.backButtonText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>⚙️ API Configuration</Text>
            <Text style={styles.subtitle}>Environment & Health Status</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.currentSection}>
            <Text style={styles.sectionTitle}>Current Configuration</Text>
            <View style={styles.currentEnvInfo}>
              <Text style={styles.currentEnvName}>{environments[currentEnv].name}</Text>
              <Text style={styles.currentEnvUrl}>{environments[currentEnv].apiBaseUrl}</Text>
              {environments[currentEnv].description && (
                <Text style={styles.currentEnvDesc}>{environments[currentEnv].description}</Text>
              )}
            </View>
          </View>

          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={styles.testAllButton}
              onPress={testAllEnvironments}
              disabled={Object.values(testingHealth).some(Boolean)}
            >
              <Text style={styles.testAllButtonText}>🔍 Test All Environments</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.environmentsSection}>
            <Text style={styles.sectionTitle}>Available Environments</Text>
            {getEnvironmentNames().map(renderEnvironmentCard)}
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>💡 Quick Setup Guide</Text>
            <Text style={styles.infoText}>
              • <Text style={styles.bold}>Development:</Text> Use 'android_dev' for Android emulator or 'dev' for iOS simulator{'\n'}
              • <Text style={styles.bold}>Testing:</Text> Use 'staging' or 'qa' environments{'\n'}
              • <Text style={styles.bold}>Production:</Text> Use regional production servers{'\n'}
              • <Text style={styles.bold}>Health Check:</Text> Tests /health endpoint with 5s timeout
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
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#007AFF',
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
  currentSection: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  currentEnvInfo: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  currentEnvName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 5,
  },
  currentEnvUrl: {
    fontSize: 14,
    color: '#333',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginBottom: 5,
  },
  currentEnvDesc: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  actionsSection: {
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
  testAllButton: {
    backgroundColor: '#34C759',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  testAllButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  environmentsSection: {
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
  envCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    backgroundColor: '#FAFAFA',
  },
  currentEnvCard: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  envHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  envInfo: {
    flex: 1,
  },
  envName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  currentEnvText: {
    color: '#007AFF',
  },
  envUrl: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginBottom: 3,
  },
  envDescription: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  statusIndicator: {
    alignItems: 'center',
    marginLeft: 10,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 5,
  },
  responseTime: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 12,
  },
  envActions: {
    flexDirection: 'row',
    gap: 10,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#FF9500',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  testingButton: {
    backgroundColor: '#BDC3C7',
  },
  testButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  switchButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  switchButtonText: {
    color: 'white',
    fontSize: 14,
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