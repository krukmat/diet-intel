/**
 * ProductHeader Component
 * Componente para el header del ProductDetail
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { productDetailStyles as styles } from '../styles/ProductDetail.styles';

export interface ProductHeaderProps {
  onClose?: () => void;
  source?: string;
  confidence?: number;
}

/**
 * Componente del header del ProductDetail
 */
export const ProductHeader: React.FC<ProductHeaderProps> = ({
  onClose,
  source,
  confidence
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.title}>📦 Product Details</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      {source && source !== 'Product Database' && (
        <Text style={styles.sourceText}>
          Source: {source}
          {confidence &&
            ` (${Math.round(confidence * 100)}% confidence)`
          }
        </Text>
      )}
    </View>
  );
};
