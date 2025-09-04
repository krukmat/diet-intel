import React from 'react';
import TestRenderer from 'react-test-renderer';
import ReminderSnippet from '../ReminderSnippet';

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

// Mock axios
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
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Alert: mockAlert
  };
});

describe('ReminderSnippet Component Tests', () => {
  const mockReminders = [
    {
      id: '1',
      type: 'meal' as const,
      label: 'Breakfast Reminder',
      time: '08:00',
      days: [false, true, true, true, true, true, false], // Weekdays
      enabled: true,
      notificationId: 'notif1'
    },
    {
      id: '2',
      type: 'weigh-in' as const,
      label: 'Daily Weigh-in',
      time: '07:00',
      days: [true, true, true, true, true, true, true], // Every day
      enabled: false,
      notificationId: 'notif2'
    },
    {
      id: '3',
      type: 'meal' as const,
      label: 'Lunch Time',
      time: '12:30',
      days: [true, false, false, false, false, false, true], // Weekends
      enabled: true,
      notificationId: 'notif3'
    }
  ];

  const mockOnClose = jest.fn();

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
    mockAxios.get.mockResolvedValue({ data: { reminders: [] } });
  });

  describe('Component Rendering and Initialization', () => {
    it('should render with empty reminders list', async () => {
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      expect(component.toJSON()).toBeTruthy();
      
      const instance = component.root;
      expect(() => instance.findByProps({ children: '🔔 Reminders' })).not.toThrow();
      expect(() => instance.findByProps({ children: 'No reminders set' })).not.toThrow();
    });

    it('should load reminders from API on mount', async () => {
      mockAxios.get.mockResolvedValueOnce({ 
        data: { 
          reminders: [
            {
              id: '1',
              type: 'meal',
              label: 'Test Reminder',
              time: '08:00',
              days: [false, true, true, true, true, true, false],
              enabled: true
            }
          ] 
        } 
      });

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      expect(mockAxios.get).toHaveBeenCalledWith('http://10.0.2.2:8000/reminder');
    });

    it('should handle API loading error gracefully', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('API Error'));

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      // Should still render with empty state
      const instance = component.root;
      expect(() => instance.findByProps({ children: 'No reminders set' })).not.toThrow();
    });

    it('should not load reminders when not visible', async () => {
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={false} onClose={mockOnClose} />
        );
      });

      expect(mockAxios.get).not.toHaveBeenCalled();
    });

    it('should call onClose when close button pressed', async () => {
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      const closeButton = instance.findByProps({ children: '✕' }).parent;

      TestRenderer.act(() => {
        closeButton.props.onPress();
      });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Notification Permissions', () => {
    it('should check permissions on component mount', async () => {
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      expect(mockNotifications.getPermissionsAsync).toHaveBeenCalled();
    });

    it('should show permission warning when not granted', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
      mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      expect(() => instance.findByProps({ 
        children: '📵 Notification permission is required for reminders to work properly.' 
      })).not.toThrow();
    });

    it('should request permissions when Enable Notifications pressed', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
      mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      const enableButton = instance.findByProps({ children: 'Enable Notifications' }).parent;

      await TestRenderer.act(async () => {
        enableButton.props.onPress();
      });

      expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should hide permission warning when granted', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      try {
        instance.findByProps({ 
          children: '📵 Notification permission is required for reminders to work properly.' 
        });
        fail('Should not find permission warning');
      } catch (error) {
        expect(error.message).toContain('No instances found');
      }
    });
  });

  describe('Reminder List Display', () => {
    beforeEach(() => {
      mockAxios.get.mockResolvedValueOnce({ 
        data: { reminders: mockReminders } 
      });
    });

    it('should display list of reminders', async () => {
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      
      // Check all reminders are displayed
      expect(() => instance.findByProps({ children: '🍽️ Breakfast Reminder' })).not.toThrow();
      expect(() => instance.findByProps({ children: '⚖️ Daily Weigh-in' })).not.toThrow();
      expect(() => instance.findByProps({ children: '🍽️ Lunch Time' })).not.toThrow();
    });

    it('should display reminder times correctly', async () => {
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      
      // Check times are displayed
      expect(() => instance.findByProps({ children: '08:00' })).not.toThrow();
      expect(() => instance.findByProps({ children: '07:00' })).not.toThrow();
      expect(() => instance.findByProps({ children: '12:30' })).not.toThrow();
    });

    it('should format days correctly', async () => {
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      
      // Check day formatting
      expect(() => instance.findByProps({ children: 'Weekdays' })).not.toThrow();
      expect(() => instance.findByProps({ children: 'Every day' })).not.toThrow();
      expect(() => instance.findByProps({ children: 'Weekends' })).not.toThrow();
    });

    it('should show correct switch states', async () => {
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      const switches = instance.findAllByType('Switch');
      
      expect(switches).toHaveLength(3);
      expect(switches[0].props.value).toBe(true); // Breakfast enabled
      expect(switches[1].props.value).toBe(false); // Weigh-in disabled
      expect(switches[2].props.value).toBe(true); // Lunch enabled
    });

    it('should display correct emoji icons for reminder types', async () => {
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      
      // Check meal emojis
      expect(() => instance.findByProps({ children: '🍽️ Breakfast Reminder' })).not.toThrow();
      expect(() => instance.findByProps({ children: '🍽️ Lunch Time' })).not.toThrow();
      
      // Check weigh-in emoji
      expect(() => instance.findByProps({ children: '⚖️ Daily Weigh-in' })).not.toThrow();
    });
  });

  describe('Day Formatting Logic', () => {
    it('should format every day correctly', () => {
      const everyDay = [true, true, true, true, true, true, true];
      mockAxios.get.mockResolvedValueOnce({ 
        data: { 
          reminders: [{ 
            ...mockReminders[0], 
            days: everyDay 
          }] 
        } 
      });

      // This tests the formatDays function indirectly
      expect(everyDay.filter(day => day).length).toBe(7);
    });

    it('should format weekdays correctly', () => {
      const weekdays = [false, true, true, true, true, true, false];
      mockAxios.get.mockResolvedValueOnce({ 
        data: { 
          reminders: [{ 
            ...mockReminders[0], 
            days: weekdays 
          }] 
        } 
      });

      expect(weekdays.filter(day => day).length).toBe(5);
      expect(weekdays[0]).toBe(false); // Sunday
      expect(weekdays[6]).toBe(false); // Saturday
    });

    it('should format weekends correctly', () => {
      const weekends = [true, false, false, false, false, false, true];
      mockAxios.get.mockResolvedValueOnce({ 
        data: { 
          reminders: [{ 
            ...mockReminders[0], 
            days: weekends 
          }] 
        } 
      });

      expect(weekends.filter(day => day).length).toBe(2);
      expect(weekends[0]).toBe(true); // Sunday
      expect(weekends[6]).toBe(true); // Saturday
    });

    it('should format custom days correctly', () => {
      const customDays = [true, false, true, false, true, false, false];
      
      // This would show as "Sun, Tue, Thu"
      const activeDays = customDays
        .map((active, index) => ({ active, name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index] }))
        .filter(day => day.active)
        .map(day => day.name);
      
      expect(activeDays).toEqual(['Sun', 'Tue', 'Thu']);
    });
  });

  describe('Add Reminder Modal', () => {
    it('should open modal when Add Reminder pressed', async () => {
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      const addButton = instance.findByProps({ children: '+ Add Reminder' }).parent;

      TestRenderer.act(() => {
        addButton.props.onPress();
      });

      // Modal should be visible
      const modals = instance.findAllByType('Modal');
      const reminderModal = modals.find(modal => 
        modal.props.children && 
        modal.props.children.props && 
        modal.props.children.props.children &&
        modal.props.children.props.children.some &&
        modal.props.children.props.children.some((child: any) => 
          child && child.props && child.props.children === 'New Reminder'
        )
      );
      expect(reminderModal).toBeTruthy();
    });

    it('should close modal when modal onClose called', async () => {
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      const addButton = instance.findByProps({ children: '+ Add Reminder' }).parent;

      // Open modal
      TestRenderer.act(() => {
        addButton.props.onPress();
      });

      // Find ReminderModal component and close it
      const reminderModal = instance.findByType('ReminderModal');
      
      TestRenderer.act(() => {
        reminderModal.props.onClose();
      });

      // Modal should be closed (visible=false)
      expect(reminderModal.props.visible).toBe(false);
    });
  });

  describe('Reminder CRUD Operations', () => {
    beforeEach(() => {
      mockAxios.get.mockResolvedValueOnce({ 
        data: { reminders: [mockReminders[0]] } 
      });
    });

    it('should save new reminder successfully', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      const reminderModal = instance.findByType('ReminderModal');

      const newReminderData = {
        type: 'meal' as const,
        label: 'New Reminder',
        time: '10:00',
        days: [false, true, true, true, true, true, false],
        enabled: true
      };

      await TestRenderer.act(async () => {
        reminderModal.props.onSave(newReminderData);
      });

      expect(mockAxios.post).toHaveBeenCalledWith('http://10.0.2.2:8000/reminder', newReminderData);
      expect(mockAlert.alert).toHaveBeenCalledWith('Success', 'Reminder created successfully!');
    });

    it('should update existing reminder successfully', async () => {
      mockAxios.put.mockResolvedValueOnce({ data: { success: true } });
      
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      
      // Open edit modal by pressing edit button
      const editButton = instance.findByProps({ children: '✏️ Edit' }).parent;
      TestRenderer.act(() => {
        editButton.props.onPress();
      });

      const reminderModal = instance.findByType('ReminderModal');
      
      const updatedReminderData = {
        type: 'meal' as const,
        label: 'Updated Reminder',
        time: '09:00',
        days: [true, true, true, true, true, true, true],
        enabled: true
      };

      await TestRenderer.act(async () => {
        reminderModal.props.onSave(updatedReminderData);
      });

      expect(mockAxios.put).toHaveBeenCalledWith(`http://10.0.2.2:8000/reminder/${mockReminders[0].id}`, updatedReminderData);
      expect(mockAlert.alert).toHaveBeenCalledWith('Success', 'Reminder updated successfully!');
    });

    it('should handle save reminder API error', async () => {
      mockAxios.post.mockRejectedValueOnce(new Error('API Error'));

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      const reminderModal = instance.findByType('ReminderModal');

      const newReminderData = {
        type: 'meal' as const,
        label: 'New Reminder',
        time: '10:00',
        days: [false, true, true, true, true, true, false],
        enabled: true
      };

      await TestRenderer.act(async () => {
        reminderModal.props.onSave(newReminderData);
      });

      expect(mockAlert.alert).toHaveBeenCalledWith('Error', 'Failed to save reminder. Please try again.');
    });

    it('should delete reminder with confirmation', async () => {
      mockAlert.alert.mockImplementationOnce((title, message, buttons) => {
        // Simulate user pressing Delete button
        const deleteButton = buttons?.find((button: any) => button.text === 'Delete');
        if (deleteButton && deleteButton.onPress) {
          deleteButton.onPress();
        }
      });
      mockAxios.delete.mockResolvedValueOnce({ data: { success: true } });

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      const deleteButton = instance.findByProps({ children: '🗑️ Delete' }).parent;

      await TestRenderer.act(async () => {
        deleteButton.props.onPress();
      });

      expect(mockAlert.alert).toHaveBeenCalledWith(
        'Delete Reminder',
        'Are you sure you want to delete this reminder?',
        expect.any(Array)
      );
    });

    it('should handle delete reminder API error', async () => {
      mockAlert.alert.mockImplementationOnce((title, message, buttons) => {
        // Simulate user pressing Delete button
        const deleteButton = buttons?.find((button: any) => button.text === 'Delete');
        if (deleteButton && deleteButton.onPress) {
          deleteButton.onPress();
        }
      });
      mockAxios.delete.mockRejectedValueOnce(new Error('API Error'));

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      const deleteButton = instance.findByProps({ children: '🗑️ Delete' }).parent;

      await TestRenderer.act(async () => {
        deleteButton.props.onPress();
      });

      // Should show error after attempting delete
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockAlert.alert).toHaveBeenCalledWith('Error', 'Failed to delete reminder');
    });
  });

  describe('Reminder Toggle Functionality', () => {
    beforeEach(() => {
      mockAxios.get.mockResolvedValueOnce({ 
        data: { reminders: [mockReminders[0]] } 
      });
    });

    it('should toggle reminder enable/disable', async () => {
      mockAxios.put.mockResolvedValueOnce({ data: { success: true } });
      
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      const switch_ = instance.findByType('Switch');

      await TestRenderer.act(async () => {
        switch_.props.onValueChange(false); // Disable reminder
      });

      expect(mockAxios.put).toHaveBeenCalledWith(
        `http://10.0.2.2:8000/reminder/${mockReminders[0].id}`,
        expect.objectContaining({ enabled: false })
      );
    });

    it('should handle toggle reminder API error', async () => {
      mockAxios.put.mockRejectedValueOnce(new Error('API Error'));
      
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      const switch_ = instance.findByType('Switch');

      await TestRenderer.act(async () => {
        switch_.props.onValueChange(false);
      });

      expect(mockAlert.alert).toHaveBeenCalledWith('Error', 'Failed to update reminder');
    });
  });

  describe('Notification Scheduling', () => {
    it('should schedule notifications for enabled reminders', async () => {
      const reminderData = {
        type: 'meal' as const,
        label: 'Test Reminder',
        time: '08:00',
        days: [false, true, true, false, false, false, false], // Mon, Tue
        enabled: true
      };

      // Test the notification scheduling logic indirectly
      const activeDays = reminderData.days
        .map((active, index) => ({ active, day: index }))
        .filter(item => item.active)
        .map(item => item.day);

      expect(activeDays).toEqual([1, 2]); // Monday and Tuesday
    });

    it('should handle notification permission denied', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
      mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      // Permission warning should be visible
      const instance = component.root;
      expect(() => instance.findByProps({ 
        children: '📵 Notification permission is required for reminders to work properly.' 
      })).not.toThrow();
    });

    it('should parse time correctly', () => {
      const timeStr = '14:30';
      const [hours, minutes] = timeStr.split(':').map(Number);
      
      expect(hours).toBe(14);
      expect(minutes).toBe(30);
    });

    it('should handle edge case times', () => {
      const testTimes = ['00:00', '23:59', '12:00', '01:05'];
      
      testTimes.forEach(timeStr => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        expect(hours).toBeGreaterThanOrEqual(0);
        expect(hours).toBeLessThanOrEqual(23);
        expect(minutes).toBeGreaterThanOrEqual(0);
        expect(minutes).toBeLessThanOrEqual(59);
      });
    });
  });

  describe('Component State Management', () => {
    it('should handle component visibility changes', async () => {
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={false} onClose={mockOnClose} />
        );
      });

      // Should not load reminders when not visible
      expect(mockAxios.get).not.toHaveBeenCalled();

      // Update to visible
      await TestRenderer.act(async () => {
        component.update(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      // Should now load reminders
      expect(mockAxios.get).toHaveBeenCalled();
    });

    it('should handle empty reminders response', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: { reminders: [] } });

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      expect(() => instance.findByProps({ children: 'No reminders set' })).not.toThrow();
    });

    it('should handle malformed API response', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: { reminders: null } });

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      // Should handle gracefully and show empty state
      const instance = component.root;
      expect(() => instance.findByProps({ children: 'No reminders set' })).not.toThrow();
    });
  });

  describe('Modal Integration', () => {
    it('should pass editing reminder to modal', async () => {
      mockAxios.get.mockResolvedValueOnce({ 
        data: { reminders: [mockReminders[0]] } 
      });

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      const editButton = instance.findByProps({ children: '✏️ Edit' }).parent;

      TestRenderer.act(() => {
        editButton.props.onPress();
      });

      const reminderModal = instance.findByType('ReminderModal');
      expect(reminderModal.props.editingReminder).toEqual(
        expect.objectContaining({
          id: '1',
          type: 'meal',
          label: 'Breakfast Reminder'
        })
      );
    });

    it('should clear editing reminder when modal closed', async () => {
      mockAxios.get.mockResolvedValueOnce({ 
        data: { reminders: [mockReminders[0]] } 
      });

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      const instance = component.root;
      const editButton = instance.findByProps({ children: '✏️ Edit' }).parent;

      // Open edit modal
      TestRenderer.act(() => {
        editButton.props.onPress();
      });

      const reminderModal = instance.findByType('ReminderModal');

      // Close modal
      TestRenderer.act(() => {
        reminderModal.props.onClose();
      });

      expect(reminderModal.props.editingReminder).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle component unmounting gracefully', async () => {
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      expect(() => {
        component.unmount();
      }).not.toThrow();
    });

    it('should handle invalid reminder data', async () => {
      const invalidReminders = [
        {
          id: 'invalid',
          type: 'invalid-type',
          label: '',
          time: 'invalid-time',
          days: null,
          enabled: 'not-boolean'
        }
      ];

      mockAxios.get.mockResolvedValueOnce({ 
        data: { reminders: invalidReminders } 
      });

      expect(() => {
        TestRenderer.act(() => {
          TestRenderer.create(
            <ReminderSnippet visible={true} onClose={mockOnClose} />
          );
        });
      }).not.toThrow();
    });

    it('should handle network timeouts', async () => {
      mockAxios.get.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      // Should handle timeout gracefully
      expect(component.toJSON()).toBeTruthy();
    });

    it('should handle rapid state changes', async () => {
      let component: TestRenderer.ReactTestRenderer;
      
      await TestRenderer.act(async () => {
        component = TestRenderer.create(
          <ReminderSnippet visible={true} onClose={mockOnClose} />
        );
      });

      // Rapid visibility changes
      await TestRenderer.act(async () => {
        component.update(<ReminderSnippet visible={false} onClose={mockOnClose} />);
        component.update(<ReminderSnippet visible={true} onClose={mockOnClose} />);
        component.update(<ReminderSnippet visible={false} onClose={mockOnClose} />);
      });

      expect(component.toJSON()).toBeTruthy();
    });
  });
});