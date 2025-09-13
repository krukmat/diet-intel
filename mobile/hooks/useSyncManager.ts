// React Hook for Sync Manager Integration
// Provides reactive sync status and control functions for components

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { syncManager } from '../services/SyncManager';

interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: number;
  pendingChanges: number;
  syncInProgress: boolean;
  errors: any[];
}

interface ConflictItem {
  id: string;
  type: 'recipe' | 'collection';
  localVersion: any;
  remoteVersion: any;
  localModified: number;
  remoteModified: number;
}

interface SyncConfig {
  autoSyncEnabled: boolean;
  syncInterval: number;
  conflictResolution: 'local' | 'remote' | 'merge' | 'manual';
  maxRetries: number;
  batchSize: number;
}

export function useSyncManager() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    lastSyncTime: 0,
    pendingChanges: 0,
    syncInProgress: false,
    errors: [],
  });
  
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [config, setConfig] = useState<SyncConfig>({
    autoSyncEnabled: true,
    syncInterval: 60000,
    conflictResolution: 'merge',
    maxRetries: 3,
    batchSize: 10,
  });

  // Initialize sync manager and listen for status changes
  useEffect(() => {
    const handleStatusChange = (newStatus: SyncStatus) => {
      setStatus(newStatus);
    };

    syncManager.addStatusListener(handleStatusChange);
    
    // Load initial status
    setStatus(syncManager.getStatus());
    
    // Load conflicts
    loadConflicts();

    return () => {
      syncManager.removeStatusListener(handleStatusChange);
    };
  }, []);

  const loadConflicts = useCallback(async () => {
    try {
      const conflictList = await syncManager.getConflicts();
      setConflicts(conflictList);
    } catch (error) {
      console.error('Failed to load conflicts:', error);
    }
  }, []);

  // Manual sync operations
  const performSync = useCallback(async () => {
    try {
      await syncManager.performSync();
      await loadConflicts(); // Refresh conflicts after sync
    } catch (error) {
      Alert.alert('Sync Error', 'Failed to sync data. Please try again.');
      console.error('Sync failed:', error);
    }
  }, [loadConflicts]);

  const forcePull = useCallback(async () => {
    try {
      await syncManager.forcePullFromServer();
      Alert.alert('✅ Sync Complete', 'Successfully pulled latest data from server.');
      await loadConflicts();
    } catch (error) {
      Alert.alert('Pull Error', 'Failed to pull data from server. Please check your connection.');
      console.error('Force pull failed:', error);
    }
  }, [loadConflicts]);

  const forcePush = useCallback(async () => {
    try {
      await syncManager.forcePushToServer();
      Alert.alert('✅ Push Complete', 'Successfully pushed local changes to server.');
    } catch (error) {
      Alert.alert('Push Error', 'Failed to push data to server. Changes will be retried automatically.');
      console.error('Force push failed:', error);
    }
  }, []);

  const clearQueue = useCallback(async () => {
    Alert.alert(
      'Clear Sync Queue',
      'This will remove all pending sync operations. Local changes may be lost. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await syncManager.clearSyncQueue();
              Alert.alert('✅ Queue Cleared', 'All pending sync operations have been removed.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear sync queue.');
            }
          },
        },
      ]
    );
  }, []);

  // Configuration management
  const updateConfig = useCallback((newConfig: Partial<SyncConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    syncManager.updateConfig(newConfig);
  }, [config]);

  const toggleAutoSync = useCallback(() => {
    updateConfig({ autoSyncEnabled: !config.autoSyncEnabled });
  }, [config.autoSyncEnabled, updateConfig]);

  const setConflictResolution = useCallback((resolution: SyncConfig['conflictResolution']) => {
    updateConfig({ conflictResolution: resolution });
  }, [updateConfig]);

  // Conflict resolution
  const resolveConflict = useCallback(async (
    conflictId: string, 
    resolution: 'local' | 'remote' | 'merged',
    mergedData?: any
  ) => {
    try {
      await syncManager.resolveManualConflict(conflictId, resolution, mergedData);
      await loadConflicts();
      
      Alert.alert(
        '✅ Conflict Resolved',
        `Conflict resolved using ${resolution} version.`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to resolve conflict. Please try again.');
      console.error('Failed to resolve conflict:', error);
    }
  }, [loadConflicts]);

  const resolveAllConflicts = useCallback(async (resolution: 'local' | 'remote' | 'merged') => {
    Alert.alert(
      'Resolve All Conflicts',
      `This will resolve all ${conflicts.length} conflicts using the ${resolution} version. Are you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve All',
          style: 'default',
          onPress: async () => {
            try {
              for (const conflict of conflicts) {
                await syncManager.resolveManualConflict(conflict.id, resolution);
              }
              await loadConflicts();
              
              Alert.alert(
                '✅ All Conflicts Resolved',
                `Resolved ${conflicts.length} conflicts using ${resolution} version.`
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to resolve all conflicts.');
            }
          },
        },
      ]
    );
  }, [conflicts, loadConflicts]);

  // Queue management for recipes
  const queueRecipeChange = useCallback(async (
    recipeId: string,
    action: 'create' | 'update' | 'delete',
    data?: any
  ) => {
    try {
      await syncManager.queueRecipeChange(recipeId, action, data);
    } catch (error) {
      console.error('Failed to queue recipe change:', error);
    }
  }, []);

  const queueCollectionChange = useCallback(async (
    collectionId: string,
    action: 'create' | 'update' | 'delete',
    data?: any
  ) => {
    try {
      await syncManager.queueCollectionChange(collectionId, action, data);
    } catch (error) {
      console.error('Failed to queue collection change:', error);
    }
  }, []);

  // Helper functions
  const getSyncStatusMessage = useCallback(() => {
    if (!status.isOnline) {
      return `📱 Offline - ${status.pendingChanges} changes pending`;
    }
    
    if (status.syncInProgress) {
      return '🔄 Syncing...';
    }
    
    if (status.pendingChanges > 0) {
      return `📤 ${status.pendingChanges} changes to sync`;
    }
    
    if (status.errors.length > 0) {
      return `⚠️ ${status.errors.length} sync errors`;
    }
    
    return '✅ All synced';
  }, [status]);

  const getLastSyncMessage = useCallback(() => {
    if (status.lastSyncTime === 0) {
      return 'Never synced';
    }
    
    const now = Date.now();
    const diff = now - status.lastSyncTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    return 'Just now';
  }, [status.lastSyncTime]);

  const hasConflicts = conflicts.length > 0;
  const hasErrors = status.errors.length > 0;
  const needsAttention = hasConflicts || hasErrors || (!status.isOnline && status.pendingChanges > 10);

  return {
    // Status
    status,
    conflicts,
    config,
    hasConflicts,
    hasErrors,
    needsAttention,
    
    // Operations
    performSync,
    forcePull,
    forcePush,
    clearQueue,
    
    // Configuration
    updateConfig,
    toggleAutoSync,
    setConflictResolution,
    
    // Conflict resolution
    resolveConflict,
    resolveAllConflicts,
    loadConflicts,
    
    // Queue management
    queueRecipeChange,
    queueCollectionChange,
    
    // Helpers
    getSyncStatusMessage,
    getLastSyncMessage,
  };
}