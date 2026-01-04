import { useEffect } from 'react';
import { notificationService } from '../services/NotificationService';
import type { ScreenType, NavigationContext } from '../core/navigation/NavigationTypes';

type NavigateFn = (screen: ScreenType, context?: NavigationContext) => void;

export const useNotifications = (navigateToScreen: NavigateFn) => {
  useEffect(() => {
    let isMounted = true;

    const initializeNotifications = async () => {
      const initialized = await notificationService.initialize();
      if (!initialized || !isMounted) {
        return;
      }

      const intent = await notificationService.getPendingNavigationIntent();
      if (!intent || intent.type !== 'smart_diet_navigation') {
        return;
      }

      navigateToScreen('recommendations', {
        targetContext: intent.context,
        sourceScreen: 'notification',
      });
    };

    initializeNotifications();

    return () => {
      isMounted = false;
    };
  }, [navigateToScreen]);
};
