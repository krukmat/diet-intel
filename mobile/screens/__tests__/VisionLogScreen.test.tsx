import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import VisionLogScreen from '../VisionLogScreen';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

jest.mock('expo-camera', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  const Camera = React.forwardRef((props: any, ref) => {
    const handleTakePicture = async () => ({ uri: 'file://photo.jpg' });
    React.useImperativeHandle(ref, () => ({ takePictureAsync: handleTakePicture }));
    return (
      <View>
        <Text>Camera</Text>
        {props.children}
      </View>
    );
  });
  Camera.requestCameraPermissionsAsync = jest.fn();
  return {
    Camera,
    CameraType: { back: 'back' },
  };
});

jest.mock('../../utils/imageUtils', () => ({
  ImageUtils: {
    processImageForVision: jest.fn(),
    validateImageForVision: jest.fn(),
  },
}));

jest.mock('../../services/VisionLogService', () => ({
  visionLogService: {
    uploadImageForAnalysis: jest.fn(),
  },
}));

jest.mock('../../components/VisionAnalysisModal', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return ({ visible }: { visible: boolean }) => (
    <View>{visible && <Text>Analysis Modal</Text>}</View>
  );
});

jest.mock('../../components/ExerciseSuggestionCard', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return () => (
    <View>
      <Text>Exercise Suggestion</Text>
    </View>
  );
});

const { Camera } = jest.requireMock('expo-camera');
const { ImageUtils } = jest.requireMock('../../utils/imageUtils');
const { visionLogService } = jest.requireMock('../../services/VisionLogService');

describe('VisionLogScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Camera.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImageUtils.processImageForVision as jest.Mock).mockResolvedValue({
      uri: 'file://processed.jpg',
      base64: 'base64data',
      width: 100,
      height: 100,
      size: 123,
      format: 'jpg',
    });
    (ImageUtils.validateImageForVision as jest.Mock).mockReturnValue({
      isValid: true,
      errors: [],
    });
    (visionLogService.uploadImageForAnalysis as jest.Mock).mockResolvedValue({
      exercise_suggestions: [],
    });
  });

  const startCamera = async (getByTestId: (id: string) => any) => {
    await waitFor(() => {
      expect(Camera.requestCameraPermissionsAsync).toHaveBeenCalled();
    });

    fireEvent.press(getByTestId('vision-start-camera'));

    await waitFor(() => {
      expect(getByTestId('vision-take-photo')).toBeTruthy();
    });
  };

  it('requests permission and starts camera', async () => {
    const { getByTestId, getByText } = render(<VisionLogScreen onBackPress={jest.fn()} />);

    await waitFor(() => {
      expect(Camera.requestCameraPermissionsAsync).toHaveBeenCalled();
    });

    fireEvent.press(getByTestId('vision-start-camera'));
    expect(getByText('Camera')).toBeTruthy();
  });

  it('shows alert when permission denied', async () => {
    (Camera.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = render(<VisionLogScreen onBackPress={jest.fn()} />);

    await waitFor(() => {
      expect(Camera.requestCameraPermissionsAsync).toHaveBeenCalled();
    });

    fireEvent.press(getByTestId('vision-start-camera'));
    expect(alertSpy).toHaveBeenCalled();
  });

  it('processes captured image and triggers analysis', async () => {
    const { getByTestId } = render(<VisionLogScreen onBackPress={jest.fn()} />);

    await startCamera(getByTestId);
    fireEvent.press(getByTestId('vision-take-photo'));

    await waitFor(() => {
      expect(ImageUtils.processImageForVision).toHaveBeenCalled();
    });

    fireEvent.press(getByTestId('vision-analyze'));

    await waitFor(() => {
      expect(visionLogService.uploadImageForAnalysis).toHaveBeenCalled();
    });
  });

  it('keeps analysis disabled when image invalid', async () => {
    (ImageUtils.validateImageForVision as jest.Mock).mockReturnValue({
      isValid: false,
      errors: ['too small'],
    });

    const { getByTestId, queryByTestId } = render(<VisionLogScreen onBackPress={jest.fn()} />);

    await startCamera(getByTestId);
    fireEvent.press(getByTestId('vision-take-photo'));

    await waitFor(() => {
      expect(ImageUtils.validateImageForVision).toHaveBeenCalled();
    });

    expect(queryByTestId('vision-analyze')).toBeNull();
  });

  it('handles analysis error', async () => {
    (visionLogService.uploadImageForAnalysis as jest.Mock).mockRejectedValue({
      response: { data: { error: 'FAIL', detail: 'bad' }, status: 500 },
    });

    const { getByTestId, getByText } = render(<VisionLogScreen onBackPress={jest.fn()} />);

    await startCamera(getByTestId);
    fireEvent.press(getByTestId('vision-take-photo'));

    await waitFor(() => {
      expect(ImageUtils.processImageForVision).toHaveBeenCalled();
    });

    fireEvent.press(getByTestId('vision-analyze'));

    await waitFor(() => {
      expect(getByText('bad')).toBeTruthy();
    });
  });
});
