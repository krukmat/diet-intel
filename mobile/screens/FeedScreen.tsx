import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFeed } from '../hooks/useFeed';

// EPIC_A.A4: Social Activity Feed Screen with pagination (~900 tokens)

interface FeedItemType {
  id: string;
  user_id: string;
  actor_id: string;
  event_name: string;
  payload: Record<string, any>;
  created_at: string;
}

const FeedItem: React.FC<{ item: FeedItemType }> = ({ item }) => {
  const navigation = useNavigation();

  // Extract actor handle (truncate if too long)
  const actorHandle = item.actor_id.substring(0, 8) || 'unknown';
  const timestamp = new Date(item.created_at).toLocaleString();

  // Format the activity message based on event type
  const getActivityMessage = (): string => {
    switch (item.event_name) {
      case 'UserAction.UserFollowed':
        const targetId = item.payload?.target_id?.substring(0, 8) || 'someone';
        return `${targetId} was followed`;
      case 'UserAction.UserUnfollowed':
        const unfollowedId = item.payload?.target_id?.substring(0, 8) || 'someone';
        return `${unfollowedId} was unfollowed`;
      case 'UserAction.UserBlocked':
        const blockedId = item.payload?.blocked_id?.substring(0, 8) || 'someone';
        const reason = item.payload?.reason ? ` (${item.payload.reason})` : '';
        return `${blockedId} was blocked${reason}`;
      case 'UserAction.UserUnblocked':
        const unblockedId = item.payload?.blocked_id?.substring(0, 8) || 'someone';
        return `${unblockedId} was unblocked`;
      default:
        return 'Unknown activity';
    }
  };

  return (
    <View style={styles.feedItem} testID={`feed-item-${item.id}`}>
      {/* Avatar placeholder */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText} testID={`avatar-${item.id}`}>
            {item.actor_id.substring(0, 2).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        <Text style={styles.activityText} testID={`activity-text-${item.id}`}>
          {getActivityMessage()}
        </Text>
        <Text style={styles.timestamp}>
          {timestamp}
        </Text>
      </View>

      {/* Optional: Click to view profile */}
      <TouchableOpacity
        style={styles.profileLink}
        testID={`profile-link-${item.id}`}
        onPress={() => {
          // TODO: Navigate to user profile if needed
          console.log('Navigate to user:', item.actor_id);
        }}
      >
        <Text style={styles.profileLinkText}>View Profile</Text>
      </TouchableOpacity>
    </View>
  );
};

export const FeedScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    data: feedItems,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    retry
  } = useFeed();

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadMore();
    }
  };

  const handleRefresh = () => {
    refresh();
  };

  const handleRetry = () => {
    retry();
  };

  // Loading state - Initial load
  if (loading && (!feedItems || feedItems.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your feed...</Text>
      </View>
    );
  }

  // Error state - Initial load or persistent error
  if (error && (!feedItems || feedItems.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Unable to load feed</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty state - No feed items available
  if (!feedItems || feedItems.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>No activity yet</Text>
        <Text style={styles.emptyText}>
          Start following people to see their social activity here
        </Text>
        <View style={styles.emptyActions}>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.emptyButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Social Activity</Text>
        <Text style={styles.headerSubtitle}>Recent events from people you follow</Text>
      </View>

      {/* Feed List */}
      <FlatList
        testID="feed-list"
        data={feedItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FeedItem item={item} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
            title="Pull to refresh"
            titleColor="#666"
          />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Loading indicator for pagination */}
      {loading && feedItems.length > 0 && (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingMoreText}>Loading more...</Text>
        </View>
      )}

      {/* No more items indicator */}
      {!loading && !hasMore && !error && (
        <View style={styles.endIndicator}>
          <Text style={styles.endIndicatorText}>No more activity</Text>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2933',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  feedItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  activityText: {
    fontSize: 16,
    lineHeight: 20,
    color: '#1f2933',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#6b7280',
  },
  profileLink: {
    justifyContent: 'center',
    paddingLeft: 12,
  },
  profileLinkText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
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
