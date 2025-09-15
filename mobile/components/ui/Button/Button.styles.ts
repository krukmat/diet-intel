/**
 * Button Component Styles
 * Token-based styling system for consistent button appearance
 */

import { StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import {
  ButtonVariant,
  ButtonSize,
  ButtonWidth,
  ButtonTheme,
  ButtonSizeConfig,
  ButtonStyleConfig
} from './Button.types';

/**
 * Button Theme Configurations
 * Maps each variant to specific colors and styling
 */
const buttonThemes: Record<ButtonVariant, ButtonTheme> = {
  primary: {
    backgroundColor: tokens.colors.primary[500],
    borderColor: tokens.colors.primary[500],
    borderWidth: 0,
    textColor: tokens.colors.neutral[0], // White text
    pressedBackgroundColor: tokens.colors.primary[600],
    pressedTextColor: tokens.colors.neutral[0],
    disabledBackgroundColor: tokens.colors.neutral[300],
    disabledTextColor: tokens.colors.neutral[400],
    disabledBorderColor: tokens.colors.neutral[300],
  },

  secondary: {
    backgroundColor: tokens.colors.neutral[0], // White background
    borderColor: tokens.colors.primary[500],
    borderWidth: 1,
    textColor: tokens.colors.primary[500],
    pressedBackgroundColor: tokens.colors.primary[50],
    pressedTextColor: tokens.colors.primary[600],
    disabledBackgroundColor: tokens.colors.neutral[100],
    disabledTextColor: tokens.colors.neutral[400],
    disabledBorderColor: tokens.colors.neutral[300],
  },

  tertiary: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    textColor: tokens.colors.primary[500],
    pressedBackgroundColor: tokens.colors.primary[50],
    pressedTextColor: tokens.colors.primary[600],
    disabledBackgroundColor: 'transparent',
    disabledTextColor: tokens.colors.neutral[400],
    disabledBorderColor: 'transparent',
  },

  destructive: {
    backgroundColor: tokens.colors.semantic.error[500],
    borderColor: tokens.colors.semantic.error[500],
    borderWidth: 0,
    textColor: tokens.colors.neutral[0],
    pressedBackgroundColor: tokens.colors.semantic.error[600],
    pressedTextColor: tokens.colors.neutral[0],
    disabledBackgroundColor: tokens.colors.neutral[300],
    disabledTextColor: tokens.colors.neutral[400],
    disabledBorderColor: tokens.colors.neutral[300],
  },
};

/**
 * Button Size Configurations
 * Maps each size to specific dimensions and typography
 */
const buttonSizes: Record<ButtonSize, ButtonSizeConfig> = {
  sm: {
    paddingHorizontal: tokens.spacing.sm, // 8px
    paddingVertical: tokens.spacing.xs, // 4px
    fontSize: tokens.typography.fontSize.sm, // 14px
    iconSize: 16,
    minHeight: 36,
    borderRadius: tokens.borderRadius.md, // 8px
  },

  md: {
    paddingHorizontal: tokens.layout.buttonPadding, // 12px
    paddingVertical: tokens.spacing.sm, // 8px
    fontSize: tokens.typography.fontSize.base, // 16px
    iconSize: 20,
    minHeight: tokens.touchTargets.minimum, // 44px (accessibility)
    borderRadius: tokens.borderRadius.md, // 8px
  },

  lg: {
    paddingHorizontal: tokens.spacing.md, // 16px
    paddingVertical: tokens.spacing.sm + 2, // 10px
    fontSize: tokens.typography.fontSize.md, // 18px
    iconSize: 24,
    minHeight: tokens.touchTargets.comfortable, // 48px
    borderRadius: tokens.borderRadius.lg, // 12px
  },
};

/**
 * Generate button container styles based on configuration
 */
export const getButtonContainerStyle = (config: ButtonStyleConfig) => {
  const theme = buttonThemes[config.variant];
  const size = buttonSizes[config.size];

  return {
    // Base layout
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,

    // Sizing
    minHeight: size.minHeight,
    paddingHorizontal: size.paddingHorizontal,
    paddingVertical: size.paddingVertical,

    // Width behavior
    ...(config.width === 'full' && { alignSelf: 'stretch' as const }),

    // Appearance
    backgroundColor: config.pressed
      ? theme.pressedBackgroundColor
      : config.disabled
        ? theme.disabledBackgroundColor
        : theme.backgroundColor,
    borderColor: config.disabled ? theme.disabledBorderColor : theme.borderColor,
    borderWidth: theme.borderWidth,
    borderRadius: size.borderRadius,

    // States
    opacity: config.loading ? 0.8 : 1,

    // Shadow for elevated buttons (primary and destructive)
    ...(config.variant === 'primary' || config.variant === 'destructive') && !config.disabled && {
      ...tokens.shadows.sm,
    },
  };
};

/**
 * Generate button text styles based on configuration
 */
export const getButtonTextStyle = (config: ButtonStyleConfig) => {
  const theme = buttonThemes[config.variant];
  const size = buttonSizes[config.size];

  return {
    fontSize: size.fontSize,
    fontWeight: tokens.typography.fontWeight.semibold as const,
    lineHeight: size.fontSize * tokens.typography.lineHeight.tight,
    textAlign: 'center' as const,
    color: config.pressed
      ? theme.pressedTextColor
      : config.disabled
        ? theme.disabledTextColor
        : theme.textColor,
  };
};

/**
 * Generate icon container styles
 */
export const getIconContainerStyle = (position: 'left' | 'right') => ({
  marginLeft: position === 'right' ? tokens.spacing.xs : 0,
  marginRight: position === 'left' ? tokens.spacing.xs : 0,
});

/**
 * Loading spinner styles
 */
export const loadingSpinnerStyle = {
  marginRight: tokens.spacing.xs,
};

/**
 * Static styles that don't depend on props
 */
export const staticStyles = StyleSheet.create({
  // Base button container
  baseContainer: {
    overflow: 'hidden', // Ensures pressed state doesn't leak
  },

  // Loading state overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  // Content container for proper layout
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text container for proper alignment
  textContainer: {
    flexShrink: 1,
  },

  // Icon containers
  leftIconContainer: {
    marginRight: tokens.spacing.xs,
  },

  rightIconContainer: {
    marginLeft: tokens.spacing.xs,
  },
});

/**
 * Utility function to get complete button styles
 * Combines all style functions for easy consumption
 */
export const getButtonStyles = (config: ButtonStyleConfig) => ({
  container: [staticStyles.baseContainer, getButtonContainerStyle(config)],
  contentContainer: staticStyles.contentContainer,
  text: getButtonTextStyle(config),
  leftIcon: staticStyles.leftIconContainer,
  rightIcon: staticStyles.rightIconContainer,
  loadingOverlay: staticStyles.loadingOverlay,
  loadingSpinner: loadingSpinnerStyle,
});

/**
 * Export button theme for external access
 * Useful for creating consistent related components
 */
export { buttonThemes, buttonSizes };