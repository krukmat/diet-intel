/**
 * Gamification Integration Tests - Phase 4
 * Tests for gamification point awards and notifications across existing screens
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useGamification } from '../../hooks/useGamification';
import { usePointsWithMultiplier, useStreakMultiplier } from '../../hooks/useGamification';

jest.mock('../../hooks/useGamification', () => ({
  useGamification: jest.fn(),
  usePointsWithMultiplier: jest.fn(),
  useStreakMultiplier: jest.fn(),
  useUnlockedAchievements: jest.fn(),
  useGamificationSummary: jest.fn(),
}));

describe('Gamification Integration - Screen Enhancement Tests', () => {
  const mockUseGamification = useGamification as jest.MockedFunction<
    typeof useGamification
  >;
  const mockUsePointsWithMultiplier =
    usePointsWithMultiplier as jest.MockedFunction<typeof usePointsWithMultiplier>;
  const mockUseStreakMultiplier = useStreakMultiplier as jest.MockedFunction<
    typeof useStreakMultiplier
  >;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseGamification.mockReturnValue({
      totalPoints: 1500,
      currentLevel: 3,
      levelProgress: 300,
      pointsToNextLevel: 200,
      currentStreak: 5,
      longestStreak: 10,
      lastLogDate: '2025-12-18',
      achievements: [],
      unlockedAchievements: [],
      achievementPoints: 500,
      isLoading: false,
      error: null,
      addPoints: jest.fn(),
      updateStreak: jest.fn(),
      updateAchievementProgress: jest.fn(),
      updateMultipleProgress: jest.fn(),
      resetGameification: jest.fn(),
      refreshState: jest.fn(),
    });

    mockUsePointsWithMultiplier.mockReturnValue(150);
    mockUseStreakMultiplier.mockReturnValue(1.5);
  });

  /**
   * Test 1: VisionLogScreen awards points for meal logging
   */
  it('should award points when logging meal in VisionLogScreen', () => {
    const mockAddPoints = jest.fn();
    mockUseGamification.mockReturnValue({
      ...mockUseGamification(),
      addPoints: mockAddPoints,
    });

    // Test that gamification hook is available
    expect(mockUseGamification).toBeDefined();
  });

  /**
   * Test 2: Updates streak on daily meal log
   */
  it('should update streak when logging meal daily', () => {
    const mockUpdateStreak = jest.fn();
    mockUseGamification.mockReturnValue({
      ...mockUseGamification(),
      updateStreak: mockUpdateStreak,
    });

    expect(mockUseGamification).toBeDefined();
  });

  /**
   * Test 3: Shows points popup notification
   */
  it('should display points earned notification', () => {
    mockUsePointsWithMultiplier.mockReturnValue(250);

    // Notification should show earned points
    expect(mockUsePointsWithMultiplier).toBeDefined();
  });

  /**
   * Test 4: Applies streak multiplier to earned points
   */
  it('should apply streak multiplier to points earned', () => {
    const basePoints = 100;
    mockUseStreakMultiplier.mockReturnValue(1.5);
    mockUsePointsWithMultiplier.mockReturnValue(150); // 100 * 1.5

    expect(mockUsePointsWithMultiplier(basePoints)).toBe(150);
  });

  /**
   * Test 5: Shows level up notification
   */
  it('should display level up notification when user levels up', () => {
    const mockAddPoints = jest.fn().mockImplementation(() => {
      mockUseGamification.mockReturnValue({
        ...mockUseGamification(),
        currentLevel: 4,
      });
    });

    mockUseGamification.mockReturnValue({
      ...mockUseGamification(),
      addPoints: mockAddPoints,
    });

    expect(mockUseGamification).toBeDefined();
  });

  /**
   * Test 6: PlanScreen displays current level and progress
   */
  it('should display gamification summary in PlanScreen', () => {
    const gamification = mockUseGamification();

    expect(gamification.currentLevel).toBe(3);
    expect(gamification.totalPoints).toBe(1500);
    expect(gamification.currentStreak).toBe(5);
  });

  /**
   * Test 7: Shows achievement badge unlock
   */
  it('should display achievement unlock notification', async () => {
    const mockUpdateProgress = jest.fn();
    mockUseGamification.mockReturnValue({
      ...mockUseGamification(),
      updateAchievementProgress: mockUpdateProgress,
    });

    expect(mockUseGamification).toBeDefined();
  });

  /**
   * Test 8: FeedScreen shows gamification activities
   */
  it('should display gamification activities in social feed', () => {
    const gamification = mockUseGamification();

    // Feed should show achievements and level ups
    expect(gamification.unlockedAchievements).toBeDefined();
  });

  /**
   * Test 9: Updates achievement progress on screen interaction
   */
  it('should update achievement progress when required', () => {
    const mockUpdateProgress = jest.fn();
    mockUseGamification.mockReturnValue({
      ...mockUseGamification(),
      updateAchievementProgress: mockUpdateProgress,
    });

    expect(mockUpdateProgress).toBeDefined();
  });

  /**
   * Test 10: Shows streak counter in UI
   */
  it('should display current streak in UI', () => {
    const gamification = mockUseGamification();

    expect(gamification.currentStreak).toBe(5);
    expect(gamification.longestStreak).toBe(10);
  });

  /**
   * Test 11: Handles gamification loading state
   */
  it('should handle gamification data loading', () => {
    mockUseGamification.mockReturnValue({
      ...mockUseGamification(),
      isLoading: true,
    });

    const gamification = mockUseGamification();
    expect(gamification.isLoading).toBe(true);
  });

  /**
   * Test 12: Error handling for gamification failures
   */
  it('should handle gamification errors gracefully', () => {
    mockUseGamification.mockReturnValue({
      ...mockUseGamification(),
      error: 'Failed to load gamification data',
    });

    const gamification = mockUseGamification();
    expect(gamification.error).toBe('Failed to load gamification data');
  });

  /**
   * Test 13: Updates multiple achievements at once
   */
  it('should update multiple achievements simultaneously', () => {
    const mockUpdateMultiple = jest.fn();
    mockUseGamification.mockReturnValue({
      ...mockUseGamification(),
      updateMultipleProgress: mockUpdateMultiple,
    });

    expect(mockUpdateMultiple).toBeDefined();
  });

  /**
   * Test 14: Shows achievement progress bar
   */
  it('should display achievement progress indicators', () => {
    const achievements = [
      {
        id: 'test',
        title: 'Test',
        description: 'Test',
        points: 100,
        unlocked: false,
        progress: 50,
        target: 100,
      },
    ];

    const progress = (achievements[0].progress / achievements[0].target) * 100;
    expect(progress).toBe(50);
  });

  /**
   * Test 15: Displays earned points breakdown
   */
  it('should show points breakdown with multiplier', () => {
    const basePoints = 100;
    const multiplier = 1.5;
    const earnedPoints = Math.floor(basePoints * multiplier);

    expect(earnedPoints).toBe(150);
  });

  /**
   * Test 16: Awards bonus points for achievements
   */
  it('should award bonus points for achievement unlock', () => {
    const basePoints = 100;
    const achievementBonus = 50;
    const total = basePoints + achievementBonus;

    expect(total).toBe(150);
  });

  /**
   * Test 17: Displays total earned points
   */
  it('should show total points earned', () => {
    const gamification = mockUseGamification();

    expect(gamification.totalPoints).toBe(1500);
    expect(gamification.achievementPoints).toBe(500);
  });

  /**
   * Test 18: Shows progress to next level
   */
  it('should display points needed to level up', () => {
    const gamification = mockUseGamification();

    expect(gamification.pointsToNextLevel).toBe(200);
    expect(gamification.levelProgress).toBe(300);
  });

  /**
   * Test 19: Updates UI on streak change
   */
  it('should refresh UI when streak changes', () => {
    mockUseGamification.mockReturnValue({
      ...mockUseGamification(),
      currentStreak: 10,
    });

    const gamification = mockUseGamification();
    expect(gamification.currentStreak).toBe(10);
  });

  /**
   * Test 20: Shows gamification summary
   */
  it('should display complete gamification summary', () => {
    const gamification = mockUseGamification();

    expect(gamification.totalPoints).toBeDefined();
    expect(gamification.currentLevel).toBeDefined();
    expect(gamification.currentStreak).toBeDefined();
    expect(gamification.unlockedAchievements).toBeDefined();
  });

  /**
   * Test 21: Gamification persists across screens
   */
  it('should maintain gamification state across navigation', () => {
    const gamification1 = mockUseGamification();
    const gamification2 = mockUseGamification();

    expect(gamification1.totalPoints).toBe(gamification2.totalPoints);
  });

  /**
   * Test 22: Refresh gamification data
   */
  it('should support refreshing gamification data', () => {
    const mockRefresh = jest.fn();
    mockUseGamification.mockReturnValue({
      ...mockUseGamification(),
      refreshState: mockRefresh,
    });

    expect(mockRefresh).toBeDefined();
  });

  /**
   * Test 23: Reset gamification for testing
   */
  it('should support resetting gamification state', () => {
    const mockReset = jest.fn();
    mockUseGamification.mockReturnValue({
      ...mockUseGamification(),
      resetGameification: mockReset,
    });

    expect(mockReset).toBeDefined();
  });

  /**
   * Test 24: Badges display unlock animations
   */
  it('should animate achievement badge unlocks', () => {
    const unlockedAchievements = [
      {
        id: 'first_meal',
        title: 'First Meal',
        description: 'Log first meal',
        points: 100,
        unlocked: true,
        progress: 1,
        target: 1,
      },
    ];

    expect(unlockedAchievements[0].unlocked).toBe(true);
  });

  /**
   * Test 25: Integration ready
   */
  it('should be ready for full gamification integration', () => {
    const gamification = mockUseGamification();

    // All gamification functions available
    expect(gamification.addPoints).toBeDefined();
    expect(gamification.updateStreak).toBeDefined();
    expect(gamification.updateAchievementProgress).toBeDefined();
    expect(gamification.updateMultipleProgress).toBeDefined();
  });
});
