/**
 * ActionsSection Component
 * Componente para los botones de acción del producto
 */

import React from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { productDetailStyles as styles } from '../styles/ProductDetail.styles';

export interface ActionsSectionProps {
  showAddToPlan?: boolean;
  addingToPlan: boolean;
  barcode: string;
  onAddToPlan: () => void;
}

/**
 * Componente para los botones de acción del producto
 */
export const ActionsSection: React.FC<ActionsSectionProps> = ({
  showAddToPlan = true,
  addingToPlan,
  barcode,
  onAddToPlan
}) => {
  if (!showAddToPlan) {
    return null;
  }

  return (
    <View style={styles.actionsSection}>
      <TouchableOpacity
        style={[
          styles.addToPlanButton,
          (addingToPlan || barcode === 'unknown') && styles.buttonDisabled
        ]}
        onPress={onAddToPlan}
        disabled={addingToPlan || barcode === 'unknown'}
      >
        {addingToPlan ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <>
            <Text style={styles.addToPlanText}>🍽️ Add to Meal Plan</Text>
            <Text style={styles.addToPlanSubtext}>Will be added to lunch by default</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};
