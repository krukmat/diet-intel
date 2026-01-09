/**
 * Tests for usePhotoLogs hook - FASE 9.3
 */

import { renderHook, act } from '@testing-library/react-native';
import { usePhotoLogs } from '../usePhotoLogs';
import { mealLogService } from '../../services/MealLogService';
import { PhotoLogEntry, PhotoLogType } from '../../types/photoLog';

jest.mock('../../services/MealLogService');

describe('usePhotoLogs Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should start with empty logs', () => {
      (mealLogService.getPhotoLogs as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => usePhotoLogs());

      expect(result.current.logs).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('getPhotos', () => {
    it('should load photos', async () => {
      const mockLogs: PhotoLogEntry[] = [
        {
          id: 'p1',
          photoUrl: 'https://example.com/photo1.jpg',
          type: 'meal' as PhotoLogType,
          timestamp: new Date('2026-01-09'),
          description: 'Breakfast',
        },
      ];
      (mealLogService.getPhotoLogs as jest.Mock).mockResolvedValue(mockLogs);

      const { result } = renderHook(() => usePhotoLogs());

      await act(async () => {
        await result.current.getPhotos();
      });

      expect(result.current.logs).toHaveLength(1);
      expect(result.current.logs[0].description).toBe('Breakfast');
    });

    it('should set error on failure', async () => {
      (mealLogService.getPhotoLogs as jest.Mock).mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() => usePhotoLogs());

      await act(async () => {
        await result.current.getPhotos();
      });

      expect(result.current.error).toBe('API error');
    });
  });

  describe('Photo types', () => {
    it('should handle meal photos', async () => {
      const mockLogs: PhotoLogEntry[] = [
        { id: 'p1', photoUrl: 'https://example.com/meal.jpg', type: 'meal' as PhotoLogType, timestamp: new Date() },
      ];
      (mealLogService.getPhotoLogs as jest.Mock).mockResolvedValue(mockLogs);

      const { result } = renderHook(() => usePhotoLogs());

      await act(async () => {
        await result.current.getPhotos();
      });

      expect(result.current.logs[0].type).toBe('meal');
    });

    it('should handle weigh-in photos', async () => {
      const mockLogs: PhotoLogEntry[] = [
        { id: 'p1', photoUrl: 'https://example.com/weigh-in.jpg', type: 'weigh-in' as PhotoLogType, timestamp: new Date() },
      ];
      (mealLogService.getPhotoLogs as jest.Mock).mockResolvedValue(mockLogs);

      const { result } = renderHook(() => usePhotoLogs());

      await act(async () => {
        await result.current.getPhotos();
      });

      expect(result.current.logs[0].type).toBe('weigh-in');
    });

    it('should handle OCR photos', async () => {
      const mockLogs: PhotoLogEntry[] = [
        { id: 'p1', photoUrl: 'https://example.com/ocr.jpg', type: 'ocr' as PhotoLogType, timestamp: new Date() },
      ];
      (mealLogService.getPhotoLogs as jest.Mock).mockResolvedValue(mockLogs);

      const { result } = renderHook(() => usePhotoLogs());

      await act(async () => {
        await result.current.getPhotos();
      });

      expect(result.current.logs[0].type).toBe('ocr');
    });
  });
});
