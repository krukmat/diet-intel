import { getHomeActions, HOME_ACTIONS } from '../../config/homeActions';
import { FeatureToggle } from '../../services/DeveloperSettings';

const baseToggles: FeatureToggle = {
  uploadLabelFeature: true,
  mealPlanFeature: true,
  trackingFeature: true,
  barcodeScanner: true,
  reminderNotifications: true,
  intelligentFlowFeature: false,
};

describe('homeActions config', () => {
  it('returns primary actions when toggles allow', () => {
    const actions = getHomeActions('primary', baseToggles).map(action => action.id);
    expect(actions).toEqual(expect.arrayContaining(['logMeal', 'aiPlan', 'progress']));
  });

  it('hides logMeal when both scanner and upload are disabled', () => {
    const toggles: FeatureToggle = {
      ...baseToggles,
      barcodeScanner: false,
      uploadLabelFeature: false,
    };
    const actions = getHomeActions('primary', toggles).map(action => action.id);
    expect(actions).not.toContain('logMeal');
  });

  it('hides aiPlan when meal plan is disabled', () => {
    const toggles: FeatureToggle = { ...baseToggles, mealPlanFeature: false };
    const actions = getHomeActions('primary', toggles).map(action => action.id);
    expect(actions).not.toContain('aiPlan');
  });

  it('returns secondary actions without toggles', () => {
    const actions = getHomeActions('secondary').map(action => action.id);
    expect(actions).toEqual(expect.arrayContaining(['explore', 'profile', 'vision', 'recipes']));
  });

  it('includes upload label when feature is enabled', () => {
    const actions = getHomeActions('secondary', baseToggles).map(action => action.id);
    expect(actions).toContain('uploadLabel');
  });

  it('uses declared groups for all actions', () => {
    const groups = new Set(HOME_ACTIONS.map(action => action.group));
    expect(groups.has('primary')).toBe(true);
    expect(groups.has('secondary')).toBe(true);
    expect(groups.has('tool')).toBe(true);
  });
});
