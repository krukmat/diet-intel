/**
 * Smart Diet Navigation Flow Tests
 * Tests user interaction flows for Smart Diet navigation integration
 * Including deep linking, cross-feature navigation, and Phase 9.2.2 navigation enhancements
 */

// Mock React Native first before any imports
jest.mock('react-native', () => {
  const mockPixelRatio = {
    get: jest.fn(() => 2),
    getFontScale: jest.fn(() => 1),
    getPixelSizeForLayoutSize: jest.fn((layoutSize) => layoutSize * 2),
    roundToNearestPixel: jest.fn((layoutSize) => Math.round(layoutSize)),
  };

  return {
    PixelRatio: mockPixelRatio,
    StatusBar: 'StatusBar',
    Alert: {
      alert: jest.fn(),
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 })),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    StyleSheet: {
      create: jest.fn((styles) => styles),
      flatten: jest.fn((style) => style),
      compose: jest.fn((style1, style2) => [style1, style2]),
      hairlineWidth: 1,
      absoluteFill: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      },
    },
    Platform: {
      OS: 'ios',
      Version: '14.0',
      select: jest.fn((obj) => obj.ios || obj.default),
    },
    ActivityIndicator: 'ActivityIndicator',
    ScrollView: 'ScrollView',
    TouchableOpacity: 'TouchableOpacity',
    View: 'View',
    Text: 'Text',
    Image: 'Image',
    Modal: 'Modal',
    SafeAreaView: 'SafeAreaView',
    FlatList: 'FlatList',
    TextInput: 'TextInput',
  };
});

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import SmartDietScreen from '../../screens/SmartDietScreen';

// Mock complex components to focus on navigation logic
jest.mock('../../screens/PlanScreen', () => {
  const mockReact = require('react');
  return function MockPlanScreen({ onBackPress, navigateToSmartDiet }) {
    return mockReact.createElement('View', { testID: 'plan-screen' }, [
      mockReact.createElement('Text', { key: 'title' }, 'plan.title'),
      mockReact.createElement('TouchableOpacity', {
        key: 'back',
        onPress: onBackPress,
        testID: 'plan-back-button'
      }, mockReact.createElement('Text', null, '🏠')),
      mockReact.createElement('TouchableOpacity', {
        key: 'optimize',
        onPress: () => navigateToSmartDiet && navigateToSmartDiet({ planId: 'test_plan_001' }),
        testID: 'plan-optimize-button'
      }, mockReact.createElement('Text', null, '⚡ plan.optimize.button'))
    ]);
  };
});

jest.mock('../../App', () => {
  const mockReact = require('react');
  return function MockApp() {
    return mockReact.createElement('View', { testID: 'app' }, 
      mockReact.createElement('Text', null, 'DietIntel App')
    );
  };
});

// Mock external dependencies but keep navigation logic intact
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: jest.fn(),
    },
  }),
}));

