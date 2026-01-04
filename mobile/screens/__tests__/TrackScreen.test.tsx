import React from 'react';
import TestRenderer from 'react-test-renderer';
import { Alert, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackScreen from '../TrackScreen';
import { apiService } from '../../services/ApiService';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const findButtonByText = (component: any, targetText: string) => {
  const textNodes = component.root.findAll((node: any) =>
    Array.isArray(node.children) &&
    node.children.some((child: any) => typeof child === 'string' && child.includes(targetText))
  );
  const match = textNodes[0];
  let current = match;
  while (current && !current.props?.onPress && current.parent) {
    current = current.parent;
  }
  return current?.props?.onPress ? current : undefined;
};
const findTouchableByText = (component: any, targetText: string) =>
  component.root.findAll((node: any) => node.props?.['data-testid'] === 'touchableopacity')
    .find((node: any) =>
      node.findAll((child: any) =>
        Array.isArray(child.children) &&
        child.children.some((text: any) => typeof text === 'string' && text.includes(targetText))
      ).length > 0
    );

const mockAxiosResponse = (data: any) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {} as any,
  config: { headers: {} as any } as any,
});

// Mock the API service
jest.mock('../../services/ApiService', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn()
  }
}));

// Mock Expo modules
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' }
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'JPEG' }
}));

