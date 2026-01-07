/**
 * Achievements Grid Component for DietIntel Mobile App
 * Professional grid component for displaying achievements with locked/unlocked states
 */

import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Achievement } from '../../../types/rewards';

// Professional styling system - Modular approach
import { achievementsStyles as styles } from '../../styles/achievements.styles';

interface AchievementsGridProps {
  achievements: Achievement[];
  onAchievementPress?: (achievement: Achievement) => void;
  backgroundColor?: string;
  testID?: string;
  initialFilter?: 'all' | 'unlocked' | 'locked';
}

/**
 * Individual achievement card component
 */
const AchievementCard: React.FC<{
  achievement: Achievement;
  onPress?: (achievement: Achievement) => void;
  testID?: string;
}> = ({ achievement, onPress, testID }) => {
  const handlePress = () => {
    onPress?.(achievement);
  };

  return (
    <TouchableOpacity 
      style={[
        styles.item,
        achievement.unlocked ? styles.unlockedCard : styles.lockedCard
      ]}
      onPress={handlePress}
      disabled={!achievement.unlocked}
      activeOpacity={achievement.unlocked ? 0.7 : 1}
      testID={testID}
    >
      <Text style={[
        styles.icon,
        !achievement.unlocked && styles.lockedIcon
      ]}>
        {achievement.icon}
      </Text>
      
      <Text style={[
        styles.title,
        !achievement.unlocked && styles.lockedTitle
      ]}>
        {achievement.title}
      </Text>
      
      <Text style={[
        styles.description,
        !achievement.unlocked && styles.lockedDescription
      ]}>
        {achievement.description}
      </Text>
      
      {achievement.unlocked ? (
        <View style={styles.pointsContainer}>
          <Text style={styles.pointsText}>+{achievement.points} pts</Text>
        </View>
      ) : (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {achievement.progress}/{achievement.target}
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { 
                  width: `${(achievement.progress / achievement.target) * 100}%`
                }
              ]} 
            />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

/**
 * Main Achievements Grid component
 */
export const AchievementsGrid: React.FC<AchievementsGridProps> = ({ 
  achievements,
  onAchievementPress,
  backgroundColor = '#FFFFFF',
  testID = 'achievements-grid',
  initialFilter = 'all'
}) => {
  const [activeFilter] = React.useState<'all' | 'unlocked' | 'locked'>(initialFilter);

  const filteredAchievements = React.useMemo(() => {
    switch (activeFilter) {
      case 'unlocked':
        return achievements.filter(a => a.unlocked);
      case 'locked':
        return achievements.filter(a => !a.unlocked);
      default:
        return achievements;
    }
  }, [achievements, activeFilter]);

  const renderAchievement = ({ item }: { item: Achievement }) => (
    <AchievementCard
      achievement={item}
      onPress={onAchievementPress}
      testID={`achievement-${item.id}`}
    />
  );

  const keyExtractor = (item: Achievement) => item.id;

  return (
    <View style={[styles.container, { backgroundColor }]} testID={testID}>
      <Text style={styles.sectionTitle}>🏆 Logros</Text>
      <Text style={styles.sectionSubtitle}>
        Desbloquea logros completando desafíos ({achievements.length} total)
      </Text>

      <FlatList
        data={filteredAchievements}
        renderItem={renderAchievement}
        keyExtractor={keyExtractor}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        testID="achievements-flatlist"
      />

      {filteredAchievements.length === 0 && (
        <View style={styles.emptyState} testID="achievements-empty-state">
          <Text style={styles.emptyStateIcon}>🔒</Text>
          <Text style={styles.emptyStateTitle}>
            {activeFilter === 'locked' ? 'No hay logros bloqueados' : 
             activeFilter === 'unlocked' ? 'No hay logros desbloqueados' : 
             'No hay logros disponibles'}
          </Text>
          <Text style={styles.emptyStateDescription}>
            {activeFilter === 'all' ? 'Continúa usando la app para desbloquear logros' :
             'Usa los filtros para ver otros tipos de logros'}
          </Text>
        </View>
      )}
    </View>
  );
};

export default AchievementsGrid;
