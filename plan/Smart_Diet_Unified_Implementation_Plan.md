# Smart Diet - Unified Implementation Plan
**Integrating Smart Recommendations + Smart Meal Optimization**

## 🧠 **Feature Overview**

**Smart Diet** is a unified AI-powered nutrition assistant that combines personalized food recommendations with intelligent meal plan optimizations. This integrated approach provides users with a single, comprehensive smart feature instead of separate recommendation and optimization tools.

### **Unified Value Proposition**
- **🌟 For You Today**: Personalized daily nutrition suggestions
- **⚡ Optimize Plan**: AI-powered meal plan improvements  
- **🔍 Discover Foods**: Smart food recommendations
- **📊 Diet Insights**: Nutritional gap analysis and trends

---

## 🚀 **Implementation Phases**

### **Phase 1: Backend Integration & Migration** (Week 1)

#### **1.1 Consolidate Existing Smart Recommendations**
**Current State**: Working Smart Recommendations system with 6 algorithms
**Action**: Migrate and enhance existing system as foundation

**Files to Update**:
```python
# app/services/smart_recommendations.py → app/services/smart_diet.py
class SmartDietEngine:
    def __init__(self):
        # Existing recommendation algorithms
        self.recommendation_engine = RecommendationEngine()
        # New optimization capabilities  
        self.optimization_engine = OptimizationEngine()
        # Cross-intelligence learning
        self.unified_learning = UnifiedLearningEngine()
        
    async def get_smart_suggestions(
        self, 
        user_id: str, 
        context: SmartDietContext
    ) -> List[SmartSuggestion]:
        """
        Unified suggestion engine:
        - context='today' → mix of recommendations + optimizations
        - context='optimize' → meal plan optimizations  
        - context='discover' → food recommendations
        - context='insights' → nutritional analysis + suggestions
        """
```

#### **1.2 Database Schema Migration**
**Strategy**: Evolve existing tables instead of creating new ones

```sql
-- Migration: Expand existing recommendations table
ALTER TABLE recommendations RENAME TO smart_diet_suggestions;

-- Add optimization-specific columns
ALTER TABLE smart_diet_suggestions ADD COLUMN suggestion_type TEXT DEFAULT 'recommendation' 
    CHECK (suggestion_type IN ('recommendation', 'optimization', 'insight'));
ALTER TABLE smart_diet_suggestions ADD COLUMN category TEXT
    CHECK (category IN ('discovery', 'meal_addition', 'food_swap', 'portion_adjust', 'nutritional_gap'));
ALTER TABLE smart_diet_suggestions ADD COLUMN current_item_data JSON;
ALTER TABLE smart_diet_suggestions ADD COLUMN implementation_complexity TEXT DEFAULT 'simple'
    CHECK (implementation_complexity IN ('simple', 'moderate', 'complex'));
ALTER TABLE smart_diet_suggestions ADD COLUMN planning_context TEXT DEFAULT 'discovery'
    CHECK (planning_context IN ('meal_planning', 'discovery', 'optimization', 'insights'));
ALTER TABLE smart_diet_suggestions ADD COLUMN priority_score REAL DEFAULT 0.5;

-- Migrate existing data
UPDATE smart_diet_suggestions SET 
    suggestion_type = 'recommendation',
    category = 'discovery',
    planning_context = 'discovery'
WHERE suggestion_type IS NULL;

-- Update feedback table
ALTER TABLE recommendation_feedback RENAME TO smart_diet_feedback;
ALTER TABLE smart_diet_feedback ADD COLUMN suggestion_type TEXT DEFAULT 'recommendation';

-- Update existing feedback data
UPDATE smart_diet_feedback SET suggestion_type = 'recommendation' WHERE suggestion_type IS NULL;

-- Indexes for performance
CREATE INDEX idx_smart_diet_suggestions_user_context ON smart_diet_suggestions(user_id, planning_context);
CREATE INDEX idx_smart_diet_suggestions_type_category ON smart_diet_suggestions(suggestion_type, category);
```

