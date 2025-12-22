/**
 * GamificationContext Tests - Phase 2.1
 * Tests for the gamification context provider and state management
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GamificationProvider,
  useGamification,
  GamificationState,
} from '../GamificationContext';
import * as AchievementService from '../../services/AchievementService';

jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../services/AchievementService');

describe('GamificationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AchievementService.restoreAchievements as jest.Mock).mockResolvedValue([]);
    (AchievementService.persistAchievements as jest.Mock).mockResolvedValue(true);
    (AchievementService.getUnlockedAchievements as jest.Mock).mockReturnValue([]);
    (AchievementService.calculateTotalAchievementPoints as jest.Mock).mockReturnValue(0);
  });

  describe('GamificationProvider - Initialization', () => {
    it('should provide initial state when no stored data', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.totalPoints).toBe(0);
      expect(result.current.currentLevel).toBe(1);
      expect(result.current.currentStreak).toBe(0);
    });

    it('should restore state from AsyncStorage', async () => {
      const storedData = {
        totalPoints: 1500,
        currentStreak: 7,
        longestStreak: 7,
        lastLogDate: '2025-12-18',
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(storedData)
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current.totalPoints).toBe(1500);
      expect(result.current.currentStreak).toBe(7);
    });

    it('should handle initialization errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage error')
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      // Should still provide initial state even on error
      expect(result.current).toBeDefined();
      expect(result.current.totalPoints).toBe(0);
    });

    it('should restore achievements on initialization', async () => {
      const mockAchievements = [
        {
          id: 'first_meal',
          title: 'First Meal',
          description: 'Log your first meal',
          points: 100,
          unlocked: true,
          progress: 1,
          target: 1,
        },
      ];

      (AchievementService.restoreAchievements as jest.Mock).mockResolvedValueOnce(
        mockAchievements
      );
      (AchievementService.getUnlockedAchievements as jest.Mock).mockReturnValueOnce(
        mockAchievements
      );
      (AchievementService.calculateTotalAchievementPoints as jest.Mock).mockReturnValueOnce(
        100
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current.achievements).toHaveLength(1);
      expect(result.current.achievementPoints).toBe(100);
    });
  });

  describe('useGamification Hook - Error Handling', () => {
    it('should throw error when used without provider', () => {
      // Suppress error logging for this test
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useGamification());
      }).toThrow('useGamification must be used within GamificationProvider');

      spy.mockRestore();
    });
  });

  describe('addPoints - Points Management', () => {
    it('should add points to total', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      await act(async () => {
        await result.current.addPoints(100, 'meal_logged');
      });

      // Wait for state update
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(result.current.totalPoints).toBe(100);
    });

    it('should update level when crossing threshold', async () => {
      const storedData = {
        totalPoints: 400,
        currentStreak: 1,
        longestStreak: 1,
        lastLogDate: '2025-12-18',
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(storedData)
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      const initialLevel = result.current.currentLevel;

      await act(async () => {
        await result.current.addPoints(150, 'meal_logged');
      });

      // 400 + 150 = 550 should move from level 1 to level 2
      expect(result.current.totalPoints).toBe(550);
    });

    it('should persist points to AsyncStorage', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await act(async () => {
        await result.current.addPoints(50, 'test');
      });

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should calculate level progress correctly', async () => {
      const storedData = {
        totalPoints: 250, // Halfway through level 1 (0-500)
        currentStreak: 1,
        longestStreak: 1,
        lastLogDate: '2025-12-18',
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(storedData)
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be approximately 50% through level 1
      expect(result.current.levelProgress).toBeGreaterThan(40);
      expect(result.current.levelProgress).toBeLessThan(60);
    });
  });

  describe('updateStreak - Streak Management', () => {
    it('should update streak on consecutive day', async () => {
      const storedData = {
        totalPoints: 0,
        currentStreak: 5,
        longestStreak: 5,
        lastLogDate: '2025-12-17',
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(storedData)
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      await act(async () => {
        await result.current.updateStreak('2025-12-18');
      });

      expect(result.current.currentStreak).toBe(6);
    });

    it('should reset streak on gap day', async () => {
      const storedData = {
        totalPoints: 0,
        currentStreak: 5,
        longestStreak: 10,
        lastLogDate: '2025-12-16', // 2 days ago
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(storedData)
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      await act(async () => {
        await result.current.updateStreak('2025-12-18');
      });

      expect(result.current.currentStreak).toBe(1);
      expect(result.current.longestStreak).toBe(10); // Longest stays the same
    });

    it('should update longest streak when current exceeds it', async () => {
      const storedData = {
        totalPoints: 0,
        currentStreak: 9,
        longestStreak: 8,
        lastLogDate: '2025-12-17',
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(storedData)
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      await act(async () => {
        await result.current.updateStreak('2025-12-18');
      });

      expect(result.current.currentStreak).toBe(10);
      expect(result.current.longestStreak).toBe(10);
    });

    it('should persist streak to AsyncStorage', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await act(async () => {
        await result.current.updateStreak('2025-12-18');
      });

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('updateAchievementProgress - Achievement Management', () => {
    it('should update achievement progress', async () => {
      const mockAchievements = [
        {
          id: 'meal_logger',
          title: 'Meal Logger',
          description: 'Log 100 meals',
          points: 300,
          unlocked: false,
          progress: 0,
          target: 100,
        },
      ];

      (AchievementService.restoreAchievements as jest.Mock).mockResolvedValueOnce(
        mockAchievements
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      await act(async () => {
        await result.current.updateAchievementProgress('meal_logger', 50);
      });

      expect(result.current.achievements[0].progress).toBe(50);
      expect(AchievementService.persistAchievements).toHaveBeenCalled();
    });

    it('should check for achievement unlocks', async () => {
      const mockAchievements = [
        {
          id: 'first_meal',
          title: 'First Meal',
          description: 'Log your first meal',
          points: 100,
          unlocked: false,
          progress: 0,
          target: 1,
        },
      ];

      (AchievementService.restoreAchievements as jest.Mock).mockResolvedValueOnce(
        mockAchievements
      );
      (AchievementService.checkNewAchievements as jest.Mock).mockResolvedValueOnce([
        { ...mockAchievements[0], unlocked: true },
      ]);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      await act(async () => {
        await result.current.updateAchievementProgress('first_meal', 1);
      });

      expect(AchievementService.checkNewAchievements).toHaveBeenCalled();
    });

    it('should persist updated achievements', async () => {
      const mockAchievements = [
        {
          id: 'test_achievement',
          title: 'Test',
          description: 'Test',
          points: 100,
          unlocked: false,
          progress: 0,
          target: 10,
        },
      ];

      (AchievementService.restoreAchievements as jest.Mock).mockResolvedValueOnce(
        mockAchievements
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      await act(async () => {
        await result.current.updateAchievementProgress('test_achievement', 5);
      });

      expect(AchievementService.persistAchievements).toHaveBeenCalled();
    });
  });

  describe('updateMultipleProgress - Batch Updates', () => {
    it('should update multiple achievement progress values', async () => {
      const mockAchievements = [
        {
          id: 'achievement_1',
          title: 'Achievement 1',
          description: 'Test 1',
          points: 100,
          unlocked: false,
          progress: 0,
          target: 10,
        },
        {
          id: 'achievement_2',
          title: 'Achievement 2',
          description: 'Test 2',
          points: 100,
          unlocked: false,
          progress: 0,
          target: 10,
        },
      ];

      (AchievementService.restoreAchievements as jest.Mock).mockResolvedValueOnce(
        mockAchievements
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      await act(async () => {
        await result.current.updateMultipleProgress({
          'achievement_1': 5,
          'achievement_2': 7,
        });
      });

      expect(result.current.achievements[0].progress).toBe(5);
      expect(result.current.achievements[1].progress).toBe(7);
    });
  });

  describe('resetGameification - State Reset', () => {
    it('should reset all gamification data', async () => {
      const storedData = {
        totalPoints: 1000,
        currentStreak: 10,
        longestStreak: 10,
        lastLogDate: '2025-12-18',
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(storedData)
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current.totalPoints).toBe(1000);

      await act(async () => {
        await result.current.resetGameification();
      });

      expect(result.current.totalPoints).toBe(0);
      expect(result.current.currentLevel).toBe(1);
      expect(result.current.currentStreak).toBe(0);
    });

    it('should remove AsyncStorage entries on reset', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await act(async () => {
        await result.current.resetGameification();
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('dietintel_gamification');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('dietintel_achievements');
    });
  });

  describe('refreshState - State Refresh', () => {
    it('should reload state from storage', async () => {
      const initialData = {
        totalPoints: 500,
        currentStreak: 1,
        longestStreak: 1,
        lastLogDate: '2025-12-18',
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(initialData)
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GamificationProvider>{children}</GamificationProvider>
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      const updatedData = {
        totalPoints: 1000,
        currentStreak: 5,
        longestStreak: 5,
        lastLogDate: '2025-12-18',
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(updatedData)
      );

      await act(async () => {
        await result.current.refreshState();
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current.totalPoints).toBe(1000);
      expect(result.current.currentStreak).toBe(5);
    });
  });
});
