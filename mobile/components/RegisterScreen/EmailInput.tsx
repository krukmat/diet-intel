/**
 * EmailInput Component
 * Componente para el campo de email en el formulario de registro
 */

import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { registerScreenStyles as styles } from '../styles/RegisterScreen.styles';

interface EmailInputProps {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Componente para el input de email con validación visual
 */
export const EmailInput: React.FC<EmailInputProps> = ({
  value,
  onChangeText,
  error,
  disabled = false
}) => {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholder="Enter your email"
        value={value}
        onChangeText={onChangeText}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!disabled}
      />
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};
