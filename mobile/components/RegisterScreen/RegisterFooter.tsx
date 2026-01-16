/**
 * RegisterFooter Component
 * Componente para el footer del formulario de registro
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { registerScreenStyles as styles } from '../styles/RegisterScreen.styles';

interface RegisterFooterProps {
  onLoginPress?: () => void;
}

/**
 * Componente para el footer con enlace al login
 */
export const RegisterFooter: React.FC<RegisterFooterProps> = ({
  onLoginPress
}) => {
  return (
    <View style={styles.footer}>
      <View style={styles.loginSection}>
        <Text style={styles.loginText}>Already have an account?</Text>
        <TouchableOpacity onPress={onLoginPress}>
          <Text style={styles.loginLink}>Sign In</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.footerText}>
        By creating an account, you agree to our Terms of Service and Privacy Policy
      </Text>
    </View>
  );
};
