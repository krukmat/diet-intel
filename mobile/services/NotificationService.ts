/**
 * Notification Service for Smart Diet Daily Suggestions
 * Handles scheduling and managing notifications for Smart Diet recommendations
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { smartDietService, SmartDietContext } from './SmartDietService';

export interface NotificationConfig {
  enabled: boolean;
  dailySuggestionTime: string; // Format: "HH:MM"
  reminderInterval: number; // Hours
  preferredContexts: SmartDietContext[];
}

export class NotificationService {
  private static instance: NotificationService;
  private readonly STORAGE_KEY = 'smart_diet_notification_config';
  private readonly NOTIFICATION_IDENTIFIER = 'smart-diet-daily';

  private defaultConfig: NotificationConfig = {
    enabled: true,
    dailySuggestionTime: "09:00",
    reminderInterval: 24, // Daily
    preferredContexts: [SmartDietContext.TODAY, SmartDietContext.INSIGHTS]
  };

  private constructor() {
    this.setupNotificationHandling();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize notification system
   */
  async initialize(): Promise<boolean> {
    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
        return false;
      }

      // Configure notification behavior
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      // Load and apply saved configuration
      const config = await this.getConfig();
      if (config.enabled) {
        await this.scheduleDailyNotifications(config);
      }

      console.log('📱 Smart Diet notifications initialized');
      return true;

    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  }

  /**
   * Get current notification configuration
   */
  async getConfig(): Promise<NotificationConfig> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return { ...this.defaultConfig, ...JSON.parse(stored) };
      }
      return this.defaultConfig;
    } catch (error) {
      console.error('Failed to load notification config:', error);
      return this.defaultConfig;
    }
  }

  /**
   * Update notification configuration
   */
  async updateConfig(config: Partial<NotificationConfig>): Promise<void> {
    try {
      const currentConfig = await this.getConfig();
      const newConfig = { ...currentConfig, ...config };
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(newConfig));
      
      // Cancel existing and reschedule if enabled
      await this.cancelAllNotifications();
      if (newConfig.enabled) {
        await this.scheduleDailyNotifications(newConfig);
      }

      console.log('📱 Notification config updated:', newConfig);
    } catch (error) {
      console.error('Failed to update notification config:', error);
    }
  }

  /**
   * Schedule daily Smart Diet suggestion notifications
   */
  async scheduleDailyNotifications(config: NotificationConfig): Promise<void> {
    try {
      const [hours, minutes] = config.dailySuggestionTime.split(':').map(Number);
      
      // Schedule daily notification
      await Notifications.scheduleNotificationAsync({
        identifier: this.NOTIFICATION_IDENTIFIER,
        content: {
          title: '🌟 Your Smart Diet Suggestions Are Ready!',
          body: 'Discover personalized nutrition recommendations for today',
          data: {
            type: 'smart_diet_daily',
            context: SmartDietContext.TODAY,
            timestamp: Date.now()
          },
        },
        trigger: {
          hour: hours,
          minute: minutes,
          repeats: true,
        },
      });

      console.log(`📱 Daily Smart Diet notifications scheduled for ${config.dailySuggestionTime}`);
    } catch (error) {
      console.error('Failed to schedule daily notifications:', error);
    }
  }

  /**
   * Trigger immediate notification with Smart Diet preview
   */
  async triggerSmartDietNotification(
    context: SmartDietContext, 
    previewData?: { title?: string; message?: string }
  ): Promise<void> {
    try {
      const contextEmojis = {
        [SmartDietContext.TODAY]: '🌟',
        [SmartDietContext.OPTIMIZE]: '⚡',
        [SmartDietContext.DISCOVER]: '🔍',
        [SmartDietContext.INSIGHTS]: '📊'
      };

      const contextNames = {
        [SmartDietContext.TODAY]: 'Today',
        [SmartDietContext.OPTIMIZE]: 'Optimize',
        [SmartDietContext.DISCOVER]: 'Discover',
        [SmartDietContext.INSIGHTS]: 'Insights'
      };

      const emoji = contextEmojis[context];
      const name = contextNames[context];
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: previewData?.title || `${emoji} Smart Diet ${name}`,
          body: previewData?.message || `New ${name.toLowerCase()} suggestions available in Smart Diet`,
          data: {
            type: 'smart_diet_context',
            context,
            timestamp: Date.now()
          },
        },
        trigger: null, // Immediate
      });

      console.log(`📱 Smart Diet ${context} notification triggered`);
    } catch (error) {
      console.error('Failed to trigger Smart Diet notification:', error);
    }
  }

  /**
   * Cancel all Smart Diet notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const smartDietNotifications = scheduled.filter(
        notif => notif.identifier.includes('smart-diet') || 
                notif.content.data?.type?.includes('smart_diet')
      );

      for (const notification of smartDietNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }

      console.log(`📱 Cancelled ${smartDietNotifications.length} Smart Diet notifications`);
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }

  /**
   * Setup notification handling for Smart Diet actions
   */
  private setupNotificationHandling(): void {
    // Handle notification taps
    Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (data?.type?.includes('smart_diet')) {
        console.log('📱 Smart Diet notification tapped:', data);
        
        // Store navigation intent for app to handle
        this.storeNavigationIntent(data);
      }
    });

    // Handle notifications while app is in foreground
    Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data;
      
      if (data?.type?.includes('smart_diet')) {
        console.log('📱 Smart Diet notification received in foreground:', data);
      }
    });
  }

  /**
   * Store navigation intent for app to handle when opened
   */
  private async storeNavigationIntent(data: any): Promise<void> {
    try {
      const intent = {
        type: 'smart_diet_navigation',
        context: data.context || SmartDietContext.TODAY,
        timestamp: Date.now()
      };

      await AsyncStorage.setItem('pending_navigation_intent', JSON.stringify(intent));
      console.log('📱 Navigation intent stored:', intent);
    } catch (error) {
      console.error('Failed to store navigation intent:', error);
    }
  }

  /**
   * Get and clear pending navigation intent
   */
  async getPendingNavigationIntent(): Promise<any | null> {
    try {
      const stored = await AsyncStorage.getItem('pending_navigation_intent');
      if (stored) {
        await AsyncStorage.removeItem('pending_navigation_intent');
        return JSON.parse(stored);
      }
      return null;
    } catch (error) {
      console.error('Failed to get navigation intent:', error);
      return null;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<{
    scheduledCount: number;
    lastTriggered?: string;
    config: NotificationConfig;
  }> {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const smartDietNotifications = scheduled.filter(
        notif => notif.identifier.includes('smart-diet')
      );

      const config = await this.getConfig();

      return {
        scheduledCount: smartDietNotifications.length,
        config
      };
    } catch (error) {
      console.error('Failed to get notification stats:', error);
      return {
        scheduledCount: 0,
        config: this.defaultConfig
      };
    }
  }

  /**
   * Test notification (for development)
   */
  async testNotification(): Promise<void> {
    await this.triggerSmartDietNotification(
      SmartDietContext.TODAY,
      {
        title: '🧪 Test Smart Diet Notification',
        message: 'This is a test notification for Smart Diet integration'
      }
    );
  }
}

// Singleton export
export const notificationService = NotificationService.getInstance();