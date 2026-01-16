/**
 * Tests unitarios para useProductDetail hook
 */

import { renderHook, act } from '@testing-library/react-native';
import { useProductDetail } from '../useProductDetail';
import { ProductPlanService } from '../../services/productPlanService';

// Mock del servicio
jest.mock('../../services/productPlanService');
const mockedProductPlanService = ProductPlanService as jest.Mocked<typeof ProductPlanService>;

describe('useProductDetail hook', () => {
  const mockProduct = {
    code: '123456789012',
    product_name: 'Test Product',
    brands: 'Test Brand',
    serving_size: '100g',
    image_url: 'https://example.com/image.jpg',
    categories: 'Snacks',
    ingredients_text: 'Ingredients list',
    source: 'Product Database',
    confidence: 1.0,
    nutriments: {
      energy_kcal_100g: 250,
      proteins_100g: 10,
      fat_100g: 5,
      carbohydrates_100g: 30,
      sugars_100g: 15,
      salt_100g: 1.2
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocked methods
    mockedProductPlanService.addProductToPlan.mockReset();
    mockedProductPlanService.isValidBarcode.mockReset();
    mockedProductPlanService.isValidMealType.mockReset();
  });

  describe('initialization', () => {
    it('should normalize product data on initialization', () => {
      const { result } = renderHook(() => useProductDetail(mockProduct));

      expect(result.current.normalizedProduct).toEqual({
        barcode: '123456789012',
        name: 'Test Product',
        brand: 'Test Brand',
        serving_size: '100g',
        image_url: 'https://example.com/image.jpg',
        categories: 'Snacks',
        ingredients: 'Ingredients list',
        source: 'Product Database',
        confidence: 1.0,
        nutriments: {
          energy: 250,
          protein: 10,
          fat: 5,
          carbs: 30,
          sugars: 15,
          salt: 1.2,
          fiber: 0,
          sodium: 0
        }
      });
    });

    it('should initialize addingToPlan as false', () => {
      const { result } = renderHook(() => useProductDetail(mockProduct));

      expect(result.current.addingToPlan).toBe(false);
    });
  });

  describe('addToPlan function', () => {
    it('should successfully add product to plan', async () => {
      mockedProductPlanService.isValidBarcode.mockReturnValue(true);
      mockedProductPlanService.isValidMealType.mockReturnValue(true);
      mockedProductPlanService.addProductToPlan.mockResolvedValue({
        success: true,
        message: 'Product added successfully',
        item_id: 'item-123'
      });

      const { result } = renderHook(() => useProductDetail(mockProduct));

      let addResult;
      await act(async () => {
        addResult = await result.current.addToPlan('lunch');
      });

      expect(addResult).toEqual({
        success: true,
        message: 'Product added successfully',
        item_id: 'item-123'
      });
      expect(mockedProductPlanService.addProductToPlan).toHaveBeenCalledWith('123456789012', 'lunch');
    });

    it('should set addingToPlan to true during operation', async () => {
      mockedProductPlanService.isValidBarcode.mockReturnValue(true);
      mockedProductPlanService.isValidMealType.mockReturnValue(true);

      // Mock que toma tiempo para completar
      mockedProductPlanService.addProductToPlan.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      const { result } = renderHook(() => useProductDetail(mockProduct));

      // Iniciar operación
      act(() => {
        result.current.addToPlan('lunch');
      });

      // Debería estar en estado loading
      expect(result.current.addingToPlan).toBe(true);

      // Esperar a que complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // Debería volver a false
      expect(result.current.addingToPlan).toBe(false);
    });

    it('should use default meal type when not provided', async () => {
      mockedProductPlanService.isValidBarcode.mockReturnValue(true);
      mockedProductPlanService.isValidMealType.mockReturnValue(true);
      mockedProductPlanService.addProductToPlan.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useProductDetail(mockProduct));

      await act(async () => {
        await result.current.addToPlan();
      });

      expect(mockedProductPlanService.addProductToPlan).toHaveBeenCalledWith('123456789012', 'lunch');
    });

    it('should validate barcode before calling service', async () => {
      mockedProductPlanService.isValidBarcode.mockReturnValue(false);

      const { result } = renderHook(() => useProductDetail(mockProduct));

      let addResult;
      await act(async () => {
        addResult = await result.current.addToPlan('lunch');
      });

      expect(addResult).toEqual({
        success: false,
        message: 'Invalid barcode. Cannot add product to plan.',
        error: 'Validation Error'
      });
      expect(mockedProductPlanService.addProductToPlan).not.toHaveBeenCalled();
    });

    it('should validate meal type before calling service', async () => {
      mockedProductPlanService.isValidBarcode.mockReturnValue(true);
      mockedProductPlanService.isValidMealType.mockReturnValue(false);

      const { result } = renderHook(() => useProductDetail(mockProduct));

      let addResult;
      await act(async () => {
        addResult = await result.current.addToPlan('invalid_meal');
      });

      expect(addResult).toEqual({
        success: false,
        message: 'Invalid meal type selected.',
        error: 'Validation Error'
      });
      expect(mockedProductPlanService.addProductToPlan).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      mockedProductPlanService.isValidBarcode.mockReturnValue(true);
      mockedProductPlanService.isValidMealType.mockReturnValue(true);
      mockedProductPlanService.addProductToPlan.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useProductDetail(mockProduct));

      let addResult;
      await act(async () => {
        addResult = await result.current.addToPlan('lunch');
      });

      expect(addResult).toEqual({
        success: false,
        message: 'Unexpected error occurred while adding product to plan.',
        error: 'Client Error'
      });
    });

    it('should handle service failure responses', async () => {
      mockedProductPlanService.isValidBarcode.mockReturnValue(true);
      mockedProductPlanService.isValidMealType.mockReturnValue(true);
      mockedProductPlanService.addProductToPlan.mockResolvedValue({
        success: false,
        message: 'Product not found',
        error: 'Not Found'
      });

      const { result } = renderHook(() => useProductDetail(mockProduct));

      let addResult;
      await act(async () => {
        addResult = await result.current.addToPlan('lunch');
      });

      expect(addResult).toEqual({
        success: false,
        message: 'Product not found',
        error: 'Not Found'
      });
    });

    it('should reset addingToPlan to false after operation completes', async () => {
      mockedProductPlanService.isValidBarcode.mockReturnValue(true);
      mockedProductPlanService.isValidMealType.mockReturnValue(true);
      mockedProductPlanService.addProductToPlan.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useProductDetail(mockProduct));

      // Estado inicial
      expect(result.current.addingToPlan).toBe(false);

      // Ejecutar operación
      await act(async () => {
        await result.current.addToPlan('lunch');
      });

      // Debería volver a false
      expect(result.current.addingToPlan).toBe(false);
    });

    it('should reset addingToPlan to false even if operation fails', async () => {
      mockedProductPlanService.isValidBarcode.mockReturnValue(false);

      const { result } = renderHook(() => useProductDetail(mockProduct));

      // Estado inicial
      expect(result.current.addingToPlan).toBe(false);

      // Ejecutar operación que falla validación
      await act(async () => {
        await result.current.addToPlan('lunch');
      });

      // Debería seguir siendo false (nunca se setió a true)
      expect(result.current.addingToPlan).toBe(false);
    });
  });

  describe('with different product data', () => {
    it('should handle OCR product data', () => {
      const ocrProduct = {
        barcode: '987654321',
        name: 'OCR Product',
        brand: 'OCR Brand',
        image_front_url: 'https://ocr.com/image.jpg',
        source: 'OCR Scan',
        confidence: 0.85,
        nutriments: {
          energy_kcal_per_100g: 200,
          protein_g_per_100g: 8
        }
      };

      const { result } = renderHook(() => useProductDetail(ocrProduct));

      expect(result.current.normalizedProduct.barcode).toBe('987654321');
      expect(result.current.normalizedProduct.source).toBe('OCR Scan');
      expect(result.current.normalizedProduct.nutriments.energy).toBe(200);
      expect(result.current.normalizedProduct.nutriments.protein).toBe(8);
    });

    it('should handle minimal product data', () => {
      const minimalProduct = {};

      const { result } = renderHook(() => useProductDetail(minimalProduct));

      expect(result.current.normalizedProduct.barcode).toBe('unknown');
      expect(result.current.normalizedProduct.name).toBe('Unknown Product');
      expect(result.current.normalizedProduct.nutriments.energy).toBe(0);
    });
  });
});
