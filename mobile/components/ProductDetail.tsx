import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import axios from 'axios';
import { translateFoodName } from '../utils/foodTranslation';

const API_BASE_URL = 'http://10.0.2.2:8000';

interface ProductNutriments {
  energy_kcal_100g?: number;
  energy_kcal_per_100g?: number;
  proteins_100g?: number;
  protein_g_per_100g?: number;
  fat_100g?: number;
  fat_g_per_100g?: number;
  carbohydrates_100g?: number;
  carbs_g_per_100g?: number;
  sugars_100g?: number;
  sugars_g_per_100g?: number;
  salt_100g?: number;
  salt_g_per_100g?: number;
  fiber_100g?: number;
  sodium_100g?: number;
}

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
  nutriments?: ProductNutriments;
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
  const [addingToPlan, setAddingToPlan] = useState(false);

  // Normalize product data from different sources
  const normalizeProduct = (prod: Product) => {
    return {
      barcode: prod.code || prod.barcode || 'unknown',
      name: prod.product_name || prod.name || 'Unknown Product',
      brand: prod.brands || prod.brand || '',
      serving_size: prod.serving_size || '100g',
      image_url: prod.image_url || prod.image_front_url || '',
      categories: prod.categories || '',
      ingredients: prod.ingredients_text || '',
      source: prod.source || 'Product Database',
      confidence: prod.confidence || 1.0,
      nutriments: {
        energy: prod.nutriments?.energy_kcal_100g || prod.nutriments?.energy_kcal_per_100g || 0,
        protein: prod.nutriments?.proteins_100g || prod.nutriments?.protein_g_per_100g || 0,
        fat: prod.nutriments?.fat_100g || prod.nutriments?.fat_g_per_100g || 0,
        carbs: prod.nutriments?.carbohydrates_100g || prod.nutriments?.carbs_g_per_100g || 0,
        sugars: prod.nutriments?.sugars_100g || prod.nutriments?.sugars_g_per_100g || 0,
        salt: prod.nutriments?.salt_100g || prod.nutriments?.salt_g_per_100g || 0,
        fiber: prod.nutriments?.fiber_100g || 0,
        sodium: prod.nutriments?.sodium_100g || 0,
      }
    };
  };

  const normalizedProduct = normalizeProduct(product);

  const handleAddToPlan = async () => {
    if (!normalizedProduct.barcode || normalizedProduct.barcode === 'unknown') {
      Alert.alert('Error', 'Cannot add product without barcode to plan.');
      return;
    }

    setAddingToPlan(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/plan/add-product`, {
        barcode: normalizedProduct.barcode,
        meal_type: 'lunch', // Default to lunch, could be made selectable
      });

      // Handle the new API response structure
      const result = response.data;
      if (result.success) {
        Alert.alert(
          'Success!',
          result.message || `${translateFoodName(normalizedProduct.name)} has been added to your meal plan.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Could not add to plan',
          result.message || 'Failed to add product to meal plan. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Add to plan failed:', error);
      
      // Handle different error scenarios
      let errorMessage = 'Failed to add product to meal plan. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setAddingToPlan(false);
    }
  };

  const renderNutritionRow = (label: string, value: number | null, unit: string = 'g') => {
    if (value === null || value === undefined) return null;
    
    return (
      <View style={styles.nutritionRow}>
        <Text style={styles.nutritionLabel}>{label}</Text>
        <Text style={styles.nutritionValue}>
          {typeof value === 'number' ? value.toFixed(1) : '0.0'} {unit}
        </Text>
      </View>
    );
  };

  const hasNutritionData = () => {
    const nutrients = normalizedProduct.nutriments;
    return nutrients.energy > 0 || nutrients.protein > 0 || 
           nutrients.fat > 0 || nutrients.carbs > 0;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>📦 Product Details</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {normalizedProduct.source !== 'Product Database' && (
          <Text style={styles.sourceText}>
            Source: {normalizedProduct.source} 
            {normalizedProduct.confidence && 
              ` (${Math.round(normalizedProduct.confidence * 100)}% confidence)`
            }
          </Text>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Product Image */}
        {normalizedProduct.image_url && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: normalizedProduct.image_url }}
              style={styles.productImage}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Basic Info */}
        <View style={styles.infoSection}>
          <Text style={styles.productName}>{translateFoodName(normalizedProduct.name)}</Text>
          {normalizedProduct.brand && (
            <Text style={styles.brandName}>{normalizedProduct.brand}</Text>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Barcode:</Text>
            <Text style={styles.infoValue}>{normalizedProduct.barcode}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Serving Size:</Text>
            <Text style={styles.infoValue}>{normalizedProduct.serving_size}</Text>
          </View>
          {normalizedProduct.categories && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Category:</Text>
              <Text style={styles.infoValue}>{normalizedProduct.categories}</Text>
            </View>
          )}
        </View>

        {/* Nutrition Facts */}
        {hasNutritionData() && (
          <View style={styles.nutritionSection}>
            <Text style={styles.sectionTitle}>Nutrition Facts (per 100g)</Text>
            <View style={styles.nutritionTable}>
              {renderNutritionRow('Energy', normalizedProduct.nutriments.energy, 'kcal')}
              {renderNutritionRow('Protein', normalizedProduct.nutriments.protein)}
              {renderNutritionRow('Fat', normalizedProduct.nutriments.fat)}
              {renderNutritionRow('Carbohydrates', normalizedProduct.nutriments.carbs)}
              {renderNutritionRow('Sugars', normalizedProduct.nutriments.sugars)}
              {renderNutritionRow('Salt', normalizedProduct.nutriments.salt)}
              {normalizedProduct.nutriments.fiber > 0 && 
                renderNutritionRow('Fiber', normalizedProduct.nutriments.fiber)}
              {normalizedProduct.nutriments.sodium > 0 && 
                renderNutritionRow('Sodium', normalizedProduct.nutriments.sodium, 'mg')}
            </View>
          </View>
        )}

        {/* Ingredients */}
        {normalizedProduct.ingredients && (
          <View style={styles.ingredientsSection}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <Text style={styles.ingredientsText}>{normalizedProduct.ingredients}</Text>
          </View>
        )}

        {/* Actions */}
        {showAddToPlan && (
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={[
                styles.addToPlanButton,
                (addingToPlan || normalizedProduct.barcode === 'unknown') && styles.buttonDisabled
              ]}
              onPress={handleAddToPlan}
              disabled={addingToPlan || normalizedProduct.barcode === 'unknown'}
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
        )}

        {/* Warning for low confidence OCR */}
        {normalizedProduct.source !== 'Product Database' && 
         normalizedProduct.confidence && normalizedProduct.confidence < 0.7 && (
          <View style={styles.warningSection}>
            <Text style={styles.warningTitle}>⚠️ Low Confidence Scan</Text>
            <Text style={styles.warningText}>
              This product information was extracted with low confidence. 
              Please verify the nutrition values are accurate before adding to your plan.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sourceText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontStyle: 'italic',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  imageContainer: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  productImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
  },
  infoSection: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  productName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  brandName: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#666',
    flex: 2,
    textAlign: 'right',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  nutritionSection: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  nutritionTable: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 15,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  nutritionLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  nutritionValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  ingredientsSection: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  ingredientsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  actionsSection: {
    marginTop: 15,
    marginBottom: 30,
  },
  addToPlanButton: {
    backgroundColor: '#34C759',
    paddingVertical: 18,
    paddingHorizontal: 25,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: '#BDC3C7',
    shadowColor: 'transparent',
  },
  addToPlanText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  addToPlanSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  warningSection: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFEAA7',
    borderWidth: 1,
    borderRadius: 15,
    padding: 20,
    marginTop: 15,
    marginBottom: 30,
  },
  warningTitle: {
    color: '#856404',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    lineHeight: 20,
  },
});