import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import HomeDashboard from '../HomeDashboard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

describe('HomeDashboard', () => {
  const planAction = { id: 'plan', label: 'Plan', onPress: jest.fn() };
  const baseProps = {
    title: 'DietIntel',
    subtitle: 'Welcome',
    version: 'v1',
    heroDailyCalories: 2000,
    heroPlannedCalories: 1800,
    heroConsumedCalories: 1200,
    heroPlanActive: true,
    toolActions: [{ id: 'rewards', label: 'Recompensas', onPress: jest.fn() }],
    primaryActions: [
      { id: 'logMeal', label: 'Registrar', onPress: jest.fn() },
      planAction,
      { id: 'photos', label: 'Fotos', onPress: jest.fn() },
    ],
    secondaryActions: [
      { id: 'uploadLabel', label: 'Subir etiqueta', onPress: jest.fn() },
    ],
    showDeveloperSettings: true,
    showNotifications: true,
    onLogout: jest.fn(),
    onShowDeveloperSettings: jest.fn(),
    onShowNotifications: jest.fn(),
    onShowLanguageSwitcher: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header content', () => {
    const { getByText } = render(<HomeDashboard {...baseProps} />);

    expect(getByText('DietIntel')).toBeTruthy();
    expect(getByText('Welcome')).toBeTruthy();
  });

  it('renders summary and quick actions', () => {
    const { getAllByText, getByText, getByTestId } = render(<HomeDashboard {...baseProps} />);

    expect(getAllByText('2000 kcal').length).toBeGreaterThan(0);
    expect(getAllByText('1200 / 2000 kcal').length).toBeGreaterThan(0);
    expect(getAllByText('home.hero.planActive').length).toBeGreaterThan(0);
    expect(getByTestId('summary-cta')).toBeTruthy();
    expect(getByTestId('home-action-logMeal')).toBeTruthy();
    expect(getByTestId('home-action-photos')).toBeTruthy();
    expect(getByTestId('home-action-uploadLabel')).toBeTruthy();
  });

  it('triggers header utilities and CTA', () => {
    const { getByTestId } = render(<HomeDashboard {...baseProps} />);

    fireEvent.press(getByTestId('home-header-utility-rewards'));
    fireEvent.press(getByTestId('home-header-utility-language'));
    fireEvent.press(getByTestId('home-header-utility-notifications'));
    fireEvent.press(getByTestId('home-header-utility-settings'));
    fireEvent.press(getByTestId('home-header-utility-logout'));
    fireEvent.press(getByTestId('summary-cta'));

    expect(baseProps.toolActions[0].onPress).toHaveBeenCalled();
    expect(baseProps.onShowLanguageSwitcher).toHaveBeenCalled();
    expect(baseProps.onShowNotifications).toHaveBeenCalled();
    expect(baseProps.onShowDeveloperSettings).toHaveBeenCalled();
    expect(baseProps.onLogout).toHaveBeenCalled();
    expect(planAction.onPress).toHaveBeenCalled();
  });

  it('hides optional header buttons when disabled', () => {
    const { queryByTestId } = render(
      <HomeDashboard
        {...baseProps}
        showDeveloperSettings={false}
        showNotifications={false}
      />
    );

    expect(queryByTestId('home-header-utility-settings')).toBeNull();
    expect(queryByTestId('home-header-utility-notifications')).toBeNull();
  });
});
