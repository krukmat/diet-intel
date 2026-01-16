/**
 * Tests unitarios para productNormalizers.ts
 */

import {
  normalizeProductData,
  normalizeNutriments,
  hasNutritionData,
  hasCompleteNutritionData,
  getNutritionCompleteness,
  isValidProduct,
  type RawProduct,
  type ProductNutriments
} from '../productNormalizers';

describe('Product Normalizers', () => {
  describe('normalizeProductData', () => {
    it('should normalize complete API product data', () => {
      const apiProduct: RawProduct = {
        code: '123456789',
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
          salt_100g: 1.2,
          fiber_100g: 3,
          sodium_100g: 480
        }
      };

      const result = normalizeProductData(apiProduct);

      expect(result).toEqual({
        barcode: '123456789',
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
          fiber: 3,
          sodium: 480
        }
      });
    });

    it('should handle OCR product data with alternative field names', () => {
      const ocrProduct: RawProduct = {
        barcode: '987654321',
        name: 'OCR Product',
        brand: 'OCR Brand',
        image_front_url: 'https://ocr.com/image.jpg',
        source: 'OCR Scan',
        confidence: 0.85,
        nutriments: {
          energy_kcal_per_100g: 200,
          protein_g_per_100g: 8,
          fat_g_per_100g: 3,
          carbs_g_per_100g: 25,
          sugars_g_per_100g: 10,
          salt_g_per_100g: 0.8
        }
      };

      const result = normalizeProductData(ocrProduct);

      expect(result).toEqual({
        barcode: '987654321',
        name: 'OCR Product',
        brand: 'OCR Brand',
        serving_size: '100g',
        image_url: 'https://ocr.com/image.jpg',
        categories: '',
        ingredients: '',
        source: 'OCR Scan',
        confidence: 0.85,
        nutriments: {
          energy: 200,
          protein: 8,
          fat: 3,
          carbs: 25,
          sugars: 10,
          salt: 0.8,
          fiber: 0,
          sodium: 0
        }
      });
    });

    it('should handle missing data with defaults', () => {
      const minimalProduct: RawProduct = {};

      const result = normalizeProductData(minimalProduct);

      expect(result).toEqual({
        barcode: 'unknown',
        name: 'Unknown Product',
        brand: '',
        serving_size: '100g',
        image_url: '',
        categories: '',
        ingredients: '',
        source: 'Product Database',
        confidence: 1.0,
        nutriments: {
          energy: 0,
          protein: 0,
          fat: 0,
          carbs: 0,
          sugars: 0,
          salt: 0,
          fiber: 0,
          sodium: 0
        }
      });
    });

    it('should prioritize code over barcode', () => {
      const product: RawProduct = {
        code: '123',
        barcode: '456',
        product_name: 'Test'
      };

      const result = normalizeProductData(product);
      expect(result.barcode).toBe('123');
    });

    it('should prioritize product_name over name', () => {
      const product: RawProduct = {
        product_name: 'Primary Name',
        name: 'Secondary Name'
      };

      const result = normalizeProductData(product);
      expect(result.name).toBe('Primary Name');
    });

    it('should prioritize image_url over image_front_url', () => {
      const product: RawProduct = {
        image_url: 'primary.jpg',
        image_front_url: 'secondary.jpg'
      };

      const result = normalizeProductData(product);
      expect(result.image_url).toBe('primary.jpg');
    });
  });

  describe('normalizeNutriments', () => {
    it('should normalize API format nutriments', () => {
      const nutriments: ProductNutriments = {
        energy_kcal_100g: 300,
        proteins_100g: 15,
        fat_100g: 8,
        carbohydrates_100g: 35,
        sugars_100g: 20,
        salt_100g: 1.5,
        fiber_100g: 4,
        sodium_100g: 600
      };

      const result = normalizeNutriments(nutriments);

      expect(result).toEqual({
        energy: 300,
        protein: 15,
        fat: 8,
        carbs: 35,
        sugars: 20,
        salt: 1.5,
        fiber: 4,
        sodium: 600
      });
    });

    it('should normalize OCR format nutriments', () => {
      const nutriments: ProductNutriments = {
        energy_kcal_per_100g: 250,
        protein_g_per_100g: 12,
        fat_g_per_100g: 6,
        carbs_g_per_100g: 28,
        sugars_g_per_100g: 14,
        salt_g_per_100g: 1.0
      };

      const result = normalizeNutriments(nutriments);

      expect(result).toEqual({
        energy: 250,
        protein: 12,
        fat: 6,
        carbs: 28,
        sugars: 14,
        salt: 1.0,
        fiber: 0,
        sodium: 0
      });
    });

    it('should handle undefined nutriments', () => {
      const result = normalizeNutriments(undefined);

      expect(result).toEqual({
        energy: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        sugars: 0,
        salt: 0,
        fiber: 0,
        sodium: 0
      });
    });

    it('should handle partial nutriments', () => {
      const nutriments: ProductNutriments = {
        energy_kcal_100g: 200,
        // other fields missing
      };

      const result = normalizeNutriments(nutriments);

      expect(result.energy).toBe(200);
      expect(result.protein).toBe(0);
      expect(result.fat).toBe(0);
      expect(result.carbs).toBe(0);
    });
  });

  describe('hasNutritionData', () => {
    it('should return true when energy > 0', () => {
      const nutriments = { energy: 100, protein: 0, fat: 0, carbs: 0, sugars: 0, salt: 0, fiber: 0, sodium: 0 };
      expect(hasNutritionData(nutriments)).toBe(true);
    });

    it('should return true when protein > 0', () => {
      const nutriments = { energy: 0, protein: 5, fat: 0, carbs: 0, sugars: 0, salt: 0, fiber: 0, sodium: 0 };
      expect(hasNutritionData(nutriments)).toBe(true);
    });

    it('should return true when fat > 0', () => {
      const nutriments = { energy: 0, protein: 0, fat: 3, carbs: 0, sugars: 0, salt: 0, fiber: 0, sodium: 0 };
      expect(hasNutritionData(nutriments)).toBe(true);
    });

    it('should return true when carbs > 0', () => {
      const nutriments = { energy: 0, protein: 0, fat: 0, carbs: 25, sugars: 0, salt: 0, fiber: 0, sodium: 0 };
      expect(hasNutritionData(nutriments)).toBe(true);
    });

    it('should return false when all main nutrients are 0', () => {
      const nutriments = { energy: 0, protein: 0, fat: 0, carbs: 0, sugars: 5, salt: 1, fiber: 2, sodium: 50 };
      expect(hasNutritionData(nutriments)).toBe(false);
    });
  });

  describe('hasCompleteNutritionData', () => {
    it('should return true when all main nutrients > 0', () => {
      const nutriments = { energy: 200, protein: 10, fat: 5, carbs: 25, sugars: 0, salt: 0, fiber: 0, sodium: 0 };
      expect(hasCompleteNutritionData(nutriments)).toBe(true);
    });

    it('should return false when energy is 0', () => {
      const nutriments = { energy: 0, protein: 10, fat: 5, carbs: 25, sugars: 0, salt: 0, fiber: 0, sodium: 0 };
      expect(hasCompleteNutritionData(nutriments)).toBe(false);
    });

    it('should return false when protein is 0', () => {
      const nutriments = { energy: 200, protein: 0, fat: 5, carbs: 25, sugars: 0, salt: 0, fiber: 0, sodium: 0 };
      expect(hasCompleteNutritionData(nutriments)).toBe(false);
    });

    it('should return false when fat is 0', () => {
      const nutriments = { energy: 200, protein: 10, fat: 0, carbs: 25, sugars: 0, salt: 0, fiber: 0, sodium: 0 };
      expect(hasCompleteNutritionData(nutriments)).toBe(false);
    });

    it('should return false when carbs is 0', () => {
      const nutriments = { energy: 200, protein: 10, fat: 5, carbs: 0, sugars: 0, salt: 0, fiber: 0, sodium: 0 };
      expect(hasCompleteNutritionData(nutriments)).toBe(false);
    });
  });

  describe('getNutritionCompleteness', () => {
    it('should return 100% for complete data', () => {
      const nutriments = { energy: 200, protein: 10, fat: 5, carbs: 25, sugars: 10, salt: 1, fiber: 3, sodium: 400 };
      expect(getNutritionCompleteness(nutriments)).toBe(100);
    });

    it('should return 50% for half complete data', () => {
      const nutriments = { energy: 200, protein: 10, fat: 0, carbs: 0, sugars: 10, salt: 1, fiber: 0, sodium: 0 };
      expect(getNutritionCompleteness(nutriments)).toBe(50);
    });

    it('should return 0% for empty data', () => {
      const nutriments = { energy: 0, protein: 0, fat: 0, carbs: 0, sugars: 0, salt: 0, fiber: 0, sodium: 0 };
      expect(getNutritionCompleteness(nutriments)).toBe(0);
    });

    it('should handle partial completion', () => {
      const nutriments = { energy: 200, protein: 10, fat: 5, carbs: 25, sugars: 0, salt: 0, fiber: 0, sodium: 0 };
      // 4 required + 0 optional = 4/8 = 50%
      expect(getNutritionCompleteness(nutriments)).toBe(50);
    });
  });

  describe('isValidProduct', () => {
    it('should return true for valid product', () => {
      const product = {
        barcode: '123456789',
        name: 'Valid Product',
        brand: 'Brand',
        serving_size: '100g',
        image_url: '',
        categories: '',
        ingredients: '',
        source: 'Database',
        confidence: 1.0,
        nutriments: { energy: 0, protein: 0, fat: 0, carbs: 0, sugars: 0, salt: 0, fiber: 0, sodium: 0 }
      };
      expect(isValidProduct(product)).toBe(true);
    });

    it('should return false for unknown barcode', () => {
      const product = {
        barcode: 'unknown',
        name: 'Product',
        brand: 'Brand',
        serving_size: '100g',
        image_url: '',
        categories: '',
        ingredients: '',
        source: 'Database',
        confidence: 1.0,
        nutriments: { energy: 0, protein: 0, fat: 0, carbs: 0, sugars: 0, salt: 0, fiber: 0, sodium: 0 }
      };
      expect(isValidProduct(product)).toBe(false);
    });

    it('should return false for unknown name', () => {
      const product = {
        barcode: '123456789',
        name: 'Unknown Product',
        brand: 'Brand',
        serving_size: '100g',
        image_url: '',
        categories: '',
        ingredients: '',
        source: 'Database',
        confidence: 1.0,
        nutriments: { energy: 0, protein: 0, fat: 0, carbs: 0, sugars: 0, salt: 0, fiber: 0, sodium: 0 }
      };
      expect(isValidProduct(product)).toBe(false);
    });

    it('should return false for empty barcode', () => {
      const product = {
        barcode: '',
        name: 'Product',
        brand: 'Brand',
        serving_size: '100g',
        image_url: '',
        categories: '',
        ingredients: '',
        source: 'Database',
        confidence: 1.0,
        nutriments: { energy: 0, protein: 0, fat: 0, carbs: 0, sugars: 0, salt: 0, fiber: 0, sodium: 0 }
      };
      expect(isValidProduct(product)).toBe(false);
    });
  });
});
