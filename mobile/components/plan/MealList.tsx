import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TFunction } from 'i18next';
import { MealItem } from './MealItem';

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

interface Meal {
  name: string;
  target_calories: number;
  actual_calories: number;
  items: MealItemData[];
}

interface MealListProps {
  meals: Meal[];
  consumedItems: string[];
  consumingItem: string | null;
  onConsumeItem: (barcode: string) => void;
  onCustomizeMeal: (mealIndex: number, mealType: string) => void;
  t: TFunction;
  translateMealName: (mealName: string) => string;
}

const MealCard: React.FC<{
  meal: Meal;
  mealIndex: number;
  consumedItems: string[];
  consumingItem: string | null;
  onConsumeItem: (barcode: string) => void;
  onCustomizeMeal: (mealIndex: number, mealType: string) => void;
  t: TFunction;
  translateMealName: (mealName: string) => string;
}> = ({ meal, mealIndex, consumedItems, consumingItem, onConsumeItem, onCustomizeMeal, t, translateMealName }) => {
  return (
    <View style={styles.mealCard}>
      <View style={styles.mealHeader}>
        <Text style={styles.mealTitle}>
          {meal.name === 'Breakfast' ? '🌅' :
           meal.name === 'Lunch' ? '🌞' : '🌙'} {translateMealName(meal.name)}
        </Text>
        <Text style={styles.mealCalories}>{Math.round(meal.actual_calories)} kcal</Text>
      </View>

      {meal.items.map((item, itemIndex) => (
        <MealItem
          key={item.barcode || itemIndex}
          item={item}
          isConsumed={consumedItems.includes(item.barcode)}
          isConsuming={consumingItem === item.barcode}
          onConsume={onConsumeItem}
        />
      ))}

      <TouchableOpacity
        style={styles.customizeButton}
        onPress={() => onCustomizeMeal(mealIndex, meal.name)}
      >
        <Text style={styles.customizeButtonText}>
          {t('plan.customize', 'Personalizar')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export const MealList: React.FC<MealListProps> = ({
  meals,
  consumedItems,
  consumingItem,
  onConsumeItem,
  onCustomizeMeal,
  t,
  translateMealName,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        {t('plan.plannedMeals', 'Comidas Planificadas')}
      </Text>
      {meals.map((meal, index) => (
        <MealCard
          key={meal.name}
          meal={meal}
          mealIndex={index}
          consumedItems={consumedItems}
          consumingItem={consumingItem}
          onConsumeItem={onConsumeItem}
          onCustomizeMeal={onCustomizeMeal}
          t={t}
          translateMealName={translateMealName}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  mealCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mealTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  mealCalories: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  customizeButton: {
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  customizeButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
