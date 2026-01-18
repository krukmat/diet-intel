/**
 * Tests for HomeHeader component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { HomeHeader } from '../HomeHeader';

describe('HomeHeader', () => {
  it('renders title and greeting', () => {
    const { getByText } = render(
      <HomeHeader title="DietIntel" greeting="Hola, Demo" />
    );

    expect(getByText('DietIntel')).toBeTruthy();
    expect(getByText('Hola, Demo')).toBeTruthy();
  });

  it('renders utility action when provided', () => {
    const { getByText, getByTestId } = render(
      <HomeHeader
        title="DietIntel"
        greeting="Hola, Demo"
        utilities={[
          { id: 'notifications', label: 'Notificaciones', onPress: () => {} },
        ]}
      />
    );

    expect(getByText('Notificaciones')).toBeTruthy();
    expect(getByTestId('home-header-utility-notifications')).toBeTruthy();
  });
});
