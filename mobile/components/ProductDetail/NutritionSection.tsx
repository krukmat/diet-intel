/**
 * NutritionSection Component
 * Componente para mostrar la tabla de nutrición del producto
 */

import React from 'react';
import { View, Text } from 'react-native';
import { productDetailStyles as styles } from '../styles/ProductDetail.styles';

export interface NutritionData {
  energy: number;
  protein: number;
  fat: number;
  carbs: number;
  sugars: number;
  salt: number;
  fiber: number;
  sodium: number;
}

export interface NutritionSectionProps {
  nutriments: NutritionData;
}

/**
 * Componente para mostrar la tabla de nutrición del producto
 */
export const NutritionSection: React.FC<NutritionSectionProps> = ({ nutriments }) => {
  const renderNutritionRow = (label: string, value: number, unit: string = 'g') => {
    if (value === null || value === undefined || value === 0) return null;

    return (
      <View key={label} style={styles.nutritionRow}>
        <Text style={styles.nutritionLabel}>{label}</Text>
        <Text style={styles.nutritionValue}>
          {typeof value === 'number' ? value.toFixed(1) : '0.0'} {unit}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.nutritionSection}>
      <Text style={styles.sectionTitle}>Nutrition Facts (per 100g)</Text>
      <View style={styles.nutritionTable}>
        {renderNutritionRow('Energy', nutriments.energy, 'kcal')}
        {renderNutritionRow('Protein', nutriments.protein)}
        {renderNutritionRow('Fat', nutriments.fat)}
        {renderNutritionRow('Carbohydrates', nutriments.carbs)}
        {renderNutritionRow('Sugars', nutriments.sugars)}
        {renderNutritionRow('Salt', nutriments.salt)}
        {nutriments.fiber > 0 && renderNutritionRow('Fiber', nutriments.fiber)}
        {nutriments.sodium > 0 && renderNutritionRow('Sodium', nutriments.sodium, 'mg')}
      </View>
    </View>
  );
};
