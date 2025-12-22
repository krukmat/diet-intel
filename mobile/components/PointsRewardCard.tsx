/**
 * PointsRewardCard Component - Phase 2.4
 * Displays points earned from an activity with animations and notifications
 *
 * Features:
 * - Animated points display with scale/pop animation
 * - Streak bonus indicator
 * - Level up notification
 * - Customizable styling and animation
 * - Points breakdown (base + multiplier)
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

interface PointsRewardCardProps {
  basePoints: number;
  multiplier?: number;
  reason?: string;
  streakDays?: number;
  leveledUp?: boolean;
  onAnimationComplete?: () => void;
  style?: object;
  testID?: string;
}

/**
 * PointsRewardCard Component
 * Animated card showing points earned with optional level-up and streak bonus
 */
export const PointsRewardCard: React.FC<PointsRewardCardProps> = ({
  basePoints,
  multiplier = 1.0,
  reason = 'Activity Completed',
  streakDays = 0,
  leveledUp = false,
  onAnimationComplete,
  style,
  testID = 'points-reward-card',
}) => {
  const [scaleAnim] = useState(new Animated.Value(0));
  const [opacityAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(Dimensions.get('window').height));
  const [rotateAnim] = useState(new Animated.Value(0));

  // Calculate total points with multiplier
  const totalPoints = Math.floor(basePoints * multiplier);
  const bonusPoints = totalPoints - basePoints;

  // Trigger animation on mount
  useEffect(() => {
    Animated.parallel([
      // Scale pop animation
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 6,
      }),
      // Fade in
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Slide up from bottom
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      // Rotation for level-up
      leveledUp
        ? Animated.sequence([
            Animated.timing(rotateAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        : Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 1,
            useNativeDriver: true,
          }),
    ]).start(onAnimationComplete);
  }, [scaleAnim, opacityAnim, slideAnim, rotateAnim, leveledUp, onAnimationComplete]);

  /**
   * Get rotation value for spin animation
   */
  const rotateInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  /**
   * Get background color based on level-up
   */
  const getBackgroundColor = () => {
    if (leveledUp) return '#FFD700'; // Gold for level up
    if (bonusPoints > 0) return '#4CAF50'; // Green for streak bonus
    return '#2196F3'; // Blue for normal points
  };

  const backgroundColor = getBackgroundColor();

  return (
    <Animated.View
      style={[
        {
          transform: [
            { scale: scaleAnim },
            { translateY: slideAnim },
            { rotate: rotateInterpolation },
          ],
          opacity: opacityAnim,
        },
        style,
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor,
          },
        ]}
        testID={`${testID}-container`}
      >
        {/* Main Points Display */}
        <View style={styles.pointsSection} testID={`${testID}-points-section`}>
          <Text style={styles.pointsValue} testID={`${testID}-points-value`}>
            +{totalPoints}
          </Text>
          <Text style={styles.pointsLabel} testID={`${testID}-points-label`}>
            PTS
          </Text>
        </View>

        {/* Activity Reason */}
        <View style={styles.reasonSection} testID={`${testID}-reason-section`}>
          <Text style={styles.reason} testID={`${testID}-reason`}>
            {reason}
          </Text>
        </View>

        {/* Bonus Information */}
        {bonusPoints > 0 && (
          <View style={styles.bonusSection} testID={`${testID}-bonus-section`}>
            <Text style={styles.bonusLabel} testID={`${testID}-bonus-label`}>
              {streakDays > 0
                ? `${streakDays} Day Streak`
                : 'Bonus'}
            </Text>
            <Text style={styles.bonusValue} testID={`${testID}-bonus-value`}>
              +{bonusPoints}
            </Text>
          </View>
        )}

        {/* Level Up Badge */}
        {leveledUp && (
          <View style={styles.levelUpBadge} testID={`${testID}-level-up-badge`}>
            <Text style={styles.levelUpText} testID={`${testID}-level-up-text`}>
              LEVEL UP! 🎉
            </Text>
          </View>
        )}

        {/* Breakdown Info (show only for cards with multiplier) */}
        {multiplier > 1.0 && !leveledUp && (
          <View style={styles.breakdownSection} testID={`${testID}-breakdown-section`}>
            <Text style={styles.breakdownText} testID={`${testID}-breakdown-text`}>
              {basePoints} × {multiplier.toFixed(1)}x = {totalPoints}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 200,
  },
  pointsSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  pointsValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  pointsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 4,
  },
  reasonSection: {
    marginVertical: 8,
  },
  reason: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '500',
    textAlign: 'center',
  },
  bonusSection: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    width: '100%',
  },
  bonusLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  bonusValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 2,
  },
  levelUpBadge: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  levelUpText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  breakdownSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  breakdownText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
});

export default PointsRewardCard;
