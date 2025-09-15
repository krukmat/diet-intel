/**
 * Input Component Styles
 * Token-based styling system for consistent input appearance
 *
 * Solves current input chaos:
 * - Manual calorie input: No consistent styling
 * - Search fields: Different styles across screens
 * - Form inputs: No standardized validation states
 * - Inconsistent focus and error states
 */

import { StyleSheet } from 'react-native';
import { tokens } from '../../../styles/tokens';
import {
  InputVariant,
  InputSize,
  InputState,
  InputTheme,
  InputSizeConfig,
  InputStyleConfig
} from './Input.types';

/**
 * Input Theme Configurations
 * Maps each state to specific colors and styling
 */
const inputThemes: Record<InputState, InputTheme> = {
  default: {
    backgroundColor: tokens.colors.surface.input, // White background
    borderColor: tokens.colors.border.input, // Light gray border
    borderWidth: 1,
    textColor: tokens.colors.text.primary,
    placeholderColor: tokens.colors.text.placeholder,
    focusedBorderColor: tokens.colors.primary[500],
    errorBorderColor: tokens.colors.error[500],
    successBorderColor: tokens.colors.success[500],
    disabledBackgroundColor: tokens.colors.surface.disabled,
    disabledTextColor: tokens.colors.text.disabled,
  },

  focused: {
    backgroundColor: tokens.colors.surface.input,
    borderColor: tokens.colors.primary[500], // Primary color border when focused
    borderWidth: 2, // Thicker border for focus state
    textColor: tokens.colors.text.primary,
    placeholderColor: tokens.colors.text.placeholder,
    focusedBorderColor: tokens.colors.primary[500],
    errorBorderColor: tokens.colors.error[500],
    successBorderColor: tokens.colors.success[500],
    disabledBackgroundColor: tokens.colors.surface.disabled,
    disabledTextColor: tokens.colors.text.disabled,
  },

  error: {
    backgroundColor: tokens.colors.error[25], // Light error background
    borderColor: tokens.colors.error[500], // Error red border
    borderWidth: 1,
    textColor: tokens.colors.text.primary,
    placeholderColor: tokens.colors.text.placeholder,
    focusedBorderColor: tokens.colors.error[600], // Darker on focus
    errorBorderColor: tokens.colors.error[500],
    successBorderColor: tokens.colors.success[500],
    disabledBackgroundColor: tokens.colors.surface.disabled,
    disabledTextColor: tokens.colors.text.disabled,
  },

  success: {
    backgroundColor: tokens.colors.success[25], // Light success background
    borderColor: tokens.colors.success[500], // Success green border
    borderWidth: 1,
    textColor: tokens.colors.text.primary,
    placeholderColor: tokens.colors.text.placeholder,
    focusedBorderColor: tokens.colors.success[600], // Darker on focus
    errorBorderColor: tokens.colors.error[500],
    successBorderColor: tokens.colors.success[500],
    disabledBackgroundColor: tokens.colors.surface.disabled,
    disabledTextColor: tokens.colors.text.disabled,
  },

  disabled: {
    backgroundColor: tokens.colors.surface.disabled, // Gray background
    borderColor: tokens.colors.border.disabled, // Disabled border
    borderWidth: 1,
    textColor: tokens.colors.text.disabled, // Muted text
    placeholderColor: tokens.colors.text.disabled,
    focusedBorderColor: tokens.colors.border.disabled,
    errorBorderColor: tokens.colors.error[500],
    successBorderColor: tokens.colors.success[500],
    disabledBackgroundColor: tokens.colors.surface.disabled,
    disabledTextColor: tokens.colors.text.disabled,
  },
};

/**
 * Input Size Configurations
 * Maps each size to specific dimensions
 */
const inputSizes: Record<InputSize, InputSizeConfig> = {
  sm: {
    height: 36, // Compact input
    paddingHorizontal: tokens.spacing.sm, // 8px
    paddingVertical: tokens.spacing.xs, // 4px
    fontSize: tokens.typography.fontSize.sm, // 14px
    borderRadius: tokens.borderRadius.md, // 8px
  },

  md: {
    height: 44, // Standard mobile touch target
    paddingHorizontal: tokens.spacing.md, // 12px
    paddingVertical: tokens.spacing.sm, // 8px
    fontSize: tokens.typography.fontSize.md, // 16px
    borderRadius: tokens.borderRadius.md, // 8px
  },

  lg: {
    height: 52, // Large input for emphasis
    paddingHorizontal: tokens.spacing.lg, // 16px
    paddingVertical: tokens.spacing.md, // 12px
    fontSize: tokens.typography.fontSize.lg, // 18px
    borderRadius: tokens.borderRadius.lg, // 12px
  },
};

/**
 * Generate input container styles based on configuration
 */
