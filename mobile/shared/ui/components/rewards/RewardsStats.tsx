/**
 * Rewards Stats Component for DietIntel Mobile App
 * Professional statistics component for rewards screen with progress tracking
 */

import React from 'react';
import { View, Text } from 'react-native';
import { RewardsScreenData } from '../../../types/rewards';

// Professional styling system - Modular approach
import { statsStyles as styles } from '../../styles/stats.styles';

interface RewardsStatsProps {
  data: RewardsScreenData;
  backgroundColor?: string;
  testID?: string;
}

/**
 * Individual stat card component
 */
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  backgroundColor?: string;
  testID?: string;
}> = ({ title, value, subtitle, icon, backgroundColor, testID }) => (
  <View style={[styles.statCard, { backgroundColor }]} testID={testID}>
    <View style={styles.statHeader}>
      {icon && <Text style={styles.statIcon}>{icon}</Text>}
      <Text style={styles.statTitle}>{title}</Text>
    </View>
    <Text style={styles.statValue}>{value}</Text>
    {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
  </View>
);

/**
 * Progress bar component
 */
const ProgressBar: React.FC<{
  progress: number;
  total: number;
  label: string;
  backgroundColor?: string;
  testID?: string;
}> = ({ progress, total, label, backgroundColor, testID }) => {
  const percentage = Math.round((progress / total) * 100);
  
  return (
    <View style={[styles.progressSection, { backgroundColor }]} testID={testID}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>{label}</Text>
        <Text style={styles.progressText}>{progress}/{total}</Text>
      </View>
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill, 
            { width: `${percentage}%` }
          ]} 
        />
      </View>
      <Text style={styles.progressPercentage}>{percentage}% completado</Text>
    </View>
  );
};

/**
 * Main Rewards Stats component
 */
export const RewardsStats: React.FC<RewardsStatsProps> = ({
  data,
  backgroundColor = '#FFFFFF',
  testID = 'rewards-stats'
}) => {
  return (
    <View style={[styles.container, { backgroundColor }]} testID={testID}>
      {/* Primary Stats Row */}
      <View style={styles.primaryStatsRow}>
        <StatCard
          title="Puntos Totales"
          value={data.totalPoints}
          icon="🏆"
          backgroundColor="#f8f9fa"
          testID="rewards-stat-total-points"
        />
        <StatCard
          title="Nivel Actual"
          value={data.currentLevel}
          subtitle={`${data.levelProgress}%`}
          icon="📊"
          backgroundColor="#f8f9fa"
          testID="rewards-stat-current-level"
        />
      </View>

      {/* Level Progress */}
      <ProgressBar
        progress={data.totalPoints % 1000}
        total={1000}
        label="Progreso al Siguiente Nivel"
        backgroundColor="#f8f9fa"
        testID="rewards-level-progress"
      />

      {/* Secondary Stats Row */}
      <View style={styles.secondaryStatsRow}>
        <StatCard
          title="Racha Actual"
          value={data.currentStreak}
          subtitle="días consecutivos"
          icon="🔥"
          backgroundColor="#fff3e0"
          testID="rewards-stat-current-streak"
        />
        <StatCard
          title="Mejor Racha"
          value={data.longestStreak}
          subtitle="récord personal"
          icon="⭐"
          backgroundColor="#fff3e0"
          testID="rewards-stat-longest-streak"
        />
      </View>

      {/* Achievements Summary */}
      <View style={styles.achievementsSummary}>
        <StatCard
          title="Logros Desbloqueados"
          value={`${data.unlockedAchievements.length}/${data.achievements.length}`}
          subtitle={`${data.achievementPoints} puntos ganados`}
          icon="🏅"
          backgroundColor="#e8f5e8"
          testID="rewards-stat-achievements"
        />
      </View>
    </View>
  );
};

/**
 * Compact version for smaller screens
 */
export const CompactRewardsStats: React.FC<Omit<RewardsStatsProps, 'testID'>> = (props) => (
  <RewardsStats {...props} testID="compact-rewards-stats" />
);

/**
 * Minimal version for list items
 */
export const MinimalRewardsStats: React.FC<{
  data: RewardsScreenData;
  variant?: 'points' | 'level' | 'streak';
  testID?: string;
}> = ({ data, variant = 'points', testID = 'minimal-rewards-stats' }) => {
  const getVariantData = () => {
    switch (variant) {
      case 'level':
        return {
          icon: '📊',
          value: data.currentLevel,
          label: `Nivel ${data.currentLevel}`
        };
      case 'streak':
        return {
          icon: '🔥',
          value: data.currentStreak,
          label: `${data.currentStreak} días`
        };
      default:
        return {
          icon: '🏆',
          value: data.totalPoints,
          label: `${data.totalPoints} pts`
        };
    }
  };

  const variantData = getVariantData();

  return (
    <View style={styles.minimalContainer} testID={testID}>
      <Text style={styles.minimalIcon}>{variantData.icon}</Text>
      <Text style={styles.minimalValue}>{variantData.value}</Text>
      <Text style={styles.minimalLabel}>{variantData.label}</Text>
    </View>
  );
};

export default RewardsStats;