#### **1.3 Unified API Endpoints**
**File**: `app/routes/smart_diet.py` (rename from `smart_recommendations.py`)

```python
from fastapi import APIRouter, Depends, HTTPException
from app.services.smart_diet import SmartDietEngine
from app.models.smart_diet import SmartDietContext, SmartSuggestion, SuggestionFeedback

router = APIRouter(prefix="/smart-diet", tags=["Smart Diet"])

@router.get("/suggestions")
async def get_smart_diet_suggestions(
    context: str = "today",  # today, optimize, discover, insights
    meal_context: Optional[str] = None,  # breakfast, lunch, dinner
    limit: int = 10,
    user: User = Depends(get_current_user)
) -> List[SmartSuggestion]:
    """
    Unified endpoint for all smart diet suggestions
    Replaces: /recommendations/generate + new optimization endpoints
    """
    smart_diet = SmartDietEngine()
    
    diet_context = SmartDietContext(
        context_type=context,
        meal_context=meal_context,
        user_id=user.id,
        current_meal_plan=await get_user_current_meal_plan(user.id),
        user_preferences=await get_user_preferences(user.id)
    )
    
    suggestions = await smart_diet.get_smart_suggestions(user.id, diet_context)
    return suggestions[:limit]

@router.post("/feedback")
async def submit_smart_diet_feedback(
    suggestion_id: str,
    action: str,  # accepted, rejected, modified, saved
    feedback_reason: Optional[str] = None,
    user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """
    Unified feedback endpoint
    Replaces: /recommendations/feedback + optimization feedback
    """
    smart_diet = SmartDietEngine()
    
    feedback = SuggestionFeedback(
        suggestion_id=suggestion_id,
        user_id=user.id,
        action=action,
        feedback_reason=feedback_reason
    )
    
    await smart_diet.process_suggestion_feedback(feedback)
    return {"status": "success", "message": "Feedback recorded"}

@router.get("/insights")
async def get_diet_insights(
    period: str = "week",  # day, week, month
    user: User = Depends(get_current_user)
) -> SmartDietInsights:
    """
    New endpoint: Comprehensive diet insights and analysis
    """
    smart_diet = SmartDietEngine()
    return await smart_diet.get_diet_insights(user.id, period)

@router.post("/apply-optimization")
async def apply_optimization_suggestion(
    suggestion_id: str,
    user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """
    Apply an optimization suggestion to user's meal plan
    """
    smart_diet = SmartDietEngine()
    result = await smart_diet.apply_optimization(suggestion_id, user.id)
    return {"status": "success", "meal_plan_updated": result.meal_plan_id}
```

#### **1.4 Enhanced Data Models**
**File**: `app/models/smart_diet.py` (evolved from existing models)

