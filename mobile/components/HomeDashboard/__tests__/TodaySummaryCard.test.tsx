/**
 * Tests for TodaySummaryCard component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { TodaySummaryCard } from '../TodaySummaryCard';

describe('TodaySummaryCard', () => {
  it('renders summary content and CTA', () => {
    const { getByText, getByTestId } = render(
      <TodaySummaryCard
        summaryTitle="Resumen de hoy"
        caloriesText="2633 kcal"
        stats={[
          { id: 'today', label: 'Hoy', value: '0 / 2633 kcal' },
          { id: 'plan', label: 'Estado', value: 'Plan activo' },
        ]}
        ctaLabel="Ver plan"
        progressValue={0.5}
        onCtaPress={() => {}}
      />
    );

    expect(getByText('Resumen de hoy')).toBeTruthy();
    expect(getByText('2633 kcal')).toBeTruthy();
    expect(getByText('0 / 2633 kcal')).toBeTruthy();
    expect(getByText('Plan activo')).toBeTruthy();
    expect(getByTestId('summary-stat-0')).toBeTruthy();
    expect(getByTestId('summary-stat-1')).toBeTruthy();
    expect(getByTestId('summary-progress-track')).toBeTruthy();
    expect(getByTestId('summary-progress-fill')).toBeTruthy();
    expect(getByText('Ver plan')).toBeTruthy();
  });
});
