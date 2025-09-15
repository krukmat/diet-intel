/**
 * InputNumber Component
 * Specialized numeric input with validation and stepper controls
 * Solves manual calorie input inconsistencies and lack of validation
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Input } from './Input';
import { InputNumberProps } from './Input.types';
import { numberInputStyles } from './Input.styles';
import { tokens } from '../../../styles/tokens';

/**
 * InputNumber Component
 * Numeric input with validation, formatting, and optional stepper controls
 */
export const InputNumber: React.FC<InputNumberProps> = ({
  min,
  max,
  step = 1,
  decimals = 0,
  showSteppers = false,
  onValueChange,
  unit,
  currency = false,
  thousandsSeparator = false,
  value,
  onChangeText,
  testID,
  state,
  ...inputProps
}) => {
  const [numericValue, setNumericValue] = useState<number>(0);
  const [displayValue, setDisplayValue] = useState<string>('');
  const [inputState, setInputState] = useState(state || 'default');

  // Initialize values
  useEffect(() => {
    if (value !== undefined) {
      const parsed = parseFloat(value) || 0;
      setNumericValue(parsed);
      setDisplayValue(formatNumber(parsed));
    }
  }, [value]);

  // Format number for display
  const formatNumber = (num: number): string => {
    let formatted = num.toFixed(decimals);

    // Add thousands separator if enabled
    if (thousandsSeparator) {
      const parts = formatted.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      formatted = parts.join('.');
    }

    // Add currency symbol if enabled
    if (currency) {
      formatted = `$${formatted}`;
    }

    return formatted;
  };

  // Parse number from display string
  const parseNumber = (text: string): number => {
    // Remove currency symbol and thousands separators
    let cleaned = text.replace(/[$,]/g, '');

    // Parse as float
    const parsed = parseFloat(cleaned);

    return isNaN(parsed) ? 0 : parsed;
  };

  // Validate number against constraints
  const validateNumber = (num: number): { isValid: boolean; message?: string } => {
    if (min !== undefined && num < min) {
      return { isValid: false, message: `Minimum value is ${min}` };
    }

    if (max !== undefined && num > max) {
      return { isValid: false, message: `Maximum value is ${max}` };
    }

    return { isValid: true };
  };

  // Handle text change
  const handleChangeText = (text: string) => {
    setDisplayValue(text);
    onChangeText?.(text);

    const parsed = parseNumber(text);
    const validation = validateNumber(parsed);

    setNumericValue(parsed);
    setInputState(validation.isValid ? 'default' : 'error');

    if (validation.isValid) {
      onValueChange?.(parsed);
    }
  };

  // Handle stepper increment
  const handleIncrement = () => {
    const newValue = numericValue + step;
    const validation = validateNumber(newValue);

    if (validation.isValid) {
      setNumericValue(newValue);
      const formatted = formatNumber(newValue);
      setDisplayValue(formatted);
      onChangeText?.(formatted);
      onValueChange?.(newValue);
      setInputState('default');
    }
  };

  // Handle stepper decrement
  const handleDecrement = () => {
    const newValue = numericValue - step;
    const validation = validateNumber(newValue);

    if (validation.isValid) {
      setNumericValue(newValue);
      const formatted = formatNumber(newValue);
      setDisplayValue(formatted);
      onChangeText?.(formatted);
      onValueChange?.(newValue);
      setInputState('default');
    }
  };

  // Handle blur formatting
  const handleBlur = () => {
    // Format the number properly on blur
    const formatted = formatNumber(numericValue);
    setDisplayValue(formatted);
    onChangeText?.(formatted);
  };

  // Determine if steppers should be disabled
  const canDecrement = min === undefined || numericValue > min;
  const canIncrement = max === undefined || numericValue < max;

  if (showSteppers) {
    return (
      <View style={numberInputStyles.container}>
        {/* Decrement Button */}
        <TouchableOpacity
          style={[
            numberInputStyles.stepperButton,
            !canDecrement && numberInputStyles.stepperButtonDisabled
          ]}
          onPress={handleDecrement}
          disabled={!canDecrement}
          testID={testID ? `${testID}-decrement` : 'number-input-decrement'}
        >
          <Text style={numberInputStyles.stepperText}>−</Text>
        </TouchableOpacity>

        {/* Input Field */}
        <Input
          variant="number"
          value={displayValue}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          keyboardType="numeric"
          textAlign="center"
          state={inputState}
          testID={testID}
          {...inputProps}
        />

        {/* Increment Button */}
        <TouchableOpacity
          style={[
            numberInputStyles.stepperButton,
            !canIncrement && numberInputStyles.stepperButtonDisabled
          ]}
          onPress={handleIncrement}
          disabled={!canIncrement}
          testID={testID ? `${testID}-increment` : 'number-input-increment'}
        >
          <Text style={numberInputStyles.stepperText}>+</Text>
        </TouchableOpacity>

        {/* Unit Label */}
        {unit && (
          <Text style={numberInputStyles.unitLabel}>{unit}</Text>
        )}
      </View>
    );
  }

  // Regular number input without steppers
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Input
        variant="number"
        value={displayValue}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        keyboardType="numeric"
        state={inputState}
        testID={testID}
        {...inputProps}
      />

      {/* Unit Label */}
      {unit && (
        <Text style={numberInputStyles.unitLabel}>{unit}</Text>
      )}
    </View>
  );
};

// Export types
export type { InputNumberProps } from './Input.types';