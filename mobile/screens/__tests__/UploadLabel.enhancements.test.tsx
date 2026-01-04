/**
 * UploadLabel Screen Enhancement Tests - Phase 1
 * Comprehensive tests for image upload, compression, OCR, and error handling
 *
 * These tests enhance the existing UploadLabel.test.tsx with actual functionality tests
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import UploadLabel from '../UploadLabel';
import { apiService } from '../../services/ApiService';

// Mock modules
jest.mock('../../services/ApiService', () => ({
  apiService: {
    scanNutritionLabel: jest.fn(),
    scanNutritionLabelExternal: jest.fn(),
  },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockAxiosResponse = (data: any) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {} as any,
  config: { headers: {} as any } as any,
});

describe('UploadLabel Screen - Enhanced Tests', () => {
  const mockOnBackPress = jest.fn();
  const mockApiService = apiService as jest.Mocked<typeof apiService>;
  const mockImagePicker = ImagePicker as jest.Mocked<typeof ImagePicker>;
  const mockImageManipulator = ImageManipulator as jest.Mocked<typeof ImageManipulator>;
  const pressByTestId = async (getByTestId: (testId: string) => any, testId: string) => {
    const node = getByTestId(testId);
    if (node.props?.onPress) {
      await node.props.onPress();
      return;
    }
    fireEvent.press(node);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default successful mocks
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
      expires: 'never',
    } as any);

    mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
      expires: 'never',
    } as any);

    mockImageManipulator.manipulateAsync.mockResolvedValue({
      uri: 'file:///compressed-image.jpg',
      width: 1000,
      height: 1000,
      base64: 'base64data',
    } as any);

    mockApiService.scanNutritionLabel.mockResolvedValue(mockAxiosResponse({
      confidence: 0.85,
      nutrients: {
        energy_kcal_per_100g: 250,
        protein_g_per_100g: 8,
        fat_g_per_100g: 12,
        carbs_g_per_100g: 30,
        sugars_g_per_100g: 5,
        salt_g_per_100g: 1.2,
      },
      text_extracted: 'Nutrition facts per 100g...',
    }));

    mockApiService.scanNutritionLabelExternal.mockResolvedValue(mockAxiosResponse({
      confidence: 0.90,
      nutrients: {
        energy_kcal_per_100g: 300,
        protein_g_per_100g: 10,
        fat_g_per_100g: 15,
        carbs_g_per_100g: 35,
      },
    }));
  });

  it('requests camera and media permissions on mount', async () => {
    render(<UploadLabel onBackPress={mockOnBackPress} />);

    await waitFor(() => {
      expect(mockImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
      expect(mockImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
    });
  });

  it('alerts when permissions are denied', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
      status: 'denied',
      canAskAgain: true,
      expires: 'never',
    } as any);

    render(<UploadLabel onBackPress={mockOnBackPress} />);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('permissions.title', 'permissions.cameraRequired');
    });

    alertSpy.mockRestore();
  });

  it('selects image from gallery and shows preview actions', async () => {
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      assets: [{ uri: 'file:///original-image.jpg' }],
      canceled: false,
    } as any);

    const { getByTestId, queryByTestId } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-from-gallery');

    await waitFor(() => {
      expect(mockImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
      expect(queryByTestId('upload-scan-label')).toBeTruthy();
      expect(queryByTestId('upload-retry')).toBeTruthy();
    });
  });

  it('takes photo and transitions to upload preview', async () => {
    mockImagePicker.launchCameraAsync.mockResolvedValue({
      assets: [{ uri: 'file:///camera-image.jpg' }],
      canceled: false,
    } as any);

    const { getByTestId, queryByTestId } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-take-photo');

    await waitFor(() => {
      expect(mockImagePicker.launchCameraAsync).toHaveBeenCalled();
      expect(queryByTestId('upload-scan-label')).toBeTruthy();
    });
  });

  it('returns compressed image uri on successful compression', async () => {
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      assets: [{ uri: 'file:///original-image.jpg' }],
      canceled: false,
    } as any);

    const { getByTestId, queryByTestId } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-from-gallery');

    await waitFor(() => {
      expect(mockImageManipulator.manipulateAsync).toHaveBeenCalled();
      expect(queryByTestId('upload-scan-label')).toBeTruthy();
    });
  });

  it('falls back to original image when compression fails', async () => {
    mockImageManipulator.manipulateAsync.mockRejectedValueOnce(
      new Error('Compression failed')
    );
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      assets: [{ uri: 'file:///original-image.jpg' }],
      canceled: false,
    } as any);

    const { getByTestId, queryByTestId } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-from-gallery');

    await waitFor(() => {
      expect(mockImageManipulator.manipulateAsync).toHaveBeenCalled();
      expect(queryByTestId('upload-scan-label')).toBeTruthy();
    });
  });

  it('uploads image and renders OCR results', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      assets: [{ uri: 'file:///original-image.jpg' }],
      canceled: false,
    } as any);

    mockApiService.scanNutritionLabel.mockResolvedValue(mockAxiosResponse({
      confidence: 0.88,
      raw_text: 'Nutrition facts per 100g...',
      source: 'local',
      scanned_at: '2026-01-01',
      nutriments: {
        energy_kcal_per_100g: 250,
        protein_g_per_100g: 8,
      },
    }));

    const { getByTestId, queryByTestId, queryByText } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-from-gallery');

    await waitFor(() => {
      expect(queryByTestId('upload-scan-label')).toBeTruthy();
    });

    await pressByTestId(getByTestId, 'upload-scan-label');

    await waitFor(() => {
      expect(mockApiService.scanNutritionLabel).toHaveBeenCalled();
      expect(queryByText('upload.rawText')).toBeTruthy();
      expect(queryByText('upload.nutritionFacts')).toBeTruthy();
    });

    expect(alertSpy).not.toHaveBeenCalledWith('upload.results.lowConfidence', expect.any(String));
    alertSpy.mockRestore();
  });

  it('shows progress updates while uploading', async () => {
    jest.useFakeTimers();
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      assets: [{ uri: 'file:///original-image.jpg' }],
      canceled: false,
    } as any);

    mockApiService.scanNutritionLabel.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve(mockAxiosResponse({
                confidence: 0.85,
                raw_text: 'Nutrition facts per 100g...',
                source: 'local',
                scanned_at: '2026-01-01',
                nutriments: { energy_kcal_per_100g: 250 },
              })),
            2000
          );
        })
    );

    const { getByTestId, queryByTestId } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await act(async () => {
      await pressByTestId(getByTestId, 'upload-from-gallery');
    });

    expect(queryByTestId('upload-scan-label')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('upload-scan-label'));
    });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    const progress = queryByTestId('upload-progress-fill');
    expect(progress).toBeTruthy();
    expect(progress?.props?.style?.[1]?.width).not.toBe('0%');

    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('shows low confidence actions and triggers external OCR', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      assets: [{ uri: 'file:///original-image.jpg' }],
      canceled: false,
    } as any);

    mockApiService.scanNutritionLabel.mockResolvedValue(mockAxiosResponse({
      confidence: 0.4,
      raw_text: 'Unclear label',
      source: 'local',
      scanned_at: '2026-01-01',
      low_confidence: true,
      suggest_external_ocr: true,
      nutriments: {
        energy_kcal_per_100g: 120,
      },
    }));

    mockApiService.scanNutritionLabelExternal.mockResolvedValue(mockAxiosResponse({
      confidence: 0.9,
      raw_text: 'External label',
      source: 'external',
      scanned_at: '2026-01-01',
      nutriments: {
        energy_kcal_per_100g: 200,
      },
    }));

    const { getByTestId, queryByText } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-from-gallery');

    await waitFor(() => {
      expect(queryByText('upload.scanLabel')).toBeTruthy();
    });

    await pressByTestId(getByTestId, 'upload-scan-label');

    await waitFor(() => {
      expect(queryByText('upload.lowConfidenceWarning')).toBeTruthy();
      expect(queryByText('upload.externalOcrButton')).toBeTruthy();
    });

    await pressByTestId(getByTestId, 'upload-external-ocr');

    await waitFor(() => {
      expect(mockApiService.scanNutritionLabelExternal).toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('upload.results.externalOCR', 'upload.externalOcrSuccess');
    });

    alertSpy.mockRestore();
  });

  it('allows manual edit flow and saves values', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      assets: [{ uri: 'file:///original-image.jpg' }],
      canceled: false,
    } as any);

    mockApiService.scanNutritionLabel.mockResolvedValue(mockAxiosResponse({
      confidence: 0.4,
      raw_text: 'Unclear label',
      source: 'local',
      scanned_at: '2026-01-01',
      low_confidence: true,
      nutriments: {
        energy_kcal_per_100g: 120,
        protein_g_per_100g: 4,
      },
    }));

    const { getByTestId, getAllByPlaceholderText, queryByText } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-from-gallery');

    await waitFor(() => {
      expect(queryByText('upload.scanLabel')).toBeTruthy();
    });

    await pressByTestId(getByTestId, 'upload-scan-label');

    await waitFor(() => {
      expect(queryByText('upload.manualEditButton')).toBeTruthy();
    });

    await pressByTestId(getByTestId, 'upload-manual-edit');

    const inputs = getAllByPlaceholderText('upload.enterValue');
    fireEvent.changeText(inputs[0], '210');

    await pressByTestId(getByTestId, 'upload-save-values');

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('common.success', 'upload.edit.updated');
    });

    alertSpy.mockRestore();
  });

  it('shows error alert when OCR upload fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      assets: [{ uri: 'file:///original-image.jpg' }],
      canceled: false,
    } as any);

    mockApiService.scanNutritionLabel.mockRejectedValue(
      new Error('OCR Service Error')
    );

    const { getByTestId, queryByText } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-from-gallery');

    await waitFor(() => {
      expect(queryByText('upload.scanLabel')).toBeTruthy();
    });

    await pressByTestId(getByTestId, 'upload-scan-label');

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'upload.errors.uploadFailed',
        'upload.errors.processingFailed',
        [{ text: 'common.ok' }]
      );
    });

    alertSpy.mockRestore();
  });

  it('alerts when image picker fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockImagePicker.launchImageLibraryAsync.mockRejectedValue(
      new Error('Picker failed')
    );

    const { getByTestId } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-from-gallery');

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('common.error', 'upload.errors.pickFailed');
    });

    alertSpy.mockRestore();
  });

  it('alerts when camera capture fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockImagePicker.launchCameraAsync.mockRejectedValue(
      new Error('Camera failed')
    );

    const { getByTestId } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-take-photo');

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('common.error', 'upload.errors.photoFailed');
    });

    alertSpy.mockRestore();
  });

  it('resets session when retrying before OCR', async () => {
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      assets: [{ uri: 'file:///original-image.jpg' }],
      canceled: false,
    } as any);

    const { getByTestId, queryByTestId, queryByText } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-from-gallery');

    await waitFor(() => {
      expect(queryByTestId('upload-retry')).toBeTruthy();
    });

    await pressByTestId(getByTestId, 'upload-retry');

    await waitFor(() => {
      expect(queryByTestId('upload-scan-label')).toBeNull();
      expect(queryByText('upload.takePhoto')).toBeTruthy();
    });
  });

  it('resets session when starting over after OCR', async () => {
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      assets: [{ uri: 'file:///original-image.jpg' }],
      canceled: false,
    } as any);

    mockApiService.scanNutritionLabel.mockResolvedValue(mockAxiosResponse({
      confidence: 0.88,
      raw_text: 'Nutrition facts per 100g...',
      source: 'local',
      scanned_at: '2026-01-01',
      nutriments: {
        energy_kcal_per_100g: 250,
        protein_g_per_100g: 8,
      },
    }));

    const { getByTestId, queryByTestId, queryByText } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-from-gallery');

    await waitFor(() => {
      expect(queryByTestId('upload-scan-label')).toBeTruthy();
    });

    await pressByTestId(getByTestId, 'upload-scan-label');

    await waitFor(() => {
      expect(queryByTestId('upload-start-over')).toBeTruthy();
    });

    await pressByTestId(getByTestId, 'upload-start-over');

    await waitFor(() => {
      expect(queryByTestId('upload-scan-label')).toBeNull();
      expect(queryByText('upload.takePhoto')).toBeTruthy();
    });
  });

  it('closes manual edit without saving', async () => {
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      assets: [{ uri: 'file:///original-image.jpg' }],
      canceled: false,
    } as any);

    mockApiService.scanNutritionLabel.mockResolvedValue(mockAxiosResponse({
      confidence: 0.4,
      raw_text: 'Unclear label',
      source: 'local',
      scanned_at: '2026-01-01',
      low_confidence: true,
      nutriments: {
        energy_kcal_per_100g: 120,
      },
    }));

    const { getByTestId, queryByTestId } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-from-gallery');

    await waitFor(() => {
      expect(queryByTestId('upload-scan-label')).toBeTruthy();
    });

    await pressByTestId(getByTestId, 'upload-scan-label');

    await waitFor(() => {
      expect(queryByTestId('upload-manual-edit')).toBeTruthy();
    });

    await pressByTestId(getByTestId, 'upload-manual-edit');

    await waitFor(() => {
      expect(queryByTestId('upload-cancel-manual')).toBeTruthy();
    });

    await pressByTestId(getByTestId, 'upload-cancel-manual');

    await waitFor(() => {
      expect(queryByTestId('upload-save-values')).toBeNull();
    });
  });

  it('shows error alert when external OCR fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      assets: [{ uri: 'file:///original-image.jpg' }],
      canceled: false,
    } as any);

    mockApiService.scanNutritionLabel.mockResolvedValue(mockAxiosResponse({
      confidence: 0.4,
      raw_text: 'Unclear label',
      source: 'local',
      scanned_at: '2026-01-01',
      low_confidence: true,
      suggest_external_ocr: true,
      nutriments: {
        energy_kcal_per_100g: 120,
      },
    }));

    mockApiService.scanNutritionLabelExternal.mockRejectedValue(
      new Error('External failed')
    );

    const { getByTestId, queryByTestId } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-from-gallery');

    await waitFor(() => {
      expect(queryByTestId('upload-scan-label')).toBeTruthy();
    });

    await pressByTestId(getByTestId, 'upload-scan-label');

    await waitFor(() => {
      expect(queryByTestId('upload-external-ocr')).toBeTruthy();
    });

    await pressByTestId(getByTestId, 'upload-external-ocr');

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('upload.results.externalFailed', 'upload.externalOcrFailed');
    });

    alertSpy.mockRestore();
  });

  it('fires back navigation callback', async () => {
    const { getByTestId } = render(
      <UploadLabel onBackPress={mockOnBackPress} />
    );

    await pressByTestId(getByTestId, 'upload-back');
    expect(mockOnBackPress).toHaveBeenCalled();
  });
});
