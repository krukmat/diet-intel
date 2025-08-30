import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import axios from 'axios';

const { width: screenWidth } = Dimensions.get('window');
const API_BASE_URL = 'http://localhost:8000'; // Update this to match your backend

interface OCRResult {
  source: string;
  confidence: number;
  raw_text: string;
  serving_size?: string;
  nutriments?: {
    energy_kcal_per_100g?: number;
    protein_g_per_100g?: number;
    fat_g_per_100g?: number;
    carbs_g_per_100g?: number;
    sugars_g_per_100g?: number;
    salt_g_per_100g?: number;
  };
  partial_parsed?: any;
  low_confidence?: boolean;
  suggest_external_ocr?: boolean;
  scanned_at: string;
}

export default function UploadLabel() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [showManualEdit, setShowManualEdit] = useState(false);
  const [manualValues, setManualValues] = useState({
    energy_kcal_per_100g: '',
    protein_g_per_100g: '',
    fat_g_per_100g: '',
    carbs_g_per_100g: '',
    sugars_g_per_100g: '',
    salt_g_per_100g: '',
  });

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Camera and photo library permissions are required to upload nutrition labels.'
      );
    }
  };

  const compressImage = async (uri: string): Promise<string> => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [
          { resize: { width: 1024 } }, // Resize to max width of 1024px
        ],
        {
          compress: 0.7, // Compress to 70% quality
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      return manipResult.uri;
    } catch (error) {
      console.error('Image compression failed:', error);
      return uri; // Return original URI if compression fails
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const compressedUri = await compressImage(result.assets[0].uri);
        setSelectedImage(compressedUri);
        setOcrResult(null);
        setShowManualEdit(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image from gallery');
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const compressedUri = await compressImage(result.assets[0].uri);
        setSelectedImage(compressedUri);
        setOcrResult(null);
        setShowManualEdit(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadImage = async () => {
    if (!selectedImage) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('image', {
        uri: selectedImage,
        type: 'image/jpeg',
        name: 'nutrition_label.jpg',
      } as any);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await axios.post(`${API_BASE_URL}/product/scan-label`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 seconds timeout
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setOcrResult(response.data);

      if (response.data.low_confidence) {
        Alert.alert(
          'Low Confidence OCR',
          'The OCR scan had low confidence. You can retry with external OCR or edit the values manually.',
          [{ text: 'OK' }]
        );
      }

    } catch (error) {
      console.error('Upload failed:', error);
      Alert.alert(
        'Upload Failed',
        'Failed to process the nutrition label. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const sendToExternalOCR = async () => {
    if (!selectedImage) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: selectedImage,
        type: 'image/jpeg',
        name: 'nutrition_label.jpg',
      } as any);

      const response = await axios.post(`${API_BASE_URL}/product/scan-label-external`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 45000, // Longer timeout for external OCR
      });

      setOcrResult(response.data);
      Alert.alert('External OCR Complete', 'Label processed with external OCR service.');
    } catch (error) {
      console.error('External OCR failed:', error);
      Alert.alert('External OCR Failed', 'External OCR processing failed. Try manual editing instead.');
    } finally {
      setUploading(false);
    }
  };

  const handleManualEdit = () => {
    if (ocrResult?.nutriments) {
      setManualValues({
        energy_kcal_per_100g: ocrResult.nutriments.energy_kcal_per_100g?.toString() || '',
        protein_g_per_100g: ocrResult.nutriments.protein_g_per_100g?.toString() || '',
        fat_g_per_100g: ocrResult.nutriments.fat_g_per_100g?.toString() || '',
        carbs_g_per_100g: ocrResult.nutriments.carbs_g_per_100g?.toString() || '',
        sugars_g_per_100g: ocrResult.nutriments.sugars_g_per_100g?.toString() || '',
        salt_g_per_100g: ocrResult.nutriments.salt_g_per_100g?.toString() || '',
      });
    }
    setShowManualEdit(true);
  };

  const saveManualValues = () => {
    if (!ocrResult) return;

    const updatedResult: OCRResult = {
      ...ocrResult,
      confidence: 1.0,
      source: 'Manual Edit',
      low_confidence: false,
      nutriments: {
        energy_kcal_per_100g: parseFloat(manualValues.energy_kcal_per_100g) || 0,
        protein_g_per_100g: parseFloat(manualValues.protein_g_per_100g) || 0,
        fat_g_per_100g: parseFloat(manualValues.fat_g_per_100g) || 0,
        carbs_g_per_100g: parseFloat(manualValues.carbs_g_per_100g) || 0,
        sugars_g_per_100g: parseFloat(manualValues.sugars_g_per_100g) || 0,
        salt_g_per_100g: parseFloat(manualValues.salt_g_per_100g) || 0,
      },
    };

    setOcrResult(updatedResult);
    setShowManualEdit(false);
    Alert.alert('Success', 'Nutrition values updated successfully!');
  };

  const resetSession = () => {
    setSelectedImage(null);
    setOcrResult(null);
    setShowManualEdit(false);
    setManualValues({
      energy_kcal_per_100g: '',
      protein_g_per_100g: '',
      fat_g_per_100g: '',
      carbs_g_per_100g: '',
      sugars_g_per_100g: '',
      salt_g_per_100g: '',
    });
  };

  const renderImagePicker = () => (
    <View style={styles.imagePickerSection}>
      <Text style={styles.sectionTitle}>Upload Nutrition Label</Text>
      <Text style={styles.subtitle}>Take a photo or select from gallery</Text>
      
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={takePhoto}>
          <Text style={styles.primaryButtonText}>📷 Take Photo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.secondaryButton} onPress={pickImageFromGallery}>
          <Text style={styles.secondaryButtonText}>🖼️ From Gallery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderImagePreview = () => (
    <View style={styles.imagePreviewSection}>
      <Text style={styles.sectionTitle}>Selected Image</Text>
      <Image source={{ uri: selectedImage! }} style={styles.imagePreview} />
      
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.primaryButton, uploading && styles.buttonDisabled]} 
          onPress={uploadImage}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.primaryButtonText}>🔍 Scan Label</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tertiaryButton} onPress={resetSession}>
          <Text style={styles.tertiaryButtonText}>🔄 Retry</Text>
        </TouchableOpacity>
      </View>
      
      {uploading && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>Processing... {uploadProgress}%</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
        </View>
      )}
    </View>
  );

  const renderOCRResults = () => {
    if (!ocrResult) return null;

    return (
      <View style={styles.resultsSection}>
        <Text style={styles.sectionTitle}>
          OCR Results 
          <Text style={[
            styles.confidenceText, 
            { color: ocrResult.confidence >= 0.7 ? '#34C759' : '#FF3B30' }
          ]}>
            ({Math.round(ocrResult.confidence * 100)}% confidence)
          </Text>
        </Text>
        
        {ocrResult.low_confidence && (
          <View style={styles.lowConfidenceWarning}>
            <Text style={styles.warningText}>⚠️ Low confidence scan detected</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.externalOcrButton} 
                onPress={sendToExternalOCR}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.externalOcrButtonText}>🌐 External OCR</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.manualEditButton} 
                onPress={handleManualEdit}
              >
                <Text style={styles.manualEditButtonText}>✏️ Manual Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {ocrResult.raw_text && (
          <View style={styles.rawTextContainer}>
            <Text style={styles.subSectionTitle}>Raw Text:</Text>
            <Text style={styles.rawText}>{ocrResult.raw_text}</Text>
          </View>
        )}

        {ocrResult.nutriments && (
          <View style={styles.nutrimentContainer}>
            <Text style={styles.subSectionTitle}>Nutrition Facts (per 100g):</Text>
            {Object.entries(ocrResult.nutriments).map(([key, value]) => (
              <View key={key} style={styles.nutrimentRow}>
                <Text style={styles.nutrimentLabel}>
                  {key.replace(/_/g, ' ').replace('g per 100g', 'g').replace('kcal per 100g', 'kcal')}:
                </Text>
                <Text style={[
                  styles.nutrimentValue,
                  value === null && styles.missingValue
                ]}>
                  {value !== null ? value : 'Missing'}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.retryButton} onPress={resetSession}>
          <Text style={styles.retryButtonText}>🔄 Start Over</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderManualEdit = () => {
    if (!showManualEdit) return null;

    return (
      <View style={styles.manualEditSection}>
        <Text style={styles.sectionTitle}>Manual Correction</Text>
        <Text style={styles.subtitle}>Edit the nutrition values below</Text>
        
        {Object.entries(manualValues).map(([key, value]) => (
          <View key={key} style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {key.replace(/_/g, ' ').replace('g per 100g', 'g').replace('kcal per 100g', 'kcal')}:
            </Text>
            <TextInput
              style={styles.textInput}
              value={value}
              onChangeText={(text) => setManualValues(prev => ({ ...prev, [key]: text }))}
              keyboardType="numeric"
              placeholder="Enter value"
              placeholderTextColor="#999"
            />
          </View>
        ))}
        
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={saveManualValues}>
            <Text style={styles.primaryButtonText}>💾 Save Values</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.tertiaryButton} 
            onPress={() => setShowManualEdit(false)}
          >
            <Text style={styles.tertiaryButtonText}>✕ Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />
      
      <View style={styles.header}>
        <Text style={styles.title}>🏷️ Upload Nutrition Label</Text>
        <Text style={styles.headerSubtitle}>Scan product labels with OCR</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!selectedImage && renderImagePicker()}
        {selectedImage && !ocrResult && renderImagePreview()}
        {ocrResult && renderOCRResults()}
        {renderManualEdit()}
      </ScrollView>
    </SafeAreaView>
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
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 20,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  imagePickerSection: {
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
  imagePreviewSection: {
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
  resultsSection: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  manualEditSection: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginTop: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  tertiaryButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  externalOcrButton: {
    flex: 1,
    backgroundColor: '#FF9500',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  manualEditButton: {
    flex: 1,
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 15,
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
  tertiaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  externalOcrButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  manualEditButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  retryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 15,
  },
  progressContainer: {
    marginTop: 15,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
  },
  lowConfidenceWarning: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFEAA7',
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  rawTextContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  rawText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  nutrimentContainer: {
    marginBottom: 15,
  },
  nutrimentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8F9FA',
    marginBottom: 5,
    borderRadius: 8,
  },
  nutrimentLabel: {
    fontSize: 14,
    color: '#333',
    textTransform: 'capitalize',
    flex: 1,
  },
  nutrimentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  missingValue: {
    color: '#FF3B30',
    fontStyle: 'italic',
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
  },
});