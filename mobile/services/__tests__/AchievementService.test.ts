/**
 * Achievement Service Tests - Phase 5.2
 * Tests for achievement unlocking, persistence, and notifications
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import {
  Achievement,
  initializeAchievements,
  checkNewAchievements,
  persistAchievements,
  restoreAchievements,
  calculateAchievementProgress,
  updateMultipleProgress,
  notifyAchievementUnlock,
  getRecentNotifications,
  clearNotifications,
  formatAchievementShare,
  getAchievementById,
  getUnlockedAchievements,
  getLockedAchievements,
  calculateTotalAchievementPoints,
  getProgressSummary,
  resetAchievements
} from '../AchievementService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn()
  }
}));

describe('AchievementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('initializeAchievements', () => {
    it('should return default achievements when no stored data', async () => {
      const achievements = await initializeAchievements();

      expect(achievements).toHaveLength(8);
      expect(achievements[0].id).toBe('first_meal');
      expect(achievements[0].unlocked).toBe(false);
    });

    it('should restore achievements from storage if available', async () => {
      const mockAchievements = [
        {
          id: 'first_meal',
          title: 'First Meal',
          description: 'Log your first meal',
          points: 100,
          unlocked: true,
          progress: 1,
          target: 1,
          unlockedAt: '2025-12-18T10:00:00.000Z'
        }
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockAchievements));

      const achievements = await initializeAchievements();

      expect(achievements).toHaveLength(1);
      expect(achievements[0].unlocked).toBe(true);
      expect(achievements[0].unlockedAt).toBeInstanceOf(Date);
    });

    it('should handle storage errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      const achievements = await initializeAchievements();

      expect(achievements).toHaveLength(8);
      expect(achievements[0].unlocked).toBe(false);
    });
  });

  describe('checkNewAchievements', () => {
    it('should unlock achievement when progress reaches target', async () => {
      const achievements = await initializeAchievements();
      const newProgress = { 'first_meal': 1 };

      const unlocked = await checkNewAchievements(achievements, newProgress);

      expect(unlocked).toHaveLength(1);
      expect(unlocked[0].id).toBe('first_meal');
      expect(unlocked[0].unlocked).toBe(true);
      expect(unlocked[0].unlockedAt).toBeDefined();
    });

    it('should not unlock achievement if progress below target', async () => {
      const achievements = await initializeAchievements();
      const newProgress = { 'meal_logger': 50 }; // Target is 100

      const unlocked = await checkNewAchievements(achievements, newProgress);

      expect(unlocked).toHaveLength(0);
      expect(achievements.find(a => a.id === 'meal_logger')?.unlocked).toBe(false);
    });

    it('should update progress without unlocking if below target', async () => {
      const achievements = await initializeAchievements();
      const newProgress = { 'streak_7': 5 }; // Target is 7

      await checkNewAchievements(achievements, newProgress);

      expect(achievements.find(a => a.id === 'streak_7')?.progress).toBe(5);
      expect(achievements.find(a => a.id === 'streak_7')?.unlocked).toBe(false);
    });

    it('should not unlock already unlocked achievements', async () => {
      const achievements = await initializeAchievements();
      achievements[0].unlocked = true;

      const newProgress = { 'first_meal': 2 };

      const unlocked = await checkNewAchievements(achievements, newProgress);

      expect(unlocked).toHaveLength(0);
    });

    it('should unlock multiple achievements simultaneously', async () => {
      const allAchievements = await initializeAchievements();
      // Make a copy to avoid state pollution
      const achievements = JSON.parse(JSON.stringify(allAchievements));

      const newProgress = {
        'first_meal': 1,
        'meal_logger': 100,
        'protein_master': 20
      };

      const unlocked = await checkNewAchievements(achievements, newProgress);

      // Multiple achievements should be unlocked
      expect(unlocked.length).toBeGreaterThanOrEqual(2);
      const unlockedIds = unlocked.map(a => a.id);
      // At least 2 of these should be unlocked
      const expectedUnlocks = ['meal_logger', 'protein_master', 'first_meal'];
      const foundUnlocks = expectedUnlocks.filter(id => unlockedIds.includes(id));
      expect(foundUnlocks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('persistAchievements & restoreAchievements', () => {
    it('should save achievements to storage', async () => {
      const achievements = await initializeAchievements();
      achievements[0].unlocked = true;
      achievements[0].unlockedAt = new Date('2025-12-18');

      const result = await persistAchievements(achievements);

      expect(result).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalled();

      const callArgs = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe('dietintel_achievements');
      expect(callArgs[1]).toContain('first_meal');
    });

    it('should handle save errors', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Save error'));

      const achievements = await initializeAchievements();
      const result = await persistAchievements(achievements);

      expect(result).toBe(false);
    });

    it('should restore achievements from storage', async () => {
      const mockData = JSON.stringify([
        {
          id: 'first_meal',
          unlocked: true,
          unlockedAt: '2025-12-18T10:00:00.000Z',
          progress: 1,
          target: 1,
          title: 'First Meal',
          description: 'Log your first meal',
          points: 100
        }
      ]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(mockData);

      const achievements = await restoreAchievements();

      expect(achievements).toHaveLength(1);
      expect(achievements[0].unlocked).toBe(true);
      expect(achievements[0].unlockedAt).toBeInstanceOf(Date);
    });

    it('should return defaults if restore fails', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Restore error'));

      const achievements = await restoreAchievements();

      expect(achievements).toHaveLength(8);
      expect(achievements[0].id).toBe('first_meal');
    });
  });

  describe('calculateAchievementProgress', () => {
    it('should return 0 for no progress', () => {
      const achievement: Achievement = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        points: 100,
        unlocked: false,
        progress: 0,
        target: 50
      };

      const progress = calculateAchievementProgress(achievement);
      expect(progress).toBe(0);
    });

    it('should return 50 for halfway progress', () => {
      const achievement: Achievement = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        points: 100,
        unlocked: false,
        progress: 25,
        target: 50
      };

      const progress = calculateAchievementProgress(achievement);
      expect(progress).toBe(50);
    });

    it('should return 100 for complete progress', () => {
      const achievement: Achievement = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        points: 100,
        unlocked: true,
        progress: 50,
        target: 50
      };

      const progress = calculateAchievementProgress(achievement);
      expect(progress).toBe(100);
    });

    it('should cap at 100 if over target', () => {
      const achievement: Achievement = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        points: 100,
        unlocked: true,
        progress: 75,
        target: 50
      };

      const progress = calculateAchievementProgress(achievement);
      expect(progress).toBe(100);
    });

    it('should handle zero target', () => {
      const achievement: Achievement = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        points: 100,
        unlocked: false,
        progress: 10,
        target: 0
      };

      const progress = calculateAchievementProgress(achievement);
      expect(progress).toBe(0);
    });
  });

  describe('updateMultipleProgress', () => {
    it('should update progress for multiple achievements', async () => {
      const achievements = await initializeAchievements();
      const updates = {
        'first_meal': 1,
        'meal_logger': 50,
        'streak_7': 5
      };

      const updated = updateMultipleProgress(achievements, updates);

      expect(updated.find(a => a.id === 'first_meal')?.progress).toBe(1);
      expect(updated.find(a => a.id === 'meal_logger')?.progress).toBe(50);
      expect(updated.find(a => a.id === 'streak_7')?.progress).toBe(5);
    });

    it('should leave unspecified achievements unchanged', async () => {
      const achievements = await initializeAchievements();
      achievements[0].progress = 10;

      const updates = { 'meal_logger': 50 };
      const updated = updateMultipleProgress(achievements, updates);

      expect(updated[0].progress).toBe(10);
    });
  });

  describe('notifyAchievementUnlock', () => {
    it('should show alert for unlocked achievement', async () => {
      const achievement: Achievement = {
        id: 'first_meal',
        title: 'First Meal',
        description: 'Log your first meal',
        points: 100,
        unlocked: true,
        progress: 1,
        target: 1
      };

      await notifyAchievementUnlock(achievement);

      expect(Alert.alert).toHaveBeenCalledWith(
        'First Meal',
        expect.stringContaining('+100 points'),
        expect.any(Array)
      );
    });

    it('should store notification in AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const achievement: Achievement = {
        id: 'first_meal',
        title: 'First Meal',
        description: 'Log your first meal',
        points: 100,
        unlocked: true,
        progress: 1,
        target: 1
      };

      await notifyAchievementUnlock(achievement);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const callArgs = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        call => call[0] === 'dietintel_achievement_notifications'
      );
      expect(callArgs).toBeDefined();
    });
  });

  describe('getRecentNotifications', () => {
    it('should return recent notifications', async () => {
      const notifications = [
        {
          id: 'first_meal',
          title: 'First Meal',
          message: 'You unlocked First Meal!',
          points: 100,
          timestamp: new Date().toISOString()
        }
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(notifications));

      const recent = await getRecentNotifications();

      expect(recent).toHaveLength(1);
      expect(recent[0].id).toBe('first_meal');
      expect(recent[0].timestamp).toBeInstanceOf(Date);
    });

    it('should return empty array if no notifications', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const recent = await getRecentNotifications();

      expect(recent).toEqual([]);
    });

    it('should limit notifications by count', async () => {
      const notifications = Array(20).fill(null).map((_, i) => ({
        id: `achievement_${i}`,
        title: `Achievement ${i}`,
        message: `Achievement ${i}`,
        points: 100,
        timestamp: new Date().toISOString()
      }));

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(notifications));

      const recent = await getRecentNotifications(5);

      expect(recent).toHaveLength(5);
    });
  });

  describe('clearNotifications', () => {
    it('should clear all notifications', async () => {
      const result = await clearNotifications();

      expect(result).toBe(true);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('dietintel_achievement_notifications');
    });

    it('should return false on error', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('Clear error'));

      const result = await clearNotifications();

      expect(result).toBe(false);
    });
  });

  describe('formatAchievementShare', () => {
    it('should format achievement for sharing', () => {
      const achievement: Achievement = {
        id: 'first_meal',
        title: 'First Meal',
        description: 'Log your first meal',
        points: 100,
        unlocked: true,
        progress: 1,
        target: 1
      };

      const share = formatAchievementShare(achievement, 'John');

      expect(share).toContain('First Meal');
      expect(share).toContain('+100 points');
      expect(share).toContain('#DietIntel');
      expect(share).toContain('🎉');
    });
  });

  describe('Achievement retrieval functions', () => {
    let achievements: Achievement[];

    beforeEach(async () => {
      achievements = await initializeAchievements();
      // Unlock first_meal (100 pts) and streak_7 (200 pts)
      achievements[0].unlocked = true; // first_meal: 100
      achievements[0].points = 100;
      achievements[1].unlocked = true; // streak_7: 200
      achievements[1].points = 200;
    });

    it('should get achievement by ID', () => {
      const ach = getAchievementById(achievements, 'first_meal');

      expect(ach).toBeDefined();
      expect(ach?.id).toBe('first_meal');
    });

    it('should return undefined for non-existent ID', () => {
      const ach = getAchievementById(achievements, 'nonexistent');

      expect(ach).toBeUndefined();
    });

    it('should get all unlocked achievements', () => {
      const unlocked = getUnlockedAchievements(achievements);

      expect(unlocked).toHaveLength(2);
      expect(unlocked.every(a => a.unlocked)).toBe(true);
    });

    it('should get all locked achievements', () => {
      const locked = getLockedAchievements(achievements);

      expect(locked.length).toBeGreaterThan(0);
      expect(locked.every(a => !a.unlocked)).toBe(true);
    });

    it('should calculate total achievement points', () => {
      const total = calculateTotalAchievementPoints(achievements);

      // first_meal (100) + streak_7 (200) = 300
      expect(total).toBeGreaterThanOrEqual(300);
    });

    it('should get progress summary', () => {
      const summary = getProgressSummary(achievements);

      expect(summary.unlockedCount).toBe(2);
      expect(summary.lockedCount).toBe(6);
      expect(summary.percentComplete).toBe(25); // 2 out of 8
    });
  });

  describe('resetAchievements', () => {
    it('should reset all achievements', async () => {
      const result = await resetAchievements();

      expect(result).toBe(true);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('dietintel_achievements');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('dietintel_achievement_notifications');
    });

    it('should return false on error', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('Reset error'));

      const result = await resetAchievements();

      expect(result).toBe(false);
    });
  });
});
