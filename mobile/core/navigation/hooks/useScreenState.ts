/**
 * useScreenState Hook for DietIntel Mobile App
 * State management for individual screen components
 */

import { useCallback, useState, useEffect } from 'react';
import { ScreenType, NavigationContext, UseScreenStateReturn } from '../NavigationTypes';
import { useSafeNavigation } from '../NavigationCore';

/**
 * Hook for managing individual screen state and lifecycle
 */
export const useScreenState = (screen: ScreenType): UseScreenStateReturn & {
  // Lifecycle methods
  onScreenAppear: (callback: () => void | (() => void)) => void;
  onScreenDisappear: (callback: () => void) => void;
  
  // State management
  setScreenContext: (context: Partial<NavigationContext>) => void;
  getScreenContext: () => NavigationContext;
  clearScreenContext: () => void;
  
  // Screen validation
  isActive: boolean;
  isValidTransition: (target: ScreenType) => boolean;
  
  // Error handling
  handleScreenError: (error: Error) => void;
  resetScreenError: () => void;
  
  // Performance monitoring
  getRenderTime: () => number;
  getMountCount: () => number;
} => {
  const navigation = useSafeNavigation();
  const [error, setError] = useState<string | null>(null);
  const [renderStartTime] = useState(Date.now());
  const [mountCount, setMountCount] = useState(0);
  
  // Check if this screen is currently active
  const isActive = navigation.currentScreen === screen;
  
  // Screen lifecycle management
  useEffect(() => {
    if (isActive) {
      setMountCount(prev => prev + 1);
      console.log(`📱 Screen appeared: ${screen}`);
    }
    
    return () => {
      if (isActive) {
        console.log(`📱 Screen disappeared: ${screen}`);
      }
    };
  }, [isActive, screen]);

  // Get screen-specific context
  const getScreenContext = useCallback((): NavigationContext => {
    return navigation.navigationContext;
  }, [navigation.navigationContext]);

  // Update screen context
  const setScreenContext = useCallback((updates: Partial<NavigationContext>) => {
    navigation.navigationContext = { ...navigation.navigationContext, ...updates };
  }, [navigation.navigationContext]);

  // Clear screen context
  const clearScreenContext = useCallback(() => {
    navigation.navigationContext = {};
  }, []);

  // Check if transition from current screen to target is valid
  const isValidTransition = useCallback((target: ScreenType): boolean => {
    return navigation.canNavigateTo(target);
  }, [navigation.canNavigateTo]);

  // Handle screen errors
  const handleScreenError = useCallback((error: Error) => {
    console.error(`❌ Screen error in ${screen}:`, error);
    setError(error.message);
    
    // Auto-navigate back on critical errors
    if (navigation.canGoBack) {
      setTimeout(() => {
        navigation.goBack();
      }, 3000); // Give user time to see error
    }
  }, [screen, navigation]);

  // Reset screen error
  const resetScreenError = useCallback(() => {
    setError(null);
  }, []);

  // Get render time for performance monitoring
  const getRenderTime = useCallback((): number => {
    return Date.now() - renderStartTime;
  }, [renderStartTime]);

  return {
    // Base state from UseScreenStateReturn
    screen: navigation.currentScreen,
    context: navigation.navigationContext,
    canGoBack: navigation.canGoBack,
    setContext: setScreenContext,
    goBack: navigation.goBack,
    
    // Enhanced functionality
    onScreenAppear: (callback: () => void | (() => void)) => {
      if (isActive) {
        const cleanup = callback();
        if (typeof cleanup === 'function') {
          return cleanup;
        }
      }
      return undefined;
    },
    
    onScreenDisappear: (callback: () => void) => {
      // Store callback for when screen becomes inactive
      if (!isActive) {
        callback();
      }
    },
    
    setScreenContext,
    getScreenContext,
    clearScreenContext,
    
    isActive,
    isValidTransition,
    
    handleScreenError,
    resetScreenError,
    
    getRenderTime,
    getMountCount: () => mountCount
  };
};

/**
 * Hook for screen-specific data loading and caching
 */
export const useScreenData = <T = any>(
  screen: ScreenType,
  dataLoader: () => Promise<T>,
  dependencies: any[] = []
) => {
  const screenState = useScreenState(screen);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data when screen becomes active
  useEffect(() => {
    if (screenState.isActive) {
      const loadData = async () => {
        try {
          setLoading(true);
          setError(null);
          
          const result = await dataLoader();
          setData(result);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMessage);
          screenState.handleScreenError(new Error(errorMessage));
        } finally {
          setLoading(false);
        }
      };

      loadData();
    }
  }, [screenState.isActive, ...dependencies]);

  // Cleanup when screen becomes inactive
  useEffect(() => {
    if (!screenState.isActive) {
      setData(null);
      setLoading(false);
      setError(null);
    }
  }, [screenState.isActive]);

  const reloadData = useCallback(async () => {
    if (screenState.isActive) {
      try {
        setLoading(true);
        setError(null);
        
        const result = await dataLoader();
        setData(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }
  }, [screenState.isActive, dataLoader]);

  return {
    data,
    loading,
    error,
    reloadData,
    isActive: screenState.isActive
  };
};

/**
 * Hook for screen navigation guards and permissions
 */
export const useScreenGuards = (screen: ScreenType) => {
  const navigation = useSafeNavigation();
  const screenState = useScreenState(screen);

  // Check if user can access this screen
  const canAccess = useCallback((): boolean => {
    // Add your permission logic here
    // For example: check user role, authentication status, etc.
    return true; // Default to allowed
  }, []);

  // Navigate away if not allowed
  useEffect(() => {
    if (screenState.isActive && !canAccess()) {
      console.warn(`🚫 Access denied to screen: ${screen}`);
      navigation.navigate('profile'); // Navigate to safe screen
    }
  }, [screenState.isActive, canAccess, screen, navigation]);

  return {
    canAccess,
    isBlocked: !canAccess()
  };
};

export default {
  useScreenState,
  useScreenData,
  useScreenGuards
};
