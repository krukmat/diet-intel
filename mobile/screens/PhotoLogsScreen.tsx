/**
 * Photo Logs Screen - FASE 9.4
 * Timeline view of all food and weight photos
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { usePhotoLogs } from '../hooks/usePhotoLogs';
import { PhotoLogEntry, PhotoLogType } from '../types/photoLog';

export function PhotoLogsScreen(): JSX.Element {
  const { logs, loading, error, getPhotos } = usePhotoLogs();

  useEffect(() => {
    getPhotos(50);
  }, [getPhotos]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeLabel = (type: PhotoLogType): string => {
    switch (type) {
      case 'meal': return 'Comida';
      case 'weigh-in': return 'Peso';
      case 'ocr': return 'OCR';
      default: return 'Foto';
    }
  };

  const getTypeColor = (type: PhotoLogType): string => {
    switch (type) {
      case 'meal': return '#4CAF50';
      case 'weigh-in': return '#2196F3';
      case 'ocr': return '#FF9800';
      default: return '#999';
    }
  };

  const screenWidth = Dimensions.get('window').width;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Photo Timeline</Text>
        <Text style={styles.subtitle}>{logs.length} photos</Text>
      </View>

      {loading && logs.length === 0 ? (
        <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>No photos yet</Text>
          <Text style={styles.emptySubtext}>Take photos of your meals and weigh-ins to see them here</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
          {logs.map((log: PhotoLogEntry) => (
            <View key={log.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.typeBadge, { backgroundColor: getTypeColor(log.type) }]}>
                  <Text style={styles.typeText}>{getTypeLabel(log.type)}</Text>
                </View>
                <Text style={styles.dateText}>{formatDate(log.timestamp)}</Text>
              </View>
              
              {log.photoUrl && (
                <Image
                  source={{ uri: log.photoUrl }}
                  style={[styles.photo, { width: screenWidth - 48 }]}
                  resizeMode="cover"
                />
              )}
              
              {log.description && (
                <Text style={styles.description}>{log.description}</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  loader: {
    marginTop: 32,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
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
  scroll: {
    flex: 1,
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  photo: {
    height: 200,
  },
  description: {
    padding: 12,
    fontSize: 14,
    color: '#666',
    backgroundColor: '#fafafa',
  },
});
