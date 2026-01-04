import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';

type TranslateFn = (key: string, options?: any) => string;

interface ScannerExperienceProps {
  t: TranslateFn;
  hasPermission: boolean | null;
  showCamera: boolean;
  scanned: boolean;
  manualBarcode: string;
  loading: boolean;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onBarcodeScanned: (event: { type: string; data: string }) => void;
  onManualBarcodeChange: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
}

const renderStatusIndicator = (hasPermission: boolean | null) => {
  if (hasPermission === null) {
    return <Text style={styles.statusText}>📷 Requesting...</Text>;
  }
  if (hasPermission === false) {
    return <Text style={[styles.statusText, { color: '#FF3B30' }]}>📷 Permission denied</Text>;
  }
  return <Text style={[styles.statusText, { color: '#34C759' }]}>📷 Ready</Text>;
};

const renderCameraSection = ({
  hasPermission,
  showCamera,
  scanned,
  onBarcodeScanned,
  onStartCamera,
  onStopCamera,
}: {
  hasPermission: boolean | null;
  showCamera: boolean;
  scanned: boolean;
  onBarcodeScanned: (event: { type: string; data: string }) => void;
  onStartCamera: () => void;
  onStopCamera: () => void;
}) => {
  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : onBarcodeScanned}
          style={styles.camera}
        />
        <View style={styles.scanOverlay}>
          <View style={styles.scanFrame}>
            <Text style={styles.scanText}>Position barcode in frame</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.closeCameraButton} onPress={onStopCamera}>
          <Text style={styles.closeCameraText}>✕ Close Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.cameraPlaceholder}>
      <TouchableOpacity
        style={[styles.cameraButton, hasPermission !== true && styles.buttonDisabled]}
        onPress={onStartCamera}
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
  );
};

export default function ScannerExperience({
  t,
  hasPermission,
  showCamera,
  scanned,
  manualBarcode,
  loading,
  onStartCamera,
  onStopCamera,
  onBarcodeScanned,
  onManualBarcodeChange,
  onSubmit,
  onReset,
}: ScannerExperienceProps) {
  return (
    <>
      <View style={styles.statusIndicator}>
        {renderStatusIndicator(hasPermission)}
      </View>

      <View style={styles.cameraSection}>
        {renderCameraSection({
          hasPermission,
          showCamera,
          scanned,
          onBarcodeScanned,
          onStartCamera,
          onStopCamera,
        })}
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.inputTitle}>{t('scanner.input.title')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('scanner.input.placeholder')}
          value={manualBarcode}
          onChangeText={onManualBarcodeChange}
          keyboardType="numeric"
          maxLength={13}
          editable={!loading}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              (!manualBarcode.trim() || loading) && styles.buttonDisabled,
            ]}
            onPress={onSubmit}
            disabled={!manualBarcode.trim() || loading}
            testID="scanner-submit"
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('scanner.input.lookUp')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={onReset}
            disabled={loading}
            testID="scanner-reset"
          >
            <Text style={styles.secondaryButtonText}>{t('scanner.input.reset')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>🔒 Privacy Protected | 📡 Connected to DietIntel API</Text>
        <Text style={styles.footerSubtext}>Camera processing is local. No images stored.</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  statusIndicator: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 50 : 40,
    left: 5,
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
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
