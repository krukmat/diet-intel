import React from 'react';
import { View, Text } from 'react-native';
import { useRewardsData } from '../hooks/useRewardsData';
import { useGamification } from '../contexts/GamificationContext';
import { RewardsScreenData } from '../types/rewards';

// Professional styling system
import { rewardsScreenStyles as styles } from '../shared/ui/styles';

interface RewardsScreenProps {
  navigation?: {
    goBack: () => void;
  };
}

const FALLBACK_REWARDS_DATA: RewardsScreenData = {
  totalPoints: 0,
  currentLevel: 1,
  levelProgress: 0,
  pointsToNextLevel: 1000,
  currentStreak: 0,
  longestStreak: 0,
  achievements: [],
  unlockedAchievements: [],
  achievementPoints: 0
};

const RewardsScreen: React.FC<RewardsScreenProps> = ({ navigation }) => {
  const { data, loading, error } = useRewardsData(true);
  const gamificationData = useGamification();
  
  // Combinar datos del hook useRewardsData con GamificationContext
  const combinedData = React.useMemo(() => {
    const baseData = data ?? FALLBACK_REWARDS_DATA;

    const pickNumber = (value: number | undefined, fallback: number) =>
      typeof value === 'number' ? value : fallback;

    const syncedData: RewardsScreenData = {
      totalPoints: pickNumber(baseData.totalPoints, gamificationData.totalPoints),
      currentLevel: pickNumber(baseData.currentLevel, gamificationData.currentLevel),
      levelProgress: pickNumber(baseData.levelProgress, gamificationData.levelProgress),
      pointsToNextLevel: pickNumber(baseData.pointsToNextLevel, gamificationData.pointsToNextLevel),
      currentStreak: pickNumber(baseData.currentStreak, gamificationData.currentStreak),
      longestStreak: pickNumber(baseData.longestStreak, gamificationData.longestStreak),
      achievements: baseData.achievements ?? [],
      unlockedAchievements:
        baseData.unlockedAchievements?.length ? baseData.unlockedAchievements : gamificationData.unlockedAchievements ?? [],
      achievementPoints: pickNumber(baseData.achievementPoints, gamificationData.achievementPoints),
    };

    return syncedData;
  }, [data, gamificationData]);

  const safeData = combinedData;
  const achievements = safeData.achievements ?? [];
  const achievementsCount = achievements.length;
  const achievementsToShow = achievements.slice(0, 5);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando recompensas...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🏆 Recompensas</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 Recompensas</Text>
        {navigation?.goBack && (
          <Text style={styles.backButton} onPress={navigation.goBack}>
            ← Volver
          </Text>
        )}
      </View>
      
      <View style={styles.content}>
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Estadísticas</Text>
          <Text style={styles.statItem}>Puntos Totales: {safeData.totalPoints}</Text>
          <Text style={styles.statItem}>Nivel: {safeData.currentLevel}</Text>
          <Text style={styles.statItem}>Progreso: {safeData.levelProgress}%</Text>
          <Text style={styles.statItem}>Puntos al Siguiente Nivel: {safeData.pointsToNextLevel}</Text>
          <Text style={styles.statItem}>Racha Actual: {safeData.currentStreak} días</Text>
          <Text style={styles.statItem}>Racha Más Larga: {safeData.longestStreak} días</Text>
          <Text style={styles.statItem}>Puntos de Logros: {safeData.achievementPoints}</Text>
        </View>
        
        <View style={styles.achievementsSection}>
          <Text style={styles.sectionTitle}>Logros</Text>
          <Text style={styles.sectionSubtitle}>Logros ({achievementsCount})</Text>
          {achievementsToShow.length > 0 ? (
            achievementsToShow.map((achievement) => (
              <View key={achievement.id} style={styles.achievementItem}>
                <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                <View style={styles.achievementContent}>
                  <Text style={styles.achievementTitle}>{achievement.title}</Text>
                  <Text style={styles.achievementDescription}>{achievement.description}</Text>
                  <Text style={styles.achievementProgress}>
                    {achievement.unlocked ? '✅ Desbloqueado' : `${achievement.progress}/${achievement.target}`}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>No hay logros disponibles</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export default RewardsScreen;
