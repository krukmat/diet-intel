/**
 * Smart Diet Service - Mobile API Integration
 * High-performance mobile service layer integrating with Phase 9.1 optimized backend
 * 
 * Features:
 * - Context-aware Smart Diet suggestions (Today/Optimize/Discover/Insights)
 * - Mobile-optimized caching with AsyncStorage
 * - Comprehensive error handling and offline support
 * - TypeScript-first design with full type safety
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './ApiService';
import { API_BASE_URL } from '../config/environment';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export enum SmartDietContext {
  TODAY = 'today',
  OPTIMIZE = 'optimize', 
  DISCOVER = 'discover',
  INSIGHTS = 'insights'
}

export enum SuggestionType {
  RECOMMENDATION = 'recommendation',
  OPTIMIZATION = 'optimization',
  INSIGHT = 'insight'
}

export enum SuggestionCategory {
  DISCOVERY = 'discovery',
  MEAL_ADDITION = 'meal_addition',
  FOOD_SWAP = 'food_swap',
  PORTION_ADJUST = 'portion_adjust',
  NUTRITIONAL_GAP = 'nutritional_gap'
}

export interface SmartSuggestion {
  id: string;
  user_id?: string;
  suggestion_type: SuggestionType;
  category: SuggestionCategory;
  title: string;
  description: string;
  reasoning: string;
  suggested_item: Record<string, any>;
  current_item?: Record<string, any>;
  nutritional_benefit: Record<string, number>;
  calorie_impact: number;
  macro_impact: Record<string, number>;
  confidence_score: number;
  priority_score: number;
  meal_context?: string;
  planning_context: SmartDietContext;
  implementation_complexity: 'simple' | 'moderate' | 'complex';
  implementation_notes?: string;
  created_at: string;
  expires_at?: string;
  tags: string[];
}

export interface SmartDietRequest {
  user_id?: string;
  context_type: SmartDietContext;
  meal_context?: string;
  current_meal_plan_id?: string;
  dietary_restrictions: string[];
  cuisine_preferences: string[];
  excluded_ingredients: string[];
  target_macros?: Record<string, number>;
  calorie_budget?: number;
  max_suggestions: number;
  min_confidence: number;
  include_optimizations: boolean;
  include_recommendations: boolean;
  lang: string;
}

export interface SmartDietResponse {
  user_id?: string;
  context_type: SmartDietContext;
  generated_at: string;
  suggestions: SmartSuggestion[];
  today_highlights: SmartSuggestion[];
  optimizations: SmartSuggestion[];
  discoveries: SmartSuggestion[];
  insights: SmartSuggestion[];
  nutritional_summary: Record<string, any>;
  personalization_factors: string[];
  total_suggestions: number;
  avg_confidence: number;
  generation_time_ms?: number;
}

export interface SuggestionFeedback {
  suggestion_id: string;
  user_id: string;
  action: 'accepted' | 'rejected' | 'saved' | 'modified';
  feedback_reason?: string;
  implementation_notes?: string;
  satisfaction_rating?: number; // 1-5
  meal_context?: string;
  used_at?: string;
}

export interface SmartDietInsights {
  period: string;
  user_id: string;
  analysis_date: string;
  nutritional_gaps: Record<string, number>;
  macro_trends: Record<string, number[]>;
  calorie_trends: number[];
  eating_patterns: Record<string, any>;
  successful_suggestions: SmartSuggestion[];
  ignored_suggestions: SmartSuggestion[];
  priority_improvements: string[];
  suggested_changes: SmartSuggestion[];
  goal_progress: Record<string, number>;
  improvement_score: number;
}

export interface OptimizationSuggestion extends SmartSuggestion {
  optimization_type: string;
  target_improvement: Record<string, number>;
  current_meal_analysis?: Record<string, any>;
}

// ==========================================
// CACHE CONFIGURATION
// ==========================================

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  key: string;
}

const CACHE_CONFIG: Record<SmartDietContext, CacheConfig> = {
  [SmartDietContext.TODAY]: {
    ttl: 30 * 60 * 1000, // 30 minutes
    key: 'smart_diet_today'
  },
  [SmartDietContext.OPTIMIZE]: {
    ttl: 15 * 60 * 1000, // 15 minutes
    key: 'smart_diet_optimize'
  },
  [SmartDietContext.DISCOVER]: {
    ttl: 2 * 60 * 60 * 1000, // 2 hours
    key: 'smart_diet_discover'
  },
  [SmartDietContext.INSIGHTS]: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    key: 'smart_diet_insights'
  }
};

// ==========================================
// SMART DIET SERVICE CLASS
// ==========================================

export class SmartDietService {
  private static instance: SmartDietService;
  private baseURL: string;

  private constructor() {
    this.baseURL = `${API_BASE_URL}/smart-diet`;
  }

  public static getInstance(): SmartDietService {
    if (!SmartDietService.instance) {
      SmartDietService.instance = new SmartDietService();
    }
    return SmartDietService.instance;
  }

  // ==========================================
  // CORE API METHODS
  // ==========================================

  /**
   * Get Smart Diet suggestions with context-aware caching
   */
  async getSmartSuggestions(
    context: SmartDietContext,
    userId: string,
    options: Partial<SmartDietRequest> = {}
  ): Promise<SmartDietResponse> {
    try {
      // Try cache first for performance
      const cachedResponse = await this.getCachedSuggestions(context, userId);
      if (cachedResponse) {
        console.log(`🎯 Smart Diet cache hit for context: ${context}`);
        return cachedResponse;
      }

      // Build request with defaults
      const request: SmartDietRequest = {
        user_id: userId,
        context_type: context,
        dietary_restrictions: [],
        cuisine_preferences: [],
        excluded_ingredients: [],
        max_suggestions: 10,
        min_confidence: 0.3,
        include_optimizations: true,
        include_recommendations: true,
        lang: 'en',
        ...options
      };

      console.log(`🧠 Fetching Smart Diet suggestions for context: ${context}`);
      const startTime = Date.now();

      const response = await apiService.post(`${this.baseURL}/suggestions`, request);
      
      const endTime = Date.now();
      console.log(`⚡ Smart Diet API response time: ${endTime - startTime}ms`);

      // Cache the response
      await this.setCachedSuggestions(context, userId, response.data);

      return response.data as SmartDietResponse;

    } catch (error) {
      console.error('❌ Error fetching Smart Diet suggestions:', error);
      
      // Try to return cached data as fallback
      const fallbackCache = await this.getCachedSuggestions(context, userId, true);
      if (fallbackCache) {
        console.log('🔄 Returning fallback cached Smart Diet data');
        return fallbackCache;
      }

      throw new Error(`Failed to fetch Smart Diet suggestions: ${error}`);
    }
  }

  /**
   * Submit user feedback on suggestions
   */
  async submitSuggestionFeedback(feedback: SuggestionFeedback): Promise<void> {
    try {
      console.log(`💬 Submitting Smart Diet feedback for suggestion: ${feedback.suggestion_id}`);
      
      await apiService.post(`${this.baseURL}/feedback`, feedback);
      
      // Invalidate cache for this user to refresh personalization
      await this.invalidateUserCache(feedback.user_id);
      
      console.log('✅ Smart Diet feedback submitted successfully');
    } catch (error) {
      console.error('❌ Error submitting Smart Diet feedback:', error);
      throw new Error(`Failed to submit feedback: ${error}`);
    }
  }

  /**
   * Get comprehensive diet insights
   */
  async getDietInsights(userId: string, period: string = 'week'): Promise<SmartDietInsights> {
    try {
      const cacheKey = `insights_${userId}_${period}`;
      const cachedInsights = await this.getCachedData(cacheKey);
      
      if (cachedInsights) {
        console.log(`📊 Smart Diet insights cache hit for period: ${period}`);
        return cachedInsights as SmartDietInsights;
      }

      console.log(`📈 Fetching Smart Diet insights for period: ${period}`);
      
      const response = await apiService.get(`${this.baseURL}/insights`, {
        params: { user_id: userId, period }
      });

      // Cache insights for 24 hours
      await this.setCachedData(cacheKey, response.data, CACHE_CONFIG[SmartDietContext.INSIGHTS].ttl);

      return response.data as SmartDietInsights;

    } catch (error) {
      console.error('❌ Error fetching Smart Diet insights:', error);
      throw new Error(`Failed to fetch insights: ${error}`);
    }
  }

  /**
   * Optimize meal plan with Smart Diet suggestions
   */
  async optimizeMealPlan(planId: string): Promise<OptimizationSuggestion[]> {
    try {
      console.log(`🎯 Optimizing meal plan: ${planId}`);
      
      const response = await apiService.post(`${this.baseURL}/apply-optimization`, {
        suggestion_id: planId
      });

      console.log('✅ Meal plan optimization completed');
      return response.data.optimizations || [];

    } catch (error) {
      console.error('❌ Error optimizing meal plan:', error);
      throw new Error(`Failed to optimize meal plan: ${error}`);
    }
  }

  // ==========================================
  // CACHING METHODS
  // ==========================================

  /**
   * Get cached suggestions with optional fallback to expired cache
   */
  private async getCachedSuggestions(
    context: SmartDietContext, 
    userId: string, 
    allowExpired: boolean = false
  ): Promise<SmartDietResponse | null> {
    try {
      const cacheKey = `${CACHE_CONFIG[context].key}_${userId}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedData) return null;

      const { data, timestamp } = JSON.parse(cachedData);
      const age = Date.now() - timestamp;
      const ttl = CACHE_CONFIG[context].ttl;

      // Return if not expired or if expired data is allowed as fallback
      if (age < ttl || allowExpired) {
        return data as SmartDietResponse;
      }

      return null;

    } catch (error) {
      console.error('Error reading Smart Diet cache:', error);
      return null;
    }
  }

  /**
   * Cache Smart Diet suggestions with timestamp
   */
  private async setCachedSuggestions(
    context: SmartDietContext, 
    userId: string, 
    data: SmartDietResponse
  ): Promise<void> {
    try {
      const cacheKey = `${CACHE_CONFIG[context].key}_${userId}`;
      const cacheData = {
        data,
        timestamp: Date.now()
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`💾 Cached Smart Diet ${context} data for user ${userId}`);

    } catch (error) {
      console.error('Error caching Smart Diet data:', error);
    }
  }

  /**
   * Generic cache getter with expiration check
   */
  private async getCachedData(key: string): Promise<any | null> {
    try {
      const cachedData = await AsyncStorage.getItem(key);
      if (!cachedData) return null;

      const { data, timestamp } = JSON.parse(cachedData);
      const age = Date.now() - timestamp;
      
      // Use insights TTL for generic cache
      if (age < CACHE_CONFIG[SmartDietContext.INSIGHTS].ttl) {
        return data;
      }

      return null;

    } catch (error) {
      console.error('Error reading generic cache:', error);
      return null;
    }
  }

  /**
   * Generic cache setter with timestamp
   */
  private async setCachedData(key: string, data: any, ttl?: number): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };

      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
      console.log(`💾 Cached data with key: ${key}`);

    } catch (error) {
      console.error('Error setting cache data:', error);
    }
  }

  /**
   * Invalidate all cached data for a user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const keysToRemove: string[] = [];

      // Add all context-specific cache keys
      Object.values(SmartDietContext).forEach(context => {
        keysToRemove.push(`${CACHE_CONFIG[context].key}_${userId}`);
      });

      // Add insights cache keys
      ['day', 'week', 'month'].forEach(period => {
        keysToRemove.push(`insights_${userId}_${period}`);
      });

      await AsyncStorage.multiRemove(keysToRemove);
      console.log(`🗑️  Invalidated Smart Diet cache for user ${userId}`);

    } catch (error) {
      console.error('Error invalidating Smart Diet cache:', error);
    }
  }

  /**
   * Get cache statistics and health
   */
  async getCacheStats(userId: string): Promise<Record<string, any>> {
    const stats: Record<string, any> = {
      userId,
      contexts: {},
      insights: {},
      timestamp: new Date().toISOString()
    };

    try {
      // Check each context cache
      for (const context of Object.values(SmartDietContext)) {
        const cacheKey = `${CACHE_CONFIG[context].key}_${userId}`;
        const cachedData = await AsyncStorage.getItem(cacheKey);
        
        if (cachedData) {
          const { timestamp } = JSON.parse(cachedData);
          const age = Date.now() - timestamp;
          const ttl = CACHE_CONFIG[context].ttl;
          
          stats.contexts[context] = {
            exists: true,
            age_ms: age,
            ttl_ms: ttl,
            expired: age > ttl,
            age_readable: this.formatDuration(age)
          };
        } else {
          stats.contexts[context] = { exists: false };
        }
      }

      return stats;

    } catch (error) {
      console.error('Error getting cache stats:', error);
      return stats;
    }
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

// ==========================================
// SINGLETON EXPORT
// ==========================================

export const smartDietService = SmartDietService.getInstance();