import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { useDiscoverFeed } from '../hooks/useDiscoverFeed';
import { DiscoverFeedItem } from '../types/feed';

const DiscoverFeedItemComponent: React.FC<{ item: DiscoverFeedItem }> = ({ item }) => {
  const reasonDisplay = item.reason.replace(/_/g, ' ').toLowerCase();
  const authorHandle = item.author_handle || item.author_id.substring(0, 10) || 'unknown';
  const timestamp = new Date(item.created_at).toLocaleString();
  const rankScore = item.rank_score.toFixed(2);

  return (
    <View style={styles.feedItem}>
      {/* Header with rank score */}
      <View style={styles.itemHeader}>
        <View>
          <Text style={styles.reasonText}>{reasonDisplay}</Text>
          <Text style={styles.authorText}>{authorHandle}</Text>
        </View>
        <View style={styles.rankContainer}>
          <Text style={styles.rankLabel}>Rank score</Text>
          <Text style={styles.rankScore}>{rankScore}</Text>
        </View>
      </View>

      {/* Content */}
      <Text style={styles.postText}>{item.text}</Text>

      {/* Media (placeholder) */}
      {item.media && item.media.length > 0 && (
        <View style={styles.mediaContainer}>
          {item.media.map((mediaItem, index) => (
            <View key={index} style={styles.mediaItem}>
              <Text style={styles.mediaType}>{mediaItem.type}</Text>
              <Text style={styles.mediaUrl} numberOfLines={1}>
                {mediaItem.url}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Metadata */}
      <View style={styles.metadataContainer}>
        <View style={styles.metadataItem}>
          <Text style={styles.metadataText}>👍 {item.metadata.likes_count} likes</Text>
        </View>
        <View style={styles.metadataItem}>
          <Text style={styles.metadataText}>💬 {item.metadata.comments_count} comments</Text>
        </View>
        <View style={styles.metadataItem}>
          <Text style={styles.metadataText}>🕒 {timestamp}</Text>
        </View>
      </View>
    </View>
  );
};

interface DiscoverFeedScreenProps {
  onBackPress?: () => void;
}

export const DiscoverFeedScreen: React.FC<DiscoverFeedScreenProps> = ({ onBackPress }) => {

  const {
    items,
    loading,
    error,
    hasMore,
    surface: selectedSurface,
    variant,
    requestId,
    refresh,
    loadMore,
    switchSurface,
    clearError,
  } = useDiscoverFeed({
    limit: 20,
    surface: 'mobile',
    autoLoad: true,
  });

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadMore();
    }
  };

  const handleRefresh = () => {
    refresh();
  };

  const handleSurfaceChange = (newSurface: 'mobile' | 'web') => {
    if (selectedSurface !== newSurface) {
      switchSurface(newSurface);
    }
  };

  const handleRetry = () => {
    clearError();
    refresh();
  };

  // Loading state - Initial load
  if (loading && (!items || items.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Discovering great posts...</Text>
      </View>
    );
  }

  // Error state - Initial load or persistent error
  if (error && (!items || items.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Unable to load discover feed</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty state - No discover items available
  if (!items || items.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyTitle}>Nothing to show (yet)</Text>
        <Text style={styles.emptyText}>
          Interact with more posts so we can personalize discoveries for you
        </Text>
        <View style={styles.emptyActions}>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={handleRetry}>
            <Text style={styles.emptyButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isRefreshing = loading && items.length === 0;
  const canLoadMore = hasMore && !loading;

  return (
    <View style={styles.container}>
      {onBackPress && (
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      )}

      {/* Header with tabs */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Discover Feed</Text>
            <Text style={styles.headerSubtitle}>AI-powered suggestions beyond your network</Text>
          </View>
          <View style={styles.headerTags}>
            <Text style={styles.variantTag}>Variant: {variant}</Text>
            {requestId && <Text style={styles.requestTag}>Req: {requestId.slice(0, 8)}</Text>}
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              selectedSurface === 'mobile' && styles.tabButtonActive,
            ]}
            onPress={() => handleSurfaceChange('mobile')}>
            <Text
              style={[
                styles.tabButtonText,
                selectedSurface === 'mobile' && styles.tabButtonTextActive,
              ]}>
              Mobile view
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              selectedSurface === 'web' && styles.tabButtonActive,
            ]}
            onPress={() => handleSurfaceChange('web')}>
            <Text
              style={[
                styles.tabButtonText,
                selectedSurface === 'web' && styles.tabButtonTextActive,
              ]}>
              Web preview
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DiscoverFeedItemComponent item={item} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
            title="Pull to refresh"
            titleColor="#666"
          />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {canLoadMore && (
        <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
          <Text style={styles.loadMoreButtonText}>Load more discoveries</Text>
        </TouchableOpacity>
      )}

      {/* Loading indicator for pagination */}
      {loading && items.length > 0 && (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingMoreText}>Discovering more posts...</Text>
        </View>
      )}

      {/* No more items indicator */}
      {!loading && !hasMore && !error && (
        <View style={styles.endIndicator}>
          <Text style={styles.endIndicatorText}>No more discoveries</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  backButton: {
    marginTop: 12,
    marginLeft: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2933',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  headerTags: {
    alignItems: 'flex-end',
    gap: 4,
  },
  variantTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '600',
  },
  requestTag: {
    fontSize: 10,
    color: '#6b7280',
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tabButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  loadMoreButton: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  loadMoreButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  feedItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reasonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  authorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2933',
    marginTop: 2,
  },
  rankContainer: {
    alignItems: 'flex-end',
  },
  rankLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rankScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  postText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    marginBottom: 12,
  },
  mediaContainer: {
    marginBottom: 12,
  },
  mediaItem: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 8,
    marginBottom: 4,
  },
  mediaType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2933',
  },
  mediaUrl: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 2,
  },
  metadataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  metadataItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metadataText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2933',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2933',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  emptyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  endIndicator: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  endIndicatorText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
