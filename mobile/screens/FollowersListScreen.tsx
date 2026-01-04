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

// EPIC_A.A2: Pantalla de lista de followers con FlatList + pull-to-refresh

interface FollowItem {
  user_id: string;
  handle: string;
  avatar_url?: string;
  since: string;
}

export const FollowersListScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute() as { params?: { userId?: string } };
  const [followers, setFollowers] = useState<FollowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get userId from route params
  const userId = route.params?.userId || 'current'; // Fallback

  useEffect(() => {
    loadFollowers();
  }, [userId]);

  const loadFollowers = useCallback(async (cursor?: string | null, refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else if (cursor) setLoadingMore(true);
      else setLoading(true);

      setError(null);

      const response = await apiService.getFollowers(userId, {
        limit: 20,
        cursor: cursor || null,
      });

      const { items, next_cursor } = response.data;

      if (refresh || !cursor) {
        setFollowers(items);
      } else {
        setFollowers(prev => [...prev, ...items]);
      }

      setNextCursor(next_cursor);
    } catch (err) {
      console.error('Load followers error:', err);
      setError('Failed to load followers');

      if (err.response?.status === 401) {
        Alert.alert('Error', 'Please log in to view followers');
        navigation.goBack();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [userId, navigation]);

  const handleRefresh = useCallback(() => {
    loadFollowers(null, true);
  }, [loadFollowers]);

  const handleLoadMore = useCallback(() => {
    if (nextCursor && !loadingMore) {
      loadFollowers(nextCursor);
    }
  }, [nextCursor, loadingMore, loadFollowers]);

  const renderFollowerItem = ({ item }: { item: FollowItem }) => (
    <TouchableOpacity
      style={styles.followerItem}
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
        style={styles.followButton}
        onPress={() => {
          // Follow/unfollow logic - placeholder for now
          console.log('Follow/unfollow:', item.user_id);
        }}
      >
        <Text style={styles.followButtonText}>Follow</Text>
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

    if (!nextCursor && followers.length > 0) {
      return (
        <View style={styles.footerLoader}>
          <Text style={styles.footerText}>No more followers to load</Text>
        </View>
      );
    }

    return null;
  };

  const EmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No followers yet</Text>
      <Text style={styles.emptySubtext}>When someone follows this user, they will appear here</Text>
    </View>
  );

  if (loading && followers.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Loading followers...</Text>
      </View>
    );
  }

  if (error && followers.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadFollowers()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Followers</Text>
        <Text style={styles.count}>{followers.length} followers</Text>
      </View>

      {/* Followers List */}
      <FlatList
        testID="followers-flatlist"
        data={followers}
        keyExtractor={(item) => item.user_id}
        renderItem={renderFollowerItem}
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
        contentContainerStyle={followers.length === 0 ? styles.emptyList : undefined}
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
  followerItem: {
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
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  followButtonText: {
    color: '#fff',
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
