/**
 * Navigation Types for DietIntel Mobile App
 * Centralized type definitions for navigation system
 */

export type ScreenType =
  | 'scanner'
  | 'upload'
  | 'plan'
  | 'track'
  | 'recommendations'
  | 'recipes'
  | 'recipe-generation'
  | 'recipe-search'
  | 'my-recipes'
  | 'recipe-detail'
  | 'taste-preferences'
  | 'shopping-optimization'
  | 'vision'
  | 'discover-feed'
  | 'profile'
  | 'profile-edit'
  | 'intelligent-flow'
  | 'login'
  | 'register'
  | 'splash'
  | 'feed'
  | 'followers-list'
  | 'following-list'
  | 'blocked-list'
  | 'blocked-by'
  | 'vision-history'
  | 'rewards';

export interface NavigationContext {
  targetContext?: string;
  sourceScreen?: string;
  planId?: string;
  recipeId?: string;
  recipeData?: any;
  selectedRecipes?: any[];
  userId?: string;
  postId?: string;
  notificationType?: string;
  backAction?: () => void;
  [key: string]: any;
}

export interface NavigationState {
  currentScreen: ScreenType;
  previousScreen?: ScreenType;
  navigationContext: NavigationContext;
  canGoBack: boolean;
  history: ScreenType[];
}

export interface NavigationAction {
  type: 'NAVIGATE_TO' | 'GO_BACK' | 'RESET_NAVIGATION' | 'UPDATE_CONTEXT';
  payload: {
    screen?: ScreenType;
    context?: NavigationContext;
    replace?: boolean;
  };
}

export interface ScreenConfig {
  component: React.ComponentType<any>;
  options?: {
    headerShown?: boolean;
    gestureEnabled?: boolean;
    presentation?: 'card' | 'modal' | 'transparent';
  };
  dependencies?: string[];
  featureFlag?: string;
}

export interface NavigationConfig {
  initialScreen: ScreenType;
  screens: Record<ScreenType, ScreenConfig>;
  transitions: Record<ScreenType, ScreenType[]>;
  featureFlags: Record<string, boolean>;
}

export interface NavigationMetrics {
  screenTransitions: Record<ScreenType, number>;
  averageTransitionTime: number;
  errorCount: number;
  lastActivity: Date;
}

export type NavigationEventType = 
  | 'SCREEN_CHANGED'
  | 'NAVIGATION_ERROR'
  | 'TRANSITION_STARTED'
  | 'TRANSITION_COMPLETED';

export interface NavigationEvent {
  type: NavigationEventType;
  screen: ScreenType;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Feature flag types
export interface FeatureFlagConfig {
  barcodeScanner: boolean;
  uploadLabelFeature: boolean;
  mealPlanFeature: boolean;
  trackingFeature: boolean;
  intelligentFlowFeature: boolean;
  reminderNotifications: boolean;
}

// Navigation hook return types
export interface UseNavigationReturn {
  navigate: (screen: ScreenType, context?: NavigationContext) => void;
  goBack: () => void;
  canGoBack: boolean;
  currentScreen: ScreenType;
  navigationContext: NavigationContext;
  reset: (screen: ScreenType, context?: NavigationContext) => void;
  getCurrentComponent?: () => Promise<any>;
  getMetrics?: () => any;
}

export interface UseScreenStateReturn {
  screen: ScreenType;
  context: NavigationContext;
  canGoBack: boolean;
  setContext: (context: NavigationContext) => void;
  goBack: () => void;
}

// Component prop types
export interface ScreenProps {
  onBackPress?: () => void;
  navigationContext?: NavigationContext;
  [key: string]: any;
}

export interface ModalScreenProps extends ScreenProps {
  onClose: () => void;
  visible: boolean;
}
