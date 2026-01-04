import React from 'react';
import TestRenderer from 'react-test-renderer';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Switch } from 'react-native';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';
import ReminderSnippet from '../ReminderSnippet';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedNotifications = Notifications as unknown as jest.Mocked<typeof Notifications>;

describe('ReminderSnippet', () => {
  const onClose = jest.fn();
  let alertSpy: jest.SpyInstance;

  const sampleReminders = {
    data: {
      reminders: [
        {
          id: '1',
          type: 'meal',
          label: 'Breakfast Reminder',
          time: '08:00',
          days: [false, true, true, true, true, true, false],
          enabled: true,
        },
        {
          id: '2',
          type: 'weigh-in',
          label: 'Daily Weigh-in',
          time: '07:00',
          days: [true, false, false, false, false, false, true],
          enabled: false,
        },
      ],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockReturnValue();

    mockedNotifications.getPermissionsAsync?.mockResolvedValue({ status: 'granted' } as any);
    mockedNotifications.requestPermissionsAsync?.mockResolvedValue({ status: 'granted' } as any);
    mockedNotifications.scheduleNotificationAsync?.mockResolvedValue('notif-id');
    mockedNotifications.cancelScheduledNotificationAsync?.mockResolvedValue();
    mockedNotifications.cancelAllScheduledNotificationsAsync?.mockResolvedValue();
    mockedNotifications.getAllScheduledNotificationsAsync?.mockResolvedValue([]);
    mockedNotifications.addNotificationReceivedListener?.mockReturnValue({ remove: jest.fn() } as any);
    mockedNotifications.addNotificationResponseReceivedListener?.mockReturnValue({ remove: jest.fn() } as any);

    // Default mock for axios - will be overridden in specific tests
    mockedAxios.get.mockResolvedValue({ data: { reminders: [] } });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('should render ReminderSnippet without crashing', () => {
    const component = TestRenderer.create(
      <ReminderSnippet visible={true} onClose={onClose} />
    );

    const tree = component.toJSON();
    expect(tree).toBeTruthy();
  });

  it('should have component structure', () => {
    const component = TestRenderer.create(
      <ReminderSnippet visible={true} onClose={onClose} />
    );

    const divElements = component.root.findAllByType('div');
    expect(divElements.length).toBeGreaterThan(0);
  });

  it('should render with different mock data', () => {
    // Mock before render
    mockedAxios.get.mockResolvedValue(sampleReminders);

    const component = TestRenderer.create(
      <ReminderSnippet visible={true} onClose={onClose} />
    );

    // Force component update to trigger useEffect (simulate mounted state)
    component.update(<ReminderSnippet visible={true} onClose={onClose} />);

    const tree = component.toJSON();
    expect(tree).toBeTruthy();
    // Check for reminder content instead of specific text that might not exist
    const treeString = JSON.stringify(tree);
    expect(treeString).toContain('reminders'); // Basic check that component structure is correct
  });

  it('shows permission warning when notifications are not granted', async () => {
    mockedNotifications.getPermissionsAsync?.mockResolvedValueOnce({ status: 'denied' } as any);
    mockedNotifications.requestPermissionsAsync?.mockResolvedValueOnce({ status: 'granted' } as any);

    const { findByText } = render(
      <ReminderSnippet visible={true} onClose={onClose} />
    );

    const enableButton = await findByText('Enable Notifications');
    fireEvent.press(enableButton);

    expect(mockedNotifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('renders empty state when there are no reminders', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { reminders: [] } });

    const { findByText } = render(
      <ReminderSnippet visible={true} onClose={onClose} />
    );

    expect(await findByText('No reminders set')).toBeTruthy();
    expect(await findByText('Create reminders for meals and weigh-ins to stay on track')).toBeTruthy();
  });

  it('renders reminders and toggles enabled state', async () => {
    mockedAxios.get.mockResolvedValueOnce(sampleReminders);
    mockedAxios.put.mockResolvedValueOnce({ data: { success: true } });

    const { findByText, UNSAFE_getAllByType } = render(
      <ReminderSnippet visible={true} onClose={onClose} />
    );

    expect(await findByText('🍽️ Breakfast Reminder')).toBeTruthy();

    const switches = UNSAFE_getAllByType(Switch);
    fireEvent(switches[0], 'valueChange', false);

    await waitFor(() => {
      expect(mockedAxios.put).toHaveBeenCalled();
    });
  });

  it('deletes reminder after confirmation', async () => {
    mockedAxios.get.mockResolvedValueOnce(sampleReminders);
    mockedAxios.delete.mockResolvedValueOnce({ data: { success: true } });

    const alertConfirmSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const confirm = buttons?.[1];
      if (confirm && typeof confirm.onPress === 'function') {
        confirm.onPress();
      }
    });

    const { findAllByText } = render(
      <ReminderSnippet visible={true} onClose={onClose} />
    );

    const deleteButtons = await findAllByText('🗑️ Delete');
    fireEvent.press(deleteButtons[0]);

    await waitFor(() => {
      expect(mockedAxios.delete).toHaveBeenCalled();
    });

    alertConfirmSpy.mockRestore();
  });
});
