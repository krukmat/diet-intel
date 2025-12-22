/**
 * Achievement Service - Phase 5.2
 * Handles achievement unlocking, persistence, and notifications
 *
 * Functions:
 * - checkNewAchievements: Evaluate and unlock new achievements
 * - persistAchievements: Save achievements to AsyncStorage
 * - restoreAchievements: Load achievements from AsyncStorage
 * - calculateAchievementProgress: Update progress bars
 * - notifyAchievementUnlock: Send notifications
 * - shareAchievementOnSocial: Post to social media
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  points: number;
  unlocked: boolean;
  unlockedAt?: Date;
  progress: number;
  target: number;
}

export interface AchievementNotification {
  id: string;
  title: string;
  message: string;
  points: number;
  timestamp: Date;
}

const ACHIEVEMENTS_STORAGE_KEY = 'dietintel_achievements';
const NOTIFICATIONS_STORAGE_KEY = 'dietintel_achievement_notifications';

/**
 * Default achievements configuration
 */
const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_meal',
    title: 'First Meal',
    description: 'Log your first meal',
    points: 100,
    unlocked: false,
    progress: 0,
    target: 1
  },
  {
    id: 'streak_7',
    title: '7-Day Streak',
    description: 'Maintain a 7-day logging streak',
    points: 200,
    unlocked: false,
    progress: 0,
    target: 7
  },
  {
    id: 'streak_30',
    title: '30-Day Champion',
    description: 'Maintain a 30-day logging streak',
    points: 500,
    unlocked: false,
    progress: 0,
    target: 30
  },
  {
    id: 'meal_logger',
    title: 'Meal Logger',
    description: 'Log 100 meals',
    points: 300,
    unlocked: false,
    progress: 0,
    target: 100
  },
  {
    id: 'macro_balancer',
    title: 'Macro Balancer',
    description: 'Complete 50 meals with perfect macro balance',
    points: 400,
    unlocked: false,
    progress: 0,
    target: 50
  },
  {
    id: 'protein_master',
    title: 'Protein Master',
    description: 'Meet protein goal for 20 consecutive days',
    points: 350,
    unlocked: false,
    progress: 0,
    target: 20
  },
  {
    id: 'recipes_created',
    title: 'Recipe Creator',
    description: 'Create 10 custom recipes',
    points: 250,
    unlocked: false,
    progress: 0,
    target: 10
  },
  {
    id: 'social_butterfly',
    title: 'Social Butterfly',
    description: 'Add 10 friends',
    points: 150,
    unlocked: false,
    progress: 0,
    target: 10
  }
];

/**
 * Initialize achievements from storage or create defaults
 */
export async function initializeAchievements(): Promise<Achievement[]> {
  try {
    const stored = await AsyncStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((ach: any) => ({
        ...ach,
        unlockedAt: ach.unlockedAt ? new Date(ach.unlockedAt) : undefined
      }));
    }
  } catch (error) {
    console.error('Error loading achievements:', error);
  }

  // Return defaults if nothing stored
  return DEFAULT_ACHIEVEMENTS;
}

/**
 * Check if new achievements should be unlocked
 * Returns array of newly unlocked achievements
 */
export async function checkNewAchievements(
  currentAchievements: Achievement[],
  newProgress: Record<string, number>
): Promise<Achievement[]> {
  const unlockedList: Achievement[] = [];

  for (const achievement of currentAchievements) {
    // Skip if already unlocked
    if (achievement.unlocked) continue;

    // Update progress
    const progress = newProgress[achievement.id] || achievement.progress;
    achievement.progress = progress;

    // Check if should unlock
    if (progress >= achievement.target && !achievement.unlocked) {
      achievement.unlocked = true;
      achievement.unlockedAt = new Date();
      unlockedList.push(achievement);
    }
  }

  return unlockedList;
}

/**
 * Save achievements to AsyncStorage
 */
export async function persistAchievements(achievements: Achievement[]): Promise<boolean> {
  try {
    const serializable = achievements.map(ach => ({
      ...ach,
      unlockedAt: ach.unlockedAt?.toISOString()
    }));
    await AsyncStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(serializable));
    return true;
  } catch (error) {
    console.error('Error saving achievements:', error);
    return false;
  }
}

/**
 * Load achievements from AsyncStorage
 */
