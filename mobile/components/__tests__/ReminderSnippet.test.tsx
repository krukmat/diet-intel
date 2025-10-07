import React from 'react';
import TestRenderer from 'react-test-renderer';
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
    mockedAxios.get.mockResolvedValue(sampleReminders);

    const component = TestRenderer.create(
      <ReminderSnippet visible={true} onClose={onClose} />
    );

    const tree = component.toJSON();
    expect(tree).toBeTruthy();
    expect(JSON.stringify(tree)).toContain('Breakfast Reminder');
  });
});
