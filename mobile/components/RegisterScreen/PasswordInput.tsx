/**
 * PasswordInput Component
 * Componente para el campo de contraseña en el formulario de registro
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { registerScreenStyles as styles } from '../styles/RegisterScreen.styles';

interface PasswordInputProps {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Componente para el input de contraseña con toggle de visibilidad
 */
export const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChangeText,
  error,
  disabled = false,
  placeholder = 'Enter your password'
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>Password</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, error && styles.inputError]}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!isPasswordVisible}
          autoComplete="password-new"
          editable={!disabled}
        />
        <TouchableOpacity
          onPress={togglePasswordVisibility}
          style={styles.eyeButton}
          disabled={disabled}
        >
          <Text style={styles.eyeText}>
            {isPasswordVisible ? '👁️' : '👁️‍🗨️'}
          </Text>
        </TouchableOpacity>
      </View>
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      <Text style={styles.helperText}>
        Must be at least 8 characters with uppercase, lowercase, number, and special character
      </Text>
    </View>
  );
};