```python
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum

class SuggestionType(str, Enum):
    RECOMMENDATION = "recommendation"
    OPTIMIZATION = "optimization" 
    INSIGHT = "insight"

class SuggestionCategory(str, Enum):
    DISCOVERY = "discovery"
    MEAL_ADDITION = "meal_addition"
    FOOD_SWAP = "food_swap"
    PORTION_ADJUST = "portion_adjust"
    NUTRITIONAL_GAP = "nutritional_gap"

class SmartSuggestion(BaseModel):
    """Unified model for all smart diet suggestions"""
    id: str
    user_id: str
    suggestion_type: SuggestionType
    category: SuggestionCategory
    
    # Display content
    title: str
    description: str
    reasoning: str
    
    # Nutritional impact (unified across all types)
    nutritional_benefit: Dict[str, float]  # e.g., {"protein_g": 15, "fiber_g": 4}
    calorie_impact: int = 0  # positive or negative
    macro_impact: Dict[str, float] = {}  # e.g., {"carbs_percent": -5, "protein_percent": 8}
    
    # AI confidence and priority
    confidence_score: float  # 0.0 to 1.0
    priority_score: float = 0.5  # Higher = show first
    
    # Context and targeting  
    meal_context: Optional[str] = None  # breakfast, lunch, dinner, snack
    planning_context: str  # meal_planning, discovery, optimization, insights
    
    # Implementation details
    current_item: Optional[Dict] = None  # For optimizations: what to replace
    suggested_item: Dict  # What to add/swap to
    implementation_complexity: str = "simple"  # simple, moderate, complex
    
    # Metadata
    created_at: datetime
    expires_at: Optional[datetime] = None
    tags: List[str] = []  # e.g., ["high_protein", "quick_swap", "seasonal"]

class SmartDietContext(BaseModel):
    """Context for generating smart suggestions"""
    context_type: str  # today, optimize, discover, insights
    meal_context: Optional[str] = None
    user_id: str
    current_meal_plan: Optional[Dict] = None
    user_preferences: Dict[str, Any] = {}
    recent_activity: Dict[str, Any] = {}
    time_of_day: Optional[str] = None

class SuggestionFeedback(BaseModel):
    suggestion_id: str
    user_id: str
    action: str  # accepted, rejected, modified, saved
    feedback_reason: Optional[str] = None
    implementation_notes: Optional[str] = None

class SmartDietInsights(BaseModel):
    """Comprehensive diet insights and analysis"""
    period: str
    user_id: str
    
    # Nutritional analysis
    nutritional_gaps: Dict[str, float]
    macro_trends: Dict[str, List[float]]
    calorie_trends: List[float]
    
    # Behavior insights
    eating_patterns: Dict[str, Any]
    successful_suggestions: List[SmartSuggestion]
    ignored_suggestions: List[SmartSuggestion]
    
    # Recommendations for improvement
    priority_improvements: List[str]
    suggested_changes: List[SmartSuggestion]
    
    generated_at: datetime
```

### **Phase 2: Mobile App Integration** (Week 2)

#### **2.1 Update Navigation & Branding**
**File**: `mobile/src/navigation/TabNavigator.tsx`

```tsx
// Update tab from "Smart Recs" to "Smart Diet"
const tabs = [
  { name: 'Scanner', component: BarcodeScannerScreen, icon: '📷' },
  { name: 'Upload', component: UploadLabelScreen, icon: '🏷️' },
  { name: 'Meal Plan', component: MealPlanScreen, icon: '🍽️' },
  { name: 'Track', component: TrackScreen, icon: '📊' },
  { name: 'Smart Diet', component: SmartDietScreen, icon: '🧠' }  // Updated!
];
```

#### **2.2 Unified Smart Diet Screen**
**File**: `mobile/src/screens/SmartDietScreen.tsx` (evolved from SmartRecommendationsScreen)

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SmartDietService } from '../services/SmartDietService';
import { UnifiedSuggestionCard } from '../components/SmartDiet/UnifiedSuggestionCard';
import { SmartSuggestion, SmartDietContext } from '../types/SmartDiet';

