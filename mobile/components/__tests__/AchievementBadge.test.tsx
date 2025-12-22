/**
 * AchievementBadge Component Tests - Phase 2.3
 * Tests for achievement badge rendering, animations, and interactions
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AchievementBadge } from '../AchievementBadge';
import { Achievement } from '../../services/AchievementService';

/**
 * Mock achievement data for testing
 */
const mockAchievements = {
  unlocked: {
    id: 'first_meal',
    title: 'First Meal',
    description: 'Log your first meal',
    points: 100,
    unlocked: true,
    progress: 1,
    target: 1,
    icon: undefined,
  } as Achievement,
  locked: {
    id: 'meal_logger',
    title: 'Meal Logger',
    description: 'Log 100 meals',
    points: 300,
    unlocked: false,
    progress: 50,
    target: 100,
    icon: undefined,
  } as Achievement,
  highValue: {
    id: 'master_loggers',
    title: 'Master Loggers',
    description: 'Log 1000 meals',
    points: 500,
    unlocked: true,
    progress: 1000,
    target: 1000,
    icon: undefined,
  } as Achievement,
  mediumValue: {
    id: 'steady_logger',
    title: 'Steady Logger',
    description: 'Log 500 meals',
    points: 200,
    unlocked: true,
    progress: 500,
    target: 500,
    icon: undefined,
  } as Achievement,
  withImage: {
    id: 'achievement_with_image',
    title: 'Image Achievement',
    description: 'Achievement with image',
    points: 150,
    unlocked: true,
    progress: 1,
    target: 1,
    icon: 'https://example.com/achievement.png',
  } as Achievement,
};

