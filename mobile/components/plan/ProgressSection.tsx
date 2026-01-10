import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TFunction } from 'i18next';
import { DashboardData } from '../../services/ApiService';

interface ProgressSectionProps {
  dashboard: DashboardData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  t: TFunction;
}

const ProgressBar = ({ current, target, color }: { current: number; target: number; color: string }) => {
  const percentage = Math.min((current / target) * 100, 100);
  return (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBar, { backgroundColor: `${color}20` }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${percentage}%`, backgroundColor: color }
          ]}
        />
      </View>
      <Text style={styles.progressText}>
        {Math.round(current)}/{Math.round(target)}
      </Text>
    </View>
  );
};

export const ProgressSection: React.FC<ProgressSectionProps> = ({
  dashboard,
  loading,
  error,
  onRetry,
  t,
}) => {
  if (error || !dashboard?.progress) {
    return (
      <View style={styles.errorSection}>
        <Text style={styles.errorText}>
          ⚠️ {t('plan.progressUnavailable', 'Progreso no disponible')}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>
            {t('common.retry', 'Reintentar')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { progress } = dashboard;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {t('plan.dailyProgress', 'Progreso Diario')}
      </Text>

      <View style={styles.progressItem}>
        <Text style={styles.progressLabel}>
          {t('plan.calories', 'Calorías')}
        </Text>
        <ProgressBar
          current={progress.calories.consumed}
          target={progress.calories.planned}
          color="#FF6B6B"
        />
      </View>

      <View style={styles.progressItem}>
        <Text style={styles.progressLabel}>
          {t('plan.protein', 'Proteína')}
        </Text>
        <ProgressBar
          current={progress.protein.consumed}
          target={progress.protein.planned}
          color="#4ECDC4"
        />
      </View>

      <View style={styles.progressItem}>
        <Text style={styles.progressLabel}>
          {t('plan.fat', 'Grasa')}
        </Text>
        <ProgressBar
          current={progress.fat.consumed}
          target={progress.fat.planned}
          color="#45B7D1"
        />
      </View>

      <View style={styles.progressItem}>
        <Text style={styles.progressLabel}>
          {t('plan.carbs', 'Carbohidratos')}
        </Text>
        <ProgressBar
          current={progress.carbs.consumed}
          target={progress.carbs.planned}
          color="#F9CA24"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  progressItem: {
    marginBottom: 15,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    minWidth: 60,
    textAlign: 'right',
  },
  errorSection: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
