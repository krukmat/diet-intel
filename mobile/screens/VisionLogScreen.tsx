import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  ScrollView,
} from 'react-native';
import { Camera, CameraCapturedPicture, CameraType } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { ImageUtils } from '../utils/imageUtils';
import { visionLogService } from '../services/VisionLogService';
import VisionAnalysisModal from '../components/VisionAnalysisModal';
import ExerciseSuggestionCard from '../components/ExerciseSuggestionCard';
import type {
  VisionLogResponse,
  VisionLogState,
  ImageProcessingResult,
  UploadVisionRequest,
} from '../types/visionLog';

interface VisionLogScreenProps {
  onBackPress: () => void;
}

const VisionLogScreen: React.FC<VisionLogScreenProps> = ({ onBackPress }) => {
  const { t } = useTranslation();
  const cameraRef = useRef<Camera>(null);

  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<ImageProcessingResult | null>(null);

  const [analysisState, setAnalysisState] = useState<VisionLogState>({
    selectedImage: null,
    isAnalyzing: false,
    analysisResult: null,
    showExerciseSuggestions: false,
    error: null,
  });

  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner'>('lunch');
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  // Request camera permissions on mount
  useEffect(() => {
    const requestCameraPermission = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(status === 'granted');
    };

    requestCameraPermission();
  }, []);

  const handleStartCamera = () => {
    if (cameraPermission === null) {
      Alert.alert(t('vision.camera.requesting', 'Requesting camera permission...'));
      return;
    }

    if (cameraPermission === false) {
      Alert.alert(
        t('vision.camera.permissionDenied.title', 'Camera Permission Required'),
        t('vision.camera.permissionDenied.message', 'Please enable camera permission in settings to take photos.')
      );
      return;
    }

    setShowCamera(true);
  };

  const handleStopCamera = () => {
    setShowCamera(false);
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      const photo: CameraCapturedPicture = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      await processCapturedImage(photo.uri);
      setShowCamera(false);
    } catch (error) {
      console.error('Camera capture error:', error);
      Alert.alert(
        t('vision.camera.captureError.title', 'Capture Failed'),
        t('vision.camera.captureError.message', 'Failed to take photo. Please try again.')
      );
    }
  };

  const processCapturedImage = async (imageUri: string) => {
    try {
      setAnalysisState(prev => ({ ...prev, isAnalyzing: true, error: null }));

      // Process image for vision analysis
      const processed = await ImageUtils.processImageForVision(imageUri);

      // Validate image
      const validation = ImageUtils.validateImageForVision(processed);
      if (!validation.isValid) {
        setAnalysisState(prev => ({
          ...prev,
          isAnalyzing: false,
          error: {
            error: 'INVALID_IMAGE',
            detail: validation.errors.join(', '),
            error_code: 'INVALID_IMAGE',
          },
        }));
        return;
      }

      setSelectedImage(processed.uri);
      setProcessedImage(processed);
      setAnalysisState(prev => ({ ...prev, selectedImage: processed.uri, isAnalyzing: false }));

    } catch (error) {
      console.error('Image processing error:', error);
      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: {
          error: 'IMAGE_PROCESSING_ERROR',
          detail: error instanceof Error ? error.message : 'Unknown processing error',
          error_code: 'IMAGE_PROCESSING_ERROR',
        },
      }));
    }
  };

  const handleAnalyzeFood = async () => {
    if (!processedImage) return;

    try {
      setAnalysisState(prev => ({ ...prev, isAnalyzing: true, error: null }));

      const request: UploadVisionRequest = {
        image: processedImage.base64,
        meal_type: selectedMealType,
      };

      const result = await visionLogService.uploadImageForAnalysis(request);

      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
        analysisResult: result,
        showExerciseSuggestions: result.exercise_suggestions.length > 0,
      }));

      setShowAnalysisModal(true);

    } catch (error: any) {
      console.error('Analysis error:', error);
      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: {
          error: error.response?.data?.error || 'ANALYSIS_FAILED',
          detail: error.response?.data?.detail || 'Analysis failed. Please try again.',
          error_code: error.response?.status?.toString() || 'UNKNOWN_ERROR',
        },
      }));
    }
  };

  const handleRetryAnalysis = () => {
    setAnalysisState(prev => ({ ...prev, error: null }));
  };

  const handleCloseAnalysis = () => {
    setShowAnalysisModal(false);
    setAnalysisState(prev => ({ ...prev, analysisResult: null, showExerciseSuggestions: false }));
    setSelectedImage(null);
    setProcessedImage(null);
  };

  const renderMealTypeSelector = () => (
    <View style={styles.mealTypeContainer}>
      <Text style={styles.sectionTitle}>{t('vision.mealType.title', 'Meal Type')}</Text>
      <View style={styles.mealTypeButtons}>
        {(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => (
          <TouchableOpacity
            key={mealType}
            style={[
              styles.mealTypeButton,
              selectedMealType === mealType && styles.mealTypeButtonSelected,
            ]}
            onPress={() => setSelectedMealType(mealType)}
          >
            <Text
              style={[
                styles.mealTypeButtonText,
                selectedMealType === mealType && styles.mealTypeButtonTextSelected,
              ]}
            >
              {t(`vision.mealType.${mealType}`, mealType)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderCameraView = () => (
    <View style={styles.cameraContainer}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={CameraType.back}
      >
        <View style={styles.cameraOverlay}>
          <View style={styles.captureFrame}>
            <Text style={styles.captureText}>
              {t('vision.camera.instruction', 'Position camera and take photo')}
            </Text>
          </View>
        </View>

        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={handleTakePhoto}
            testID="vision-take-photo"
          >
            <Text style={styles.cameraButtonText}>📸 {t('vision.camera.takePhoto', 'Take Photo')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleStopCamera}
          >
            <Text style={styles.cancelButtonText}>{t('common.cancel', 'Cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Camera>
    </View>
  );

  const renderImagePreview = () => (
    <View style={styles.previewContainer}>
      {selectedImage && (
        <View style={styles.imagePreview}>
          <View style={styles.imageHeader}>
            <Text style={styles.previewTitle}>
              {t('vision.preview.title', 'Food Preview')}
            </Text>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={() => {
                setSelectedImage(null);
                setProcessedImage(null);
                setShowCamera(true);
              }}
            >
              <Text style={styles.retakeButtonText}>
                {t('vision.preview.retake', 'Retake')}
              </Text>
            </TouchableOpacity>
          </View>

          {renderMealTypeSelector()}

          {analysisState.isAnalyzing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>
                {t('vision.analysis.loading', 'Analyzing...')}
              </Text>
            </View>
          ) : (
            <View style={styles.analyzeContainer}>
              <TouchableOpacity
                style={styles.analyzeButton}
                onPress={handleAnalyzeFood}
                testID="vision-analyze"
              >
                <Text style={styles.analyzeButtonText}>
                  🍽️ {t('vision.analysis.analyze', 'Analyze Food')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {analysisState.error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>
                {t('vision.error.title', 'Analysis Failed')}
              </Text>
              <Text style={styles.errorMessage}>{analysisState.error.detail}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetryAnalysis}
              >
                <Text style={styles.retryButtonText}>
                  {t('vision.error.retry', 'Try Again')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderMainContent = () => (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>← {t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('vision.title', 'Food Vision')}</Text>
      </View>

      {!showCamera && !selectedImage && (
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>
            {t('vision.welcome.title', 'Take a Photo of Your Meal')}
          </Text>
          <Text style={styles.welcomeDescription}>
            {t('vision.welcome.description', 'Automatically analyze nutritional content and get personalized exercise suggestions')}
          </Text>

          <TouchableOpacity
            style={[styles.startButton, cameraPermission === false && styles.buttonDisabled]}
            onPress={handleStartCamera}
            disabled={cameraPermission === false}
            testID="vision-start-camera"
          >
            <Text style={styles.startButtonText}>
              📷 {t('vision.start', 'Start Camera')}
            </Text>
          </TouchableOpacity>

          {cameraPermission === false && (
            <Text style={styles.permissionNote}>
              {t('vision.permission.note', 'Camera permission is required to analyze food photos')}
            </Text>
          )}
        </View>
      )}

      {showCamera && renderCameraView()}
      {selectedImage && renderImagePreview()}

      {analysisState.analysisResult && (
        <VisionAnalysisModal
          visible={showAnalysisModal}
          analysis={analysisState.analysisResult}
          onClose={handleCloseAnalysis}
          onRetry={handleRetryAnalysis}
        />
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {renderMainContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContainer: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  welcomeDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  startButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#BDC3C7',
    shadowColor: 'transparent',
  },
  permissionNote: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 15,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureFrame: {
    width: 280,
    height: 200,
    borderWidth: 3,
    borderColor: '#007AFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,123,255,0.1)',
  },
  captureText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cameraButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 25,
    marginHorizontal: 10,
  },
  cameraButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  imagePreview: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  imageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  retakeButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 15,
  },
  retakeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  mealTypeContainer: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  mealTypeButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  mealTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  mealTypeButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  mealTypeButtonText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  mealTypeButtonTextSelected: {
    color: 'white',
  },
  analyzeContainer: {
    alignItems: 'center',
  },
  analyzeButton: {
    backgroundColor: '#34C759',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  analyzeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default VisionLogScreen;
