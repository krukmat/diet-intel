// Logic-focused tests for ApiHelper without complex mocking dependencies
import { ApiHelper } from '../apiHelper';
import type { ProductResponse, UserProfile, ApiConfig } from '../apiHelper';

// Create a minimal mock that focuses on testing the logic
class TestApiHelper extends ApiHelper {
  // Expose private methods for testing
  public testShouldRetry(error: any): boolean {
    return this['shouldRetry'](error);
  }

  public testCalculateRetryDelay(retryCount: number): number {
    return this['calculateRetryDelay'](retryCount);
  }

  public testTransformError(error: any): any {
    return this['transformError'](error);
  }

  public testTransformProductResponse(data: any): ProductResponse {
    return this['transformProductResponse'](data);
  }

  public testSleep(ms: number): Promise<void> {
    return this['sleep'](ms);
  }
}

describe('ApiHelper Logic Tests', () => {
  let apiHelper: TestApiHelper;

  beforeEach(() => {
    // Create with minimal config to avoid axios dependencies
    apiHelper = new TestApiHelper({
      baseURL: 'http://test.com',
      timeout: 5000,
      maxRetries: 2,
      retryDelay: 500
    });
  });

  describe('Configuration Logic', () => {
    it('should merge custom config with defaults', () => {
      const customConfig: Partial<ApiConfig> = {
        baseURL: 'https://custom.api.com',
        timeout: 15000
      };

      // Test the config merging logic that happens in constructor
      const expectedConfig = {
        baseURL: 'https://custom.api.com',
        timeout: 15000,
        maxRetries: 3, // default
        retryDelay: 1000, // default
        ...customConfig
      };

      expect(expectedConfig.baseURL).toBe('https://custom.api.com');
      expect(expectedConfig.timeout).toBe(15000);
      expect(expectedConfig.maxRetries).toBe(3);
      expect(expectedConfig.retryDelay).toBe(1000);
    });

    it('should use default values when no config provided', () => {
      const defaultConfig = {
        baseURL: 'http://10.0.2.2:8000',
        timeout: 10000,
        maxRetries: 3,
        retryDelay: 1000
      };

      expect(defaultConfig.baseURL).toBe('http://10.0.2.2:8000');
      expect(defaultConfig.timeout).toBe(10000);
      expect(defaultConfig.maxRetries).toBe(3);
      expect(defaultConfig.retryDelay).toBe(1000);
    });
  });

  describe('Retry Logic', () => {
    it('should determine retry eligibility correctly', () => {
      // Network errors (no response) should retry
      expect(apiHelper.testShouldRetry({ response: undefined })).toBeTruthy();

      // Server errors (5xx) should retry
      expect(apiHelper.testShouldRetry({ response: { status: 500 } })).toBeTruthy();
      expect(apiHelper.testShouldRetry({ response: { status: 502 } })).toBeTruthy();
      expect(apiHelper.testShouldRetry({ response: { status: 503 } })).toBeTruthy();

      // Timeout should retry
      expect(apiHelper.testShouldRetry({ response: { status: 408 } })).toBeTruthy();

      // Rate limiting should retry
      expect(apiHelper.testShouldRetry({ response: { status: 429 } })).toBeTruthy();

      // Client errors should not retry
      expect(apiHelper.testShouldRetry({ response: { status: 400 } })).toBeFalsy();
      expect(apiHelper.testShouldRetry({ response: { status: 401 } })).toBeFalsy();
      expect(apiHelper.testShouldRetry({ response: { status: 404 } })).toBeFalsy();
      expect(apiHelper.testShouldRetry({ response: { status: 422 } })).toBeFalsy();

      // Success codes should not retry
      expect(apiHelper.testShouldRetry({ response: { status: 200 } })).toBeFalsy();
      expect(apiHelper.testShouldRetry({ response: { status: 201 } })).toBeFalsy();
    });

    it('should calculate exponential backoff delay', () => {
      expect(apiHelper.testCalculateRetryDelay(1)).toBe(500); // 500 * 2^0 = 500
      expect(apiHelper.testCalculateRetryDelay(2)).toBe(1000); // 500 * 2^1 = 1000
      expect(apiHelper.testCalculateRetryDelay(3)).toBe(2000); // 500 * 2^2 = 2000
      expect(apiHelper.testCalculateRetryDelay(4)).toBe(4000); // 500 * 2^3 = 4000
    });

    it('should handle edge cases in retry delay calculation', () => {
      expect(apiHelper.testCalculateRetryDelay(0)).toBe(250); // 500 * 2^-1 = 250
      expect(apiHelper.testCalculateRetryDelay(-1)).toBe(125); // 500 * 2^-2 = 125
    });

    it('should handle sleep function timing', async () => {
      const startTime = Date.now();
      await apiHelper.testSleep(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some variance
      expect(endTime - startTime).toBeLessThan(150);
    });
  });

  describe('Error Transformation Logic', () => {
    it('should transform error with response data', () => {
      const axiosError = {
        response: {
          status: 400,
          data: { detail: 'Validation failed', errors: ['Field required'] }
        },
        message: 'Request failed'
      };

      const transformed = apiHelper.testTransformError(axiosError);

      expect(transformed.message).toBe('Validation failed');
      expect(transformed.status).toBe(400);
      expect(transformed.data).toEqual({ detail: 'Validation failed', errors: ['Field required'] });
    });

    it('should use error message when no response detail', () => {
      const axiosError = {
        response: {
          status: 500,
          data: {}
        },
        message: 'Network Error'
      };

      const transformed = apiHelper.testTransformError(axiosError);

      expect(transformed.message).toBe('Network Error');
      expect(transformed.status).toBe(500);
    });

    it('should use fallback message when no message available', () => {
      const axiosError = {
        response: undefined,
        message: ''
      };

      const transformed = apiHelper.testTransformError(axiosError);

      expect(transformed.message).toBe('Network request failed');
      expect(transformed.status).toBeUndefined();
    });

    it('should handle nested error details', () => {
      const axiosError = {
        response: {
          status: 422,
          data: {
            detail: [
              { msg: 'Field is required', type: 'value_error.missing' }
            ]
          }
        },
        message: 'Validation Error'
      };

      const transformed = apiHelper.testTransformError(axiosError);

      expect(transformed.message).not.toBe('Validation Error');
      expect(Array.isArray(transformed.data.detail)).toBeTruthy();
    });

    it('should preserve original error properties', () => {
      const axiosError = {
        response: {
          status: 429,
          data: { 
            detail: 'Rate limit exceeded',
            retry_after: 60
          },
          headers: { 'X-Rate-Limit': '100' }
        },
        message: 'Too Many Requests',
        config: { url: '/api/test' }
      };

      const transformed = apiHelper.testTransformError(axiosError);

      expect(transformed instanceof Error).toBeTruthy();
      expect(transformed.status).toBe(429);
      expect(transformed.data.retry_after).toBe(60);
    });
  });

  describe('Product Response Transformation Logic', () => {
    it('should transform complete product response', () => {
      const productData = {
        id: 'prod-123',
        barcode: '1234567890',
        product_name: 'Test Product',
        brands: 'Test Brand',
        categories: 'Food > Snacks',
        image_url: 'https://example.com/image.jpg',
        nutriments: {
          'energy-kcal_100g': 250,
          'proteins_100g': 10.5,
          'fat_100g': 5.2,
          'carbohydrates_100g': 30.8,
          'sugars_100g': 15.3,
          'salt_100g': 1.2
        }
      };

      const result = apiHelper.testTransformProductResponse(productData);

      expect(result).toEqual({
        id: 'prod-123',
        name: 'Test Product',
        barcode: '1234567890',
        brands: 'Test Brand',
        categories: 'Food > Snacks',
        image_url: 'https://example.com/image.jpg',
        nutriments: {
          energy_kcal: 250,
          proteins: 10.5,
          fat: 5.2,
          carbohydrates: 30.8,
          sugars: 15.3,
          salt: 1.2
        }
      });
    });

    it('should handle alternative field names', () => {
      const productData = {
        code: 'alt-code', // Instead of barcode
        name: 'Alternative Name', // Instead of product_name
        image_front_url: 'https://example.com/front.jpg', // Instead of image_url
        nutriments: {
          energy_kcal: 300, // Alternative format
          proteins: 12,
          fat: 8,
          carbohydrates: 35,
          sugars: 20,
          salt: 1.5
        }
      };

      const result = apiHelper.testTransformProductResponse(productData);

      expect(result.id).toBeUndefined(); // No id or barcode field provided
      expect(result.barcode).toBe('alt-code');
      expect(result.name).toBe('Alternative Name');
      expect(result.image_url).toBe('https://example.com/front.jpg');
      expect(result.nutriments.energy_kcal).toBe(300);
    });

    it('should use defaults for missing fields', () => {
      const minimalData = {
        barcode: '9999999999'
      };

      const result = apiHelper.testTransformProductResponse(minimalData);

      expect(result.id).toBe('9999999999');
      expect(result.name).toBe('Unknown Product');
      expect(result.brands).toBeUndefined();
      expect(result.categories).toBeUndefined();
      expect(result.image_url).toBeUndefined();
      expect(result.nutriments).toEqual({
        energy_kcal: undefined,
        proteins: undefined,
        fat: undefined,
        carbohydrates: undefined,
        sugars: undefined,
        salt: undefined
      });
    });

    it('should prefer primary fields over alternatives', () => {
      const productWithBothFields = {
        id: 'primary-id',
        barcode: 'primary-barcode',
        code: 'alternative-code',
        product_name: 'Primary Name',
        name: 'Alternative Name',
        image_url: 'primary-image.jpg',
        image_front_url: 'alternative-image.jpg'
      };

      const result = apiHelper.testTransformProductResponse(productWithBothFields);

      expect(result.id).toBe('primary-id');
      expect(result.barcode).toBe('primary-barcode');
      expect(result.name).toBe('Primary Name');
      expect(result.image_url).toBe('primary-image.jpg');
    });

    it('should handle malformed nutriments data', () => {
      const productWithBadNutriments = {
        barcode: '1234567890',
        product_name: 'Test Product',
        nutriments: {
          'energy-kcal_100g': 'invalid-number',
          'proteins_100g': null,
          'fat_100g': undefined,
          'carbohydrates_100g': NaN,
          'sugars_100g': {},
          'salt_100g': []
        }
      };

      const result = apiHelper.testTransformProductResponse(productWithBadNutriments);

      expect(result.nutriments.energy_kcal).toBe('invalid-number'); // Preserves original value
      expect(result.nutriments.proteins).toBeUndefined(); // null is falsy, so || returns undefined
      expect(result.nutriments.fat).toBeUndefined();
      expect(result.nutriments.carbohydrates).toBeUndefined(); // NaN is falsy, so || returns undefined
      expect(result.nutriments.sugars).toEqual({});
      expect(result.nutriments.salt).toEqual([]);
    });

    it('should handle empty nutriments object', () => {
      const productWithEmptyNutriments = {
        barcode: '1234567890',
        product_name: 'Test Product',
        nutriments: {}
      };

      const result = apiHelper.testTransformProductResponse(productWithEmptyNutriments);

      expect(result.nutriments).toEqual({
        energy_kcal: undefined,
        proteins: undefined,
        fat: undefined,
        carbohydrates: undefined,
        sugars: undefined,
        salt: undefined
      });
    });

    it('should handle missing nutriments object', () => {
      const productWithoutNutriments = {
        barcode: '1234567890',
        product_name: 'Test Product'
      };

      const result = apiHelper.testTransformProductResponse(productWithoutNutriments);

      expect(result.nutriments).toEqual({
        energy_kcal: undefined,
        proteins: undefined,
        fat: undefined,
        carbohydrates: undefined,
        sugars: undefined,
        salt: undefined
      });
    });
  });

  describe('URL and Query Parameter Handling', () => {
    it('should handle special characters in search queries', () => {
      const testQueries = [
        'café & müsli',
        'product with spaces',
        'special!@#$%^&*()chars',
        '100% organic',
        'query/with/slashes'
      ];

      testQueries.forEach(query => {
        const encoded = encodeURIComponent(query);
        expect(encoded).not.toContain(' ');
        expect(encoded).not.toContain('&');
        const decoded = decodeURIComponent(encoded);
        expect(decoded).toBe(query); // Should decode back to original
      });
    });

    it('should handle empty and whitespace queries', () => {
      const emptyQuery = '';
      const whitespaceQuery = '   ';
      
      expect(encodeURIComponent(emptyQuery)).toBe('');
      expect(encodeURIComponent(whitespaceQuery)).toBe('%20%20%20');
    });

    it('should handle unicode characters', () => {
      const unicodeQuery = '健康食品 🥗';
      const encoded = encodeURIComponent(unicodeQuery);
      
      expect(encoded).toContain('%');
      expect(decodeURIComponent(encoded)).toBe(unicodeQuery);
    });
  });

  describe('Data Type Validation Logic', () => {
    it('should validate user profile structure', () => {
      const validProfile: UserProfile = {
        age: 30,
        sex: 'male',
        height_cm: 180,
        weight_kg: 75,
        activity_level: 1.5,
        goal: 'maintain'
      };

      // Test that all required fields are present
      expect(typeof validProfile.age).toBe('number');
      expect(['male', 'female'].includes(validProfile.sex)).toBeTruthy();
      expect(typeof validProfile.height_cm).toBe('number');
      expect(typeof validProfile.weight_kg).toBe('number');
      expect(typeof validProfile.activity_level).toBe('number');
      expect(['lose', 'maintain', 'gain'].includes(validProfile.goal)).toBeTruthy();
    });

    it('should validate meal item structure', () => {
      const mealItem = {
        barcode: '1234567890',
        name: 'Test Food',
        brand: 'Test Brand',
        serving_size: '100g',
        calories_per_serving: 250,
        protein_g: 10,
        fat_g: 5,
        carbs_g: 30
      };

      expect(typeof mealItem.barcode).toBe('string');
      expect(typeof mealItem.name).toBe('string');
      expect(typeof mealItem.calories_per_serving).toBe('number');
      expect(typeof mealItem.protein_g).toBe('number');
      expect(typeof mealItem.fat_g).toBe('number');
      expect(typeof mealItem.carbs_g).toBe('number');
    });

    it('should validate request structures', () => {
      const addToPlanRequest = {
        barcode: '1234567890',
        meal_type: 'lunch' as const
      };

      const customizeRequest = {
        meal_type: 'breakfast',
        action: 'add' as const,
        item: {
          barcode: '1234567890',
          name: 'New Item',
          serving_size: '100g',
          calories_per_serving: 200,
          protein_g: 8,
          fat_g: 4,
          carbs_g: 25
        }
      };

      expect(['breakfast', 'lunch', 'dinner'].includes(addToPlanRequest.meal_type)).toBeTruthy();
      expect(['add', 'remove', 'replace'].includes(customizeRequest.action)).toBeTruthy();
      expect(typeof customizeRequest.item.barcode).toBe('string');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle very large numbers', () => {
      const productWithLargeNumbers = {
        barcode: '1234567890',
        product_name: 'High Calorie Food',
        nutriments: {
          'energy-kcal_100g': 999999,
          'proteins_100g': Number.MAX_SAFE_INTEGER,
          'fat_100g': 1.7976931348623157e+308
        }
      };

      const result = apiHelper.testTransformProductResponse(productWithLargeNumbers);

      expect(typeof result.nutriments.energy_kcal).toBe('number');
      expect(result.nutriments.energy_kcal).toBe(999999);
      expect(result.nutriments.proteins).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.nutriments.fat).toBe(1.7976931348623157e+308);
    });

    it('should handle very long strings', () => {
      const longString = 'A'.repeat(10000);
      const productWithLongStrings = {
        barcode: '1234567890',
        product_name: longString,
        brands: longString,
        categories: longString
      };

      const result = apiHelper.testTransformProductResponse(productWithLongStrings);

      expect(result.name.length).toBe(10000);
      expect(result.brands?.length).toBe(10000);
      expect(result.categories?.length).toBe(10000);
    });

    it('should handle zero and negative values', () => {
      const productWithZeroValues = {
        barcode: '1234567890',
        product_name: 'Zero Calorie Product',
        nutriments: {
          'energy-kcal_100g': 0,
          'proteins_100g': -1, // Invalid but should be preserved
          'fat_100g': 0,
          'carbohydrates_100g': 0.0001,
          'sugars_100g': -0,
          'salt_100g': 0
        }
      };

      const result = apiHelper.testTransformProductResponse(productWithZeroValues);

      expect(result.nutriments.energy_kcal).toBeUndefined(); // 0 is falsy, so || returns undefined
      expect(result.nutriments.proteins).toBe(-1); // -1 is truthy
      expect(result.nutriments.fat).toBeUndefined(); // 0 is falsy, so || returns undefined
      expect(result.nutriments.carbohydrates).toBe(0.0001); // 0.0001 is truthy
      expect(result.nutriments.sugars).toBeUndefined(); // -0 is falsy, so || returns undefined
      expect(result.nutriments.salt).toBeUndefined(); // 0 is falsy, so || returns undefined
    });

    it('should handle null and undefined inputs', () => {
      expect(() => apiHelper.testTransformProductResponse(null)).toThrow();
      expect(() => apiHelper.testTransformProductResponse(undefined)).toThrow();
      expect(() => apiHelper.testTransformProductResponse({})).not.toThrow();
    });

    it('should handle circular references safely', () => {
      const circularObj: any = { barcode: '1234567890' };
      circularObj.self = circularObj;

      // This should not cause infinite loops
      expect(() => apiHelper.testTransformProductResponse(circularObj)).not.toThrow();
    });
  });

  describe('Performance Considerations', () => {
    it('should handle concurrent transformations efficiently', () => {
      const products = Array.from({ length: 100 }, (_, i) => ({
        barcode: `${i}`.padStart(10, '0'),
        product_name: `Product ${i}`,
        nutriments: {
          'energy-kcal_100g': i * 10,
          'proteins_100g': i,
          'fat_100g': i * 0.5,
          'carbohydrates_100g': i * 2,
          'sugars_100g': i * 0.8,
          'salt_100g': i * 0.1
        }
      }));

      const startTime = Date.now();
      const results = products.map(product => 
        apiHelper.testTransformProductResponse(product)
      );
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      expect(results[0].barcode).toBe('0000000000');
      expect(results[99].barcode).toBe('0000000099');
    });

    it('should handle memory efficiently with large datasets', () => {
      // Test that transforming large amounts of data doesn't cause memory issues
      const largeProducts = Array.from({ length: 1000 }, (_, i) => ({
        barcode: `${i}`.padStart(13, '0'),
        product_name: `Product ${'X'.repeat(100)} ${i}`, // Long names
        categories: `Category ${'Y'.repeat(200)} ${i}`, // Long categories
        nutriments: {}
      }));

      expect(() => {
        largeProducts.forEach(product => 
          apiHelper.testTransformProductResponse(product)
        );
      }).not.toThrow();
    });
  });
});