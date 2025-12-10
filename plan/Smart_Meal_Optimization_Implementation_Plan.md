# Smart Meal Optimization - Implementation Plan

## 🎯 Feature Overview

**Smart Meal Optimization** analyzes existing meal plans and suggests intelligent micro-optimizations to improve nutritional outcomes while maintaining user preferences and meal satisfaction.

### Example Optimizations:
- "Swap white rice for quinoa to increase protein by 15% and add 4g fiber"
- "Add 50g spinach to hit your daily iron target"
- "Replace 2% milk with almond milk to reduce calories by 60 while maintaining calcium"
- "Switch chicken breast for salmon to boost omega-3 fatty acids"

---

## 📋 Implementation Phases

### **Phase 1: Backend Algorithm Development** (Week 1)

#### 1.1 Create Optimization Engine
**File**: `app/services/meal_optimizer.py`

```python
class MealOptimizer:
    def __init__(self):
        self.optimization_rules = []
        self.nutritional_database = {}
        
    def analyze_meal_plan(self, meal_plan: MealPlan, user_profile: UserProfile) -> List[OptimizationSuggestion]
    def calculate_nutritional_gaps(self, current_nutrition: dict, target_nutrition: dict) -> dict
    def find_food_swaps(self, current_food: dict, optimization_goals: List[str]) -> List[FoodSwap]
    def score_optimization(self, swap: FoodSwap, user_preferences: UserPreferences) -> float
```

#### 1.2 Database Schema Updates
**File**: `app/models/meal_optimization.py`

```python
class OptimizationSuggestion(BaseModel):
    id: str
    meal_plan_id: str
    user_id: str
    optimization_type: str  # "swap", "add", "adjust_portion"
    current_item: dict
    suggested_item: dict
    nutritional_benefit: dict
    confidence_score: float
    reasoning: str
    calories_impact: int
    macro_impact: dict
    created_at: datetime
    
class OptimizationFeedback(BaseModel):
    suggestion_id: str
    user_id: str
    action: str  # "accepted", "rejected", "modified"
    feedback_reason: str
    implemented_at: datetime
```

#### 1.3 API Endpoints
**File**: `app/routes/meal_optimization.py`

```python
@router.post("/meal-plan/{meal_plan_id}/optimize")
async def get_optimization_suggestions(meal_plan_id: str, user: User = Depends(get_current_user))

@router.post("/optimization/{suggestion_id}/accept")
async def accept_optimization(suggestion_id: str, user: User = Depends(get_current_user))

@router.post("/optimization/{suggestion_id}/reject") 
async def reject_optimization(suggestion_id: str, feedback: str, user: User = Depends(get_current_user))

@router.get("/optimization/history")
async def get_optimization_history(user: User = Depends(get_current_user))
```

### **Phase 2: Optimization Algorithm Logic** (Week 1-2)

#### 2.1 Core Optimization Categories

**Nutritional Gap Filling**
- Identify micro/macro nutrient deficiencies
- Suggest minimal-impact additions or swaps
- Priority: Protein, Fiber, Essential vitamins/minerals

**Calorie Optimization**
- Smart calorie reductions without sacrificing nutrition
- Portion size adjustments with nutritional density focus
- Volume-based satiety improvements

**Macro Balancing**
- Real-time macro target achievement
- Intelligent carb/protein/fat distribution
- Meal timing optimization

#### 2.2 Optimization Rules Engine
```python
OPTIMIZATION_RULES = [
    {
        "name": "protein_boost",
        "condition": lambda nutrition: nutrition.get("protein_g", 0) < target_protein * 0.9,
        "suggestions": [
            {"swap": "white_rice", "to": "quinoa", "benefit": "+4g protein per 100g"},
            {"add": "greek_yogurt", "amount": "100g", "benefit": "+15g protein"}
        ]
    },
    {
        "name": "fiber_increase",
        "condition": lambda nutrition: nutrition.get("fiber_g", 0) < 25,
        "suggestions": [
            {"swap": "white_bread", "to": "whole_grain", "benefit": "+2g fiber per slice"},
            {"add": "chia_seeds", "amount": "15g", "benefit": "+5g fiber"}
        ]
    },
    {
        "name": "calorie_reduction",
        "condition": lambda nutrition, target: nutrition.get("calories", 0) > target * 1.1,
        "suggestions": [
            {"swap": "2%_milk", "to": "almond_milk", "benefit": "-60 calories per cup"},
            {"reduce_portion": "rice", "by": "25%", "benefit": "-50 calories"}
        ]
    }
]
```

