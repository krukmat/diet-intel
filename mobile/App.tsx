import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Camera } from 'expo-camera';
import UploadLabel from './screens/UploadLabel';

export default function App() {
  const [manualBarcode, setManualBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'scanner' | 'upload'>('scanner');

  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getBarCodeScannerPermissions();
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setShowCamera(false);
    processBarcode(data);
  };

  const processBarcode = async (barcode: string) => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      if (barcode === '1234567890123') {
        Alert.alert(
          '✅ Product Found!',
          'Coca Cola Classic 330ml\nCalories: 139 kcal\nProtein: 0g | Fat: 0g | Carbs: 37g'
        );
      } else if (barcode === '7622210081551') {
        Alert.alert(
          '✅ Product Found!',
          'Nutella 350g\nCalories: 546 kcal\nProtein: 6.3g | Fat: 31g | Carbs: 57g'
        );
      } else {
        Alert.alert(
          '❌ Product Not Found',
          'This product is not in our database.\n\nOptions:\n• Upload Label Photo\n• Manual Entry',
          [{ text: 'OK' }]
        );
      }
    }, 2000);
  };

  const handleSubmit = () => {
    if (manualBarcode.trim()) {
      processBarcode(manualBarcode.trim());
    }
  };

  const resetInput = () => {
    setManualBarcode('');
    setLoading(false);
    setScanned(false);
  };

  const startCamera = () => {
    if (hasPermission === null) {
      Alert.alert('Permission', 'Requesting camera permission...');
      return;
    }
    if (hasPermission === false) {
      Alert.alert('No Permission', 'No access to camera. Please enable camera permissions in your device settings.');
      return;
    }
    setShowCamera(true);
    setScanned(false);
  };

  const stopCamera = () => {
    setShowCamera(false);
  };

  if (currentScreen === 'upload') {
    return <UploadLabel />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🍎 DietIntel</Text>
        <Text style={styles.subtitle}>Nutrition Barcode Scanner</Text>
        <Text style={styles.version}>v1.0 - Android Demo</Text>
      </View>

      {/* Navigation */}
      <View style={styles.navigationSection}>
        <TouchableOpacity 
          style={[styles.navButton, currentScreen === 'scanner' && styles.navButtonActive]}
          onPress={() => setCurrentScreen('scanner')}
        >
          <Text style={[styles.navButtonText, currentScreen === 'scanner' && styles.navButtonTextActive]}>
            📷 Barcode Scanner
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navButton, currentScreen === 'upload' && styles.navButtonActive]}
          onPress={() => setCurrentScreen('upload')}
        >
          <Text style={[styles.navButtonText, currentScreen === 'upload' && styles.navButtonTextActive]}>
            🏷️ Upload Label
          </Text>
        </TouchableOpacity>
      </View>

      {/* Camera Section */}
      <View style={styles.cameraSection}>
        {showCamera ? (
          <View style={styles.cameraContainer}>
            <BarCodeScanner
              onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
              style={styles.camera}
            />
            <View style={styles.scanOverlay}>
              <View style={styles.scanFrame}>
                <Text style={styles.scanText}>Position barcode in frame</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeCameraButton}
              onPress={stopCamera}
            >
              <Text style={styles.closeCameraText}>✕ Close Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraPlaceholder}>
            <View style={styles.scanFrame}>
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={styles.cameraText}>Camera Scanner</Text>
              {hasPermission === null && <Text style={styles.demoText}>(Requesting permission...)</Text>}
              {hasPermission === false && <Text style={styles.errorText}>(Permission denied)</Text>}
              {hasPermission === true && <Text style={styles.successText}>(Ready to scan)</Text>}
            </View>
            
            <TouchableOpacity
              style={[styles.cameraButton, hasPermission !== true && styles.buttonDisabled]}
              onPress={startCamera}
              disabled={hasPermission !== true}
            >
              <Text style={styles.cameraButtonText}>📷 Start Camera</Text>
            </TouchableOpacity>

            <View style={styles.exampleContainer}>
              <Text style={styles.exampleTitle}>Try these demo barcodes:</Text>
              <Text style={styles.exampleItem}>• 1234567890123 (Coca Cola)</Text>
              <Text style={styles.exampleItem}>• 7622210081551 (Nutella)</Text>
              <Text style={styles.exampleItem}>• 0000000000000 (Not Found)</Text>
            </View>
          </View>
        )}
      </View>

      {/* Manual Input */}
      <View style={styles.inputSection}>
        <Text style={styles.inputTitle}>Enter Barcode Manually:</Text>
        
        <TextInput
          style={styles.input}
          placeholder="13-digit barcode number"
          value={manualBarcode}
          onChangeText={setManualBarcode}
          keyboardType="numeric"
          maxLength={13}
          editable={!loading}
        />
        
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, (!manualBarcode.trim() || loading) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!manualBarcode.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.primaryButtonText}>🔍 Look Up</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={resetInput}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>🔄 Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          🔒 Privacy Protected | 📡 Connected to DietIntel API
        </Text>
        <Text style={styles.footerSubtext}>
          Camera processing is local. No images stored.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 30,
  },
  title: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  version: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontStyle: 'italic',
  },
  cameraSection: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeCameraButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeCameraText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  scanFrame: {
    width: 300,
    height: 200,
    borderWidth: 3,
    borderColor: '#007AFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,123,255,0.1)',
    marginBottom: 30,
    padding: 20,
  },
  cameraIcon: {
    fontSize: 80,
    marginBottom: 15,
  },
  cameraText: {
    color: '#007AFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 5,
  },
  demoText: {
    color: '#007AFF',
    fontSize: 14,
    opacity: 0.8,
    fontStyle: 'italic',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  successText: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  scanText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cameraButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 25,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cameraButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    fontWeight: '500',
  },
  exampleContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    maxWidth: 320,
  },
  exampleTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  exampleItem: {
    color: '#4FC3F7',
    fontSize: 13,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginVertical: 3,
  },
  inputSection: {
    backgroundColor: 'white',
    padding: 25,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  inputTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 2,
    borderColor: '#E3F2FD',
    borderRadius: 15,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#F8F9FA',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  buttonDisabled: {
    backgroundColor: '#BDC3C7',
    shadowColor: 'transparent',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    paddingHorizontal: 25,
    paddingVertical: 15,
    alignItems: 'center',
  },
  footerText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  navigationSection: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  navButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  navButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  navButtonTextActive: {
    color: 'white',
  },
});