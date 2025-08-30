import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

// Mock navigation for demo purposes
const mockNavigation = {
  navigate: (screen: string, params?: any) => {
    Alert.alert('Navigation', `Would navigate to ${screen}`, [
      { text: 'OK' }
    ]);
  }
};

// Simplified ScanBarcode component for demo
const ScanBarcode = () => {
  const [manualBarcode, setManualBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  const processBarcode = async (barcode: string) => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      if (barcode === '1234567890123') {
        // Mock successful product found
        Alert.alert(
          'Product Found!',
          'Coca Cola Classic 330ml\nCalories: 139 kcal',
          [
            { text: 'View Details', onPress: () => mockNavigation.navigate('ProductDetail') }
          ]
        );
      } else {
        // Mock product not found
        Alert.alert(
          'Product Not Found',
          'This product is not in our database. What would you like to do?',
          [
            {
              text: 'Upload Label Photo',
              onPress: () => mockNavigation.navigate('UploadLabel'),
            },
            {
              text: 'Manual Entry',
              onPress: () => mockNavigation.navigate('ManualEntry'),
            },
            {
              text: 'Try Again',
              style: 'cancel',
            },
          ]
        );
      }
    }, 2000);
  };

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      processBarcode(manualBarcode.trim());
      setScanned(true);
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setLoading(false);
    setManualBarcode('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#000" />
      
      <View style={styles.header}>
        <Text style={styles.title}>DietIntel</Text>
        <Text style={styles.subtitle}>Scan Product Barcode</Text>
      </View>

      <View style={styles.cameraPlaceholder}>
        <View style={styles.scanFrame}>
          <Text style={styles.scanFrameText}>📷</Text>
          <Text style={styles.scanFrameSubtext}>Camera View</Text>
        </View>
        
        <Text style={styles.instructionText}>
          Point your camera at a barcode
        </Text>
      </View>

      <View style={styles.manualSection}>
        <Text style={styles.manualTitle}>Or enter barcode manually:</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Enter barcode number (try: 1234567890123)"
          value={manualBarcode}
          onChangeText={setManualBarcode}
          keyboardType="numeric"
          maxLength={13}
          editable={!loading}
        />
        
        <TouchableOpacity
          style={[styles.button, (!manualBarcode.trim() || loading) && styles.buttonDisabled]}
          onPress={handleManualSubmit}
          disabled={!manualBarcode.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.buttonText}>Look Up Product</Text>
          )}
        </TouchableOpacity>

        {scanned && !loading && (
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={resetScanner}
          >
            <Text style={styles.secondaryButtonText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.privacyContainer}>
        <Text style={styles.privacyText}>
          🔒 Your privacy is protected: Camera feed is processed locally. 
          No images are stored or shared externally.
        </Text>
      </View>

      <View style={styles.demoInfo}>
        <Text style={styles.demoInfoText}>
          📱 Demo Mode: Try barcode "1234567890123" for success demo
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  return <ScanBarcode />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    backgroundColor: '#007AFF',
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
  },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  scanFrame: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,123,255,0.1)',
    marginBottom: 20,
  },
  scanFrameText: {
    fontSize: 48,
    marginBottom: 10,
  },
  scanFrameSubtext: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  manualSection: {
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  manualTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  privacyContainer: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  privacyText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  demoInfo: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  demoInfoText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
});