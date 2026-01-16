/**
 * NavigationSection Component
 * Componente de presentación para la sección de navegación del HomeDashboard
 */

import React from 'react';
import { View } from 'react-native';
import { HomePrimaryActions } from '../../shared/ui/components';
import { homeDashboardStyles as styles } from '../styles/HomeDashboard.styles';

export interface NavigationSectionProps {
  primaryActions: Array<{
    id: string;
    label: string;
    subtitle?: string;
    icon?: string;
    onPress: () => void;
  }>;
}

/**
 * Componente de presentación para la sección de navegación
 * Maneja las acciones primarias del dashboard
 */
export const NavigationSection: React.FC<NavigationSectionProps> = ({
  primaryActions,
}) => {
  return (
    <View style={styles.navigationSection}>
      <HomePrimaryActions title=" " actions={primaryActions} />
    </View>
  );
};
