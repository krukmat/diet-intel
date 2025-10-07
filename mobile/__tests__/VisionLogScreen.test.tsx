import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import VisionLogScreen from '../screens/VisionLogScreen';
import { ImageUtils } from '../utils/imageUtils';
import { visionLogService } from '../services/VisionLogService';

// Mock the dependencies
jest.mock('../utils/imageUtils');
jest.mock('../services/VisionLogService');
jest.mock('../components/VisionAnalysisModal', () => 'VisionAnalysisModal');
jest.mock('../components/ExerciseSuggestionCard', () => 'ExerciseSuggestionCard');

// Override expo-camera for these specific tests to handle permission timing
jest.mock('expo-camera', () => {
  const React = require('react');
  const mockComponent = (name: string) =>
    React.forwardRef((props: any, ref: any) => React.createElement('div', {
      ...props,
      'data-testid': props.testID || name.toLowerCase(),
      ref
    }, props.children));

  // Mock Camera component with static methods
  const CameraComponent = mockComponent('Camera');
  CameraComponent.requestCameraPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
  CameraComponent.Constants = {
    BarCodeType: 'org.iso.Code128',
    Type: { front: 'front', back: 'back' },
  };

  return {
    __esModule: true,
    Camera: CameraComponent,
    CameraCapturedPicture: {},
    requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    Constants: {
      BarCodeType: 'org.iso.Code128',
      Type: { front: 'front', back: 'back' },
    }
  };
});

// Override react-i18next for this test to provide common translations
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: jest.fn((key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'common.back': 'Back',
        'vision.start': 'Start Camera',
        'vision.takePhoto': 'Take Photo',
        'vision.camera.instruction': 'Position camera and take photo',
        'vision.preview.title': 'Food Preview',
        'vision.preview.retake': 'Retake',
        'vision.mealType.title': 'Meal Type',
        'vision.mealType.breakfast': 'Breakfast',
        'vision.mealType.lunch': 'Lunch',
        'vision.mealType.dinner': 'Dinner',
        'vision.analysis.analyze': 'Analyze Food',
        'vision.analysis.loading': 'Analyzing...',
        'vision.camera.captureError.title': 'Capture Failed',
        'vision.camera.captureError.message': 'Failed to take photo. Please try again.',
        'vision.title': 'Food Vision',
        'vision.welcome.title': 'Take a Photo of Your Meal',
        'vision.welcome.description': 'Automatically analyze nutritional content and get personalized exercise suggestions',
        'vision.camera.permissionDenied.title': 'Camera Permission Required',
        'vision.camera.permissionDenied.message': 'Please enable camera permission in settings to take photos.',
        'vision.camera.requesting': 'Requesting camera permission...',
        'vision.error.title': 'Analysis Failed',
        'vision.error.retry': 'Try Again',
        'vision.error.detail.default': 'Analysis failed. Please try again.',
        'common.cancel': 'Cancel',
      };
      return translations[key] || fallback || key;
    }),
    i18n: {
      language: 'en',
      changeLanguage: jest.fn(),
    },
  }),
}));

const mockImageUtils = ImageUtils as jest.Mocked<typeof ImageUtils>;
const mockVisionLogService = visionLogService as jest.Mocked<typeof visionLogService>;

describe('VisionLogScreen', () => {
  const mockProps = {
    onBackPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Camera Handling', () => {
    it('should request camera permissions on mount', async () => {
      mockImageUtils.processImageForVision.mockResolvedValue({
        uri: 'processed_uri',
        base64: 'processed_base64',
        width: 1024,
        height: 1024,
        size: 1024,
      });

      const { getByText } = render(<VisionLogScreen {...mockProps} />);

      // Wait for permission resolution
      await waitFor(() => {
        expect(getByText('📷 Start Camera')).toBeTruthy();
      });
    });

    it('should handle camera start successfully', async () => {
      const { getByText } = render(<VisionLogScreen {...mockProps} />);

      // Wait for camera button to be available (permissions resolved)
      await waitFor(() => {
        expect(getByText('📷 Start Camera')).toBeTruthy();
      });

      const cameraButton = getByText('📷 Start Camera');
      fireEvent.press(cameraButton);

      await waitFor(() => {
        expect(getByText('Position camera and take photo')).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('should call onBackPress when back button is pressed', () => {
      const { getByText } = render(<VisionLogScreen {...mockProps} />);

      const backButton = getByText('← Back');
      fireEvent.press(backButton);

      expect(mockProps.onBackPress).toHaveBeenCalled();
    });
  });

});
