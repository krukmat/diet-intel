import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ScannerExperience from '../ScannerExperience';

jest.mock('expo-barcode-scanner', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    BarCodeScanner: ({ onBarCodeScanned }: { onBarCodeScanned?: (event: any) => void }) => (
      <TouchableOpacity
        testID="barcode-scanner"
        onPress={() => onBarCodeScanned && onBarCodeScanned({ type: 'ean13', data: '123' })}
      >
        <Text>Scanner</Text>
      </TouchableOpacity>
    ),
  };
});

describe('ScannerExperience', () => {
  const baseProps = {
    t: (key: string) => key,
    hasPermission: true as boolean | null,
    showCamera: false,
    scanned: false,
    onStartCamera: jest.fn(),
    onStopCamera: jest.fn(),
    onBarcodeScanned: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders camera start button', () => {
    const { getByText } = render(<ScannerExperience {...baseProps} />);

    expect(getByText('📷 Start Camera')).toBeTruthy();
  });

  it('starts camera from button', () => {
    const { getByText } = render(<ScannerExperience {...baseProps} />);

    fireEvent.press(getByText('📷 Start Camera'));

    expect(baseProps.onStartCamera).toHaveBeenCalled();
  });

  it('renders camera view and closes it', () => {
    const { getByTestId, getByText } = render(
      <ScannerExperience {...baseProps} showCamera />
    );

    fireEvent.press(getByTestId('barcode-scanner'));
    fireEvent.press(getByText('✕ Close Camera'));

    expect(baseProps.onBarcodeScanned).toHaveBeenCalledWith({ type: 'ean13', data: '123' });
    expect(baseProps.onStopCamera).toHaveBeenCalled();
  });
});
