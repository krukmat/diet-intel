// Offline Experience Components
// Enhanced offline indicators and user guidance

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { useNetworkStatus } from '../hooks/useApiRecipes';
import { useSyncManager } from '../hooks/useSyncManager';

// Offline Status Banner
export const OfflineBanner: React.FC = () => {
  const networkStatus = useNetworkStatus();
  const { status } = useSyncManager();
  const [visible, setVisible] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    const shouldShow = !networkStatus.isConnected;
    setVisible(shouldShow);

    Animated.timing(slideAnim, {
      toValue: shouldShow ? 0 : -60,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [networkStatus.isConnected, slideAnim]);

  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.offlineBanner,
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <View style={styles.bannerContent}>
        <Text style={styles.offlineIcon}>📱</Text>
        <View style={styles.bannerTextContainer}>
          <Text style={styles.bannerTitle}>You're offline</Text>
          <Text style={styles.bannerMessage}>
            {status.pendingChanges > 0 
              ? `${status.pendingChanges} changes will sync when online`
              : 'Some features may be limited'
            }
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

// Offline Error State
interface OfflineErrorProps {
  onRetry?: () => void;
  action?: string;
  showQueueInfo?: boolean;
}

export const OfflineError: React.FC<OfflineErrorProps> = ({ 
  onRetry, 
  action = 'perform this action',
  showQueueInfo = false 
}) => {
  const { status } = useSyncManager();

  const handleRetryWhenOnline = () => {
    Alert.alert(
      'Retry When Online',
      'This action will be automatically retried when you\'re back online.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'OK', 
          onPress: () => {
            // Add to retry queue logic could go here
            if (onRetry) onRetry();
          }
        }
      ]
    );
  };

  return (
    <View style={styles.offlineErrorContainer}>
      <Text style={styles.offlineErrorIcon}>📡❌</Text>
      <Text style={styles.offlineErrorTitle}>Can't {action} offline</Text>
      <Text style={styles.offlineErrorMessage}>
        You need an internet connection to {action}. 
        {showQueueInfo && status.pendingChanges > 0 && (
          ` You have ${status.pendingChanges} changes waiting to sync.`
        )}
      </Text>
      
      <View style={styles.offlineErrorActions}>
        {onRetry && (
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={handleRetryWhenOnline}
          >
            <Text style={styles.retryButtonText}>Retry When Online</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.dismissButton}
          onPress={() => {
            // Handle dismiss - could navigate back or show offline content
          }}
        >
          <Text style={styles.dismissButtonText}>View Offline Content</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Cached Content Indicator
interface CachedContentProps {
  lastUpdated?: Date;
  showWarning?: boolean;
}

export const CachedContentIndicator: React.FC<CachedContentProps> = ({ 
  lastUpdated,
  showWarning = false 
}) => {
  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return 'Recently';
    }
  };

  return (
    <View style={[styles.cachedIndicator, showWarning && styles.cachedWarning]}>
      <Text style={styles.cachedIcon}>{showWarning ? '⚠️' : '💾'}</Text>
      <Text style={styles.cachedText}>
        {showWarning ? 'Data may be outdated' : 'Showing cached content'}
        {lastUpdated && ` • Updated ${formatLastUpdated(lastUpdated)}`}
      </Text>
    </View>
  );
};

// Connection Status Widget
export const ConnectionStatus: React.FC = () => {
  const networkStatus = useNetworkStatus();
  const [showDetails, setShowDetails] = useState(false);

  const getStatusColor = () => {
    if (networkStatus.isConnected) return '#34C759';
    return '#FF9500';
  };

  const getStatusText = () => {
    if (networkStatus.isConnected) {
      return `Connected via ${networkStatus.type}`;
    }
    return 'No internet connection';
  };

  return (
    <TouchableOpacity 
      style={[styles.connectionStatus, { borderColor: getStatusColor() }]}
      onPress={() => setShowDetails(!showDetails)}
    >
      <View style={styles.statusHeader}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>
      
      {showDetails && (
        <View style={styles.statusDetails}>
          <Text style={styles.statusDetail}>
            Network Type: {networkStatus.type || 'Unknown'}
          </Text>
          <Text style={styles.statusDetail}>
            Queued Requests: {networkStatus.queuedRequests}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Offline Recipe Card
interface OfflineRecipeCardProps {
  recipe: {
    id: string;
    name: string;
    image?: string;
    lastSynced?: Date;
  };
  onPress: () => void;
}

export const OfflineRecipeCard: React.FC<OfflineRecipeCardProps> = ({ 
  recipe, 
  onPress 
}) => {
  return (
    <TouchableOpacity style={styles.offlineRecipeCard} onPress={onPress}>
      <View style={styles.recipeCardContent}>
        {recipe.image ? (
          <View style={styles.recipeImage}>
            {/* Image would go here - placeholder for offline */}
            <Text style={styles.imagePlaceholder}>📷</Text>
          </View>
        ) : (
          <View style={styles.noImagePlaceholder}>
            <Text style={styles.noImageText}>🍽️</Text>
          </View>
        )}
        
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeName} numberOfLines={2}>
            {recipe.name}
          </Text>
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>📱 Available offline</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Offline Actions Panel
interface OfflineActionsPanelProps {
  pendingActions: number;
  onViewPending: () => void;
  onRetryAll: () => void;
}

export const OfflineActionsPanel: React.FC<OfflineActionsPanelProps> = ({
  pendingActions,
  onViewPending,
  onRetryAll,
}) => {
  if (pendingActions === 0) {
    return null;
  }

  return (
    <View style={styles.actionsPanel}>
      <View style={styles.actionsPanelHeader}>
        <Text style={styles.actionsPanelTitle}>Pending Actions</Text>
        <Text style={styles.actionsPanelCount}>{pendingActions}</Text>
      </View>
      
      <Text style={styles.actionsPanelMessage}>
        These changes will be synchronized when you're back online.
      </Text>
      
      <View style={styles.actionsPanelButtons}>
        <TouchableOpacity 
          style={styles.viewPendingButton}
          onPress={onViewPending}
        >
          <Text style={styles.viewPendingText}>View Details</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.retryAllButton}
          onPress={onRetryAll}
        >
          <Text style={styles.retryAllText}>Retry All</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Network Quality Indicator
export const NetworkQuality: React.FC = () => {
  const [quality, setQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('excellent');

  // In a real implementation, this would measure network performance
  const getQualityColor = () => {
    switch (quality) {
      case 'excellent': return '#34C759';
      case 'good': return '#30D158';
      case 'fair': return '#FF9500';
      case 'poor': return '#FF3B30';
    }
  };

  const getQualityBars = () => {
    const bars = ['excellent', 'good', 'fair', 'poor'];
    const activeIndex = bars.indexOf(quality);
    
    return bars.map((bar, index) => (
      <View
        key={bar}
        style={[
          styles.qualityBar,
          { 
            backgroundColor: index <= activeIndex ? getQualityColor() : '#E5E5EA',
            height: 8 + (index * 4),
          }
        ]}
      />
    ));
  };

  return (
    <View style={styles.networkQuality}>
      <View style={styles.qualityBars}>
        {getQualityBars()}
      </View>
      <Text style={styles.qualityLabel}>{quality}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  // Offline Banner
  offlineBanner: {
    backgroundColor: '#FF9500',
    paddingVertical: 12,
    paddingHorizontal: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  bannerMessage: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },

  // Offline Error
  offlineErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#F2F2F7',
  },
  offlineErrorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  offlineErrorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  offlineErrorMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  offlineErrorActions: {
    width: '100%',
    maxWidth: 280,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  dismissButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  dismissButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Cached Content Indicator
  cachedIndicator: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  cachedWarning: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FF9500',
    borderWidth: 1,
  },
  cachedIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  cachedText: {
    fontSize: 12,
    color: '#8E8E93',
    flex: 1,
  },

  // Connection Status
  connectionStatus: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 2,
    padding: 12,
    margin: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  statusDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  statusDetail: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },

  // Offline Recipe Card
  offlineRecipeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  recipeCardContent: {
    flexDirection: 'row',
    padding: 16,
  },
  recipeImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  imagePlaceholder: {
    fontSize: 24,
  },
  noImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  noImageText: {
    fontSize: 24,
  },
  recipeInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  offlineIndicator: {
    alignSelf: 'flex-start',
  },
  offlineText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
  },

  // Actions Panel
  actionsPanel: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  actionsPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionsPanelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  actionsPanelCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9500',
  },
  actionsPanelMessage: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 20,
  },
  actionsPanelButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  viewPendingButton: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  viewPendingText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryAllButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  retryAllText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Network Quality
  networkQuality: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qualityBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginRight: 8,
  },
  qualityBar: {
    width: 3,
    marginRight: 2,
    borderRadius: 1,
  },
  qualityLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
});