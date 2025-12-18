/**
 * useGamification Hook - Phase 2.2
 * Custom hook for accessing gamification context
 *
 * This is a wrapper around the context hook to provide additional
 * helper methods and ensure proper error handling
 */

import { useContext } from 'react';
import GamificationContext, { GamificationContextType } from '../contexts/GamificationContext';

/**
 * Hook to access gamification context
 * Must be used within GamificationProvider
 *
 * @returns {GamificationContextType} Gamification context with state and actions
 * @throws {Error} If used outside of GamificationProvider
 */
export function useGamification(): GamificationContextType {
  const context = useContext(GamificationContext);

  if (!context) {
    throw new Error(
      'useGamification must be used within a GamificationProvider. ' +
      'Make sure your component is wrapped with <GamificationProvider>.'
    );
  }

  return context;
}

/**
 * Hook to check if user has unlocked a specific achievement
 *
 * @param {string} achievementId - The achievement ID to check
 * @returns {boolean} True if achievement is unlocked
 */
export function useIsAchievementUnlocked(achievementId: string): boolean {
  const { achievements } = useGamification();
  const achievement = achievements.find(a => a.id === achievementId);
  return achievement?.unlocked ?? false;
}

/**
 * Hook to get achievement progress
 *
 * @param {string} achievementId - The achievement ID
 * @returns {Object} Object with progress, target, and percentage
 */
export function useAchievementProgress(achievementId: string) {
  const { achievements } = useGamification();
  const achievement = achievements.find(a => a.id === achievementId);

  if (!achievement) {
    return { progress: 0, target: 0, percentage: 0 };
  }

  const percentage = Math.min(Math.round((achievement.progress / achievement.target) * 100), 100);

  return {
    progress: achievement.progress,
    target: achievement.target,
    percentage,
    isUnlocked: achievement.unlocked,
  };
}

/**
 * Hook to get gamification summary for UI display
 *
 * @returns {Object} Summary object with key metrics
 */
export function useGamificationSummary() {
  const {
    totalPoints,
    currentLevel,
    levelProgress,
    pointsToNextLevel,
    currentStreak,
    longestStreak,
    unlockedAchievements,
    achievementPoints,
  } = useGamification();

  return {
    totalPoints,
    currentLevel,
    levelProgress,
    pointsToNextLevel,
    currentStreak,
    longestStreak,
    achievementsUnlocked: unlockedAchievements.length,
    achievementPoints,
  };
}

/**
 * Hook to get multiplier for current streak
 *
 * @returns {number} Multiplier value (1.0 - 2.5x)
 */
export function useStreakMultiplier() {
  const { currentStreak } = useGamification();

  if (currentStreak <= 3) return 1.0;
  if (currentStreak <= 7) return 1.2;
  if (currentStreak <= 14) return 1.5;
  if (currentStreak <= 30) return 2.0;
  return 2.5;
}

/**
 * Hook to calculate points earned with streak bonus
 *
 * @param {number} basePoints - Base points before multiplier
 * @returns {number} Points including streak bonus
 */
export function usePointsWithMultiplier(basePoints: number): number {
  const multiplier = useStreakMultiplier();
  return Math.floor(basePoints * multiplier);
}

/**
 * Hook to get next level target
 *
 * @returns {Object} Object with current level and points needed for next level
 */
export function useNextLevelTarget() {
  const { currentLevel, pointsToNextLevel } = useGamification();

  return {
    currentLevel,
    pointsToNextLevel,
    nextLevel: currentLevel + 1,
  };
}

/**
 * Hook to get achievement unlock status
 * Returns array of achievements that were recently unlocked (optional timestamp filtering)
 *
 * @returns {Achievement[]} Array of unlocked achievements
 */
export function useUnlockedAchievements() {
  const { unlockedAchievements } = useGamification();
  return unlockedAchievements;
}

/**
 * Hook to get specific achievement data
 *
 * @param {string} achievementId - The achievement ID
 * @returns {Object | null} Achievement data or null if not found
 */
export function useAchievement(achievementId: string) {
  const { achievements } = useGamification();
  return achievements.find(a => a.id === achievementId) || null;
}

export default useGamification;
