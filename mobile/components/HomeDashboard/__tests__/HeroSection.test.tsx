/**
 * Tests para HeroSection component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { HeroSection } from '../HeroSection';

// Mock de react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: jest.fn((key: string) => key)
  })
}));

describe('HeroSection', () => {
  const defaultProps = {
    title: 'DietIntel',
    subtitle: 'Welcome back!',
    version: 'v1.0',
    caloriesText: '2000 kcal',
    plannedCaloriesText: '1800 / 1800 kcal',
    progressText: '1200 / 2000 kcal',
    planText: 'Plan activo'
  };

  it('renders correctly with all props', () => {
    const { getByText } = render(<HeroSection {...defaultProps} />);

    expect(getByText('DietIntel')).toBeTruthy();
    expect(getByText('Welcome back!')).toBeTruthy();
    expect(getByText('v1.0')).toBeTruthy();
    expect(getByText('2000 kcal')).toBeTruthy();
    expect(getByText('1200 / 2000 kcal')).toBeTruthy();
    expect(getByText('Plan activo')).toBeTruthy();
  });

  it('handles null plannedCaloriesText', () => {
    const { queryByText } = render(
      <HeroSection {...defaultProps} plannedCaloriesText={null} />
    );

    // El texto de planned calories no debería aparecer
    expect(queryByText('1800 / 1800 kcal')).toBeNull();
  });

  it('renders translation keys correctly', () => {
    const { getByText } = render(<HeroSection {...defaultProps} />);

    // Las keys de traducción deberían renderizarse
    expect(getByText('home.hero.dailyCalories')).toBeTruthy();
    expect(getByText('home.hero.todayProgress')).toBeTruthy();
    expect(getByText('home.hero.planStatus')).toBeTruthy();
  });
});
