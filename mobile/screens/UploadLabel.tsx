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
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/ApiService';

const { width: screenWidth } = Dimensions.get('window');

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

interface UploadLabelProps {
  onBackPress: () => void;
}

export default function UploadLabel({ onBackPress }: UploadLabelProps) {
  const { t } = useTranslation();
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
        t('permissions.title'),
        t('permissions.cameraRequired')
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
      Alert.alert(t('common.error'), t('upload.errors.pickFailed'));
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
      Alert.alert(t('common.error'), t('upload.errors.photoFailed'));
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

      const response = await apiService.scanNutritionLabel(formData);

      clearInterval(progressInterval);
      setUploadProgress(100);
      setOcrResult(response.data);

      if (response.data.low_confidence) {
        Alert.alert(
          t('upload.results.lowConfidence'),
          t('upload.results.suggestions'),
          [{ text: t('common.ok') }]
        );
      }

    } catch (error) {
      console.error('Upload failed:', error);
      Alert.alert(
        t('upload.errors.uploadFailed'),
        t('upload.errors.processingFailed'),
        [{ text: t('common.ok') }]
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

      const response = await apiService.scanNutritionLabelExternal(formData);

      setOcrResult(response.data);
      Alert.alert(t('upload.results.externalOCR'), t('upload.externalOcrSuccess'));
    } catch (error) {
      console.error('External OCR failed:', error);
      Alert.alert(t('upload.results.externalFailed'), t('upload.externalOcrFailed'));
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
      source: t('upload.manualEditSource'),
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
    Alert.alert(t('common.success'), t('upload.edit.updated'));
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
      <Text style={styles.sectionTitle}>{t('upload.title')}</Text>
      <Text style={styles.subtitle}>{t('upload.subtitle')}</Text>
      
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={takePhoto} testID="upload-take-photo">
          <Text style={styles.primaryButtonText}>{t('upload.takePhoto')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={pickImageFromGallery}
          testID="upload-from-gallery"
        >
          <Text style={styles.secondaryButtonText}>{t('upload.fromGallery')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderImagePreview = () => (
    <View style={styles.imagePreviewSection}>
      <Text style={styles.sectionTitle}>{t('upload.selectedImage')}</Text>
      <Image source={{ uri: selectedImage! }} style={styles.imagePreview} />
      
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.primaryButton, uploading && styles.buttonDisabled]} 
          onPress={uploadImage}
          disabled={uploading}
          testID="upload-scan-label"
        >
          {uploading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.primaryButtonText}>{t('upload.scanLabel')}</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tertiaryButton} onPress={resetSession} testID="upload-retry">
          <Text style={styles.tertiaryButtonText}>{t('upload.retry')}</Text>
        </TouchableOpacity>
      </View>
      
      {uploading && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>{t('upload.processingWithProgress', { progress: uploadProgress })}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} testID="upload-progress-fill" />
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
          {t('upload.ocrResults')} 
          <Text style={[
            styles.confidenceText, 
            { color: ocrResult.confidence >= 0.7 ? '#34C759' : '#FF3B30' }
          ]}>
            {t('upload.confidenceText', { confidence: Math.round(ocrResult.confidence * 100) })}
          </Text>
        </Text>
        
        {ocrResult.low_confidence && (
          <View style={styles.lowConfidenceWarning}>
            <Text style={styles.warningText}>{t('upload.lowConfidenceWarning')}</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.externalOcrButton} 
                onPress={sendToExternalOCR}
                disabled={uploading}
                testID="upload-external-ocr"
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.externalOcrButtonText}>{t('upload.externalOcrButton')}</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.manualEditButton} 
                onPress={handleManualEdit}
                testID="upload-manual-edit"
              >
                <Text style={styles.manualEditButtonText}>{t('upload.manualEditButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {ocrResult.raw_text && (
          <View style={styles.rawTextContainer}>
            <Text style={styles.subSectionTitle}>{t('upload.rawText')}</Text>
            <Text style={styles.rawText}>{ocrResult.raw_text}</Text>
          </View>
        )}

        {ocrResult.nutriments && (
          <View style={styles.nutrimentContainer}>
            <Text style={styles.subSectionTitle}>{t('upload.nutritionFacts')}</Text>
            {Object.entries(ocrResult.nutriments).map(([key, value]) => (
              <View key={key} style={styles.nutrimentRow}>
                <Text style={styles.nutrimentLabel}>
                  {key.replace(/_/g, ' ').replace('g per 100g', 'g').replace('kcal per 100g', 'kcal')}:
                </Text>
                <Text style={[
                  styles.nutrimentValue,
                  value === null && styles.missingValue
                ]}>
                  {value !== null ? value : t('upload.missing')}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.retryButton} onPress={resetSession} testID="upload-start-over">
          <Text style={styles.retryButtonText}>{t('upload.startOver')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderManualEdit = () => {
    if (!showManualEdit) return null;

    return (
      <View style={styles.manualEditSection}>
        <Text style={styles.sectionTitle}>{t('upload.manualCorrection')}</Text>
        <Text style={styles.subtitle}>{t('upload.editValuesBelow')}</Text>
        
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
              placeholder={t('upload.enterValue')}
              placeholderTextColor="#999"
            />
          </View>
        ))}
        
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={saveManualValues} testID="upload-save-values">
            <Text style={styles.primaryButtonText}>{t('upload.saveValues')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.tertiaryButton} 
            onPress={() => setShowManualEdit(false)}
            testID="upload-cancel-manual"
          >
            <Text style={styles.tertiaryButtonText}>{t('upload.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress} testID="upload-back">
          <Text style={styles.backButtonText}>🏠</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{t('upload.headerTitle')}</Text>
          <Text style={styles.headerSubtitle}>{t('upload.headerSubtitle')}</Text>
        </View>
        <View style={styles.headerSpacer} />
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
    width: 60, // Same width as back button to center content
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
