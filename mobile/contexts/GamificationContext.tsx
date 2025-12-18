/**
 * Gamification Context - Phase 2.1
 * Manages global gamification state (points, achievements, streaks, badges)
 *
 * Provides:
 * - GamificationProvider: Context provider component
 * - useGamification: Custom hook for accessing context
 * - GamificationState: Type definition for state shape
 */

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Achievement,
  initializeAchievements,
  checkNewAchievements,
  persistAchievements,
  restoreAchievements,
  getUnlockedAchievements,
  calculateTotalAchievementPoints,
} from '../services/AchievementService';
import {
  getLevelFromPoints,
  getLevelProgress,
  getPointsToNextLevel,
  validateAndUpdateStreak,
} from '../utils/gamificationUtils';

export interface GamificationState {
  // Points and levels
  totalPoints: number;
  currentLevel: number;
  levelProgress: number;
  pointsToNextLevel: number;

  // Streaks
  currentStreak: number;
  longestStreak: number;
  lastLogDate: string;

  // Achievements
  achievements: Achievement[];
  unlockedAchievements: Achievement[];
  achievementPoints: number;

  // Loading state
  isLoading: boolean;
  error: string | null;
}

export interface GamificationContextType extends GamificationState {
  // Actions
  addPoints: (points: number, reason: string) => Promise<void>;
  updateStreak: (newLogDate: string) => Promise<void>;
  updateAchievementProgress: (achievementId: string, progress: number) => Promise<void>;
  updateMultipleProgress: (progressUpdates: Record<string, number>) => Promise<void>;
  resetGameification: () => Promise<void>;
  refreshState: () => Promise<void>;
}

