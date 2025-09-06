/**
 * AsyncStorage Persistence End-to-End Tests
 * Tests the complete AsyncStorage functionality across all components
 * after fixing the "native module issue"
 */

import React from 'react';
import TestRenderer, { ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackScreen from '../screens/TrackScreen';
import ReminderSnippet from '../components/ReminderSnippet';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Notifications from 'expo-notifications';
import { apiService } from '../services/ApiService';

// Mock AsyncStorage - this is the key to testing persistence
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
}));

// Mock API Service
jest.mock('../services/ApiService', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }
}));

// Mock Expo modules
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
  ImagePickerResult: {}
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'JPEG' },
  FlipType: {},
  RotateType: {},
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
}));

// Mock Alert to prevent actual alerts during tests
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn((title, message, buttons, options) => {
    // Simulate user pressing the first button (usually OK/Confirm)
    if (buttons && buttons.length > 0 && buttons[0].onPress) {
      buttons[0].onPress();
    }
  })
}));

// Mock axios for ReminderSnippet
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
}));

describe('AsyncStorage Persistence End-to-End Tests', () => {
  const mockOnBackPress = jest.fn();
  const mockImagePickerResult = {
    canceled: false,
    assets: [{
      uri: 'mock://image.jpg',
      width: 100,
      height: 100,
    }]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted'
    });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue(mockImagePickerResult);
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue(mockImagePickerResult);
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'mock://processed-image.jpg',
      width: 100,
      height: 100
    });

    // Mock notifications permissions
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted'
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted'
    });

    // Mock AsyncStorage to simulate empty storage initially
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
  });

  describe('TrackScreen AsyncStorage Persistence', () => {
    describe('Photo Logs Persistence', () => {
      it('should save photo logs to AsyncStorage when meal is marked as eaten', async () => {
        const component = TestRenderer.create(
          <TrackScreen onBackPress={mockOnBackPress} />
        );

        // Simulate adding a meal and marking it as eaten
        const instance = component.getInstance() as any;
        
        // Mock meal data
        const mockMeal = {
          barcode: '123456789',
          name: 'Test Meal',
          brand: 'Test Brand',
          image_url: 'mock://meal-image.jpg',
          calories_per_serving: 250
        };

        // Trigger photo upload and meal eaten workflow
        await instance.handleEatenMeal(mockMeal, mockImagePickerResult.assets[0].uri);

        // Verify AsyncStorage.setItem was called with photo_logs
        expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
          'photo_logs',
          expect.stringContaining('mock://meal-image.jpg')
        );

        // Verify the stored data structure
        const storedData = JSON.parse(
          (mockAsyncStorage.setItem as jest.Mock).mock.calls
            .find(call => call[0] === 'photo_logs')?.[1] || '[]'
        );
        
        expect(storedData).toHaveLength(1);
        expect(storedData[0]).toMatchObject({
          mealName: mockMeal.name,
          brand: mockMeal.brand,
          calories: mockMeal.calories_per_serving,
          imageUri: mockImagePickerResult.assets[0].uri
        });
      });

      it('should load existing photo logs from AsyncStorage on component mount', async () => {
        const existingPhotoLogs = [
          {
            id: '1',
            timestamp: new Date().toISOString(),
            mealName: 'Existing Meal',
            brand: 'Existing Brand',
            calories: 300,
            imageUri: 'mock://existing-image.jpg'
          }
        ];

        mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(existingPhotoLogs));

        const component = TestRenderer.create(
          <TrackScreen onBackPress={mockOnBackPress} />
        );

        // Wait for component to load data
        await TestRenderer.act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });

        // Verify AsyncStorage.getItem was called for photo_logs
        expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('photo_logs');

        // Verify the component state contains the loaded data
        const instance = component.getInstance() as any;
        expect(instance.state?.photoLogs || []).toHaveLength(1);
      });

      it('should persist multiple photo logs correctly', async () => {
        const component = TestRenderer.create(
          <TrackScreen onBackPress={mockOnBackPress} />
        );

        const instance = component.getInstance() as any;

        // Add multiple meals
        const meals = [
          { barcode: '111', name: 'Meal 1', brand: 'Brand 1', calories_per_serving: 100 },
          { barcode: '222', name: 'Meal 2', brand: 'Brand 2', calories_per_serving: 200 }
        ];

        for (const meal of meals) {
          await instance.handleEatenMeal(meal, `mock://image-${meal.barcode}.jpg`);
        }

        // Verify both meals were saved
        const photoLogsCalls = (mockAsyncStorage.setItem as jest.Mock).mock.calls
          .filter(call => call[0] === 'photo_logs');
        
        expect(photoLogsCalls.length).toBe(2);

        // Check the final state has both meals
        const finalData = JSON.parse(photoLogsCalls[photoLogsCalls.length - 1][1]);
        expect(finalData).toHaveLength(2);
      });
    });

    describe('Weight History Persistence', () => {
      it('should save weight history to AsyncStorage when weight is recorded', async () => {
        const component = TestRenderer.create(
          <TrackScreen onBackPress={mockOnBackPress} />
        );

        const instance = component.getInstance() as any;
        const testWeight = 75.5;
        const testPhoto = mockImagePickerResult.assets[0].uri;

        // Trigger weight recording
        await instance.handleWeightSubmit(testWeight, testPhoto);

        // Verify AsyncStorage.setItem was called with weight_history
        expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
          'weight_history',
          expect.any(String)
        );

        // Verify the stored data structure
        const storedData = JSON.parse(
          (mockAsyncStorage.setItem as jest.Mock).mock.calls
            .find(call => call[0] === 'weight_history')?.[1] || '[]'
        );
        
        expect(storedData).toHaveLength(1);
        expect(storedData[0]).toMatchObject({
          weight: testWeight,
          date: expect.any(String)
        });
      });

      it('should load existing weight history from AsyncStorage on component mount', async () => {
        const existingWeightHistory = [
          { id: '1', weight: 75.0, date: '2024-01-01', photo: null },
          { id: '2', weight: 74.5, date: '2024-01-08', photo: null }
        ];

        mockAsyncStorage.getItem.mockImplementation((key) => {
          if (key === 'weight_history') {
            return Promise.resolve(JSON.stringify(existingWeightHistory));
          }
          return Promise.resolve(null);
        });

        const component = TestRenderer.create(
          <TrackScreen onBackPress={mockOnBackPress} />
        );

        // Wait for component to load data
        await TestRenderer.act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });

        // Verify AsyncStorage.getItem was called for weight_history
        expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('weight_history');

        // Verify the component state contains the loaded data
        const instance = component.getInstance() as any;
        expect(instance.state?.weightHistory || []).toHaveLength(2);
      });

      it('should maintain weight history limit of 10 entries', async () => {
        // Pre-populate with 10 entries
        const existingWeightHistory = Array.from({ length: 10 }, (_, i) => ({
          id: `${i + 1}`,
          weight: 75.0 - i * 0.1,
          date: `2024-01-${String(i + 1).padStart(2, '0')}`,
          photo: null
        }));

        mockAsyncStorage.getItem.mockImplementation((key) => {
          if (key === 'weight_history') {
            return Promise.resolve(JSON.stringify(existingWeightHistory));
          }
          return Promise.resolve(null);
        });

        const component = TestRenderer.create(
          <TrackScreen onBackPress={mockOnBackPress} />
        );

        const instance = component.getInstance() as any;

        // Add one more entry
        await instance.handleWeightSubmit(74.0, null);

        // Verify that only last 10 entries are kept
        const storedData = JSON.parse(
          (mockAsyncStorage.setItem as jest.Mock).mock.calls
            .find(call => call[0] === 'weight_history')?.[1] || '[]'
        );
        
        expect(storedData).toHaveLength(10);
        expect(storedData[0].weight).toBe(74.0); // New entry should be first
      });
    });

    describe('Error Handling', () => {
      it('should handle AsyncStorage setItem errors gracefully', async () => {
        mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage full'));
        
        const component = TestRenderer.create(
          <TrackScreen onBackPress={mockOnBackPress} />
        );

        const instance = component.getInstance() as any;

        // This should not crash the app
        await expect(
          instance.handleWeightSubmit(75.5, null)
        ).resolves.not.toThrow();

        // Component should still be functional
        expect(component.toJSON()).toBeTruthy();
      });

      it('should handle AsyncStorage getItem errors gracefully', async () => {
        mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage read error'));
        
        const component = TestRenderer.create(
          <TrackScreen onBackPress={mockOnBackPress} />
        );

        // Wait for component to attempt loading data
        await TestRenderer.act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });

        // Component should render despite storage error
        expect(component.toJSON()).toBeTruthy();
      });
    });
  });

  describe('ReminderSnippet AsyncStorage Persistence', () => {
    it('should save reminders to AsyncStorage when reminder is created', async () => {
      const component = TestRenderer.create(<ReminderSnippet />);

      const instance = component.getInstance() as any;
      
      const testReminder = {
        id: '1',
        type: 'meal' as const,
        label: 'Breakfast Reminder',
        time: '08:00',
        days: [true, true, true, true, true, false, false],
        enabled: true,
        notificationId: 'notif1'
      };

      // Trigger reminder creation
      await instance.saveReminders([testReminder]);

      // Verify AsyncStorage.setItem was called with reminders
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'reminders',
        JSON.stringify([testReminder])
      );
    });

    it('should load existing reminders from AsyncStorage on component mount', async () => {
      const existingReminders = [
        {
          id: '1',
          type: 'meal' as const,
          label: 'Morning Meal',
          time: '07:00',
          days: [true, true, true, true, true, false, false],
          enabled: true,
          notificationId: 'morning'
        }
      ];

      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'reminders') {
          return Promise.resolve(JSON.stringify(existingReminders));
        }
        return Promise.resolve(null);
      });

      const component = TestRenderer.create(<ReminderSnippet />);

      // Wait for component to load data
      await TestRenderer.act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Verify AsyncStorage.getItem was called for reminders
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('reminders');

      // Verify the component state contains the loaded data
      const instance = component.getInstance() as any;
      expect(instance.state?.reminders || []).toHaveLength(1);
    });

    it('should update reminders in AsyncStorage when reminder is modified', async () => {
      const component = TestRenderer.create(<ReminderSnippet />);

      const instance = component.getInstance() as any;
      
      const originalReminder = {
        id: '1',
        type: 'meal' as const,
        label: 'Breakfast',
        time: '08:00',
        days: [true, true, true, true, true, false, false],
        enabled: true,
        notificationId: 'breakfast'
      };

      const updatedReminder = {
        ...originalReminder,
        time: '09:00',
        enabled: false
      };

      // Save original
      await instance.saveReminders([originalReminder]);
      
      // Update reminder
      await instance.saveReminders([updatedReminder]);

      // Verify both saves happened
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(2);
      
      // Verify final state is correct
      const finalCall = (mockAsyncStorage.setItem as jest.Mock).mock.calls[1];
      expect(finalCall[0]).toBe('reminders');
      
      const finalReminders = JSON.parse(finalCall[1]);
      expect(finalReminders[0].time).toBe('09:00');
      expect(finalReminders[0].enabled).toBe(false);
    });

    it('should handle reminder deletion from AsyncStorage', async () => {
      const component = TestRenderer.create(<ReminderSnippet />);

      const instance = component.getInstance() as any;
      
      const reminders = [
        { id: '1', type: 'meal' as const, label: 'Reminder 1', time: '08:00', days: [], enabled: true, notificationId: 'r1' },
        { id: '2', type: 'meal' as const, label: 'Reminder 2', time: '12:00', days: [], enabled: true, notificationId: 'r2' }
      ];

      // Save two reminders
      await instance.saveReminders(reminders);
      
      // Delete one reminder (save array with only one item)
      await instance.saveReminders([reminders[0]]);

      // Verify final state has only one reminder
      const finalCall = (mockAsyncStorage.setItem as jest.Mock).mock.calls[1];
      const finalReminders = JSON.parse(finalCall[1]);
      expect(finalReminders).toHaveLength(1);
      expect(finalReminders[0].id).toBe('1');
    });

    it('should handle AsyncStorage errors during reminder operations', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));
      
      const component = TestRenderer.create(<ReminderSnippet />);

      const instance = component.getInstance() as any;
      
      const reminder = {
        id: '1',
        type: 'meal' as const,
        label: 'Test Reminder',
        time: '08:00',
        days: [],
        enabled: true,
        notificationId: 'test'
      };

      // This should not crash the component
      await expect(
        instance.saveReminders([reminder])
      ).resolves.not.toThrow();

      // Component should still be functional
      expect(component.toJSON()).toBeTruthy();
    });
  });

  describe('Cross-Component AsyncStorage Integration', () => {
    it('should maintain separate storage keys for different data types', async () => {
      const trackComponent = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      const reminderComponent = TestRenderer.create(<ReminderSnippet />);

      const trackInstance = trackComponent.getInstance() as any;
      const reminderInstance = reminderComponent.getInstance() as any;

      // Add data to both components
      await trackInstance.handleWeightSubmit(75.0, null);
      await reminderInstance.saveReminders([{
        id: '1',
        type: 'meal' as const,
        label: 'Test',
        time: '08:00',
        days: [],
        enabled: true,
        notificationId: 'test'
      }]);

      // Verify different storage keys were used
      const calls = (mockAsyncStorage.setItem as jest.Mock).mock.calls;
      const keys = calls.map(call => call[0]);
      
      expect(keys).toContain('weight_history');
      expect(keys).toContain('reminders');
      expect(keys).not.toContain('photo_logs'); // Only if meal was marked eaten
    });

    it('should handle concurrent AsyncStorage operations', async () => {
      const component1 = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );
      
      const component2 = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );

      const instance1 = component1.getInstance() as any;
      const instance2 = component2.getInstance() as any;

      // Trigger concurrent operations
      const operations = [
        instance1.handleWeightSubmit(75.0, null),
        instance2.handleWeightSubmit(76.0, null)
      ];

      await Promise.all(operations);

      // Both operations should complete successfully
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data Consistency and Recovery', () => {
    it('should handle corrupted AsyncStorage data gracefully', async () => {
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'weight_history') {
          return Promise.resolve('invalid json data');
        }
        return Promise.resolve(null);
      });

      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );

      // Wait for component to attempt loading data
      await TestRenderer.act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Component should render despite corrupted data
      expect(component.toJSON()).toBeTruthy();

      // Should start with empty state
      const instance = component.getInstance() as any;
      expect(instance.state?.weightHistory || []).toHaveLength(0);
    });

    it('should maintain data integrity during storage operations', async () => {
      const component = TestRenderer.create(
        <TrackScreen onBackPress={mockOnBackPress} />
      );

      const instance = component.getInstance() as any;

      // Add multiple weight entries
      const weights = [75.0, 74.8, 74.5];
      
      for (const weight of weights) {
        await instance.handleWeightSubmit(weight, null);
      }

      // Verify each storage operation contains valid JSON
      const calls = (mockAsyncStorage.setItem as jest.Mock).mock.calls
        .filter(call => call[0] === 'weight_history');

      calls.forEach(([key, data]) => {
        expect(() => JSON.parse(data)).not.toThrow();
        const parsed = JSON.parse(data);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBeGreaterThan(0);
      });
    });
  });
});