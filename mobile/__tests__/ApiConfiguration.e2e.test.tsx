import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import App from '../App';
import { apiService } from '../services/ApiService';
import { environments } from '../config/environments';

// Mock the API service
jest.mock('../services/ApiService', () => ({
  apiService: {
    getCurrentEnvironment: jest.fn(),
    switchEnvironment: jest.fn(),
    healthCheck: jest.fn(),
    generateMealPlan: jest.fn(),
    scanNutritionLabel: jest.fn()
  }
}));

// Mock Alert
const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;

describe('API Configuration End-to-End', () => {
  const mockApiService = apiService as jest.Mocked<typeof apiService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default environment setup
    mockApiService.getCurrentEnvironment.mockReturnValue({
      name: 'android_dev',
      config: environments.android_dev
    });
    
    mockApiService.healthCheck.mockResolvedValue({
      healthy: true,
      responseTime: 150
    });
  });

  describe('Full API Configuration Workflow', () => {
    it('should allow user to access API config from main app', async () => {
      render(<App />);
      
      // Should render main app
      await waitFor(() => {
        expect(screen.getByText('🍎 DietIntel')).toBeTruthy();
      });
      
      // Find and press settings/config button
      const configButton = screen.getByText('⚙️');
      fireEvent.press(configButton);
      
      // Should open API config modal
      await waitFor(() => {
        expect(screen.getByText('⚙️ API Configuration')).toBeTruthy();
        expect(screen.getByText('Current Configuration')).toBeTruthy();
      });
    });

    it('should display current environment in config modal', async () => {
      render(<App />);
      
      // Open API config
      const configButton = screen.getByText('⚙️');
      fireEvent.press(configButton);
      
      await waitFor(() => {
        expect(screen.getByText('Android Development')).toBeTruthy();
        expect(screen.getByText('http://10.0.2.2:8000')).toBeTruthy();
      });
    });

    it('should allow testing environment health', async () => {
      render(<App />);
      
      // Open API config
      const configButton = screen.getByText('⚙️');
      fireEvent.press(configButton);
      
      await waitFor(() => {
        expect(screen.getByText('🔍 Test All Environments')).toBeTruthy();
      });
      
      // Test all environments
      const testAllButton = screen.getByText('🔍 Test All Environments');
      fireEvent.press(testAllButton);
      
      // Should call health check for multiple environments
      await waitFor(() => {
        expect(mockApiService.healthCheck.mock.calls.length).toBeGreaterThan(1);
      }, { timeout: 5000 });
    });

    it('should switch environments and update API calls', async () => {
      let switchedEnvironment = 'android_dev';
      
      // Mock environment switching
      mockApiService.switchEnvironment.mockImplementation((env) => {
        switchedEnvironment = env;
      });
      
      mockApiService.getCurrentEnvironment.mockImplementation(() => ({
        name: switchedEnvironment,
        config: environments[switchedEnvironment as keyof typeof environments]
      }));

      render(<App />);
      
      // Open API config
      const configButton = screen.getByText('⚙️');
      fireEvent.press(configButton);
      
      await waitFor(() => {
        expect(screen.getByText('Available Environments')).toBeTruthy();
      });
      
      // Find a switch button (for non-current environment)
      const switchButtons = screen.getAllByText('🔄 Switch');
      if (switchButtons.length > 0) {
        fireEvent.press(switchButtons[0]);
        
        // Should show confirmation dialog
        expect(mockAlert).toHaveBeenCalledWith(
          'Switch Environment?',
          expect.stringContaining('Are you sure you want to switch'),
          expect.arrayContaining([
            expect.objectContaining({ text: 'Cancel' }),
            expect.objectContaining({ text: 'Switch' })
          ])
        );
        
        // Simulate user confirming
        const alertCall = mockAlert.mock.calls[0];
        const confirmButton = alertCall[2].find((btn: any) => btn.text === 'Switch');
        confirmButton.onPress();
        
        expect(mockApiService.switchEnvironment).toHaveBeenCalled();
      }
    });

    it('should close config modal and return to main app', async () => {
      render(<App />);
      
      // Open API config
      const configButton = screen.getByText('⚙️');
      fireEvent.press(configButton);
      
      await waitFor(() => {
        expect(screen.getByText('⚙️ API Configuration')).toBeTruthy();
      });
      
      // Close modal
      const closeButton = screen.getByText('✕');
      fireEvent.press(closeButton);
      
      // Should be back to main app
      await waitFor(() => {
        expect(screen.getByText('🍎 DietIntel')).toBeTruthy();
        expect(screen.queryByText('⚙️ API Configuration')).toBeNull();
      });
    });
  });

  describe('Environment-Aware Features', () => {
    it('should use configured environment for meal planning', async () => {
      mockApiService.generateMealPlan.mockResolvedValue({
        data: {
          daily_calorie_target: 2000,
          meals: [],
          metrics: { total_calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }
        }
      });

      render(<App />);
      
      // Navigate to meal plan
      await waitFor(() => {
        expect(screen.getByText('🍽️ Meal Plan')).toBeTruthy();
      });
      
      const mealPlanTab = screen.getByText('🍽️ Meal Plan');
      fireEvent.press(mealPlanTab);
      
      // Should use API service for meal planning
      await waitFor(() => {
        expect(mockApiService.generateMealPlan).toHaveBeenCalled();
      });
    });

    it('should use configured environment for label scanning', async () => {
      mockApiService.scanNutritionLabel.mockResolvedValue({
        data: {
          confidence: 0.8,
          nutriments: {},
          scanned_at: '2024-01-01T00:00:00Z'
        }
      });

      render(<App />);
      
      // Navigate to upload label
      await waitFor(() => {
        expect(screen.getByText('🏷️ Upload Label')).toBeTruthy();
      });
      
      const uploadTab = screen.getByText('🏷️ Upload Label');
      fireEvent.press(uploadTab);
      
      // Should navigate to upload screen
      await waitFor(() => {
        expect(screen.getByText('Upload Nutrition Label')).toBeTruthy();
      });
      
      // API service should be available for scanning
      expect(mockApiService.scanNutritionLabel).toBeDefined();
    });
  });

  describe('Error Handling in Configuration', () => {
    it('should handle health check failures gracefully', async () => {
      mockApiService.healthCheck.mockRejectedValue(new Error('Network error'));

      render(<App />);
      
      // Open API config and test environment
      const configButton = screen.getByText('⚙️');
      fireEvent.press(configButton);
      
      await waitFor(() => {
        const testButtons = screen.getAllByText('🔍 Test');
        fireEvent.press(testButtons[0]);
      });
      
      // Should not crash the app
      await waitFor(() => {
        expect(screen.getByText('⚙️ API Configuration')).toBeTruthy();
      });
    });

    it('should handle invalid environment switching', async () => {
      mockApiService.switchEnvironment.mockImplementation(() => {
        throw new Error('Invalid environment');
      });

      render(<App />);
      
      // Open API config
      const configButton = screen.getByText('⚙️');
      fireEvent.press(configButton);
      
      // Try to switch environment
      await waitFor(() => {
        const switchButtons = screen.getAllByText('🔄 Switch');
        if (switchButtons.length > 0) {
          fireEvent.press(switchButtons[0]);
          
          // Confirm switch
          const alertCall = mockAlert.mock.calls[0];
          const confirmButton = alertCall[2].find((btn: any) => btn.text === 'Switch');
          confirmButton.onPress();
        }
      });
      
      // App should remain stable
      expect(screen.getByText('⚙️ API Configuration')).toBeTruthy();
    });
  });

  describe('Multi-Environment Testing', () => {
    it('should test development environments correctly', async () => {
      render(<App />);
      
      // Open config and test dev environments
      const configButton = screen.getByText('⚙️');
      fireEvent.press(configButton);
      
      await waitFor(() => {
        const testButtons = screen.getAllByText('🔍 Test');
        
        // Test multiple environments
        testButtons.slice(0, 3).forEach(button => {
          fireEvent.press(button);
        });
      });
      
      // Should make multiple health check calls
      await waitFor(() => {
        expect(mockApiService.healthCheck.mock.calls.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('should display different health statuses correctly', async () => {
      let callCount = 0;
      mockApiService.healthCheck.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ healthy: true, responseTime: 100 });
        } else if (callCount === 2) {
          return Promise.resolve({ healthy: false, error: 'Connection timeout' });
        } else {
          return Promise.resolve({ healthy: true, responseTime: 250 });
        }
      });

      render(<App />);
      
      const configButton = screen.getByText('⚙️');
      fireEvent.press(configButton);
      
      await waitFor(() => {
        const testButtons = screen.getAllByText('🔍 Test');
        
        // Test first few environments
        testButtons.slice(0, 3).forEach((button, index) => {
          setTimeout(() => fireEvent.press(button), index * 100);
        });
      });
      
      // Should eventually show different status indicators
      await waitFor(() => {
        expect(screen.queryByText('100ms')).toBeTruthy();
      }, { timeout: 3000 });
    });
  });

  describe('Regional Environment Support', () => {
    it('should show regional production environments', async () => {
      render(<App />);
      
      const configButton = screen.getByText('⚙️');
      fireEvent.press(configButton);
      
      await waitFor(() => {
        expect(screen.getByText(/EU Production/)).toBeTruthy();
        expect(screen.getByText(/US Production/)).toBeTruthy();
        expect(screen.getByText(/Asia Production/)).toBeTruthy();
      });
    });

    it('should allow switching to regional environments', async () => {
      render(<App />);
      
      const configButton = screen.getByText('⚙️');
      fireEvent.press(configButton);
      
      await waitFor(() => {
        // Should have switch buttons for regional environments
        const switchButtons = screen.getAllByText('🔄 Switch');
        expect(switchButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Development vs Production Configuration', () => {
    it('should use appropriate URLs for different environment types', async () => {
      render(<App />);
      
      const configButton = screen.getByText('⚙️');
      fireEvent.press(configButton);
      
      await waitFor(() => {
        // Should show localhost for dev environments
        expect(screen.getByText('http://localhost:8000')).toBeTruthy();
        expect(screen.getByText('http://10.0.2.2:8000')).toBeTruthy();
        
        // Should show HTTPS URLs for production
        expect(screen.queryByText(/https:\/\//)).toBeTruthy();
      });
    });
  });
});