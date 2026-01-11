import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export interface PlanSummary {
  planId: string;
  isActive: boolean;
  createdAt: string;
  dailyCalorieTarget: number;
}

interface PlanSelectionListProps {
  plans: PlanSummary[];
  loading?: boolean;
  onToggleActive: (planId: string, isActive: boolean) => void;
  onDeletePlan?: (planId: string, isActive: boolean) => void;
  onViewPlan?: (planId: string) => void;
}

export const PlanSelectionList: React.FC<PlanSelectionListProps> = ({
  plans,
  loading = false,
  onToggleActive,
  onDeletePlan,
  onViewPlan,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('plan.list.title')}</Text>
      <Text style={styles.subtitle}>{t('plan.list.subtitle')}</Text>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>{t('plan.list.loading')}</Text>
        </View>
      )}

      {!loading && plans.length === 0 && (
        <Text style={styles.emptyText}>{t('plan.list.empty')}</Text>
      )}

      {!loading &&
        plans.map((plan) => {
          const isActive = plan.isActive;
          const buttonLabel = isActive ? t('plan.list.deactivate') : t('plan.list.activate');
          const buttonStyle = isActive ? styles.activeButton : styles.activateButton;
          const buttonTextStyle = isActive ? styles.activeButtonText : styles.activateButtonText;

          return (
            <View key={plan.planId} style={styles.planRow}>
              <View style={styles.planInfo}>
                <Text style={styles.planId}>Plan {plan.planId}</Text>
                <Text style={styles.planMeta}>
                  {plan.dailyCalorieTarget ? `${Math.round(plan.dailyCalorieTarget)} kcal objetivo` : 'Objetivo no disponible'}
                </Text>
              </View>
              <View style={styles.planActions}>
                {onViewPlan && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.viewButton]}
                    onPress={() => onViewPlan(plan.planId)}
                  >
                    <Text style={[styles.toggleText, styles.viewButtonText]}>{t('plan.list.view')}</Text>
                  </TouchableOpacity>
                )}
                {onDeletePlan && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => onDeletePlan(plan.planId, isActive)}
                  >
                    <Text style={[styles.toggleText, styles.deleteButtonText]}>{t('plan.list.delete')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, buttonStyle]}
                  onPress={() => onToggleActive(plan.planId, isActive)}
                >
                  <Text style={[styles.toggleText, buttonTextStyle]}>{buttonLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#777',
  },
  emptyText: {
    fontSize: 14,
    color: '#777',
    fontStyle: 'italic',
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  planInfo: {
    flex: 1,
  },
  planActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planId: {
    fontWeight: '600',
    color: '#111',
  },
  planMeta: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  viewButton: {
    borderColor: '#CBD5F5',
    backgroundColor: '#F5F7FF',
  },
  activateButton: {
    borderColor: '#007AFF',
    backgroundColor: '#E6F0FF',
  },
  activeButton: {
    borderColor: '#4CAF50',
    backgroundColor: '#EBF7EF',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activateButtonText: {
    color: '#007AFF',
  },
  activeButtonText: {
    color: '#2C7F3A',
  },
  viewButtonText: {
    color: '#3B4CCA',
  },
  deleteButton: {
    borderColor: '#F4C7C7',
    backgroundColor: '#FFF2F2',
  },
  deleteButtonText: {
    color: '#C62828',
  },
});
