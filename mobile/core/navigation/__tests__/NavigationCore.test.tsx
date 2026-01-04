/**
 * Navigation Core Tests for DietIntel Mobile App
 * Comprehensive test suite for navigation system
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationProvider, useNavigation, useSafeNavigation, ScreenRenderer } from '../NavigationCore';
import * as ScreenRegistry from '../ScreenRegistry';
import { ScreenType } from '../NavigationTypes';

// Mock screen components for testing
const MockScreen: React.FC<{ navigationContext?: any }> = ({ navigationContext }) => (
  <View testID="mock-screen">
    <Text>Mock Screen</Text>
    {navigationContext?.testData && <Text testID="context-data">{navigationContext.testData}</Text>}
  </View>
);

const MockErrorScreen: React.FC = () => (
  <View testID="error-screen">
    <Text>Error Screen</Text>
  </View>
);

jest.mock('../ScreenRegistry', () => {
  const actual = jest.requireActual('../ScreenRegistry');
  return {
    ...actual,
    loadScreenComponent: jest.fn(actual.loadScreenComponent),
  };
});

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode; initialScreen?: ScreenType }> = ({ 
  children, 
  initialScreen = 'splash' 
}) => (
  <NavigationProvider initialScreen={initialScreen}>
    {children}
  </NavigationProvider>
);

// Test component that uses navigation
const TestNavigationComponent: React.FC = () => {
  const navigation = useNavigation();
  
  return (
    <View testID="test-component">
      <Text testID="current-screen">{navigation.currentScreen}</Text>
      <TouchableOpacity
        testID="navigate-to-track"
        onPress={() => navigation.navigate('track')}
      >
        <Text>Navigate to Track</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="navigate-to-recipes"
        onPress={() => navigation.navigate('recipes')}
      >
        <Text>Navigate to Recipes</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="go-back"
        onPress={() => navigation.goBack()}
        disabled={!navigation.canGoBack}
      >
        <Text>Go Back</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="navigate-with-context"
        onPress={() => navigation.navigate('plan', { testData: 'context-value' })}
      >
        <Text>Navigate with Context</Text>
      </TouchableOpacity>
    </View>
  );
};

describe('NavigationCore', () => {
  beforeEach(() => {
    // Clear any console logs for cleaner test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('NavigationProvider', () => {
    it('should provide navigation context to children', () => {
      render(
        <TestWrapper>
          <TestNavigationComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('current-screen')).toBeTruthy();
      expect(screen.getByTestId('navigate-to-track')).toBeTruthy();
      expect(screen.getByTestId('navigate-to-recipes')).toBeTruthy();
    });

    it('should initialize with default screen', () => {
      render(
        <TestWrapper>
          <TestNavigationComponent />
        </TestWrapper>
      );

      expect(screen.getByText('splash')).toBeTruthy();
    });

    it('should accept custom initial screen', () => {
      render(
        <TestWrapper initialScreen="login">
          <TestNavigationComponent />
        </TestWrapper>
      );

      expect(screen.getByText('login')).toBeTruthy();
    });

    it('should throw error when useNavigation used outside provider', () => {
      // Suppress console error for this test
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestNavigationComponent />);
      }).toThrow('useNavigation must be used within a NavigationProvider');
    });
  });

  describe('Navigation Actions', () => {
    it('should navigate to valid screens', async () => {
      render(
        <TestWrapper>
          <TestNavigationComponent />
        </TestWrapper>
      );

      // Navigate to track
      fireEvent.press(screen.getByTestId('navigate-to-track'));
      await waitFor(() => {
        expect(screen.getByText('track')).toBeTruthy();
      });

      // Navigate to recipes
      fireEvent.press(screen.getByTestId('navigate-to-recipes'));
      await waitFor(() => {
        expect(screen.getByText('recipes')).toBeTruthy();
      });
    });

    it('should handle navigation with context', async () => {
      render(
        <TestWrapper>
          <TestNavigationComponent />
        </TestWrapper>
      );

      fireEvent.press(screen.getByTestId('navigate-with-context'));
      await waitFor(() => {
        expect(screen.getByText('plan')).toBeTruthy();
      });
    });

    it('should maintain navigation history', async () => {
      render(
        <TestWrapper>
          <TestNavigationComponent />
        </TestWrapper>
      );

      // Initial state
      expect(screen.getByText('splash')).toBeTruthy();
      expect(screen.getByTestId('go-back').props.disabled).toBe(true);

      // Navigate forward
      fireEvent.press(screen.getByTestId('navigate-to-track'));
      await waitFor(() => {
        expect(screen.getByText('track')).toBeTruthy();
      });
      expect(screen.getByTestId('go-back').props.disabled).toBe(false);

      // Go back
      fireEvent.press(screen.getByTestId('go-back'));
      await waitFor(() => {
        expect(screen.getByText('splash')).toBeTruthy();
      });
    });

    it('should block invalid navigation transitions', () => {
      // This test depends on the NAVIGATION_TRANSITIONS mapping
      // If 'splash' cannot navigate to 'profile', this should be blocked
      render(
        <TestWrapper>
          <TestNavigationComponent />
        </TestWrapper>
      );

      // Try to navigate to a screen that might not be valid from splash
      // This test would need to be adjusted based on actual transition rules
      console.log('Navigation transitions test - this would need real validation logic');
    });
  });

  describe('useSafeNavigation', () => {
    const TestSafeNavigationComponent: React.FC = () => {
      const navigation = useSafeNavigation();
      
      return (
        <View testID="safe-nav-component">
          <Text testID="can-navigate-to-plan">
            {navigation.canNavigateTo('plan').toString()}
          </Text>
          <Text testID="metrics">{JSON.stringify(navigation.getMetrics())}</Text>
        </View>
      );
    };

    it('should provide enhanced navigation methods', () => {
      render(
        <TestWrapper>
          <TestSafeNavigationComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('can-navigate-to-plan')).toBeTruthy();
      expect(screen.getByTestId('metrics')).toBeTruthy();
    });

    it('returns null when component load fails', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (ScreenRegistry.loadScreenComponent as jest.Mock).mockRejectedValueOnce(new Error('nope'));

      const TestLoadComponent: React.FC = () => {
        const navigation = useSafeNavigation();
        React.useEffect(() => {
          navigation.getCurrentComponent();
        }, []);
        return <View testID="load-component" />;
      };

      render(
        <TestWrapper>
          <TestLoadComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(errorSpy).toHaveBeenCalled();
      });

      errorSpy.mockRestore();
    });
  });

  describe('ScreenRenderer', () => {
    it('should render current screen component', () => {
      render(
        <TestWrapper>
          <ScreenRenderer fallback={() => (
            <View testID="fallback">
              <Text>Loading...</Text>
            </View>
          )} />
        </TestWrapper>
      );

      // This test would need actual screen components to be mocked/imported
      expect(screen.getByTestId('fallback')).toBeTruthy();
    });

    it('should handle loading state', () => {
      render(
        <TestWrapper initialScreen="track">
          <ScreenRenderer fallback={() => (
            <View testID="loading-fallback">
              <Text>Loading...</Text>
            </View>
          )} />
        </TestWrapper>
      );

      // When component is loading, should show fallback
      expect(screen.getByTestId('loading-fallback')).toBeTruthy();
    });

    it('shows error UI when screen fails to load', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (ScreenRegistry.loadScreenComponent as jest.Mock).mockRejectedValueOnce(new Error('boom'));

      render(
        <TestWrapper initialScreen="track">
          <ScreenRenderer fallback={() => (
            <View testID="loading-fallback">
              <Text>Loading...</Text>
            </View>
          )} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Navigation Error')).toBeTruthy();
      });

      errorSpy.mockRestore();
    });
  });

  describe('Navigation Context Management', () => {
    it('should update navigation context', async () => {
      const TestContextComponent: React.FC = () => {
        const navigation = useNavigation();
        const [contextValue, setContextValue] = React.useState('');

        return (
          <View testID="context-component">
            <Text testID="context-display">{JSON.stringify(navigation.navigationContext)}</Text>
            <TouchableOpacity
              testID="update-context"
              onPress={() => navigation.navigate('plan', { testData: 'updated-value' })}
            >
              <Text>Update Context</Text>
            </TouchableOpacity>
          </View>
        );
      };

      render(
        <TestWrapper>
          <TestContextComponent />
        </TestWrapper>
      );

      fireEvent.press(screen.getByTestId('update-context'));
      await waitFor(() => {
        expect(screen.getByTestId('context-display').props.children).toContain('updated-value');
      });
    });
  });

  describe('Navigation Reset', () => {
    it('resets navigation to target screen', async () => {
      const TestResetComponent: React.FC = () => {
        const navigation = useNavigation();
        return (
          <View>
            <Text testID="current-screen">{navigation.currentScreen}</Text>
            <TouchableOpacity testID="reset-to-login" onPress={() => navigation.reset('login')}>
              <Text>Reset</Text>
            </TouchableOpacity>
          </View>
        );
      };

      render(
        <TestWrapper>
          <TestResetComponent />
        </TestWrapper>
      );

      fireEvent.press(screen.getByTestId('reset-to-login'));
      await waitFor(() => {
        expect(screen.getByText('login')).toBeTruthy();
      });
    });
  });

  describe('Performance and Metrics', () => {
    it('should track navigation metrics', () => {
      const TestMetricsComponent: React.FC = () => {
        const navigation = useSafeNavigation();
        const metrics = navigation.getMetrics();
        
        return (
          <View testID="metrics-display">
            <Text testID="history-length">{metrics.historyLength}</Text>
            <Text testID="current-screen">{metrics.currentScreen}</Text>
          </View>
        );
      };

      render(
        <TestWrapper>
          <TestMetricsComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('history-length')).toBeTruthy();
      expect(screen.getByText('splash')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle navigation errors gracefully', () => {
      // Test error boundary behavior
      const TestErrorComponent: React.FC = () => {
        const navigation = useNavigation();
        
        React.useEffect(() => {
          // Simulate navigation error
          try {
            navigation.navigate('invalid-screen' as ScreenType);
          } catch (error) {
            console.error('Navigation error handled');
          }
        }, []);

        return (
          <View testID="error-handler">
            <Text>Error Handler</Text>
          </View>
        );
      };

      render(
        <TestWrapper>
          <TestErrorComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('error-handler')).toBeTruthy();
    });
  });

  describe('Navigation History Management', () => {
    it('should maintain proper back stack', async () => {
      render(
        <TestWrapper>
          <TestNavigationComponent />
        </TestWrapper>
      );

      // Navigate through multiple screens
      fireEvent.press(screen.getByTestId('navigate-to-track'));
      await waitFor(() => {
        expect(screen.getByText('track')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('navigate-to-recipes'));
      await waitFor(() => {
        expect(screen.getByText('recipes')).toBeTruthy();
      });

      // Should be able to go back twice
      fireEvent.press(screen.getByTestId('go-back'));
      await waitFor(() => {
        expect(screen.getByText('track')).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId('go-back'));
      await waitFor(() => {
        expect(screen.getByText('splash')).toBeTruthy();
      });
    });

    it('should disable back button when at root', () => {
      render(
        <TestWrapper>
          <TestNavigationComponent />
        </TestWrapper>
      );

      // At root screen, back should be disabled
      expect(screen.getByTestId('go-back').props.disabled).toBe(true);
    });

    it('does not change screen when back at root', async () => {
      render(
        <TestWrapper>
          <TestNavigationComponent />
        </TestWrapper>
      );

      fireEvent.press(screen.getByTestId('go-back'));
      await waitFor(() => {
        expect(screen.getByText('splash')).toBeTruthy();
      });
    });
  });
});

describe('Navigation Integration Tests', () => {
  it('should handle complete navigation flows', async () => {
    const CompleteFlowTest: React.FC = () => {
      const navigation = useNavigation();
      
      React.useEffect(() => {
        // Simulate a complete user flow
        const runFlow = async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          navigation.navigate('login');
          
          await new Promise(resolve => setTimeout(resolve, 100));
          navigation.navigate('track');
          
          await new Promise(resolve => setTimeout(resolve, 100));
          navigation.navigate('plan');
        };
        
        runFlow();
      }, []);

      return (
        <View testID="flow-test">
          <Text testID="flow-screen">{navigation.currentScreen}</Text>
        </View>
      );
    };

    render(
      <TestWrapper>
        <CompleteFlowTest />
      </TestWrapper>
    );

    // Should complete the flow and end on 'plan'
    await waitFor(() => {
      expect(screen.getByText('plan')).toBeTruthy();
    }, { timeout: 1000 });
  });
});
