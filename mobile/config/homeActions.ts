import { FeatureToggle } from '../services/DeveloperSettings';

export type HomeActionGroup = 'primary' | 'secondary' | 'tool';

export interface HomeActionDefinition {
  id: string;
  labelKey: string;
  group: HomeActionGroup;
  target: string;
  featureFlags?: Array<keyof FeatureToggle>;
  featureMode?: 'any' | 'all';
}

export const HOME_ACTIONS: HomeActionDefinition[] = [
  {
    id: 'logMeal',
    labelKey: 'home.actions.logMeal',
    group: 'primary',
    target: 'scanner',
    featureFlags: ['barcodeScanner', 'uploadLabelFeature'],
    featureMode: 'any',
  },
  {
    id: 'aiPlan',
    labelKey: 'home.actions.aiPlan',
    group: 'primary',
    target: 'recommendations',
    featureFlags: ['mealPlanFeature'],
    featureMode: 'all',
  },
  {
    id: 'progress',
    labelKey: 'home.actions.progress',
    group: 'primary',
    target: 'track',
    featureFlags: ['trackingFeature'],
    featureMode: 'all',
  },
  {
    id: 'explore',
    labelKey: 'home.actions.explore',
    group: 'secondary',
    target: 'discover-feed',
  },
  {
    id: 'uploadLabel',
    labelKey: 'navigation.uploadLabel',
    group: 'secondary',
    target: 'upload',
    featureFlags: ['uploadLabelFeature'],
    featureMode: 'all',
  },
  {
    id: 'vision',
    labelKey: 'navigation.vision',
    group: 'secondary',
    target: 'vision',
  },
  {
    id: 'recipes',
    labelKey: 'navigation.recipes',
    group: 'secondary',
    target: 'recipes',
  },
  {
    id: 'profile',
    labelKey: 'home.actions.profile',
    group: 'secondary',
    target: 'profile',
  },
  {
    id: 'gamification',
    labelKey: 'home.actions.gamification',
    group: 'tool',
    target: 'profile',
  },
];

const isActionEnabled = (action: HomeActionDefinition, toggles?: FeatureToggle): boolean => {
  if (!action.featureFlags || action.featureFlags.length === 0) {
    return true;
  }
  if (!toggles) {
    return false;
  }
  const mode = action.featureMode || 'all';
  const results = action.featureFlags.map(flag => Boolean(toggles[flag]));
  return mode === 'any' ? results.some(Boolean) : results.every(Boolean);
};

export const getHomeActions = (
  group: HomeActionGroup,
  toggles?: FeatureToggle
): HomeActionDefinition[] =>
  HOME_ACTIONS.filter(action => action.group === group && isActionEnabled(action, toggles));
