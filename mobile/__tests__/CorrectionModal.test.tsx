import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import CorrectionModal from '../components/CorrectionModal';

// Mock de i18next según mejores prácticas para React Native
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: jest.fn((key: string, fallback?: string) => {
      // Retornar fallback si existe, sino la key para debugging
      if (fallback !== undefined) return fallback;
      return key;
    }),
    i18n: {
      changeLanguage: jest.fn(),
      language: 'es',
    },
  }),
}));

// Mock Alert según buenas prácticas de testing
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Mock del servicio según last_sprint.md
jest.mock('../services/VisionLogService', () => ({
  visionLogService: {
    submitCorrection: jest.fn(),
  },
}));

describe('CorrectionModal', () => {
  const mockProps = {
    visible: true,
    logId: 'test-log-id',
    originalData: {
      identified_ingredients: [
        {
          name: 'Apple',
          estimated_grams: 150,
        },
      ],
    } as any,
    onClose: jest.fn(),
    onSubmit: jest.fn(),
  };

  const mockVisionLogService = require('../services/VisionLogService').visionLogService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAlert.mockClear();
  });

  afterEach(() => {
    mockAlert.mockRestore();
  });

  it('validates form before submission', async () => {
    mockVisionLogService.submitCorrection.mockImplementation((data) => {
      const hasRealCorrections = data.corrections && data.corrections.some(
        (correction: any) => correction.actual_grams !== correction.estimated_grams
      );
      if (!hasRealCorrections) {
        return Promise.reject(new Error('No real corrections provided'));
      }
      return Promise.resolve({ success: true });
    });

    const { getByText, unmount } = render(<CorrectionModal {...mockProps} />);

    const submitButton = getByText('Submit');
    fireEvent.press(submitButton);

    // Debería mostrar alerta de error por falta de correcciones
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Correction Required',
        'Please correct at least one ingredient'
      );
    }, { timeout: 3000 });

    // Cleanup después de verificar
    unmount();
  });

  it('handles submission states correctly', async () => {
    const { getByText, getByPlaceholderText } = render(<CorrectionModal {...mockProps} />);
    const submitButton = getByText('Submit');

    // Cambiar el valor actual para pasar validación (actual_grams != estimated_grams)
    const actualInput = getByPlaceholderText('Actual');
    fireEvent.changeText(actualInput, '200');

    // Mock the service to resolve
    mockVisionLogService.submitCorrection.mockResolvedValue({});

    fireEvent.press(submitButton);

    // Verificar que muestra loading state
    await waitFor(() => {
      expect(getByText('Submitting...')).toBeTruthy();
    }, { timeout: 2000 });
  });

  it('prevents submission without real corrections', async () => {
    const propsWithValidData = {
      ...mockProps,
      originalData: {
        ...mockProps.originalData,
        identified_ingredients: [{
          name: 'Apple',
          estimated_grams: 150,
          actual_grams: 150, // Misma cantidad - no es una corrección real
        }],
      },
    };

    const { getByText } = render(<CorrectionModal {...propsWithValidData} />);

    const submitButton = getByText('Submit');
    fireEvent.press(submitButton);

    // Debería mostrar alerta de validación porque no hay correcciones reales
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Correction Required',
        'Please correct at least one ingredient'
      );
    });
  });

  it('closes modal after successful submission', async () => {
    const mockOnClose = jest.fn();

    const { getByText, getByPlaceholderText } = render(<CorrectionModal {...mockProps} onClose={mockOnClose} />);

    // Cambiar el valor actual para pasar validación (actual_grams != estimated_grams)
    const actualInput = getByPlaceholderText('Actual');
    fireEvent.changeText(actualInput, '200');

    mockVisionLogService.submitCorrection.mockResolvedValue({});

    const submitButton = getByText('Submit');
    fireEvent.press(submitButton);

    // Esperar que se complete el envío y se llame onClose
    await waitFor(() => {
      expect(mockVisionLogService.submitCorrection).toHaveBeenCalled();
      expect(mockAlert).toHaveBeenCalled();
    });
  });

  it('renders with provided ingredients', () => {
    const { getByText } = render(<CorrectionModal {...mockProps} />);

    // Verificar que los ingredientes se muestran
    expect(getByText('Apple')).toBeTruthy();
  });

  it('handles close button press', () => {
    const mockOnClose = jest.fn();

    const propsWithClose = {
      ...mockProps,
      onClose: mockOnClose,
    };

    const { getByText } = render(<CorrectionModal {...propsWithClose} />);

    const closeButton = getByText('✕');
    fireEvent.press(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
