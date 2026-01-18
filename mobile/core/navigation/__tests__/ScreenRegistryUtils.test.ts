import {
  getScreensByFeatureFlag,
  validateScreen,
  resolveScreenTarget,
  getAllValidScreens,
  getScreenStats,
  loadScreenComponent,
} from '../ScreenRegistryUtils';

jest.mock('../ScreenRegistryConfig', () => ({
  FEATURE_FLAGS: {
    authEnabled: true,
    beta: false,
  },
  SCREEN_REGISTRY: {
    login: { featureFlag: 'authEnabled' },
    feed: {},
    hidden: { featureFlag: 'beta' },
  },
  NAVIGATION_TRANSITIONS: {},
  MODULE_DEPENDENCIES: {
    core: ['feed'],
  },
}));

jest.mock('../../../screens/LoginScreen', () => ({
  default: 'LoginScreen',
}));
jest.mock('../../../screens/RegisterScreen', () => ({
  default: 'RegisterScreen',
}));
jest.mock('../../../screens/ProfileEditScreen', () => ({
  default: 'ProfileEditScreen',
}));
jest.mock('../../../screens/SplashScreen', () => ({
  default: 'SplashScreen',
}));
jest.mock('../../../screens/TrackScreen', () => ({
  default: 'TrackScreen',
}));
jest.mock('../../../screens/UploadLabel', () => ({
  default: 'UploadLabel',
}));
jest.mock('../../../screens/PlanScreen', () => ({
  default: 'PlanScreen',
}));
jest.mock('../../../screens/SmartDietScreen', () => ({
  default: 'SmartDietScreen',
}));
jest.mock('../../../screens/IntelligentFlowScreen', () => ({
  default: 'IntelligentFlowScreen',
}));
jest.mock('../../../screens/RecipeHomeScreen', () => ({
  default: 'RecipeHomeScreen',
}));
jest.mock('../../../screens/RecipeGenerationScreen', () => ({
  default: 'RecipeGenerationScreen',
}));
jest.mock('../../../screens/RecipeSearchScreen', () => ({
  default: 'RecipeSearchScreen',
}));
jest.mock('../../../screens/MyRecipesScreen', () => ({
  default: 'MyRecipesScreen',
}));
jest.mock('../../../screens/RecipeDetailScreen', () => ({
  default: 'RecipeDetailScreen',
}));
jest.mock('../../../screens/TastePreferencesScreen', () => ({
  default: 'TastePreferencesScreen',
}));
jest.mock('../../../screens/ShoppingOptimizationScreen', () => ({
  default: 'ShoppingOptimizationScreen',
}));
jest.mock('../../../screens/VisionLogScreen', () => ({
  default: 'VisionLogScreen',
}));
jest.mock('../../../screens/DiscoverFeedScreen', () => ({
  default: 'DiscoverFeedScreen',
}));
jest.mock('../../../screens/ProfileScreen', () => ({
  default: 'ProfileScreen',
}));
jest.mock('../../../screens/RewardsScreen', () => ({
  default: 'RewardsScreen',
}));

describe('ScreenRegistryUtils', () => {
  it('filters screens by feature flag', () => {
    const screens = getScreensByFeatureFlag({ authEnabled: true, beta: false } as any);
    expect(screens).toEqual(['login', 'feed']);
  });

  it('validates screens against registry and flags', () => {
    expect(validateScreen('login' as any)).toBe(true);
    expect(validateScreen('hidden' as any)).toBe(false);
    expect(validateScreen('missing' as any)).toBe(false);
  });

  it('resolves to fallback when target is invalid', () => {
    expect(resolveScreenTarget('hidden' as any, 'feed' as any)).toBe('feed');
  });

  it('returns all valid screens and stats', () => {
    expect(getAllValidScreens()).toEqual(['login', 'feed']);

    const stats = getScreenStats();
    expect(stats.totalScreens).toBe(3);
    expect(stats.validScreens).toBe(2);
    expect(stats.screensWithFeatureFlags).toBe(2);
    expect(stats.moduleCount).toBe(1);
    expect(stats.coverage).toBeCloseTo((2 / 3) * 100);
  });

  it('loads a screen component dynamically', async () => {
    const component = await loadScreenComponent('login' as any);
    expect(component).toBe('LoginScreen');
  });

  it('loads additional screen components', async () => {
    await expect(loadScreenComponent('register' as any)).resolves.toBe('RegisterScreen');
    await expect(loadScreenComponent('profile-edit' as any)).resolves.toBe('ProfileEditScreen');
    await expect(loadScreenComponent('discover-feed' as any)).resolves.toBe('DiscoverFeedScreen');
  });

  it('loads remaining screen components', async () => {
    const screens = [
      ['splash', 'SplashScreen'],
      ['scanner', 'TrackScreen'],
      ['upload', 'UploadLabel'],
      ['track', 'TrackScreen'],
      ['plan', 'PlanScreen'],
      ['recommendations', 'SmartDietScreen'],
      ['intelligent-flow', 'IntelligentFlowScreen'],
      ['recipes', 'RecipeHomeScreen'],
      ['recipe-generation', 'RecipeGenerationScreen'],
      ['recipe-search', 'RecipeSearchScreen'],
      ['my-recipes', 'MyRecipesScreen'],
      ['recipe-detail', 'RecipeDetailScreen'],
      ['taste-preferences', 'TastePreferencesScreen'],
      ['shopping-optimization', 'ShoppingOptimizationScreen'],
      ['vision', 'VisionLogScreen'],
      ['discover-feed', 'DiscoverFeedScreen'],
      ['profile', 'ProfileScreen'],
      ['rewards', 'RewardsScreen'],
    ] as const;

    for (const [screenName, expected] of screens) {
      await expect(loadScreenComponent(screenName as any)).resolves.toBe(expected);
    }
  });

  it('throws when loader missing', async () => {
    await expect(loadScreenComponent('missing' as any)).rejects.toThrow(
      'No component loader found for screen: missing'
    );
  });
});
