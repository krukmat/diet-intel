import * as ScreenRegistry from '../ScreenRegistry';

jest.mock('../ScreenRegistryConfig', () => ({
  FEATURE_FLAGS: { featureA: true },
  SCREEN_REGISTRY: { splash: { featureFlag: 'featureA' } },
  NAVIGATION_TRANSITIONS: { default: 'fade' },
  MODULE_DEPENDENCIES: { core: ['splash'] },
}));

jest.mock('../ScreenRegistryUtils', () => ({
  getScreensByFeatureFlag: jest.fn(() => ['splash']),
  validateScreen: jest.fn(() => true),
  resolveScreenTarget: jest.fn(() => 'splash'),
  getAllValidScreens: jest.fn(() => ['splash']),
  getScreenStats: jest.fn(() => ({ totalScreens: 1 })),
  loadScreenComponent: jest.fn(async () => 'Splash'),
}));

describe('ScreenRegistry barrel exports', () => {
  it('re-exports config and helpers', () => {
    expect(ScreenRegistry.FEATURE_FLAGS).toEqual({ featureA: true });
    expect(ScreenRegistry.SCREEN_REGISTRY).toEqual({ splash: { featureFlag: 'featureA' } });
    expect(ScreenRegistry.NAVIGATION_TRANSITIONS).toEqual({ default: 'fade' });
    expect(ScreenRegistry.MODULE_DEPENDENCIES).toEqual({ core: ['splash'] });

    expect(ScreenRegistry.getScreensByFeatureFlag).toBeDefined();
    expect(ScreenRegistry.validateScreen).toBeDefined();
    expect(ScreenRegistry.resolveScreenTarget).toBeDefined();
    expect(ScreenRegistry.getAllValidScreens).toBeDefined();
    expect(ScreenRegistry.getScreenStats).toBeDefined();
    expect(ScreenRegistry.loadScreenComponent).toBeDefined();
  });

  it('provides default export with helpers', () => {
    expect(ScreenRegistry.default.SCREEN_REGISTRY).toEqual({ splash: { featureFlag: 'featureA' } });
    expect(ScreenRegistry.default.getScreenStats).toBeDefined();
  });
});
