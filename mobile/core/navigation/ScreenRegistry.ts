/**
 * Screen Registry for DietIntel Mobile App
 * Centralized registry of all screens with their configurations and dependencies
 */

import { ScreenType, ScreenConfig, FeatureFlagConfig } from './NavigationTypes';

// Feature flag configuration
export const FEATURE_FLAGS: FeatureFlagConfig = {
  barcodeScanner: true,
  uploadLabelFeature: true,
  mealPlanFeature: true,
  trackingFeature: true,
  intelligentFlowFeature: true,
  reminderNotifications: true,
};

// Screen registry with configurations
export const SCREEN_REGISTRY: Record<ScreenType, ScreenConfig> = {
  // Authentication screens
  splash: {
    component: null, // Will be loaded dynamically
    options: { headerShown: false, gestureEnabled: false },
    dependencies: ['auth']
  },
  login: {
    component: null, // Will be loaded dynamically
    options: { headerShown: false, gestureEnabled: false },
    dependencies: ['auth']
  },
  register: {
    component: null, // Will be loaded dynamically
    options: { headerShown: false, gestureEnabled: false },
    dependencies: ['auth']
  },

  // Core feature screens
  scanner: {
    component: null,
    options: { headerShown: false, gestureEnabled: true },
    dependencies: ['tracking', 'camera'],
    featureFlag: 'barcodeScanner'
  },
  upload: {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['tracking', 'upload'],
    featureFlag: 'uploadLabelFeature'
  },
  track: {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['tracking', 'data'],
    featureFlag: 'trackingFeature'
  },

  // Planning and recommendations
  plan: {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['planning', 'data'],
    featureFlag: 'mealPlanFeature'
  },
  recommendations: {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['ai', 'planning'],
    featureFlag: 'mealPlanFeature'
  },
  'intelligent-flow': {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['ai', 'flow'],
    featureFlag: 'intelligentFlowFeature'
  },

  // Recipe ecosystem
  recipes: {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['recipes', 'data']
  },
  'recipe-generation': {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['recipes', 'ai']
  },
  'recipe-search': {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['recipes', 'search']
  },
  'my-recipes': {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['recipes', 'storage']
  },
  'recipe-detail': {
    component: null,
    options: { headerShown: true, gestureEnabled: true, presentation: 'modal' },
    dependencies: ['recipes', 'data']
  },
  'taste-preferences': {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['recipes', 'profile']
  },
  'shopping-optimization': {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['recipes', 'shopping']
  },

  // Vision and analysis
  vision: {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['vision', 'camera']
  },
  'vision-history': {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['vision', 'storage']
  },

  // Social features
  'discover-feed': {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['social', 'feed']
  },
  feed: {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['social', 'feed']
  },
  'followers-list': {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['social', 'profile']
  },
  'following-list': {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['social', 'profile']
  },
  'blocked-list': {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['social', 'moderation']
  },
  'blocked-by': {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['social', 'moderation']
  },

  // Profile management
  profile: {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['profile', 'auth']
  },
  'profile-edit': {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['profile', 'auth']
  }
};

// Navigation transitions mapping
export const NAVIGATION_TRANSITIONS: Record<ScreenType, ScreenType[]> = {
  scanner: ['upload', 'track', 'plan', 'recommendations', 'recipes', 'vision', 'discover-feed', 'profile'],
  upload: ['scanner', 'track'],
  track: ['scanner', 'plan', 'recommendations'],
  plan: ['scanner', 'recommendations', 'track'],
  recommendations: ['scanner', 'plan', 'track', 'intelligent-flow'],
  'intelligent-flow': ['recommendations'],
  recipes: ['recipe-generation', 'recipe-search', 'my-recipes', 'taste-preferences', 'shopping-optimization'],
  'recipe-generation': ['recipe-detail', 'recipes'],
  'recipe-search': ['recipe-detail', 'recipes'],
  'my-recipes': ['recipe-detail', 'recipes'],
  'recipe-detail': ['recipes', 'recipe-generation', 'shopping-optimization'],
  'taste-preferences': ['recipes'],
  'shopping-optimization': ['recipe-detail', 'recipes'],
  vision: ['vision-history', 'track'],
  'vision-history': ['vision'],
  'discover-feed': ['profile', 'feed'],
  feed: ['discover-feed', 'profile'],
  'followers-list': ['profile'],
  'following-list': ['profile'],
  'blocked-list': ['profile'],
  'blocked-by': ['profile'],
  profile: ['profile-edit', 'followers-list', 'following-list', 'blocked-list', 'blocked-by'],
  'profile-edit': ['profile'],
  splash: ['login'],
  login: ['register'],
  register: ['login']
};

// Module dependencies mapping
export const MODULE_DEPENDENCIES = {
  auth: ['contexts'],
  tracking: ['services', 'camera'],
  planning: ['services', 'ai'],
  recipes: ['services', 'storage'],
  vision: ['services', 'camera'],
  social: ['services', 'feed'],
  profile: ['services', 'contexts'],
  ai: ['services'],
  camera: ['permissions'],
  upload: ['permissions'],
  data: ['services'],
  storage: ['services'],
  search: ['services'],
  shopping: ['services'],
  flow: ['services'],
  feed: ['services'],
  moderation: ['services'],
  permissions: ['utils']
};

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
    'profile-edit': () => Promise.resolve(require('../../screens/ProfileEditScreen'))
  };

  const loader = componentMap[screen];
  if (!loader) {
    throw new Error(`No component loader found for screen: ${screen}`);
  }

  const module = await loader();
  return module.default;
};

export default {
  SCREEN_REGISTRY,
  NAVIGATION_TRANSITIONS,
  MODULE_DEPENDENCIES,
  FEATURE_FLAGS,
  getScreensByFeatureFlag,
  validateScreen,
  getAllValidScreens,
  getScreenStats,
  loadScreenComponent
};
