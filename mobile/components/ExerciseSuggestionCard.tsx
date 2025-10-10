import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ExerciseSuggestion } from '../types/visionLog';

interface ExerciseSuggestionCardProps {
  exercise: ExerciseSuggestion;
  onPress?: () => void;
}

const ExerciseSuggestionCard: React.FC<ExerciseSuggestionCardProps> = ({
  exercise,
  onPress,
}) => {
  const { t } = useTranslation();

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'low':
        return '#34C759';
      case 'moderate':
        return '#FF9500';
      case 'high':
        return '#FF3B30';
      default:
        return '#007AFF';
    }
  };

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'walking':
        return '🚶';
      case 'running':
        return '🏃';
      case 'swimming':
        return '🏊';
      case 'cycling':
        return '🚴';
      case 'home_exercise':
        return '🏋️';
      default:
        return '💪';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, onPress && styles.containerTouchable]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={styles.activityInfo}>
          <Text style={styles.activityIcon}>{getActivityIcon(exercise.activity_type)}</Text>
          <View style={styles.activityText}>
            <Text style={styles.activityType}>
              {t(`exercise.activity.${exercise.activity_type}`, exercise.activity_type)}
            </Text>
            <View style={styles.durationContainer}>
              <Text style={styles.durationText}>
                {exercise.duration_minutes} {t('common.minutes', 'minutes')}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.intensityBadge,
            { backgroundColor: getIntensityColor(exercise.intensity_level) },
          ]}
        >
          <Text style={styles.intensityText}>
            {t(`exercise.intensity.${exercise.intensity_level}`, exercise.intensity_level)}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.caloriesContainer}>
          <Text style={styles.caloriesIcon}>🔥</Text>
          <Text style={styles.caloriesText}>
            {exercise.estimated_calories_burned} {t('exercise.calories', 'calories')}
          </Text>
        </View>

        {exercise.health_benefits && exercise.health_benefits.length > 0 && (
          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>
              {t('exercise.benefits', 'Benefits')}:
            </Text>
            {exercise.health_benefits.slice(0, 2).map((benefit, index) => (
              <Text key={index} style={styles.benefitText}>
                • {benefit}
              </Text>
            ))}
            {exercise.health_benefits.length > 2 && (
              <Text style={styles.moreBenefitsText}>
                +{exercise.health_benefits.length - 2} {t('common.more', 'more')}
              </Text>
            )}
          </View>
        )}
      </View>

      <Text style={styles.reasoningText}>
        {t('exercise.reasoning', 'Why')}: {exercise.reasoning}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  containerTouchable: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  activityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  activityIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  activityText: {
    flex: 1,
  },
  activityType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  durationContainer: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  durationText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  intensityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  intensityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  details: {
    marginBottom: 12,
  },
  caloriesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  caloriesIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  caloriesText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  benefitsContainer: {
    marginTop: 8,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  benefitText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  moreBenefitsText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  reasoningText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 18,
  },
});

export default ExerciseSuggestionCard;
