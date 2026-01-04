import { Alert } from 'react-native';
import { renderScreen } from '../legacyRouter';
import type { ScreenType, NavigationContext } from '../NavigationTypes';

jest.mock('../../../screens/UploadLabel', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../screens/PlanScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../screens/TrackScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../screens/SmartDietScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../screens/VisionLogScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../screens/RecipeHomeScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../screens/RecipeGenerationScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../screens/RecipeSearchScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../screens/MyRecipesScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../screens/RecipeDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../screens/TastePreferencesScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../screens/ShoppingOptimizationScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../screens/IntelligentFlowScreen', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../screens/ProfileScreen', () => ({
  ProfileScreen: () => null,
}));

jest.mock('../../../screens/ProfileEditScreen', () => ({
  ProfileEditScreen: () => null,
}));

jest.mock('../../../screens/DiscoverFeedScreen', () => ({
  DiscoverFeedScreen: () => null,
}));

const buildParams = (overrides: Partial<{ currentScreen: ScreenType; navigationContext: NavigationContext }> = {}) => {
  const setCurrentScreen = jest.fn();
  const navigateToScreen = jest.fn();
  return {
    currentScreen: overrides.currentScreen ?? 'scanner',
    navigationContext: overrides.navigationContext ?? {},
    setCurrentScreen,
    navigateToScreen,
    user: { id: 'user-1' },
  };
};

describe('renderScreen', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null for scanner', () => {
    const params = buildParams({ currentScreen: 'scanner' });
    expect(renderScreen(params)).toBeNull();
  });

  it('handles upload screen back navigation', () => {
    const params = buildParams({ currentScreen: 'upload' });
    const element = renderScreen(params) as any;

    element.props.onBackPress();
    expect(params.setCurrentScreen).toHaveBeenCalledWith('scanner');
  });

  it('routes plan screen to smart diet recommendations', () => {
    const params = buildParams({ currentScreen: 'plan' });
    const element = renderScreen(params) as any;

    element.props.navigateToSmartDiet({ focus: 'carbs' });

    expect(params.navigateToScreen).toHaveBeenCalledWith('recommendations', {
      targetContext: 'optimize',
      sourceScreen: 'plan',
      focus: 'carbs',
    });
  });

  it('routes recommendations screen actions', () => {
    const params = buildParams({ currentScreen: 'recommendations' });
    const element = renderScreen(params) as any;

    element.props.navigateToTrack();
    element.props.navigateToPlan();

    expect(params.navigateToScreen).toHaveBeenCalledWith('track', { sourceScreen: 'recommendations' });
    expect(params.navigateToScreen).toHaveBeenCalledWith('plan', { sourceScreen: 'recommendations' });
  });

  it('handles profile edit save and cancel', async () => {
    const params = buildParams({ currentScreen: 'profile-edit' });
    const element = renderScreen(params) as any;

    await element.props.onSave();
    element.props.onCancel();

    expect(params.setCurrentScreen).toHaveBeenCalledWith('profile');
    expect(alertSpy).toHaveBeenCalledWith('Success', 'Profile updated successfully');
  });

  it('routes recipe detail back to source screen', () => {
    const params = buildParams({
      currentScreen: 'recipe-detail',
      navigationContext: { sourceScreen: 'recipe-search' },
    });
    const element = renderScreen(params) as any;

    element.props.onBackPress();

    expect(params.setCurrentScreen).toHaveBeenCalledWith('recipe-search');
  });

  it('falls back to recipes when source screen is missing', () => {
    const params = buildParams({ currentScreen: 'recipe-detail', navigationContext: {} });
    const element = renderScreen(params) as any;

    element.props.onBackPress();

    expect(params.setCurrentScreen).toHaveBeenCalledWith('recipes');
  });

  it('passes user id to taste preferences', () => {
    const params = buildParams({ currentScreen: 'taste-preferences' });
    const element = renderScreen(params) as any;

    expect(element.props.userId).toBe('user-1');
  });

  it('defaults shopping optimization recipes to empty array', () => {
    const params = buildParams({ currentScreen: 'shopping-optimization', navigationContext: {} });
    const element = renderScreen(params) as any;

    expect(element.props.selectedRecipes).toEqual([]);
  });
});
