/**
 * Screen Registry helpers for DietIntel Mobile App
 * Logic for validation, filtering, metrics, and component loading
 */

import type { ScreenType, FeatureFlagConfig } from './NavigationTypes';
import {
  FEATURE_FLAGS,
  SCREEN_REGISTRY,
  NAVIGATION_TRANSITIONS,
  MODULE_DEPENDENCIES,
} from './ScreenRegistryConfig';

// Feature flag screen filtering
export const getScreensByFeatureFlag = (flags: FeatureFlagConfig): ScreenType[] => {
  return Object.entries(SCREEN_REGISTRY)
    .filter(([_, config]) => {
      if (!config.featureFlag) return true;
      return flags[config.featureFlag as keyof FeatureFlagConfig] || false;
    })
    .map(([screen]) => screen as ScreenType);
};

// Screen validation
export const validateScreen = (screen: ScreenType): boolean => {
  const config = SCREEN_REGISTRY[screen];
  if (!config) return false;

  if (config.featureFlag && !FEATURE_FLAGS[config.featureFlag as keyof FeatureFlagConfig]) {
    return false;
  }

  return true;
};

// Resolve a target screen with a safe fallback
export const resolveScreenTarget = (
  target: ScreenType,
  fallback: ScreenType = 'scanner'
): ScreenType => {
  return validateScreen(target) ? target : fallback;
};

// Get all valid screens
export const getAllValidScreens = (): ScreenType[] => {
  return Object.keys(SCREEN_REGISTRY).filter(validateScreen) as ScreenType[];
};

// Screen statistics for monitoring
export const getScreenStats = () => {
  const validScreens = getAllValidScreens();
  const screensWithFeatureFlags = Object.entries(SCREEN_REGISTRY)
    .filter(([_, config]) => config.featureFlag).length;

  return {
    totalScreens: Object.keys(SCREEN_REGISTRY).length,
    validScreens: validScreens.length,
    screensWithFeatureFlags,
    moduleCount: Object.keys(MODULE_DEPENDENCIES).length,
    coverage: (validScreens.length / Object.keys(SCREEN_REGISTRY).length) * 100
  };
};

// Dynamic component loader
export const loadScreenComponent = async (screen: ScreenType): Promise<any> => {
  const componentMap: Record<ScreenType, () => Promise<any>> = {
    splash: () => Promise.resolve(require('../../screens/SplashScreen')),
    login: () => Promise.resolve(require('../../screens/LoginScreen')),
    register: () => Promise.resolve(require('../../screens/RegisterScreen')),
    scanner: () => Promise.resolve(require('../../screens/TrackScreen')),
    upload: () => Promise.resolve(require('../../screens/UploadLabel')),
    track: () => Promise.resolve(require('../../screens/TrackScreen')),
    plan: () => Promise.resolve(require('../../screens/PlanScreen')),
    recommendations: () => Promise.resolve(require('../../screens/SmartDietScreen')),
    'intelligent-flow': () => Promise.resolve(require('../../screens/IntelligentFlowScreen')),
    recipes: () => Promise.resolve(require('../../screens/RecipeHomeScreen')),
    'recipe-generation': () => Promise.resolve(require('../../screens/RecipeGenerationScreen')),
    'recipe-search': () => Promise.resolve(require('../../screens/RecipeSearchScreen')),
    'my-recipes': () => Promise.resolve(require('../../screens/MyRecipesScreen')),
    'recipe-detail': () => Promise.resolve(require('../../screens/RecipeDetailScreen')),
    'taste-preferences': () => Promise.resolve(require('../../screens/TastePreferencesScreen')),
    'shopping-optimization': () => Promise.resolve(require('../../screens/ShoppingOptimizationScreen')),
    vision: () => Promise.resolve(require('../../screens/VisionLogScreen')),
    'vision-history': () => Promise.resolve(require('../../screens/VisionHistoryScreen')),
    'discover-feed': () => Promise.resolve(require('../../screens/DiscoverFeedScreen')),
    feed: () => Promise.resolve(require('../../screens/FeedScreen')),
    'followers-list': () => Promise.resolve(require('../../screens/FollowersListScreen')),
    'following-list': () => Promise.resolve(require('../../screens/FollowingListScreen')),
    'blocked-list': () => Promise.resolve(require('../../screens/BlockedListScreen')),
    'blocked-by': () => Promise.resolve(require('../../screens/BlockedByScreen')),
    profile: () => Promise.resolve(require('../../screens/ProfileScreen')),
    'profile-edit': () => Promise.resolve(require('../../screens/ProfileEditScreen')),
    rewards: () => Promise.resolve(require('../../screens/RewardsScreen'))
  };

  const loader = componentMap[screen];
  if (!loader) {
    throw new Error(`No component loader found for screen: ${screen}`);
  }

  const module = await loader();
  return module.default;
};

export {
  FEATURE_FLAGS,
  SCREEN_REGISTRY,
  NAVIGATION_TRANSITIONS,
  MODULE_DEPENDENCIES,
};
