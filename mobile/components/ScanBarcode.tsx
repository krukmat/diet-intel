import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar,
  Vibration,
  BackHandler,
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Camera } from 'expo-camera';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { apiHelper } from '../utils/apiHelper';

interface ScanBarcodeProps {
  onScanComplete?: (barcode: string) => void;
}

export const ScanBarcode: React.FC<ScanBarcodeProps> = ({ onScanComplete }) => {
  const navigation = useNavigation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [cameraAvailable, setCameraAvailable] = useState(true);

  useEffect(() => {
    getCameraPermissions();
  }, []);

  // Android-specific: Handle back button
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (loading) {
          return true; // Prevent back during loading
        }
        return false; // Allow default back behavior
      };

      if (Platform.OS === 'android') {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => backHandler.remove();
      }
    }, [loading])
  );

  const getCameraPermissions = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        setCameraAvailable(false);
        setShowManualInput(true);
      }
    } catch (error) {
      console.log('Camera not available, showing manual input');
      setCameraAvailable(false);
      setShowManualInput(true);
    }
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    // Android haptic feedback
    if (Platform.OS === 'android') {
      Vibration.vibrate(100);
    }
    
    setScanned(true);
    processBarcode(data);
  };

  const processBarcode = async (barcode: string) => {
    setLoading(true);
    
    try {
      const product = await apiHelper.getProductByBarcode(barcode);
      
      if (product) {
        navigation.navigate('ProductDetail', { product });
      } else {
        showNotFoundOptions();
      }
    } catch (error: any) {
      if (error.status === 404) {
        showNotFoundOptions();
      } else {
        Alert.alert(
          'Network Error',
          'Unable to look up product. Please check your connection and try again.',
          [{ text: 'OK', onPress: resetScanner }]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const showNotFoundOptions = () => {
    Alert.alert(
      'Product Not Found',
      'This product is not in our database. What would you like to do?',
      [
        {
          text: 'Upload Label Photo',
          onPress: () => navigation.navigate('UploadLabel'),
        },
        {
          text: 'Manual Entry',
          onPress: () => navigation.navigate('ManualEntry'),
        },
        {
          text: 'Try Again',
          onPress: resetScanner,
          style: 'cancel',
        },
      ]
    );
  };

  const resetScanner = () => {
    setScanned(false);
    setLoading(false);
  };

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      processBarcode(manualBarcode.trim());
      setManualBarcode('');
    }
  };

  if (hasPermission === null && cameraAvailable) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!cameraAvailable || showManualInput || hasPermission === false) {
    return (
      <View style={styles.container}>
        <View style={styles.manualContainer}>
          <Text style={styles.title}>Enter Barcode Manually</Text>
          <Text style={styles.subtitle}>
            {!cameraAvailable 
              ? 'Camera not available on this device'
              : 'Camera permission is required to scan barcodes'
            }
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="Enter barcode number (EAN/UPC)"
            value={manualBarcode}
            onChangeText={setManualBarcode}
            keyboardType="numeric"
            maxLength={13}
          />
          
          <TouchableOpacity
            style={[styles.button, !manualBarcode.trim() && styles.buttonDisabled]}
            onPress={handleManualSubmit}
            disabled={!manualBarcode.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.buttonText}>Look Up Product</Text>
            )}
          </TouchableOpacity>
          
          {cameraAvailable && hasPermission === false && (
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={getCameraPermissions}
            >
              <Text style={styles.secondaryButtonText}>Enable Camera</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.privacyContainer}>
          <Text style={styles.privacyText}>
            🔒 Your privacy is protected: No photos are shared externally. 
            All data processing happens locally or through our secure API.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Platform.OS === 'android' && (
        <StatusBar barStyle="light-content" backgroundColor="black" />
      )}
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
        barCodeTypes={[
          BarCodeScanner.Constants.BarCodeType.ean13,
          BarCodeScanner.Constants.BarCodeType.ean8,
          BarCodeScanner.Constants.BarCodeType.upc_a,
          BarCodeScanner.Constants.BarCodeType.upc_e,
        ]}
      />
      
      <View style={styles.overlay}>
        <View style={styles.scanArea} />
        
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            Point your camera at a barcode
          </Text>
        </View>
        
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.loadingText}>Looking up product...</Text>
          </View>
        )}
        
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => setShowManualInput(true)}
          >
            <Text style={styles.manualButtonText}>Enter Manually</Text>
          </TouchableOpacity>
          
          {scanned && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetScanner}
            >
              <Text style={styles.resetButtonText}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.privacyContainer}>
          <Text style={styles.privacyText}>
            🔒 Camera feed is processed locally. No images are stored or shared.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  instructionContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  manualButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'white',
  },
  manualButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  resetButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  manualContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
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
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  privacyText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
});