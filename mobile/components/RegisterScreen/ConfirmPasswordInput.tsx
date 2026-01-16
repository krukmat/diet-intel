/**
 * ConfirmPasswordInput Component
 * Componente para el campo de confirmación de contraseña
 */

import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { registerScreenStyles as styles } from '../styles/RegisterScreen.styles';

interface ConfirmPasswordInputProps {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Componente para el input de confirmación de contraseña
 */
export const ConfirmPasswordInput: React.FC<ConfirmPasswordInputProps> = ({
  value,
  onChangeText,
  error,
  disabled = false
}) => {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>Confirm Password</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholder="Re-enter your password"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={true}
        autoComplete="password"
        editable={!disabled}
      />
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};
