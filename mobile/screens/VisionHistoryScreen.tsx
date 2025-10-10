import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { visionLogService } from '../services/VisionLogService';
import type { VisionHistoryState, VisionLogResponse, VisionHistoryParams, VisionErrorResponse } from '../types/visionLog';

interface VisionHistoryScreenProps {
  navigation: any; // Según especificaciones de last_sprint.md
}

const VisionHistoryScreen: React.FC<VisionHistoryScreenProps> = ({ navigation }) => {
  // Estado exactamente como especificado en last_sprint.md
  const [historyState, setHistoryState] = useState<VisionHistoryState>({
    logs: [],
    isLoading: false,
    hasMore: true,
    error: null,
  });

  // Filtros consistentes con UI existente
  const [activeFilters, setActiveFilters] = useState<VisionHistoryParams>({
    limit: 20,
    offset: 0,
    date_from: null,
    date_to: null,
  });

  // Lógica de carga como especificado en last_sprint.md
  const loadHistory = useCallback(async (loadMore = false) => {
    try {
      setHistoryState(prev => ({ ...prev, isLoading: true, error: null }));

      const result = await visionLogService.getAnalysisHistory({
        ...activeFilters,
        offset: loadMore ? historyState.logs.length : 0,
      });

      setHistoryState(prev => ({
        ...prev,
        isLoading: false,
        logs: loadMore ? [...prev.logs, ...result.logs] : result.logs,
        hasMore: result.logs.length === activeFilters.limit,
      }));
    } catch (error) {
      setHistoryState(prev => ({
        ...prev,
        isLoading: false,
        error: {
          error: 'HISTORY_LOAD_FAILED',
          detail: error instanceof Error ? error.message : 'Failed to load history',
          error_code: 'HISTORY_LOAD_FAILED',
        },
      }));
    }
  }, [activeFilters, historyState.logs.length]);

  // useEffect para carga inicial
  useEffect(() => {
    loadHistory(false);
  }, []);

  // Header consistente según last_sprint.md
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← {t('common.back', 'Back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('vision.history.title', 'Analysis History')}</Text>
    </View>
  );

  // Lista optimizada según last_sprint.md
  const renderHistoryItem = useCallback(({ item }: { item: VisionLogResponse }) => (
    <TouchableOpacity style={styles.historyItem}>
      <Text style={styles.mealType}>{item.meal_type}</Text>
      <Text style={styles.calories}>{item.estimated_portions.total_calories} cal</Text>
      <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
    </TouchableOpacity>
  ), []);

  // Estados empty y error según last_sprint.md
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{t('vision.history.empty', 'No analysis history yet')}</Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorState}>
      <Text style={styles.errorText}>{historyState.error?.detail || 'Failed to load history'}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => loadHistory(false)}
      >
        <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Renderiza el contenido según estado
  const renderContent = () => {
    if (historyState.error) {
      return renderErrorState();
    }

    if (historyState.logs.length === 0 && !historyState.isLoading) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={historyState.logs}
        renderItem={renderHistoryItem}
        keyExtractor={(item) => item.id}
        onEndReached={() => historyState.hasMore && loadHistory(true)}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={historyState.isLoading}
            onRefresh={() => loadHistory(false)}
          />
        }
        contentContainerStyle={styles.listContainer}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#007AFF', // Consistente con navegación existente
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 20,
  },
  historyItem: {
    backgroundColor: 'white',
    marginVertical: 8,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  mealType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  calories: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorState: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 15,
  },
  retryText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default VisionHistoryScreen;
