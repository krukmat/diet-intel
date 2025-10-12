import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { apiService } from '../services/ApiService';

// EPIC_A.A2: Pantalla de lista de following con FlatList + pull-to-refresh

interface FollowItem {
  user_id: string;
  handle: string;
  avatar_url?: string;
  since: string;
}

export const FollowingListScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [following, setFollowing] = useState<FollowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get userId from route params
  const userId = (route.params as any)?.userId || 'current'; // Fallback

  useEffect(() => {
    loadFollowing();
  }, [userId]);

  const loadFollowing = useCallback(async (cursor?: string | null, refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else if (cursor) setLoadingMore(true);
      else setLoading(true);

      setError(null);

      const response = await apiService.getFollowing(userId, {
        limit: 20,
        cursor: cursor || null,
      });

      const { items, next_cursor } = response.data;

      if (refresh || !cursor) {
        setFollowing(items);
      } else {
        setFollowing(prev => [...prev, ...items]);
      }

      setNextCursor(next_cursor);
    } catch (err) {
      console.error('Load following error:', err);
      setError('Failed to load following');

      if (err.response?.status === 401) {
        Alert.alert('Error', 'Please log in to view following');
        navigation.goBack();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [userId, navigation]);

  const handleRefresh = useCallback(() => {
    loadFollowing(null, true);
  }, [loadFollowing]);

  const handleLoadMore = useCallback(() => {
    if (nextCursor && !loadingMore) {
      loadFollowing(nextCursor);
    }
  }, [nextCursor, loadingMore, loadFollowing]);

  const renderFollowingItem = ({ item }: { item: FollowItem }) => (
    <TouchableOpacity
      style={styles.followingItem}
      onPress={() => {
        // Navigate to profile - could be implemented later
        console.log('Navigate to user:', item.user_id);
      }}
    >
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
        )}
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.handle}>@{item.handle}</Text>
        <Text style={styles.followDate}>
          Following since {new Date(item.since).toLocaleDateString()}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.unfollowButton}
        onPress={() => {
          // Show confirmation for unfollow
          Alert.alert(
            'Unfollow User',
            `Are you sure you want to unfollow @${item.handle}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Unfollow',
                style: 'destructive',
                onPress: () => {
                  // Unfollow logic - placeholder for now
                  console.log('Unfollow user:', item.user_id);
                }
              },
            ]
          );
        }}
      >
        <Text style={styles.unfollowButtonText}>Following</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.footerText}>Loading more...</Text>
        </View>
      );
    }

    if (!nextCursor && following.length > 0) {
      return (
        <View style={styles.footerLoader}>
          <Text style={styles.footerText}>No more users to load</Text>
        </View>
      );
    }

    return null;
  };

  const EmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Not following anyone yet</Text>
      <Text style={styles.emptySubtext}>Start following users to see them here</Text>
    </View>
  );

  if (loading && following.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Loading following...</Text>
      </View>
    );
  }

  if (error && following.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadFollowing()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Following</Text>
        <Text style={styles.count}>{following.length} following</Text>
      </View>

      {/* Following List */}
      <FlatList
        data={following}
        keyExtractor={(item) => item.user_id}
        renderItem={renderFollowingItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={<EmptyComponent />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={following.length === 0 ? styles.emptyList : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
    backgroundColor: '#F8F9FA',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  count: {
    fontSize: 14,
    color: '#666',
  },
  followingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E1E5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
  },
  userInfo: {
    flex: 1,
  },
  handle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  followDate: {
    fontSize: 12,
    color: '#666',
  },
  unfollowButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#666',
    backgroundColor: 'transparent',
  },
  unfollowButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  emptyList: {
    flex: 1,
  },
  errorText: {
    fontSize: 16,
    color: '#d9534f',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
