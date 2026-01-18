/**
 * Tests for QuickActionsRow component
 */

import React from 'react';
import { render, within } from '@testing-library/react-native';
import { QuickActionsRow } from '../QuickActionsRow';

describe('QuickActionsRow', () => {
  it('renders actions in the provided order', () => {
    const actions = [
      { id: 'plan-ai', label: 'Plan IA', onPress: () => {} },
      { id: 'register', label: 'Registrar', onPress: () => {} },
      { id: 'progress', label: 'Progreso', onPress: () => {} },
    ];

    const { getByTestId } = render(<QuickActionsRow actions={actions} />);

    expect(within(getByTestId('quick-action-0')).getByText('Plan IA')).toBeTruthy();
    expect(within(getByTestId('quick-action-1')).getByText('Registrar')).toBeTruthy();
    expect(within(getByTestId('quick-action-2')).getByText('Progreso')).toBeTruthy();
  });
});
