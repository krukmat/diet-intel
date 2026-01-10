import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export interface HomeActionItem {
  id: string;
  label: string;
  icon?: string;
  subtitle?: string;
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
  const hasTitle = Boolean(title.trim());
  return (
    <View style={styles.section}>
      {hasTitle && <Text style={styles.sectionTitle}>{title}</Text>}
      <View style={styles.actionGrid}>
        {actions.map(action => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionCard}
            onPress={action.onPress}
            testID={`home-primary-${action.id}`}
          >
            {action.icon && (
              <View style={styles.iconBadge}>
                <Text style={styles.iconText}>{action.icon}</Text>
              </View>
            )}
            <Text style={styles.actionLabel}>{action.label}</Text>
            {action.subtitle && <Text style={styles.actionSubtitle}>{action.subtitle}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export const HomeSecondaryActions: React.FC<HomeSecondaryActionsProps> = ({ title, actions }) => {
  const hasTitle = Boolean(title.trim());
  return (
    <View style={styles.section}>
      {hasTitle && <Text style={styles.sectionTitle}>{title}</Text>}
      <View style={styles.actionGrid}>
        {actions.map(action => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionCard}
            onPress={action.onPress}
            testID={`home-secondary-${action.id}`}
          >
            {action.icon && (
              <View style={styles.iconBadge}>
                <Text style={styles.iconText}>{action.icon}</Text>
              </View>
            )}
            <Text style={styles.actionLabel}>{action.label}</Text>
            {action.subtitle && <Text style={styles.actionSubtitle}>{action.subtitle}</Text>}
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
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1C1C1E',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    flexBasis: '48%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'flex-start',
    minHeight: 96,
    justifyContent: 'flex-start',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 11,
    color: '#6B7280',
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconText: {
    fontSize: 16,
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
