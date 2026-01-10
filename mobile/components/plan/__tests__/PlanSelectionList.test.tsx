import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PlanSelectionList, PlanSummary } from '../PlanSelectionList';

describe('PlanSelectionList', () => {
  const samplePlans: PlanSummary[] = [
    {
      planId: 'plan-abc123',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      dailyCalorieTarget: 1800,
    },
    {
      planId: 'plan-def456',
      isActive: false,
      createdAt: '2026-01-02T00:00:00Z',
      dailyCalorieTarget: 1900,
    },
  ];

  it('renders plan rows and button labels', () => {
    const { getByText } = render(
      <PlanSelectionList plans={samplePlans} loading={false} onToggleActive={jest.fn()} />
    );

    expect(getByText('Planes guardados')).toBeTruthy();
    expect(getByText('Plan plan-abc123')).toBeTruthy();
    expect(getByText('Plan plan-def456')).toBeTruthy();
    expect(getByText('Activo • Desactivar')).toBeTruthy();
    expect(getByText('Activar')).toBeTruthy();
  });

  it('calls onToggleActive when button pressed', () => {
    const toggleMock = jest.fn();
    const { getByText } = render(
      <PlanSelectionList plans={samplePlans} loading={false} onToggleActive={toggleMock} />
    );

    fireEvent.press(getByText('Activo • Desactivar'));
    expect(toggleMock).toHaveBeenCalledWith('plan-abc123', true);

    fireEvent.press(getByText('Activar'));
    expect(toggleMock).toHaveBeenCalledWith('plan-def456', false);
  });
});