export const getInputContainerStyle = (config: InputStyleConfig) => {
  const theme = inputThemes[config.state];
  const size = inputSizes[config.size];

  return {
    // Layout
    minHeight: config.multiline ? size.height * 2 : size.height,
    paddingHorizontal: size.paddingHorizontal,
    paddingVertical: size.paddingVertical,
    borderRadius: size.borderRadius,

    // Appearance
    backgroundColor: theme.backgroundColor,
    borderColor: config.focused ? theme.focusedBorderColor : theme.borderColor,
    borderWidth: config.focused ? 2 : theme.borderWidth,

    // Typography
    fontSize: size.fontSize,
    color: theme.textColor,

    // Multiline specific
    ...(config.multiline && {
      paddingTop: size.paddingVertical,
      textAlignVertical: 'top' as const,
    }),

    // Interactive states
    ...(config.state === 'disabled' && {
      opacity: 0.6,
    }),
  };
};

/**
 * Input Label Styles
 */
export const inputLabelStyles = StyleSheet.create({
  container: {
    marginBottom: tokens.spacing.xs, // 4px gap below label
  },

  label: {
    fontSize: tokens.typography.fontSize.sm, // 14px
    fontWeight: tokens.typography.fontWeight.medium, // 500
    color: tokens.colors.text.primary,
    lineHeight: tokens.typography.fontSize.sm * tokens.typography.lineHeight.tight,
  },

  required: {
    color: tokens.colors.error[500], // Red asterisk
    marginLeft: tokens.spacing.xs, // 2px space before asterisk
  },
});

/**
 * Input Helper Text Styles
 */
export const getInputHelperStyle = (state: InputState) => ({
  fontSize: tokens.typography.fontSize.xs, // 12px
  fontWeight: tokens.typography.fontWeight.normal, // 400
  color: state === 'error' ? tokens.colors.error[600]
    : state === 'success' ? tokens.colors.success[600]
    : tokens.colors.text.secondary,
  lineHeight: tokens.typography.fontSize.xs * tokens.typography.lineHeight.normal,
  marginTop: tokens.spacing.xs, // 4px gap above helper text
});

/**
 * Input Icon Styles
 */
export const inputIconStyles = StyleSheet.create({
  leftIcon: {
    position: 'absolute',
    left: tokens.spacing.sm, // 8px from left
    top: '50%',
    transform: [{ translateY: -12 }], // Center vertically (24px icon / 2)
    zIndex: 1,
  },

  rightIcon: {
    position: 'absolute',
    right: tokens.spacing.sm, // 8px from right
    top: '50%',
    transform: [{ translateY: -12 }], // Center vertically
    zIndex: 1,
  },

  searchIcon: {
    width: 20,
    height: 20,
    tintColor: tokens.colors.text.secondary,
  },

  clearButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.neutral[400],
    alignItems: 'center',
    justifyContent: 'center',
  },

  clearIcon: {
    width: 12,
    height: 12,
    tintColor: tokens.colors.surface.card, // White X
  },
});

/**
 * Search Input Specific Styles
 */
export const searchInputStyles = StyleSheet.create({
  container: {
    position: 'relative',
  },

  input: {
    paddingLeft: 36, // Space for search icon (20px icon + 16px padding)
    paddingRight: 36, // Space for clear button
  },

  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: tokens.colors.surface.card,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.input,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    maxHeight: 200,
    zIndex: 1000,
    ...tokens.shadows.sm,
  },

  suggestion: {
    padding: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border.input,
  },

  suggestionText: {
    fontSize: tokens.typography.fontSize.md,
    color: tokens.colors.text.primary,
  },

  suggestionLast: {
    borderBottomWidth: 0,
  },
});

/**
 * Number Input Specific Styles
 */
export const numberInputStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  input: {
    flex: 1,
    textAlign: 'center',
  },

  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: tokens.spacing.xs,
  },

  stepperButtonDisabled: {
    backgroundColor: tokens.colors.neutral[300],
  },

  stepperText: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.surface.card, // White text
  },

  unitLabel: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    marginLeft: tokens.spacing.sm,
  },
});

/**
 * Character Counter Styles
 */
export const characterCounterStyles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    marginTop: tokens.spacing.xs,
  },

  text: {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.secondary,
  },

  overLimit: {
    color: tokens.colors.error[500],
  },
});

/**
 * Static styles that don't depend on props
 */
export const staticStyles = StyleSheet.create({
  // Base input wrapper
  inputWrapper: {
    position: 'relative',
    width: '100%',
  },

  // Input field base styles
  inputBase: {
    fontFamily: tokens.typography.fontFamily.body,
    includeFontPadding: false, // Android: remove extra padding
    textAlignVertical: 'center',
  },

  // Multiline input styles
  multilineInput: {
    textAlignVertical: 'top',
    paddingTop: tokens.spacing.sm,
  },

  // Focus ring for accessibility
  focusRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: tokens.borderRadius.lg,
    borderWidth: 2,
    borderColor: tokens.colors.primary[300],
    opacity: 0.3,
  },
});

/**
 * Utility function to get complete input styles
 * Combines all style functions for easy consumption
 */
export const getInputStyles = (config: InputStyleConfig) => {
  return {
    container: [staticStyles.inputWrapper, getInputContainerStyle(config)],
    input: [
      staticStyles.inputBase,
      config.multiline && staticStyles.multilineInput,
    ],
    label: inputLabelStyles,
    helper: getInputHelperStyle(config.state),
    icon: inputIconStyles,
  };
};

/**
 * Export configurations for external access
 */
export { inputThemes, inputSizes };