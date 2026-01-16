/**
 * Servicio para manejar operaciones relacionadas con productos en el plan de alimentación
 */

import axios from 'axios';

const API_BASE_URL = 'http://10.0.2.2:8000';

/**
 * Resultado de agregar producto al plan
 */
export interface AddToPlanResult {
  success: boolean;
  message?: string;
  item_id?: string;
  error?: string;
}

/**
 * Servicio para operaciones relacionadas con productos en planes de alimentación
 */
export class ProductPlanService {
  /**
   * Agrega un producto al plan de alimentación del usuario
   * @param barcode Código de barras del producto
   * @param mealType Tipo de comida (lunch por defecto)
   * @returns Promise con el resultado de la operación
   */
  static async addProductToPlan(
    barcode: string,
    mealType: string = 'lunch'
  ): Promise<AddToPlanResult> {
    try {
      const response = await axios.post(`${API_BASE_URL}/plan/add-product`, {
        barcode: barcode.trim(),
        meal_type: mealType,
      });

      // La API devuelve diferentes formatos, normalizar respuesta
      const data = response.data;

      // Si success es explícitamente false, es un error
      if (data.success === false) {
        return {
          success: false,
          message: data.message || 'Failed to add product to meal plan',
          error: data.error || 'API Error',
        };
      }

      // Si success es true, es éxito
      if (data.success === true) {
        return {
          success: true,
          message: data.message || 'Product added to meal plan successfully',
          item_id: data.item_id,
        };
      }

      // Algunos endpoints pueden devolver solo el item_id
      if (data.item_id) {
        return {
          success: true,
          message: 'Product added to meal plan successfully',
          item_id: data.item_id,
        };
      }

      // Si no hay indicadores explícitos pero el status es 200, asumir éxito
      if (response.status === 200) {
        return {
          success: true,
          message: data.message || 'Product added to meal plan successfully',
          item_id: data.item_id,
        };
      }

      // Default: asumir éxito para responses 200 sin indicadores claros
      return {
        success: true,
        message: data.message || 'Product added to meal plan successfully',
        item_id: data.item_id,
      };

    } catch (error: any) {
      console.error('ProductPlanService.addProductToPlan error:', error);

      // Manejar diferentes tipos de errores
      let errorMessage = 'Failed to add product to meal plan. Please try again.';
      let errorDetail = 'Unknown error';

      if (error.response) {
        // Error de respuesta del servidor
        const status = error.response.status;
        const data = error.response.data;

        switch (status) {
          case 400:
            errorMessage = data.message || 'Invalid request. Please check the product barcode.';
            errorDetail = 'Bad Request';
            break;
          case 401:
            errorMessage = 'Authentication required. Please log in again.';
            errorDetail = 'Unauthorized';
            break;
          case 403:
            errorMessage = 'You do not have permission to perform this action.';
            errorDetail = 'Forbidden';
            break;
          case 404:
            errorMessage = data.message || 'Product not found or plan does not exist.';
            errorDetail = 'Not Found';
            break;
          case 409:
            errorMessage = data.message || 'Product is already in the meal plan.';
            errorDetail = 'Conflict';
            break;
          case 422:
            errorMessage = data.message || 'Invalid data provided.';
            errorDetail = 'Validation Error';
            break;
          case 500:
          case 502:
          case 503:
            errorMessage = 'Server error. Please try again later.';
            errorDetail = 'Server Error';
            break;
          default:
            errorMessage = data?.message || errorMessage;
            errorDetail = `HTTP ${status}`;
        }
      } else if (error.request) {
        // Error de red (no response)
        errorMessage = 'Network error. Please check your connection and try again.';
        errorDetail = 'Network Error';
      } else {
        // Otro tipo de error
        errorMessage = error.message || errorMessage;
        errorDetail = 'Client Error';
      }

      return {
        success: false,
        message: errorMessage,
        error: errorDetail,
      };
    }
  }

  /**
   * Valida si un barcode es válido antes de enviarlo
   * @param barcode Código de barras a validar
   * @returns true si es válido
   */
  static isValidBarcode(barcode: string): boolean {
    if (!barcode || typeof barcode !== 'string') {
      return false;
    }

    const trimmed = barcode.trim();

    // Validar longitud razonable
    if (trimmed.length < 8 || trimmed.length > 20) {
      return false;
    }

    // Validar que contenga solo números (barcodes estándar)
    if (!/^\d+$/.test(trimmed)) {
      return false;
    }

    // Validar que no sea "unknown"
    if (trimmed.toLowerCase() === 'unknown') {
      return false;
    }

    return true;
  }

  /**
   * Valida si un meal type es válido
   * @param mealType Tipo de comida
   * @returns true si es válido
   */
  static isValidMealType(mealType: string): boolean {
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    return validMealTypes.includes(mealType.toLowerCase());
  }
}
