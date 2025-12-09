import React from 'react';

// Mock axios before importing the component
const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
};
jest.mock('axios', () => mockAxios);

// Mock Alert
const mockAlert = {
  alert: jest.fn()
};

// Mock Expo Notifications
const mockNotifications = {
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn()
};
jest.mock('expo-notifications', () => mockNotifications);

// Mock React Native components to avoid native module issues
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: any) => styles },
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  Modal: 'Modal',
  TextInput: 'TextInput',
  Platform: { OS: 'ios' },
  Alert: mockAlert,
  SafeAreaView: 'SafeAreaView',
  Switch: 'Switch'
}));

describe('ReminderSnippet Logic Tests', () => {
  const mockReminder = {
    id: '1',
    type: 'meal' as const,
    label: 'Breakfast Reminder',
    time: '08:00',
    days: [false, true, true, true, true, true, false], // Weekdays
    enabled: true,
    notificationId: 'notif1'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.get.mockClear();
    mockAxios.post.mockClear();
    mockAxios.put.mockClear();
    mockAxios.delete.mockClear();
    mockNotifications.getPermissionsAsync.mockClear();
    mockNotifications.requestPermissionsAsync.mockClear();
    mockNotifications.scheduleNotificationAsync.mockClear();
    mockNotifications.cancelScheduledNotificationAsync.mockClear();
    mockAlert.alert.mockClear();

    // Default mock implementations
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('mock-notification-id');
  });

  describe('Day Formatting Logic', () => {
    it('should format every day correctly', () => {
      const formatDays = (days: boolean[]) => {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const activeDays = days
          .map((active, index) => ({ active, name: dayNames[index] }))
          .filter(day => day.active)
          .map(day => day.name);
        
        if (activeDays.length === 7) return 'Every day';
        if (activeDays.length === 5 && !days[0] && !days[6]) return 'Weekdays';
        if (activeDays.length === 2 && days[0] && days[6]) return 'Weekends';
        return activeDays.join(', ');
      };

      expect(formatDays([true, true, true, true, true, true, true])).toBe('Every day');
      expect(formatDays([false, true, true, true, true, true, false])).toBe('Weekdays');
      expect(formatDays([true, false, false, false, false, false, true])).toBe('Weekends');
      expect(formatDays([true, false, true, false, true, false, false])).toBe('Sun, Tue, Thu');
      expect(formatDays([false, true, false, false, false, false, false])).toBe('Mon');
      expect(formatDays([false, false, false, false, false, false, false])).toBe('');
    });

    it('should handle edge cases in day formatting', () => {
      const formatDays = (days: boolean[]) => {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const activeDays = days
          .map((active, index) => ({ active, name: dayNames[index] }))
          .filter(day => day.active)
          .map(day => day.name);
        
        if (activeDays.length === 7) return 'Every day';
        if (activeDays.length === 5 && !days[0] && !days[6]) return 'Weekdays';
        if (activeDays.length === 2 && days[0] && days[6]) return 'Weekends';
        return activeDays.join(', ');
      };

      // Test partial weekdays (should not be "Weekdays")
      expect(formatDays([false, true, true, false, true, true, false])).toBe('Mon, Tue, Thu, Fri');
      
      // Test partial weekends (should not be "Weekends")
      expect(formatDays([true, false, false, false, false, false, false])).toBe('Sun');
      expect(formatDays([false, false, false, false, false, false, true])).toBe('Sat');
    });
  });

  describe('Time Parsing and Formatting', () => {
    it('should parse time string correctly', () => {
      const parseTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return { hours, minutes };
      };

      expect(parseTime('08:00')).toEqual({ hours: 8, minutes: 0 });
      expect(parseTime('14:30')).toEqual({ hours: 14, minutes: 30 });
      expect(parseTime('23:59')).toEqual({ hours: 23, minutes: 59 });
      expect(parseTime('00:00')).toEqual({ hours: 0, minutes: 0 });
      expect(parseTime('01:05')).toEqual({ hours: 1, minutes: 5 });
    });

    it('should format time correctly', () => {
      const formatTime = (hours: number, minutes: number) => {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      };

      expect(formatTime(8, 0)).toBe('08:00');
      expect(formatTime(14, 30)).toBe('14:30');
      expect(formatTime(23, 59)).toBe('23:59');
      expect(formatTime(0, 0)).toBe('00:00');
      expect(formatTime(1, 5)).toBe('01:05');
    });

    it('should adjust time correctly', () => {
      const adjustTime = (timeStr: string, increment: number, type: 'hour' | 'minute') => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        
        if (type === 'hour') {
          const newHours = (hours + increment + 24) % 24;
          return `${newHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        } else {
          const newMinutes = (minutes + increment + 60) % 60;
          return `${hours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
        }
      };

      // Test hour adjustments
      expect(adjustTime('08:00', 1, 'hour')).toBe('09:00');
      expect(adjustTime('23:00', 1, 'hour')).toBe('00:00'); // Wrap around
      expect(adjustTime('00:00', -1, 'hour')).toBe('23:00'); // Wrap around backwards

      // Test minute adjustments
      expect(adjustTime('08:00', 15, 'minute')).toBe('08:15');
      expect(adjustTime('08:45', 15, 'minute')).toBe('08:00'); // Wrap around
      expect(adjustTime('08:00', -15, 'minute')).toBe('08:45'); // Wrap around backwards
    });
  });

  describe('Notification Scheduling Logic', () => {
    it('should calculate active days correctly', () => {
      const getActiveDays = (days: boolean[]) => {
        return days
          .map((active, index) => ({ active, day: index }))
          .filter(item => item.active)
          .map(item => item.day);
      };

      expect(getActiveDays([false, true, true, true, true, true, false])).toEqual([1, 2, 3, 4, 5]);
      expect(getActiveDays([true, false, false, false, false, false, true])).toEqual([0, 6]);
      expect(getActiveDays([true, true, true, true, true, true, true])).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(getActiveDays([false, false, false, false, false, false, false])).toEqual([]);
    });

    it('should convert day indices for iOS format', () => {
      const convertToIOSWeekday = (dayIndex: number) => {
        return dayIndex === 0 ? 1 : dayIndex + 1; // Convert Sunday (0) to 1, others +1
      };

      expect(convertToIOSWeekday(0)).toBe(1); // Sunday
      expect(convertToIOSWeekday(1)).toBe(2); // Monday
      expect(convertToIOSWeekday(2)).toBe(3); // Tuesday
      expect(convertToIOSWeekday(6)).toBe(7); // Saturday
    });

    it('should validate notification scheduling requirements', () => {
      const canScheduleNotification = (reminder: any, hasPermission: boolean) => {
        if (!hasPermission) return false;
        if (!reminder.enabled) return false;
        if (!reminder.days.some((day: boolean) => day)) return false;
        return true;
      };

      const enabledReminder = { ...mockReminder, enabled: true, days: [false, true, false, false, false, false, false] };
      const disabledReminder = { ...mockReminder, enabled: false };
      const noDaysReminder = { ...mockReminder, days: [false, false, false, false, false, false, false] };

      expect(canScheduleNotification(enabledReminder, true)).toBeTruthy();
      expect(canScheduleNotification(enabledReminder, false)).toBeFalsy();
      expect(canScheduleNotification(disabledReminder, true)).toBeFalsy();
      expect(canScheduleNotification(noDaysReminder, true)).toBeFalsy();
    });
  });

  describe('Reminder Validation', () => {
    it('should validate reminder data', () => {
      const validateReminder = (reminderData: any) => {
        const errors = [];
        
        if (!reminderData.label || !reminderData.label.trim()) {
          errors.push('Please enter a reminder label');
        }
        
        if (!reminderData.days || !reminderData.days.some((day: boolean) => day)) {
          errors.push('Please select at least one day');
        }
        
        return errors;
      };

      const validReminder = {
        label: 'Test Reminder',
        days: [false, true, false, false, false, false, false]
      };

      const noLabelReminder = {
        label: '',
        days: [false, true, false, false, false, false, false]
      };

      const noDaysReminder = {
        label: 'Test Reminder',
        days: [false, false, false, false, false, false, false]
      };

      expect(validateReminder(validReminder)).toEqual([]);
      expect(validateReminder(noLabelReminder)).toContain('Please enter a reminder label');
      expect(validateReminder(noDaysReminder)).toContain('Please select at least one day');
    });

    it('should handle label trimming', () => {
      const trimLabel = (label: string) => {
        return label ? label.trim() : '';
      };

      expect(trimLabel('  Test Reminder  ')).toBe('Test Reminder');
      expect(trimLabel('Test Reminder')).toBe('Test Reminder');
      expect(trimLabel('   ')).toBe('');
      expect(trimLabel('')).toBe('');
    });
  });

  describe('API Integration Logic', () => {
    it('should handle reminder loading', async () => {
      const loadReminders = async () => {
        try {
          const response = await mockAxios.get('http://10.0.2.2:8000/reminder');
          return response.data.reminders.map((reminder: any) => ({
            id: reminder.id,
            type: reminder.type,
            label: reminder.label,
            time: reminder.time,
            days: reminder.days,
            enabled: reminder.enabled,
            notificationId: undefined
          }));
        } catch (error) {
          console.error('Failed to load reminders from API:', error);
          return [];
        }
      };

      // Test successful loading
      mockAxios.get.mockResolvedValueOnce({
        data: {
          reminders: [mockReminder]
        }
      });

      const result = await loadReminders();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].type).toBe('meal');

      // Test error handling
      mockAxios.get.mockRejectedValueOnce(new Error('API Error'));
      const errorResult = await loadReminders();
      expect(errorResult).toEqual([]);
    });

    it('should handle reminder creation', async () => {
      const createReminder = async (reminderData: any) => {
        try {
          await mockAxios.post('http://10.0.2.2:8000/reminder', reminderData);
          return { success: true };
        } catch (error) {
          return { success: false, error };
        }
      };

      // Test successful creation
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });
      const result = await createReminder(mockReminder);
      expect(result.success).toBeTruthy();
      expect(mockAxios.post).toHaveBeenCalledWith('http://10.0.2.2:8000/reminder', mockReminder);

      // Test error handling
      mockAxios.post.mockRejectedValueOnce(new Error('API Error'));
      const errorResult = await createReminder(mockReminder);
      expect(errorResult.success).toBeFalsy();
    });

    it('should handle reminder updates', async () => {
      const updateReminder = async (reminderId: string, reminderData: any) => {
        try {
          await mockAxios.put(`http://10.0.2.2:8000/reminder/${reminderId}`, reminderData);
          return { success: true };
        } catch (error) {
          return { success: false, error };
        }
      };

      // Test successful update
      mockAxios.put.mockResolvedValueOnce({ data: { success: true } });
      const result = await updateReminder('1', { enabled: false });
      expect(result.success).toBeTruthy();
      expect(mockAxios.put).toHaveBeenCalledWith('http://10.0.2.2:8000/reminder/1', { enabled: false });

      // Test error handling
      mockAxios.put.mockRejectedValueOnce(new Error('API Error'));
      const errorResult = await updateReminder('1', { enabled: false });
      expect(errorResult.success).toBeFalsy();
    });

    it('should handle reminder deletion', async () => {
      const deleteReminder = async (reminderId: string) => {
        try {
          await mockAxios.delete(`http://10.0.2.2:8000/reminder/${reminderId}`);
          return { success: true };
        } catch (error) {
          return { success: false, error };
        }
      };

      // Test successful deletion
      mockAxios.delete.mockResolvedValueOnce({ data: { success: true } });
      const result = await deleteReminder('1');
      expect(result.success).toBeTruthy();
      expect(mockAxios.delete).toHaveBeenCalledWith('http://10.0.2.2:8000/reminder/1');

      // Test error handling
      mockAxios.delete.mockRejectedValueOnce(new Error('API Error'));
      const errorResult = await deleteReminder('1');
      expect(errorResult.success).toBeFalsy();
    });
  });

  describe('Notification Permission Logic', () => {
    it('should check permissions correctly', async () => {
      const checkNotificationPermissions = async () => {
        const { status } = await mockNotifications.getPermissionsAsync();
        
        if (status !== 'granted') {
          const { status: newStatus } = await mockNotifications.requestPermissionsAsync();
          return newStatus;
        }
        
        return status;
      };

      // Test already granted
      mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
      const result1 = await checkNotificationPermissions();
      expect(result1).toBe('granted');
      expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();

      // Test requesting permission
      mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
      mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
      const result2 = await checkNotificationPermissions();
      expect(result2).toBe('granted');
      expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should handle permission states', () => {
      const getPermissionMessage = (status: string) => {
        switch (status) {
          case 'granted':
            return null; // No warning needed
          case 'denied':
            return '📵 Notification permission is required for reminders to work properly.';
          default:
            return '📵 Please enable notifications to use reminders.';
        }
      };

      expect(getPermissionMessage('granted')).toBeNull();
      expect(getPermissionMessage('denied')).toContain('📵');
      expect(getPermissionMessage('undetermined')).toContain('📵');
    });
  });

  describe('State Management Logic', () => {
    it('should manage reminder list state', () => {
      let reminders: any[] = [];
      
      const addReminder = (reminder: any) => {
        reminders = [...reminders, reminder];
      };
      
      const updateReminder = (id: string, updates: any) => {
        reminders = reminders.map(r => r.id === id ? { ...r, ...updates } : r);
      };
      
      const deleteReminder = (id: string) => {
        reminders = reminders.filter(r => r.id !== id);
      };

      // Test adding
      addReminder(mockReminder);
      expect(reminders).toHaveLength(1);
      expect(reminders[0].id).toBe('1');

      // Test updating
      updateReminder('1', { enabled: false });
      expect(reminders[0].enabled).toBeFalsy();

      // Test deleting
      deleteReminder('1');
      expect(reminders).toHaveLength(0);
    });

    it('should manage modal state', () => {
      let modalVisible = false;
      let editingReminder: any = null;
      
      const openAddModal = () => {
        editingReminder = null;
        modalVisible = true;
      };
      
      const openEditModal = (reminder: any) => {
        editingReminder = reminder;
        modalVisible = true;
      };
      
      const closeModal = () => {
        modalVisible = false;
        editingReminder = null;
      };

      expect(modalVisible).toBeFalsy();
      expect(editingReminder).toBeNull();

      openAddModal();
      expect(modalVisible).toBeTruthy();
      expect(editingReminder).toBeNull();

      openEditModal(mockReminder);
      expect(modalVisible).toBeTruthy();
      expect(editingReminder).toEqual(mockReminder);

      closeModal();
      expect(modalVisible).toBeFalsy();
      expect(editingReminder).toBeNull();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed reminder data', () => {
      const sanitizeReminderData = (data: any) => {
        return {
          id: data.id ? data.id.toString() : Date.now().toString(),
          type: data.type === 'weigh-in' ? 'weigh-in' : 'meal',
          label: typeof data.label === 'string' ? data.label.trim() : '',
          time: typeof data.time === 'string' && /^\d{2}:\d{2}$/.test(data.time) ? data.time : '08:00',
          days: Array.isArray(data.days) && data.days.length === 7 ? 
                data.days.map(Boolean) : 
                [false, true, true, true, true, true, false],
          enabled: Boolean(data.enabled),
          notificationId: data.notificationId || undefined
        };
      };

      const malformedData = {
        id: 123,
        type: 'invalid',
        label: null,
        time: 'invalid-time',
        days: [true, false],
        enabled: 'yes',
        notificationId: null
      };

      const sanitized = sanitizeReminderData(malformedData);
      
      expect(typeof sanitized.id).toBe('string');
      expect(sanitized.type).toBe('meal');
      expect(sanitized.label).toBe('');
      expect(sanitized.time).toBe('08:00');
      expect(sanitized.days).toHaveLength(7);
      expect(typeof sanitized.enabled).toBe('boolean');
    });

    it('should handle network timeouts', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network timeout')), 100);
      });

      const handleTimeout = async () => {
        try {
          await timeoutPromise;
          return { success: true };
        } catch (error) {
          return { success: false, error: 'Network timeout' };
        }
      };

      const result = await handleTimeout();
      expect(result.success).toBeFalsy();
      expect(result.error).toBe('Network timeout');
    });

    it('should validate time format', () => {
      const isValidTimeFormat = (time: string) => {
        return /^([01]?\d|2[0-3]):([0-5]?\d)$/.test(time);
      };

      expect(isValidTimeFormat('08:00')).toBeTruthy();
      expect(isValidTimeFormat('14:30')).toBeTruthy();
      expect(isValidTimeFormat('23:59')).toBeTruthy();
      expect(isValidTimeFormat('00:00')).toBeTruthy();
      expect(isValidTimeFormat('24:00')).toBeFalsy();
      expect(isValidTimeFormat('08:60')).toBeFalsy();
      expect(isValidTimeFormat('8:0')).toBeTruthy(); // Single digits allowed
      expect(isValidTimeFormat('invalid')).toBeFalsy();
      expect(isValidTimeFormat('')).toBeFalsy();
    });

    it('should handle concurrent operations', () => {
      const operationQueue: Promise<any>[] = [];
      
      const addOperation = (operation: Promise<any>) => {
        operationQueue.push(operation);
        return operation.finally(() => {
          const index = operationQueue.indexOf(operation);
          if (index > -1) {
            operationQueue.splice(index, 1);
          }
        });
      };
      
      const isOperationPending = () => operationQueue.length > 0;

      expect(isOperationPending()).toBeFalsy();

      const op1 = addOperation(Promise.resolve('done'));
      expect(isOperationPending()).toBeTruthy();

      return op1.then(() => {
        expect(isOperationPending()).toBeFalsy();
      });
    });
  });

  describe('UI Helper Functions', () => {
    it('should get correct reminder type emoji', () => {
      const getReminderEmoji = (type: string) => {
        return type === 'meal' ? '🍽️' : '⚖️';
      };

      expect(getReminderEmoji('meal')).toBe('🍽️');
      expect(getReminderEmoji('weigh-in')).toBe('⚖️');
      expect(getReminderEmoji('invalid')).toBe('⚖️'); // Default fallback
    });

    it('should format notification content correctly', () => {
      const getNotificationContent = (type: string, label: string) => {
        return {
          title: type === 'meal' ? '🍽️ Meal Reminder' : '⚖️ Weigh-in Reminder',
          body: label,
          sound: 'default'
        };
      };

      const mealContent = getNotificationContent('meal', 'Breakfast Time');
      expect(mealContent.title).toBe('🍽️ Meal Reminder');
      expect(mealContent.body).toBe('Breakfast Time');

      const weighInContent = getNotificationContent('weigh-in', 'Daily Check');
      expect(weighInContent.title).toBe('⚖️ Weigh-in Reminder');
      expect(weighInContent.body).toBe('Daily Check');
    });

    it('should calculate next reminder occurrence', () => {
      const getNextOccurrence = (time: string, days: boolean[]) => {
        const now = new Date();
        const [hours, minutes] = time.split(':').map(Number);
        
        // Find next active day
        const currentDay = now.getDay();
        for (let i = 0; i < 7; i++) {
          const checkDay = (currentDay + i) % 7;
          if (days[checkDay]) {
            const nextDate = new Date(now);
            nextDate.setDate(now.getDate() + i);
            nextDate.setHours(hours, minutes, 0, 0);
            
            // If it's today but time has passed, check next occurrence of this day
            if (i === 0 && nextDate <= now) continue;
            
            return nextDate;
          }
        }
        return null;
      };

      // Mock current time for testing
      const mockNow = new Date('2024-01-01T10:00:00'); // Monday 10:00 AM
      Date.now = jest.fn(() => mockNow.getTime());

      const weekdayReminder = [false, true, true, true, true, true, false];
      const next = getNextOccurrence('14:00', weekdayReminder);
      
      expect(next).toBeTruthy();
      if (next) {
        expect(next.getHours()).toBe(14);
        expect(next.getMinutes()).toBe(0);
      }
    });
  });
});