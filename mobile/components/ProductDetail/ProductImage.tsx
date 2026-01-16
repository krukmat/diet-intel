/**
 * ProductImage Component
 * Componente para mostrar la imagen del producto
 */

import React from 'react';
import { View, Image } from 'react-native';
import { productDetailStyles as styles } from '../styles/ProductDetail.styles';

export interface ProductImageProps {
  imageUrl?: string;
}

/**
 * Componente para mostrar la imagen del producto
 */
export const ProductImage: React.FC<ProductImageProps> = ({ imageUrl }) => {
  if (!imageUrl) {
    return null;
  }

  return (
    <View style={styles.imageContainer}>
      <Image
        source={{ uri: imageUrl }}
        style={styles.productImage}
        resizeMode="contain"
      />
    </View>
  );
};
