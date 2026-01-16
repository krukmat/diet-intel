/**
 * HeaderSection Component
 * Componente de presentación para la sección de encabezado del HomeDashboard
 */

import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { HomeToolActions } from '../../shared/ui/components';
import { LanguageToggle } from '../LanguageSwitcher';
import { homeDashboardStyles as styles } from '../styles/HomeDashboard.styles';

export interface HeaderSectionProps {
  toolActions: Array<{
    id: string;
    label: string;
    onPress: () => void;
  }>;
  onLogout: () => void;
  onShowDeveloperSettings?: () => void;
  onShowNotifications?: () => void;
  onShowLanguageSwitcher: () => void;
  showDeveloperSettings?: boolean;
  showNotifications?: boolean;
}

/**
 * Componente de presentación para la sección de encabezado
 * Maneja los botones de acción y navegación del header
 */
export const HeaderSection: React.FC<HeaderSectionProps> = ({
  toolActions,
  onLogout,
  onShowDeveloperSettings,
  onShowNotifications,
  onShowLanguageSwitcher,
  showDeveloperSettings = false,
  showNotifications = false,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.headerButtons}>
        <HomeToolActions actions={toolActions} />
        <LanguageToggle onPress={onShowLanguageSwitcher} />
        <TouchableOpacity style={styles.headerActionButton} onPress={onLogout}>
          <Text style={styles.headerActionButtonText}>🚪</Text>
        </TouchableOpacity>
        {showDeveloperSettings && onShowDeveloperSettings && (
          <TouchableOpacity style={styles.headerActionButton} onPress={onShowDeveloperSettings}>
            <Text style={styles.headerActionButtonText}>⚙️</Text>
          </TouchableOpacity>
        )}
        {showNotifications && onShowNotifications && (
          <TouchableOpacity style={styles.headerActionButton} onPress={onShowNotifications}>
            <Text style={styles.headerActionButtonText}>🔔</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
