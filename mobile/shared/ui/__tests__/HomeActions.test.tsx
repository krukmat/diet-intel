import React from 'react';
import { render } from '@testing-library/react-native';
import {
  HomePrimaryActions,
  HomeSecondaryActions,
  HomeToolActions,
  HomeProgressCard,
} from '../components/HomeActions';

describe('HomeActions components', () => {
  it('renders primary actions', () => {
    const { getByTestId, getByText } = render(
      <HomePrimaryActions
        title="Primary"
        actions={[
          { id: 'logMeal', label: 'Log Meal', onPress: jest.fn() },
          { id: 'aiPlan', label: 'AI Plan', onPress: jest.fn() },
        ]}
      />
    );
    expect(getByText('Primary')).toBeTruthy();
    expect(getByTestId('home-primary-logMeal')).toBeTruthy();
    expect(getByTestId('home-primary-aiPlan')).toBeTruthy();
  });

  it('renders secondary actions', () => {
    const { getByTestId } = render(
      <HomeSecondaryActions
        title="Secondary"
        actions={[{ id: 'profile', label: 'Profile', onPress: jest.fn() }]}
      />
    );
    expect(getByTestId('home-secondary-profile')).toBeTruthy();
  });

  it('renders tool actions', () => {
    const { getByTestId } = render(
      <HomeToolActions
        actions={[{ id: 'gamification', label: 'Rewards', onPress: jest.fn() }]}
      />
    );
    expect(getByTestId('home-tool-gamification')).toBeTruthy();
  });

  it('renders progress card', () => {
    const { getByText } = render(
      <HomeProgressCard title="Progress" description="Weekly summary" />
    );
    expect(getByText('Progress')).toBeTruthy();
    expect(getByText('Weekly summary')).toBeTruthy();
  });
});
