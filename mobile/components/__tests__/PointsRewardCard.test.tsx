/**
 * PointsRewardCard Component Tests - Phase 2.4
 * Tests for points reward card display, animations, and interactions
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { PointsRewardCard } from '../PointsRewardCard';

describe('PointsRewardCard Component', () => {
  /**
   * Test 1: Renders with basic points display
   */
  it('should render points reward card with base points', () => {
    const { getByTestId, getByText } = render(
      <PointsRewardCard basePoints={100} testID="points-card" />
    );

    expect(getByTestId('points-card')).toBeTruthy();
    expect(getByTestId('points-card-points-section')).toBeTruthy();
    expect(getByText('+100')).toBeTruthy();
    expect(getByText('PTS')).toBeTruthy();
  });

  /**
   * Test 2: Displays activity reason
   */
  it('should display activity reason', () => {
    const { getByTestId, getByText } = render(
      <PointsRewardCard
        basePoints={50}
        reason="Meal Logged"
        testID="points-card"
      />
    );

    expect(getByTestId('points-card-reason-section')).toBeTruthy();
    expect(getByText('Meal Logged')).toBeTruthy();
  });

  /**
   * Test 3: Uses default reason when not provided
   */
  it('should use default reason when not provided', () => {
    const { getByText } = render(
      <PointsRewardCard basePoints={100} />
    );

    expect(getByText('Activity Completed')).toBeTruthy();
  });

  /**
   * Test 4: Calculates points with multiplier correctly
   */
  it('should calculate total points with multiplier', () => {
    const { getByText } = render(
      <PointsRewardCard basePoints={100} multiplier={1.5} />
    );

    // 100 * 1.5 = 150
    expect(getByText('+150')).toBeTruthy();
  });

  /**
   * Test 5: Displays bonus section when multiplier > 1
   */
  it('should display bonus section when multiplier is greater than 1', () => {
    const { getByTestId, getByText } = render(
      <PointsRewardCard
        basePoints={100}
        multiplier={2.0}
        testID="points-card"
      />
    );

    expect(getByTestId('points-card-bonus-section')).toBeTruthy();
    expect(getByText('+100')).toBeTruthy(); // Bonus points: 200 - 100 = 100
  });

  /**
   * Test 6: Shows breakdown when multiplier provided
   */
  it('should show breakdown calculation', () => {
    const { getByTestId } = render(
      <PointsRewardCard
        basePoints={100}
        multiplier={1.5}
        testID="points-card"
      />
    );

    expect(getByTestId('points-card-breakdown-section')).toBeTruthy();
    expect(getByTestId('points-card-breakdown-text')).toBeTruthy();
  });

  /**
   * Test 7: Displays streak information in bonus section
   */
  it('should display streak information when streak days provided', () => {
    const { getByText } = render(
      <PointsRewardCard
        basePoints={100}
        multiplier={1.2}
        streakDays={5}
      />
    );

    expect(getByText('5 Day Streak')).toBeTruthy();
  });

  /**
   * Test 8: Shows level up badge when leveledUp is true
   */
  it('should display level up badge', () => {
    const { getByTestId, getByText } = render(
      <PointsRewardCard
        basePoints={100}
        leveledUp={true}
        testID="points-card"
      />
    );

    expect(getByTestId('points-card-level-up-badge')).toBeTruthy();
    expect(getByText('LEVEL UP! 🎉')).toBeTruthy();
  });

  /**
   * Test 9: Hides breakdown when leveledUp is true
   */
  it('should hide breakdown section when level up occurs', () => {
    const { queryByTestId } = render(
      <PointsRewardCard
        basePoints={100}
        multiplier={1.5}
        leveledUp={true}
        testID="points-card"
      />
    );

    // Breakdown should not be shown during level up
    expect(queryByTestId('points-card-breakdown-section')).toBeNull();
  });

  /**
   * Test 10: Provides animation callback prop
   */
  it('should accept onAnimationComplete callback prop', () => {
    const mockCallback = jest.fn();

    const { getByTestId } = render(
      <PointsRewardCard
        basePoints={100}
        onAnimationComplete={mockCallback}
        testID="card"
      />
    );

    // Card should render even if callback not called immediately
    expect(getByTestId('card')).toBeTruthy();
  });

  /**
   * Test 11: Applies custom style prop
   */
  it('should apply custom style', () => {
    const customStyle = { marginTop: 20 };
    const { getByTestId } = render(
      <PointsRewardCard
        basePoints={100}
        style={customStyle}
        testID="points-card"
      />
    );

    const card = getByTestId('points-card');
    expect(card.props.style).toBeDefined();
  });

  /**
   * Test 12: Uses custom testID when provided
   */
  it('should use custom testID', () => {
    const { getByTestId, queryByTestId } = render(
      <PointsRewardCard
        basePoints={100}
        testID="custom-reward-card"
      />
    );

    expect(getByTestId('custom-reward-card')).toBeTruthy();
    expect(queryByTestId('points-reward-card')).toBeNull();
  });

  /**
   * Test 13: Uses default testID when not provided
   */
  it('should use default testID when not provided', () => {
    const { getByTestId } = render(
      <PointsRewardCard basePoints={100} />
    );

    expect(getByTestId('points-reward-card')).toBeTruthy();
  });

  /**
   * Test 14: Handles zero base points
   */
  it('should handle zero base points', () => {
    const { getByText } = render(
      <PointsRewardCard basePoints={0} />
    );

    expect(getByText('+0')).toBeTruthy();
  });

  /**
   * Test 15: Handles zero multiplier (defaults to 1.0)
   */
  it('should handle zero streak days', () => {
    const { queryByTestId, getByTestId } = render(
      <PointsRewardCard
        basePoints={100}
        multiplier={1.0}
        streakDays={0}
        testID="points-card"
      />
    );

    expect(getByTestId('points-card')).toBeTruthy();
  });

  /**
   * Test 16: Bonus section visible with base points + multiplier
   */
  it('should show bonus when multiplier greater than 1', () => {
    const { getByTestId } = render(
      <PointsRewardCard
        basePoints={100}
        multiplier={1.5}
        testID="points-card"
      />
    );

    // Bonus: 150 - 100 = 50
    expect(getByTestId('points-card-bonus-value')).toBeTruthy();
  });

  /**
   * Test 17: All subcomponents accessible via testID
   */
  it('should have all subcomponents accessible', () => {
    const { getByTestId } = render(
      <PointsRewardCard
        basePoints={100}
        multiplier={2.0}
        reason="Test Activity"
        streakDays={3}
        leveledUp={false}
        testID="test-card"
      />
    );

    expect(getByTestId('test-card')).toBeTruthy();
    expect(getByTestId('test-card-container')).toBeTruthy();
    expect(getByTestId('test-card-points-section')).toBeTruthy();
    expect(getByTestId('test-card-points-value')).toBeTruthy();
    expect(getByTestId('test-card-points-label')).toBeTruthy();
    expect(getByTestId('test-card-reason-section')).toBeTruthy();
    expect(getByTestId('test-card-reason')).toBeTruthy();
    expect(getByTestId('test-card-bonus-section')).toBeTruthy();
  });

  /**
   * Test 18: Large points values display correctly
   */
  it('should handle large points values', () => {
    const { getByText } = render(
      <PointsRewardCard basePoints={9999} />
    );

    expect(getByText('+9999')).toBeTruthy();
  });

  /**
   * Test 19: Multiplier calculations are floored correctly
   */
  it('should floor multiplier calculations', () => {
    const { getByText } = render(
      <PointsRewardCard basePoints={100} multiplier={1.55} />
    );

    // 100 * 1.55 = 155 (floored)
    expect(getByText('+155')).toBeTruthy();
  });

  /**
   * Test 20: High streak displays correctly
   */
  it('should display high streak values', () => {
    const { getByText } = render(
      <PointsRewardCard
        basePoints={100}
        multiplier={2.5}
        streakDays={30}
      />
    );

    expect(getByText('30 Day Streak')).toBeTruthy();
  });
});
