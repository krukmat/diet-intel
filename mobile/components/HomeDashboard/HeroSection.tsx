/**
 * HeroSection Component
 * Componente de presentación para la sección hero del HomeDashboard
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { homeDashboardStyles as styles } from '../styles/HomeDashboard.styles';

export interface HeroSectionProps {
  title: string;
  subtitle: string;
  version: string;
  caloriesText: string;
  plannedCaloriesText: string | null;
  progressText: string;
  planText: string;
}

/**
 * Componente de presentación para la sección hero del dashboard
 * Maneja solo la presentación, no la lógica de datos
 */
export const HeroSection: React.FC<HeroSectionProps> = ({
  title,
  subtitle,
  version,
  caloriesText,
  plannedCaloriesText,
  progressText,
  planText,
}) => {
  const { t } = useTranslation();

  return (
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
          <Text style={styles.heroStatValue}>{progressText}</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatLabel}>{t('home.hero.planStatus')}</Text>
          <Text style={styles.heroStatValue}>{planText}</Text>
        </View>
      </View>
    </View>
  );
};
