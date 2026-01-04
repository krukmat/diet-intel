/**
 * Navigation Core for DietIntel Mobile App
 * Central navigation system with state management and routing logic
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ScreenType, NavigationState, NavigationAction, NavigationContext, UseNavigationReturn } from './NavigationTypes';
import { SCREEN_REGISTRY, NAVIGATION_TRANSITIONS, validateScreen, loadScreenComponent } from './ScreenRegistry';

// Initial state
const initialState: NavigationState = {
  currentScreen: 'splash',
  previousScreen: undefined,
  navigationContext: {},
  canGoBack: false,
  history: ['splash']
};

// Navigation context for React components
const NavigationContext = createContext<UseNavigationReturn | null>(null);

// Navigation reducer
const navigationReducer = (state: NavigationState, action: NavigationAction): NavigationState => {
  switch (action.type) {
    case 'NAVIGATE_TO':
      const { screen, context, replace } = action.payload;
      
      if (!screen || !validateScreen(screen)) {
        console.warn(`Invalid screen: ${screen}`);
        return state;
      }

      const newHistory = replace 
        ? [...state.history.slice(0, -1), screen]
        : [...state.history, screen];

      return {
        currentScreen: screen,
        previousScreen: state.currentScreen,
        navigationContext: context || {},
        canGoBack: newHistory.length > 1,
        history: newHistory
      };

    case 'GO_BACK':
      if (state.history.length <= 1) {
        return state; // Can't go back
      }

      const backHistory = state.history.slice(0, -1);
      const previousScreen = backHistory[backHistory.length - 1];

      return {
        currentScreen: previousScreen,
        previousScreen: state.currentScreen,
        navigationContext: {}, // Clear context on back
        canGoBack: backHistory.length > 1,
        history: backHistory
      };

    case 'RESET_NAVIGATION':
      const resetScreen = action.payload.screen || 'splash';
      return {
        currentScreen: resetScreen,
        previousScreen: undefined,
        navigationContext: action.payload.context || {},
        canGoBack: false,
        history: [resetScreen]
      };

    case 'UPDATE_CONTEXT':
      return {
        ...state,
        navigationContext: { ...state.navigationContext, ...action.payload.context }
      };

    default:
      return state;
  }
};

// Navigation Provider Component
interface NavigationProviderProps {
  children: React.ReactNode;
  initialScreen?: ScreenType;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ 
  children, 
  initialScreen = 'splash' 
}) => {
  const [state, dispatch] = useReducer(navigationReducer, {
    ...initialState,
    currentScreen: initialScreen,
    history: [initialScreen]
  });

  // Navigation actions
  const navigate = useCallback((screen: ScreenType, context?: NavigationContext) => {
    console.log(`🔄 Navigation: ${state.currentScreen} → ${screen}`, context);
    dispatch({ type: 'NAVIGATE_TO', payload: { screen, context } });
  }, [state.currentScreen]);

  const goBack = useCallback(() => {
    if (state.canGoBack) {
      console.log(`⬅️ Going back from ${state.currentScreen}`);
      dispatch({ type: 'GO_BACK', payload: {} });
    }
  }, [state.canGoBack, state.currentScreen]);

  const reset = useCallback((screen: ScreenType, context?: NavigationContext) => {
    console.log(`🔄 Resetting navigation to ${screen}`);
    dispatch({ type: 'RESET_NAVIGATION', payload: { screen, context } });
  }, []);

  const updateContext = useCallback((context: NavigationContext) => {
    dispatch({ type: 'UPDATE_CONTEXT', payload: { context } });
  }, []);

  // Check if transition is valid
  const canNavigateTo = useCallback((targetScreen: ScreenType): boolean => {
    const validTransitions = NAVIGATION_TRANSITIONS[state.currentScreen] || [];
    return validTransitions.includes(targetScreen);
  }, [state.currentScreen]);

  // Get current screen component
  const getCurrentComponent = useCallback(async () => {
    try {
      const component = await loadScreenComponent(state.currentScreen);
      return component;
    } catch (error) {
      console.error(`Failed to load component for ${state.currentScreen}:`, error);
      return null;
    }
  }, [state.currentScreen]);

  // Navigation metrics
  const getNavigationMetrics = useCallback(() => {
    return {
      currentScreen: state.currentScreen,
      previousScreen: state.previousScreen,
      canGoBack: state.canGoBack,
      historyLength: state.history.length,
      contextKeys: Object.keys(state.navigationContext),
      validTransitions: NAVIGATION_TRANSITIONS[state.currentScreen]?.length || 0
    };
  }, [state]);

  const contextValue: UseNavigationReturn = {
    navigate,
    goBack,
    canGoBack: state.canGoBack,
    currentScreen: state.currentScreen,
    navigationContext: state.navigationContext,
    reset
  };

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  );
};

// Hook to use navigation
export const useNavigation = (): UseNavigationReturn => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

// Enhanced navigation hook with validation
export const useSafeNavigation = (): UseNavigationReturn & {
  canNavigateTo: (screen: ScreenType) => boolean;
  getCurrentComponent: () => Promise<any>;
  getMetrics: () => any;
} => {
  const navigation = useNavigation();

  const canNavigateTo = (targetScreen: ScreenType): boolean => {
    const validTransitions = NAVIGATION_TRANSITIONS[navigation.currentScreen] || [];
    return validTransitions.includes(targetScreen);
  };

  const getCurrentComponent = async () => {
    try {
      const component = await loadScreenComponent(navigation.currentScreen);
      return component;
    } catch (error) {
      console.error(`Failed to load component for ${navigation.currentScreen}:`, error);
      return null;
    }
  };

  const getMetrics = () => ({
    currentScreen: navigation.currentScreen,
    canGoBack: navigation.canGoBack,
    contextKeys: Object.keys(navigation.navigationContext || {}),
    validTransitions: NAVIGATION_TRANSITIONS[navigation.currentScreen]?.length || 0,
  });

  return {
    ...navigation,
    canNavigateTo,
    getCurrentComponent,
    getMetrics
  };
};

// Navigation Error Component (React Native compatible)
const NavigationErrorComponent: React.FC<{ error: string; onReload: () => void }> = ({ 
  error, 
  onReload 
}) => {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Navigation Error</Text>
      <Text style={styles.errorMessage}>{error || 'Unknown error'}</Text>
      <TouchableOpacity style={styles.reloadButton} onPress={onReload}>
        <Text style={styles.reloadButtonText}>Reload App</Text>
      </TouchableOpacity>
    </View>
  );
};

// Screen component renderer
interface ScreenRendererProps {
  fallback?: React.ComponentType<any>;
}

export const ScreenRenderer: React.FC<ScreenRendererProps> = ({ 
  fallback: Fallback = () => null 
}) => {
  const { currentScreen, navigationContext } = useNavigation();
  const [Component, setComponent] = React.useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const loadComponent = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const loadedComponent = await loadScreenComponent(currentScreen);
        
        if (isMounted) {
          setComponent(() => loadedComponent);
          setLoading(false);
        }
      } catch (err) {
        console.error(`Failed to load screen ${currentScreen}:`, err);
        if (isMounted) {
          setError(`Failed to load ${currentScreen}`);
          setLoading(false);
        }
      }
    };

    loadComponent();

    return () => {
      isMounted = false;
    };
  }, [currentScreen]);

  if (loading) {
    return <Fallback />;
  }

  if (error || !Component) {
    return (
      <NavigationErrorComponent 
        error={error || 'Unknown error'} 
        onReload={() => {
          // In a real app, you might want to reset the navigation state
          console.log('Reloading app...');
        }}
      />
    );
  }

  return <Component navigationContext={navigationContext} />;
};

// Navigation debugging utilities
export const useNavigationDebug = () => {
  const navigation = useNavigation();
  
  useEffect(() => {
    console.log('🔍 Navigation State:', {
      currentScreen: navigation.currentScreen,
      canGoBack: navigation.canGoBack,
      context: navigation.navigationContext
    });
  }, [navigation.currentScreen, navigation.canGoBack, navigation.navigationContext]);

  return {
    logState: () => console.log('Current navigation state:', navigation),
    clearHistory: () => navigation.reset('splash')
  };
};

// Styles for React Native components
const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  reloadButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  reloadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default {
  NavigationProvider,
  useNavigation,
  useSafeNavigation,
  ScreenRenderer,
  useNavigationDebug
};
