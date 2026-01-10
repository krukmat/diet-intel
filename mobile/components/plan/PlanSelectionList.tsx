import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';

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
}

export const PlanSelectionList: React.FC<PlanSelectionListProps> = ({
  plans,
  loading = false,
  onToggleActive,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Planes guardados</Text>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Actualizando planes...</Text>
        </View>
      )}

      {!loading && plans.length === 0 && (
        <Text style={styles.emptyText}>No hay planes guardados</Text>
      )}

      {!loading &&
        plans.map((plan) => {
          const isActive = plan.isActive;
          const buttonLabel = isActive ? 'Activo • Desactivar' : 'Activar';
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
              <TouchableOpacity
                style={[styles.toggleButton, buttonStyle]}
                onPress={() => onToggleActive(plan.planId, isActive)}
              >
                <Text style={[styles.toggleText, buttonTextStyle]}>{buttonLabel}</Text>
              </TouchableOpacity>
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
  planId: {
    fontWeight: '600',
    color: '#111',
  },
  planMeta: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
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
});
