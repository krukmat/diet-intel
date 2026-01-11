/**
 * Photo Logs Screen - FASE 9.4
 * Timeline view of all food and weight photos with camera capture
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { usePhotoLogs } from '../hooks/usePhotoLogs';
import { PhotoLogEntry, PhotoLogType } from '../types/photoLog';
import * as ImagePicker from 'expo-image-picker';

interface PhotoLogsScreenProps {
  onBackPress?: () => void;
}

export function PhotoLogsScreen({ onBackPress }: PhotoLogsScreenProps): JSX.Element {
  const { logs, loading, error, getPhotos } = usePhotoLogs();
  const [takingPhoto, setTakingPhoto] = useState(false);

  useEffect(() => {
    getPhotos(50);
  }, [getPhotos]);

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setTakingPhoto(true);
      // TODO: Upload photo to server
      Alert.alert('Photo Taken', 'Photo captured! (Upload to be implemented)');
      setTakingPhoto(false);
    }
  };

  const handleSelectFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Photo library permission is needed');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      // TODO: Upload photo to server
      Alert.alert('Photo Selected', 'Photo selected! (Upload to be implemented)');
    }
  };

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

  const navigateBack = () => {
    // This will be called from parent via props or we use the navigation context
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>🏠</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📷 Photos</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleTakePhoto}
          disabled={takingPhoto}
        >
          {takingPhoto ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.actionIcon}>📷</Text>
              <Text style={styles.actionText}>Tomar Foto</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleSelectFromGallery}
        >
          <Text style={styles.actionIcon}>🖼️</Text>
          <Text style={styles.actionText}>Galería</Text>
        </TouchableOpacity>
      </View>

      {loading && logs.length === 0 ? (
        <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={styles.emptyText}>Sin fotos aún</Text>
          <Text style={styles.emptySubtext}>Toma fotos de tus comidas y pesajes para verlas aquí</Text>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#333',
    lineHeight: 28,
  },
  placeholder: {
    width: 40,
  },
  actionsRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
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
