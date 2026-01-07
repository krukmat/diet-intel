/**
 * Screen Registry configuration for DietIntel Mobile App
 * Static definitions: screens, transitions, and module dependencies
 */

import type { ScreenType, ScreenConfig, FeatureFlagConfig } from './NavigationTypes';

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
    component: null,
    options: { headerShown: false, gestureEnabled: false },
    dependencies: ['auth']
  },
  login: {
    component: null,
    options: { headerShown: false, gestureEnabled: false },
    dependencies: ['auth']
  },
  register: {
    component: null,
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
  },

  // Rewards system
  rewards: {
    component: null,
    options: { headerShown: true, gestureEnabled: true },
    dependencies: ['gamification', 'profile', 'achievements']
  }
};

// Navigation transitions mapping
export const NAVIGATION_TRANSITIONS: Record<ScreenType, ScreenType[]> = {
  scanner: ['upload', 'track', 'plan', 'recommendations', 'recipes', 'vision', 'discover-feed', 'profile', 'rewards'],
  upload: ['scanner', 'track'],
  track: ['scanner', 'plan', 'recommendations', 'rewards'],
  plan: ['scanner', 'recommendations', 'track', 'rewards'],
  recommendations: ['scanner', 'plan', 'track', 'intelligent-flow', 'rewards'],
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
  profile: ['profile-edit', 'followers-list', 'following-list', 'blocked-list', 'blocked-by', 'rewards'],
  'profile-edit': ['profile'],
  rewards: ['profile', 'scanner', 'track', 'plan', 'recommendations'],
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
  gamification: ['contexts', 'services'],
  achievements: ['services', 'storage'],
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
