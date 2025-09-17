/**
 * Performance-Optimized Loading States
 * Advanced loading components optimized for React Native performance
 *
 * Features:
 * - Native driver animations for 60fps performance
 * - Memory-efficient operations with proper cleanup
 * - Optimized for Android platform
 * - Minimal re-renders through React.memo
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { tokens } from '../../styles/tokens';

const { width: screenWidth } = Dimensions.get('window');

// Performance-optimized shimmer animation hook
const useOptimizedShimmer = (duration: number = 1200) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Create animation with native driver for optimal performance
    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      })
    );

    animationRef.current = animation;
    animation.start();

    // Cleanup on unmount
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [animatedValue, duration]);

  return animatedValue;
};

// Performance-optimized OCR Processing Loader
interface OCRProcessingLoaderProps {
  visible: boolean;
  progress?: number;
  stage?: 'uploading' | 'processing' | 'analyzing' | 'complete';
  message?: string;
}

export const OCRProcessingLoader: React.FC<OCRProcessingLoaderProps> = React.memo(({
  visible,
  progress = 0,
  stage = 'uploading',
  message,
}) => {
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(0.8)).current;
  const shimmerAnimation = useOptimizedShimmer();

  // Optimized stage messages
  const stageMessages = useMemo(() => ({
    uploading: 'Uploading image...',
    processing: 'Processing with OCR...',
    analyzing: 'Analyzing nutrition data...',
    complete: 'Complete!'
  }), []);

  // Optimized stage icons
  const stageIcons = useMemo(() => ({
    uploading: '📤',
    processing: '🔍',
    analyzing: '🧠',
    complete: '✅'
  }), []);

  useEffect(() => {
    if (visible) {
      // Animate in with spring for performance
      Animated.parallel([
        Animated.timing(fadeAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnimation, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();
    } else {
      // Animate out quickly
      Animated.parallel([
        Animated.timing(fadeAnimation, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnimation, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnimation, scaleAnimation]);

  // Shimmer effect for progress bar
  const shimmerTranslate = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnimation,
          transform: [{ scale: scaleAnimation }],
        }
      ]}
    >
      <View style={styles.container}>
        {/* Stage Icon with pulse animation */}
        <Animated.View style={styles.iconContainer}>
          <Text style={styles.stageIcon}>{stageIcons[stage]}</Text>
        </Animated.View>

        {/* Progress Information */}
        <Text style={styles.title}>Processing Nutrition Label</Text>
        <Text style={styles.stageText}>
          {message || stageMessages[stage]}
        </Text>

        {/* Optimized Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${progress}%` }
              ]}
            />
            {/* Shimmer overlay for visual appeal */}
            <Animated.View
              style={[
                styles.progressShimmer,
                {
                  transform: [{ translateX: shimmerTranslate }],
                }
              ]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>

        {/* Activity Indicator for active processing */}
        {stage !== 'complete' && (
          <ActivityIndicator
            size="large"
            color={tokens.colors.primary[500]}
            style={styles.spinner}
          />
        )}
      </View>
    </Animated.View>
  );
});

// Fast Content Skeleton for immediate feedback
interface FastSkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const FastSkeleton: React.FC<FastSkeletonProps> = React.memo(({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const shimmerAnimation = useOptimizedShimmer(800);

  const shimmerTranslate = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-screenWidth, screenWidth],
  });

  return (
    <View
      style={[
        styles.skeletonContainer,
        { width, height, borderRadius },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.skeletonShimmer,
          {
            transform: [{ translateX: shimmerTranslate }],
          },
        ]}
      />
    </View>
  );
});

// Performance-optimized button loading state
interface ButtonLoadingProps {
  loading: boolean;
  text: string;
  loadingText?: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: any;
}

export const PerformanceButton: React.FC<ButtonLoadingProps> = React.memo(({
  loading,
  text,
  loadingText = 'Processing...',
  onPress,
  disabled = false,
  variant = 'primary',
  style,
}) => {
  const scaleAnimation = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (loading || disabled) return;

    Animated.spring(scaleAnimation, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 150,
      friction: 6,
    }).start();
  };

  const handlePressOut = () => {
    if (loading || disabled) return;

    Animated.spring(scaleAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 6,
    }).start();
  };

  const buttonStyle = [
    styles.button,
    variant === 'secondary' && styles.buttonSecondary,
    (loading || disabled) && styles.buttonDisabled,
    style,
  ];

  const textStyle = [
    styles.buttonText,
    variant === 'secondary' && styles.buttonTextSecondary,
    (loading || disabled) && styles.buttonTextDisabled,
  ];

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnimation }] }}>
      <View
        style={buttonStyle}
        onTouchStart={handlePressIn}
        onTouchEnd={handlePressOut}
        onTouchCancel={handlePressOut}
      >
        {loading && (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? tokens.colors.neutral[0] : tokens.colors.primary[500]}
            style={styles.buttonSpinner}
          />
        )}
        <Text style={textStyle}>
          {loading ? loadingText : text}
        </Text>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  // OCR Processing Loader
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  container: {
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.xl,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: '85%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tokens.colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  stageIcon: {
    fontSize: 32,
  },
  title: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: '600',
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
  },
  stageText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    marginBottom: tokens.spacing.lg,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: tokens.colors.neutral[200],
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: tokens.spacing.xs,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary[500],
    borderRadius: 4,
  },
  progressShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.3)',
    width: '30%',
  },
  progressText: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: '600',
    color: tokens.colors.primary[500],
  },
  spinner: {
    marginTop: tokens.spacing.md,
  },

  // Fast Skeleton
  skeletonContainer: {
    backgroundColor: tokens.colors.neutral[200],
    overflow: 'hidden',
  },
  skeletonShimmer: {
    width: '50%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.5)',
    position: 'absolute',
  },

  // Performance Button
  button: {
    backgroundColor: tokens.colors.primary[500],
    borderRadius: tokens.borderRadius.md,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    minHeight: 44, // Android touch target minimum
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.primary[500],
  },
  buttonDisabled: {
    backgroundColor: tokens.colors.neutral[300],
    borderColor: tokens.colors.neutral[300],
  },
  buttonText: {
    fontSize: tokens.typography.fontSize.md,
    fontWeight: '600',
    color: tokens.colors.neutral[0],
  },
  buttonTextSecondary: {
    color: tokens.colors.primary[500],
  },
  buttonTextDisabled: {
    color: tokens.colors.neutral[500],
  },
  buttonSpinner: {
    marginRight: tokens.spacing.sm,
  },
});

export default {
  OCRProcessingLoader,
  FastSkeleton,
  PerformanceButton,
};