import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { NotificationService, notificationService } from '../NotificationService';
import { SmartDietContext } from '../SmartDietService';

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;

describe('NotificationService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('returns false when permissions are denied', async () => {
    mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' } as any);
    const result = await notificationService.initialize();

    expect(result).toBe(false);
    expect(mockNotifications.setNotificationHandler).not.toHaveBeenCalled();
  });

  it('initializes notifications and schedules daily reminders', async () => {
    mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as any);
    await AsyncStorage.setItem('smart_diet_notification_config', JSON.stringify({
      enabled: true,
      dailySuggestionTime: '07:30',
      reminderInterval: 24,
      preferredContexts: [SmartDietContext.TODAY],
    }));

    const result = await notificationService.initialize();

    expect(result).toBe(true);
    expect(mockNotifications.setNotificationHandler).toHaveBeenCalled();
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'smart-diet-daily',
      })
    );
  });

  it('updates config and reschedules notifications', async () => {
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValueOnce([]);
    await notificationService.updateConfig({ enabled: true, dailySuggestionTime: '08:00' });

    expect(mockNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('triggers context notifications', async () => {
    await notificationService.triggerSmartDietNotification(SmartDietContext.INSIGHTS);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: expect.objectContaining({ context: SmartDietContext.INSIGHTS }),
        }),
      })
    );
  });

  it('cancels smart diet notifications', async () => {
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: 'smart-diet-daily', content: { data: { type: 'smart_diet_daily' } } } as any,
      { identifier: 'other', content: { data: { type: 'misc' } } } as any,
    ]);

    await notificationService.cancelAllNotifications();

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('smart-diet-daily');
  });

  it('stores and retrieves navigation intent', async () => {
    await (notificationService as any).storeNavigationIntent({
      type: 'smart_diet_daily',
      context: SmartDietContext.OPTIMIZE,
    });

    const intent = await notificationService.getPendingNavigationIntent();

    expect(intent?.context).toBe(SmartDietContext.OPTIMIZE);
    const stored = await AsyncStorage.getItem('pending_navigation_intent');
    expect(stored).toBeNull();
  });

  it('returns stats with fallback on error', async () => {
    mockNotifications.getAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error('fail'));
    const stats = await notificationService.getNotificationStats();

    expect(stats.scheduledCount).toBe(0);
    expect(stats.config).toBeDefined();
  });

  it('supports new instance in tests', async () => {
    (NotificationService as any).instance = undefined;
    const instance = NotificationService.getInstance();
    expect(instance).toBeDefined();
    (NotificationService as any).instance = notificationService;
  });
});
