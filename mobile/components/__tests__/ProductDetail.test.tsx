import React from 'react';
import TestRenderer from 'react-test-renderer';
import ProductDetail from '../ProductDetail';

// Mock axios
const mockAxios = {
  post: jest.fn()
};
jest.mock('axios', () => mockAxios);

// Mock Alert
const mockAlert = {
  alert: jest.fn()
};
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Alert: mockAlert
  };
});

describe('ProductDetail Component Tests', () => {
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
      sodium_100g: 480
    }
  };

  const mockProductOCR = {
    barcode: '9876543210',
    name: 'OCR Product',
    brand: 'OCR Brand',
    source: 'OCR Scanner',
    confidence: 0.85,
    raw_text: 'Scanned nutrition label text',
    scanned_at: '2024-01-01T12:00:00Z',
    nutriments: {
      energy_kcal_per_100g: 300,
      protein_g_per_100g: 12,
      fat_g_per_100g: 8,
      carbs_g_per_100g: 35,
      sugars_g_per_100g: 20,
      salt_g_per_100g: 1.5
    }
  };

  const mockProductMinimal = {
    code: '0000000000',
    product_name: 'Minimal Product'
  };

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.post.mockClear();
    mockAlert.alert.mockClear();
  });

  describe('Component Rendering', () => {
    it('should render basic product information correctly', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
      );

      const tree = component.toJSON();
      expect(tree).toBeTruthy();
      
      const instance = component.root;
      
      // Check product name is displayed
      expect(() => instance.findByProps({ children: 'Test Product' })).not.toThrow();
      
      // Check brand is displayed
      expect(() => instance.findByProps({ children: 'Test Brand' })).not.toThrow();
      
      // Check barcode is displayed
      expect(() => instance.findByProps({ children: '1234567890' })).not.toThrow();
    });

    it('should render OCR product with confidence score', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductOCR} onClose={mockOnClose} />
      );

      const instance = component.root;
      
      // Check OCR source is displayed
      expect(() => instance.findByProps({ children: 'OCR Scanner' })).not.toThrow();
      
      // Check confidence percentage is shown
      const sourceElements = instance.findAllByProps({ style: expect.objectContaining({}) });
      const hasConfidence = sourceElements.some(element => 
        element.props.children && 
        element.props.children.toString().includes('85% confidence')
      );
      expect(hasConfidence).toBeTruthy();
    });

    it('should render minimal product without errors', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductMinimal} onClose={mockOnClose} />
      );

      expect(component.toJSON()).toBeTruthy();
      
      const instance = component.root;
      expect(() => instance.findByProps({ children: 'Minimal Product' })).not.toThrow();
    });

    it('should show close button when onClose provided', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
      );

      const instance = component.root;
      const closeButtons = instance.findAllByProps({ children: '✕' });
      expect(closeButtons.length).toBeGreaterThan(0);
    });

    it('should hide close button when onClose not provided', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} />
      );

      const instance = component.root;
      try {
        instance.findByProps({ children: '✕' });
        fail('Should not find close button');
      } catch (error) {
        expect(error.message).toContain('No instances found');
      }
    });
  });

  describe('Nutrition Data Display', () => {
    it('should display nutrition facts when available', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
      );

      const instance = component.root;
      
      // Check nutrition section title
      expect(() => instance.findByProps({ children: 'Nutrition Facts (per 100g)' })).not.toThrow();
      
      // Check specific nutrition values are displayed
      expect(() => instance.findByProps({ children: '250.0 kcal' })).not.toThrow();
      expect(() => instance.findByProps({ children: '10.0 g' })).not.toThrow();
      expect(() => instance.findByProps({ children: '5.0 g' })).not.toThrow();
      expect(() => instance.findByProps({ children: '30.0 g' })).not.toThrow();
    });

    it('should handle OCR nutrition data format', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductOCR} onClose={mockOnClose} />
      );

      const instance = component.root;
      
      // Check OCR nutrition values are normalized and displayed
      expect(() => instance.findByProps({ children: '300.0 kcal' })).not.toThrow();
      expect(() => instance.findByProps({ children: '12.0 g' })).not.toThrow();
      expect(() => instance.findByProps({ children: '8.0 g' })).not.toThrow();
    });

    it('should handle missing nutrition data gracefully', () => {
      const productNoNutrition = {
        ...mockProductBasic,
        nutriments: {}
      };

      const component = TestRenderer.create(
        <ProductDetail product={productNoNutrition} onClose={mockOnClose} />
      );

      const instance = component.root;
      
      // Should not render nutrition section when no data
      try {
        instance.findByProps({ children: 'Nutrition Facts (per 100g)' });
        fail('Should not find nutrition section');
      } catch (error) {
        expect(error.message).toContain('No instances found');
      }
    });

    it('should render fiber and sodium when available', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
      );

      const instance = component.root;
      
      // Check fiber and sodium are displayed
      expect(() => instance.findByProps({ children: '3.0 g' })).not.toThrow(); // fiber
      expect(() => instance.findByProps({ children: '480.0 mg' })).not.toThrow(); // sodium
    });

    it('should skip fiber and sodium when zero', () => {
      const productNoFiberSodium = {
        ...mockProductBasic,
        nutriments: {
          energy_kcal_100g: 250,
          proteins_100g: 10,
          fat_100g: 5,
          carbohydrates_100g: 30,
          sugars_100g: 15,
          salt_100g: 1.2,
          fiber_100g: 0,
          sodium_100g: 0
        }
      };

      const component = TestRenderer.create(
        <ProductDetail product={productNoFiberSodium} onClose={mockOnClose} />
      );

      const instance = component.root;
      
      // Should not find fiber or sodium rows when they're 0
      const elements = instance.findAllByType('Text');
      const hasZeroFiber = elements.some(el => el.props.children === '0.0 g' && el.props.testID === 'fiber');
      const hasZeroSodium = elements.some(el => el.props.children === '0.0 mg' && el.props.testID === 'sodium');
      
      expect(hasZeroFiber).toBeFalsy();
      expect(hasZeroSodium).toBeFalsy();
    });
  });

  describe('Product Image Handling', () => {
    it('should display product image when URL provided', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
      );

      const instance = component.root;
      const images = instance.findAllByType('Image');
      
      expect(images.length).toBeGreaterThan(0);
      const productImage = images.find(img => 
        img.props.source && img.props.source.uri === 'https://test.com/image.jpg'
      );
      expect(productImage).toBeTruthy();
    });

    it('should handle missing product image gracefully', () => {
      const productNoImage = {
        ...mockProductBasic,
        image_url: undefined
      };

      const component = TestRenderer.create(
        <ProductDetail product={productNoImage} onClose={mockOnClose} />
      );

      // Should render without crashing
      expect(component.toJSON()).toBeTruthy();
      
      const instance = component.root;
      const images = instance.findAllByType('Image');
      
      // Should not find product image
      const productImages = images.filter(img => 
        img.props.source && img.props.source.uri
      );
      expect(productImages.length).toBe(0);
    });

    it('should use image_front_url as fallback', () => {
      const productFrontImage = {
        ...mockProductBasic,
        image_url: undefined,
        image_front_url: 'https://test.com/front.jpg'
      };

      const component = TestRenderer.create(
        <ProductDetail product={productFrontImage} onClose={mockOnClose} />
      );

      const instance = component.root;
      const images = instance.findAllByType('Image');
      
      const frontImage = images.find(img => 
        img.props.source && img.props.source.uri === 'https://test.com/front.jpg'
      );
      expect(frontImage).toBeTruthy();
    });
  });

  describe('Add to Plan Functionality', () => {
    it('should show Add to Plan button by default', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
      );

      const instance = component.root;
      expect(() => instance.findByProps({ children: '🍽️ Add to Meal Plan' })).not.toThrow();
    });

    it('should hide Add to Plan button when showAddToPlan is false', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} onClose={mockOnClose} showAddToPlan={false} />
      );

      const instance = component.root;
      try {
        instance.findByProps({ children: '🍽️ Add to Meal Plan' });
        fail('Should not find Add to Plan button');
      } catch (error) {
        expect(error.message).toContain('No instances found');
      }
    });

    it('should disable Add to Plan button when no barcode', () => {
      const productNoBarcode = {
        ...mockProductBasic,
        code: undefined,
        barcode: undefined
      };

      const component = TestRenderer.create(
        <ProductDetail product={productNoBarcode} onClose={mockOnClose} />
      );

      const instance = component.root;
      const touchableOpacities = instance.findAllByType('TouchableOpacity');
      
      const addButton = touchableOpacities.find(button => {
        try {
          const textElement = button.findByProps({ children: '🍽️ Add to Meal Plan' });
          return !!textElement;
        } catch {
          return false;
        }
      });

      expect(addButton).toBeTruthy();
      expect(addButton.props.disabled).toBeTruthy();
    });

    it('should handle successful add to plan', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
      );

      const instance = component.root;
      const touchableOpacities = instance.findAllByType('TouchableOpacity');
      
      const addButton = touchableOpacities.find(button => {
        try {
          button.findByProps({ children: '🍽️ Add to Meal Plan' });
          return true;
        } catch {
          return false;
        }
      });

      expect(addButton).toBeTruthy();

      // Simulate button press
      await TestRenderer.act(async () => {
        addButton.props.onPress();
      });

      expect(mockAxios.post).toHaveBeenCalledWith('http://10.0.2.2:8000/plan/add-product', {
        barcode: '1234567890',
        meal_type: 'lunch'
      });

      expect(mockAlert.alert).toHaveBeenCalledWith(
        'Success!',
        'Test Product has been added to your meal plan.',
        [{ text: 'OK' }]
      );
    });

    it('should handle add to plan API error', async () => {
      mockAxios.post.mockRejectedValueOnce(new Error('API Error'));

      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
      );

      const instance = component.root;
      const touchableOpacities = instance.findAllByType('TouchableOpacity');
      
      const addButton = touchableOpacities.find(button => {
        try {
          button.findByProps({ children: '🍽️ Add to Meal Plan' });
          return true;
        } catch {
          return false;
        }
      });

      // Simulate button press
      await TestRenderer.act(async () => {
        addButton.props.onPress();
      });

      expect(mockAlert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to add product to meal plan. Please try again.',
        [{ text: 'OK' }]
      );
    });

    it('should show loading state during add to plan', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockAxios.post.mockReturnValue(promise);

      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
      );

      const instance = component.root;
      const touchableOpacities = instance.findAllByType('TouchableOpacity');
      
      const addButton = touchableOpacities.find(button => {
        try {
          button.findByProps({ children: '🍽️ Add to Meal Plan' });
          return true;
        } catch {
          return false;
        }
      });

      // Start async operation
      TestRenderer.act(() => {
        addButton.props.onPress();
      });

      // Should show loading state
      const activityIndicators = instance.findAllByType('ActivityIndicator');
      expect(activityIndicators.length).toBeGreaterThan(0);

      // Button should be disabled
      expect(addButton.props.disabled).toBeTruthy();

      // Resolve the promise
      await TestRenderer.act(async () => {
        resolvePromise({ data: { success: true } });
        await promise;
      });
    });

    it('should show error alert when barcode is unknown', async () => {
      const productUnknownBarcode = {
        ...mockProductBasic,
        code: 'unknown'
      };

      const component = TestRenderer.create(
        <ProductDetail product={productUnknownBarcode} onClose={mockOnClose} />
      );

      const instance = component.root;
      const touchableOpacities = instance.findAllByType('TouchableOpacity');
      
      const addButton = touchableOpacities.find(button => {
        try {
          button.findByProps({ children: '🍽️ Add to Meal Plan' });
          return true;
        } catch {
          return false;
        }
      });

      await TestRenderer.act(async () => {
        addButton.props.onPress();
      });

      expect(mockAlert.alert).toHaveBeenCalledWith(
        'Error',
        'Cannot add product without barcode to plan.'
      );

      // Should not make API call
      expect(mockAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('Data Normalization', () => {
    it('should normalize product fields correctly', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
      );

      const instance = component.root;
      
      // Check all normalized fields are displayed
      expect(() => instance.findByProps({ children: 'Test Product' })).not.toThrow();
      expect(() => instance.findByProps({ children: 'Test Brand' })).not.toThrow();
      expect(() => instance.findByProps({ children: '1234567890' })).not.toThrow();
      expect(() => instance.findByProps({ children: '100g' })).not.toThrow();
    });

    it('should handle alternative field names', () => {
      const productAlternativeFields = {
        barcode: '9999999999', // instead of code
        name: 'Alt Product', // instead of product_name
        brand: 'Alt Brand', // instead of brands
        image_front_url: 'https://alt.com/image.jpg', // instead of image_url
        nutriments: {
          energy_kcal_per_100g: 200, // instead of energy_kcal_100g
          protein_g_per_100g: 8, // instead of proteins_100g
          fat_g_per_100g: 4, // instead of fat_100g
          carbs_g_per_100g: 25 // instead of carbohydrates_100g
        }
      };

      const component = TestRenderer.create(
        <ProductDetail product={productAlternativeFields} onClose={mockOnClose} />
      );

      const instance = component.root;
      
      // Check alternative fields are normalized correctly
      expect(() => instance.findByProps({ children: 'Alt Product' })).not.toThrow();
      expect(() => instance.findByProps({ children: 'Alt Brand' })).not.toThrow();
      expect(() => instance.findByProps({ children: '9999999999' })).not.toThrow();
      expect(() => instance.findByProps({ children: '200.0 kcal' })).not.toThrow();
    });

    it('should provide default values for missing fields', () => {
      const productMissingFields = {
        code: '1111111111'
        // Missing most fields
      };

      const component = TestRenderer.create(
        <ProductDetail product={productMissingFields} onClose={mockOnClose} />
      );

      const instance = component.root;
      
      // Check default values are used
      expect(() => instance.findByProps({ children: 'Unknown Product' })).not.toThrow();
      expect(() => instance.findByProps({ children: '100g' })).not.toThrow(); // default serving size
      expect(() => instance.findByProps({ children: 'Product Database' })).not.toThrow(); // default source
    });
  });

  describe('Low Confidence Warning', () => {
    it('should show warning for low confidence OCR scans', () => {
      const lowConfidenceProduct = {
        ...mockProductOCR,
        source: 'OCR Scanner',
        confidence: 0.6 // Below 0.7 threshold
      };

      const component = TestRenderer.create(
        <ProductDetail product={lowConfidenceProduct} onClose={mockOnClose} />
      );

      const instance = component.root;
      
      // Check warning is displayed
      expect(() => instance.findByProps({ children: '⚠️ Low Confidence Scan' })).not.toThrow();
      expect(() => instance.findByProps({ 
        children: 'This product information was extracted with low confidence. Please verify the nutrition values are accurate before adding to your plan.'
      })).not.toThrow();
    });

    it('should not show warning for high confidence scans', () => {
      const highConfidenceProduct = {
        ...mockProductOCR,
        source: 'OCR Scanner',
        confidence: 0.9 // Above 0.7 threshold
      };

      const component = TestRenderer.create(
        <ProductDetail product={highConfidenceProduct} onClose={mockOnClose} />
      );

      const instance = component.root;
      
      // Should not find warning
      try {
        instance.findByProps({ children: '⚠️ Low Confidence Scan' });
        fail('Should not find low confidence warning');
      } catch (error) {
        expect(error.message).toContain('No instances found');
      }
    });

    it('should not show warning for database products', () => {
      const databaseProduct = {
        ...mockProductBasic,
        source: 'Product Database'
      };

      const component = TestRenderer.create(
        <ProductDetail product={databaseProduct} onClose={mockOnClose} />
      );

      const instance = component.root;
      
      // Should not find warning for database products
      try {
        instance.findByProps({ children: '⚠️ Low Confidence Scan' });
        fail('Should not find warning for database product');
      } catch (error) {
        expect(error.message).toContain('No instances found');
      }
    });
  });

  describe('Ingredients Display', () => {
    it('should display ingredients when available', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
      );

      const instance = component.root;
      
      // Check ingredients section
      expect(() => instance.findByProps({ children: 'Ingredients' })).not.toThrow();
      expect(() => instance.findByProps({ children: 'Test ingredients' })).not.toThrow();
    });

    it('should hide ingredients section when not available', () => {
      const productNoIngredients = {
        ...mockProductBasic,
        ingredients_text: undefined
      };

      const component = TestRenderer.create(
        <ProductDetail product={productNoIngredients} onClose={mockOnClose} />
      );

      const instance = component.root;
      
      // Should not find ingredients section
      try {
        instance.findByProps({ children: 'Ingredients' });
        fail('Should not find ingredients section');
      } catch (error) {
        expect(error.message).toContain('No instances found');
      }
    });
  });

  describe('Component Interaction', () => {
    it('should call onClose when close button pressed', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
      );

      const instance = component.root;
      const closeButton = instance.findByProps({ children: '✕' }).parent;

      TestRenderer.act(() => {
        closeButton.props.onPress();
      });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should handle component unmounting gracefully', () => {
      const component = TestRenderer.create(
        <ProductDetail product={mockProductBasic} onClose={mockOnClose} />
      );

      expect(() => {
        component.unmount();
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null nutriments object', () => {
      const productNullNutriments = {
        ...mockProductBasic,
        nutriments: null
      };

      expect(() => {
        TestRenderer.create(
          <ProductDetail product={productNullNutriments} onClose={mockOnClose} />
        );
      }).not.toThrow();
    });

    it('should handle empty strings in product data', () => {
      const productEmptyStrings = {
        code: '',
        product_name: '',
        brands: '',
        serving_size: '',
        image_url: '',
        categories: '',
        ingredients_text: '',
        nutriments: {}
      };

      const component = TestRenderer.create(
        <ProductDetail product={productEmptyStrings} onClose={mockOnClose} />
      );

      // Should render with default values
      const instance = component.root;
      expect(() => instance.findByProps({ children: 'Unknown Product' })).not.toThrow();
    });

    it('should handle very long product names', () => {
      const productLongName = {
        ...mockProductBasic,
        product_name: 'This is a very very very long product name that might cause layout issues in the UI but should be handled gracefully'
      };

      expect(() => {
        TestRenderer.create(
          <ProductDetail product={productLongName} onClose={mockOnClose} />
        );
      }).not.toThrow();
    });

    it('should handle invalid nutrition values', () => {
      const productInvalidNutrition = {
        ...mockProductBasic,
        nutriments: {
          energy_kcal_100g: 'invalid',
          proteins_100g: null,
          fat_100g: undefined,
          carbohydrates_100g: NaN
        }
      };

      expect(() => {
        TestRenderer.create(
          <ProductDetail product={productInvalidNutrition} onClose={mockOnClose} />
        );
      }).not.toThrow();
    });
  });
});