const initialState: GamificationState = {
  totalPoints: 0,
  currentLevel: 1,
  levelProgress: 0,
  pointsToNextLevel: 500,
  currentStreak: 0,
  longestStreak: 0,
  lastLogDate: new Date().toISOString().split('T')[0],
  achievements: [],
  unlockedAchievements: [],
  achievementPoints: 0,
  isLoading: true,
  error: null,
};

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export const GamificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GamificationState>(initialState);

  // Initialize gamification state from storage
  useEffect(() => {
    initializeState();
  }, []);

  const initializeState = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Load achievements
      const achievements = await restoreAchievements();

      // Load other gamification data
      const storedData = await AsyncStorage.getItem('dietintel_gamification');
      const parsedData = storedData ? JSON.parse(storedData) : null;

      const totalPoints = parsedData?.totalPoints || 0;
      const currentStreak = parsedData?.currentStreak || 0;
      const longestStreak = parsedData?.longestStreak || 0;
      const lastLogDate = parsedData?.lastLogDate || new Date().toISOString().split('T')[0];

      const currentLevel = getLevelFromPoints(totalPoints);
      const levelProgress = getLevelProgress(totalPoints, currentLevel);
      const pointsToNextLevel = getPointsToNextLevel(totalPoints, currentLevel);
      const unlockedAchievements = getUnlockedAchievements(achievements);
      const achievementPoints = calculateTotalAchievementPoints(achievements);

      setState({
        totalPoints,
        currentLevel,
        levelProgress,
        pointsToNextLevel,
        currentStreak,
        longestStreak,
        lastLogDate,
        achievements,
        unlockedAchievements,
        achievementPoints,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error initializing gamification state:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load gamification data',
      }));
    }
  };

  const persistState = useCallback(
    async (updates: Partial<GamificationState>) => {
      try {
        const newState: GamificationState = { ...state, ...updates };

        const dataToStore = {
          totalPoints: newState.totalPoints,
          currentStreak: newState.currentStreak,
          longestStreak: newState.longestStreak,
          lastLogDate: newState.lastLogDate,
        };

        await AsyncStorage.setItem(
          'dietintel_gamification',
          JSON.stringify(dataToStore)
        );

        if (updates.achievements) {
          await persistAchievements(updates.achievements);
        }

        setState(newState);
      } catch (error) {
        console.error('Error persisting gamification state:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to save gamification data',
        }));
      }
    },
    [state]
  );

  const addPoints = useCallback(
    async (points: number, reason: string) => {
      try {
        const newTotalPoints = state.totalPoints + points;
        const newLevel = getLevelFromPoints(newTotalPoints);
        const levelProgress = getLevelProgress(newTotalPoints, newLevel);
        const pointsToNextLevel = getPointsToNextLevel(newTotalPoints, newLevel);

        // Check for level up
        const leveledUp = newLevel > state.currentLevel;

        await persistState({
          totalPoints: newTotalPoints,
          currentLevel: newLevel,
          levelProgress,
          pointsToNextLevel,
        });

        // Log event (optional - for analytics)
        console.log(`Added ${points} points (${reason}). Total: ${newTotalPoints}, Level: ${newLevel}`);
      } catch (error) {
        console.error('Error adding points:', error);
      }
    },
    [state.totalPoints, state.currentLevel, persistState]
  );

  const updateStreak = useCallback(
    async (newLogDate: string) => {
      try {
        const { streak: newStreak, reset } = validateAndUpdateStreak(
          state.currentStreak,
          state.lastLogDate,
          newLogDate
        );

        const newLongestStreak = Math.max(newStreak, state.longestStreak);

        await persistState({
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
          lastLogDate: newLogDate,
        });

        console.log(`Streak updated: ${newStreak} days (longest: ${newLongestStreak})`);
      } catch (error) {
        console.error('Error updating streak:', error);
      }
    },
    [state.currentStreak, state.longestStreak, state.lastLogDate, persistState]
  );

  const updateAchievementProgress = useCallback(
    async (achievementId: string, progress: number) => {
      try {
        const updatedAchievements = state.achievements.map(ach =>
          ach.id === achievementId ? { ...ach, progress } : ach
        );

        // Check for new unlocks
        const newlyUnlocked = await checkNewAchievements(
          updatedAchievements,
          { [achievementId]: progress }
        );

        const unlockedAchievements = getUnlockedAchievements(updatedAchievements);
        const achievementPoints = calculateTotalAchievementPoints(updatedAchievements);

        await persistState({
          achievements: updatedAchievements,
          unlockedAchievements,
          achievementPoints,
        });

        // Notify about new unlocks
        if (newlyUnlocked.length > 0) {
          console.log(`Achievement unlocked: ${newlyUnlocked[0].title}`);
        }
      } catch (error) {
        console.error('Error updating achievement progress:', error);
      }
    },
    [state.achievements, persistState]
  );

  const updateMultipleProgress = useCallback(
    async (progressUpdates: Record<string, number>) => {
      try {
        const updatedAchievements = state.achievements.map(ach => ({
          ...ach,
          progress: progressUpdates[ach.id] ?? ach.progress,
        }));

        // Check for new unlocks
        const newlyUnlocked = await checkNewAchievements(
          updatedAchievements,
          progressUpdates
        );

        const unlockedAchievements = getUnlockedAchievements(updatedAchievements);
        const achievementPoints = calculateTotalAchievementPoints(updatedAchievements);

        await persistState({
          achievements: updatedAchievements,
          unlockedAchievements,
          achievementPoints,
        });

        if (newlyUnlocked.length > 0) {
          console.log(`${newlyUnlocked.length} achievements unlocked`);
        }
      } catch (error) {
        console.error('Error updating multiple achievement progress:', error);
      }
    },
    [state.achievements, persistState]
  );

  const resetGameification = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('dietintel_gamification');
      await AsyncStorage.removeItem('dietintel_achievements');
      setState(initialState);
      console.log('Gamification state reset');
    } catch (error) {
      console.error('Error resetting gamification:', error);
    }
  }, []);

  const refreshState = useCallback(async () => {
    await initializeState();
  }, []);

  const value: GamificationContextType = {
    ...state,
    addPoints,
    updateStreak,
    updateAchievementProgress,
    updateMultipleProgress,
    resetGameification,
    refreshState,
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
};

export const useGamification = (): GamificationContextType => {
  const context = React.useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within GamificationProvider');
  }
  return context;
};

export default GamificationContext;
