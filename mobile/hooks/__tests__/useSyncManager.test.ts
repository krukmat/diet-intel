import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useSyncManager } from '../useSyncManager';
import { syncManager } from '../../services/SyncManager';
import { Alert } from 'react-native';

jest.mock('../../services/SyncManager', () => ({
  syncManager: {
    addStatusListener: jest.fn(),
    removeStatusListener: jest.fn(),
    getStatus: jest.fn(),
    getConflicts: jest.fn(),
    performSync: jest.fn(),
    forcePullFromServer: jest.fn(),
    forcePushToServer: jest.fn(),
    clearSyncQueue: jest.fn(),
    updateConfig: jest.fn(),
    resolveManualConflict: jest.fn(),
    queueRecipeChange: jest.fn(),
    queueCollectionChange: jest.fn(),
  }
}));

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    Alert: { alert: jest.fn() },
  };
});

describe('useSyncManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (syncManager.getStatus as jest.Mock).mockReturnValue({
      isOnline: true,
      lastSyncTime: 0,
      pendingChanges: 0,
      syncInProgress: false,
      errors: [],
    });
    (syncManager.getConflicts as jest.Mock).mockResolvedValue([]);
  });

  it('initializes status and conflicts', async () => {
    const { result } = renderHook(() => useSyncManager());

    await waitFor(() => {
      expect(result.current.status.isOnline).toBe(true);
    });

    expect(syncManager.addStatusListener).toHaveBeenCalled();
    expect(syncManager.getConflicts).toHaveBeenCalled();
  });

  it('performs sync and refreshes conflicts', async () => {
    (syncManager.performSync as jest.Mock).mockResolvedValue(undefined);
    (syncManager.getConflicts as jest.Mock).mockResolvedValue([{ id: 'c1' }]);

    const { result } = renderHook(() => useSyncManager());

    await act(async () => {
      await result.current.performSync();
    });

    expect(syncManager.performSync).toHaveBeenCalled();
    expect(syncManager.getConflicts).toHaveBeenCalled();
  });

  it('handles force pull errors with alert', async () => {
    (syncManager.forcePullFromServer as jest.Mock).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useSyncManager());

    await act(async () => {
      await result.current.forcePull();
    });

    expect(Alert.alert).toHaveBeenCalled();
  });

  it('updates config and toggles auto sync', async () => {
    const { result } = renderHook(() => useSyncManager());

    act(() => {
      result.current.toggleAutoSync();
    });

    expect(syncManager.updateConfig).toHaveBeenCalledWith({ autoSyncEnabled: false });
  });

  it('resolves all conflicts via alert confirmation', async () => {
    (syncManager.getConflicts as jest.Mock).mockResolvedValue([
      { id: 'c1' },
      { id: 'c2' },
    ]);

    const { result } = renderHook(() => useSyncManager());

    await waitFor(() => {
      expect(result.current.conflicts.length).toBe(2);
    });

    (Alert.alert as jest.Mock).mockImplementation((_title, _message, buttons) => {
      const confirm = buttons?.[1];
      if (confirm && typeof confirm.onPress === 'function') {
        confirm.onPress();
      }
    });

    await act(async () => {
      await result.current.resolveAllConflicts('local');
    });

    expect(syncManager.resolveManualConflict).toHaveBeenCalledTimes(2);
  });

  it('clears queue via confirmation', async () => {
    const { result } = renderHook(() => useSyncManager());

    (Alert.alert as jest.Mock).mockImplementation((_title, _message, buttons) => {
      const confirm = buttons?.[1];
      if (confirm && typeof confirm.onPress === 'function') {
        confirm.onPress();
      }
    });

    await act(async () => {
      await result.current.clearQueue();
    });

    expect(syncManager.clearSyncQueue).toHaveBeenCalled();
  });

  it('returns sync status messages for offline and errors', async () => {
    (syncManager.getStatus as jest.Mock).mockReturnValue({
      isOnline: false,
      lastSyncTime: 0,
      pendingChanges: 12,
      syncInProgress: false,
      errors: [{ message: 'err' }],
    });

    const { result } = renderHook(() => useSyncManager());

    await waitFor(() => {
      expect(result.current.status.isOnline).toBe(false);
    });

    expect(result.current.getSyncStatusMessage()).toContain('Offline');
    expect(result.current.getLastSyncMessage()).toBe('Never synced');
  });
});
