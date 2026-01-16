/**
 * Utilidades de normalización para datos de productos
 * Funciones puras para normalizar datos de diferentes fuentes (API, OCR)
 */

export interface ProductNutriments {
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

export interface RawProduct {
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

export interface NormalizedProduct {
  barcode: string;
  name: string;
  brand: string;
  serving_size: string;
  image_url: string;
  categories: string;
  ingredients: string;
  source: string;
  confidence: number;
  nutriments: {
    energy: number;
    protein: number;
    fat: number;
    carbs: number;
    sugars: number;
    salt: number;
    fiber: number;
    sodium: number;
  };
}

/**
 * Normaliza los datos de un producto de diferentes fuentes (API, OCR)
 */
export const normalizeProductData = (product: RawProduct): NormalizedProduct => {
  return {
    barcode: product.code || product.barcode || 'unknown',
    name: product.product_name || product.name || 'Unknown Product',
    brand: product.brands || product.brand || '',
    serving_size: product.serving_size || '100g',
    image_url: product.image_url || product.image_front_url || '',
    categories: product.categories || '',
    ingredients: product.ingredients_text || '',
    source: product.source || 'Product Database',
    confidence: product.confidence || 1.0,
    nutriments: normalizeNutriments(product.nutriments)
  };
};

/**
 * Normaliza los datos nutricionales de diferentes formatos
 */
export const normalizeNutriments = (nutriments?: ProductNutriments) => {
  if (!nutriments) {
    return {
      energy: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      sugars: 0,
      salt: 0,
      fiber: 0,
      sodium: 0,
    };
  }

  return {
    energy: nutriments.energy_kcal_100g || nutriments.energy_kcal_per_100g || 0,
    protein: nutriments.proteins_100g || nutriments.protein_g_per_100g || 0,
    fat: nutriments.fat_100g || nutriments.fat_g_per_100g || 0,
    carbs: nutriments.carbohydrates_100g || nutriments.carbs_g_per_100g || 0,
    sugars: nutriments.sugars_100g || nutriments.sugars_g_per_100g || 0,
    salt: nutriments.salt_100g || nutriments.salt_g_per_100g || 0,
    fiber: nutriments.fiber_100g || 0,
    sodium: nutriments.sodium_100g || 0,
  };
};

/**
 * Verifica si un producto tiene datos nutricionales válidos
 */
export const hasNutritionData = (nutriments: NormalizedProduct['nutriments']): boolean => {
  return nutriments.energy > 0 ||
         nutriments.protein > 0 ||
         nutriments.fat > 0 ||
         nutriments.carbs > 0;
};

/**
 * Verifica si un producto tiene datos nutricionales completos
 */
export const hasCompleteNutritionData = (nutriments: NormalizedProduct['nutriments']): boolean => {
  return nutriments.energy > 0 &&
         nutriments.protein > 0 &&
         nutriments.fat > 0 &&
         nutriments.carbs > 0;
};

/**
 * Calcula el porcentaje de completitud de datos nutricionales
 */
export const getNutritionCompleteness = (nutriments: NormalizedProduct['nutriments']): number => {
  const requiredFields = ['energy', 'protein', 'fat', 'carbs'];
  const optionalFields = ['sugars', 'salt', 'fiber', 'sodium'];

  let completed = 0;
  const total = requiredFields.length + optionalFields.length;

  // Check required fields
  requiredFields.forEach(field => {
    if (nutriments[field as keyof typeof nutriments] > 0) {
      completed++;
    }
  });

  // Check optional fields
  optionalFields.forEach(field => {
    if (nutriments[field as keyof typeof nutriments] > 0) {
      completed++;
    }
  });

  return Math.round((completed / total) * 100);
};

/**
 * Valida si un producto tiene información básica necesaria
 */
export const isValidProduct = (product: NormalizedProduct): boolean => {
  return product.barcode !== 'unknown' &&
         product.name !== 'Unknown Product' &&
         product.barcode.trim().length > 0;
};
