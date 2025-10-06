import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { DeveloperConfig, FeatureToggle } from '../services/DeveloperSettings';

interface AppHeaderProps {
  onLogout: () => void;
  onLanguageToggle: () => void;
  onDeveloperSettings: () => void;
  onRemindersToggle: () => void;
  developerConfig: DeveloperConfig | null;
  featureToggles: Partial<FeatureToggle> | null;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  onLogout,
  onLanguageToggle,
  onDeveloperSettings,
  onRemindersToggle,
  developerConfig,
  featureToggles,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const showDeveloperSettings = user?.is_developer || developerConfig?.isDeveloperModeEnabled;
  const showReminderButton = featureToggles?.reminderNotifications;

  return (
    <View style={styles.header} testID="header-container">
      <View style={styles.headerContent}>
        <Text style={styles.title}>{t('app.title')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.welcome', { name: user?.full_name || 'User' })}
        </Text>
        <Text style={styles.version}>{t('app.version')}</Text>
      </View>
      <View style={styles.headerButtons}>
        <TouchableOpacity
          style={styles.headerActionButton}
          onPress={onLanguageToggle}
          testID="language-toggle"
          accessibilityRole="button"
          accessibilityLabel={t('navigation.language')}
        >
          <Text style={styles.headerActionButtonText}>🌐</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerActionButton}
          onPress={onLogout}
          testID="logout-button"
          accessibilityRole="button"
          accessibilityLabel={t('auth.logout')}
        >
          <Text style={styles.headerActionButtonText}>{t('auth.logout')}</Text>
        </TouchableOpacity>
        {showDeveloperSettings && (
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={onDeveloperSettings}
            testID="developer-settings-button"
            accessibilityRole="button"
            accessibilityLabel={t('developer.settings')}
          >
            <Text style={styles.headerActionButtonText}>{t('developer.settings')}</Text>
          </TouchableOpacity>
        )}
        {showReminderButton && (
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={onRemindersToggle}
            testID="notifications-button"
            accessibilityRole="button"
            accessibilityLabel={t('developer.notifications')}
          >
            <Text style={styles.headerActionButtonText}>{t('developer.notifications')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

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
});

export default AppHeader;
