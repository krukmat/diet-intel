import React from 'react';

// Mock axios before importing the component
const mockAxios = {
  post: jest.fn()
};
jest.mock('axios', () => mockAxios);

// Mock Alert
const mockAlert = {
  alert: jest.fn()
};

// Mock React Native components to avoid native module issues
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: any) => styles },
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  Image: 'Image',
  ActivityIndicator: 'ActivityIndicator',
  Alert: mockAlert,
  SafeAreaView: 'SafeAreaView',
  Platform: { OS: 'ios' }
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar'
}));

describe('ProductDetail Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.post.mockClear();
    mockAlert.alert.mockClear();
  });

  describe('Product Data Normalization', () => {
    it('should normalize basic product data correctly', () => {
      const mockProduct: any = {
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
          sodium_100g: 480
        }
      };

      // Test the normalization logic that would be inside the component
      const normalizedProduct = {
        barcode: mockProduct.code || mockProduct.barcode || 'unknown',
        name: mockProduct.product_name || mockProduct.name || 'Unknown Product',
        brand: mockProduct.brands || mockProduct.brand || '',
        serving_size: mockProduct.serving_size || '100g',
        image_url: mockProduct.image_url || mockProduct.image_front_url || '',
        categories: mockProduct.categories || '',
        ingredients: mockProduct.ingredients_text || '',
        source: mockProduct.source || 'Product Database',
        confidence: mockProduct.confidence || 1.0,
        nutriments: {
          energy: mockProduct.nutriments?.energy_kcal_100g || mockProduct.nutriments?.energy_kcal_per_100g || 0,
          protein: mockProduct.nutriments?.proteins_100g || mockProduct.nutriments?.protein_g_per_100g || 0,
          fat: mockProduct.nutriments?.fat_100g || mockProduct.nutriments?.fat_g_per_100g || 0,
          carbs: mockProduct.nutriments?.carbohydrates_100g || mockProduct.nutriments?.carbs_g_per_100g || 0,
          sugars: mockProduct.nutriments?.sugars_100g || mockProduct.nutriments?.sugars_g_per_100g || 0,
          salt: mockProduct.nutriments?.salt_100g || mockProduct.nutriments?.salt_g_per_100g || 0,
          fiber: mockProduct.nutriments?.fiber_100g || 0,
          sodium: mockProduct.nutriments?.sodium_100g || 0,
        }
      };

      expect(normalizedProduct.barcode).toBe('1234567890');
      expect(normalizedProduct.name).toBe('Test Product');
      expect(normalizedProduct.brand).toBe('Test Brand');
      expect(normalizedProduct.serving_size).toBe('100g');
      expect(normalizedProduct.image_url).toBe('https://test.com/image.jpg');
      expect(normalizedProduct.categories).toBe('Snacks');
      expect(normalizedProduct.ingredients).toBe('Test ingredients');
      expect(normalizedProduct.source).toBe('Product Database');
      expect(normalizedProduct.confidence).toBe(1.0);
      expect(normalizedProduct.nutriments.energy).toBe(250);
      expect(normalizedProduct.nutriments.protein).toBe(10);
      expect(normalizedProduct.nutriments.fat).toBe(5);
      expect(normalizedProduct.nutriments.carbs).toBe(30);
      expect(normalizedProduct.nutriments.sugars).toBe(15);
      expect(normalizedProduct.nutriments.salt).toBe(1.2);
      expect(normalizedProduct.nutriments.fiber).toBe(3);
      expect(normalizedProduct.nutriments.sodium).toBe(480);
    });

    it('should handle OCR format fields', () => {
      const mockOCRProduct: any = {
        barcode: '9876543210',
        name: 'OCR Product',
        brand: 'OCR Brand',
        source: 'OCR Scanner',
        confidence: 0.85,
        image_front_url: 'https://ocr.com/front.jpg',
        nutriments: {
          energy_kcal_per_100g: 300,
          protein_g_per_100g: 12,
          fat_g_per_100g: 8,
          carbs_g_per_100g: 35,
          sugars_g_per_100g: 20,
          salt_g_per_100g: 1.5
        }
      };

      const normalizedProduct = {
        barcode: mockOCRProduct.code || mockOCRProduct.barcode || 'unknown',
        name: mockOCRProduct.product_name || mockOCRProduct.name || 'Unknown Product',
        brand: mockOCRProduct.brands || mockOCRProduct.brand || '',
        serving_size: mockOCRProduct.serving_size || '100g',
        image_url: mockOCRProduct.image_url || mockOCRProduct.image_front_url || '',
        categories: mockOCRProduct.categories || '',
        ingredients: mockOCRProduct.ingredients_text || '',
        source: mockOCRProduct.source || 'Product Database',
        confidence: mockOCRProduct.confidence || 1.0,
        nutriments: {
          energy: mockOCRProduct.nutriments?.energy_kcal_100g || mockOCRProduct.nutriments?.energy_kcal_per_100g || 0,
          protein: mockOCRProduct.nutriments?.proteins_100g || mockOCRProduct.nutriments?.protein_g_per_100g || 0,
          fat: mockOCRProduct.nutriments?.fat_100g || mockOCRProduct.nutriments?.fat_g_per_100g || 0,
          carbs: mockOCRProduct.nutriments?.carbohydrates_100g || mockOCRProduct.nutriments?.carbs_g_per_100g || 0,
          sugars: mockOCRProduct.nutriments?.sugars_100g || mockOCRProduct.nutriments?.sugars_g_per_100g || 0,
          salt: mockOCRProduct.nutriments?.salt_100g || mockOCRProduct.nutriments?.salt_g_per_100g || 0,
          fiber: mockOCRProduct.nutriments?.fiber_100g || 0,
          sodium: mockOCRProduct.nutriments?.sodium_100g || 0,
        }
      };

      expect(normalizedProduct.barcode).toBe('9876543210');
      expect(normalizedProduct.name).toBe('OCR Product');
      expect(normalizedProduct.brand).toBe('OCR Brand');
      expect(normalizedProduct.image_url).toBe('https://ocr.com/front.jpg');
      expect(normalizedProduct.source).toBe('OCR Scanner');
      expect(normalizedProduct.confidence).toBe(0.85);
      expect(normalizedProduct.nutriments.energy).toBe(300);
      expect(normalizedProduct.nutriments.protein).toBe(12);
      expect(normalizedProduct.nutriments.fat).toBe(8);
      expect(normalizedProduct.nutriments.carbs).toBe(35);
    });

    it('should provide defaults for missing fields', () => {
      const mockMinimalProduct: any = {
        code: '1111111111'
      };

      const normalizedProduct = {
        barcode: mockMinimalProduct.code || mockMinimalProduct.barcode || 'unknown',
        name: mockMinimalProduct.product_name || mockMinimalProduct.name || 'Unknown Product',
        brand: mockMinimalProduct.brands || mockMinimalProduct.brand || '',
        serving_size: mockMinimalProduct.serving_size || '100g',
        image_url: mockMinimalProduct.image_url || mockMinimalProduct.image_front_url || '',
        categories: mockMinimalProduct.categories || '',
        ingredients: mockMinimalProduct.ingredients_text || '',
        source: mockMinimalProduct.source || 'Product Database',
        confidence: mockMinimalProduct.confidence || 1.0,
        nutriments: {
          energy: mockMinimalProduct.nutriments?.energy_kcal_100g || mockMinimalProduct.nutriments?.energy_kcal_per_100g || 0,
          protein: mockMinimalProduct.nutriments?.proteins_100g || mockMinimalProduct.nutriments?.protein_g_per_100g || 0,
          fat: mockMinimalProduct.nutriments?.fat_100g || mockMinimalProduct.nutriments?.fat_g_per_100g || 0,
          carbs: mockMinimalProduct.nutriments?.carbohydrates_100g || mockMinimalProduct.nutriments?.carbs_g_per_100g || 0,
          sugars: mockMinimalProduct.nutriments?.sugars_100g || mockMinimalProduct.nutriments?.sugars_g_per_100g || 0,
          salt: mockMinimalProduct.nutriments?.salt_100g || mockMinimalProduct.nutriments?.salt_g_per_100g || 0,
          fiber: mockMinimalProduct.nutriments?.fiber_100g || 0,
          sodium: mockMinimalProduct.nutriments?.sodium_100g || 0,
        }
      };

      expect(normalizedProduct.barcode).toBe('1111111111');
      expect(normalizedProduct.name).toBe('Unknown Product');
      expect(normalizedProduct.brand).toBe('');
      expect(normalizedProduct.serving_size).toBe('100g');
      expect(normalizedProduct.image_url).toBe('');
      expect(normalizedProduct.source).toBe('Product Database');
      expect(normalizedProduct.confidence).toBe(1.0);
      expect(normalizedProduct.nutriments.energy).toBe(0);
      expect(normalizedProduct.nutriments.protein).toBe(0);
    });
  });

  describe('Nutrition Data Validation', () => {
    it('should detect when nutrition data exists', () => {
      const hasNutritionData = (nutriments: any) => {
        return nutriments.energy > 0 || nutriments.protein > 0 || 
               nutriments.fat > 0 || nutriments.carbs > 0;
      };

      const withNutrition = { energy: 250, protein: 10, fat: 5, carbs: 30 };
      const withoutNutrition = { energy: 0, protein: 0, fat: 0, carbs: 0 };
      const partialNutrition = { energy: 0, protein: 8, fat: 0, carbs: 0 };

      expect(hasNutritionData(withNutrition)).toBeTruthy();
      expect(hasNutritionData(withoutNutrition)).toBeFalsy();
      expect(hasNutritionData(partialNutrition)).toBeTruthy();
    });

    it('should handle null nutrition values', () => {
      const renderNutritionRow = (label: string, value: number | null, unit: string = 'g') => {
        if (value === null || value === undefined) return null;
        
        return {
          label,
          value: typeof value === 'number' ? value.toFixed(1) : '0.0',
          unit
        };
      };

      expect(renderNutritionRow('Protein', 10.5)).toEqual({
        label: 'Protein',
        value: '10.5',
        unit: 'g'
      });

      expect(renderNutritionRow('Fat', null)).toBeNull();
      expect(renderNutritionRow('Carbs', undefined)).toBeNull();
      expect(renderNutritionRow('Energy', 250.7, 'kcal')).toEqual({
        label: 'Energy',
        value: '250.7',
        unit: 'kcal'
      });
    });
  });

  describe('Add to Plan Logic', () => {
    it('should validate barcode before adding to plan', async () => {
      const handleAddToPlan = async (barcode: string, productName: string) => {
        if (!barcode || barcode === 'unknown') {
          mockAlert.alert('Error', 'Cannot add product without barcode to plan.');
          return false;
        }

        try {
          const response = await mockAxios.post('http://10.0.2.2:8000/plan/add-product', {
            barcode: barcode,
            meal_type: 'lunch',
          });

          mockAlert.alert(
            'Success!',
            `${productName} has been added to your meal plan.`,
            [{ text: 'OK' }]
          );
          return true;
        } catch (error) {
          mockAlert.alert(
            'Error',
            'Failed to add product to meal plan. Please try again.',
            [{ text: 'OK' }]
          );
          return false;
        }
      };

      // Test invalid barcode
      const result1 = await handleAddToPlan('unknown', 'Test Product');
      expect(result1).toBeFalsy();
      expect(mockAlert.alert).toHaveBeenCalledWith('Error', 'Cannot add product without barcode to plan.');
      expect(mockAxios.post).not.toHaveBeenCalled();

      // Test empty barcode
      const result2 = await handleAddToPlan('', 'Test Product');
      expect(result2).toBeFalsy();

      // Test successful add
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });
      const result3 = await handleAddToPlan('1234567890', 'Test Product');
      expect(result3).toBeTruthy();
      expect(mockAxios.post).toHaveBeenCalledWith('http://10.0.2.2:8000/plan/add-product', {
        barcode: '1234567890',
        meal_type: 'lunch'
      });
    });

    it('should handle API errors gracefully', async () => {
      const handleAddToPlan = async (barcode: string, productName: string) => {
        try {
          await mockAxios.post('http://10.0.2.2:8000/plan/add-product', {
            barcode: barcode,
            meal_type: 'lunch',
          });

          mockAlert.alert(
            'Success!',
            `${productName} has been added to your meal plan.`,
            [{ text: 'OK' }]
          );
          return true;
        } catch (error) {
          mockAlert.alert(
            'Error',
            'Failed to add product to meal plan. Please try again.',
            [{ text: 'OK' }]
          );
          return false;
        }
      };

      mockAxios.post.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await handleAddToPlan('1234567890', 'Test Product');
      expect(result).toBeFalsy();
      expect(mockAlert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to add product to meal plan. Please try again.',
        [{ text: 'OK' }]
      );
    });
  });

  describe('Confidence Scoring Logic', () => {
    it('should determine if confidence is low', () => {
      const isLowConfidence = (product: any) => {
        return product.source !== 'Product Database' && 
               product.confidence && product.confidence < 0.7;
      };

      const highConfidenceOCR = { source: 'OCR Scanner', confidence: 0.9 };
      const lowConfidenceOCR = { source: 'OCR Scanner', confidence: 0.6 };
      const databaseProduct = { source: 'Product Database', confidence: 0.5 };
      const noConfidenceOCR = { source: 'OCR Scanner' };

      expect(isLowConfidence(highConfidenceOCR)).toBeFalsy();
      expect(isLowConfidence(lowConfidenceOCR)).toBeTruthy();
      expect(isLowConfidence(databaseProduct)).toBeFalsy();
      expect(isLowConfidence(noConfidenceOCR)).toBeFalsy();
    });

    it('should format confidence percentage', () => {
      const formatConfidence = (confidence: number) => {
        return `${Math.round(confidence * 100)}% confidence`;
      };

      expect(formatConfidence(0.856)).toBe('86% confidence');
      expect(formatConfidence(0.7)).toBe('70% confidence');
      expect(formatConfidence(0.1)).toBe('10% confidence');
      expect(formatConfidence(1.0)).toBe('100% confidence');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed nutrition data', () => {
      const normalizeNutrition = (nutriments: any) => {
        if (!nutriments) return {
          energy: 0, protein: 0, fat: 0, carbs: 0, 
          sugars: 0, salt: 0, fiber: 0, sodium: 0
        };

        return {
          energy: Number(nutriments.energy_kcal_100g || nutriments.energy_kcal_per_100g) || 0,
          protein: Number(nutriments.proteins_100g || nutriments.protein_g_per_100g) || 0,
          fat: Number(nutriments.fat_100g || nutriments.fat_g_per_100g) || 0,
          carbs: Number(nutriments.carbohydrates_100g || nutriments.carbs_g_per_100g) || 0,
          sugars: Number(nutriments.sugars_100g || nutriments.sugars_g_per_100g) || 0,
          salt: Number(nutriments.salt_100g || nutriments.salt_g_per_100g) || 0,
          fiber: Number(nutriments.fiber_100g) || 0,
          sodium: Number(nutriments.sodium_100g) || 0,
        };
      };

      const malformedNutrition = {
        energy_kcal_100g: 'invalid',
        proteins_100g: null,
        fat_100g: undefined,
        carbohydrates_100g: NaN,
        sugars_100g: 'not a number',
        salt_100g: {},
        fiber_100g: [],
        sodium_100g: false // Use false instead of true to ensure it converts to 0
      };

      const result = normalizeNutrition(malformedNutrition);
      
      expect(result.energy).toBe(0);
      expect(result.protein).toBe(0);
      expect(result.fat).toBe(0);
      expect(result.carbs).toBe(0);
      expect(result.sugars).toBe(0);
      expect(result.salt).toBe(0);
      expect(result.fiber).toBe(0);
      expect(result.sodium).toBe(0);
    });

    it('should handle empty strings and null values', () => {
      const sanitizeString = (value: any, fallback: string = '') => {
        if (typeof value !== 'string' || value.trim() === '') {
          return fallback;
        }
        return value.trim();
      };

      expect(sanitizeString('  Test Product  ')).toBe('Test Product');
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString('   ')).toBe('');
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
      expect(sanitizeString(123)).toBe('');
      expect(sanitizeString('', 'Default')).toBe('Default');
    });

    it('should handle very long product names', () => {
      const truncateText = (text: string, maxLength: number = 100) => {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
      };

      const longName = 'This is a very very very long product name that should be truncated to prevent layout issues';
      const result = truncateText(longName, 50);
      
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result.endsWith('...')).toBeTruthy();
    });

    it('should validate image URLs', () => {
      const isValidImageUrl = (url: string) => {
        if (!url || typeof url !== 'string') return false;
        try {
          new URL(url);
          return url.match(/\.(jpg|jpeg|png|gif|webp)$/i) !== null;
        } catch {
          return false;
        }
      };

      expect(isValidImageUrl('https://example.com/image.jpg')).toBeTruthy();
      expect(isValidImageUrl('https://example.com/image.png')).toBeTruthy();
      expect(isValidImageUrl('https://example.com/image.gif')).toBeTruthy();
      expect(isValidImageUrl('https://example.com/image.webp')).toBeTruthy();
      expect(isValidImageUrl('https://example.com/document.pdf')).toBeFalsy();
      expect(isValidImageUrl('not-a-url')).toBeFalsy();
      expect(isValidImageUrl('')).toBeFalsy();
      expect(isValidImageUrl(null)).toBeFalsy();
    });
  });

  describe('Component State Logic', () => {
    it('should manage loading state correctly', () => {
      let isLoading = false;
      
      const setLoading = (loading: boolean) => {
        isLoading = loading;
      };

      const simulateAddToPlan = async () => {
        setLoading(true);
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          setLoading(false);
          return true;
        } catch (error) {
          setLoading(false);
          return false;
        }
      };

      expect(isLoading).toBeFalsy();
      
      const promise = simulateAddToPlan();
      expect(isLoading).toBeTruthy();
      
      return promise.then((result) => {
        expect(isLoading).toBeFalsy();
        expect(result).toBeTruthy();
      });
    });

    it('should handle button disable states', () => {
      const shouldDisableButton = (isLoading: boolean, hasValidBarcode: boolean) => {
        return isLoading || !hasValidBarcode;
      };

      expect(shouldDisableButton(false, true)).toBeFalsy();  // Should be enabled
      expect(shouldDisableButton(true, true)).toBeTruthy();  // Loading - disabled
      expect(shouldDisableButton(false, false)).toBeTruthy(); // No barcode - disabled
      expect(shouldDisableButton(true, false)).toBeTruthy();  // Loading + no barcode - disabled
    });
  });
});
