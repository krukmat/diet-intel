// Sync Status UI Components
// Provides visual feedback and controls for sync operations

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useSyncManager } from '../hooks/useSyncManager';

// Simple sync status indicator for headers/toolbars
export function SyncStatusIndicator() {
  const { status, getSyncStatusMessage } = useSyncManager();
  const [showModal, setShowModal] = useState(false);

  const getStatusColor = () => {
    if (!status.isOnline) return '#FF9500'; // Orange for offline
    if (status.syncInProgress) return '#007AFF'; // Blue for syncing
    if (status.errors.length > 0) return '#FF3B30'; // Red for errors
    if (status.pendingChanges > 0) return '#FF9500'; // Orange for pending
    return '#34C759'; // Green for synced
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.syncIndicator, { backgroundColor: getStatusColor() }]}
        onPress={() => setShowModal(true)}
      >
        {status.syncInProgress ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.syncIndicatorText}>
            {!status.isOnline ? '📱' : status.pendingChanges > 0 ? '📤' : '✅'}
          </Text>
        )}
      </TouchableOpacity>
      
      <SyncStatusModal
        visible={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

// Comprehensive sync status modal
export function SyncStatusModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const {
    status,
    conflicts,
    config,
    hasConflicts,
    hasErrors,
    performSync,
    forcePull,
    forcePush,
    clearQueue,
    toggleAutoSync,
    setConflictResolution,
    getSyncStatusMessage,
    getLastSyncMessage,
  } = useSyncManager();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Sync Status</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Current Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Current Status</Text>
            <View style={styles.statusCard}>
              <Text style={styles.statusMessage}>{getSyncStatusMessage()}</Text>
              <Text style={styles.lastSync}>Last sync: {getLastSyncMessage()}</Text>
              
              {status.syncInProgress && (
                <View style={styles.progressContainer}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.progressText}>Syncing in progress...</Text>
                </View>
              )}
            </View>
          </View>

          {/* Network Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🌐 Network</Text>
            <View style={styles.networkCard}>
              <Text style={[styles.networkStatus, { color: status.isOnline ? '#34C759' : '#FF9500' }]}>
                {status.isOnline ? '✅ Online' : '📱 Offline'}
              </Text>
              <Text style={styles.networkDetails}>
                {status.isOnline 
                  ? 'Connected to server'
                  : `${status.pendingChanges} changes will sync when online`
                }
              </Text>
            </View>
          </View>

          {/* Pending Changes */}
          {status.pendingChanges > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📤 Pending Changes</Text>
              <View style={styles.pendingCard}>
                <Text style={styles.pendingCount}>{status.pendingChanges} changes waiting to sync</Text>
                <Text style={styles.pendingNote}>
                  Changes are automatically synced when online
                </Text>
              </View>
            </View>
          )}

          {/* Conflicts */}
          {hasConflicts && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚠️ Conflicts</Text>
              <View style={styles.conflictCard}>
                <Text style={styles.conflictCount}>{conflicts.length} conflicts need resolution</Text>
                <TouchableOpacity 
                  style={styles.resolveButton}
                  onPress={() => Alert.alert('Conflicts', 'Conflict resolution UI will be available in the next update!')}
                >
                  <Text style={styles.resolveButtonText}>Resolve Conflicts</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Errors */}
          {hasErrors && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>❌ Sync Errors</Text>
              <View style={styles.errorCard}>
                <Text style={styles.errorCount}>{status.errors.length} sync errors</Text>
                <Text style={styles.errorNote}>
                  Failed operations will be retried automatically
                </Text>
              </View>
            </View>
          )}

          {/* Manual Controls */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎛️ Manual Controls</Text>
            <View style={styles.controlsCard}>
              <TouchableOpacity 
                style={[styles.controlButton, styles.primaryButton]}
                onPress={performSync}
                disabled={status.syncInProgress || !status.isOnline}
              >
                <Text style={styles.primaryButtonText}>
                  {status.syncInProgress ? 'Syncing...' : '🔄 Sync Now'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.controlButton, styles.secondaryButton]}
                onPress={forcePull}
                disabled={status.syncInProgress || !status.isOnline}
              >
                <Text style={styles.secondaryButtonText}>📥 Pull from Server</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.controlButton, styles.secondaryButton]}
                onPress={forcePush}
                disabled={status.syncInProgress || !status.isOnline}
              >
                <Text style={styles.secondaryButtonText}>📤 Push to Server</Text>
              </TouchableOpacity>

              {status.pendingChanges > 0 && (
                <TouchableOpacity 
                  style={[styles.controlButton, styles.dangerButton]}
                  onPress={clearQueue}
                >
                  <Text style={styles.dangerButtonText}>🗑️ Clear Queue</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ Sync Settings</Text>
            <View style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Auto Sync</Text>
                <Switch
                  value={config.autoSyncEnabled}
                  onValueChange={toggleAutoSync}
                  trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
                  thumbColor="white"
                />
              </View>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Conflict Resolution</Text>
                <TouchableOpacity 
                  style={styles.conflictStrategyButton}
                  onPress={() => Alert.alert('Conflict Strategy', 'Current: Merge versions automatically')}
                >
                  <Text style={styles.conflictStrategyText}>
                    {config.conflictResolution === 'merge' ? 'Merge' : 
                     config.conflictResolution === 'local' ? 'Local Wins' :
                     config.conflictResolution === 'remote' ? 'Remote Wins' : 'Manual'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.settingNote}>
                Auto sync checks for changes every minute when online
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// Compact sync banner for showing at top of screens
export function SyncStatusBanner() {
  const { status, needsAttention, getSyncStatusMessage } = useSyncManager();
  const [showModal, setShowModal] = useState(false);

  if (!needsAttention && status.isOnline && status.pendingChanges === 0) {
    return null; // Don't show banner when everything is fine
  }

  const getBannerColor = () => {
    if (!status.isOnline) return '#FF9500';
    if (status.errors.length > 0) return '#FF3B30';
    if (status.pendingChanges > 10) return '#FF9500';
    return '#007AFF';
  };

  return (
    <>
      <TouchableOpacity 
        style={[styles.banner, { backgroundColor: getBannerColor() }]}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.bannerText}>{getSyncStatusMessage()}</Text>
        <Text style={styles.bannerAction}>Tap for details</Text>
      </TouchableOpacity>
      
      <SyncStatusModal
        visible={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Sync Indicator
  syncIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  syncIndicatorText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },

  // Banner
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bannerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  bannerAction: {
    color: 'white',
    fontSize: 12,
    opacity: 0.8,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    fontSize: 16,
    color: '#8E8E93',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  placeholder: {
    width: 60,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },

  // Status Card
  statusCard: {
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 12,
  },
  statusMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  lastSync: {
    fontSize: 14,
    color: '#8E8E93',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
  },

  // Network Card
  networkCard: {
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 12,
  },
  networkStatus: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  networkDetails: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Pending Card
  pendingCard: {
    backgroundColor: '#FFF3CD',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  pendingCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  pendingNote: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Conflict Card
  conflictCard: {
    backgroundColor: '#FFE6E6',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  conflictCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  resolveButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  resolveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  // Error Card
  errorCard: {
    backgroundColor: '#FFE6E6',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  errorCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  errorNote: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Controls Card
  controlsCard: {
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 12,
  },
  controlButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  dangerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Settings Card
  settingsCard: {
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  conflictStrategyButton: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  conflictStrategyText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  settingNote: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
    fontStyle: 'italic',
  },
});