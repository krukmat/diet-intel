import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import axios from 'axios';
import { Alert } from 'react-native';
import ProductDetail from '../ProductDetail';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ProductDetail', () => {
  const mockProductBasic = {
    code: '1234567890',
    product_name: 'Test Product',
    brands: 'Test Brand',
    serving_size: '100g',
    image_url: 'https://test.com/image.jpg',
    categories: 'Snacks',
    ingredients_text: 'Test ingredients',
    nutriments: {
      energy_kcal_100g: 250,
      proteins_100g: 10,
      fat_100g: 5,
      carbohydrates_100g: 30,
      sugars_100g: 15,
      salt_100g: 1.2,
      fiber_100g: 3,
      sodium_100g: 480,
    },
  };

  const mockProductOCR = {
    barcode: '9876543210',
    name: 'OCR Product',
    brand: 'OCR Brand',
    source: 'OCR Scanner',
    confidence: 0.85,
    nutriments: {
      energy_kcal_per_100g: 300,
      protein_g_per_100g: 12,
      fat_g_per_100g: 8,
      carbs_g_per_100g: 35,
      sugars_g_per_100g: 20,
      salt_g_per_100g: 1.5,
    },
  };

  const mockOnClose = jest.fn();
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockReturnValue();
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('renders core product information', () => {
    const { getByText } = render(
      <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
    );

    expect(getByText('Test Product')).toBeTruthy();
    expect(getByText('Test Brand')).toBeTruthy();
    expect(getByText('1234567890')).toBeTruthy();
    expect(getByText('Nutrition Facts (per 100g)')).toBeTruthy();
    expect(getByText('250.0 kcal')).toBeTruthy();
  });

  it('shows OCR metadata when present', () => {
    const { getByText } = render(
      <ProductDetail product={mockProductOCR} onClose={mockOnClose} />
    );

    expect(getByText(/OCR Scanner/)).toBeTruthy();
    expect(getByText(/85% confidence/)).toBeTruthy();
    expect(getByText('300.0 kcal')).toBeTruthy();
  });

  it('omits nutrition section when data is missing', () => {
    const productNoNutrition = { ...mockProductBasic, nutriments: {} };

    const { queryByText } = render(
      <ProductDetail product={productNoNutrition} onClose={mockOnClose} />
    );

    expect(queryByText('Nutrition Facts (per 100g)')).toBeNull();
  });

  it('prevents adding to plan without barcode', async () => {
    const productWithoutBarcode = { ...mockProductBasic, code: undefined, barcode: undefined };

    const { getByText } = render(
      <ProductDetail product={productWithoutBarcode} onClose={mockOnClose} />
    );

    await act(async () => {
      fireEvent.press(getByText('🍽️ Add to Meal Plan'));
    });

    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Error',
      'Cannot add product without barcode to plan.',
    );
  });

  it('adds product to plan successfully', async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: true, message: 'Added to plan' } });

    const { getByText } = render(
      <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
    );

    await act(async () => {
      fireEvent.press(getByText('🍽️ Add to Meal Plan'));
    });

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/plan/add-product'),
        expect.objectContaining({ barcode: '1234567890' }),
      );
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Success!',
      'Added to plan',
      [{ text: 'OK' }],
    );
  });

  it('shows error alert when add to plan fails', async () => {
    mockedAxios.post.mockRejectedValue({ response: { data: { message: 'Failure' } } });

    const { getByText } = render(
      <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
    );

    await act(async () => {
      fireEvent.press(getByText('🍽️ Add to Meal Plan'));
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Failure',
        [{ text: 'OK' }],
      );
    });
  });

  it('invokes onClose callback when close button pressed', async () => {
    const { getByText } = render(
      <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
    );

    fireEvent.press(getByText('✕'));

    expect(mockOnClose).toHaveBeenCalled();
  });
});
