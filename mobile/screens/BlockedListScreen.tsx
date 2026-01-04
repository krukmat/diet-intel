import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
  ToastAndroid,
  Platform,
  RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/ApiService';
import { useAuth } from '../contexts/AuthContext';

interface BlockedUser {
  user_id: string;
  handle: string;
  avatar_url?: string;
  since: string;
  reason?: string;
}

interface BlockedListResponse {
  items: BlockedUser[];
  next_cursor?: string;
}

export const BlockedListScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const loadBlockedUsers = async (cursor?: string, append: boolean = false) => {
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

      const response = await apiService.getBlockedUsers(user.id, {
        limit: 20,
        cursor
      });

      const data: BlockedListResponse = response.data;

      if (append) {
        setBlockedUsers(prev => [...prev, ...data.items]);
      } else {
        setBlockedUsers(data.items);
      }

      setNextCursor(data.next_cursor);
    } catch (err) {
      console.error('BlockedListScreen load error:', err);
      setError('Failed to load blocked users');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadBlockedUsers(undefined, false);
  };

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      loadBlockedUsers(nextCursor, true);
    }
  };

  const handleUnblock = async (targetUserId: string, handle: string) => {
    if (!user?.id) return;

    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock @${handle}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.unblockUser(targetUserId);

              // Remove user from list
              setBlockedUsers(prev => prev.filter(u => u.user_id !== targetUserId));

              const message = `Unblocked @${handle}`;
              if (Platform.OS === 'android') {
                ToastAndroid.show(message, ToastAndroid.SHORT);
              } else {
                Alert.alert('Success', message);
              }
            } catch (err) {
              console.error('Unblock error:', err);
              const message = 'Failed to unblock user';
              if (Platform.OS === 'android') {
                ToastAndroid.show(message, ToastAndroid.SHORT);
              } else {
                Alert.alert('Error', message);
              }
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    loadBlockedUsers();
  }, [user?.id]);

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => (
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
            Blocked {new Date(item.since).toLocaleDateString()}
          </Text>
          {item.reason && (
            <Text style={styles.reason}>Reason: {item.reason}</Text>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.unblockButton}
        onPress={() => handleUnblock(item.user_id, item.handle)}
      >
        <Text style={styles.unblockButtonText}>Unblock</Text>
      </TouchableOpacity>
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
        <Text style={styles.loadingText}>Loading blocked users...</Text>
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
        <Text style={styles.title}>Blocked Users</Text>
      </View>

      {blockedUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>You haven't blocked any users yet.</Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          renderItem={renderBlockedUser}
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
  unblockButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  unblockButtonText: {
    color: '#fff',
    fontSize: 14,
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
