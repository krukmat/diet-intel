import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { useBarcodeFlow } from '../useBarcodeFlow';

jest.mock('expo-barcode-scanner', () => ({
  BarCodeScanner: {
    requestPermissionsAsync: jest.fn(),
  },
}));

describe('useBarcodeFlow', () => {
  const t = (key: string) => key;
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets permission state from barcode scanner', async () => {
    (BarCodeScanner.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

    const { result } = renderHook(() => useBarcodeFlow(t));

    await waitFor(() => {
      expect(result.current.hasPermission).toBe(true);
    });
  });

  it('blocks camera start when permission is pending', () => {
    (BarCodeScanner.requestPermissionsAsync as jest.Mock).mockReturnValue(
      new Promise(() => undefined)
    );

    const { result } = renderHook(() => useBarcodeFlow(t));

    act(() => {
      result.current.startCamera();
    });

    expect(alertSpy).toHaveBeenCalledWith('permissions.title', 'permissions.requesting');
  });

  it('blocks camera start when permission is denied', async () => {
    (BarCodeScanner.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    const { result } = renderHook(() => useBarcodeFlow(t));

    await waitFor(() => {
      expect(result.current.hasPermission).toBe(false);
    });

    act(() => {
      result.current.startCamera();
    });

    expect(alertSpy).toHaveBeenCalledWith('permissions.noAccess.title', 'permissions.noAccess.message');
  });

  it('starts camera when permission is granted', async () => {
    (BarCodeScanner.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

    const { result } = renderHook(() => useBarcodeFlow(t));

    await waitFor(() => {
      expect(result.current.hasPermission).toBe(true);
    });

    act(() => {
      result.current.startCamera();
    });

    expect(result.current.showCamera).toBe(true);
  });

  describe('barcode handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      (BarCodeScanner.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('loads demo product for known barcode', async () => {
      const { result } = renderHook(() => useBarcodeFlow(t));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      act(() => {
        result.current.setManualBarcode('1234567890123');
      });

      act(() => {
        result.current.handleSubmit();
      });

      act(() => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.showProductDetail).toBe(true);
        expect(result.current.currentProduct?.code).toBe('1234567890123');
      });
    });

    it('alerts when barcode is not found', async () => {
      const { result } = renderHook(() => useBarcodeFlow(t));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      act(() => {
        result.current.setManualBarcode('0000000000000');
      });

      act(() => {
        result.current.handleSubmit();
      });

      act(() => {
        jest.runAllTimers();
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'product.notFound.title',
        'product.notFound.message',
        [{ text: 'common.ok' }]
      );
    });

    it('handles barcode scans and closes camera', async () => {
      const { result } = renderHook(() => useBarcodeFlow(t));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      act(() => {
        result.current.startCamera();
      });

      act(() => {
        result.current.handleBarCodeScanned({ type: 'ean13', data: '7622210081551' });
      });

      act(() => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(result.current.scanned).toBe(true);
        expect(result.current.showCamera).toBe(false);
        expect(result.current.currentProduct?.code).toBe('7622210081551');
      });
    });
  });
});
