
// Base component types for vision analysis
export interface IdentifiedIngredient {
  name: string;
  category: string;
  estimated_grams: number;
  confidence_score: number;
  visual_markers?: string[];
  nutrition_per_100g: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  };
}

export interface NutritionalAnalysis {
  total_calories: number;
  macro_distribution: {
    protein_percent: number;
    fat_percent: number;
    carbs_percent: number;
  };
  micronutrients?: Record<string, number>;
  food_quality_score: number;
  health_benefits: string[];
}

export interface ExerciseSuggestion {
  activity_type: 'walking' | 'running' | 'swimming' | 'cycling' | 'home_exercise';
  duration_minutes: number;
  estimated_calories_burned: number;
  intensity_level: 'low' | 'moderate' | 'high';
  reasoning: string;
  health_benefits: string[];
}

// Vision Log Types aligned with backend specifications
export interface VisionLogResponse {
  id: string;
  user_id: string;
  image_url: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner';
  identified_ingredients: IdentifiedIngredient[];
  estimated_portions: {
    total_calories: number;
    total_protein_g: number;
    total_fat_g: number;
    total_carbs_g: number;
    confidence_score: number;
  };
  nutritional_analysis: NutritionalAnalysis;
  exercise_suggestions: ExerciseSuggestion[];
  created_at: string;
  processing_time_ms: number;
}

export interface VisionLogWithExerciseResponse extends VisionLogResponse {
  exercise_suggestions: ExerciseSuggestion[]; // At least 1 required
  calorie_balance: CalorieBalance;
}

export interface LowConfidenceVisionResponse {
  id: string;
  confidence_score: number; // < 0.7
  partial_identification: IdentifiedIngredient[];
  suggested_corrections: string[];
  requires_manual_review: boolean;
  created_at: string;
}

export interface CalorieBalance {
  consumed_calories: number;
  target_calories: number;
  calorie_deficit: number;
  exercise_needed: boolean;
  balance_status: 'under_target' | 'at_target' | 'over_target';
}

export interface CorrectionData {
  correction_type: 'portion_correction' | 'ingredient_misidentification' | 'missing_ingredient';
  original_data: any;
  corrected_data: any;
  timestamp: string;
}

export interface VisionErrorResponse {
  error: string;
  detail: string;
  error_code: string;
}

// Service-related types
export interface UploadVisionRequest {
  image: string; // Base64 or file
  meal_type?: 'breakfast' | 'lunch' | 'dinner';
  user_context?: {
    current_weight_kg?: number;
    activity_level?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
    goal?: 'lose_weight' | 'maintain' | 'gain_weight';
  };
}

export interface CorrectionRequest {
  log_id: string;
  corrections: {
    ingredient_name: string;
    estimated_grams: number;
    actual_grams: number;
  }[];
  feedback_type: 'portion_correction' | 'ingredient_misidentification' | 'missing_ingredient';
}

export interface VisionHistoryParams {
  limit?: number;
  offset?: number;
  date_from?: string;
  date_to?: string;
}

// UI state types
export interface VisionLogState {
  selectedImage: string | null;
  isAnalyzing: boolean;
  analysisResult: VisionLogResponse | null;
  showExerciseSuggestions: boolean;
  error: VisionErrorResponse | null;
}

export interface VisionHistoryState {
  logs: VisionLogResponse[];
  isLoading: boolean;
  hasMore: boolean;
  error: VisionErrorResponse | null;
}

// Utility types for image handling
export interface ImageProcessingResult {
  uri: string;
  base64: string;
  width: number;
  height: number;
  size: number;
}

export const createEmptyMacroDistribution = (): NutritionalAnalysis['macro_distribution'] => ({
  protein_percent: 0,
  fat_percent: 0,
  carbs_percent: 0,
});

export const createEmptyVisionHistoryState = (): VisionHistoryState => ({
  logs: [],
  isLoading: false,
  hasMore: false,
  error: null,
});
