import { apiService } from './ApiService';

export type FlowStepStatus = 'success' | 'skipped' | 'error';
export type FlowExecutionStatus = 'complete' | 'partial' | 'failed';

export interface FlowStepTiming {
  started_at: string;
  duration_ms: number;
  status: FlowStepStatus;
  error_message?: string;
}

export interface FlowMetadata {
  user_id: string;
  meal_type: string;
  total_duration_ms: number;
  warnings: string[];
}

export interface IntelligentFlowRecipePreferences {
  cuisine_preferences?: string[];
  dietary_restrictions?: string[];
  difficulty_preference?: string;
  meal_type?: string;
  servings?: number;
  target_calories_per_serving?: number | null;
  target_protein_g?: number | null;
  target_carbs_g?: number | null;
  target_fat_g?: number | null;
  max_prep_time_minutes?: number | null;
  max_cook_time_minutes?: number | null;
  preferred_ingredients?: string[];
  excluded_ingredients?: string[];
  include_identified_ingredients?: boolean;
}

export interface IntelligentFlowSmartDietConfig {
  context_type?: string;
  meal_context?: string | null;
  include_optimizations?: boolean;
  include_recommendations?: boolean;
  max_suggestions?: number;
  min_confidence?: number;
  dietary_restrictions?: string[];
  cuisine_preferences?: string[];
  excluded_ingredients?: string[];
  calorie_budget?: number | null;
  lang?: string;
}

export interface IntelligentFlowRequestPayload {
  image_base64: string;
  meal_type?: string;
  user_context?: Record<string, any> | null;
  recipe_preferences?: IntelligentFlowRecipePreferences | null;
  smart_diet_config?: IntelligentFlowSmartDietConfig | null;
}

export interface VisionLogResponse {
  id: string;
  user_id: string;
  meal_type: string;
  identified_ingredients: Array<Record<string, any>>;
  estimated_portions: Record<string, any>;
  nutritional_analysis: Record<string, any>;
  exercise_suggestions: Array<Record<string, any>>;
  created_at: string;
  processing_time_ms: number;
}

export interface GeneratedRecipeResponse {
  id: string;
  name: string;
  description: string;
  cuisine_type: string;
  difficulty_level: string;
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: number;
  ingredients: Array<Record<string, any>>;
  instructions: Array<Record<string, any>>;
  nutrition?: Record<string, any>;
  created_by: string;
  confidence_score: number;
  generation_time_ms?: number;
  tags: string[];
  personalization?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

export interface SmartDietResponse {
  user_id?: string;
  context_type?: string;
  generated_at?: string;
  suggestions: Array<Record<string, any>>;
  today_highlights: Array<Record<string, any>>;
  optimizations: Array<Record<string, any>>;
  discoveries: Array<Record<string, any>>;
  insights: Array<Record<string, any>>;
  nutritional_summary: Record<string, any>;
  personalization_factors: string[];
  total_suggestions: number;
  avg_confidence: number;
  generation_time_ms?: number;
}

export interface IntelligentFlowResponse {
  status: FlowExecutionStatus;
  vision_result: VisionLogResponse;
  recipe_result?: GeneratedRecipeResponse | null;
  smart_diet_result?: SmartDietResponse | null;
  timings: Record<string, FlowStepTiming>;
  metadata: FlowMetadata;
}

export interface IntelligentFlowJobStatus {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  result?: IntelligentFlowResponse | null;
  error?: string | null;
}

class IntelligentFlowService {
  private static instance: IntelligentFlowService;

  static getInstance(): IntelligentFlowService {
    if (!IntelligentFlowService.instance) {
      IntelligentFlowService.instance = new IntelligentFlowService();
    }
    return IntelligentFlowService.instance;
  }

  async runFlow(payload: IntelligentFlowRequestPayload): Promise<IntelligentFlowResponse> {
    const response = await apiService.post<IntelligentFlowResponse>('/intelligent-flow', payload);
    return response.data;
  }

  async startFlow(payload: IntelligentFlowRequestPayload): Promise<IntelligentFlowJobStatus> {
    const response = await apiService.post<IntelligentFlowJobStatus>('/intelligent-flow?async_mode=true', payload);
    return response.data;
  }

  async getJobStatus(jobId: string): Promise<IntelligentFlowJobStatus> {
    const response = await apiService.get<IntelligentFlowJobStatus>(`/intelligent-flow/${jobId}`);
    return response.data;
  }
}

export const intelligentFlowService = IntelligentFlowService.getInstance();

export { IntelligentFlowService };
