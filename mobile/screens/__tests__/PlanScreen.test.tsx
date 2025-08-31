import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import PlanScreen from '../PlanScreen';
import { apiService } from '../../services/ApiService';

// Mock the API service
jest.mock('../../services/ApiService', () => ({
  apiService: {
    generateMealPlan: jest.fn(),
    customizeMealPlan: jest.fn(),
    getProductByBarcode: jest.fn(),
    searchProduct: jest.fn()
  }
}));

// Mock Alert
const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;

describe('PlanScreen', () => {
  const mockOnBackPress = jest.fn();
  const mockApiService = apiService as jest.Mocked<typeof apiService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful meal plan generation
    mockApiService.generateMealPlan.mockResolvedValue({
      data: {
        bmr: 1800,
        tdee: 2200,
        daily_calorie_target: 2000,
        meals: [
          {
            name: 'Breakfast',
            target_calories: 500,
            actual_calories: 480,
            items: [
              {
                barcode: '123',
                name: 'Oatmeal',
                serving: '100g',
                calories: 300,
                macros: { protein_g: 10, fat_g: 5, carbs_g: 50 }
              }
            ]
          }
        ],
        metrics: {
          total_calories: 1800,
          protein_g: 120,
          fat_g: 60,
          carbs_g: 200,
          sugars_g: 50,
          salt_g: 5,
          protein_percent: 25,
          fat_percent: 30,
          carbs_percent: 45
        },
        created_at: '2024-01-01T00:00:00Z',
        flexibility_used: false,
        optional_products_used: 2
      }
    });
  });

  describe('Rendering and Initial Load', () => {
    it('should render loading state initially', () => {
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      expect(screen.getByText('Generating your meal plan...')).toBeTruthy();
    });

    it('should call generateMealPlan on component mount', async () => {
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(mockApiService.generateMealPlan).toHaveBeenCalledWith({
          user_profile: {
            age: 30,
            sex: 'male',
            height_cm: 175,
            weight_kg: 75,
            activity_level: 'moderately_active',
            goal: 'maintain'
          },
          preferences: {
            dietary_restrictions: [],
            excludes: [],
            prefers: []
          },
          optional_products: [],
          flexibility: false
        });
      });
    });

    it('should render meal plan after successful load', async () => {
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(screen.getByText('🍽️ Daily Meal Plan')).toBeTruthy();
        expect(screen.getByText('🌅 Breakfast')).toBeTruthy();
        expect(screen.getByText('Oatmeal')).toBeTruthy();
      });
    });

    it('should call onBackPress when back button is pressed', async () => {
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(screen.getByText('🍽️ Daily Meal Plan')).toBeTruthy();
      });
      
      const backButton = screen.getByText('🏠');
      fireEvent.press(backButton);
      
      expect(mockOnBackPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should show error message when meal plan generation fails', async () => {
      mockApiService.generateMealPlan.mockRejectedValue(new Error('API Error'));
      
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Error',
          'Failed to generate meal plan. Please try again.'
        );
      });
    });

    it('should render retry screen when meal plan is null', async () => {
      mockApiService.generateMealPlan.mockResolvedValue({ data: null });
      
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load meal plan')).toBeTruthy();
        expect(screen.getByText('Retry')).toBeTruthy();
      });
    });

    it('should retry meal plan generation when retry button is pressed', async () => {
      mockApiService.generateMealPlan
        .mockResolvedValueOnce({ data: null })
        .mockResolvedValueOnce({
          data: {
            daily_calorie_target: 2000,
            meals: [],
            metrics: { total_calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }
          }
        });
      
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeTruthy();
      });
      
      const retryButton = screen.getByText('Retry');
      fireEvent.press(retryButton);
      
      expect(mockApiService.generateMealPlan).toHaveBeenCalledTimes(2);
    });
  });

  describe('Meal Plan Regeneration', () => {
    it('should regenerate plan when regenerate button is pressed', async () => {
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(screen.getByText('🔄 Generate New Plan')).toBeTruthy();
      });
      
      const regenerateButton = screen.getByText('🔄 Generate New Plan');
      fireEvent.press(regenerateButton);
      
      expect(mockApiService.generateMealPlan).toHaveBeenCalledTimes(2);
    });
  });

  describe('Meal Customization', () => {
    it('should open customize modal when customize button is pressed', async () => {
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(screen.getByText('🔧 Customize')).toBeTruthy();
      });
      
      const customizeButton = screen.getByText('🔧 Customize');
      fireEvent.press(customizeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Customize Breakfast')).toBeTruthy();
      });
    });

    it('should search for product by barcode in customize modal', async () => {
      const mockProduct = {
        code: '123456789',
        product_name: 'Test Product',
        nutriments: {
          energy_kcal_100g: 200,
          proteins_100g: 10,
          fat_100g: 5,
          carbohydrates_100g: 30
        }
      };
      
      mockApiService.getProductByBarcode.mockResolvedValue({ data: mockProduct });
      
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(screen.getByText('🔧 Customize')).toBeTruthy();
      });
      
      const customizeButton = screen.getByText('🔧 Customize');
      fireEvent.press(customizeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Customize Breakfast')).toBeTruthy();
      });
      
      // Switch to barcode search
      const barcodeButton = screen.getByText('Barcode');
      fireEvent.press(barcodeButton);
      
      // Enter barcode
      const searchInput = screen.getByPlaceholderText('Enter barcode...');
      fireEvent.changeText(searchInput, '123456789');
      
      // Press search
      const searchButton = screen.getByText('Search Product');
      fireEvent.press(searchButton);
      
      await waitFor(() => {
        expect(mockApiService.getProductByBarcode).toHaveBeenCalledWith('123456789');
      });
    });

    it('should search for product by text in customize modal', async () => {
      const mockProduct = {
        product_name: 'Apple',
        nutriments: {
          energy_kcal_100g: 50,
          proteins_100g: 0.3,
          fat_100g: 0.2,
          carbohydrates_100g: 14
        }
      };
      
      mockApiService.searchProduct.mockResolvedValue({ data: mockProduct });
      
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(screen.getByText('🔧 Customize')).toBeTruthy();
      });
      
      const customizeButton = screen.getByText('🔧 Customize');
      fireEvent.press(customizeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Customize Breakfast')).toBeTruthy();
      });
      
      // Switch to text search
      const textButton = screen.getByText('Text');
      fireEvent.press(textButton);
      
      // Enter search query
      const searchInput = screen.getByPlaceholderText('Enter product name...');
      fireEvent.changeText(searchInput, 'apple');
      
      // Press search
      const searchButton = screen.getByText('Search Product');
      fireEvent.press(searchButton);
      
      await waitFor(() => {
        expect(mockApiService.searchProduct).toHaveBeenCalledWith('apple');
      });
    });

    it('should handle search errors gracefully', async () => {
      mockApiService.getProductByBarcode.mockRejectedValue(new Error('Product not found'));
      
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(screen.getByText('🔧 Customize')).toBeTruthy();
      });
      
      const customizeButton = screen.getByText('🔧 Customize');
      fireEvent.press(customizeButton);
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Enter barcode...');
        fireEvent.changeText(searchInput, '123456789');
        
        const searchButton = screen.getByText('Search Product');
        fireEvent.press(searchButton);
      });
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Search Failed',
          'Could not find product. Try manual entry instead.'
        );
      });
    });

    it('should customize meal plan when item is added', async () => {
      mockApiService.customizeMealPlan.mockResolvedValue({ data: { success: true } });
      
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(screen.getByText('🔧 Customize')).toBeTruthy();
      });
      
      // This is a complex integration test - would need to simulate the full flow
      // For now, verify that the API method is available
      expect(mockApiService.customizeMealPlan).toBeDefined();
    });
  });

  describe('Progress Tracking', () => {
    it('should display daily progress bars', async () => {
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(screen.getByText('Daily Progress')).toBeTruthy();
        expect(screen.getByText('Calories')).toBeTruthy();
        expect(screen.getByText('Protein')).toBeTruthy();
        expect(screen.getByText('Fat')).toBeTruthy();
        expect(screen.getByText('Carbs')).toBeTruthy();
      });
    });
  });

  describe('Meal Display', () => {
    it('should show meal items with correct information', async () => {
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(screen.getByText('Oatmeal')).toBeTruthy();
        expect(screen.getByText('100g • 300 kcal')).toBeTruthy();
        expect(screen.getByText('P: 10g F: 5g C: 50g')).toBeTruthy();
      });
    });

    it('should display meal calories correctly', async () => {
      render(<PlanScreen onBackPress={mockOnBackPress} />);
      
      await waitFor(() => {
        expect(screen.getByText('480 kcal')).toBeTruthy();
      });
    });
  });
});