import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { homeActionsStyles as styles } from '../styles/HomeActions.styles';

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
            <View style={styles.actionRow}>
              {action.icon && (
                <View style={styles.iconBadge}>
                  <Text style={styles.iconText}>{action.icon}</Text>
                </View>
              )}
              <View style={styles.actionText}>
                <Text style={styles.actionLabel}>{action.label}</Text>
                {action.subtitle && <Text style={styles.actionSubtitle}>{action.subtitle}</Text>}
              </View>
            </View>
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
            <View style={styles.actionRow}>
              {action.icon && (
                <View style={styles.iconBadge}>
                  <Text style={styles.iconText}>{action.icon}</Text>
                </View>
              )}
              <View style={styles.actionText}>
                <Text style={styles.actionLabel}>{action.label}</Text>
                {action.subtitle && <Text style={styles.actionSubtitle}>{action.subtitle}</Text>}
              </View>
            </View>
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