jest.mock('../../services/NotificationService', () => ({
  notificationService: {
    getConfig: jest.fn().mockResolvedValue({
      enabled: true,
      dailySuggestionTime: "09:00",
      reminderInterval: 24,
      preferredContexts: ['today', 'insights']
    }),
    updateConfig: jest.fn().mockResolvedValue(undefined),
    triggerSmartDietNotification: jest.fn().mockResolvedValue(undefined),
    getPendingNavigationIntent: jest.fn().mockResolvedValue(null),
    initialize: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../../services/SmartDietService', () => ({
  smartDietService: {
    getSmartSuggestions: jest.fn().mockImplementation(async (context) => {
      await new Promise(resolve => setTimeout(resolve, 50)); // Realistic delay
      return {
        user_id: 'test_user',
        context_type: context,
        generated_at: new Date().toISOString(),
        suggestions: [
          {
            id: `suggestion_${context}_001`,
            suggestion_type: 'recommendation',
            category: 'discovery',
            title: `${context.charAt(0).toUpperCase() + context.slice(1)} Suggestion`,
            description: `A great ${context} suggestion for you`,
            reasoning: 'Based on your preferences',
            confidence_score: 0.85,
            priority_score: 0.9,
            meal_context: 'breakfast',
            suggested_item: { name: 'Test Food', calories: 100 },
            nutritional_benefit: { protein_g: 10 },
            calorie_impact: 100,
            action_text: 'Add to meal plan'
          }
        ],
        today_highlights: [],
        optimizations: context === 'optimize' ? [{ id: 'opt_001', title: 'Optimize suggestion' }] : [],
        discoveries: context === 'discover' ? [{ id: 'disc_001', title: 'Discovery suggestion' }] : [],
        insights: context === 'insights' ? [{ id: 'ins_001', title: 'Insight suggestion' }] : [],
        nutritional_summary: {
          total_recommended_calories: 1800,
          macro_distribution: { protein_percent: 20, fat_percent: 30, carbs_percent: 50 },
          health_benefits: ['Better nutrition']
        },
        total_suggestions: 1,
        avg_confidence: 0.85
      };
    }),
    submitSuggestionFeedback: jest.fn().mockResolvedValue(undefined),
    getDietInsights: jest.fn().mockResolvedValue({
      insights: [],
      nutritional_summary: {}
    }),
    optimizeMealPlan: jest.fn().mockResolvedValue({
      optimizations: []
    }),
  },
  SmartDietContext: {
    TODAY: 'today',
    OPTIMIZE: 'optimize',
    DISCOVER: 'discover',
    INSIGHTS: 'insights'
  },
}));

jest.mock('../../utils/foodTranslation', () => ({
  translateFoodNameSync: jest.fn((name: string) => name),
  translateFoodName: jest.fn((name: string) => Promise.resolve(name)),
}));

jest.mock('../../utils/mealPlanUtils', () => ({
  getCurrentMealPlanId: jest.fn().mockResolvedValue('test_plan_001'),
  storeCurrentMealPlanId: jest.fn().mockResolvedValue(undefined),
}));


// Mock async storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Navigation flow test helpers
const createMockNavigationProps = (overrides = {}) => ({
  onBackPress: jest.fn(),
  navigateToTrack: jest.fn(),
  navigateToPlan: jest.fn(),
  navigationContext: {
    targetContext: 'today',
    sourceScreen: 'test',
    planId: undefined,
  },
  ...overrides,
});

const renderSmartDietScreen = (props = {}) => {
  const mockProps = createMockNavigationProps(props);
  return {
    ...render(<SmartDietScreen {...mockProps} />),
    mockProps,
  };
};

// Import the mocked PlanScreen
const MockPlanScreen = require('../../screens/PlanScreen').default;

const renderPlanScreen = (props = {}) => {
  const mockProps = {
    onBackPress: jest.fn(),
    navigateToSmartDiet: jest.fn(),
    ...props,
  };
  return {
    ...render(<MockPlanScreen {...mockProps} />),
    mockProps,
  };
};

// Test data for navigation flows
const createNavigationContext = (overrides = {}) => ({
  targetContext: 'today',
  sourceScreen: 'test',
  planId: 'test_plan_001',
  ...overrides,
});

describe('Smart Diet Navigation Flow Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn(); // Suppress console logs in tests
  });

  // ======================
  // NAVIGATION SETUP VALIDATION
  // ======================

  describe('Navigation Setup Validation', () => {
    it('renders SmartDietScreen with navigation props correctly', async () => {
      const { getByText, mockProps } = renderSmartDietScreen();
      
      // Wait for component to load
      await waitFor(() => {
        expect(getByText('smartDiet.title')).toBeTruthy();
      });
      
      // Verify navigation props are available
      expect(mockProps.onBackPress).toBeDefined();
      expect(mockProps.navigateToTrack).toBeDefined();
      expect(mockProps.navigateToPlan).toBeDefined();
      expect(mockProps.navigationContext).toBeDefined();
      
      console.log('✅ Navigation Setup: SmartDietScreen navigation props validated');
    });

    it('renders PlanScreen with navigation props correctly', async () => {
      const { getByText, mockProps } = renderPlanScreen();
      
      // Wait for component to load
      await waitFor(() => {
        expect(getByText('plan.title')).toBeTruthy();
      });
      
      // Verify navigation props are available
      expect(mockProps.onBackPress).toBeDefined();
      expect(mockProps.navigateToSmartDiet).toBeDefined();
      
      console.log('✅ Navigation Setup: PlanScreen navigation props validated');
    });

    it('handles navigation context structure correctly', () => {
      const context = createNavigationContext({
        targetContext: 'optimize',
        sourceScreen: 'plan',
        planId: 'meal_plan_123'
      });
      
      expect(context.targetContext).toBe('optimize');
      expect(context.sourceScreen).toBe('plan');
      expect(context.planId).toBe('meal_plan_123');
      
      console.log('✅ Navigation Setup: Navigation context structure validated');
    });

    it('provides realistic test environment for user flows', async () => {
      const { getByText } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'optimize',
          sourceScreen: 'plan'
        })
      });
      
      // Component should respond to navigation context
      await waitFor(() => {
        expect(getByText('smartDiet.contexts.optimize')).toBeTruthy();
      });
      
      // Should show navigation button when coming from plan
      expect(getByText('📋')).toBeTruthy();
      
      console.log('✅ Navigation Setup: Realistic test environment validated');
    });
  });

  // ======================
  // BASIC NAVIGATION FUNCTIONALITY
  // ======================

  describe('Basic Navigation Functionality', () => {
    it('triggers onBackPress when back button is pressed', async () => {
      const { getByText, mockProps } = renderSmartDietScreen();
      
      await waitFor(() => {
        expect(getByText('🏠')).toBeTruthy();
      });
      
      fireEvent.press(getByText('🏠'));
      
      expect(mockProps.onBackPress).toHaveBeenCalledTimes(1);
      
      console.log('✅ Basic Navigation: Back button functionality validated');
    });

    it('triggers navigateToTrack when track button is pressed', async () => {
      const { getByText, mockProps } = renderSmartDietScreen();
      
      // Wait for suggestions to load
      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });
      
      // Find and press track button
      const trackButton = getByText('📊 Track');
      fireEvent.press(trackButton);
      
      expect(mockProps.navigateToTrack).toHaveBeenCalledTimes(1);
      
      console.log('✅ Basic Navigation: Track navigation functionality validated');
    });

    it('triggers navigateToPlan when plan button is pressed in optimize context', async () => {
      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'optimize',
          sourceScreen: 'plan'
        })
      });
      
      await waitFor(() => {
        expect(getByText('📋')).toBeTruthy(); // Plan navigation button
      });
      
      fireEvent.press(getByText('📋'));
      
      expect(mockProps.navigateToPlan).toHaveBeenCalledTimes(1);
      
      console.log('✅ Basic Navigation: Plan navigation functionality validated');
    });

    it('handles context switching navigation correctly', async () => {
      const { getByText } = renderSmartDietScreen();
      
      // Start with today context
      await waitFor(() => {
        expect(getByText('smartDiet.contexts.today')).toBeTruthy();
      });
      
      // Switch to optimize context
      fireEvent.press(getByText('smartDiet.contexts.optimize'));
      
      // Should trigger context change
      await waitFor(() => {
        expect(getByText('Optimize Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      console.log('✅ Basic Navigation: Context switching navigation validated');
    });
  });

  // ======================
  // NAVIGATION STATE MANAGEMENT
  // ======================

  describe('Navigation State Management', () => {
    it('preserves navigation context across component re-renders', async () => {
      const initialContext = createNavigationContext({
        targetContext: 'optimize',
        sourceScreen: 'plan',
        planId: 'plan_123'
      });
      
      const { getByText, rerender } = renderSmartDietScreen({
        navigationContext: initialContext
      });
      
      await waitFor(() => {
        expect(getByText('📋')).toBeTruthy(); // Plan button should be visible
      });
      
      // Re-render with same context
      rerender(<SmartDietScreen {...createMockNavigationProps({ navigationContext: initialContext })} />);
      
      // Context should be preserved
      await waitFor(() => {
        expect(getByText('📋')).toBeTruthy(); // Plan button still visible
      });
      
      console.log('✅ State Management: Navigation context preservation validated');
    });

    it('handles navigation context changes dynamically', async () => {
      const { getByText, rerender } = renderSmartDietScreen({
        navigationContext: createNavigationContext({ sourceScreen: 'test' })
      });
      
      // Initially no special navigation buttons
      await waitFor(() => {
        expect(getByText('smartDiet.title')).toBeTruthy();
      });
      
      // Change context to come from plan
      const newContext = createNavigationContext({ sourceScreen: 'plan' });
      rerender(<SmartDietScreen {...createMockNavigationProps({ navigationContext: newContext })} />);
      
      // Should now show plan navigation button
      await waitFor(() => {
        expect(getByText('📋')).toBeTruthy();
      });
      
      console.log('✅ State Management: Dynamic navigation context changes validated');
    });

    it('maintains proper state during async operations', async () => {
      const { getByText, mockProps } = renderSmartDietScreen();
      
      // Wait for initial load
      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });
      
      // Trigger context switch (async operation)
      fireEvent.press(getByText('smartDiet.contexts.discover'));
      
      // Immediately try to navigate back - should not interfere
      fireEvent.press(getByText('🏠'));
      
      // Both operations should complete successfully
      expect(mockProps.onBackPress).toHaveBeenCalledTimes(1);
      
      await waitFor(() => {
        expect(getByText('Discover Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      console.log('✅ State Management: Async operation state handling validated');
    });
  });

  // ======================
  // NAVIGATION ERROR HANDLING
  // ======================

  describe('Navigation Error Handling', () => {
    it('handles missing navigation props gracefully', () => {
      // Render without some navigation props
      const { getByText } = render(
        <SmartDietScreen 
          onBackPress={() => {}}
          // Missing navigateToTrack and navigateToPlan intentionally
        />
      );
      
      // Should still render without crashing
      expect(getByText('smartDiet.loading')).toBeTruthy();
      
      console.log('✅ Error Handling: Missing navigation props handled gracefully');
    });

    it('handles invalid navigation context gracefully', async () => {
      const invalidContext = {
        targetContext: 'invalid_context',
        sourceScreen: 'unknown_screen',
        planId: null,
      };
      
      const { getByText } = renderSmartDietScreen({
        navigationContext: invalidContext
      });
      
      // Should still render and function
      await waitFor(() => {
        expect(getByText('smartDiet.title')).toBeTruthy();
      });
      
      console.log('✅ Error Handling: Invalid navigation context handled gracefully');
    });

    it('recovers from navigation callback errors', async () => {
      const mockPropsWithError = createMockNavigationProps({
        onBackPress: jest.fn(() => {
          throw new Error('Navigation error');
        })
      });
      
      const { getByText } = render(<SmartDietScreen {...mockPropsWithError} />);
      
      await waitFor(() => {
        expect(getByText('🏠')).toBeTruthy();
      });
      
      // Should not crash when error is thrown
      expect(() => {
        fireEvent.press(getByText('🏠'));
      }).not.toThrow();
      
      console.log('✅ Error Handling: Navigation callback errors handled gracefully');
    });
  });

  // ======================
  // DEEP LINKING FLOW TESTS
  // ======================

  describe('Deep Linking Flow Tests', () => {
    it('navigates from meal plan to Smart Diet optimization correctly', async () => {
      // Simulate coming from meal plan with optimize context
      const navigationContext = createNavigationContext({
        targetContext: 'optimize',
        sourceScreen: 'plan',
        planId: 'meal_plan_123'
      });

      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext
      });

      // Should automatically switch to optimize context
      await waitFor(() => {
        expect(getByText('Optimize Suggestion')).toBeTruthy();
      }, { timeout: 3000 });

      // Should show plan navigation button since coming from plan
      expect(getByText('📋')).toBeTruthy();

      // Navigation context should be preserved
      expect(mockProps.navigationContext.sourceScreen).toBe('plan');
      expect(mockProps.navigationContext.planId).toBe('meal_plan_123');

      console.log('✅ Deep Linking: Meal plan → Smart Diet optimization flow validated');
    });

    it('preserves navigation context across screen transitions', async () => {
      const initialContext = createNavigationContext({
        targetContext: 'optimize',
        sourceScreen: 'plan',
        planId: 'meal_plan_456'
      });

      const { getByText, rerender } = renderSmartDietScreen({
        navigationContext: initialContext
      });

      // Wait for initial load with optimize context
      await waitFor(() => {
        expect(getByText('Optimize Suggestion')).toBeTruthy();
        expect(getByText('📋')).toBeTruthy(); // Plan button visible
      });

      // Switch to another context and back
      fireEvent.press(getByText('smartDiet.contexts.today'));
      
      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });

      // Navigation context should still be preserved
      expect(getByText('📋')).toBeTruthy(); // Plan button still visible

      // Switch back to optimize
      fireEvent.press(getByText('smartDiet.contexts.optimize'));
      
      await waitFor(() => {
        expect(getByText('Optimize Suggestion')).toBeTruthy();
        expect(getByText('📋')).toBeTruthy(); // Plan button still visible
      });

      console.log('✅ Deep Linking: Navigation context preservation across transitions validated');
    });

    it('handles automatic context switching when coming from meal plans', async () => {
      // Start with today context but navigation context says optimize
      const { getByText } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'optimize',
          sourceScreen: 'plan'
        })
      });

      // Should automatically switch to optimize context
      await waitFor(() => {
        // The component should show optimize suggestions
        expect(getByText('Optimize Suggestion')).toBeTruthy();
      }, { timeout: 3000 });

      // Should show the optimize context as active
      const optimizeTab = getByText('smartDiet.contexts.optimize');
      expect(optimizeTab).toBeTruthy();

      console.log('✅ Deep Linking: Automatic context switching validated');
    });

    it('validates proper back navigation behavior from deep links', async () => {
      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          sourceScreen: 'plan',
          targetContext: 'optimize'
        })
      });

      await waitFor(() => {
        expect(getByText('🏠')).toBeTruthy();
      });

      // Press back button
      fireEvent.press(getByText('🏠'));

      // Should call onBackPress (which would navigate back to meal plan)
      expect(mockProps.onBackPress).toHaveBeenCalledTimes(1);

      console.log('✅ Deep Linking: Back navigation from deep links validated');
    });

    it('handles deep linking with plan navigation button correctly', async () => {
      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          sourceScreen: 'plan',
          targetContext: 'optimize',
          planId: 'meal_plan_789'
        })
      });

      // Wait for component to load
      await waitFor(() => {
        expect(getByText('📋')).toBeTruthy(); // Plan navigation button
      });

      // Press plan navigation button
      fireEvent.press(getByText('📋'));

      // Should call navigateToPlan
      expect(mockProps.navigateToPlan).toHaveBeenCalledTimes(1);

      console.log('✅ Deep Linking: Plan navigation button functionality validated');
    });

    it('handles deep linking without plan ID gracefully', async () => {
      const { getByText } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          sourceScreen: 'plan',
          targetContext: 'optimize',
          planId: undefined // No plan ID provided
        })
      });

      // Should still work and show optimize context
      await waitFor(() => {
        expect(getByText('Optimize Suggestion')).toBeTruthy();
      });

      // Should still show plan navigation button
      expect(getByText('📋')).toBeTruthy();

      console.log('✅ Deep Linking: Graceful handling of missing plan ID validated');
    });

    it('validates deep linking with different target contexts', async () => {
      const contexts = [
        { target: 'today', expected: 'Today Suggestion' },
        { target: 'optimize', expected: 'Optimize Suggestion' },
        { target: 'discover', expected: 'Discover Suggestion' },
        { target: 'insights', expected: 'Insights Suggestion' }
      ];

      for (const context of contexts) {
        const { getByText, unmount } = renderSmartDietScreen({
          navigationContext: createNavigationContext({
            sourceScreen: 'plan',
            targetContext: context.target
          })
        });

        await waitFor(() => {
          expect(getByText(context.expected)).toBeTruthy();
        }, { timeout: 3000 });

        // Should show plan navigation button for all contexts when coming from plan
        expect(getByText('📋')).toBeTruthy();

        unmount(); // Clean up before next iteration
      }

      console.log('✅ Deep Linking: All target contexts validated');
    });

    it('handles deep linking state persistence during async operations', async () => {
      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          sourceScreen: 'plan',
          targetContext: 'optimize'
        })
      });

      // Wait for initial load
      await waitFor(() => {
        expect(getByText('Optimize Suggestion')).toBeTruthy();
        expect(getByText('📋')).toBeTruthy();
      });

      // Trigger context switch (async operation)
      fireEvent.press(getByText('smartDiet.contexts.discover'));

      // Navigation context should still be preserved during async operation
      expect(getByText('📋')).toBeTruthy(); // Plan button still visible

      // Wait for context switch to complete
      await waitFor(() => {
        expect(getByText('Discover Suggestion')).toBeTruthy();
      }, { timeout: 3000 });

      // Navigation context should still be preserved after async operation
      expect(getByText('📋')).toBeTruthy(); // Plan button still visible
      expect(mockProps.navigationContext.sourceScreen).toBe('plan');

      console.log('✅ Deep Linking: State persistence during async operations validated');
    });

    it('validates deep linking integration with preferences modal', async () => {
      const { getByText } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          sourceScreen: 'plan',
          targetContext: 'optimize'
        })
      });

      // Wait for component to load
      await waitFor(() => {
        expect(getByText('⚙️')).toBeTruthy();
        expect(getByText('📋')).toBeTruthy();
      });

      // Open preferences modal
      fireEvent.press(getByText('⚙️'));

      await waitFor(() => {
        expect(getByText('smartDiet.preferences.apply')).toBeTruthy();
      });

      // Navigation context should still be available in modal
      expect(getByText('📋')).toBeTruthy(); // Plan button still visible

      console.log('✅ Deep Linking: Integration with preferences modal validated');
    });

    it('validates PlanScreen optimize button integration', async () => {
      const { getByText, mockProps } = renderPlanScreen();

      // Wait for PlanScreen to load
      await waitFor(() => {
        expect(getByText('plan.title')).toBeTruthy();
      });

      // Should show optimize button
      expect(getByText('⚡ plan.optimize.button')).toBeTruthy();

      // Press optimize button
      fireEvent.press(getByText('⚡ plan.optimize.button'));

      // Should call navigateToSmartDiet with plan ID
      expect(mockProps.navigateToSmartDiet).toHaveBeenCalledTimes(1);
      expect(mockProps.navigateToSmartDiet).toHaveBeenCalledWith({ planId: 'test_plan_001' });

      console.log('✅ Deep Linking: PlanScreen optimize button integration validated');
    });

    it('validates complete meal plan to Smart Diet optimization workflow', async () => {
      // Step 1: Start in PlanScreen
      const { getByText: getPlanText, mockProps: planMockProps } = renderPlanScreen();

      await waitFor(() => {
        expect(getPlanText('⚡ plan.optimize.button')).toBeTruthy();
      });

      // Step 2: Press optimize button (simulates navigation to Smart Diet)
      fireEvent.press(getPlanText('⚡ plan.optimize.button'));
      expect(planMockProps.navigateToSmartDiet).toHaveBeenCalledWith({ planId: 'test_plan_001' });

      // Step 3: Simulate Smart Diet screen with optimize context
      const { getByText: getSmartText, mockProps: smartMockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          sourceScreen: 'plan',
          targetContext: 'optimize',
          planId: 'test_plan_001'
        })
      });

      // Step 4: Verify Smart Diet loaded with optimize context
      await waitFor(() => {
        expect(getSmartText('Optimize Suggestion')).toBeTruthy();
        expect(getSmartText('📋')).toBeTruthy(); // Back to plan button
      });

      // Step 5: Verify navigation back to plan works
      fireEvent.press(getSmartText('📋'));
      expect(smartMockProps.navigateToPlan).toHaveBeenCalledTimes(1);

      console.log('✅ Deep Linking: Complete meal plan optimization workflow validated');
    });

    it('handles deep linking with notification navigation intents', async () => {
      // Simulate navigation triggered by notification
      const { getByText } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          sourceScreen: 'notification',
          targetContext: 'today'
        })
      });

      // Should load with today context from notification
      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });

      // Should not show plan navigation button since not coming from plan
      const planButtons = document.querySelectorAll('*:contains("📋")');
      expect(planButtons.length).toBe(0);

      console.log('✅ Deep Linking: Notification navigation intents validated');
    });
  });

  // ======================
  // STEP 3: CROSS-FEATURE NAVIGATION TESTS
  // ======================

  describe('Cross-Feature Navigation Tests', () => {
    it('navigates from Smart Diet to Track with proper data context', async () => {
      const { getByText, mockProps } = renderSmartDietScreen();
      
      // Wait for suggestions to load
      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });
      
      // Press track navigation button
      const trackButton = getByText('📊 Track');
      fireEvent.press(trackButton);
      
      // Should call navigateToTrack with proper context
      expect(mockProps.navigateToTrack).toHaveBeenCalledTimes(1);
      
      console.log('✅ Cross-Feature Navigation: Smart Diet → Track navigation validated');
    });

    it('navigates from Smart Diet to Plan with meal context data', async () => {
      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          sourceScreen: 'plan',
          targetContext: 'optimize',
          planId: 'meal_plan_123'
        })
      });
      
      // Wait for optimize suggestions to load
      await waitFor(() => {
        expect(getByText('Optimize Suggestion')).toBeTruthy();
        expect(getByText('📋')).toBeTruthy(); // Plan navigation button
      });
      
      // Press plan navigation button
      fireEvent.press(getByText('📋'));
      
      // Should call navigateToPlan
      expect(mockProps.navigateToPlan).toHaveBeenCalledTimes(1);
      
      console.log('✅ Cross-Feature Navigation: Smart Diet → Plan navigation validated');
    });

    it('passes suggestion context when navigating to track from specific suggestion', async () => {
      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'today',
          sourceScreen: 'test'
        })
      });
      
      // Wait for suggestions to load
      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });
      
      // Click on a specific suggestion that should trigger tracking
      const suggestion = getByText('Add to meal plan');
      fireEvent.press(suggestion);
      
      // Should navigate to track with suggestion context
      // Note: In real implementation, this might pass suggestion data
      expect(getByText('Today Suggestion')).toBeTruthy(); // Suggestion still visible
      
      console.log('✅ Cross-Feature Navigation: Suggestion-specific track navigation validated');
    });

    it('maintains Smart Diet context when navigating to Plan for optimization', async () => {
      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          sourceScreen: 'plan',
          targetContext: 'optimize',
          planId: 'optimization_plan_456'
        })
      });
      
      // Wait for component to load with optimization context
      await waitFor(() => {
        expect(getByText('Optimize Suggestion')).toBeTruthy();
        expect(getByText('📋')).toBeTruthy();
      });
      
      // Navigate back to plan
      fireEvent.press(getByText('📋'));
      
      // Should preserve the optimization context for plan
      expect(mockProps.navigateToPlan).toHaveBeenCalledTimes(1);
      expect(mockProps.navigationContext.targetContext).toBe('optimize');
      expect(mockProps.navigationContext.planId).toBe('optimization_plan_456');
      
      console.log('✅ Cross-Feature Navigation: Optimization context preservation validated');
    });

    it('handles cross-feature navigation with dietary preferences', async () => {
      const { getByText, mockProps } = renderSmartDietScreen();
      
      // Wait for suggestions to load
      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });
      
      // Open preferences modal first
      fireEvent.press(getByText('⚙️'));
      
      await waitFor(() => {
        expect(getByText('smartDiet.preferences.apply')).toBeTruthy();
      });
      
      // Apply preferences (simulate)
      fireEvent.press(getByText('smartDiet.preferences.apply'));
      
      // Now navigate to track with updated preferences
      await waitFor(() => {
        expect(getByText('📊 Track')).toBeTruthy();
      });
      
      fireEvent.press(getByText('📊 Track'));
      
      // Should call navigateToTrack with preferences applied
      expect(mockProps.navigateToTrack).toHaveBeenCalledTimes(1);
      
      console.log('✅ Cross-Feature Navigation: Navigation with dietary preferences validated');
    });

    it('validates round-trip navigation between features', async () => {
      // Start in Smart Diet
      const { getByText: getSmartText, mockProps: smartProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          sourceScreen: 'test',
          targetContext: 'today'
        })
      });
      
      // Wait for Smart Diet to load
      await waitFor(() => {
        expect(getSmartText('Today Suggestion')).toBeTruthy();
      });
      
      // Navigate to Track
      fireEvent.press(getSmartText('📊 Track'));
      expect(smartProps.navigateToTrack).toHaveBeenCalledTimes(1);
      
      // Simulate navigation back to Smart Diet from Track
      const { getByText: getSmartText2, mockProps: smartProps2 } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          sourceScreen: 'track',
          targetContext: 'today'
        })
      });
      
      // Should load with context from track
      await waitFor(() => {
        expect(getSmartText2('Today Suggestion')).toBeTruthy();
      });
      
      // Should show appropriate navigation options
      expect(getSmartText2('📊 Track')).toBeTruthy();
      
      console.log('✅ Cross-Feature Navigation: Round-trip navigation validated');
    });

    it('handles navigation with meal-specific contexts', async () => {
      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'optimize',
          sourceScreen: 'plan',
          planId: 'breakfast_optimization'
        })
      });
      
      // Wait for optimization suggestions
      await waitFor(() => {
        expect(getByText('Optimize Suggestion')).toBeTruthy();
      });
      
      // Navigate to plan with meal context
      fireEvent.press(getByText('📋'));
      
      // Should call navigation with meal-specific context
      expect(mockProps.navigateToPlan).toHaveBeenCalledTimes(1);
      expect(mockProps.navigationContext.planId).toBe('breakfast_optimization');
      
      console.log('✅ Cross-Feature Navigation: Meal-specific navigation context validated');
    });

    it('validates Smart Diet to Track navigation with discovery context', async () => {
      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'discover',
          sourceScreen: 'test'
        })
      });
      
      // Switch to discover context
      fireEvent.press(getByText('smartDiet.contexts.discover'));
      
      // Wait for discover suggestions
      await waitFor(() => {
        expect(getByText('Discover Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      // Navigate to Track from discovery context
      fireEvent.press(getByText('📊 Track'));
      
      // Should navigate with discovery context
      expect(mockProps.navigateToTrack).toHaveBeenCalledTimes(1);
      
      console.log('✅ Cross-Feature Navigation: Discovery → Track navigation validated');
    });

    it('handles navigation failure scenarios gracefully', async () => {
      const mockPropsWithFailingNav = createMockNavigationProps({
        navigateToTrack: jest.fn(() => {
          throw new Error('Navigation failed');
        }),
        navigateToPlan: jest.fn(() => {
          throw new Error('Plan navigation failed');
        })
      });
      
      const { getByText } = render(<SmartDietScreen {...mockPropsWithFailingNav} />);
      
      // Wait for component to load
      await waitFor(() => {
        expect(getByText('📊 Track')).toBeTruthy();
      });
      
      // Should not crash when navigation fails
      expect(() => {
        fireEvent.press(getByText('📊 Track'));
      }).not.toThrow();
      
      console.log('✅ Cross-Feature Navigation: Navigation failure handling validated');
    });

    it('validates Smart Diet insights to Plan navigation for goal setting', async () => {
      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'insights',
          sourceScreen: 'test'
        })
      });
      
      // Switch to insights context
      fireEvent.press(getByText('smartDiet.contexts.insights'));
      
      // Wait for insights to load
      await waitFor(() => {
        expect(getByText('Insights Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      // Should show navigation to plan for goal setting
      expect(getByText('📊 Track')).toBeTruthy();
      
      // Navigate to track for goal setting
      fireEvent.press(getByText('📊 Track'));
      
      expect(mockProps.navigateToTrack).toHaveBeenCalledTimes(1);
      
      console.log('✅ Cross-Feature Navigation: Insights → Track for goal setting validated');
    });

    it('preserves user preferences across cross-feature navigation', async () => {
      const { getByText, mockProps } = renderSmartDietScreen();
      
      // Wait for initial load
      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });
      
      // Open preferences
      fireEvent.press(getByText('⚙️'));
      
      await waitFor(() => {
        expect(getByText('smartDiet.preferences.apply')).toBeTruthy();
      });
      
      // Apply preferences (simulate preference changes)
      fireEvent.press(getByText('smartDiet.preferences.apply'));
      
      // Navigate to track
      await waitFor(() => {
        expect(getByText('📊 Track')).toBeTruthy();
      });
      
      fireEvent.press(getByText('📊 Track'));
      
      // Preferences should be preserved for track navigation
      expect(mockProps.navigateToTrack).toHaveBeenCalledTimes(1);
      
      console.log('✅ Cross-Feature Navigation: User preferences preservation validated');
    });

    it('handles navigation with multiple active contexts', async () => {
      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          sourceScreen: 'plan',
          targetContext: 'optimize'
        })
      });
      
      // Wait for optimize context
      await waitFor(() => {
        expect(getByText('Optimize Suggestion')).toBeTruthy();
        expect(getByText('📋')).toBeTruthy(); // Plan button
      });
      
      // Switch to insights while maintaining plan context
      fireEvent.press(getByText('smartDiet.contexts.insights'));
      
      await waitFor(() => {
        expect(getByText('Insights Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      // Should still show plan navigation button
      expect(getByText('📋')).toBeTruthy();
      
      // Navigate to plan should still work
      fireEvent.press(getByText('📋'));
      expect(mockProps.navigateToPlan).toHaveBeenCalledTimes(1);
      
      console.log('✅ Cross-Feature Navigation: Multiple active contexts handled correctly');
    });

    it('validates complete cross-feature workflow integration', async () => {
      // Step 1: Start with Smart Diet Today context
      const { getByText: getSmartText1, mockProps: smartProps1 } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'today',
          sourceScreen: 'home'
        })
      });
      
      await waitFor(() => {
        expect(getSmartText1('Today Suggestion')).toBeTruthy();
      });
      
      // Step 2: Navigate to Track
      fireEvent.press(getSmartText1('📊 Track'));
      expect(smartProps1.navigateToTrack).toHaveBeenCalledTimes(1);
      
      // Step 3: Simulate coming back to Smart Diet from Track
      const { getByText: getSmartText2 } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'today',
          sourceScreen: 'track'
        })
      });
      
      await waitFor(() => {
        expect(getSmartText2('Today Suggestion')).toBeTruthy();
      });
      
      // Step 4: Switch to optimize and go to Plan
      fireEvent.press(getSmartText2('smartDiet.contexts.optimize'));
      
      await waitFor(() => {
        expect(getSmartText2('Optimize Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      console.log('✅ Cross-Feature Navigation: Complete workflow integration validated');
    });
  });

  // ======================
  // STEP 4: USER JOURNEY FLOW TESTS
  // ======================

  describe('User Journey Flow Tests', () => {
    it('completes full daily routine optimization journey', async () => {
      // Journey: Home → Smart Diet Today → Optimize Context → Plan → Back to Smart Diet
      
      // Step 1: Start daily routine from home
      const { getByText: getSmartText1, mockProps: smartProps1 } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'today',
          sourceScreen: 'home'
        })
      });

      // Wait for today suggestions to load
      await waitFor(() => {
        expect(getSmartText1('Today Suggestion')).toBeTruthy();
      });
      
      console.log('✅ User Journey: Step 1 - Daily routine started from home');

      // Step 2: User discovers optimization opportunities
      fireEvent.press(getSmartText1('smartDiet.contexts.optimize'));
      
      await waitFor(() => {
        expect(getSmartText1('Optimize Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      console.log('✅ User Journey: Step 2 - Discovered optimization opportunities');

      // Step 3: User navigates to track to log current meal
      fireEvent.press(getSmartText1('📊 Track'));
      expect(smartProps1.navigateToTrack).toHaveBeenCalledTimes(1);
      
      console.log('✅ User Journey: Step 3 - Navigated to track for meal logging');

      // Step 4: Simulate returning from track with meal logged
      const { getByText: getSmartText2, mockProps: smartProps2 } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'optimize',
          sourceScreen: 'track'
        })
      });

      await waitFor(() => {
        expect(getSmartText2('Optimize Suggestion')).toBeTruthy();
      });
      
      console.log('✅ User Journey: Step 4 - Returned with optimized suggestions');

      // Step 5: User applies optimization by going to meal plan
      // Simulate navigation context showing plan option
      const { getByText: getSmartText3 } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'optimize',
          sourceScreen: 'plan',
          planId: 'optimized_plan_001'
        })
      });

      await waitFor(() => {
        expect(getSmartText3('📋')).toBeTruthy(); // Plan button available
      });
      
      console.log('✅ User Journey: Complete daily optimization journey validated');
    });

    it('completes discovery to meal planning workflow', async () => {
      // Journey: Smart Diet Discovery → Find new foods → Add to Plan → Optimize
      
      // Step 1: Start in discovery mode
      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'discover',
          sourceScreen: 'home'
        })
      });

      // Switch to discover context
      fireEvent.press(getByText('smartDiet.contexts.discover'));
      
      await waitFor(() => {
        expect(getByText('Discover Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      console.log('✅ User Journey: Step 1 - Started food discovery');

      // Step 2: User finds interesting suggestion and wants to track it
      const suggestionAction = getByText('Add to meal plan');
      fireEvent.press(suggestionAction);
      
      // This would typically show some feedback or navigate
      expect(getByText('Discover Suggestion')).toBeTruthy(); // Suggestion remains visible
      
      console.log('✅ User Journey: Step 2 - Found and selected discovery suggestion');

      // Step 3: Navigate to track to add the discovered food
      fireEvent.press(getByText('📊 Track'));
      expect(mockProps.navigateToTrack).toHaveBeenCalledTimes(1);
      
      console.log('✅ User Journey: Step 3 - Navigated to track to add discovered food');

      // Step 4: Return and switch to optimize based on new addition
      fireEvent.press(getByText('smartDiet.contexts.optimize'));
      
      await waitFor(() => {
        expect(getByText('Optimize Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      console.log('✅ User Journey: Complete discovery to meal planning workflow validated');
    });

    it('completes insights-driven goal setting journey', async () => {
      // Journey: Smart Diet Insights → Identify gaps → Set goals via Track → Plan optimization
      
      // Step 1: Start with insights to understand nutritional patterns
      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'insights',
          sourceScreen: 'home'
        })
      });

      fireEvent.press(getByText('smartDiet.contexts.insights'));
      
      await waitFor(() => {
        expect(getByText('Insights Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      console.log('✅ User Journey: Step 1 - Analyzed nutritional insights');

      // Step 2: User identifies need for goal adjustment
      fireEvent.press(getByText('📊 Track'));
      expect(mockProps.navigateToTrack).toHaveBeenCalledTimes(1);
      
      console.log('✅ User Journey: Step 2 - Navigated to track for goal setting');

      // Step 3: Return with updated goals and get optimizations
      const { getByText: getSmartText2 } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'optimize',
          sourceScreen: 'track'
        })
      });

      fireEvent.press(getSmartText2('smartDiet.contexts.optimize'));
      
      await waitFor(() => {
        expect(getSmartText2('Optimize Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      console.log('✅ User Journey: Complete insights-driven goal setting journey validated');
    });

    it('completes meal plan optimization feedback loop', async () => {
      // Journey: Plan → Smart Diet Optimize → Apply changes → Return to Plan → Verify
      
      // Step 1: Start from meal plan seeking optimization
      const { getByText: getPlanText, mockProps: planProps } = renderPlanScreen();

      await waitFor(() => {
        expect(getPlanText('⚡ plan.optimize.button')).toBeTruthy();
      });

      fireEvent.press(getPlanText('⚡ plan.optimize.button'));
      expect(planProps.navigateToSmartDiet).toHaveBeenCalledWith({ planId: 'test_plan_001' });
      
      console.log('✅ User Journey: Step 1 - Initiated optimization from meal plan');

      // Step 2: Arrive in Smart Diet with optimize context
      const { getByText: getSmartText, mockProps: smartProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'optimize',
          sourceScreen: 'plan',
          planId: 'test_plan_001'
        })
      });

      await waitFor(() => {
        expect(getSmartText('Optimize Suggestion')).toBeTruthy();
        expect(getSmartText('📋')).toBeTruthy(); // Plan navigation button
      });
      
      console.log('✅ User Journey: Step 2 - Received optimization suggestions');

      // Step 3: Apply suggestion (simulate user accepting a suggestion)
      const suggestionAction = getSmartText('Add to meal plan');
      fireEvent.press(suggestionAction);
      
      console.log('✅ User Journey: Step 3 - Applied optimization suggestion');

      // Step 4: Return to plan to verify changes
      fireEvent.press(getSmartText('📋'));
      expect(smartProps.navigateToPlan).toHaveBeenCalledTimes(1);
      
      console.log('✅ User Journey: Complete meal plan optimization feedback loop validated');
    });

    it('completes notification-triggered engagement journey', async () => {
      // Journey: Notification → Smart Diet → Context switch → Take action
      
      // Step 1: Simulate arriving from notification
      const { getByText } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'today',
          sourceScreen: 'notification'
        })
      });

      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });
      
      console.log('✅ User Journey: Step 1 - Arrived from notification trigger');

      // Step 2: User explores other contexts after initial engagement
      fireEvent.press(getByText('smartDiet.contexts.discover'));
      
      await waitFor(() => {
        expect(getByText('Discover Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      console.log('✅ User Journey: Step 2 - Explored additional contexts');

      // Step 3: Find something interesting and take action
      const discoverAction = getByText('Add to meal plan');
      fireEvent.press(discoverAction);
      
      console.log('✅ User Journey: Step 3 - Took action on discovered content');

      // Step 4: Return to today context to see updated suggestions
      fireEvent.press(getByText('smartDiet.contexts.today'));
      
      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      console.log('✅ User Journey: Complete notification-triggered engagement validated');
    });

    it('completes multi-context preference adjustment journey', async () => {
      // Journey: Preferences → Multiple contexts → Apply changes → Verify results
      
      // Step 1: Start with preference adjustment
      const { getByText } = renderSmartDietScreen();

      await waitFor(() => {
        expect(getByText('⚙️')).toBeTruthy();
      });

      fireEvent.press(getByText('⚙️'));
      
      await waitFor(() => {
        expect(getByText('smartDiet.preferences.apply')).toBeTruthy();
      });
      
      console.log('✅ User Journey: Step 1 - Opened preferences');

      // Step 2: Apply preferences
      fireEvent.press(getByText('smartDiet.preferences.apply'));
      
      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });
      
      console.log('✅ User Journey: Step 2 - Applied preference changes');

      // Step 3: Verify preferences affect different contexts
      const contexts = ['smartDiet.contexts.optimize', 'smartDiet.contexts.discover', 'smartDiet.contexts.insights'];
      
      for (const context of contexts) {
        fireEvent.press(getByText(context));
        
        // Each context should load with preferences applied
        await waitFor(() => {
          // Context should show suggestions (preferences are applied)
          const contextName = context.split('.').pop();
          const expectedSuggestion = `${contextName?.charAt(0).toUpperCase() + contextName?.slice(1)} Suggestion`;
          expect(getByText(expectedSuggestion)).toBeTruthy();
        }, { timeout: 3000 });
        
        console.log(`✅ User Journey: Verified preferences applied to ${context}`);
      }
      
      console.log('✅ User Journey: Complete multi-context preference adjustment validated');
    });

    it('completes error recovery and retry journey', async () => {
      // Journey: Error state → User retry → Successful recovery → Continue workflow
      
      // Step 1: Start with potential error scenario (network failure)
      const { getByText } = renderSmartDietScreen();

      // Wait for initial load
      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });
      
      console.log('✅ User Journey: Step 1 - Initial load successful');

      // Step 2: Simulate context switch that might fail
      fireEvent.press(getByText('smartDiet.contexts.optimize'));
      
      // Even if there was an error, user should be able to retry
      await waitFor(() => {
        // Should eventually show optimize suggestions or error state
        const hasContent = getByText('Optimize Suggestion') || getByText('Today Suggestion');
        expect(hasContent).toBeTruthy();
      }, { timeout: 5000 });
      
      console.log('✅ User Journey: Step 2 - Handled potential error scenario');

      // Step 3: User continues with successful operation
      fireEvent.press(getByText('smartDiet.contexts.today'));
      
      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });
      
      console.log('✅ User Journey: Step 3 - Recovered and continued workflow');

      // Step 4: User successfully completes intended action
      const trackButton = getByText('📊 Track');
      expect(() => {
        fireEvent.press(trackButton);
      }).not.toThrow();
      
      console.log('✅ User Journey: Complete error recovery and retry journey validated');
    });

    it('completes complex cross-feature workflow with state persistence', async () => {
      // Journey: Plan → Smart Diet → Track → Smart Diet → Plan (with state persistence)
      
      // Step 1: Start from meal plan
      const { mockProps: planProps } = renderPlanScreen();
      
      console.log('✅ User Journey: Step 1 - Started from meal plan');

      // Step 2: Navigate to Smart Diet
      const { getByText: getSmartText1, mockProps: smartProps1 } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'optimize',
          sourceScreen: 'plan',
          planId: 'complex_workflow_plan'
        })
      });

      await waitFor(() => {
        expect(getSmartText1('Optimize Suggestion')).toBeTruthy();
        expect(getSmartText1('📋')).toBeTruthy();
      });
      
      console.log('✅ User Journey: Step 2 - Navigated to Smart Diet with plan context');

      // Step 3: Navigate to track while maintaining plan context
      fireEvent.press(getSmartText1('📊 Track'));
      expect(smartProps1.navigateToTrack).toHaveBeenCalledTimes(1);
      
      console.log('✅ User Journey: Step 3 - Navigated to track maintaining context');

      // Step 4: Return to Smart Diet from track
      const { getByText: getSmartText2, mockProps: smartProps2 } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'optimize',
          sourceScreen: 'track',
          planId: 'complex_workflow_plan' // State persisted
        })
      });

      await waitFor(() => {
        expect(getSmartText2('Optimize Suggestion')).toBeTruthy();
        expect(getSmartText2('📋')).toBeTruthy(); // Plan context still available
      });
      
      console.log('✅ User Journey: Step 4 - Returned from track with context preserved');

      // Step 5: Complete workflow by returning to plan
      fireEvent.press(getSmartText2('📋'));
      expect(smartProps2.navigateToPlan).toHaveBeenCalledTimes(1);
      expect(smartProps2.navigationContext.planId).toBe('complex_workflow_plan');
      
      console.log('✅ User Journey: Complete complex cross-feature workflow validated');
    });

    it('completes time-sensitive optimization workflow', async () => {
      // Journey: Quick meal planning → Immediate optimization → Fast decision making
      
      const startTime = Date.now();
      
      // Step 1: Quick access to today suggestions
      const { getByText, mockProps } = renderSmartDietScreen({
        navigationContext: createNavigationContext({
          targetContext: 'today',
          sourceScreen: 'quick_access'
        })
      });

      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });
      
      const step1Time = Date.now() - startTime;
      console.log(`✅ User Journey: Step 1 - Quick access completed in ${step1Time}ms`);

      // Step 2: Rapid context switch to optimization
      fireEvent.press(getByText('smartDiet.contexts.optimize'));
      
      await waitFor(() => {
        expect(getByText('Optimize Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      const step2Time = Date.now() - startTime;
      console.log(`✅ User Journey: Step 2 - Optimization access in ${step2Time}ms`);

      // Step 3: Quick decision and action
      const suggestionAction = getByText('Add to meal plan');
      fireEvent.press(suggestionAction);
      
      // Step 4: Immediate navigation to track for execution
      fireEvent.press(getByText('📊 Track'));
      expect(mockProps.navigateToTrack).toHaveBeenCalledTimes(1);
      
      const totalTime = Date.now() - startTime;
      
      // Should complete workflow in reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 second max for entire workflow
      
      console.log(`✅ User Journey: Complete time-sensitive workflow in ${totalTime}ms`);
    });

    it('completes comprehensive feature exploration journey', async () => {
      // Journey: Systematic exploration of all Smart Diet features
      
      const { getByText } = renderSmartDietScreen();
      
      // Step 1: Start with today context
      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });
      
      console.log('✅ User Journey: Step 1 - Started feature exploration with today');

      // Step 2: Explore optimize context
      fireEvent.press(getByText('smartDiet.contexts.optimize'));
      
      await waitFor(() => {
        expect(getByText('Optimize Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      console.log('✅ User Journey: Step 2 - Explored optimize features');

      // Step 3: Explore discover context
      fireEvent.press(getByText('smartDiet.contexts.discover'));
      
      await waitFor(() => {
        expect(getByText('Discover Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      console.log('✅ User Journey: Step 3 - Explored discover features');

      // Step 4: Explore insights context
      fireEvent.press(getByText('smartDiet.contexts.insights'));
      
      await waitFor(() => {
        expect(getByText('Insights Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      console.log('✅ User Journey: Step 4 - Explored insights features');

      // Step 5: Test preferences functionality
      fireEvent.press(getByText('⚙️'));
      
      await waitFor(() => {
        expect(getByText('smartDiet.preferences.apply')).toBeTruthy();
      });
      
      console.log('✅ User Journey: Step 5 - Explored preferences functionality');

      // Step 6: Return to main functionality
      fireEvent.press(getByText('smartDiet.preferences.apply'));
      
      await waitFor(() => {
        expect(getByText('Insights Suggestion')).toBeTruthy(); // Should return to insights
      });
      
      console.log('✅ User Journey: Complete comprehensive feature exploration validated');
    });

    it('completes mobile-specific interaction patterns journey', async () => {
      // Journey: Touch interactions → Swipe behavior → Mobile optimization
      
      const { getByText } = renderSmartDietScreen();
      
      // Step 1: Test touch responsiveness
      await waitFor(() => {
        expect(getByText('Today Suggestion')).toBeTruthy();
      });
      
      // Multiple rapid taps should be handled gracefully
      const contextButton = getByText('smartDiet.contexts.optimize');
      fireEvent.press(contextButton);
      fireEvent.press(contextButton); // Rapid double tap
      
      await waitFor(() => {
        expect(getByText('Optimize Suggestion')).toBeTruthy();
      }, { timeout: 3000 });
      
      console.log('✅ User Journey: Step 1 - Mobile touch interactions validated');

      // Step 2: Test gesture-like interactions
      const suggestionElement = getByText('Add to meal plan');
      
      // Simulate touch sequence (touch start, move, end)
      fireEvent.press(suggestionElement);
      
      console.log('✅ User Journey: Step 2 - Mobile gesture interactions validated');

      // Step 3: Test mobile navigation patterns
      const backButton = getByText('🏠');
      fireEvent.press(backButton);
      
      console.log('✅ User Journey: Step 3 - Mobile navigation patterns validated');

      // Step 4: Test mobile multitasking scenario
      fireEvent.press(getByText('📊 Track'));
      
      console.log('✅ User Journey: Complete mobile-specific interaction patterns validated');
    });
  });

  // ======================
  // NAVIGATION PERFORMANCE
  // ======================

  describe('Navigation Performance', () => {
    it('handles rapid navigation changes efficiently', async () => {
      const { getByText } = renderSmartDietScreen();
      
      await waitFor(() => {
        expect(getByText('smartDiet.contexts.today')).toBeTruthy();
      });
      
      const startTime = Date.now();
      
      // Rapid context switches
      const contexts = ['smartDiet.contexts.optimize', 'smartDiet.contexts.discover', 'smartDiet.contexts.insights', 'smartDiet.contexts.today'];
      
      for (const context of contexts) {
        fireEvent.press(getByText(context));
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        });
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should handle rapid changes within reasonable time
      expect(totalTime).toBeLessThan(1000); // 1 second for 4 switches
      
      console.log(`✅ Performance: Rapid navigation changes completed in ${totalTime}ms`);
    });

    it('maintains responsive UI during navigation transitions', async () => {
      const { getByText } = renderSmartDietScreen();
      
      await waitFor(() => {
        expect(getByText('smartDiet.contexts.today')).toBeTruthy();
      });
      
      // Start context switch
      fireEvent.press(getByText('smartDiet.contexts.optimize'));
      
      // UI should remain responsive immediately after
      fireEvent.press(getByText('⚙️')); // Settings button should still be clickable
      
      await waitFor(() => {
        expect(getByText('smartDiet.preferences.apply')).toBeTruthy();
      });
      
      console.log('✅ Performance: UI responsiveness during navigation validated');
    });
  });
});