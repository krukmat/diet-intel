/**
 * usePhotoLogs Hook - FASE 9.3
 * Custom hook for photo logs operations
 */

import { useState, useCallback } from 'react';
import { mealLogService } from '../services/MealLogService';
import { PhotoLogEntry } from '../types/photoLog';

interface UsePhotoLogsReturn {
  logs: PhotoLogEntry[];
  loading: boolean;
  error: string | null;
  getPhotos: (limit?: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePhotoLogs(): UsePhotoLogsReturn {
  const [logs, setLogs] = useState<PhotoLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPhotos = useCallback(async (limit: number = 50) => {
    setLoading(true);
    setError(null);
    try {
      const photoLogs = await mealLogService.getPhotoLogs(limit);
      setLogs(photoLogs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load photo logs';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await getPhotos();
  }, [getPhotos]);

  return {
    logs,
    loading,
    error,
    getPhotos,
    refresh
  };
}
