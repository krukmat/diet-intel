/**
 * QuickActionsRow Component
 * Displays the primary actions in a single row.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { homeDashboardStyles as styles } from '../styles/HomeDashboard.styles';

export interface QuickActionItem {
  id: string;
  label: string;
  onPress: () => void;
}

export interface QuickActionsRowProps {
  actions: QuickActionItem[];
}

export const QuickActionsRow: React.FC<QuickActionsRowProps> = ({ actions }) => {
  return (
    <View style={styles.quickActionsRow}>
      {actions.map((action, index) => (
        <TouchableOpacity
          key={action.id}
          onPress={action.onPress}
          testID={`quick-action-${index}`}
          style={styles.quickActionButton}
        >
          <Text style={styles.quickActionText}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
