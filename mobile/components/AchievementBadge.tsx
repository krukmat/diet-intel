/**
 * AchievementBadge Component - Phase 2.3
 * Displays individual achievement badge with progress, unlock status, and animations
 *
 * Features:
 * - Badge rendering with icon/image
 * - Progress bar for locked achievements
 * - Unlock animation when achievement unlocks
 * - Tooltip with achievement details
 * - Points display
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Achievement } from '../services/AchievementService';

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: 'small' | 'medium' | 'large';
  showProgress?: boolean;
  showPoints?: boolean;
  animated?: boolean;
  onPress?: () => void;
  testID?: string;
}

/**
 * Badge size configurations
 */
const BADGE_SIZES = {
  small: { container: 50, icon: 40, progress: 2 },
  medium: { container: 80, icon: 60, progress: 3 },
  large: { container: 120, icon: 90, progress: 4 },
};

/**
 * AchievementBadge Component
 * Displays a single achievement with status, progress, and animations
 */
export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  achievement,
  size = 'medium',
  showProgress = true,
  showPoints = true,
  animated = true,
  onPress,
  testID = `achievement-badge-${achievement.id}`,
}) => {
  const [scaleAnim] = useState(new Animated.Value(0));
  const [opacityAnim] = useState(new Animated.Value(0));
  const sizeConfig = BADGE_SIZES[size];

  // Trigger unlock animation when achievement unlocks
  useEffect(() => {
    if (achievement.unlocked && animated) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 60,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!achievement.unlocked) {
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
    }
  }, [achievement.unlocked, animated, scaleAnim, opacityAnim]);

  /**
   * Calculate progress percentage
   */
  const progressPercentage = Math.min(
    (achievement.progress / achievement.target) * 100,
    100
  );

  /**
   * Determine badge color based on rarity/points
   */
  const getBadgeColor = () => {
    if (!achievement.unlocked) return '#e0e0e0'; // Gray for locked
    if (achievement.points >= 500) return '#ffd700'; // Gold for high value
    if (achievement.points >= 200) return '#c0c0c0'; // Silver
    return '#cd7f32'; // Bronze
  };

  const badgeColor = getBadgeColor();

  /**
   * Get achievement icon/placeholder
   */
  const getAchievementIcon = () => {
    // Try to load achievement image if available
    if (achievement.icon) {
      return (
        <Image
          source={{ uri: achievement.icon }}
          style={{
            width: sizeConfig.icon,
            height: sizeConfig.icon,
            borderRadius: sizeConfig.icon / 2,
          }}
          testID={`${testID}-icon-image`}
        />
      );
    }

    // Fallback: Show emoji/placeholder
    return (
      <View
        style={{
          width: sizeConfig.icon,
          height: sizeConfig.icon,
          borderRadius: sizeConfig.icon / 2,
          backgroundColor: badgeColor,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        testID={`${testID}-icon-placeholder`}
      >
        <Text style={{ fontSize: Math.max(20, sizeConfig.icon / 3) }}>🏆</Text>
      </View>
    );
  };

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
      testID={testID}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        style={styles.container}
      >
        {/* Main Badge Container */}
        <View
          style={[
            styles.badge,
            {
              width: sizeConfig.container,
              height: sizeConfig.container,
              borderWidth: achievement.unlocked ? 2 : 1,
              borderColor: achievement.unlocked ? badgeColor : '#999',
              opacity: achievement.unlocked ? 1 : 0.6,
            },
          ]}
          testID={`${testID}-container`}
        >
          {/* Achievement Icon */}
          {getAchievementIcon()}

          {/* Unlock Indicator */}
          {achievement.unlocked && (
            <View
              style={[
                styles.unlockBadge,
                {
                  width: sizeConfig.container * 0.3,
                  height: sizeConfig.container * 0.3,
                },
              ]}
              testID={`${testID}-unlock-indicator`}
            >
              <Text style={styles.checkmark}>✓</Text>
            </View>
          )}
        </View>

        {/* Progress Bar (for locked achievements) */}
        {!achievement.unlocked && showProgress && size !== 'small' && (
          <View
            style={[
              styles.progressContainer,
              {
                width: sizeConfig.container,
                height: sizeConfig.progress,
              },
            ]}
            testID={`${testID}-progress-bar`}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPercentage}%`,
                  height: sizeConfig.progress,
                },
              ]}
              testID={`${testID}-progress-fill`}
            />
          </View>
        )}

        {/* Points Display */}
        {showPoints && size !== 'small' && (
          <View style={styles.pointsContainer} testID={`${testID}-points`}>
            <Text style={styles.pointsText}>{achievement.points} pts</Text>
          </View>
        )}

        {/* Title (only for larger sizes) */}
        {size === 'large' && (
          <View style={styles.titleContainer} testID={`${testID}-title`}>
            <Text style={styles.title} numberOfLines={1}>
              {achievement.title}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  unlockBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#4CAF50',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressContainer: {
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  pointsContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  titleContainer: {
    width: '100%',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});

export default AchievementBadge;
