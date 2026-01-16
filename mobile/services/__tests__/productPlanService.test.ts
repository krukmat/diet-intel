/**
 * Tests unitarios para ProductPlanService
 */

import axios from 'axios';
import { ProductPlanService } from '../productPlanService';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ProductPlanService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addProductToPlan', () => {
    const validBarcode = '123456789012';
    const validMealType = 'lunch';

    describe('success cases', () => {
      it('should handle success response with full data', async () => {
        const mockResponse = {
          data: {
            success: true,
            message: 'Product added successfully',
            item_id: 'item-123'
          },
          status: 200
        };
        mockedAxios.post.mockResolvedValueOnce(mockResponse);

        const result = await ProductPlanService.addProductToPlan(validBarcode, validMealType);

        expect(result).toEqual({
          success: true,
          message: 'Product added successfully',
          item_id: 'item-123'
        });
        expect(mockedAxios.post).toHaveBeenCalledWith('http://10.0.2.2:8000/plan/add-product', {
          barcode: validBarcode,
          meal_type: validMealType
        });
      });

      it('should handle success response with item_id only', async () => {
        const mockResponse = {
          data: { item_id: 'item-456' },
          status: 200
        };
        mockedAxios.post.mockResolvedValueOnce(mockResponse);

        const result = await ProductPlanService.addProductToPlan(validBarcode);

        expect(result).toEqual({
          success: true,
          message: 'Product added to meal plan successfully',
          item_id: 'item-456'
        });
      });

      it('should handle success response with 200 status only', async () => {
        const mockResponse = {
          data: { message: 'OK' },
          status: 200
        };
        mockedAxios.post.mockResolvedValueOnce(mockResponse);

        const result = await ProductPlanService.addProductToPlan(validBarcode);

        expect(result).toEqual({
          success: true,
          message: 'OK'
        });
      });

      it('should use default meal type when not provided', async () => {
        const mockResponse = {
          data: { success: true },
          status: 200
        };
        mockedAxios.post.mockResolvedValueOnce(mockResponse);

        await ProductPlanService.addProductToPlan(validBarcode);

        expect(mockedAxios.post).toHaveBeenCalledWith('http://10.0.2.2:8000/plan/add-product', {
          barcode: validBarcode,
          meal_type: 'lunch'
        });
      });

      it('should trim barcode before sending', async () => {
        const mockResponse = {
          data: { success: true },
          status: 200
        };
        mockedAxios.post.mockResolvedValueOnce(mockResponse);

        await ProductPlanService.addProductToPlan('  123456789012  ');

        expect(mockedAxios.post).toHaveBeenCalledWith('http://10.0.2.2:8000/plan/add-product', {
          barcode: '123456789012',
          meal_type: 'lunch'
        });
      });
    });

    describe('error cases - HTTP responses', () => {
      it('should handle 400 Bad Request', async () => {
        const mockError = {
          response: {
            status: 400,
            data: { message: 'Invalid barcode format' }
          }
        };
        mockedAxios.post.mockRejectedValueOnce(mockError);

        const result = await ProductPlanService.addProductToPlan(validBarcode);

        expect(result).toEqual({
          success: false,
          message: 'Invalid barcode format',
          error: 'Bad Request'
        });
      });

      it('should handle 401 Unauthorized', async () => {
        const mockError = {
          response: { status: 401, data: {} }
        };
        mockedAxios.post.mockRejectedValueOnce(mockError);

        const result = await ProductPlanService.addProductToPlan(validBarcode);

        expect(result).toEqual({
          success: false,
          message: 'Authentication required. Please log in again.',
          error: 'Unauthorized'
        });
      });

      it('should handle 403 Forbidden', async () => {
        const mockError = {
          response: { status: 403, data: {} }
        };
        mockedAxios.post.mockRejectedValueOnce(mockError);

        const result = await ProductPlanService.addProductToPlan(validBarcode);

        expect(result).toEqual({
          success: false,
          message: 'You do not have permission to perform this action.',
          error: 'Forbidden'
        });
      });

      it('should handle 404 Not Found', async () => {
        const mockError = {
          response: {
            status: 404,
            data: { message: 'Product not found' }
          }
        };
        mockedAxios.post.mockRejectedValueOnce(mockError);

        const result = await ProductPlanService.addProductToPlan(validBarcode);

        expect(result).toEqual({
          success: false,
          message: 'Product not found',
          error: 'Not Found'
        });
      });

      it('should handle 409 Conflict', async () => {
        const mockError = {
          response: {
            status: 409,
            data: { message: 'Product already in plan' }
          }
        };
        mockedAxios.post.mockRejectedValueOnce(mockError);

        const result = await ProductPlanService.addProductToPlan(validBarcode);

        expect(result).toEqual({
          success: false,
          message: 'Product already in plan',
          error: 'Conflict'
        });
      });

      it('should handle 422 Validation Error', async () => {
        const mockError = {
          response: {
            status: 422,
            data: { message: 'Invalid meal type' }
          }
        };
        mockedAxios.post.mockRejectedValueOnce(mockError);

        const result = await ProductPlanService.addProductToPlan(validBarcode);

        expect(result).toEqual({
          success: false,
          message: 'Invalid meal type',
          error: 'Validation Error'
        });
      });

      it('should handle 500 Server Error', async () => {
        const mockError = {
          response: { status: 500, data: {} }
        };
        mockedAxios.post.mockRejectedValueOnce(mockError);

        const result = await ProductPlanService.addProductToPlan(validBarcode);

        expect(result).toEqual({
          success: false,
          message: 'Server error. Please try again later.',
          error: 'Server Error'
        });
      });

      it('should handle unknown HTTP status', async () => {
        const mockError = {
          response: {
            status: 418,
            data: { message: 'I\'m a teapot' }
          }
        };
        mockedAxios.post.mockRejectedValueOnce(mockError);

        const result = await ProductPlanService.addProductToPlan(validBarcode);

        expect(result).toEqual({
          success: false,
          message: 'I\'m a teapot',
          error: 'HTTP 418'
        });
      });
    });

    describe('error cases - network and client errors', () => {
      it('should handle network error (no response)', async () => {
        const mockError = {
          request: {},
          message: 'Network Error'
        };
        mockedAxios.post.mockRejectedValueOnce(mockError);

        const result = await ProductPlanService.addProductToPlan(validBarcode);

        expect(result).toEqual({
          success: false,
          message: 'Network error. Please check your connection and try again.',
          error: 'Network Error'
        });
      });

      it('should handle client error', async () => {
        const mockError = {
          message: 'Request timeout'
        };
        mockedAxios.post.mockRejectedValueOnce(mockError);

        const result = await ProductPlanService.addProductToPlan(validBarcode);

        expect(result).toEqual({
          success: false,
          message: 'Request timeout',
          error: 'Client Error'
        });
      });

      it('should handle unknown error format', async () => {
        const mockError = new Error('Unknown error');
        mockedAxios.post.mockRejectedValueOnce(mockError);

        const result = await ProductPlanService.addProductToPlan(validBarcode);

        expect(result.success).toBe(false);
        expect(result.message).toBe('Unknown error');
        expect(result.error).toBe('Client Error');
      });
    });

    describe('error cases - API response errors', () => {
      it('should handle API response with success: false', async () => {
        const mockResponse = {
          data: {
            success: false,
            message: 'Product not available',
            error: 'Out of stock'
          },
          status: 200
        };
        mockedAxios.post.mockResolvedValueOnce(mockResponse);

        const result = await ProductPlanService.addProductToPlan(validBarcode);

        expect(result).toEqual({
          success: false,
          message: 'Product not available',
          error: 'Out of stock'
        });
      });
    });
  });

  describe('isValidBarcode', () => {
    it('should return true for valid barcodes', () => {
      expect(ProductPlanService.isValidBarcode('123456789012')).toBe(true);
      expect(ProductPlanService.isValidBarcode('12345678')).toBe(true);
      expect(ProductPlanService.isValidBarcode('12345678901234567890')).toBe(true);
    });

    it('should return false for invalid barcodes', () => {
      expect(ProductPlanService.isValidBarcode('')).toBe(false);
      expect(ProductPlanService.isValidBarcode(null as any)).toBe(false);
      expect(ProductPlanService.isValidBarcode(undefined as any)).toBe(false);
      expect(ProductPlanService.isValidBarcode('unknown')).toBe(false);
      expect(ProductPlanService.isValidBarcode('UNKNOWN')).toBe(false);
    });

    it('should return false for barcodes too short', () => {
      expect(ProductPlanService.isValidBarcode('1234567')).toBe(false);
      expect(ProductPlanService.isValidBarcode('123')).toBe(false);
    });

    it('should return false for barcodes too long', () => {
      expect(ProductPlanService.isValidBarcode('123456789012345678901')).toBe(false);
    });

    it('should return false for barcodes with non-numeric characters', () => {
      expect(ProductPlanService.isValidBarcode('123456789abc')).toBe(false);
      expect(ProductPlanService.isValidBarcode('12.34567890')).toBe(false);
      expect(ProductPlanService.isValidBarcode('123456789-0')).toBe(false);
    });

    it('should trim whitespace before validation', () => {
      expect(ProductPlanService.isValidBarcode('  123456789012  ')).toBe(true);
      expect(ProductPlanService.isValidBarcode('  123  ')).toBe(false);
    });
  });

  describe('isValidMealType', () => {
    it('should return true for valid meal types', () => {
      expect(ProductPlanService.isValidMealType('breakfast')).toBe(true);
      expect(ProductPlanService.isValidMealType('lunch')).toBe(true);
      expect(ProductPlanService.isValidMealType('dinner')).toBe(true);
      expect(ProductPlanService.isValidMealType('snack')).toBe(true);
    });

    it('should return true for valid meal types with different case', () => {
      expect(ProductPlanService.isValidMealType('BREAKFAST')).toBe(true);
      expect(ProductPlanService.isValidMealType('Lunch')).toBe(true);
      expect(ProductPlanService.isValidMealType('DiNnEr')).toBe(true);
    });

    it('should return false for invalid meal types', () => {
      expect(ProductPlanService.isValidMealType('brunch')).toBe(false);
      expect(ProductPlanService.isValidMealType('supper')).toBe(false);
      expect(ProductPlanService.isValidMealType('')).toBe(false);
      expect(ProductPlanService.isValidMealType('meal')).toBe(false);
    });
  });
});
