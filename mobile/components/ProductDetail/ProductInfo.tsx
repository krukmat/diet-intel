/**
 * ProductInfo Component
 * Componente para mostrar la información básica del producto
 */

import React from 'react';
import { View, Text } from 'react-native';
import { translateFoodNameSync } from '../../utils/foodTranslation';
import { productDetailStyles as styles } from '../styles/ProductDetail.styles';

export interface ProductInfoProps {
  name: string;
  brand?: string;
  barcode: string;
  servingSize: string;
  categories?: string;
}

/**
 * Componente para mostrar la información básica del producto
 */
export const ProductInfo: React.FC<ProductInfoProps> = ({
  name,
  brand,
  barcode,
  servingSize,
  categories
}) => {
  return (
    <View style={styles.infoSection}>
      <Text style={styles.productName}>{translateFoodNameSync(name)}</Text>
      {brand && (
        <Text style={styles.brandName}>{brand}</Text>
      )}
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Barcode:</Text>
        <Text style={styles.infoValue}>{barcode}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Serving Size:</Text>
        <Text style={styles.infoValue}>{servingSize}</Text>
      </View>
      {categories && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Category:</Text>
          <Text style={styles.infoValue}>{categories}</Text>
        </View>
      )}
    </View>
  );
};
