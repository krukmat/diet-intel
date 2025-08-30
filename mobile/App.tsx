import React, { useState } from 'react';
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

export default function App() {
  const [manualBarcode, setManualBarcode] = useState('');
  const [loading, setLoading] = useState(false);

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
  };

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🍎 DietIntel</Text>
        <Text style={styles.subtitle}>Nutrition Barcode Scanner</Text>
        <Text style={styles.version}>v1.0 - Android Demo</Text>
      </View>

      {/* Camera Simulation */}
      <View style={styles.cameraSection}>
        <View style={styles.scanFrame}>
          <Text style={styles.cameraIcon}>📷</Text>
          <Text style={styles.cameraText}>Camera Scanner</Text>
          <Text style={styles.demoText}>(Demo Mode)</Text>
        </View>
        
        <Text style={styles.instructionText}>
          Point camera at product barcode
        </Text>

        <View style={styles.exampleContainer}>
          <Text style={styles.exampleTitle}>Try these demo barcodes:</Text>
          <Text style={styles.exampleItem}>• 1234567890123 (Coca Cola)</Text>
          <Text style={styles.exampleItem}>• 7622210081551 (Nutella)</Text>
          <Text style={styles.exampleItem}>• 0000000000000 (Not Found)</Text>
        </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
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
});