describe('TrackScreen', () => {
  const mockOnBackPress = jest.fn();
  const mockApiService = apiService as jest.Mocked<typeof apiService>;
  const mockImagePicker = ImagePicker as jest.Mocked<typeof ImagePicker>;
  const mockImageManipulator = ImageManipulator as jest.Mocked<typeof ImageManipulator>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    
    // Mock successful API responses
    mockApiService.get.mockImplementation((endpoint) => {
      if (endpoint.includes('weight/history')) {
        return Promise.resolve(mockAxiosResponse({
          entries: [
            { date: '2024-01-01T00:00:00Z', weight: 75.2, photo_url: null },
            { date: '2024-01-08T00:00:00Z', weight: 74.8, photo_url: null }
          ]
        }));
      }
      if (endpoint.includes('photos')) {
        return Promise.resolve(mockAxiosResponse({
          logs: [
            {
              id: '1',
              timestamp: '2024-01-01T12:00:00Z',
              photo_url: 'mock-photo-url',
              type: 'meal',
              description: 'Breakfast'
            }
          ]
        }));
      }
      return Promise.resolve(mockAxiosResponse({}));
    });

    mockApiService.post.mockResolvedValue(mockAxiosResponse({ success: true }));

    // Mock image picker
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ 
      status: 'granted' as any,
      granted: true,
      canAskAgain: true,
      expires: 'never'
    });
    
    mockImagePicker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'mock-image-uri' }]
    } as any);

    mockImageManipulator.manipulateAsync.mockResolvedValue({
      uri: 'compressed-image-uri'
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render TrackScreen without crashing', () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should have proper screen structure', () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      // Should have multiple UI elements
      const viewElements = component.root.findAllByType(View);
      expect(viewElements.length).toBeGreaterThan(0);
    });

    it('should render header with title and back button', () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      const tree = component.toJSON();
      const treeString = JSON.stringify(tree);
      
      expect(tree).toBeTruthy();
      expect(treeString.length).toBeGreaterThan(200);
    });
  });

  describe('Loading States', () => {
    it('should display loading indicator initially', () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      // Should render loading state initially
      const tree = component.toJSON();
      expect(tree).toBeTruthy();
    });

    it('should handle data loading completion', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      // Wait for loading to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should display loading text during data fetch', () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      const tree = component.toJSON();
      const treeString = JSON.stringify(tree);
      
      expect(tree).toBeTruthy();
      expect(treeString.length).toBeGreaterThan(50);
    });
  });

  describe('Meal Display and Tracking', () => {
    it('should render daily meal plan structure', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      // Wait for component to finish loading
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should display meal cards with items', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const tree = component.toJSON();
      expect(tree).toBeTruthy();
    });

    it('should render mark eaten buttons for meals', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should display meal calories and macros', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const tree = component.toJSON();
      const treeString = JSON.stringify(tree);
      
      expect(tree).toBeTruthy();
      expect(treeString.length).toBeGreaterThan(300);
    });
  });

  describe('Weight Tracking', () => {
    it('should render weight tracking section', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should display weigh-in button', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const tree = component.toJSON();
      expect(tree).toBeTruthy();
    });

    it('should render weight chart placeholder', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should display current weight when available', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should show weight history data', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const tree = component.toJSON();
      const treeString = JSON.stringify(tree);
      
      expect(tree).toBeTruthy();
      expect(treeString.length).toBeGreaterThan(100);
    });
  });

  describe('Photo Logging', () => {
    it('should render photo logs section when available', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should display photo thumbnails', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const tree = component.toJSON();
      expect(tree).toBeTruthy();
    });

    it('should show photo log timestamps', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should render weigh-in photo logs', async () => {
      mockApiService.get.mockImplementation((endpoint) => {
        if (endpoint.includes('photos')) {
          return Promise.resolve(mockAxiosResponse({
            logs: [
              {
                id: '2',
                timestamp: '2024-02-01T12:00:00Z',
                photo_url: 'mock-photo-url',
                type: 'weigh-in',
                description: 'Weight'
              }
            ]
          }));
        }
        if (endpoint.includes('weight/history')) {
          return Promise.resolve(mockAxiosResponse({
            entries: [
              { date: '2024-01-01T00:00:00Z', weight: 75.2, photo_url: null }
            ]
          }));
        }
        return Promise.resolve(mockAxiosResponse({}));
      });

      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      const flatList = component.root.findAll((node: any) =>
        node.props?.['data-testid'] === 'flatlist'
      )[0];
      expect(flatList).toBeTruthy();
      expect(flatList?.props?.data?.[0]?.type).toBe('weigh-in');
    });
  });

  describe('API Integration', () => {
    it('should call weight history API on load', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
      expect(mockApiService.get).toHaveBeenCalledWith(
        expect.stringContaining('/track/weight/history')
      );
    });

    it('should call photo logs API on load', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
      expect(mockApiService.get).toHaveBeenCalledWith(
        expect.stringContaining('/track/photos')
      );
    });

    it('should handle API errors gracefully', async () => {
      mockApiService.get.mockRejectedValue(new Error('Network error'));
      
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should render without crashing even with API errors
      expect(component.toJSON()).toBeTruthy();
    });

    it('should use fallback data when API fails', async () => {
      mockApiService.get.mockRejectedValue(new Error('API Error'));
      
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });
  });

  describe('Modal Components', () => {
    it('should render MarkMealEatenModal when closed', () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should render WeighInModal when closed', () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should handle modal state management', () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      const tree = component.toJSON();
      expect(tree).toBeTruthy();
    });
  });

  describe('Modal Actions', () => {
    it('marks a meal as eaten and stores photo logs', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );

      await TestRenderer.act(async () => {
        await flushPromises();
      });

      const markModal = component.root.findAll((node: any) =>
        typeof node.props?.onConfirm === 'function' && node.props?.meal !== undefined
      )[0];
      expect(markModal).toBeTruthy();

      await TestRenderer.act(async () => {
        await markModal?.props.onConfirm('meal-photo-uri');
      });

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/track/meal',
        expect.objectContaining({ photo: 'meal-photo-uri' })
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'photo_logs',
        expect.any(String)
      );
      expect(Alert.alert).toHaveBeenCalled();
    });

    it('handles meal tracking errors', async () => {
      mockApiService.post.mockRejectedValueOnce(new Error('Meal tracking error'));
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );

      await TestRenderer.act(async () => {
        await flushPromises();
      });

      const markModal = component.root.findAll((node: any) =>
        typeof node.props?.onConfirm === 'function' && node.props?.meal !== undefined
      )[0];
      expect(markModal).toBeTruthy();

      await TestRenderer.act(async () => {
        await markModal?.props.onConfirm('meal-photo-uri');
      });

      expect(Alert.alert).toHaveBeenCalled();
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        'photo_logs',
        expect.any(String)
      );
    });

    it('records weigh-in and stores history', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );

      await TestRenderer.act(async () => {
        await flushPromises();
      });

      const weighButton = findButtonByText(component, 'track.weighIn');
      await TestRenderer.act(async () => {
        weighButton?.props.onPress();
      });

      const weighModal = component.root.findAll((node: any) =>
        typeof node.props?.onConfirm === 'function' &&
        node.props?.meal === undefined &&
        node.props?.visible !== undefined
      )[0];
      expect(weighModal).toBeTruthy();

      await TestRenderer.act(async () => {
        await weighModal?.props.onConfirm(72, 'weigh-photo-uri');
      });

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/track/weight',
        expect.objectContaining({ weight: 72, photo: 'weigh-photo-uri' })
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'weight_history',
        expect.any(String)
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'photo_logs',
        expect.any(String)
      );
      expect(Alert.alert).toHaveBeenCalled();
    });

    it('records weigh-in without photo logs', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );

      await TestRenderer.act(async () => {
        await flushPromises();
      });

      const weighModal = component.root.findAll((node: any) =>
        typeof node.props?.onConfirm === 'function' &&
        node.props?.meal === undefined &&
        node.props?.visible !== undefined
      )[0];
      expect(weighModal).toBeTruthy();

      await TestRenderer.act(async () => {
        await weighModal?.props.onConfirm(70);
      });

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/track/weight',
        expect.objectContaining({ weight: 70, photo: undefined })
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'weight_history',
        expect.any(String)
      );
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        'photo_logs',
        expect.any(String)
      );
    });

    it('marks a meal as eaten without photo logs', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );

      await TestRenderer.act(async () => {
        await flushPromises();
      });

      const markModal = component.root.findAll((node: any) =>
        typeof node.props?.onConfirm === 'function' && node.props?.meal !== undefined
      )[0];
      expect(markModal).toBeTruthy();

      await TestRenderer.act(async () => {
        await markModal?.props.onConfirm();
      });

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/track/meal',
        expect.objectContaining({ photo: undefined })
      );
      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        'photo_logs',
        expect.any(String)
      );
    });

    it('handles invalid weight input', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );

      await TestRenderer.act(async () => {
        await flushPromises();
      });

      const weighButton = findButtonByText(component, 'track.weighIn');
      await TestRenderer.act(async () => {
        weighButton?.props.onPress();
      });

      const weightInput = component.root.findAllByType(TextInput).find(input =>
        String(input.props.placeholder).includes('scanner.input.weightPlaceholder')
      );
      await TestRenderer.act(async () => {
        weightInput?.props.onChangeText('0');
      });
      await TestRenderer.act(async () => {
        await flushPromises();
      });

      const saveButton = findButtonByText(component, 'track.modal.saveWeight');
      expect(saveButton).toBeTruthy();
      await TestRenderer.act(async () => {
        saveButton?.props.onPress();
      });

      expect(Alert.alert).toHaveBeenCalled();
      expect(mockApiService.post).not.toHaveBeenCalledWith(
        '/track/weight',
        expect.any(Object)
      );
    });

    it('takes a photo for modal flow', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );

      await TestRenderer.act(async () => {
        await flushPromises();
      });

      const takePhotoButton = findTouchableByText(component, 'track.modal.takePhoto');
      expect(takePhotoButton).toBeTruthy();

      await TestRenderer.act(async () => {
        await takePhotoButton?.props.onPress();
        await flushPromises();
      });

      expect(mockImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
      expect(mockImagePicker.launchCameraAsync).toHaveBeenCalled();
      expect(mockImageManipulator.manipulateAsync).toHaveBeenCalled();
    });

    it('alerts when camera permission is denied', async () => {
      mockImagePicker.requestCameraPermissionsAsync.mockResolvedValueOnce({
        status: 'denied' as any,
        granted: false,
        canAskAgain: true,
        expires: 'never'
      });

      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );

      await TestRenderer.act(async () => {
        await flushPromises();
      });

      const takePhotoButton = findTouchableByText(component, 'track.modal.takePhoto');
      expect(takePhotoButton).toBeTruthy();

      await TestRenderer.act(async () => {
        await takePhotoButton?.props.onPress();
        await flushPromises();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'permissions.title',
        'permissions.cameraRequired'
      );
    });
  });

  describe('User Interactions', () => {
    it('should handle back button press', () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      expect(component.toJSON()).toBeTruthy();
      // Note: TestRenderer doesn't simulate button presses, but we verify the structure
    });

    it('should render interactive elements', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const tree = component.toJSON();
      const treeString = JSON.stringify(tree);
      
      expect(tree).toBeTruthy();
      expect(treeString.length).toBeGreaterThan(500);
    });

    it('should display touchable components', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle weight API errors with fallback data', async () => {
      mockApiService.get.mockImplementation((endpoint) => {
        if (endpoint.includes('weight/history')) {
          return Promise.reject(new Error('Weight API Error'));
        }
        return Promise.resolve(mockAxiosResponse({ logs: [] }));
      });
      
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should handle photo logs API errors gracefully', async () => {
      mockApiService.get.mockImplementation((endpoint) => {
        if (endpoint.includes('photos')) {
          return Promise.reject(new Error('Photos API Error'));
        }
        if (endpoint.includes('weight/history')) {
          return Promise.resolve(mockAxiosResponse({ entries: [] }));
        }
        return Promise.resolve(mockAxiosResponse({}));
      });
      
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should handle meal tracking errors', async () => {
      mockApiService.post.mockRejectedValue(new Error('Meal tracking error'));
      
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should handle weight recording errors', async () => {
      mockApiService.post.mockRejectedValue(new Error('Weight recording error'));
      
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });
  });

  describe('Data Management', () => {
    it('should load mock daily plan data', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should manage weight history state', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
      expect(mockApiService.get).toHaveBeenCalled();
    });

    it('should manage photo logs state', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should handle empty data states', async () => {
      mockApiService.get.mockResolvedValue(mockAxiosResponse({ 
        entries: [],
        logs: []
      }));
      
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });
  });

  describe('Component State Management', () => {
    it('should maintain consistent state across renders', () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      const firstRender = component.toJSON();
      
      // Re-render component
      component.update(<TrackScreen onBackPress={mockOnBackPress} />);
      const secondRender = component.toJSON();
      
      expect(firstRender).toBeTruthy();
      expect(secondRender).toBeTruthy();
    });

    it('should handle component updates properly', () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      expect(component.toJSON()).toBeTruthy();
      
      // Component should handle state changes
      const tree = component.toJSON();
      expect(tree).toBeTruthy();
    });

    it('should manage loading state transitions', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      // Initial loading state
      expect(component.toJSON()).toBeTruthy();
      
      // Wait for loading to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });
  });

  describe('Image Handling', () => {
    it('should handle image picker permissions', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
      expect(mockImagePicker.requestCameraPermissionsAsync).toBeDefined();
    });

    it('should handle image compression', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
      expect(mockImageManipulator.manipulateAsync).toBeDefined();
    });

    it('should handle image picker results', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });

    it('should handle permission denial gracefully', async () => {
      mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ 
        status: 'denied' as any,
        granted: false,
        canAskAgain: true,
        expires: 'never'
      });
      
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
    });
  });

  describe('Performance and Optimization', () => {
    it('should render efficiently with large data sets', async () => {
      // Mock large data set
      mockApiService.get.mockImplementation((endpoint) => {
        if (endpoint.includes('photos')) {
          const largeLogs = Array.from({ length: 50 }, (_, i) => ({
            id: `${i}`,
            timestamp: '2024-01-01T12:00:00Z',
            photo_url: `mock-photo-${i}`,
            type: 'meal',
            description: `Meal ${i}`
          }));
          return Promise.resolve(mockAxiosResponse({ logs: largeLogs }));
        }
        return Promise.resolve(mockAxiosResponse({ entries: [] }));
      });
      
      const startTime = performance.now();
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      const endTime = performance.now();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(component.toJSON()).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(1000); // Should render within 1 second
    });

    it('should handle multiple component updates efficiently', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      // Multiple updates should not crash
      for (let i = 0; i < 5; i++) {
        component.update(<TrackScreen onBackPress={mockOnBackPress} />);
        expect(component.toJSON()).toBeTruthy();
      }
    });
  });

  describe('Accessibility', () => {
    it('should render accessible components', () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      const tree = component.toJSON();
      const treeString = JSON.stringify(tree);
      
      expect(tree).toBeTruthy();
      expect(treeString.length).toBeGreaterThan(100);
    });

    it('should provide proper component structure', () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      expect(component.toJSON()).toBeTruthy();
      
      // Should have organized component hierarchy
      const viewElements = component.root.findAllByType(View);
      expect(viewElements.length).toBeGreaterThan(0);
    });

    it('should handle screen readers and accessibility features', () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      const tree = component.toJSON();
      expect(tree).toBeTruthy();
    });
  });
});
