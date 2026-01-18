/**
 * TodaySummaryCard Component
 * Summary card for plan status and progress.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { homeDashboardStyles as styles } from '../styles/HomeDashboard.styles';

export interface TodaySummaryCardProps {
  summaryTitle: string;
  caloriesText: string;
  stats?: Array<{
    id: string;
    label: string;
    value: string;
  }>;
  helperText?: string;
  progressValue?: number;
  ctaLabel: string;
  onCtaPress: () => void;
}

export const TodaySummaryCard: React.FC<TodaySummaryCardProps> = ({
  summaryTitle,
  caloriesText,
  stats,
  helperText,
  progressValue,
  ctaLabel,
  onCtaPress,
}) => {
  const clampedProgress = Math.max(0, Math.min(progressValue ?? 0, 1));

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>{summaryTitle}</Text>
      <Text style={styles.summaryCalories}>{caloriesText}</Text>
      {stats && stats.length > 0 ? (
        <View style={styles.summaryStatsRow}>
          {stats.map((stat, index) => (
            <View key={stat.id} style={styles.summaryStat} testID={`summary-stat-${index}`}>
              <Text style={styles.summaryStatLabel}>{stat.label}</Text>
              <Text style={styles.summaryStatValue}>{stat.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {progressValue !== undefined ? (
        <View style={styles.summaryProgressTrack} testID="summary-progress-track">
          <View
            style={[styles.summaryProgressFill, { width: `${clampedProgress * 100}%` }]}
            testID="summary-progress-fill"
          />
        </View>
      ) : null}
      {helperText ? (
        <Text style={styles.summaryHelperText}>{helperText}</Text>
      ) : null}
      <TouchableOpacity onPress={onCtaPress} testID="summary-cta">
        <Text style={styles.summaryCtaText}>{ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};
