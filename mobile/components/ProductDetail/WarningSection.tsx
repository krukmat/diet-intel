/**
 * WarningSection Component
 * Componente para mostrar advertencias de OCR
 */

import React from 'react';
import { View, Text } from 'react-native';
import { productDetailStyles as styles } from '../styles/ProductDetail.styles';

export interface WarningSectionProps {
  source?: string;
  confidence?: number;
}

/**
 * Componente para mostrar advertencias de OCR con baja confianza
 */
export const WarningSection: React.FC<WarningSectionProps> = ({
  source,
  confidence
}) => {
  // Solo mostrar si es OCR y tiene baja confianza
  if (source === 'Product Database' || !confidence || confidence >= 0.7) {
    return null;
  }

  return (
    <View style={styles.warningSection}>
      <Text style={styles.warningTitle}>⚠️ Low Confidence Scan</Text>
      <Text style={styles.warningText}>
        This product information was extracted with low confidence.
        Please verify the nutrition values are accurate before adding to your plan.
      </Text>
    </View>
  );
};
