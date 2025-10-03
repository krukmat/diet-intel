import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';
import ReminderSnippet from '../ReminderSnippet';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

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

    mockedAxios.get.mockResolvedValue({ data: { reminders: [] } });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('renders empty state when no reminders are available', async () => {
    const { getByText } = render(
      <ReminderSnippet visible={true} onClose={onClose} />
    );

    await waitFor(() => {
      expect(getByText('No reminders set')).toBeTruthy();
    });
  });

  it('renders reminders returned by the API', async () => {
    mockedAxios.get.mockResolvedValue(sampleReminders);

    const { getByText } = render(
      <ReminderSnippet visible={true} onClose={onClose} />
    );

    await waitFor(() => {
      expect(getByText('Breakfast Reminder')).toBeTruthy();
      expect(getByText('08:00')).toBeTruthy();
      expect(getByText('Daily Weigh-in')).toBeTruthy();
    });
  });

  it('shows notification permission warning when permission is denied', async () => {
    mockedNotifications.getPermissionsAsync?.mockResolvedValue({ status: 'denied' } as any);

    const { getByText } = render(
      <ReminderSnippet visible={true} onClose={onClose} />
    );

    await waitFor(() => {
      expect(
        getByText(/Notification permission is required/)
      ).toBeTruthy();
    });

    fireEvent.press(getByText('Enable Notifications'));

    expect(mockedNotifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('opens creation modal when tapping Add Reminder', async () => {
    mockedAxios.get.mockResolvedValue(sampleReminders);

    const { getByText } = render(
      <ReminderSnippet visible={true} onClose={onClose} />
    );

    await waitFor(() => {
      expect(getByText('Breakfast Reminder')).toBeTruthy();
    });

    fireEvent.press(getByText('+ Add Reminder'));

    expect(getByText('New Reminder')).toBeTruthy();
  });

  it('shows confirmation alert when deleting a reminder', async () => {
    mockedAxios.get.mockResolvedValue(sampleReminders);

    const { getByText } = render(
      <ReminderSnippet visible={true} onClose={onClose} />
    );

    await waitFor(() => {
      expect(getByText('Breakfast Reminder')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText('🗑️ Delete'));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Reminder',
      'Are you sure you want to delete this reminder?',
      expect.any(Array),
    );
  });
});
