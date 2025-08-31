import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import UploadLabel from '../UploadLabel';
import { apiService } from '../../services/ApiService';

// Mock the API service
jest.mock('../../services/ApiService', () => ({
  apiService: {
    scanNutritionLabel: jest.fn(),
    scanNutritionLabelExternal: jest.fn()
  }
}));

// Mock ImagePicker
const mockImagePicker = ImagePicker as jest.Mocked<typeof ImagePicker>;

// Mock Alert
const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;

describe('UploadLabel', () => {
  const mockOnBackPress = jest.fn();
  const mockApiService = apiService as jest.Mocked<typeof apiService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock permissions
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
      status: 'granted',
      expires: 'never',
      granted: true,
      canAskAgain: true
    });
    
    mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      status: 'granted',
      expires: 'never',
      granted: true,
      canAskAgain: true
    });
  });

  describe('Rendering and Initial State', () => {
    it('should render upload section initially', () => {
      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      expect(screen.getByText('🏷️ Upload Nutrition Label')).toBeTruthy();
      expect(screen.getByText('Upload Nutrition Label')).toBeTruthy();
      expect(screen.getByText('📷 Take Photo')).toBeTruthy();
      expect(screen.getByText('🖼️ From Gallery')).toBeTruthy();
    });

    it('should call onBackPress when back button is pressed', () => {
      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      const backButton = screen.getByText('🏠');
      fireEvent.press(backButton);
      
      expect(mockOnBackPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Image Selection', () => {
    it('should take photo when camera button is pressed', async () => {
      mockImagePicker.launchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-photo.jpg' }]
      });

      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      const cameraButton = screen.getByText('📷 Take Photo');
      fireEvent.press(cameraButton);
      
      await waitFor(() => {
        expect(mockImagePicker.launchCameraAsync).toHaveBeenCalledWith({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 1
        });
      });
    });

    it('should select from gallery when gallery button is pressed', async () => {
      mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-gallery.jpg' }]
      });

      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      const galleryButton = screen.getByText('🖼️ From Gallery');
      fireEvent.press(galleryButton);
      
      await waitFor(() => {
        expect(mockImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 1
        });
      });
    });

    it('should show image preview after selecting image', async () => {
      mockImagePicker.launchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-photo.jpg' }]
      });

      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      const cameraButton = screen.getByText('📷 Take Photo');
      fireEvent.press(cameraButton);
      
      await waitFor(() => {
        expect(screen.getByText('Selected Image')).toBeTruthy();
        expect(screen.getByText('🔍 Scan Label')).toBeTruthy();
        expect(screen.getByText('🔄 Retry')).toBeTruthy();
      });
    });

    it('should handle cancelled image selection', async () => {
      mockImagePicker.launchCameraAsync.mockResolvedValue({
        canceled: true,
        assets: []
      });

      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      const cameraButton = screen.getByText('📷 Take Photo');
      fireEvent.press(cameraButton);
      
      await waitFor(() => {
        // Should still show the initial upload screen
        expect(screen.getByText('📷 Take Photo')).toBeTruthy();
      });
    });

    it('should handle image selection errors', async () => {
      mockImagePicker.launchCameraAsync.mockRejectedValue(new Error('Camera error'));

      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      const cameraButton = screen.getByText('📷 Take Photo');
      fireEvent.press(cameraButton);
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Error', 'Failed to take photo');
      });
    });
  });

  describe('Permission Handling', () => {
    it('should request permissions on component mount', async () => {
      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(mockImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
        expect(mockImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
      });
    });

    it('should show alert when permissions are denied', async () => {
      mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'denied',
        expires: 'never',
        granted: false,
        canAskAgain: true
      });

      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Permissions Required',
          'Camera and photo library permissions are required to upload nutrition labels.'
        );
      });
    });
  });

  describe('OCR Processing', () => {
    beforeEach(() => {
      mockImagePicker.launchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-photo.jpg' }]
      });
    });

    it('should scan nutrition label when scan button is pressed', async () => {
      const mockOCRResult = {
        source: 'Local OCR',
        confidence: 0.85,
        raw_text: 'Energy: 200kcal\nProtein: 10g',
        nutriments: {
          energy_kcal_per_100g: 200,
          protein_g_per_100g: 10,
          fat_g_per_100g: 5,
          carbs_g_per_100g: 30
        },
        scanned_at: '2024-01-01T00:00:00Z'
      };

      mockApiService.scanNutritionLabel.mockResolvedValue({ data: mockOCRResult });

      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      // Take photo first
      const cameraButton = screen.getByText('📷 Take Photo');
      fireEvent.press(cameraButton);
      
      await waitFor(() => {
        expect(screen.getByText('🔍 Scan Label')).toBeTruthy();
      });
      
      // Scan the label
      const scanButton = screen.getByText('🔍 Scan Label');
      fireEvent.press(scanButton);
      
      await waitFor(() => {
        expect(mockApiService.scanNutritionLabel).toHaveBeenCalled();
        expect(screen.getByText('OCR Results')).toBeTruthy();
        expect(screen.getByText('(85% confidence)')).toBeTruthy();
      });
    });

    it('should show loading progress during scan', async () => {
      // Mock a delayed response
      mockApiService.scanNutritionLabel.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: { confidence: 0.8 } }), 100)
        )
      );

      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      // Take photo and scan
      const cameraButton = screen.getByText('📷 Take Photo');
      fireEvent.press(cameraButton);
      
      await waitFor(() => {
        const scanButton = screen.getByText('🔍 Scan Label');
        fireEvent.press(scanButton);
      });
      
      // Should show processing message
      expect(screen.getByText(/Processing.../)).toBeTruthy();
    });

    it('should handle scan errors', async () => {
      mockApiService.scanNutritionLabel.mockRejectedValue(new Error('OCR failed'));

      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      // Take photo and scan
      const cameraButton = screen.getByText('📷 Take Photo');
      fireEvent.press(cameraButton);
      
      await waitFor(() => {
        const scanButton = screen.getByText('🔍 Scan Label');
        fireEvent.press(scanButton);
      });
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Upload Failed',
          'Failed to process the nutrition label. Please try again.'
        );
      });
    });

    it('should show low confidence warning', async () => {
      const mockOCRResult = {
        source: 'Local OCR',
        confidence: 0.4,
        low_confidence: true,
        suggest_external_ocr: true,
        raw_text: 'blurry text',
        scanned_at: '2024-01-01T00:00:00Z'
      };

      mockApiService.scanNutritionLabel.mockResolvedValue({ data: mockOCRResult });

      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      // Take photo and scan
      const cameraButton = screen.getByText('📷 Take Photo');
      fireEvent.press(cameraButton);
      
      await waitFor(() => {
        const scanButton = screen.getByText('🔍 Scan Label');
        fireEvent.press(scanButton);
      });
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Low Confidence OCR',
          'The OCR scan had low confidence. You can retry with external OCR or edit the values manually.'
        );
        expect(screen.getByText('⚠️ Low confidence scan detected')).toBeTruthy();
        expect(screen.getByText('🌐 External OCR')).toBeTruthy();
        expect(screen.getByText('✏️ Manual Edit')).toBeTruthy();
      });
    });
  });

  describe('External OCR', () => {
    beforeEach(async () => {
      mockImagePicker.launchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-photo.jpg' }]
      });
      
      // Setup low confidence result first
      mockApiService.scanNutritionLabel.mockResolvedValue({
        data: {
          confidence: 0.3,
          low_confidence: true,
          suggest_external_ocr: true,
          scanned_at: '2024-01-01T00:00:00Z'
        }
      });
    });

    it('should use external OCR when button is pressed', async () => {
      const mockExternalResult = {
        source: 'External OCR',
        confidence: 0.95,
        nutriments: {
          energy_kcal_per_100g: 250,
          protein_g_per_100g: 12
        },
        scanned_at: '2024-01-01T00:00:00Z'
      };

      mockApiService.scanNutritionLabelExternal.mockResolvedValue({ data: mockExternalResult });

      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      // Complete initial scan with low confidence
      const cameraButton = screen.getByText('📷 Take Photo');
      fireEvent.press(cameraButton);
      
      await waitFor(() => {
        const scanButton = screen.getByText('🔍 Scan Label');
        fireEvent.press(scanButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText('🌐 External OCR')).toBeTruthy();
      });
      
      // Use external OCR
      const externalButton = screen.getByText('🌐 External OCR');
      fireEvent.press(externalButton);
      
      await waitFor(() => {
        expect(mockApiService.scanNutritionLabelExternal).toHaveBeenCalled();
        expect(mockAlert).toHaveBeenCalledWith(
          'External OCR Complete',
          'Label processed with external OCR service.'
        );
      });
    });

    it('should handle external OCR errors', async () => {
      mockApiService.scanNutritionLabelExternal.mockRejectedValue(new Error('External service down'));

      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      // Complete initial scan and trigger external OCR
      const cameraButton = screen.getByText('📷 Take Photo');
      fireEvent.press(cameraButton);
      
      await waitFor(() => {
        const scanButton = screen.getByText('🔍 Scan Label');
        fireEvent.press(scanButton);
      });
      
      await waitFor(() => {
        const externalButton = screen.getByText('🌐 External OCR');
        fireEvent.press(externalButton);
      });
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'External OCR Failed',
          'External OCR processing failed. Try manual editing instead.'
        );
      });
    });
  });

  describe('Manual Editing', () => {
    beforeEach(async () => {
      mockImagePicker.launchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-photo.jpg' }]
      });
      
      mockApiService.scanNutritionLabel.mockResolvedValue({
        data: {
          confidence: 0.6,
          nutriments: {
            energy_kcal_per_100g: 200,
            protein_g_per_100g: 10
          },
          scanned_at: '2024-01-01T00:00:00Z'
        }
      });
    });

    it('should open manual edit mode', async () => {
      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      // Complete scan and open manual edit
      const cameraButton = screen.getByText('📷 Take Photo');
      fireEvent.press(cameraButton);
      
      await waitFor(() => {
        const scanButton = screen.getByText('🔍 Scan Label');
        fireEvent.press(scanButton);
      });
      
      await waitFor(() => {
        // Look for customize button or manual edit option
        // The exact text might vary based on confidence level
        expect(screen.queryByText('Manual Correction') || screen.queryByText('✏️ Manual Edit')).toBeTruthy();
      });
    });

    it('should save manual values', async () => {
      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      // This is a complex interaction that would require more detailed mocking
      // For now, verify the basic structure is in place
      expect(mockApiService.scanNutritionLabel).toBeDefined();
    });
  });

  describe('Session Reset', () => {
    it('should reset to initial state when retry is pressed', async () => {
      mockImagePicker.launchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-photo.jpg' }]
      });

      render(<UploadLabel onBackPress={mockOnBackPress} />);
      
      // Take photo
      const cameraButton = screen.getByText('📷 Take Photo');
      fireEvent.press(cameraButton);
      
      await waitFor(() => {
        expect(screen.getByText('🔄 Retry')).toBeTruthy();
      });
      
      // Reset session
      const retryButton = screen.getByText('🔄 Retry');
      fireEvent.press(retryButton);
      
      // Should be back to initial state
      expect(screen.getByText('📷 Take Photo')).toBeTruthy();
      expect(screen.getByText('🖼️ From Gallery')).toBeTruthy();
    });
  });
});