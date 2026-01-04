/**
 * Screen Registry for DietIntel Mobile App
 * Barrel exports for config + helpers (SoC)
 */

import {
  FEATURE_FLAGS,
  SCREEN_REGISTRY,
  NAVIGATION_TRANSITIONS,
  MODULE_DEPENDENCIES,
} from './ScreenRegistryConfig';
import {
  getScreensByFeatureFlag,
  validateScreen,
  resolveScreenTarget,
  getAllValidScreens,
  getScreenStats,
  loadScreenComponent,
} from './ScreenRegistryUtils';

export {
  FEATURE_FLAGS,
  SCREEN_REGISTRY,
  NAVIGATION_TRANSITIONS,
  MODULE_DEPENDENCIES,
  getScreensByFeatureFlag,
  validateScreen,
  resolveScreenTarget,
  getAllValidScreens,
  getScreenStats,
  loadScreenComponent,
};

export default {
  SCREEN_REGISTRY,
  NAVIGATION_TRANSITIONS,
  MODULE_DEPENDENCIES,
  FEATURE_FLAGS,
  getScreensByFeatureFlag,
  validateScreen,
  resolveScreenTarget,
  getAllValidScreens,
  getScreenStats,
  loadScreenComponent
};
