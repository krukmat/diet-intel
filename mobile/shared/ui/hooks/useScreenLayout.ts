/**
 * useScreenLayout Hook for DietIntel Mobile App
 * Manages layout state and configuration for consistent screen layouts
 */

import { useCallback, useState, useEffect } from 'react';
import { ScreenType } from '../../../core/navigation/NavigationTypes';

interface LayoutConfig {
  showHeader: boolean;
  showBackButton: boolean;
  headerTitle?: string;
  headerSubtitle?: string;
  headerBackgroundColor?: string;
  contentPadding: number;
  backgroundColor: string;
  showFooter: boolean;
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

interface UseScreenLayoutReturn {
  // Layout configuration
  layoutConfig: LayoutConfig;
  
  // Layout controls
  updateLayoutConfig: (updates: Partial<LayoutConfig>) => void;
  resetLayoutConfig: () => void;
  
  // Screen-specific configurations
  getLayoutForScreen: (screen: ScreenType) => LayoutConfig;
  applyScreenLayout: (screen: ScreenType) => void;
  
  // Layout utilities
  getCurrentLayout: () => LayoutConfig;
  isLayoutDirty: boolean;
  hasCustomLayout: boolean;
}

// Default layout configuration
const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  showHeader: true,
  showBackButton: false,
  headerTitle: undefined,
  headerSubtitle: undefined,
  headerBackgroundColor: '#007AFF',
  contentPadding: 20,
  backgroundColor: '#FFFFFF',
  showFooter: false,
  safeAreaInsets: {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  }
};

// Screen-specific layout configurations
const SCREEN_LAYOUT_CONFIGS: Record<ScreenType, Partial<LayoutConfig>> = {
  // Authentication screens
  splash: {
    showHeader: false,
    showBackButton: false,
    backgroundColor: '#007AFF',
    contentPadding: 0
  },
  login: {
    showHeader: false,
    showBackButton: false,
    contentPadding: 32
  },
  register: {
    showHeader: false,
    showBackButton: false,
    contentPadding: 32
  },

  // Core feature screens
  scanner: {
    showHeader: false,
    showBackButton: false,
    contentPadding: 0,
    backgroundColor: '#000000'
  },
  upload: {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Upload Label',
    contentPadding: 16
  },
  track: {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Track Food',
    contentPadding: 16
  },

  // Planning and recommendations
  plan: {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Meal Plans',
    contentPadding: 16
  },
  recommendations: {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Recommendations',
    contentPadding: 16
  },
  'intelligent-flow': {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Intelligent Flow',
    contentPadding: 16
  },

  // Recipe ecosystem
  recipes: {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Recipes',
    contentPadding: 16
  },
  'recipe-generation': {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Generate Recipe',
    contentPadding: 16
  },
  'recipe-search': {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Search Recipes',
    contentPadding: 16
  },
  'my-recipes': {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'My Recipes',
    contentPadding: 16
  },
  'recipe-detail': {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Recipe Details',
    contentPadding: 16
  },
  'taste-preferences': {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Taste Preferences',
    contentPadding: 16
  },
  'shopping-optimization': {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Shopping Optimization',
    contentPadding: 16
  },

  // Vision and analysis
  vision: {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Vision Analysis',
    contentPadding: 16
  },

  // Social features
  'discover-feed': {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Discover',
    contentPadding: 16
  },

  // Profile management
  profile: {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Profile',
    contentPadding: 16
  },
  'profile-edit': {
    showHeader: true,
    showBackButton: true,
    headerTitle: 'Edit Profile',
    contentPadding: 16
  }
};

/**
 * Hook for managing screen layout configuration
 */
export const useScreenLayout = (
  initialScreen?: ScreenType,
  customConfig?: Partial<LayoutConfig>
): UseScreenLayoutReturn => {
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>({
    ...DEFAULT_LAYOUT_CONFIG,
    ...customConfig
  });
  
  const [isLayoutDirty, setIsLayoutDirty] = useState(false);
  const [originalConfig] = useState({ ...layoutConfig });

  // Update layout configuration
  const updateLayoutConfig = useCallback((updates: Partial<LayoutConfig>) => {
    setLayoutConfig(prev => ({
      ...prev,
      ...updates
    }));
    setIsLayoutDirty(true);
  }, []);

  // Reset to default configuration
  const resetLayoutConfig = useCallback(() => {
    setLayoutConfig({
      ...DEFAULT_LAYOUT_CONFIG,
      ...customConfig
    });
    setIsLayoutDirty(false);
  }, [customConfig]);

  // Get layout configuration for specific screen
  const getLayoutForScreen = useCallback((screen: ScreenType): LayoutConfig => {
    const screenConfig = SCREEN_LAYOUT_CONFIGS[screen] || {};
    return {
      ...DEFAULT_LAYOUT_CONFIG,
      ...customConfig,
      ...screenConfig
    };
  }, [customConfig]);

  // Apply screen-specific layout
  const applyScreenLayout = useCallback((screen: ScreenType) => {
    const screenConfig = getLayoutForScreen(screen);
    setLayoutConfig(screenConfig);
    setIsLayoutDirty(false);
  }, [getLayoutForScreen]);

  // Get current layout configuration
  const getCurrentLayout = useCallback((): LayoutConfig => {
    return { ...layoutConfig };
  }, [layoutConfig]);

  // Check if custom layout is being used
  const hasCustomLayout = isLayoutDirty || !!customConfig;

  // Apply initial screen layout
  useEffect(() => {
    if (initialScreen) {
      applyScreenLayout(initialScreen);
    }
  }, [initialScreen, applyScreenLayout]);

  return {
    layoutConfig,
    updateLayoutConfig,
    resetLayoutConfig,
    getLayoutForScreen,
    applyScreenLayout,
    getCurrentLayout,
    isLayoutDirty,
    hasCustomLayout
  };
};

/**
 * Hook for managing dynamic layout based on screen state
 */
export const useDynamicLayout = (
  currentScreen: ScreenType,
  customConfigs?: Partial<Record<ScreenType, Partial<LayoutConfig>>>
) => {
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(() => {
    const screenConfig = customConfigs?.[currentScreen] || {};
    return {
      ...DEFAULT_LAYOUT_CONFIG,
      ...screenConfig,
      ...SCREEN_LAYOUT_CONFIGS[currentScreen]
    };
  });

  // Update layout when screen changes
  useEffect(() => {
    const screenConfig = customConfigs?.[currentScreen] || {};
    setLayoutConfig({
      ...DEFAULT_LAYOUT_CONFIG,
      ...screenConfig,
      ...SCREEN_LAYOUT_CONFIGS[currentScreen]
    });
  }, [currentScreen, customConfigs]);

  // Dynamic layout update function
  const updateLayout = useCallback((updates: Partial<LayoutConfig>) => {
    setLayoutConfig(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  return {
    layoutConfig,
    updateLayout,
    isCustom: !!customConfigs?.[currentScreen]
  };
};

/**
 * Hook for layout animations and transitions
 */
export const useLayoutAnimations = () => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);

  // Start layout animation
  const startAnimation = useCallback((duration: number = 300) => {
    setIsAnimating(true);
    setAnimationProgress(0);

    // Simple progress animation
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setAnimationProgress(progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  // Reset animation
  const resetAnimation = useCallback(() => {
    setIsAnimating(false);
    setAnimationProgress(0);
  }, []);

  return {
    isAnimating,
    animationProgress,
    startAnimation,
    resetAnimation
  };
};

export default {
  useScreenLayout,
  useDynamicLayout,
  useLayoutAnimations
};
