import React from 'react';
import { Alert, ActivityIndicator, Switch } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import {
  SyncStatusIndicator,
  SyncStatusModal,
  SyncStatusBanner,
} from '../SyncStatusComponents';
import { useSyncManager } from '../../hooks/useSyncManager';

jest.mock('../../hooks/useSyncManager', () => ({
  useSyncManager: jest.fn(),
}));

describe('SyncStatusComponents', () => {
  const mockUseSyncManager = useSyncManager as jest.Mock;

  const baseHookValue = {
    status: {
      isOnline: true,
      syncInProgress: false,
      errors: [] as string[],
      pendingChanges: 0,
    },
    conflicts: [] as any[],
    config: {
      autoSyncEnabled: true,
      conflictResolution: 'merge' as const,
    },
    hasConflicts: false,
    hasErrors: false,
    needsAttention: false,
    performSync: jest.fn(),
    forcePull: jest.fn(),
    forcePush: jest.fn(),
    clearQueue: jest.fn(),
    toggleAutoSync: jest.fn(),
    setConflictResolution: jest.fn(),
    getSyncStatusMessage: jest.fn(() => 'All synced'),
    getLastSyncMessage: jest.fn(() => 'Just now'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSyncManager.mockReturnValue(baseHookValue);
  });

  it('renders indicator icon and opens modal', () => {
    const { getByText } = render(<SyncStatusIndicator />);

    expect(getByText('✅')).toBeTruthy();
    fireEvent.press(getByText('✅'));
    expect(getByText('Sync Status')).toBeTruthy();
  });

  it('shows activity indicator while syncing', () => {
    mockUseSyncManager.mockReturnValue({
      ...baseHookValue,
      status: { ...baseHookValue.status, syncInProgress: true },
    });

    const { UNSAFE_getAllByType, queryByText } = render(<SyncStatusIndicator />);

    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
    expect(queryByText('✅')).toBeNull();
  });

  it('renders modal actions and triggers sync handlers', () => {
    const { getByText, UNSAFE_getByType } = render(
      <SyncStatusModal visible onClose={jest.fn()} />
    );

    fireEvent.press(getByText('🔄 Sync Now'));
    fireEvent.press(getByText('📥 Pull from Server'));
    fireEvent.press(getByText('📤 Push to Server'));

    const toggle = UNSAFE_getByType(Switch);
    fireEvent(toggle, 'valueChange', false);

    expect(baseHookValue.performSync).toHaveBeenCalled();
    expect(baseHookValue.forcePull).toHaveBeenCalled();
    expect(baseHookValue.forcePush).toHaveBeenCalled();
    expect(baseHookValue.toggleAutoSync).toHaveBeenCalledWith(false);
  });

  it('shows pending changes and clears queue', () => {
    mockUseSyncManager.mockReturnValue({
      ...baseHookValue,
      status: { ...baseHookValue.status, pendingChanges: 3 },
    });

    const { getByText } = render(<SyncStatusModal visible onClose={jest.fn()} />);

    expect(getByText('3 changes waiting to sync')).toBeTruthy();
    fireEvent.press(getByText('🗑️ Clear Queue'));
    expect(baseHookValue.clearQueue).toHaveBeenCalled();
  });

  it('shows conflicts and errors with alerts', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockUseSyncManager.mockReturnValue({
      ...baseHookValue,
      conflicts: [{ id: 'conflict-1' }],
      hasConflicts: true,
      hasErrors: true,
      status: { ...baseHookValue.status, errors: ['error'] },
    });

    const { getByText } = render(<SyncStatusModal visible onClose={jest.fn()} />);

    expect(getByText('1 conflicts need resolution')).toBeTruthy();
    expect(getByText('1 sync errors')).toBeTruthy();

    fireEvent.press(getByText('Resolve Conflicts'));
    fireEvent.press(getByText('Merge'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Conflicts',
      'Conflict resolution UI will be available in the next update!'
    );
    expect(alertSpy).toHaveBeenCalledWith(
      'Conflict Strategy',
      'Current: Merge versions automatically'
    );
    alertSpy.mockRestore();
  });

  it('renders banner only when attention is needed', () => {
    const { queryByText, getByText, rerender } = render(<SyncStatusBanner />);

    expect(queryByText('Tap for details')).toBeNull();

    mockUseSyncManager.mockReturnValue({
      ...baseHookValue,
      needsAttention: true,
      status: { ...baseHookValue.status, pendingChanges: 2 },
    });

    rerender(<SyncStatusBanner />);
    expect(getByText('Tap for details')).toBeTruthy();
  });
});
