/**
 * RegisterButton Component
 * Componente para el botón de registro con estados de carga
 */

import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { registerScreenStyles as styles } from '../styles/RegisterScreen.styles';

interface RegisterButtonProps {
  onPress: () => void;
  loading: boolean;
  disabled?: boolean;
}

/**
 * Componente para el botón de registro con indicador de carga
 */
export const RegisterButton: React.FC<RegisterButtonProps> = ({
  onPress,
  loading,
  disabled = false
}) => {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.registerButton, isDisabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <Text style={styles.registerButtonText}>Create Account</Text>
      )}
    </TouchableOpacity>
  );
};
