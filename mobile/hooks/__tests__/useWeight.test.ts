/**
 * Tests for useWeight hook - FASE 8.3
 */

import { renderHook, act } from '@testing-library/react-native';
import { useWeight } from '../useWeight';
import { mealLogService } from '../../services/MealLogService';
import { WeightEntry } from '../../types/weight';

jest.mock('../../services/MealLogService');

describe('useWeight Hook', () => {
  let mockEntries: WeightEntry[];

  beforeEach(() => {
    jest.clearAllMocks();
    mockEntries = [
      {
        id: 'w1',
        weight: 75.0,
        date: new Date('2026-01-09'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  describe('Initial state', () => {
    it('should start with empty entries', () => {
      (mealLogService.getWeightHistory as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => useWeight());

      expect(result.current.entries).toEqual([]);
      expect(result.current.stats).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should load weight history', async () => {
      (mealLogService.getWeightHistory as jest.Mock).mockResolvedValue(mockEntries);

      const { result } = renderHook(() => useWeight());

      await act(async () => {
        await result.current.getHistory();
      });

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0].weight).toBe(75.0);
    });

    it('should calculate stats correctly', async () => {
      const entriesWithMultiple: WeightEntry[] = [
        { id: 'w1', weight: 75.0, date: new Date(), createdAt: new Date(), updatedAt: new Date() },
        { id: 'w2', weight: 74.0, date: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ];
      (mealLogService.getWeightHistory as jest.Mock).mockResolvedValue(entriesWithMultiple);

      const { result } = renderHook(() => useWeight());

      await act(async () => {
        await result.current.getHistory();
      });

      expect(result.current.stats).not.toBeNull();
      expect(result.current.stats?.currentWeight).toBe(75.0);
    });

    it('should set error on failure', async () => {
      (mealLogService.getWeightHistory as jest.Mock).mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() => useWeight());

      await act(async () => {
        await result.current.getHistory();
      });

      expect(result.current.error).toBe('API error');
    });
  });

  describe('createWeight', () => {
    it('should add new entry to list', async () => {
      (mealLogService.getWeightHistory as jest.Mock).mockResolvedValue([]);
      const newEntry: WeightEntry = {
        id: 'w-new',
        weight: 73.5,
        date: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (mealLogService.createWeight as jest.Mock).mockResolvedValue(newEntry);

      const { result } = renderHook(() => useWeight());

      await act(async () => {
        await result.current.createWeight({ weight: 73.5 });
      });

      expect(result.current.entries).toHaveLength(1);
    });

    it('should set error on failure', async () => {
      (mealLogService.getWeightHistory as jest.Mock).mockResolvedValue([]);
      (mealLogService.createWeight as jest.Mock).mockRejectedValue(new Error('Create failed'));

      const { result } = renderHook(() => useWeight());

      await act(async () => {
        try {
          await result.current.createWeight({ weight: 73.5 });
        } catch (e) {}
      });

      expect(result.current.error).toBe('Create failed');
    });
  });

  describe('refresh', () => {
    it('should reload history', async () => {
      (mealLogService.getWeightHistory as jest.Mock).mockResolvedValue(mockEntries);

      const { result } = renderHook(() => useWeight());

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.entries).toHaveLength(1);
    });
  });
});
