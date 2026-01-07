import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated } from 'react-native';
import { Achievement } from '../../types/rewards';

interface AnimatedAchievementsGridProps {
  achievements: Achievement[];
  onAchievementPress?: (achievement: Achievement) => void;
}

export const AnimatedAchievementsGrid: React.FC<AnimatedAchievementsGridProps> = ({ 
  achievements, 
  onAchievementPress 
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const renderAchievement = ({ item, index }: { item: Achievement; index: number }) => {
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    
    useEffect(() => {
      Animated.delay(index * 100);
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }, [index]);

    const handlePress = () => {
      // Scale animation on press
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
      
      onAchievementPress?.(item);
    };

    return (
      <Animated.View 
        style={[
          styles.achievementCard,
          item.unlocked ? styles.unlockedCard : styles.lockedCard,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.touchableContainer}
          onPress={handlePress}
          disabled={!item.unlocked}
          activeOpacity={0.7}
        >
          <Animated.View style={styles.iconContainer}>
            <Animated.Text style={[
              styles.achievementIcon,
              !item.unlocked && styles.lockedIcon,
              {
                transform: [
                  { scale: scaleAnim }
                ]
              }
            ]}>
              {item.icon}
            </Animated.Text>
          </Animated.View>
          
          <Text style={[
            styles.achievementTitle,
            !item.unlocked && styles.lockedTitle
          ]}>
            {item.title}
          </Text>
          
          <Text style={[
            styles.achievementDescription,
            !item.unlocked && styles.lockedDescription
          ]}>
            {item.description}
          </Text>
          
          {item.unlocked ? (
            <Animated.View style={styles.pointsContainer}>
              <Text style={styles.pointsText}>+{item.points} pts</Text>
            </Animated.View>
          ) : (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                {item.progress}/{item.target}
              </Text>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill,
                    { 
                      width: `${(item.progress / item.target) * 100}%`,
                      transform: [
                        { scaleX: scaleAnim }
                      ]
                    }
                  ]} 
                />
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <Animated.View style={[styles.container, {
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }]
    }]}>
      <Text style={styles.sectionTitle}>🏆 Logros</Text>
      <FlatList
        data={achievements}
        renderItem={renderAchievement}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  gridContainer: {
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  achievementCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    minHeight: 160,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  unlockedCard: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  lockedCard: {
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
    opacity: 0.8,
  },
  touchableContainer: {
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    marginBottom: 12,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  achievementIcon: {
    fontSize: 36,
  },
  lockedIcon: {
    opacity: 0.5,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 6,
  },
  lockedTitle: {
    color: '#999',
  },
  achievementDescription: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 15,
  },
  lockedDescription: {
    color: '#ccc',
  },
  pointsContainer: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  pointsText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 10,
    color: '#666',
    marginBottom: 6,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
});

export default AnimatedAchievementsGrid;
