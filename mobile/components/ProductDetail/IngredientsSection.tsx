/**
 * IngredientsSection Component
 * Componente para mostrar los ingredientes del producto
 */

import React from 'react';
import { View, Text } from 'react-native';
import { productDetailStyles as styles } from '../styles/ProductDetail.styles';

export interface IngredientsSectionProps {
  ingredients?: string;
}

/**
 * Componente para mostrar los ingredientes del producto
 */
export const IngredientsSection: React.FC<IngredientsSectionProps> = ({ ingredients }) => {
  if (!ingredients) {
    return null;
  }

  return (
    <View style={styles.ingredientsSection}>
      <Text style={styles.sectionTitle}>Ingredients</Text>
      <Text style={styles.ingredientsText}>{ingredients}</Text>
    </View>
  );
};
