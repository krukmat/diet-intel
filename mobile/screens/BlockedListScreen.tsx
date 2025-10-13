import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/ApiService';

// EPIC_A.A3: Pantalla para listar usuarios bloqueados por el usuario actual

export const BlockedListScreen: React.FC = () => {
  const navigation = useNavigation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    loadBlockedUsers(true);
  }, []);

  const loadBlockedUsers = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setItems([]);
        setNextCursor(null);
      } else {
        setRefreshing(true);
      }

      const cursor = reset ? undefined : nextCursor;
      const response = await apiService.getBlockedUsers('me', { limit: 20, cursor });
      const data = response.data;

      if (reset) {
        setItems(data.items || []);
      } else {
        setItems(prev => [...prev, ...(data.items || [])]);
      }

      setNextCursor(data.next_cursor || null);
    } catch (error) {
      console.error('BlockedListScreen load error:', error);
      Alert.alert('Error', 'Failed to load blocked users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUnblock = async (userId: string, userHandle: string) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock @${userHandle}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.unblockUser(userId);
              // Refresh the list
              loadBlockedUsers(true);
              Alert.alert('Success', `Unblocked @${userHandle}`);
            } catch (error) {
              console.error('Unblock error:', error);
              Alert.alert('Error', 'Failed to unblock user');
            }
          }
        }
      ]
    );
  };

  const renderUserItem = ({ item }: { item: any }) => (
    <View style={styles.userItem}>
      {/* Avatar placeholder */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.handle?.charAt(0)?.toUpperCase() || '?'}
        </Text>
      </View>

      {/* User info */}
      <View style={styles.userInfo}>
        <Text style={styles.handle}>@{item.handle || 'unknown'}</Text>
        <Text style={styles.blockDate}>
          Blocked {item.since ? new Date(item.since).toLocaleDateString() : 'recently'}
        </Text>
        {item.reason && (
          <Text style={styles.reason}>Reason: {item.reason}</Text>
        )}
      </View>

      {/* Unblock button */}
      <TouchableOpacity
        style={styles.unblockButton}
        onPress={() => handleUnblock(item.user_id, item.handle)}
      >
        <Text style={styles.unblockButtonText}>Unblock</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No blocked users</Text>
      <Text style={styles.emptySubtext}>Users you block won't be able to follow you or see your posts</Text>
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading blocked users...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Blocked Users</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.user_id}
        renderItem={renderUserItem}
        onEndReached={() => nextCursor && loadBlockedUsers(false)}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={() => loadBlockedUsers(true)}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={items.length === 0 ? styles.emptyListContainer : undefined}
        showsVerticalScrollIndicator={false}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e1e1e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
  },
  userInfo: {
    flex: 1,
  },
  handle: {
    fontSize: 16,
    fontWeight: '600',
  },
  blockDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  reason: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },
  unblockButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  unblockButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});
