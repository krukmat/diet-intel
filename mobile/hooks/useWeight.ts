/**
 * useWeight Hook - FASE 8.3
 * Custom hook for weight tracking operations
 */

import { useState, useCallback } from 'react';
import { mealLogService } from '../services/MealLogService';
import { WeightEntry, CreateWeightRequest, WeightStats } from '../types/weight';

interface UseWeightReturn {
  entries: WeightEntry[];
  stats: WeightStats | null;
  loading: boolean;
  error: string | null;
  createWeight: (data: CreateWeightRequest) => Promise<WeightEntry>;
  getHistory: (limit?: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useWeight(): UseWeightReturn {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [stats, setStats] = useState<WeightStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createWeight = useCallback(async (data: CreateWeightRequest): Promise<WeightEntry> => {
    setLoading(true);
    setError(null);
    try {
      const entry = await mealLogService.createWeight(data);
      setEntries(prev => [entry, ...prev]);
      return entry;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create weight entry';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getHistory = useCallback(async (limit: number = 30) => {
    setLoading(true);
    setError(null);
    try {
      const history = await mealLogService.getWeightHistory(limit);
      setEntries(history);
      
      // Calculate stats
      if (history.length > 0) {
        const weights = history.map(e => e.weight).sort((a, b) => a - b);
        const current = history[0].weight;
        const min = weights[0];
        const max = weights[weights.length - 1];
        setStats({
          currentWeight: current,
          startingWeight: min,
          targetWeight: max,
          totalLost: min - current
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load weight history';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await getHistory();
  }, [getHistory]);

  return {
    entries,
    stats,
    loading,
    error,
    createWeight,
    getHistory,
    refresh
  };
}