#### 2.3 Smart Swap Database
```python
FOOD_SWAPS = {
    "white_rice": {
        "alternatives": [
            {"food": "quinoa", "protein_boost": 4, "fiber_boost": 2, "calories_diff": +10},
            {"food": "cauliflower_rice", "carb_reduction": 20, "calories_diff": -150},
            {"food": "brown_rice", "fiber_boost": 3, "minerals_boost": ["magnesium", "selenium"]}
        ]
    },
    "chicken_breast": {
        "alternatives": [
            {"food": "salmon", "omega3_boost": 1.8, "calories_diff": +50, "benefit": "heart_health"},
            {"food": "lean_turkey", "calories_diff": -20, "selenium_boost": 0.3},
            {"food": "tofu", "plant_protein": 15, "calories_diff": -50, "benefit": "plant_based"}
        ]
    }
}
```

### **Phase 3: Mobile App Integration** (Week 2)

#### 3.1 UI Components
**File**: `mobile/src/components/MealOptimization/OptimizationCard.tsx`

```tsx
interface OptimizationCardProps {
  suggestion: OptimizationSuggestion;
  onAccept: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}

const OptimizationCard: React.FC<OptimizationCardProps> = ({ suggestion, onAccept, onReject }) => {
  return (
    <View style={styles.optimizationCard}>
      <View style={styles.header}>
        <Text style={styles.optimizationType}>{suggestion.optimization_type}</Text>
        <Text style={styles.confidenceScore}>{Math.round(suggestion.confidence_score * 100)}%</Text>
      </View>
      
      <View style={styles.swapContainer}>
        <FoodItem item={suggestion.current_item} label="Current" />
        <Icon name="arrow-right" />
        <FoodItem item={suggestion.suggested_item} label="Suggested" />
      </View>
      
      <View style={styles.benefits}>
        <Text style={styles.reasoning}>{suggestion.reasoning}</Text>
        <NutritionalImpact impact={suggestion.nutritional_benefit} />
      </View>
      
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => onAccept(suggestion.id)} style={styles.acceptButton}>
          <Text>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onReject(suggestion.id, '')} style={styles.rejectButton}>
          <Text>Not Interested</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
```

#### 3.2 Optimization Screen
**File**: `mobile/src/screens/MealOptimizationScreen.tsx`

```tsx
const MealOptimizationScreen: React.FC = () => {
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [optimizations, setOptimizations] = useState<OptimizationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOptimizations = async () => {
    try {
      const suggestions = await ApiService.getMealOptimizations(mealPlan.id);
      setOptimizations(suggestions);
    } catch (error) {
      console.error('Failed to fetch optimizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOptimization = async (suggestionId: string) => {
    await ApiService.acceptOptimization(suggestionId);
    // Update meal plan and refresh optimizations
    fetchOptimizations();
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Smart Meal Optimization</Text>
      <Text style={styles.subtitle}>Improve your meal plan with AI-powered suggestions</Text>
      
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={optimizations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OptimizationCard
              suggestion={item}
              onAccept={handleAcceptOptimization}
              onReject={handleRejectOptimization}
            />
          )}
        />
      )}
    </ScrollView>
  );
};
```

### **Phase 4: Integration with Existing Systems** (Week 2)

#### 4.1 Meal Plan Screen Integration
- Add "Optimize" button to existing meal plans
- Show optimization suggestions as expandable cards
- Real-time optimization during meal planning

#### 4.2 Smart Recommendations Enhancement
- Integrate optimization logic with existing recommendation engine
- Cross-reference user preferences and optimization history
- Improve recommendation confidence scoring

#### 4.3 Navigation Updates
- Add optimization access from Meal Plan screen
- New "Optimize" action in meal plan context menu
- Notification system for new optimization suggestions

---

## 🛠️ Technical Implementation Details

### **Database Changes**
```sql
-- New tables for meal optimization
CREATE TABLE meal_optimizations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    meal_plan_id TEXT NOT NULL,
    optimization_type TEXT NOT NULL,
    current_item_data JSON NOT NULL,
    suggested_item_data JSON NOT NULL,
    nutritional_benefit JSON NOT NULL,
    confidence_score REAL NOT NULL,
    reasoning TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, accepted, rejected
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (meal_plan_id) REFERENCES meal_plans (id)
);

CREATE TABLE optimization_feedback (
    id TEXT PRIMARY KEY,
    optimization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL, -- accepted, rejected, modified
    feedback_reason TEXT,
    implemented_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (optimization_id) REFERENCES meal_optimizations (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Indexes for performance
CREATE INDEX idx_meal_optimizations_user_id ON meal_optimizations(user_id);
CREATE INDEX idx_meal_optimizations_meal_plan_id ON meal_optimizations(meal_plan_id);
CREATE INDEX idx_optimization_feedback_user_id ON optimization_feedback(user_id);
```

