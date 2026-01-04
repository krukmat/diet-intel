import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export interface HomeActionItem {
  id: string;
  label: string;
  onPress: () => void;
}

interface HomePrimaryActionsProps {
  title: string;
  actions: HomeActionItem[];
}

interface HomeSecondaryActionsProps {
  title: string;
  actions: HomeActionItem[];
}

interface HomeToolActionsProps {
  actions: HomeActionItem[];
}

interface HomeProgressCardProps {
  title: string;
  description: string;
}

export const HomePrimaryActions: React.FC<HomePrimaryActionsProps> = ({ title, actions }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.primaryGrid}>
        {actions.map(action => (
          <TouchableOpacity
            key={action.id}
            style={styles.primaryCard}
            onPress={action.onPress}
            testID={`home-primary-${action.id}`}
          >
            <Text style={styles.primaryLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export const HomeSecondaryActions: React.FC<HomeSecondaryActionsProps> = ({ title, actions }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.secondaryList}>
        {actions.map(action => (
          <TouchableOpacity
            key={action.id}
            style={styles.secondaryItem}
            onPress={action.onPress}
            testID={`home-secondary-${action.id}`}
          >
            <Text style={styles.secondaryLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export const HomeToolActions: React.FC<HomeToolActionsProps> = ({ actions }) => {
  return (
    <View style={styles.toolRow}>
      {actions.map(action => (
        <TouchableOpacity
          key={action.id}
          style={styles.toolButton}
          onPress={action.onPress}
          testID={`home-tool-${action.id}`}
        >
          <Text style={styles.toolLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export const HomeProgressCard: React.FC<HomeProgressCardProps> = ({ title, description }) => {
  return (
    <View style={styles.section}>
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>{title}</Text>
        <Text style={styles.progressDescription}>{description}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1C1C1E',
  },
  primaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  primaryCard: {
    flexBasis: '48%',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  secondaryList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    overflow: 'hidden',
  },
  secondaryItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  secondaryLabel: {
    fontSize: 14,
    color: '#1C1C1E',
  },
  toolRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  toolButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  toolLabel: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    color: '#111827',
  },
  progressDescription: {
    fontSize: 14,
    color: '#4B5563',
  },
});
