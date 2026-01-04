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
        <View style={styles.headerContent}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.version}>{version}</Text>
        </View>
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
    paddingVertical: 30,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 40 : 30,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginLeft: 20,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  headerActionButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionButtonText: {
    color: 'white',
    fontSize: 18,
  },
  title: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  version: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontStyle: 'italic',
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
