import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { HomePrimaryActions, HomeToolActions } from '../shared/ui/components';
import { LanguageToggle } from './LanguageSwitcher';
import { homeDashboardStyles as styles } from './styles/HomeDashboard.styles';

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
