/**
 * MealList Component - List of meals with CRUD operations
 * Following TDD approach: Implementation after tests
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useMealLog } from '../../hooks/useMealLog';
import { MealEntry } from '../../types/mealLog';
import { MealItem } from './MealItem';

interface MealListProps {
  userId: string;
  onAddMeal?: () => void;
  onEditMeal?: (meal: MealEntry) => void;
}

export const MealList: React.FC<MealListProps> = ({
  userId,
  onAddMeal,
  onEditMeal
}) => {
  const { meals, loading, error, loadMeals, setSelectedMeal, deleteMeal } = useMealLog(userId);

  useEffect(() => {
    loadMeals(userId);
  }, [userId, loadMeals]);

  const handleRefresh = () => {
    loadMeals(userId);
  };

  const handleEditMeal = (meal: MealEntry) => {
    setSelectedMeal(meal);
    onEditMeal?.(meal);
  };

  const handleDeleteMeal = async (id: string) => {
    try {
      await deleteMeal(id);
    } catch (error) {
      Alert.alert('Error', 'No se pudo eliminar la comida');
    }
  };

  const renderMealItem = ({ item }: { item: MealEntry }) => (
    <MealItem
      meal={item}
      onEdit={handleEditMeal}
      onDelete={handleDeleteMeal}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🍽️</Text>
      <Text style={styles.emptyTitle}>No hay comidas registradas</Text>
      <Text style={styles.emptyText}>Registra tu primera comida para comenzar</Text>
      {onAddMeal && (
        <TouchableOpacity style={styles.addButton} onPress={onAddMeal}>
          <Text style={styles.addButtonText}>Agregar Comida</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderHeader = () => {
    if (meals.length === 0) return null;

    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {meals.length} {meals.length === 1 ? 'comida' : 'comidas'}
        </Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Text style={styles.refreshButtonText}>Actualizar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderError = () => {
    if (!error) return null;

    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && meals.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando comidas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderError()}

      <FlatList
        data={meals}
        keyExtractor={(item) => item.id}
        renderItem={renderMealItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        contentContainerStyle={meals.length === 0 ? styles.emptyList : undefined}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  mealItem: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  mealType: {
    fontSize: 14,
    color: '#8E8E93',
    textTransform: 'capitalize',
  },
  mealTime: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  mealNutrition: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nutritionItem: {
    flex: 1,
  },
  caloriesText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  macrosContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  macroText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  barcodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 6,
  },
  barcodeLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  barcodeText: {
    fontSize: 12,
    color: '#1C1C1E',
    fontFamily: 'monospace',
  },
  mealActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    backgroundColor: '#FFF2F2',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 12,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  retryButtonText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
  },
  emptyList: {
    flexGrow: 1,
  },
});