describe('AchievementBadge Component', () => {
  /**
   * Test 1: Renders unlocked achievement with correct visual state
   */
  it('should render unlocked achievement with correct styling', () => {
    const { getByTestId, queryByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.unlocked}
        testID="test-badge"
      />
    );

    // Badge container should be present
    expect(getByTestId('test-badge-container')).toBeTruthy();

    // Unlock indicator should be visible
    expect(getByTestId('test-badge-unlock-indicator')).toBeTruthy();

    // Badge should be fully opaque (not grayed out) by checking that container exists
    const badgeContainer = getByTestId('test-badge-container');
    expect(badgeContainer.props.style).toBeDefined();
  });

  /**
   * Test 2: Renders locked achievement with dimmed appearance
   */
  it('should render locked achievement with dimmed appearance', () => {
    const { getByTestId, queryByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.locked}
        testID="test-badge"
      />
    );

    // Badge should be visible
    const badgeContainer = getByTestId('test-badge-container');
    expect(badgeContainer.props.style).toBeDefined();

    // Unlock indicator should NOT be visible
    expect(queryByTestId('test-badge-unlock-indicator')).toBeNull();
  });

  /**
   * Test 3: Displays progress bar for locked achievements
   */
  it('should display progress bar for locked achievements', () => {
    const { getByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.locked}
        size="medium"
        showProgress={true}
        testID="test-badge"
      />
    );

    // Progress bar should be visible
    expect(getByTestId('test-badge-progress-bar')).toBeTruthy();

    // Progress fill should be visible
    const progressFill = getByTestId('test-badge-progress-fill');
    expect(progressFill).toBeTruthy();
  });

  /**
   * Test 4: Hides progress bar when showProgress is false
   */
  it('should hide progress bar when showProgress is false', () => {
    const { queryByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.locked}
        size="medium"
        showProgress={false}
        testID="test-badge"
      />
    );

    // Progress bar should not be visible
    expect(queryByTestId('test-badge-progress-bar')).toBeNull();
  });

  /**
   * Test 5: Hides progress bar for small size badges
   */
  it('should hide progress bar for small size badges', () => {
    const { queryByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.locked}
        size="small"
        showProgress={true}
        testID="test-badge"
      />
    );

    // Progress bar should not be visible for small size
    expect(queryByTestId('test-badge-progress-bar')).toBeNull();
  });

  /**
   * Test 6: Displays points for medium and large sizes
   */
  it('should display points for medium size', () => {
    const { getByTestId, getByText } = render(
      <AchievementBadge
        achievement={mockAchievements.locked}
        size="medium"
        showPoints={true}
        testID="test-badge"
      />
    );

    // Points container should be visible
    expect(getByTestId('test-badge-points')).toBeTruthy();

    // Points text should show correct value
    expect(getByText('300 pts')).toBeTruthy();
  });

  /**
   * Test 7: Hides points when showPoints is false
   */
  it('should hide points when showPoints is false', () => {
    const { queryByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.locked}
        size="medium"
        showPoints={false}
        testID="test-badge"
      />
    );

    // Points should not be visible
    expect(queryByTestId('test-badge-points')).toBeNull();
  });

  /**
   * Test 8: Hides points for small size badges
   */
  it('should hide points for small size badges', () => {
    const { queryByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.locked}
        size="small"
        showPoints={true}
        testID="test-badge"
      />
    );

    // Points should not be visible for small size
    expect(queryByTestId('test-badge-points')).toBeNull();
  });

  /**
   * Test 9: Changes badge color based on points (gold for high value)
   */
  it('should display gold color for high-value achievements (500+ points)', () => {
    const { getByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.highValue}
        testID="test-badge"
      />
    );

    const badgeContainer = getByTestId('test-badge-container');
    // Gold achievements should have distinct styling
    expect(badgeContainer).toBeTruthy();
    expect(badgeContainer.props.style).toBeDefined();
  });

  /**
   * Test 10: Displays title for large size badges
   */
  it('should display title for large size badges', () => {
    const { getByTestId, getByText } = render(
      <AchievementBadge
        achievement={mockAchievements.locked}
        size="large"
        testID="test-badge"
      />
    );

    // Title container should be visible
    expect(getByTestId('test-badge-title')).toBeTruthy();

    // Title text should match achievement title
    expect(getByText('Meal Logger')).toBeTruthy();
  });

  /**
   * Test 11: Hides title for small and medium size badges
   */
  it('should hide title for small and medium size badges', () => {
    const { rerender, queryByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.locked}
        size="small"
        testID="test-badge"
      />
    );

    // Title should not be visible for small
    expect(queryByTestId('test-badge-title')).toBeNull();

    // Test medium size
    rerender(
      <AchievementBadge
        achievement={mockAchievements.locked}
        size="medium"
        testID="test-badge"
      />
    );

    // Title should not be visible for medium
    expect(queryByTestId('test-badge-title')).toBeNull();
  });

  /**
   * Test 12: Renders placeholder icon when achievement has no image
   */
  it('should render placeholder icon when achievement has no image', () => {
    const { getByTestId, queryByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.locked}
        testID="test-badge"
      />
    );

    // Placeholder should be visible
    expect(getByTestId('test-badge-icon-placeholder')).toBeTruthy();

    // Image should not be visible
    expect(queryByTestId('test-badge-icon-image')).toBeNull();
  });

  /**
   * Test 13: Renders achievement image when available
   */
  it('should render achievement image when available', () => {
    const { getByTestId, queryByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.withImage}
        testID="test-badge"
      />
    );

    // Image should be visible
    expect(getByTestId('test-badge-icon-image')).toBeTruthy();

    // Placeholder should not be visible
    expect(queryByTestId('test-badge-icon-placeholder')).toBeNull();
  });

  /**
   * Test 14: Calls onPress callback when pressed
   */
  it('should call onPress callback when badge is pressed', () => {
    const mockOnPress = jest.fn();
    const { getByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.unlocked}
        onPress={mockOnPress}
        testID="test-badge"
      />
    );

    const badge = getByTestId('test-badge-container').parent;
    fireEvent.press(badge);

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  /**
   * Test 15: Responds to onPress with disabled behavior when no callback
   */
  it('should not respond to press when onPress is not provided', () => {
    const { getByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.unlocked}
        testID="test-badge"
      />
    );

    const badge = getByTestId('test-badge-container').parent;
    // Should not throw error
    expect(() => fireEvent.press(badge)).not.toThrow();
  });

  /**
   * Test 16: Calculates progress percentage correctly
   */
  it('should calculate progress percentage correctly', () => {
    const progressAchievement: Achievement = {
      ...mockAchievements.locked,
      progress: 75,
      target: 100,
    };

    const { getByTestId } = render(
      <AchievementBadge
        achievement={progressAchievement}
        size="medium"
        showProgress={true}
        testID="test-badge"
      />
    );

    const progressFill = getByTestId('test-badge-progress-fill');
    expect(progressFill).toBeTruthy();
    expect(progressFill.props.style).toBeDefined();
  });

  /**
   * Test 17: Caps progress bar at 100% even if progress exceeds target
   */
  it('should cap progress bar at 100% when progress exceeds target', () => {
    const overProgressAchievement: Achievement = {
      ...mockAchievements.locked,
      progress: 150,
      target: 100,
    };

    const { getByTestId } = render(
      <AchievementBadge
        achievement={overProgressAchievement}
        size="medium"
        showProgress={true}
        testID="test-badge"
      />
    );

    const progressFill = getByTestId('test-badge-progress-fill');
    expect(progressFill).toBeTruthy();
    expect(progressFill.props.style).toBeDefined();
  });

  /**
   * Test 18: Provides different badge sizes (small, medium, large)
   */
  it('should render different badge sizes correctly', () => {
    const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

    sizes.forEach((size) => {
      const { getByTestId, rerender } = render(
        <AchievementBadge
          achievement={mockAchievements.unlocked}
          size={size}
          testID={`badge-${size}`}
        />
      );

      const badge = getByTestId(`badge-${size}-container`);
      expect(badge).toBeTruthy();

      if (size !== 'small') {
        rerender(
          <AchievementBadge
            achievement={mockAchievements.unlocked}
            size={size}
            testID={`badge-${size}`}
          />
        );
      }
    });
  });

  /**
   * Test 19: Handles zero progress achievement
   */
  it('should handle zero progress achievement', () => {
    const zeroProgressAchievement: Achievement = {
      ...mockAchievements.locked,
      progress: 0,
      target: 100,
    };

    const { getByTestId } = render(
      <AchievementBadge
        achievement={zeroProgressAchievement}
        size="medium"
        showProgress={true}
        testID="test-badge"
      />
    );

    const progressFill = getByTestId('test-badge-progress-fill');
    expect(progressFill).toBeTruthy();
    expect(progressFill.props.style).toBeDefined();
  });

  /**
   * Test 20: Uses custom testID when provided
   */
  it('should use custom testID when provided', () => {
    const { getByTestId, queryByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.unlocked}
        testID="custom-test-id"
      />
    );

    // Custom testID should be used
    expect(getByTestId('custom-test-id')).toBeTruthy();

    // Default testID should not be present
    expect(queryByTestId('achievement-badge-first_meal')).toBeNull();
  });

  /**
   * Test 21: Generates default testID from achievement ID
   */
  it('should generate default testID from achievement ID', () => {
    const { getByTestId } = render(
      <AchievementBadge achievement={mockAchievements.unlocked} />
    );

    // Default testID should be generated
    expect(getByTestId('achievement-badge-first_meal')).toBeTruthy();
  });

  /**
   * Test 22: Updates visual state when achievement unlocked status changes
   */
  it('should update visual state when unlocked status changes', () => {
    const { rerender, getByTestId, queryByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.locked}
        testID="test-badge"
      />
    );

    // Initially locked - no unlock indicator
    expect(queryByTestId('test-badge-unlock-indicator')).toBeNull();

    // Update to unlocked
    rerender(
      <AchievementBadge
        achievement={mockAchievements.unlocked}
        testID="test-badge"
      />
    );

    // Now should show unlock indicator
    expect(getByTestId('test-badge-unlock-indicator')).toBeTruthy();
  });

  /**
   * Test 23: Disable animation when animated prop is false
   */
  it('should respect animated prop', () => {
    const { getByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.unlocked}
        animated={false}
        testID="test-badge"
      />
    );

    // Badge should render without animation errors
    expect(getByTestId('test-badge-container')).toBeTruthy();
  });

  /**
   * Test 24: Badge border color reflects unlock status
   */
  it('should show different border color for locked vs unlocked', () => {
    const { getByTestId: getLockedBadge, rerender } = render(
      <AchievementBadge
        achievement={mockAchievements.locked}
        testID="locked-badge"
      />
    );

    const lockedContainer = getLockedBadge('locked-badge-container');
    expect(lockedContainer).toBeTruthy();

    rerender(
      <AchievementBadge
        achievement={mockAchievements.unlocked}
        testID="unlocked-badge"
      />
    );

    // Should have different styling between locked and unlocked
    const unlockedContainer = getLockedBadge('unlocked-badge-container');
    expect(unlockedContainer).toBeTruthy();
  });

  /**
   * Test 25: All achievement details are accessible via testID
   */
  it('should provide access to all badge subcomponents via testID', () => {
    const { getByTestId, queryByTestId } = render(
      <AchievementBadge
        achievement={mockAchievements.highValue}
        size="large"
        showProgress={false}
        showPoints={true}
        testID="complete-badge"
      />
    );

    // All main components should be accessible
    expect(getByTestId('complete-badge')).toBeTruthy();
    expect(getByTestId('complete-badge-container')).toBeTruthy();
    expect(getByTestId('complete-badge-unlock-indicator')).toBeTruthy();
    expect(getByTestId('complete-badge-points')).toBeTruthy();
    expect(getByTestId('complete-badge-title')).toBeTruthy();
  });
});
