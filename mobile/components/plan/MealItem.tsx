import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { translateFoodNameSync } from '../../utils/foodTranslation';

interface MealItemData {
  barcode: string;
  name: string;
  serving: string;
  calories: number;
  macros: {
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    sugars_g?: number;
    salt_g?: number;
  };
}

interface MealItemProps {
  item: MealItemData;
  isConsumed: boolean;
  isConsuming: boolean;
  onConsume: (barcode: string) => void;
}

export const MealItem: React.FC<MealItemProps> = ({
  item,
  isConsumed,
  isConsuming,
  onConsume,
}) => {
  return (
    <View style={[styles.container, isConsumed && styles.consumedContainer]}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{translateFoodNameSync(item.name)}</Text>
        {isConsumed && <Text style={styles.consumedCheckmark}>✓ Consumido</Text>}
        <Text style={styles.itemServing}>
          {item.serving} • {Math.round(item.calories)} kcal
        </Text>
        <Text style={styles.macroText}>
          P: {Math.round(item.macros.protein_g)}g F: {Math.round(item.macros.fat_g)}g C: {Math.round(item.macros.carbs_g)}g
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.consumeButton,
          isConsumed && styles.consumeButtonDisabled,
          isConsuming && styles.consumeButtonLoading,
        ]}
        onPress={() => onConsume(item.barcode)}
        disabled={isConsumed || isConsuming}
      >
        <Text style={styles.consumeButtonText}>
          {isConsuming ? '...' : isConsumed ? '✓ Consumido' : 'Consumir'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  consumedContainer: {
    opacity: 0.6,
    backgroundColor: '#f0fff0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  consumedCheckmark: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 5,
  },
  itemServing: {
    fontSize: 12,
    color: '#999',
  },
  macroText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  consumeButton: {
    backgroundColor: '#34C759',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    minWidth: 100,
  },
  consumeButtonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  consumeButtonLoading: {
    backgroundColor: '#007AFF',
  },
  consumeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
