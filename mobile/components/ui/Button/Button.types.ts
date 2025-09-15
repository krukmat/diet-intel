/**
 * Button Component Type Definitions
 * TypeScript interfaces for the DietIntel Button system
 */

import { ReactNode } from 'react';
import { TouchableOpacityProps, ViewStyle, TextStyle } from 'react-native';

/**
 * Button Variant Types
 * Maps to current UI button hierarchy to solve inconsistency
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

/**
 * Button Size Options
 * Standardized sizing for different contexts
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Button Width Behavior
 * Control how button expands within container
 */
export type ButtonWidth = 'auto' | 'full';

/**
 * Main Button Component Props
 * Comprehensive interface for all button functionality
 */
export interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  /**
   * Visual variant of button
   * - primary: Main action buttons (e.g., "Escaner de Código")
   * - secondary: Secondary actions (e.g., "Subir Etiqueta")
   * - tertiary: Minimal styling (e.g., text-only actions)
   * - destructive: Dangerous actions (e.g., "Restablecer")
   * @default 'primary'
   */
  variant?: ButtonVariant;

  /**
   * Button size affecting padding and font size
   * - sm: Compact buttons for limited space
   * - md: Standard button size (44pt touch target)
   * - lg: Large buttons for primary actions
   * @default 'md'
   */
  size?: ButtonSize;

  /**
   * Button width behavior
   * - auto: Width based on content
   * - full: Expand to fill container width
   * @default 'auto'
   */
  width?: ButtonWidth;

  /**
   * Disabled state
   * Reduces opacity and prevents interaction
   * @default false
   */
  disabled?: boolean;

  /**
   * Loading state
   * Shows spinner and prevents interaction
   * @default false
   */
  loading?: boolean;

  /**
   * Icon on left side of text
   * React Native compatible icon component
   */
  leftIcon?: ReactNode;

  /**
   * Icon on right side of text
   * React Native compatible icon component
   */
  rightIcon?: ReactNode;

  /**
   * Button text content
   * Required for accessibility and button functionality
   */
  children: ReactNode;

  /**
   * Press handler
   * Called when button is successfully pressed
   */
  onPress: () => void;

  /**
   * Test identifier for automated testing
   * Useful for E2E testing and component testing
   */
  testID?: string;

  /**
   * Custom style override
   * Should be used sparingly to maintain design consistency
   */
  style?: ViewStyle;

  /**
   * Custom text style override
   * Should be used sparingly to maintain typography consistency
   */
  textStyle?: TextStyle;

  /**
   * Accessibility label
   * Used by screen readers when different from children
   */
  accessibilityLabel?: string;

  /**
   * Accessibility hint
   * Provides additional context for screen readers
   */
  accessibilityHint?: string;
}

/**
 * Button Style Configuration
 * Internal interface for style generation based on props
 */
export interface ButtonStyleConfig {
  variant: ButtonVariant;
  size: ButtonSize;
  width: ButtonWidth;
  disabled: boolean;
  loading: boolean;
  pressed: boolean;
}

/**
 * Button Theme Configuration
 * Defines colors and styles for each variant
 */
export interface ButtonTheme {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  pressedBackgroundColor: string;
  pressedTextColor: string;
  disabledBackgroundColor: string;
  disabledTextColor: string;
  disabledBorderColor: string;
}

/**
 * Button Size Configuration
 * Defines sizing properties for each size variant
 */
export interface ButtonSizeConfig {
  paddingHorizontal: number;
  paddingVertical: number;
  fontSize: number;
  iconSize: number;
  minHeight: number;
  borderRadius: number;
}

/**
 * Loading Spinner Props
 * Configuration for loading state spinner
 */
export interface LoadingSpinnerProps {
  size: 'small' | 'large';
  color: string;
  testID?: string;
}