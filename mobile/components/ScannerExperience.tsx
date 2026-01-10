import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';

type TranslateFn = (key: string, options?: any) => string;

interface ScannerExperienceProps {
  t: TranslateFn;
  hasPermission: boolean | null;
  showCamera: boolean;
  scanned: boolean;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onBarcodeScanned: (event: { type: string; data: string }) => void;
}

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
    </View>
  );
};

export default function ScannerExperience({
  t,
  hasPermission,
  showCamera,
  scanned,
  onStartCamera,
  onStopCamera,
  onBarcodeScanned,
}: ScannerExperienceProps) {
  return (
    <>
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

      <View style={styles.footer}>
        <Text style={styles.footerText}>🔒 Privacy Protected | 📡 Connected to DietIntel API</Text>
        <Text style={styles.footerSubtext}>Camera processing is local. No images stored.</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
