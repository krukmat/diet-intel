import { HOME_ACTIONS } from '../../../config/homeActions';
import { resolveScreenTarget, validateScreen } from '../ScreenRegistry';
import type { ScreenType } from '../NavigationTypes';

describe('home navigation targets', () => {
  it('ensures configured home targets are valid screens', () => {
    HOME_ACTIONS.forEach(action => {
      const target = action.target as ScreenType;
      expect(validateScreen(target)).toBe(true);
    });
  });

  it('resolves invalid targets to fallback', () => {
    const fallback = 'scanner' as ScreenType;
    const invalidTarget = 'invalid-screen' as ScreenType;
    expect(resolveScreenTarget(invalidTarget, fallback)).toBe(fallback);
  });
});
