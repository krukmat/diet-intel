/**
 * Button Component
 * Comprehensive button system solving UI chaos with consistent design tokens
 *
 * Replaces 9+ inconsistent button styles with 4 systematic variants
 * - Primary: "Escaner de Código" (main actions)
 * - Secondary: "Subir Etiqueta" (secondary actions)
 * - Tertiary: Minimal text buttons
 * - Destructive: "Restablecer" (dangerous actions)
 */

import React, { useState, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
  Animated,
  AccessibilityRole,
} from 'react-native';
import { ButtonProps, ButtonStyleConfig } from './Button.types';
import { getButtonStyles } from './Button.styles';
import { tokens } from '../../../styles/tokens';

/**
 * Main Button Component
 * Unified button system with accessibility, animations, and loading states
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  width = 'auto',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  children,
  onPress,
  testID,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  ...touchableProps
}) => {
  // State management
  const [isPressed, setIsPressed] = useState(false);

  // Animation setup
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const opacityAnimation = useRef(new Animated.Value(1)).current;

  // Style configuration
  const styleConfig: ButtonStyleConfig = {
    variant,
    size,
    width,
    disabled,
    loading,
    pressed: isPressed,
  };

  // Generate styles based on configuration
  const styles = getButtonStyles(styleConfig);

  /**
   * Handle press in with animation
   */
  const handlePressIn = () => {
    if (disabled || loading) return;

    setIsPressed(true);

    // Scale and opacity animation for feedback
    Animated.parallel([
      Animated.spring(scaleAnimation, {
        toValue: 0.95,
        duration: tokens.animation.duration.fast,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnimation, {
        toValue: 0.8,
        duration: tokens.animation.duration.fast,
        useNativeDriver: true,
      }),
    ]).start();
  };

  /**
   * Handle press out with animation
   */
  const handlePressOut = () => {
    if (disabled || loading) return;

    setIsPressed(false);

    // Return to original state
    Animated.parallel([
      Animated.spring(scaleAnimation, {
        toValue: 1,
        duration: tokens.animation.duration.normal,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnimation, {
        toValue: 1,
        duration: tokens.animation.duration.normal,
        useNativeDriver: true,
      }),
    ]).start();
  };

  /**
   * Handle press with proper state management
   */
  const handlePress = () => {
    if (disabled || loading) return;
    onPress();
  };

  /**
   * Get loading spinner color based on variant
   */
  const getSpinnerColor = (): string => {
    switch (variant) {
      case 'primary':
      case 'destructive':
        return tokens.colors.neutral[0]; // White spinner on colored background
      case 'secondary':
      case 'tertiary':
        return tokens.colors.primary[500]; // Blue spinner on light background
      default:
        return tokens.colors.primary[500];
    }
  };

  /**
   * Get accessibility role based on button purpose
   */
  const getAccessibilityRole = (): AccessibilityRole => {
    return 'button';
  };

  /**
   * Generate accessibility label
   */
  const getAccessibilityLabel = (): string => {
    if (accessibilityLabel) return accessibilityLabel;
    if (typeof children === 'string') return children;
    return 'Button';
  };

  /**
   * Generate accessibility state
   */
  const getAccessibilityState = () => ({
    disabled: disabled || loading,
    busy: loading,
  });

  /**
   * Render loading spinner
   */
  const renderLoadingSpinner = () => {
    if (!loading) return null;

    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator
          size="small"
          color={getSpinnerColor()}
          style={styles.loadingSpinner}
          testID={testID ? `${testID}-loading` : 'button-loading'}
        />
        {/* Keep text visible but faded during loading */}
        <View style={{ opacity: 0.6 }}>
          {renderContent()}
        </View>
      </View>
    );
  };

  /**
   * Render button content (icons + text)
   */
  const renderContent = () => (
    <View style={styles.contentContainer}>
      {leftIcon && (
        <View style={styles.leftIcon} testID={testID ? `${testID}-left-icon` : 'button-left-icon'}>
          {leftIcon}
        </View>
      )}

      <View style={styles.textContainer}>
        <Text
          style={[styles.text, textStyle]}
          numberOfLines={1}
          ellipsizeMode="tail"
          testID={testID ? `${testID}-text` : 'button-text'}
        >
          {children}
        </Text>
      </View>

      {rightIcon && (
        <View style={styles.rightIcon} testID={testID ? `${testID}-right-icon` : 'button-right-icon'}>
          {rightIcon}
        </View>
      )}
    </View>
  );

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale: scaleAnimation }],
          opacity: opacityAnimation,
        },
        style,
      ]}
      testID={testID ? `${testID}-container` : 'button-container'}
    >
      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.8}
        accessible={true}
        accessibilityRole={getAccessibilityRole()}
        accessibilityLabel={getAccessibilityLabel()}
        accessibilityHint={accessibilityHint}
        accessibilityState={getAccessibilityState()}
        testID={testID}
        {...touchableProps}
      >
        {loading ? renderLoadingSpinner() : renderContent()}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Export types for external usage
export type { ButtonProps } from './Button.types';
export { type ButtonVariant, type ButtonSize, type ButtonWidth } from './Button.types';