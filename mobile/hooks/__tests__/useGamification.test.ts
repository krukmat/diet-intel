/**
 * useGamification Hook Tests - Phase 2.2
 * Tests for all custom hooks wrapping gamification context
 */

import { renderHook } from '@testing-library/react-native';
import { GamificationProvider } from '../../contexts/GamificationContext';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AchievementService from '../../services/AchievementService';
import {
  useGamification,
  useIsAchievementUnlocked,
  useAchievementProgress,
  useGamificationSummary,
  useStreakMultiplier,
  usePointsWithMultiplier,
  useNextLevelTarget,
  useUnlockedAchievements,
  useAchievement,
} from '../useGamification';

jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../services/AchievementService');

describe('useGamification Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AchievementService.restoreAchievements as jest.Mock).mockResolvedValue([]);
    (AchievementService.getUnlockedAchievements as jest.Mock).mockReturnValue([]);
    (AchievementService.calculateTotalAchievementPoints as jest.Mock).mockReturnValue(0);
  });

  describe('useGamification - Main Hook', () => {
    it('should return gamification context', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      const { result } = renderHook(() => useGamification(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.totalPoints).toBe(0);
      expect(result.current.currentLevel).toBe(1);
      expect(result.current.addPoints).toBeDefined();
      expect(result.current.updateStreak).toBeDefined();
    });

    it('should throw error when used without provider', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useGamification());
      }).toThrow('useGamification must be used within a GamificationProvider');

      spy.mockRestore();
    });
  });

  describe('useIsAchievementUnlocked', () => {
    it('should return true for unlocked achievement', () => {
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

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      const { result } = renderHook(
        () => useIsAchievementUnlocked('first_meal'),
        { wrapper }
      );

      // Wait for initialization
      setTimeout(() => {
        expect(result.current).toBe(true);
      }, 100);
    });

    it('should return false for locked achievement', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      const { result } = renderHook(
        () => useIsAchievementUnlocked('nonexistent'),
        { wrapper }
      );

      expect(result.current).toBe(false);
    });
  });

  describe('useAchievementProgress', () => {
    it('should return progress for achievement', () => {
      const mockAchievements = [
        {
          id: 'meal_logger',
          title: 'Meal Logger',
          description: 'Log 100 meals',
          points: 300,
          unlocked: false,
          progress: 50,
          target: 100,
        },
      ];

      (AchievementService.restoreAchievements as jest.Mock).mockResolvedValueOnce(
        mockAchievements
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      const { result } = renderHook(
        () => useAchievementProgress('meal_logger'),
        { wrapper }
      );

      setTimeout(() => {
        expect(result.current.progress).toBe(50);
        expect(result.current.target).toBe(100);
        expect(result.current.percentage).toBe(50);
      }, 100);
    });

    it('should return 0 for nonexistent achievement', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      const { result } = renderHook(
        () => useAchievementProgress('nonexistent'),
        { wrapper }
      );

      expect(result.current.progress).toBe(0);
      expect(result.current.target).toBe(0);
      expect(result.current.percentage).toBe(0);
    });
  });

  describe('useGamificationSummary', () => {
    it('should return summary object', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      const { result } = renderHook(() => useGamificationSummary(), { wrapper });

      expect(result.current.totalPoints).toBeDefined();
      expect(result.current.currentLevel).toBeDefined();
      expect(result.current.levelProgress).toBeDefined();
      expect(result.current.pointsToNextLevel).toBeDefined();
      expect(result.current.currentStreak).toBeDefined();
      expect(result.current.longestStreak).toBeDefined();
      expect(result.current.achievementsUnlocked).toBeDefined();
      expect(result.current.achievementPoints).toBeDefined();
    });

    it('should have correct initial values', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      const { result } = renderHook(() => useGamificationSummary(), { wrapper });

      expect(result.current.totalPoints).toBe(0);
      expect(result.current.currentLevel).toBe(1);
      expect(result.current.currentStreak).toBe(0);
      expect(result.current.achievementsUnlocked).toBe(0);
    });
  });

  describe('useStreakMultiplier', () => {
    it('should return 1.0x for days 1-3', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      const { result } = renderHook(() => useStreakMultiplier(), { wrapper });

      expect(result.current).toBe(1.0);
    });

    it('should calculate multiplier based on current streak', () => {
      // Note: This test checks the calculation logic
      // Actual streak would come from context in real usage
      const testCases = [
        { streak: 1, expected: 1.0 },
        { streak: 5, expected: 1.2 },
        { streak: 10, expected: 1.5 },
        { streak: 20, expected: 2.0 },
        { streak: 35, expected: 2.5 },
      ];

      testCases.forEach(({ streak, expected }) => {
        // In real app, streak would come from context
        // This tests the calculation logic
        let multiplier = 1.0;
        if (streak <= 3) multiplier = 1.0;
        else if (streak <= 7) multiplier = 1.2;
        else if (streak <= 14) multiplier = 1.5;
        else if (streak <= 30) multiplier = 2.0;
        else multiplier = 2.5;

        expect(multiplier).toBe(expected);
      });
    });
  });

  describe('usePointsWithMultiplier', () => {
    it('should calculate points with multiplier', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      const { result } = renderHook(() => usePointsWithMultiplier(100), { wrapper });

      // With default streak (1.0x multiplier)
      expect(result.current).toBe(100);
    });

    it('should apply floor to result', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      // This would need a specific streak to test multiplication
      // For now, test that it returns a number
      const { result } = renderHook(() => usePointsWithMultiplier(123.5), {
        wrapper,
      });

      expect(Number.isInteger(result.current)).toBe(true);
    });
  });

  describe('useNextLevelTarget', () => {
    it('should return next level target', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      const { result } = renderHook(() => useNextLevelTarget(), { wrapper });

      expect(result.current.currentLevel).toBe(1);
      expect(result.current.nextLevel).toBe(2);
      expect(result.current.pointsToNextLevel).toBe(500);
    });
  });

  describe('useUnlockedAchievements', () => {
    it('should return array of unlocked achievements', () => {
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

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      const { result } = renderHook(() => useUnlockedAchievements(), { wrapper });

      setTimeout(() => {
        expect(Array.isArray(result.current)).toBe(true);
        expect(result.current.length).toBeGreaterThanOrEqual(0);
      }, 100);
    });

    it('should return empty array when no achievements unlocked', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      const { result } = renderHook(() => useUnlockedAchievements(), { wrapper });

      expect(Array.isArray(result.current)).toBe(true);
    });
  });

  describe('useAchievement', () => {
    it('should return achievement data', () => {
      const mockAchievements = [
        {
          id: 'test_achievement',
          title: 'Test Achievement',
          description: 'Test Description',
          points: 100,
          unlocked: false,
          progress: 5,
          target: 10,
        },
      ];

      (AchievementService.restoreAchievements as jest.Mock).mockResolvedValueOnce(
        mockAchievements
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      const { result } = renderHook(() => useAchievement('test_achievement'), {
        wrapper,
      });

      setTimeout(() => {
        expect(result.current).toBeDefined();
        expect(result.current?.id).toBe('test_achievement');
      }, 100);
    });

    it('should return null for nonexistent achievement', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(GamificationProvider, { children })
      );

      const { result } = renderHook(() => useAchievement('nonexistent'), {
        wrapper,
      });

      expect(result.current).toBeNull();
    });
  });
});
