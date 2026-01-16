/**
 * Custom hook para la lógica del componente ProductDetail
 * Extrae estado y efectos del componente principal
 */

import { useState } from 'react';
import { ProductPlanService, AddToPlanResult } from '../services/productPlanService';
import { normalizeProductData, NormalizedProduct } from '../utils/productNormalizers';
import { RawProduct } from '../utils/productNormalizers';

export interface UseProductDetailResult {
  normalizedProduct: NormalizedProduct;
  addingToPlan: boolean;
  addToPlan: (mealType?: string) => Promise<AddToPlanResult>;
}

/**
 * Hook personalizado que maneja la lógica del componente ProductDetail
 * @param product Datos crudos del producto (API u OCR)
 * @returns Estado normalizado y funciones de manejo
 */
export const useProductDetail = (product: RawProduct): UseProductDetailResult => {
  const [addingToPlan, setAddingToPlan] = useState(false);

  // Normalizar datos del producto usando utilidad pura
  const normalizedProduct = normalizeProductData(product);

  /**
   * Agrega el producto al plan de alimentación
   * @param mealType Tipo de comida (default: 'lunch')
   * @returns Resultado de la operación
   */
  const addToPlan = async (mealType: string = 'lunch'): Promise<AddToPlanResult> => {
    // Validar barcode antes de proceder
    if (!ProductPlanService.isValidBarcode(normalizedProduct.barcode)) {
      return {
        success: false,
        message: 'Invalid barcode. Cannot add product to plan.',
        error: 'Validation Error'
      };
    }

    // Validar meal type
    if (!ProductPlanService.isValidMealType(mealType)) {
      return {
        success: false,
        message: 'Invalid meal type selected.',
        error: 'Validation Error'
      };
    }

    setAddingToPlan(true);

    try {
      const result = await ProductPlanService.addProductToPlan(
        normalizedProduct.barcode,
        mealType
      );

      return result;
    } catch (error) {
      console.error('useProductDetail.addToPlan error:', error);

      return {
        success: false,
        message: 'Unexpected error occurred while adding product to plan.',
        error: 'Client Error'
      };
    } finally {
      setAddingToPlan(false);
    }
  };

  return {
    normalizedProduct,
    addingToPlan,
    addToPlan
  };
};