export async function restoreAchievements(): Promise<Achievement[]> {
  try {
    const stored = await AsyncStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!stored) {
      return initializeAchievements();
    }

    const parsed = JSON.parse(stored);
    return parsed.map((ach: any) => ({
      ...ach,
      unlockedAt: ach.unlockedAt ? new Date(ach.unlockedAt) : undefined
    }));
  } catch (error) {
    console.error('Error restoring achievements:', error);
    return DEFAULT_ACHIEVEMENTS;
  }
}

/**
 * Calculate progress percentage for achievement
 */
export function calculateAchievementProgress(achievement: Achievement): number {
  if (achievement.target === 0) return 0;
  return Math.min(Math.round((achievement.progress / achievement.target) * 100), 100);
}

/**
 * Update multiple achievement progress values
 */
export function updateMultipleProgress(
  achievements: Achievement[],
  progressUpdates: Record<string, number>
): Achievement[] {
  return achievements.map(ach => ({
    ...ach,
    progress: progressUpdates[ach.id] !== undefined ? progressUpdates[ach.id] : ach.progress
  }));
}

/**
 * Send achievement unlock notification
 * In real app, would integrate with push notifications
 */
export async function notifyAchievementUnlock(achievement: Achievement): Promise<void> {
  try {
    // Store notification
    const notification: AchievementNotification = {
      id: achievement.id,
      title: achievement.title,
      message: `You unlocked ${achievement.title}! +${achievement.points} points`,
      points: achievement.points,
      timestamp: new Date()
    };

    // Get existing notifications
    const existingStr = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const existing = existingStr ? JSON.parse(existingStr) : [];

    // Add new notification
    existing.push(notification);

    // Keep only last 50 notifications
    const recent = existing.slice(-50);

    await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(recent));

    // Show alert (in real app, would use toast notification library)
    Alert.alert(
      achievement.title,
      `You unlocked ${achievement.title}! +${achievement.points} points`,
      [{ text: 'Awesome!', onPress: () => {} }]
    );
  } catch (error) {
    console.error('Error notifying achievement:', error);
  }
}

/**
 * Get recent achievement notifications
 */
export async function getRecentNotifications(limit: number = 10): Promise<AchievementNotification[]> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    const recent = parsed.slice(-limit).reverse();

    return recent.map((notif: any) => ({
      ...notif,
      timestamp: new Date(notif.timestamp)
    }));
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
}

/**
 * Clear achievement notifications
 */
export async function clearNotifications(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return false;
  }
}

/**
 * Share achievement on social media
 * Returns formatted string for sharing
 */
export function formatAchievementShare(achievement: Achievement, username: string = 'DietIntel User'): string {
  return `I unlocked "${achievement.title}" on DietIntel! 🎉\n\n${achievement.description}\n\n+${achievement.points} points earned!\n\n#DietIntel #Achievement #HealthJourney`;
}

/**
 * Get achievement by ID
 */
export function getAchievementById(
  achievements: Achievement[],
  id: string
): Achievement | undefined {
  return achievements.find(ach => ach.id === id);
}

/**
 * Get all unlocked achievements
 */
export function getUnlockedAchievements(achievements: Achievement[]): Achievement[] {
  return achievements.filter(ach => ach.unlocked);
}

/**
 * Get all locked achievements
 */
export function getLockedAchievements(achievements: Achievement[]): Achievement[] {
  return achievements.filter(ach => !ach.unlocked);
}

/**
 * Calculate total points from unlocked achievements
 */
export function calculateTotalAchievementPoints(achievements: Achievement[]): number {
  return getUnlockedAchievements(achievements).reduce((sum, ach) => sum + ach.points, 0);
}

/**
 * Get progress summary
 */
export function getProgressSummary(achievements: Achievement[]): {
  totalPoints: number;
  unlockedCount: number;
  lockedCount: number;
  percentComplete: number;
} {
  const unlocked = getUnlockedAchievements(achievements);
  const total = achievements.length;

  return {
    totalPoints: calculateTotalAchievementPoints(achievements),
    unlockedCount: unlocked.length,
    lockedCount: total - unlocked.length,
    percentComplete: Math.round((unlocked.length / total) * 100)
  };
}

/**
 * Reset all achievements (for testing/debugging)
 */
export async function resetAchievements(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(ACHIEVEMENTS_STORAGE_KEY);
    await AsyncStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error resetting achievements:', error);
    return false;
  }
}
