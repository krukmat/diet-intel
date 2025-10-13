import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/ApiService';

// EPIC_A.A3: Pantalla para listar usuarios que han bloqueado al usuario actual

export const BlockedByScreen: React.FC = () => {
  const navigation = useNavigation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    loadBlockers(true);
  }, []);

  const loadBlockers = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setItems([]);
        setNextCursor(null);
      } else {
        setRefreshing(true);
      }

      const cursor = reset ? undefined : nextCursor;
      const response = await apiService.getBlockers('me', { limit: 20, cursor });
      const data = response.data;

      if (reset) {
        setItems(data.items || []);
      } else {
        setItems(prev => [...prev, ...(data.items || [])]);
      }

      setNextCursor(data.next_cursor || null);
    } catch (error) {
      console.error('BlockedByScreen load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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
          Blocked you {item.since ? new Date(item.since).toLocaleDateString() : 'recently'}
        </Text>
        {item.reason && (
          <Text style={styles.reason}>Reason: {item.reason}</Text>
        )}
      </View>

      {/* Info icon */}
      <View style={styles.infoIcon}>
        <Text style={styles.infoIconText}>ℹ️</Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No users have blocked you</Text>
      <Text style={styles.emptySubtext}>This list shows who has blocked your account</Text>
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your blockers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Blocked By</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Info Notice */}
      <View style={styles.infoNotice}>
        <Text style={styles.infoText}>
          These users have blocked you. You cannot interact with them.
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.user_id}
        renderItem={renderUserItem}
        onEndReached={() => nextCursor && loadBlockers(false)}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={() => loadBlockers(true)}
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
  infoNotice: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  infoText: {
    fontSize: 14,
    color: '#1565c0',
    textAlign: 'center',
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
  infoIcon: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  infoIconText: {
    fontSize: 18,
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
