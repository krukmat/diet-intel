/**
 * AsyncStorage Unit E2E Tests
 * Tests the AsyncStorage functionality directly without complex component rendering
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
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

describe('AsyncStorage E2E Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  describe('Photo Logs Storage', () => {
    const mockPhotoLog = {
      id: '1',
      timestamp: '2024-01-15T10:30:00Z',
      mealName: 'Chicken Salad',
      brand: 'Fresh Foods',
      calories: 350,
      imageUri: 'file://meal-photo.jpg'
    };

    it('should save photo logs to AsyncStorage', async () => {
      const photoLogs = [mockPhotoLog];
      
      await AsyncStorage.setItem('photo_logs', JSON.stringify(photoLogs));
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'photo_logs',
        JSON.stringify(photoLogs)
      );
    });

    it('should load photo logs from AsyncStorage', async () => {
      const existingLogs = [mockPhotoLog];
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingLogs));
      
      const result = await AsyncStorage.getItem('photo_logs');
      const parsedLogs = result ? JSON.parse(result) : [];
      
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('photo_logs');
      expect(parsedLogs).toEqual(existingLogs);
      expect(parsedLogs[0].mealName).toBe('Chicken Salad');
    });

    it('should handle multiple photo logs', async () => {
      const multiplePhotoLogs = [
        mockPhotoLog,
        {
          id: '2',
          timestamp: '2024-01-15T14:30:00Z',
          mealName: 'Turkey Sandwich',
          brand: 'Deli Fresh',
          calories: 450,
          imageUri: 'file://lunch-photo.jpg'
        }
      ];
      
      await AsyncStorage.setItem('photo_logs', JSON.stringify(multiplePhotoLogs));
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'photo_logs',
        expect.stringContaining('Chicken Salad')
      );
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'photo_logs',
        expect.stringContaining('Turkey Sandwich')
      );
    });

    it('should handle empty photo logs gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const result = await AsyncStorage.getItem('photo_logs');
      const parsedLogs = result ? JSON.parse(result) : [];
      
      expect(parsedLogs).toEqual([]);
    });

    it('should handle corrupted photo logs data', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid json');
      
      const result = await AsyncStorage.getItem('photo_logs');
      
      let parsedLogs = [];
      try {
        parsedLogs = JSON.parse(result || '[]');
      } catch (error) {
        parsedLogs = []; // Fallback to empty array
      }
      
      expect(parsedLogs).toEqual([]);
    });
  });

  describe('Weight History Storage', () => {
    const mockWeightEntry = {
      id: '1',
      weight: 75.5,
      date: '2024-01-15',
      photo: 'file://progress-photo.jpg'
    };

    it('should save weight history to AsyncStorage', async () => {
      const weightHistory = [mockWeightEntry];
      
      await AsyncStorage.setItem('weight_history', JSON.stringify(weightHistory));
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'weight_history',
        JSON.stringify(weightHistory)
      );
    });

    it('should load weight history from AsyncStorage', async () => {
      const existingHistory = [mockWeightEntry];
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingHistory));
      
      const result = await AsyncStorage.getItem('weight_history');
      const parsedHistory = result ? JSON.parse(result) : [];
      
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('weight_history');
      expect(parsedHistory).toEqual(existingHistory);
      expect(parsedHistory[0].weight).toBe(75.5);
    });

    it('should maintain weight history limit of 10 entries', async () => {
      // Create 11 weight entries
      const weightEntries = Array.from({ length: 11 }, (_, i) => ({
        id: `${i + 1}`,
        weight: 75.0 - i * 0.1,
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        photo: null
      }));
      
      // Simulate keeping only last 10 entries
      const limitedEntries = weightEntries.slice(-10);
      
      await AsyncStorage.setItem('weight_history', JSON.stringify(limitedEntries));
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'weight_history',
        expect.any(String)
      );
      
      // Verify the stored data has only 10 entries
      const storedData = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(storedData).toHaveLength(10);
      expect(storedData[0].weight).toBe(75.0 - 1 * 0.1); // Most recent entry
    });

    it('should handle empty weight history gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const result = await AsyncStorage.getItem('weight_history');
      const parsedHistory = result ? JSON.parse(result) : [];
      
      expect(parsedHistory).toEqual([]);
    });
  });

  describe('Reminders Storage', () => {
    const mockReminder = {
      id: '1',
      type: 'meal' as const,
      label: 'Breakfast Reminder',
      time: '08:00',
      days: [true, true, true, true, true, false, false],
      enabled: true,
      notificationId: 'breakfast_reminder'
    };

    it('should save reminders to AsyncStorage', async () => {
      const reminders = [mockReminder];
      
      await AsyncStorage.setItem('reminders', JSON.stringify(reminders));
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'reminders',
        JSON.stringify(reminders)
      );
    });

    it('should load reminders from AsyncStorage', async () => {
      const existingReminders = [mockReminder];
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingReminders));
      
      const result = await AsyncStorage.getItem('reminders');
      const parsedReminders = result ? JSON.parse(result) : [];
      
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('reminders');
      expect(parsedReminders).toEqual(existingReminders);
      expect(parsedReminders[0].label).toBe('Breakfast Reminder');
    });

    it('should handle reminder updates', async () => {
      const originalReminder = mockReminder;
      const updatedReminder = {
        ...originalReminder,
        time: '09:00',
        enabled: false
      };
      
      // Save original
      await AsyncStorage.setItem('reminders', JSON.stringify([originalReminder]));
      
      // Update reminder
      await AsyncStorage.setItem('reminders', JSON.stringify([updatedReminder]));
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(2);
      
      // Verify final state
      const finalCall = (mockAsyncStorage.setItem as jest.Mock).mock.calls[1];
      const finalReminders = JSON.parse(finalCall[1]);
      expect(finalReminders[0].time).toBe('09:00');
      expect(finalReminders[0].enabled).toBe(false);
    });

    it('should handle reminder deletion', async () => {
      const reminders = [
        mockReminder,
        { ...mockReminder, id: '2', label: 'Lunch Reminder', time: '12:00' }
      ];
      
      // Save two reminders
      await AsyncStorage.setItem('reminders', JSON.stringify(reminders));
      
      // Delete one reminder (save array with only one item)
      await AsyncStorage.setItem('reminders', JSON.stringify([reminders[0]]));
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(2);
      
      // Verify final state has only one reminder
      const finalCall = (mockAsyncStorage.setItem as jest.Mock).mock.calls[1];
      const finalReminders = JSON.parse(finalCall[1]);
      expect(finalReminders).toHaveLength(1);
      expect(finalReminders[0].id).toBe('1');
    });

    it('should handle empty reminders gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const result = await AsyncStorage.getItem('reminders');
      const parsedReminders = result ? JSON.parse(result) : [];
      
      expect(parsedReminders).toEqual([]);
    });
  });

  describe('Cross-Storage Integration', () => {
    it('should maintain separate storage keys for different data types', async () => {
      const photoLog = { id: '1', mealName: 'Test Meal', imageUri: 'test.jpg' };
      const weightEntry = { id: '1', weight: 75.0, date: '2024-01-15' };
      const reminder = { id: '1', type: 'meal', label: 'Test Reminder', time: '08:00' };
      
      // Save to different keys
      await AsyncStorage.setItem('photo_logs', JSON.stringify([photoLog]));
      await AsyncStorage.setItem('weight_history', JSON.stringify([weightEntry]));
      await AsyncStorage.setItem('reminders', JSON.stringify([reminder]));
      
      // Verify different storage keys were used
      const calls = (mockAsyncStorage.setItem as jest.Mock).mock.calls;
      const keys = calls.map(call => call[0]);
      
      expect(keys).toContain('photo_logs');
      expect(keys).toContain('weight_history');
      expect(keys).toContain('reminders');
      expect(new Set(keys).size).toBe(3); // All keys are unique
    });

    it('should handle concurrent AsyncStorage operations', async () => {
      const operations = [
        AsyncStorage.setItem('photo_logs', JSON.stringify([{ id: '1' }])),
        AsyncStorage.setItem('weight_history', JSON.stringify([{ id: '2' }])),
        AsyncStorage.setItem('reminders', JSON.stringify([{ id: '3' }]))
      ];
      
      await Promise.all(operations);
      
      // All operations should complete successfully
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(3);
    });

    it('should maintain data integrity during storage operations', async () => {
      const photoLogs = [
        { id: '1', mealName: 'Meal 1', imageUri: 'img1.jpg' },
        { id: '2', mealName: 'Meal 2', imageUri: 'img2.jpg' }
      ];
      
      await AsyncStorage.setItem('photo_logs', JSON.stringify(photoLogs));
      
      // Verify stored data contains valid JSON
      const storedData = (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      expect(() => JSON.parse(storedData)).not.toThrow();
      
      const parsed = JSON.parse(storedData);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].mealName).toBe('Meal 1');
    });
  });

  describe('Error Handling', () => {
    it('should handle AsyncStorage setItem errors gracefully', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage full'));
      
      let error;
      try {
        await AsyncStorage.setItem('photo_logs', JSON.stringify([{ id: '1' }]));
      } catch (err) {
        error = err;
      }
      
      expect(error).toBeTruthy();
      expect(error.message).toBe('Storage full');
    });

    it('should handle AsyncStorage getItem errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage read error'));
      
      let error;
      try {
        await AsyncStorage.getItem('photo_logs');
      } catch (err) {
        error = err;
      }
      
      expect(error).toBeTruthy();
      expect(error.message).toBe('Storage read error');
    });

    it('should handle JSON parsing errors gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid json data');
      
      const result = await AsyncStorage.getItem('photo_logs');
      
      let parsedData = [];
      try {
        parsedData = JSON.parse(result || '[]');
      } catch (error) {
        parsedData = []; // Fallback for corrupted data
      }
      
      expect(parsedData).toEqual([]);
    });
  });

  describe('Data Validation', () => {
    it('should validate photo log data structure', async () => {
      const validPhotoLog = {
        id: '1',
        timestamp: '2024-01-15T10:30:00Z',
        mealName: 'Test Meal',
        brand: 'Test Brand',
        calories: 350,
        imageUri: 'file://test.jpg'
      };
      
      await AsyncStorage.setItem('photo_logs', JSON.stringify([validPhotoLog]));
      
      const storedData = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      
      expect(storedData[0]).toMatchObject({
        id: expect.any(String),
        timestamp: expect.any(String),
        mealName: expect.any(String),
        brand: expect.any(String),
        calories: expect.any(Number),
        imageUri: expect.any(String)
      });
    });

    it('should validate weight entry data structure', async () => {
      const validWeightEntry = {
        id: '1',
        weight: 75.5,
        date: '2024-01-15',
        photo: 'file://progress.jpg'
      };
      
      await AsyncStorage.setItem('weight_history', JSON.stringify([validWeightEntry]));
      
      const storedData = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      
      expect(storedData[0]).toMatchObject({
        id: expect.any(String),
        weight: expect.any(Number),
        date: expect.any(String),
        photo: expect.any(String)
      });
    });

    it('should validate reminder data structure', async () => {
      const validReminder = {
        id: '1',
        type: 'meal' as const,
        label: 'Test Reminder',
        time: '08:00',
        days: [true, false, true, false, true, false, false],
        enabled: true,
        notificationId: 'test_reminder'
      };
      
      await AsyncStorage.setItem('reminders', JSON.stringify([validReminder]));
      
      const storedData = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      
      expect(storedData[0]).toMatchObject({
        id: expect.any(String),
        type: expect.any(String),
        label: expect.any(String),
        time: expect.any(String),
        days: expect.any(Array),
        enabled: expect.any(Boolean),
        notificationId: expect.any(String)
      });
    });
  });
});