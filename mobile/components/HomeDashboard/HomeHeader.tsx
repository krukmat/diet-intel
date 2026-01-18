/**
 * HomeHeader Component
 * Minimal header for the Home dashboard.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { homeDashboardStyles as styles } from '../styles/HomeDashboard.styles';

export interface HomeHeaderProps {
  title: string;
  greeting: string;
  utilities?: Array<{
    id: string;
    label: string;
    onPress: () => void;
  }>;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  title,
  greeting,
  utilities,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{greeting}</Text>
      </View>
      {utilities && utilities.length > 0 ? (
        <View style={styles.headerUtilitiesContainer}>
          {utilities.map((utility) => (
            <TouchableOpacity
              key={utility.id}
              onPress={utility.onPress}
              testID={`home-header-utility-${utility.id}`}
              style={styles.headerUtilityButton}
            >
              <Text style={styles.headerUtilityText}>{utility.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
};