const SmartDietScreen: React.FC = () => {
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [activeContext, setActiveContext] = useState<'today' | 'optimize' | 'discover' | 'insights'>('today');
  const [loading, setLoading] = useState(true);

  const contextTabs = [
    { 
      key: 'today', 
      label: 'For You Today', 
      icon: '🌟',
      description: 'Personalized daily suggestions'
    },
    { 
      key: 'optimize', 
      label: 'Optimize Plan', 
      icon: '⚡',
      description: 'Improve your current meal plan'
    },
    { 
      key: 'discover', 
      label: 'Discover Foods', 
      icon: '🔍',
      description: 'Find new foods you\'ll love'
    },
    { 
      key: 'insights', 
      label: 'Diet Insights', 
      icon: '📊',
      description: 'Nutrition trends and analysis'
    }
  ];

  const loadSuggestions = async (context: string) => {
    setLoading(true);
    try {
      const smartSuggestions = await SmartDietService.getSmartSuggestions({
        context_type: context,
        meal_context: getCurrentMealContext(), // breakfast, lunch, dinner based on time
      });
      setSuggestions(smartSuggestions);
    } catch (error) {
      console.error('Failed to load smart diet suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions(activeContext);
  }, [activeContext]);

  const handleSuggestionFeedback = async (suggestionId: string, action: string, reason?: string) => {
    try {
      await SmartDietService.submitFeedback(suggestionId, action, reason);
      
      // Refresh suggestions after feedback
      loadSuggestions(activeContext);
      
      // Show success feedback to user
      showSuccessMessage(action === 'accepted' ? 'Applied to your plan!' : 'Thanks for the feedback!');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const getCurrentMealContext = (): string => {
    const hour = new Date().getHours();
    if (hour < 11) return 'breakfast';
    if (hour < 16) return 'lunch';
    return 'dinner';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🧠 Smart Diet</Text>
        <Text style={styles.subtitle}>Your AI nutrition assistant</Text>
      </View>

      {/* Context Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.contextTabs}
        contentContainerStyle={styles.contextTabsContent}
      >
        {contextTabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveContext(tab.key)}
            style={[
              styles.contextTab,
              activeContext === tab.key && styles.activeContextTab
            ]}
          >
            <Text style={styles.contextIcon}>{tab.icon}</Text>
            <Text style={[
              styles.contextLabel,
              activeContext === tab.key && styles.activeContextLabel
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Context Description */}
      <View style={styles.contextDescription}>
        <Text style={styles.contextDescriptionText}>
          {contextTabs.find(tab => tab.key === activeContext)?.description}
        </Text>
      </View>

      {/* Suggestions List */}
      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <UnifiedSuggestionCard
            suggestion={item}
            onFeedback={handleSuggestionFeedback}
            context={activeContext}
          />
        )}
        style={styles.suggestionsList}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={() => loadSuggestions(activeContext)}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {loading ? 'Loading smart suggestions...' : 'No suggestions available right now'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

export default SmartDietScreen;
```

#### **2.3 Unified Suggestion Card Component**
**File**: `mobile/src/components/SmartDiet/UnifiedSuggestionCard.tsx`

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { SmartSuggestion } from '../../types/SmartDiet';
import { NutritionBenefitsBar } from './NutritionBenefitsBar';

interface UnifiedSuggestionCardProps {
  suggestion: SmartSuggestion;
  onFeedback: (suggestionId: string, action: string, reason?: string) => void;
  context: string;
}

export const UnifiedSuggestionCard: React.FC<UnifiedSuggestionCardProps> = ({
  suggestion,
  onFeedback,
  context
}) => {
  
  const getSuggestionIcon = (type: string, category: string): string => {
    const iconMap = {
      'recommendation-discovery': '🔍',
      'recommendation-meal_addition': '➕', 
      'optimization-food_swap': '🔄',
      'optimization-portion_adjust': '⚖️',
      'insight-nutritional_gap': '📊'
    };
    return iconMap[`${type}-${category}`] || '💡';
  };
  
  const getCardStyle = (type: string) => {
    const styleMap = {
      'recommendation': styles.recommendationCard,
      'optimization': styles.optimizationCard,
      'insight': styles.insightCard
    };
    return styleMap[type] || styles.defaultCard;
  };
  
  const getActionButtonText = (type: string, context: string): string => {
    if (type === 'optimization') return 'Apply';
    if (context === 'discover') return 'Try This';
    return 'Add to Plan';
  };

  return (
    <View style={[styles.card, getCardStyle(suggestion.suggestion_type)]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.suggestionIcon}>
            {getSuggestionIcon(suggestion.suggestion_type, suggestion.category)}
          </Text>
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{suggestion.title}</Text>
          <View style={styles.metaInfo}>
            <Text style={styles.confidence}>
              {Math.round(suggestion.confidence_score * 100)}% confident
            </Text>
            <Text style={styles.complexity}>
              {suggestion.implementation_complexity}
            </Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.description}>{suggestion.description}</Text>
      
      {/* Reasoning */}
      <Text style={styles.reasoning}>{suggestion.reasoning}</Text>

      {/* Food Comparison (for optimizations) */}
      {suggestion.suggestion_type === 'optimization' && suggestion.current_item && (
        <View style={styles.comparison}>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>Current</Text>
            <Text style={styles.comparisonFood}>{suggestion.current_item.name}</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>Suggested</Text>
            <Text style={styles.comparisonFood}>{suggestion.suggested_item.name}</Text>
          </View>
        </View>
      )}

      {/* Nutritional Benefits */}
      <NutritionBenefitsBar 
        benefits={suggestion.nutritional_benefit}
        calorieImpact={suggestion.calorie_impact}
      />

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => onFeedback(suggestion.id, 'accepted')}
          style={[styles.actionButton, styles.primaryAction]}
        >
          <Text style={styles.primaryActionText}>
            {getActionButtonText(suggestion.suggestion_type, context)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onFeedback(suggestion.id, 'saved')}
          style={[styles.actionButton, styles.secondaryAction]}
        >
          <Text style={styles.secondaryActionText}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onFeedback(suggestion.id, 'rejected', 'not_interested')}
          style={[styles.actionButton, styles.tertiaryAction]}
        >
          <Text style={styles.tertiaryActionText}>Not Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
```

#### **2.4 Updated Service Layer**
**File**: `mobile/src/services/SmartDietService.ts` (evolved from existing)

```tsx
import { ApiService } from './ApiService';
import { SmartSuggestion, SmartDietContext, SmartDietInsights } from '../types/SmartDiet';

export class SmartDietService {
  static async getSmartSuggestions(context: {
    context_type: string;
    meal_context?: string;
    limit?: number;
  }): Promise<SmartSuggestion[]> {
    try {
      const response = await ApiService.get('/smart-diet/suggestions', {
        params: {
          context: context.context_type,
          meal_context: context.meal_context,
          limit: context.limit || 10
        }
      });
      return response.data;
    } catch (error) {
      console.error('Smart Diet Service - Failed to get suggestions:', error);
      throw error;
    }
  }

  static async submitFeedback(
    suggestionId: string, 
    action: string, 
    reason?: string
  ): Promise<void> {
    try {
      await ApiService.post('/smart-diet/feedback', {
        suggestion_id: suggestionId,
        action,
        feedback_reason: reason
      });
    } catch (error) {
      console.error('Smart Diet Service - Failed to submit feedback:', error);
      throw error;
    }
  }

  static async getDietInsights(period: string = 'week'): Promise<SmartDietInsights> {
    try {
      const response = await ApiService.get('/smart-diet/insights', {
        params: { period }
      });
      return response.data;
    } catch (error) {
      console.error('Smart Diet Service - Failed to get insights:', error);
      throw error;
    }
  }

  static async applyOptimization(suggestionId: string): Promise<{ meal_plan_id: string }> {
    try {
      const response = await ApiService.post('/smart-diet/apply-optimization', {
        suggestion_id: suggestionId
      });
      return response.data;
    } catch (error) {
      console.error('Smart Diet Service - Failed to apply optimization:', error);
      throw error;
    }
  }

  // Legacy method support during migration
  static async getRecommendations(params: any): Promise<SmartSuggestion[]> {
    console.warn('getRecommendations is deprecated. Use getSmartSuggestions instead.');
    return this.getSmartSuggestions({
      context_type: 'discover',
      ...params
    });
  }
}
```

### **Phase 3: Testing & Validation** (Week 2-3)

#### **3.1 Backend Testing**
```python
# tests/test_smart_diet.py
import pytest
from app.services.smart_diet import SmartDietEngine
from app.models.smart_diet import SmartDietContext, SmartSuggestion

class TestSmartDietEngine:
    @pytest.fixture
    def smart_diet_engine(self):
        return SmartDietEngine()
    
    @pytest.fixture
    def sample_context(self):
        return SmartDietContext(
            context_type="today",
            user_id="test_user_id",
            meal_context="breakfast"
        )
    
    async def test_get_smart_suggestions_today_context(self, smart_diet_engine, sample_context):
        suggestions = await smart_diet_engine.get_smart_suggestions("test_user_id", sample_context)
        
        assert len(suggestions) > 0
        assert all(isinstance(s, SmartSuggestion) for s in suggestions)
        # Should include both recommendations and optimizations for "today" context
        suggestion_types = {s.suggestion_type for s in suggestions}
        assert len(suggestion_types) >= 1  # At least one type of suggestion
    
    async def test_optimization_context(self, smart_diet_engine):
        context = SmartDietContext(
            context_type="optimize",
            user_id="test_user_id"
        )
        
        suggestions = await smart_diet_engine.get_smart_suggestions("test_user_id", context)
        
        # Optimize context should primarily return optimization suggestions
        optimization_suggestions = [s for s in suggestions if s.suggestion_type == "optimization"]
        assert len(optimization_suggestions) > 0
    
    async def test_discover_context(self, smart_diet_engine):
        context = SmartDietContext(
            context_type="discover",
            user_id="test_user_id"
        )
        
        suggestions = await smart_diet_engine.get_smart_suggestions("test_user_id", context)
        
        # Discover context should primarily return recommendation suggestions
        recommendation_suggestions = [s for s in suggestions if s.suggestion_type == "recommendation"]
        assert len(recommendation_suggestions) > 0

    async def test_feedback_processing(self, smart_diet_engine):
        # Test that feedback is processed and affects future suggestions
        feedback = SuggestionFeedback(
            suggestion_id="test_suggestion",
            user_id="test_user_id",
            action="accepted"
        )
        
        result = await smart_diet_engine.process_suggestion_feedback(feedback)
        assert result is not None
```

#### **3.2 Frontend Testing**
```tsx
// mobile/src/__tests__/SmartDietScreen.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SmartDietScreen from '../screens/SmartDietScreen';
import { SmartDietService } from '../services/SmartDietService';

// Mock the service
jest.mock('../services/SmartDietService');

const mockSuggestions = [
  {
    id: '1',
    suggestion_type: 'recommendation',
    category: 'discovery',
    title: 'Try Greek Yogurt',
    description: 'High protein breakfast option',
    reasoning: 'Matches your protein goals',
    confidence_score: 0.85,
    nutritional_benefit: { protein_g: 15 },
    calorie_impact: 120
  },
  {
    id: '2', 
    suggestion_type: 'optimization',
    category: 'food_swap',
    title: 'Swap White Rice for Quinoa',
    description: 'Increase protein and fiber',
    reasoning: 'Better nutritional profile',
    confidence_score: 0.78,
    nutritional_benefit: { protein_g: 4, fiber_g: 2 },
    calorie_impact: 10
  }
];

describe('SmartDietScreen', () => {
  beforeEach(() => {
    (SmartDietService.getSmartSuggestions as jest.Mock).mockResolvedValue(mockSuggestions);
  });

  it('renders Smart Diet header correctly', async () => {
    const { getByText } = render(<SmartDietScreen />);
    
    expect(getByText('🧠 Smart Diet')).toBeTruthy();
    expect(getByText('Your AI nutrition assistant')).toBeTruthy();
  });

  it('displays context tabs', async () => {
    const { getByText } = render(<SmartDietScreen />);
    
    expect(getByText('For You Today')).toBeTruthy();
    expect(getByText('Optimize Plan')).toBeTruthy();
    expect(getByText('Discover Foods')).toBeTruthy();
    expect(getByText('Diet Insights')).toBeTruthy();
  });

  it('loads suggestions on mount', async () => {
    render(<SmartDietScreen />);
    
    await waitFor(() => {
      expect(SmartDietService.getSmartSuggestions).toHaveBeenCalledWith({
        context_type: 'today',
        meal_context: expect.any(String)
      });
    });
  });

  it('switches context when tab pressed', async () => {
    const { getByText } = render(<SmartDietScreen />);
    
    fireEvent.press(getByText('Optimize Plan'));
    
    await waitFor(() => {
      expect(SmartDietService.getSmartSuggestions).toHaveBeenCalledWith({
        context_type: 'optimize',
        meal_context: expect.any(String)
      });
    });
  });

  it('displays suggestion cards', async () => {
    const { getByText } = render(<SmartDietScreen />);
    
    await waitFor(() => {
      expect(getByText('Try Greek Yogurt')).toBeTruthy();
      expect(getByText('Swap White Rice for Quinoa')).toBeTruthy();
    });
  });
});
```

---

## 📊 **Migration & Deployment Strategy**

### **Migration Timeline**
**Week 1**: Backend consolidation and API updates
**Week 2**: Mobile app integration and testing  
**Week 3**: User testing, bug fixes, and deployment

### **Backward Compatibility**
- Keep existing `/recommendations/*` endpoints active during migration
- Add deprecation warnings to old endpoints
- Gradual migration of mobile app from old to new service calls

### **Feature Flags**
```python
# Feature flag for gradual rollout
SMART_DIET_ENABLED = os.getenv('SMART_DIET_ENABLED', 'false').lower() == 'true'

if SMART_DIET_ENABLED:
    # Use new unified Smart Diet engine
    return await smart_diet_engine.get_smart_suggestions(user_id, context)
else:
    # Use legacy recommendation system
    return await recommendation_engine.get_recommendations(user_id, preferences)
```

### **Performance Considerations**
- **Response Time Target**: <500ms for all suggestion types
- **Cache Strategy**: 
  - "Today" suggestions: 30 minutes TTL
  - "Optimize" suggestions: 15 minutes TTL  
  - "Discover" suggestions: 2 hours TTL
  - "Insights" data: 24 hours TTL
- **Database Optimization**: Indexes on user_id, context, and suggestion_type

---

## ✅ **Success Metrics**

### **Technical KPIs**
- [ ] API response time < 500ms (95th percentile)
- [ ] Mobile app suggestion load time < 2 seconds
- [ ] Zero breaking changes to existing functionality
- [ ] Database migration completed without data loss

### **User Experience KPIs**
- [ ] Suggestion acceptance rate > 65% (target: 75%)
- [ ] User engagement with Smart Diet tab > current Smart Recs
- [ ] Feature discovery rate > 80% (users find and use multiple contexts)
- [ ] User satisfaction rating > 4.0/5.0

### **Business Impact KPIs**
- [ ] Increase in daily active users interacting with AI features
- [ ] Reduction in user churn rate
- [ ] Improved user retention (7-day, 30-day)
- [ ] Higher meal plan completion rates

---

## 🚀 **Ready for Implementation**

This unified Smart Diet approach provides:

1. **Seamless User Experience**: Single AI assistant instead of multiple tools
2. **Technical Efficiency**: Consolidated codebase and shared infrastructure  
3. **Enhanced AI Learning**: Cross-feature feedback improves all suggestions
4. **Future-Proof Architecture**: Foundation for additional AI features
5. **Clear Value Proposition**: Comprehensive AI nutrition assistant

**Implementation can begin immediately** with Phase 1 backend consolidation, leveraging the existing Smart Recommendations system as the foundation.

---

*Unified Implementation Plan Created: September 4, 2025*  
*Status: Ready for Development*  
*Estimated Timeline: 2-3 weeks*  
*Risk Level: Low (builds on proven systems)*