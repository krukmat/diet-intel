import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { HomePrimaryActions, HomeToolActions } from '../shared/ui/components';
import { LanguageToggle } from './LanguageSwitcher';

interface ActionItem {
  id: string;
  label: string;
  icon?: string;
  onPress: () => void;
}

interface HomeDashboardProps {
  title: string;
  subtitle: string;
  version: string;
  heroDailyCalories?: number | null;
  heroPlannedCalories?: number | null;
  heroConsumedCalories?: number | null;
  heroPlanActive?: boolean | null;
  toolActions: ActionItem[];
  primaryActions: ActionItem[];
  secondaryActions: ActionItem[];
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
  heroDailyCalories,
  heroPlannedCalories,
  heroConsumedCalories,
  heroPlanActive,
  toolActions,
  primaryActions,
  secondaryActions,
  showDeveloperSettings,
  showNotifications,
  onLogout,
  onShowDeveloperSettings,
  onShowNotifications,
  onShowLanguageSwitcher,
}: HomeDashboardProps) {
  const { t } = useTranslation();
  const caloriesText =
    heroDailyCalories !== null && heroDailyCalories !== undefined
      ? `${Math.round(heroDailyCalories)} kcal`
      : t('home.hero.noCalories');
  const plannedCaloriesText =
    heroPlannedCalories !== null && heroPlannedCalories !== undefined
      ? t('home.hero.planCalories', { calories: Math.round(heroPlannedCalories) })
      : null;
  const progressText =
    heroConsumedCalories !== null && heroConsumedCalories !== undefined
      ? `${Math.round(heroConsumedCalories)}`
      : null;
  const todayText =
    progressText && heroDailyCalories !== null && heroDailyCalories !== undefined
      ? `${progressText} / ${Math.round(heroDailyCalories)} kcal`
      : progressText
        ? `${progressText} kcal`
        : t('home.hero.noProgress');
  const planText =
    heroPlanActive === true
      ? t('home.hero.planActive')
      : heroPlanActive === false
        ? t('home.hero.planInactive')
        : t('home.hero.planUnknown');

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
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroSubtitle}>{subtitle}</Text>
            <Text style={styles.heroVersion}>{version}</Text>
          </View>
          <View style={styles.heroMetrics}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{t('home.hero.dailyCalories')}</Text>
              <Text style={styles.heroStatValue}>{caloriesText}</Text>
              {plannedCaloriesText && (
                <Text style={styles.heroStatSubValue}>{plannedCaloriesText}</Text>
              )}
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{t('home.hero.todayProgress')}</Text>
              <Text style={styles.heroStatValue}>{todayText}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{t('home.hero.planStatus')}</Text>
              <Text style={styles.heroStatValue}>{planText}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.navigationSection}>
        <HomePrimaryActions title=" " actions={primaryActions} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#070C1A',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 34 : 26,
    paddingBottom: 24,
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
  hero: {
    marginTop: 16,
    borderRadius: 24,
    backgroundColor: '#0b1f3a',
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 100,
    backgroundColor: 'rgba(59, 130, 246, 0.35)',
    top: -40,
    right: -20,
  },
  heroContent: {
    marginBottom: 16,
  },
  heroTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: '#E0E7FF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  heroVersion: {
    color: '#93C5FD',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStat: {
    flex: 1,
    minWidth: 0,
  },
  heroStatLabel: {
    color: '#A5B4FC',
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroStatValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  heroStatSubValue: {
    color: '#C7D2FE',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  navigationSection: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'column',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
});
