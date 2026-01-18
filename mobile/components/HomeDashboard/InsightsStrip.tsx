/**
 * InsightsStrip Component
 * Compact metrics row for key insights.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { homeDashboardStyles as styles } from '../styles/HomeDashboard.styles';

export interface InsightItem {
  id: string;
  label: string;
  value: string;
}

export interface InsightsStripProps {
  insights: InsightItem[];
}

export const InsightsStrip: React.FC<InsightsStripProps> = ({ insights }) => {
  return (
    <View style={styles.insightsRow}>
      {insights.map((insight, index) => (
        <View key={insight.id} testID={`insight-${index}`} style={styles.insightItem}>
          <Text style={styles.insightLabel}>{insight.label}</Text>
          <Text style={styles.insightValue}>{insight.value}</Text>
        </View>
      ))}
    </View>
  );
};