### **API Service Updates**
```typescript
// mobile/src/services/ApiService.ts
class ApiService {
  // ... existing methods

  static async getMealOptimizations(mealPlanId: string): Promise<OptimizationSuggestion[]> {
    const response = await this.apiClient.post(`/meal-plan/${mealPlanId}/optimize`);
    return response.data;
  }

  static async acceptOptimization(suggestionId: string): Promise<void> {
    await this.apiClient.post(`/optimization/${suggestionId}/accept`);
  }

  static async rejectOptimization(suggestionId: string, reason: string): Promise<void> {
    await this.apiClient.post(`/optimization/${suggestionId}/reject`, { feedback_reason: reason });
  }

  static async getOptimizationHistory(): Promise<OptimizationSuggestion[]> {
    const response = await this.apiClient.get('/optimization/history');
    return response.data;
  }
}
```

---

## 📊 Success Metrics & Testing

### **Phase 1 Success Criteria**
- [ ] Backend API endpoints return optimization suggestions in <500ms
- [ ] Algorithm identifies at least 2-3 meaningful optimizations per meal plan
- [ ] Database schema handles concurrent optimization requests

### **Phase 2 Success Criteria**
- [ ] Optimization suggestions have >80% accuracy for nutritional benefits
- [ ] User acceptance rate >60% in initial testing
- [ ] No performance degradation on existing meal planning features

### **Phase 3 Success Criteria**
- [ ] Mobile UI is intuitive and loads optimization suggestions quickly
- [ ] One-tap acceptance/rejection works seamlessly
- [ ] Integration with existing meal plan flow is smooth

### **Testing Strategy**
```python
# Backend testing
def test_meal_optimization_suggestions():
    meal_plan = create_test_meal_plan()
    suggestions = MealOptimizer().analyze_meal_plan(meal_plan, test_user_profile)
    assert len(suggestions) >= 1
    assert all(s.confidence_score > 0.5 for s in suggestions)

def test_optimization_acceptance():
    suggestion = create_test_suggestion()
    result = accept_optimization(suggestion.id, test_user.id)
    assert result.status == "success"
    updated_meal_plan = get_meal_plan(suggestion.meal_plan_id)
    assert suggestion.suggested_item in updated_meal_plan.items

# Frontend testing (React Native)
describe('OptimizationCard', () => {
  it('displays optimization suggestion correctly', () => {
    render(<OptimizationCard suggestion={mockSuggestion} />);
    expect(screen.getByText(mockSuggestion.reasoning)).toBeVisible();
  });
  
  it('calls onAccept when accept button pressed', () => {
    const onAccept = jest.fn();
    render(<OptimizationCard suggestion={mockSuggestion} onAccept={onAccept} />);
    fireEvent.press(screen.getByText('Accept'));
    expect(onAccept).toHaveBeenCalledWith(mockSuggestion.id);
  });
});
```

---

## 🚀 Deployment Plan

### **Week 1: Backend Development**
- Day 1-2: Create optimization engine and database schema
- Day 3-4: Implement API endpoints and testing
- Day 5-7: Algorithm development and rule engine

### **Week 2: Frontend Integration**
- Day 1-3: Mobile UI components and screens
- Day 4-5: Integration with existing meal plan features  
- Day 6-7: Testing, bug fixes, and performance optimization

### **Post-Launch: Monitoring & Iteration**
- Monitor user engagement and acceptance rates
- Collect feedback for algorithm improvements
- A/B test different optimization strategies
- Prepare for Phase 2 feature rollout

---

## ✅ **Ready to Begin Implementation?**

This plan provides a complete roadmap for implementing Smart Meal Optimization as the first AI feature enhancement to DietIntel. The implementation leverages existing infrastructure while adding meaningful value through intelligent meal plan improvements.

**Estimated Timeline**: 1-2 weeks  
**Resource Requirements**: 1 developer (full-time)  
**Risk Level**: Low (builds on existing, proven systems)  
**User Impact**: High (immediate meal plan quality improvements)

---

*Implementation Plan Created: September 4, 2025*  
*Next Steps: Await approval to begin Phase 1 development*