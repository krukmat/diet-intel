import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PlanSelectionList, PlanSummary } from '../PlanSelectionList';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

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

    expect(getByText('plan.list.title')).toBeTruthy();
    expect(getByText('Plan plan-abc123')).toBeTruthy();
    expect(getByText('Plan plan-def456')).toBeTruthy();
    expect(getByText('plan.list.deactivate')).toBeTruthy();
    expect(getByText('plan.list.activate')).toBeTruthy();
  });

  it('calls onToggleActive when button pressed', () => {
    const toggleMock = jest.fn();
    const { getByText } = render(
      <PlanSelectionList plans={samplePlans} loading={false} onToggleActive={toggleMock} />
    );

    fireEvent.press(getByText('plan.list.deactivate'));
    expect(toggleMock).toHaveBeenCalledWith('plan-abc123', true);

    fireEvent.press(getByText('plan.list.activate'));
    expect(toggleMock).toHaveBeenCalledWith('plan-def456', false);
  });

  it('calls onViewPlan when view button pressed', () => {
    const viewMock = jest.fn();
    const { getAllByText } = render(
      <PlanSelectionList
        plans={samplePlans}
        loading={false}
        onToggleActive={jest.fn()}
        onViewPlan={viewMock}
      />
    );

    fireEvent.press(getAllByText('plan.list.view')[0]);
    expect(viewMock).toHaveBeenCalledWith('plan-abc123');
  });
});
