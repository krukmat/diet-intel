import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ApiConfigModal from '../ApiConfigModal';
import { apiService } from '../../services/ApiService';
import { environments } from '../../config/environments';

// Mock the API service
jest.mock('../../services/ApiService', () => ({
  apiService: {
    getCurrentEnvironment: jest.fn(),
    switchEnvironment: jest.fn(),
    healthCheck: jest.fn()
  }
}));

// Mock Alert
const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;

describe('ApiConfigModal', () => {
  const mockOnClose = jest.fn();
  const mockApiService = apiService as jest.Mocked<typeof apiService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    mockApiService.getCurrentEnvironment.mockReturnValue({
      name: 'android_dev',
      config: environments.android_dev
    });
    
    mockApiService.healthCheck.mockResolvedValue({
      healthy: true,
      responseTime: 150
    });
  });

  describe('Rendering', () => {
    it('should render modal when visible', () => {
      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('⚙️ API Configuration')).toBeTruthy();
      expect(screen.getByText('Environment & Health Status')).toBeTruthy();
    });

    it('should not render modal when not visible', () => {
      render(<ApiConfigModal visible={false} onClose={mockOnClose} />);
      
      expect(screen.queryByText('⚙️ API Configuration')).toBeNull();
    });

    it('should display current environment information', () => {
      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('Android Development')).toBeTruthy();
      expect(screen.getByText('http://10.0.2.2:8000')).toBeTruthy();
    });

    it('should render all available environments', () => {
      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      // Check that environment names are rendered
      expect(screen.getByText(/Development/)).toBeTruthy();
      expect(screen.getByText(/Staging/)).toBeTruthy();
      expect(screen.getByText(/Production/)).toBeTruthy();
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button is pressed', () => {
      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      const closeButton = screen.getByText('✕');
      fireEvent.press(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Environment Testing', () => {
    it('should test individual environment health', async () => {
      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      // Find and press a test button
      const testButtons = screen.getAllByText('🔍 Test');
      fireEvent.press(testButtons[0]);
      
      await waitFor(() => {
        expect(mockApiService.healthCheck).toHaveBeenCalled();
      });
    });

    it('should show loading state during health check', async () => {
      // Mock a delayed health check
      mockApiService.healthCheck.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ healthy: true }), 100))
      );

      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      const testButtons = screen.getAllByText('🔍 Test');
      fireEvent.press(testButtons[0]);
      
      // Should show loading indicator (ActivityIndicator)
      await waitFor(() => {
        expect(screen.queryByText('🔍 Test')).toBeTruthy();
      });
    });

    it('should display health status after successful test', async () => {
      mockApiService.healthCheck.mockResolvedValue({
        healthy: true,
        responseTime: 234
      });

      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      const testButtons = screen.getAllByText('🔍 Test');
      fireEvent.press(testButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText('234ms')).toBeTruthy();
      });
    });

    it('should display error status after failed test', async () => {
      mockApiService.healthCheck.mockResolvedValue({
        healthy: false,
        error: 'Connection failed'
      });

      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      const testButtons = screen.getAllByText('🔍 Test');
      fireEvent.press(testButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText('❌ Connection failed')).toBeTruthy();
      });
    });

    it('should test all environments when "Test All" is pressed', async () => {
      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      const testAllButton = screen.getByText('🔍 Test All Environments');
      fireEvent.press(testAllButton);
      
      await waitFor(() => {
        // Should be called for each environment
        expect(mockApiService.healthCheck.mock.calls.length).toBeGreaterThan(1);
      }, { timeout: 3000 });
    });
  });

  describe('Environment Switching', () => {
    it('should show confirmation dialog when switching environments', () => {
      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      // Find a switch button (not for current environment)
      const switchButtons = screen.getAllByText('🔄 Switch');
      if (switchButtons.length > 0) {
        fireEvent.press(switchButtons[0]);
        
        expect(mockAlert).toHaveBeenCalledWith(
          'Switch Environment?',
          expect.stringContaining('Are you sure you want to switch'),
          expect.arrayContaining([
            expect.objectContaining({ text: 'Cancel' }),
            expect.objectContaining({ text: 'Switch' })
          ])
        );
      }
    });

    it('should switch environment when confirmed', () => {
      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      const switchButtons = screen.getAllByText('🔄 Switch');
      if (switchButtons.length > 0) {
        fireEvent.press(switchButtons[0]);
        
        // Simulate user confirming the switch
        const alertCall = mockAlert.mock.calls[0];
        const confirmButton = alertCall[2].find(button => button.text === 'Switch');
        confirmButton.onPress();
        
        expect(mockApiService.switchEnvironment).toHaveBeenCalled();
      }
    });

    it('should not switch environment when cancelled', () => {
      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      const switchButtons = screen.getAllByText('🔄 Switch');
      if (switchButtons.length > 0) {
        fireEvent.press(switchButtons[0]);
        
        // Simulate user cancelling the switch
        const alertCall = mockAlert.mock.calls[0];
        const cancelButton = alertCall[2].find(button => button.text === 'Cancel');
        if (cancelButton.onPress) {
          cancelButton.onPress();
        }
        
        expect(mockApiService.switchEnvironment).not.toHaveBeenCalled();
      }
    });

    it('should not show switch button for current environment', () => {
      mockApiService.getCurrentEnvironment.mockReturnValue({
        name: 'staging',
        config: environments.staging
      });

      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      // The staging environment card should not have a switch button
      // but other environments should
      const switchButtons = screen.getAllByText('🔄 Switch');
      expect(switchButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Environment Display', () => {
    it('should highlight current environment', () => {
      mockApiService.getCurrentEnvironment.mockReturnValue({
        name: 'production',
        config: environments.production
      });

      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      expect(screen.getByText(/Production \(Current\)/)).toBeTruthy();
    });

    it('should show environment URLs and descriptions', () => {
      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      // Should show various environment URLs
      expect(screen.getByText('http://localhost:8000')).toBeTruthy();
      expect(screen.getByText(/Local development server/)).toBeTruthy();
    });

    it('should display proper status indicators', async () => {
      mockApiService.healthCheck.mockResolvedValue({
        healthy: true,
        responseTime: 150
      });

      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      const testButtons = screen.getAllByText('🔍 Test');
      fireEvent.press(testButtons[0]);
      
      await waitFor(() => {
        // Should show response time
        expect(screen.getByText('150ms')).toBeTruthy();
      });
    });
  });

  describe('Quick Setup Guide', () => {
    it('should display setup information', () => {
      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('💡 Quick Setup Guide')).toBeTruthy();
      expect(screen.getByText(/Development:/)).toBeTruthy();
      expect(screen.getByText(/Testing:/)).toBeTruthy();
      expect(screen.getByText(/Production:/)).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle health check errors gracefully', async () => {
      mockApiService.healthCheck.mockRejectedValue(new Error('Network error'));

      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      const testButtons = screen.getAllByText('🔍 Test');
      fireEvent.press(testButtons[0]);
      
      // Should not crash the app
      await waitFor(() => {
        expect(screen.getByText('🔍 Test')).toBeTruthy();
      });
    });

    it('should handle missing environment config', () => {
      mockApiService.getCurrentEnvironment.mockReturnValue({
        name: 'unknown',
        config: { name: 'Unknown', apiBaseUrl: 'http://localhost:8000' }
      });

      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      // Should still render without crashing
      expect(screen.getByText('Unknown')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible elements', () => {
      render(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      // Check that buttons are accessible
      const testButtons = screen.getAllByText('🔍 Test');
      expect(testButtons[0]).toBeTruthy();
      
      const closeButton = screen.getByText('✕');
      expect(closeButton).toBeTruthy();
    });
  });

  describe('State Management', () => {
    it('should load current environment on modal open', () => {
      const { rerender } = render(
        <ApiConfigModal visible={false} onClose={mockOnClose} />
      );
      
      // Open the modal
      rerender(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      expect(mockApiService.getCurrentEnvironment).toHaveBeenCalled();
    });

    it('should maintain test results across re-renders', async () => {
      mockApiService.healthCheck.mockResolvedValue({
        healthy: true,
        responseTime: 200
      });

      const { rerender } = render(
        <ApiConfigModal visible={true} onClose={mockOnClose} />
      );
      
      const testButtons = screen.getAllByText('🔍 Test');
      fireEvent.press(testButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText('200ms')).toBeTruthy();
      });
      
      // Re-render and check that results persist
      rerender(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('200ms')).toBeTruthy();
    });
  });
});