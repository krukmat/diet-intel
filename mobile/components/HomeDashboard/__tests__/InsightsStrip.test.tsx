/**
 * Tests for InsightsStrip component
 */

import React from 'react';
import { render, within } from '@testing-library/react-native';
import { InsightsStrip } from '../InsightsStrip';

describe('InsightsStrip', () => {
  it('renders insight labels and values', () => {
    const insights = [
      { id: 'calories', label: 'Calorias', value: '2633 kcal' },
      { id: 'streak', label: 'Racha', value: '5 dias' },
      { id: 'weight', label: 'Peso', value: '72 kg' },
    ];

    const { getByTestId } = render(<InsightsStrip insights={insights} />);

    expect(within(getByTestId('insight-0')).getByText('Calorias')).toBeTruthy();
    expect(within(getByTestId('insight-0')).getByText('2633 kcal')).toBeTruthy();
    expect(within(getByTestId('insight-1')).getByText('Racha')).toBeTruthy();
    expect(within(getByTestId('insight-1')).getByText('5 dias')).toBeTruthy();
    expect(within(getByTestId('insight-2')).getByText('Peso')).toBeTruthy();
    expect(within(getByTestId('insight-2')).getByText('72 kg')).toBeTruthy();
  });
});
