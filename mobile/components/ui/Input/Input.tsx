/**
 * Input Component
 * Unified input system solving current input inconsistencies
 *
 * Replaces chaotic input styles with systematic approach:
 * - Manual calorie input: Now uses systematic styling and validation
 * - Search fields: Unified search variant with clear functionality
 * - Form inputs: Consistent validation states and accessibility
 * - All inputs: Token-based styling and mobile optimization
 */

import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Animated,
  KeyboardTypeOptions,
} from 'react-native';
import { InputProps, InputStyleConfig } from './Input.types';
import { getInputStyles, characterCounterStyles } from './Input.styles';
import { tokens } from '../../../styles/tokens';

/**
 * Input Component Reference Interface
 */
export interface InputRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
}

/**
 * Main Input Component
 * Flexible input field with consistent styling and validation
 */
export const Input = forwardRef<InputRef, InputProps>(({
  variant = 'default',
  size = 'md',
  state = 'default',
  label,
  helperText,
  errorText,
  successText,
  leftIcon,
  rightIcon,
  showClear = false,
  onClear,
  containerStyle,
  inputStyle,
  labelStyle,
  helperTextStyle,
  testID,
  required = false,
  maxLength,
  showCounter = false,
  value,
  onChangeText,
  onFocus,
  onBlur,
  multiline = false,
  editable = true,
  ...textInputProps
}, ref) => {
  // State management
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');

  // Animation setup
  const labelAnimation = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderAnimation = useRef(new Animated.Value(0)).current;

  // Input reference
  const inputRef = useRef<TextInput>(null);

  // Expose ref methods
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
    clear: () => {
      setInputValue('');
      onChangeText?.('');
      onClear?.();
    },
    getValue: () => inputValue,
    setValue: (newValue: string) => {
      setInputValue(newValue);
      onChangeText?.(newValue);
    },
  }));

  // Determine actual state
  const actualState = !editable ? 'disabled' : state;

  // Style configuration
  const styleConfig: InputStyleConfig = {
    variant,
    size,
    state: actualState,
    focused: isFocused,
    hasValue: Boolean(inputValue),
    multiline: multiline || variant === 'multiline',
  };

  // Generate styles
  const styles = getInputStyles(styleConfig);

  // Handle focus
  const handleFocus = (e: any) => {
    setIsFocused(true);

    // Animate label and border
    Animated.parallel([
      Animated.timing(labelAnimation, {
        toValue: 1,
        duration: tokens.animation.duration.fast,
        useNativeDriver: false,
      }),
      Animated.timing(borderAnimation, {
        toValue: 1,
        duration: tokens.animation.duration.fast,
        useNativeDriver: false,
      }),
    ]).start();

    onFocus?.(e);
  };

  // Handle blur
  const handleBlur = (e: any) => {
    setIsFocused(false);

    // Animate label back if no value
    if (!inputValue) {
      Animated.timing(labelAnimation, {
        toValue: 0,
        duration: tokens.animation.duration.fast,
        useNativeDriver: false,
      }).start();
    }

    Animated.timing(borderAnimation, {
      toValue: 0,
      duration: tokens.animation.duration.fast,
      useNativeDriver: false,
    }).start();

    onBlur?.(e);
  };

  // Handle text change
  const handleChangeText = (text: string) => {
    setInputValue(text);
    onChangeText?.(text);

    // Animate label based on value
    Animated.timing(labelAnimation, {
      toValue: text || isFocused ? 1 : 0,
      duration: tokens.animation.duration.fast,
      useNativeDriver: false,
    }).start();
  };

  // Get keyboard type
  const getKeyboardType = (): KeyboardTypeOptions => {
    if (variant === 'number') return 'numeric';
    if (variant === 'search') return 'web-search';
    return textInputProps.keyboardType || 'default';
  };

  // Get return key type
  const getReturnKeyType = () => {
    if (variant === 'search') return 'search';
    if (multiline) return 'default';
    return 'done';
  };

  // Calculate padding adjustments for icons
  const paddingLeft = leftIcon ? 36 : undefined;
  const paddingRight = (rightIcon || (showClear && inputValue)) ? 36 : undefined;

  // Determine helper text to show
  const displayHelperText = state === 'error' ? errorText
    : state === 'success' ? successText
    : helperText;

  // Character count
  const characterCount = inputValue.length;
  const isOverLimit = maxLength ? characterCount > maxLength : false;

  return (
    <View style={[containerStyle]} testID={testID}>
      {/* Label */}
      {label && (
        <View style={styles.label.container}>
          <Text style={[styles.label.label, labelStyle]}>
            {label}
            {required && <Text style={styles.label.required}> *</Text>}
          </Text>
        </View>
      )}

      {/* Input Container */}
      <View style={[styles.container]}>
        {/* Left Icon */}
        {leftIcon && (
          <View style={styles.icon.leftIcon}>
            {leftIcon}
          </View>
        )}

        {/* Text Input */}
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            { paddingLeft, paddingRight },
            inputStyle,
          ]}
          value={inputValue}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={textInputProps.placeholder}
          placeholderTextColor={tokens.colors.text.placeholder}
          keyboardType={getKeyboardType()}
          returnKeyType={getReturnKeyType()}
          multiline={multiline || variant === 'multiline'}
          editable={editable}
          maxLength={maxLength}
          autoCapitalize={variant === 'search' ? 'none' : textInputProps.autoCapitalize}
          autoCorrect={variant === 'search' ? false : textInputProps.autoCorrect}
          testID={testID ? `${testID}-input` : 'input-field'}
          {...textInputProps}
        />

        {/* Right Icon or Clear Button */}
        {(rightIcon || (showClear && inputValue)) && (
          <View style={styles.icon.rightIcon}>
            {showClear && inputValue ? (
              <TouchableOpacity
                onPress={() => {
                  setInputValue('');
                  onChangeText?.('');
                  onClear?.();
                }}
                style={styles.icon.clearButton}
                testID={testID ? `${testID}-clear` : 'input-clear'}
              >
                <Text style={styles.icon.clearIcon}>×</Text>
              </TouchableOpacity>
            ) : (
              rightIcon
            )}
          </View>
        )}
      </View>

      {/* Helper Text or Character Counter */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Helper Text */}
        {displayHelperText && (
          <Text
            style={[styles.helper, helperTextStyle]}
            testID={testID ? `${testID}-helper` : 'input-helper'}
          >
            {displayHelperText}
          </Text>
        )}

        {/* Character Counter */}
        {showCounter && maxLength && (
          <View style={characterCounterStyles.container}>
            <Text
              style={[
                characterCounterStyles.text,
                isOverLimit && characterCounterStyles.overLimit
              ]}
              testID={testID ? `${testID}-counter` : 'input-counter'}
            >
              {characterCount}/{maxLength}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

// Display name for debugging
Input.displayName = 'Input';

// Export types for external usage
export type { InputProps, InputRef } from './Input.types';