import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/ApiService';
import { DataLoadingManager, ApiWithFallbackStrategy } from '../utils/dataLoadingStrategies';
import type { DashboardData } from '../services/ApiService';
import type { WeightEntry } from '../utils/weightUtils';

export interface PhotoLog {
  id: string;
  timestamp: string;
  photo: string;
  type: 'meal' | 'weigh-in';
  description?: string;
}

export interface TrackDataState {
  dashboard: DashboardData | null;
  weightHistory: WeightEntry[];
  photoLogs: PhotoLog[];
  consumedItems: string[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface UseTrackDataResult extends TrackDataState {
  refetch: () => Promise<void>;
  updateConsumedItems: (items: string[]) => void;
}

// Mock data loaders for fallback
const loadMockDashboard = async (): Promise<DashboardData> => {
  // Mock dashboard data for development/testing
  return {
    active_plan: null,
    consumed_items: [],
    consumed_meals: [],
    progress: {
      calories: { consumed: 0, planned: 2000, percentage: 0 },
      protein: { consumed: 0, planned: 150, percentage: 0 },
      fat: { consumed: 0, planned: 67, percentage: 0 },
      carbs: { consumed: 0, planned: 250, percentage: 0 },
    },
  };
};

const loadMockWeightHistory = async (): Promise<WeightEntry[]> => {
  // Mock weight history
  return [
    { date: '2024-01-01', weight: 75.0 },
    { date: '2024-01-08', weight: 74.5 },
  ];
};

const loadMockPhotoLogs = async (): Promise<PhotoLog[]> => {
  // Mock photo logs
  return [];
};

/**
 * Custom hook for coordinated data loading in TrackScreen
 * Uses Strategy Pattern for flexible data loading with fallbacks
 */
export const useTrackData = (): UseTrackDataResult => {
  const [state, setState] = useState<TrackDataState>({
    dashboard: null,
    weightHistory: [],
    photoLogs: [],
    consumedItems: [],
    loading: true,
    error: null,
    lastUpdated: null,
  });

  // Create data loading managers with strategies
  const createDashboardManager = useCallback(() => {
    const manager = new DataLoadingManager<DashboardData>();
    manager.addStrategy(new ApiWithFallbackStrategy(
      () => apiService.getDashboard().then(res => res.data),
      loadMockDashboard
    ));
    return manager;
  }, []);

  const createWeightHistoryManager = useCallback(() => {
    const manager = new DataLoadingManager<WeightEntry[]>();
    manager.addStrategy(new ApiWithFallbackStrategy(
      async () => {
        const response = await apiService.get('/track/weight/history?limit=30');
        return response.data.entries.map((entry: any) => ({
          date: entry.date.split('T')[0],
          weight: entry.weight,
          photo: entry.photo_url,
        }));
      },
      loadMockWeightHistory
    ));
    return manager;
  }, []);

  const createPhotoLogsManager = useCallback(() => {
    const manager = new DataLoadingManager<PhotoLog[]>();
    manager.addStrategy(new ApiWithFallbackStrategy(
      async () => {
        const response = await apiService.get('/track/photos?limit=50');
        return response.data.logs.map((log: any) => ({
          id: log.id,
          timestamp: log.timestamp,
          photo: log.photo_url,
          type: log.type,
          description: log.description,
        }));
      },
      loadMockPhotoLogs
    ));
    return manager;
  }, []);

  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Load all data in parallel using strategies
      const [dashboardResult, weightResult, photosResult] = await Promise.allSettled([
        createDashboardManager().load(),
        createWeightHistoryManager().load(),
        createPhotoLogsManager().load(),
      ]);

      // Extract results and handle partial failures
      const dashboard = dashboardResult.status === 'fulfilled' ? dashboardResult.value.data : null;
      const weightHistory = weightResult.status === 'fulfilled' ? weightResult.value.data || [] : [];
      const photoLogs = photosResult.status === 'fulfilled' ? photosResult.value.data || [] : [];
      const consumedItems = dashboard?.consumed_items ?? [];

      // Check for any errors (both rejected promises and fulfilled results with errors)
      const errors = [
        dashboardResult.status === 'rejected' ? dashboardResult.reason :
          (dashboardResult.status === 'fulfilled' && dashboardResult.value.error ? dashboardResult.value.error : null),
        weightResult.status === 'rejected' ? weightResult.reason :
          (weightResult.status === 'fulfilled' && weightResult.value.error ? weightResult.value.error : null),
        photosResult.status === 'rejected' ? photosResult.reason :
          (photosResult.status === 'fulfilled' && photosResult.value.error ? photosResult.value.error : null),
      ].filter(Boolean);

      setState({
        dashboard,
        weightHistory,
        photoLogs,
        consumedItems,
        loading: false,
        error: errors.length > 0 ? `Failed to load some data: ${errors.join(', ')}` : null,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error('Critical error loading track data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Critical error loading data. Please try again.',
      }));
    }
  }, [createDashboardManager, createWeightHistoryManager, createPhotoLogsManager]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateConsumedItems = useCallback((items: string[]) => {
    setState(prev => ({ ...prev, consumedItems: items }));
  }, []);

  return {
    ...state,
    refetch: loadData,
    updateConsumedItems,
  };
};
