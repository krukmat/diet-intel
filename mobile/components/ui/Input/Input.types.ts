/**
 * Input Component Type Definitions
 * TypeScript interfaces for the DietIntel Input system
 *
 * Solves current input inconsistencies:
 * - Manual calorie input: Basic TextInput with no styling
 * - Search fields: Different styling across screens
 * - Form inputs: No validation or error states
 * - No unified accessibility features
 */

import { ReactNode } from 'react';
import { TextInputProps, ViewStyle, TextStyle, KeyboardTypeOptions } from 'react-native';

/**
 * Input Variant Types
 * Maps to current UI input patterns to solve inconsistencies
 */
export type InputVariant = 'default' | 'search' | 'number' | 'multiline';

/**
 * Input Size Options
 * Standardized input field heights
 */
export type InputSize = 'sm' | 'md' | 'lg';

/**
 * Input State Types
 * Visual feedback for user interactions
 */
export type InputState = 'default' | 'focused' | 'error' | 'success' | 'disabled';

/**
 * Main Input Component Props
 * Core input field with consistent styling
 */
export interface InputProps extends Omit<TextInputProps, 'style'> {
  /**
   * Visual variant of input
   * - default: Standard text input for forms
   * - search: With search icon and clear functionality
   * - number: Numeric input with validation
   * - multiline: Textarea equivalent for longer text
   * @default 'default'
   */
  variant?: InputVariant;

  /**
   * Input field size
   * - sm: Compact inputs (36px height)
   * - md: Standard inputs (44px height)
   * - lg: Large inputs (52px height)
   * @default 'md'
   */
  size?: InputSize;

  /**
   * Current input state for visual feedback
   * - default: Normal state
   * - focused: Active input state
   * - error: Validation error state
   * - success: Validation success state
   * - disabled: Non-interactive state
   * @default 'default'
   */
  state?: InputState;

  /**
   * Input label text
   * Positioned above the input field
   */
  label?: string;

  /**
   * Helper text below input
   * Instructions or additional context
   */
  helperText?: string;

  /**
   * Error message text
   * Displayed when state is 'error'
   */
  errorText?: string;

  /**
   * Success message text
   * Displayed when state is 'success'
   */
  successText?: string;

  /**
   * Left icon element
   * Icon positioned on the left side of input
   */
  leftIcon?: ReactNode;

  /**
   * Right icon element
   * Icon positioned on the right side of input
   */
  rightIcon?: ReactNode;

  /**
   * Show clear button
   * Only applies to search variant
   * @default true for search variant
   */
  showClear?: boolean;

  /**
   * Clear button press handler
   * Called when clear button is pressed
   */
  onClear?: () => void;

  /**
   * Container style override
   * Style the entire input container
   */
  containerStyle?: ViewStyle;

  /**
   * Input style override
   * Style the text input itself
   */
  inputStyle?: TextStyle;

  /**
   * Label style override
   */
  labelStyle?: TextStyle;

  /**
   * Helper text style override
   */
  helperTextStyle?: TextStyle;

  /**
   * Test identifier
   */
  testID?: string;

  /**
   * Required field indicator
   * Shows asterisk next to label
   */
  required?: boolean;

  /**
   * Maximum character count
   * Shows character counter when specified
   */
  maxLength?: number;

  /**
   * Show character counter
   * Displays current/max characters
   */
  showCounter?: boolean;
}

/**
 * Input Search Specific Props
 * Search input with specialized functionality
 */
export interface InputSearchProps extends Omit<InputProps, 'variant' | 'leftIcon'> {
  /**
   * Search placeholder text
   * @default 'Search...'
   */
  placeholder?: string;

  /**
   * Search submission handler
   * Called when search is submitted
   */
  onSearch?: (query: string) => void;

  /**
   * Show search suggestions
   * Enable autocomplete functionality
   */
  showSuggestions?: boolean;

  /**
   * Search suggestions list
   * Array of suggestion strings
   */
  suggestions?: string[];

  /**
   * Suggestion selection handler
   */
  onSuggestionSelect?: (suggestion: string) => void;
}

/**
 * Input Number Specific Props
 * Numeric input with validation
 */
export interface InputNumberProps extends Omit<InputProps, 'variant' | 'keyboardType'> {
  /**
   * Minimum allowed value
   */
  min?: number;

  /**
   * Maximum allowed value
   */
  max?: number;

  /**
   * Step increment for +/- buttons
   * @default 1
   */
  step?: number;

  /**
   * Number of decimal places
   * @default 0
   */
  decimals?: number;

  /**
   * Show increment/decrement buttons
   * @default false
   */
  showSteppers?: boolean;

  /**
   * Value change handler
   * Called when numeric value changes
   */
  onValueChange?: (value: number) => void;

  /**
   * Unit label (e.g., 'kcal', 'g', 'ml')
   * Displayed after the input
   */
  unit?: string;

  /**
   * Currency formatting
   * Format as currency if true
   */
  currency?: boolean;

  /**
   * Thousands separator
   * Show commas for large numbers
   */
  thousandsSeparator?: boolean;
}

/**
 * Internal Types for Styling System
 */

export interface InputTheme {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  placeholderColor: string;
  focusedBorderColor: string;
  errorBorderColor: string;
  successBorderColor: string;
  disabledBackgroundColor: string;
  disabledTextColor: string;
}

export interface InputSizeConfig {
  height: number;
  paddingHorizontal: number;
  paddingVertical: number;
  fontSize: number;
  borderRadius: number;
}

export interface InputStyleConfig {
  variant: InputVariant;
  size: InputSize;
  state: InputState;
  focused: boolean;
  hasValue: boolean;
  multiline: boolean;
}

/**
 * Validation Types
 */
export type ValidationRule = {
  validator: (value: string) => boolean;
  message: string;
};

export interface InputValidationProps {
  /**
   * Validation rules array
   * Array of validation functions and error messages
   */
  validationRules?: ValidationRule[];

  /**
   * Validate on blur
   * Run validation when input loses focus
   * @default true
   */
  validateOnBlur?: boolean;

  /**
   * Validate on change
   * Run validation on every character change
   * @default false
   */
  validateOnChange?: boolean;

  /**
   * Custom validation function
   * Override built-in validation
   */
  customValidator?: (value: string) => { isValid: boolean; message?: string };
}