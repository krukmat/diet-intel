/**
 * Card Component
 * Unified card system solving current card inconsistencies
 *
 * Replaces chaotic card styles with 4 systematic variants:
 * - Default: Stats cards style (white background, subtle shadow)
 * - Elevated: Demo section style (higher shadow for emphasis)
 * - Outlined: Border instead of shadow (alternative styling)
 * - Interactive: Feature button cards (touchable with feedback)
 */

import React, { useState, useRef } from 'react';
import {
  TouchableOpacity,
  View,
  Animated,
  AccessibilityRole,
} from 'react-native';
import { CardProps, CardStyleConfig } from './Card.types';
import { getCardStyles } from './Card.styles';
import { tokens } from '../../../styles/tokens';

/**
 * Main Card Component
 * Flexible card container with consistent styling and optional interactivity
 */
export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  shadow,
  children,
  onPress,
  style,
  testID,
  backgroundColor,
  borderRadius,
  ...touchableProps
}) => {
  // State management for interactive cards
  const [isPressed, setIsPressed] = useState(false);

  // Animation setup for interactive feedback
  const scaleAnimation = useRef(new Animated.Value(1)).current;

  // Determine if card is interactive
  const isInteractive = Boolean(onPress) || variant === 'interactive';

  // Style configuration
  const styleConfig: CardStyleConfig = {
    variant,
    padding,
    shadow: shadow || 'sm', // Will be resolved to default in styles
    interactive: isInteractive,
    pressed: isPressed,
  };

  // Generate styles based on configuration
  const styles = getCardStyles(styleConfig);

  // Custom overrides
  const customStyle = {
    ...(backgroundColor && { backgroundColor }),
    ...(borderRadius && { borderRadius }),
  };

  /**
   * Handle press in with animation
   */
  const handlePressIn = () => {
    if (!isInteractive) return;

    setIsPressed(true);

    // Subtle scale animation for feedback
    Animated.spring(scaleAnimation, {
      toValue: 0.98,
      duration: tokens.animation.duration.fast,
      useNativeDriver: true,
    }).start();
  };

  /**
   * Handle press out with animation
   */
  const handlePressOut = () => {
    if (!isInteractive) return;

    setIsPressed(false);

    // Return to original scale
    Animated.spring(scaleAnimation, {
      toValue: 1,
      duration: tokens.animation.duration.normal,
      useNativeDriver: true,
    }).start();
  };

  /**
   * Handle press event
   */
  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  /**
   * Get accessibility role
   */
  const getAccessibilityRole = (): AccessibilityRole => {
    return isInteractive ? 'button' : 'none';
  };

  /**
   * Render card content
   */
  const renderContent = () => (
    <View
      style={[styles.container, customStyle, style]}
      testID={testID || 'card'}
    >
      {children}
    </View>
  );

  // If interactive, wrap in TouchableOpacity with animations
  if (isInteractive) {
    return (
      <Animated.View
        style={{ transform: [{ scale: scaleAnimation }] }}
        testID={testID ? `${testID}-container` : 'card-container'}
      >
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.95}
          accessible={true}
          accessibilityRole={getAccessibilityRole()}
          testID={testID}
          {...touchableProps}
        >
          {renderContent()}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // For non-interactive cards, return simple view
  return renderContent();
};

// Export types for external usage
export type { CardProps } from './Card.types';
export { type CardVariant, type CardPadding, type CardShadow } from './Card.types';