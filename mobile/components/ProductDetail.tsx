import React from 'react';
import {
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Alert } from 'react-native';
import { translateFoodNameSync } from '../utils/foodTranslation';
import { productDetailStyles as styles } from './styles/ProductDetail.styles';
import { useProductDetail } from '../hooks/useProductDetail';
import {
  ProductHeader,
  ProductImage,
  ProductInfo,
  NutritionSection,
  IngredientsSection,
  ActionsSection,
  WarningSection
} from './ProductDetail/index';

interface Product {
  code?: string;
  barcode?: string;
  product_name?: string;
  name?: string;
  brands?: string;
  brand?: string;
  serving_size?: string;
  image_url?: string;
  image_front_url?: string;
  nutriments?: any;
  categories?: string;
  ingredients_text?: string;
  // OCR specific fields
  source?: string;
  confidence?: number;
  raw_text?: string;
  scanned_at?: string;
}

interface ProductDetailProps {
  product: Product;
  onClose?: () => void;
  showAddToPlan?: boolean;
}

export default function ProductDetail({ product, onClose, showAddToPlan = true }: ProductDetailProps) {
  // Usar el custom hook para toda la lógica de estado
  const { normalizedProduct, addingToPlan, addToPlan } = useProductDetail(product);

  const handleAddToPlan = async () => {
    const result = await addToPlan('lunch'); // Default to lunch

    if (result.success) {
      Alert.alert(
        'Success!',
        result.message || `${translateFoodNameSync(normalizedProduct.name)} has been added to your meal plan.`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Could not add to plan',
        result.message || 'Failed to add product to meal plan. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };





  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />

      <ProductHeader
        onClose={onClose}
        source={normalizedProduct.source}
        confidence={normalizedProduct.confidence}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <ProductImage imageUrl={normalizedProduct.image_url} />

        <ProductInfo
          name={normalizedProduct.name}
          brand={normalizedProduct.brand}
          barcode={normalizedProduct.barcode}
          servingSize={normalizedProduct.serving_size}
          categories={normalizedProduct.categories}
        />

        <NutritionSection nutriments={normalizedProduct.nutriments} />

        <IngredientsSection ingredients={normalizedProduct.ingredients} />

        <ActionsSection
          showAddToPlan={showAddToPlan}
          addingToPlan={addingToPlan}
          barcode={normalizedProduct.barcode}
          onAddToPlan={handleAddToPlan}
        />

        <WarningSection
          source={normalizedProduct.source}
          confidence={normalizedProduct.confidence}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
