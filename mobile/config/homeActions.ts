import { FeatureToggle } from '../services/DeveloperSettings';

export type HomeActionGroup = 'primary' | 'secondary' | 'tool';

export interface HomeActionDefinition {
  id: string;
  labelKey: string;
  subtitleKey?: string;
  group: HomeActionGroup;
  target: string;
  icon?: string;
  featureFlags?: Array<keyof FeatureToggle>;
  featureMode?: 'any' | 'all';
}

export const HOME_ACTIONS: HomeActionDefinition[] = [
  {
    id: 'aiPlan',
    labelKey: 'home.actions.aiPlan',
    subtitleKey: 'home.actionSubtitles.aiPlan',
    group: 'primary',
    target: 'recommendations',
    icon: '🤖',
    featureFlags: ['mealPlanFeature'],
    featureMode: 'all',
  },
  {
    id: 'progress',
    labelKey: 'home.actions.progress',
    subtitleKey: 'home.actionSubtitles.progress',
    group: 'primary',
    target: 'track',
    icon: '📊',
    featureFlags: ['trackingFeature'],
    featureMode: 'all',
  },
  {
    id: 'plan',
    labelKey: 'home.actions.plan',
    subtitleKey: 'home.actionSubtitles.plan',
    group: 'secondary',
    target: 'plan',
    icon: '📋',
    featureFlags: ['mealPlanFeature'],
    featureMode: 'all',
  },
  {
    id: 'uploadLabel',
    labelKey: 'home.actions.uploadLabel',
    subtitleKey: 'home.actionSubtitles.uploadLabel',
    group: 'secondary',
    target: 'upload',
    icon: '🏷️',
    featureFlags: ['uploadLabelFeature'],
    featureMode: 'all',
  },
  {
    id: 'photos',
    labelKey: 'home.actions.photos',
    subtitleKey: 'home.actionSubtitles.photos',
    group: 'secondary',
    target: 'photos',
    icon: '🖼️',
  },
  {
    id: 'weight',
    labelKey: 'home.actions.weight',
    subtitleKey: 'home.actionSubtitles.weight',
    group: 'secondary',
    target: 'weight',
    icon: '⚖️',
  },
  {
    id: 'recipes',
    labelKey: 'navigation.recipes',
    subtitleKey: 'home.actionSubtitles.recipes',
    group: 'secondary',
    target: 'recipes',
    icon: '📖',
  },
  {
    id: 'vision',
    labelKey: 'navigation.vision',
    subtitleKey: 'home.actionSubtitles.vision',
    group: 'secondary',
    target: 'vision',
    icon: '👁️',
  },
  {
    id: 'explore',
    labelKey: 'home.actions.explore',
    subtitleKey: 'home.actionSubtitles.explore',
    group: 'secondary',
    target: 'discover-feed',
    icon: '🌍',
  },
  {
    id: 'profile',
    labelKey: 'home.actions.profile',
    subtitleKey: 'home.actionSubtitles.profile',
    group: 'secondary',
    target: 'profile',
    icon: '👤',
  },
  {
    id: 'gamification',
    labelKey: 'home.actions.gamification',
    group: 'tool',
    target: 'rewards',
    icon: '🏆',
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
