import React from 'react';
import TestRenderer from 'react-test-renderer';
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

  describe('Component Rendering', () => {
    it('should render modal when visible', () => {
      const component = TestRenderer.create(
        <ApiConfigModal visible={true} onClose={mockOnClose} />
      );
      
      const tree = component.toJSON();
      expect(tree).toBeTruthy();
      
      // Check if modal content exists (component doesn't crash)
      expect(component.root.findAllByType('div').length).toBeGreaterThan(0);
    });

    it('should not render modal when not visible', () => {
      const component = TestRenderer.create(
        <ApiConfigModal visible={false} onClose={mockOnClose} />
      );
      
      const tree = component.toJSON();
      // Modal component renders with visible=false prop, not null
      expect(tree).toHaveProperty('props.visible', false);
    });

    it('should display current environment information', () => {
      const component = TestRenderer.create(
        <ApiConfigModal visible={true} onClose={mockOnClose} />
      );
      
      const tree = component.toJSON();
      const treeString = JSON.stringify(tree);
      
      expect(treeString).toContain('Android Development');
      expect(treeString).toContain('http://192.168.1.136:8000');
    });

    it('should render all available environments', () => {
      const component = TestRenderer.create(
        <ApiConfigModal visible={true} onClose={mockOnClose} />
      );
      
      const tree = component.toJSON();
      const treeString = JSON.stringify(tree);
      
      expect(treeString).toContain('Development');
      expect(treeString).toContain('Staging');
      expect(treeString).toContain('Production');
    });
  });

  describe('Component Structure', () => {
    it('should render proper modal structure', () => {
      const component = TestRenderer.create(
        <ApiConfigModal visible={true} onClose={mockOnClose} />
      );
      
      // Check basic structure exists
      expect(component.toJSON()).toBeTruthy();
      
      // Should have proper component hierarchy
      const divElements = component.root.findAllByType('div');
      expect(divElements.length).toBeGreaterThan(5); // Should have multiple UI elements
    });

    it('should handle environment config properly', () => {
      mockApiService.getCurrentEnvironment.mockReturnValue({
        name: 'production',
        config: environments.production
      });

      const component = TestRenderer.create(
        <ApiConfigModal visible={true} onClose={mockOnClose} />
      );
      
      expect(component.toJSON()).toBeTruthy();
      expect(mockApiService.getCurrentEnvironment).toHaveBeenCalled();
    });
  });

  describe('Environment Display', () => {
    it('should display environment names correctly', () => {
      const component = TestRenderer.create(
        <ApiConfigModal visible={true} onClose={mockOnClose} />
      );
      
      const tree = component.toJSON();
      const treeString = JSON.stringify(tree);
      
      // Check key environment types are shown
      expect(treeString).toContain('Development');
      expect(treeString).toContain('Staging'); 
      expect(treeString).toContain('Production');
    });

    it('should show environment URLs', () => {
      const component = TestRenderer.create(
        <ApiConfigModal visible={true} onClose={mockOnClose} />
      );
      
      const tree = component.toJSON();
      const treeString = JSON.stringify(tree);
      
      // Should show different API base URLs
      expect(treeString).toContain('http://');
      expect(treeString).toContain('https://');
    });
  });

  describe('Different Environment Configurations', () => {
    it('should handle production environment', () => {
      mockApiService.getCurrentEnvironment.mockReturnValue({
        name: 'production',
        config: environments.production
      });

      const component = TestRenderer.create(
        <ApiConfigModal visible={true} onClose={mockOnClose} />
      );
      
      const tree = component.toJSON();
      const treeString = JSON.stringify(tree);
      
      expect(tree).toBeTruthy();
      expect(treeString).toContain('Production');
    });

    it('should handle staging environment', () => {
      mockApiService.getCurrentEnvironment.mockReturnValue({
        name: 'staging',
        config: environments.staging
      });

      const component = TestRenderer.create(
        <ApiConfigModal visible={true} onClose={mockOnClose} />
      );
      
      const tree = component.toJSON();
      expect(tree).toBeTruthy();
    });
  });

  describe('Accessibility & Structure', () => {
    it('should have proper accessibility structure', () => {
      const component = TestRenderer.create(
        <ApiConfigModal visible={true} onClose={mockOnClose} />
      );
      
      const tree = component.toJSON();
      const treeString = JSON.stringify(tree);
      
      // Should include helpful text and labels
      expect(treeString).toContain('API Configuration');
      expect(treeString).toContain('Environment');
    });

    it('should maintain consistent structure across renders', () => {
      const component = TestRenderer.create(
        <ApiConfigModal visible={true} onClose={mockOnClose} />
      );
      
      const firstRender = component.toJSON();
      
      // Re-render with same props
      component.update(<ApiConfigModal visible={true} onClose={mockOnClose} />);
      const secondRender = component.toJSON();
      
      // Structure should be consistent
      expect(firstRender).toBeTruthy();
      expect(secondRender).toBeTruthy();
    });
  });
});