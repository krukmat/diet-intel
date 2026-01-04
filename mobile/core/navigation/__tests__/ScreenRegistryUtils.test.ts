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

  it('throws when loader missing', async () => {
    await expect(loadScreenComponent('missing' as any)).rejects.toThrow(
      'No component loader found for screen: missing'
    );
  });
});
