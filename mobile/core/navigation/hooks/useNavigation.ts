/**
 * useNavigation Hook for DietIntel Mobile App
 * Primary navigation hook with enhanced functionality and type safety
 */

import { useCallback } from 'react';
import { ScreenType, NavigationContext, UseNavigationReturn } from '../NavigationTypes';
import { useSafeNavigation } from '../NavigationCore';

/**
 * Enhanced navigation hook with additional utilities
 */
export const useNavigation = (): UseNavigationReturn & {
  // Enhanced navigation methods
  navigateWithValidation: (screen: ScreenType, context?: NavigationContext) => boolean;
  navigateReplace: (screen: ScreenType, context?: NavigationContext) => void;
  navigateAndClear: (screen: ScreenType, context?: NavigationContext) => void;
  
  // Navigation utilities
  getCurrentRoute: () => string;
  canNavigateTo: (screen: ScreenType) => boolean;
  isCurrentScreen: (screen: ScreenType) => boolean;
  
  // Context management
  updateNavigationContext: (updates: Partial<NavigationContext>) => void;
  clearNavigationContext: () => void;
  
  // Navigation history
  getNavigationHistory: () => ScreenType[];
  getPreviousScreen: () => ScreenType | undefined;
  getBackStackCount: () => number;
  getCurrentComponent: () => Promise<any>;
  getMetrics: () => any;
} => {
  const navigation = useSafeNavigation();

  // Enhanced navigation with validation
  const navigateWithValidation = useCallback((screen: ScreenType, context?: NavigationContext): boolean => {
    if (!navigation.canNavigateTo(screen)) {
      console.warn(`Navigation blocked: Cannot navigate from ${navigation.currentScreen} to ${screen}`);
      return false;
    }
    
    navigation.navigate(screen, context);
    return true;
  }, [navigation]);

  // Navigate with replacement (replace current screen in history)
  const navigateReplace = useCallback((screen: ScreenType, context?: NavigationContext) => {
    navigation.navigate(screen, { ...context, replace: true } as any);
  }, [navigation]);

  // Navigate and clear all navigation history
  const navigateAndClear = useCallback((screen: ScreenType, context?: NavigationContext) => {
    navigation.reset(screen, context);
  }, [navigation]);

  // Get current route as string
  const getCurrentRoute = useCallback((): string => {
    return navigation.currentScreen;
  }, [navigation.currentScreen]);

  // Check if target screen can be navigated to
  const canNavigateTo = useCallback((screen: ScreenType): boolean => {
    return navigation.canNavigateTo(screen);
  }, [navigation.canNavigateTo]);

  // Check if currently on specific screen
  const isCurrentScreen = useCallback((screen: ScreenType): boolean => {
    return navigation.currentScreen === screen;
  }, [navigation.currentScreen]);

  // Update navigation context
  const updateNavigationContext = useCallback((updates: Partial<NavigationContext>) => {
    navigation.navigationContext = { ...navigation.navigationContext, ...updates };
  }, [navigation.navigationContext]);

  // Clear navigation context
  const clearNavigationContext = useCallback(() => {
    navigation.navigationContext = {};
  }, []);

  // Get navigation history
  const getNavigationHistory = useCallback((): ScreenType[] => {
    return navigation.getMetrics().history || [];
  }, [navigation.getMetrics]);

  // Get previous screen
  const getPreviousScreen = useCallback((): ScreenType | undefined => {
    return navigation.getMetrics().previousScreen;
  }, [navigation.getMetrics]);

  // Get back stack count
  const getBackStackCount = useCallback((): number => {
    return navigation.getMetrics().historyLength - 1; // -1 because current screen doesn't count
  }, [navigation.getMetrics]);

  return {
    ...navigation,
    navigateWithValidation,
    navigateReplace,
    navigateAndClear,
    getCurrentRoute,
    canNavigateTo,
    isCurrentScreen,
    updateNavigationContext,
    clearNavigationContext,
    getNavigationHistory,
    getPreviousScreen,
    getBackStackCount
  };
};

/**
 * Hook for programmatic navigation with specific patterns
 */
export const useProgrammaticNavigation = () => {
  const navigation = useNavigation();

  // Navigate to authenticated sections
  const navigateToAuthenticated = useCallback((target: ScreenType, context?: NavigationContext) => {
    if (['login', 'register', 'splash'].includes(target)) {
      console.warn('Cannot navigate to auth screens when already authenticated');
      return false;
    }
    
    return navigation.navigateWithValidation(target, context);
  }, [navigation]);

  // Navigate to feature sections with context
  const navigateToFeature = useCallback((feature: 'recipes' | 'tracking' | 'planning' | 'social', context?: NavigationContext) => {
    const featureScreens: Record<string, ScreenType> = {
      recipes: 'recipes',
      tracking: 'track',
      planning: 'plan',
      social: 'discover-feed'
    };
    
    const targetScreen = featureScreens[feature];
    if (targetScreen) {
      return navigation.navigateWithValidation(targetScreen, context);
    }
    
    return false;
  }, [navigation]);

  // Navigate with error handling
  const navigateSafe = useCallback(async (screen: ScreenType, context?: NavigationContext): Promise<boolean> => {
    try {
      const component = await navigation.getCurrentComponent();
      if (!component) {
        console.error(`Failed to load component for ${screen}`);
        return false;
      }
      
      return navigation.navigateWithValidation(screen, context);
    } catch (error) {
      console.error(`Navigation error to ${screen}:`, error);
      return false;
    }
  }, [navigation]);

  return {
    navigateToAuthenticated,
    navigateToFeature,
    navigateSafe,
    ...navigation
  };
};

/**
 * Hook for navigation analytics and debugging
 */
export const useNavigationAnalytics = () => {
  const navigation = useNavigation();

  // Track navigation events
  const trackNavigation = useCallback((from: ScreenType, to: ScreenType, context?: NavigationContext) => {
    console.log('📊 Navigation Analytics:', {
      from,
      to,
      timestamp: new Date().toISOString(),
      contextKeys: Object.keys(context || {}),
      backStackSize: navigation.getBackStackCount()
    });
    
    // Here you could integrate with analytics service
    // analytics.track('navigation', { from, to, ...context });
  }, [navigation]);

  // Get navigation performance metrics
  const getPerformanceMetrics = useCallback(() => {
    const metrics = navigation.getMetrics();
    return {
      screenTransitions: metrics.historyLength,
      averageTransitionsPerSession: metrics.historyLength,
      currentRouteDepth: metrics.historyLength,
      contextDataSize: JSON.stringify(navigation.navigationContext).length,
      validTransitionsAvailable: metrics.validTransitions
    };
  }, [navigation]);

  return {
    trackNavigation,
    getPerformanceMetrics,
    ...navigation
  };
};

export default {
  useNavigation,
  useProgrammaticNavigation,
  useNavigationAnalytics
};
