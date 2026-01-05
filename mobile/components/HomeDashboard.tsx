import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { HomePrimaryActions, HomeSecondaryActions, HomeToolActions, HomeProgressCard } from '../shared/ui/components';
import { LanguageToggle } from './LanguageSwitcher';

interface HomeDashboardProps {
  title: string;
  subtitle: string;
  version: string;
  toolActions: Array<{ id: string; label: string; onPress: () => void }>;
  primaryActions: Array<{ id: string; label: string; onPress: () => void }>;
  secondaryActions: Array<{ id: string; label: string; onPress: () => void }>;
  progressTitle: string;
  progressDescription: string;
  showDeveloperSettings: boolean;
  showNotifications: boolean;
  onLogout: () => void;
  onShowDeveloperSettings: () => void;
  onShowNotifications: () => void;
  onShowLanguageSwitcher: () => void;
}

export default function HomeDashboard({
  title,
  subtitle,
  version,
  toolActions,
  primaryActions,
  secondaryActions,
  progressTitle,
  progressDescription,
  showDeveloperSettings,
  showNotifications,
  onLogout,
  onShowDeveloperSettings,
  onShowNotifications,
  onShowLanguageSwitcher,
}: HomeDashboardProps) {
  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerButtons}>
          <HomeToolActions actions={toolActions} />
          <LanguageToggle onPress={onShowLanguageSwitcher} />
          <TouchableOpacity style={styles.headerActionButton} onPress={onLogout}>
            <Text style={styles.headerActionButtonText}>🚪</Text>
          </TouchableOpacity>
          {showDeveloperSettings && (
            <TouchableOpacity style={styles.headerActionButton} onPress={onShowDeveloperSettings}>
              <Text style={styles.headerActionButtonText}>⚙️</Text>
            </TouchableOpacity>
          )}
          {showNotifications && (
            <TouchableOpacity style={styles.headerActionButton} onPress={onShowNotifications}>
              <Text style={styles.headerActionButtonText}>🔔</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.version}>{version}</Text>
        </View>
      </View>

      <View style={styles.navigationSection}>
        <HomeProgressCard title={progressTitle} description={progressDescription} />
        <HomePrimaryActions title=" " actions={primaryActions} />
        <HomeSecondaryActions title=" " actions={secondaryActions} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 34 : 26,
    paddingBottom: 18,
    gap: 8,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  headerActionButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 36,
    height: 36,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionButtonText: {
    color: 'white',
    fontSize: 16,
  },
  title: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  version: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  navigationSection: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'column',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
});
