/**
 * RegisterHeader Component
 * Componente para el header del formulario de registro
 */

import React from 'react';
import { View, Text } from 'react-native';
import { registerScreenStyles as styles } from '../styles/RegisterScreen.styles';

interface RegisterHeaderProps {
  title?: string;
  subtitle?: string;
}

/**
 * Componente del header para la pantalla de registro
 */
export const RegisterHeader: React.FC<RegisterHeaderProps> = ({
  title = '🍎 DietIntel',
  subtitle = 'Create your account'
}) => {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
};
