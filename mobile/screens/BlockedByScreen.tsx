import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/ApiService';
import { useAuth } from '../contexts/AuthContext';

interface BlockerUser {
  user_id: string;
  handle: string;
  avatar_url?: string;
  since: string;
  reason?: string;
}

interface BlockersListResponse {
  items: BlockerUser[];
  next_cursor?: string;
}

export const BlockedByScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [blockers, setBlockers] = useState<BlockerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const loadBlockers = async (cursor?: string, append: boolean = false) => {
    if (!user?.id) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    try {
      if (!append) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const response = await apiService.getBlockers(user.id, {
        limit: 20,
        cursor
      });

      const data: BlockersListResponse = response.data;

      if (append) {
        setBlockers(prev => [...prev, ...data.items]);
      } else {
        setBlockers(data.items);
      }

      setNextCursor(data.next_cursor);
    } catch (err) {
      console.error('BlockedByScreen load error:', err);
      setError('Failed to load users who blocked you');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadBlockers(undefined, false);
  };

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      loadBlockers(nextCursor, true);
    }
  };

  useEffect(() => {
    loadBlockers();
  }, [user?.id]);

  const renderBlocker = ({ item }: { item: BlockerUser }) => (
    <View style={styles.userItem}>
      <TouchableOpacity
        style={styles.userInfo}
        onPress={() => (navigation as any).navigate('profile', { userId: item.user_id })}
      >
        <Image
          source={{ uri: item.avatar_url || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.userDetails}>
          <Text style={styles.handle}>@{item.handle}</Text>
          <Text style={styles.blockedDate}>
            Blocked you {new Date(item.since).toLocaleDateString()}
          </Text>
          {item.reason && (
            <Text style={styles.reason}>Reason: {item.reason}</Text>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.blockedNotice}>
        <Text style={styles.blockedNoticeText}>Blocked you</Text>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading users who blocked you...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Users Who Blocked You</Text>
      </View>

      {blockers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No users have blocked you.</Text>
        </View>
      ) : (
        <FlatList
          testID="blocked-by-list"
          data={blockers}
          renderItem={renderBlocker}
          keyExtractor={(item) => item.user_id}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={styles.listContainer}
        />
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
    borderRadius: 8,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  handle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  blockedDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  reason: {
    fontSize: 12,
    color: '#888',
  },
  blockedNotice: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  blockedNoticeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#d9534f',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
