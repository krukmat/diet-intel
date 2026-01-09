/**
 * MealItem Component - Individual meal item display with actions
 * Following TDD approach: Implementation after tests
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { MealEntry, MealType } from '../../types/mealLog';

interface MealItemProps {
  meal: MealEntry;
  onEdit: (meal: MealEntry) => void;
  onDelete: (id: string) => void;
}

export const MealItem: React.FC<MealItemProps> = ({ meal, onEdit, onDelete }) => {
  const getMealTypeDisplayName = (mealType: MealType): string => {
    const names = {
      breakfast: 'Desayuno',
      lunch: 'Almuerzo',
      dinner: 'Cena',
      snack: 'Merienda',
    };
    return names[mealType] || mealType;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar comida',
      `¿Estás seguro de que quieres eliminar "${meal.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => onDelete(meal.id)
        },
      ]
    );
  };

  return (
    <View style={styles.mealItem}>
      <View style={styles.mealHeader}>
        <View style={styles.mealInfo}>
          <Text style={styles.mealName}>{meal.name}</Text>
          <Text style={styles.mealType}>{getMealTypeDisplayName(meal.mealType)}</Text>
        </View>
        <View style={styles.mealTime}>
          <Text style={styles.timeText}>{formatTime(meal.timestamp)}</Text>
        </View>
      </View>

      <View style={styles.mealNutrition}>
        <View style={styles.nutritionItem}>
          <Text style={styles.caloriesText}>{meal.calories} kcal</Text>
        </View>
        <View style={styles.macrosContainer}>
          <Text style={styles.macroText}>P: {meal.protein_g}g</Text>
          <Text style={styles.macroText}>G: {meal.fat_g}g</Text>
          <Text style={styles.macroText}>C: {meal.carbs_g}g</Text>
        </View>
      </View>

      {meal.barcode && (
        <View style={styles.barcodeContainer}>
          <Text style={styles.barcodeLabel}>Código: </Text>
          <Text style={styles.barcodeText}>{meal.barcode}</Text>
        </View>
      )}

      <View style={styles.mealActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => onEdit(meal)}
        >
          <Text style={styles.editButtonText}>Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDelete}
        >
          <Text style={styles.deleteButtonText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
});
