"""
Shopping Optimization Models
Phase R.3 Task 9: Smart Shopping Intelligence Data Models
"""

from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional, Any, Union
from datetime import datetime
from enum import Enum


# ===== ENUMS =====

class OptimizationStatus(str, Enum):
    """Status of shopping optimization"""
    pending = "pending"
    optimized = "optimized"
    used = "used"
    expired = "expired"


class SuggestionType(str, Enum):
    """Type of bulk buying suggestion"""
    bulk_discount = "bulk_discount"
    family_pack = "family_pack"
    warehouse_store = "warehouse_store"
    subscription = "subscription"


class PerishabilityRisk(str, Enum):
    """Risk level for perishable items"""
    low = "low"
    medium = "medium"
    high = "high"


class StorageRequirement(str, Enum):
    """Storage requirements for ingredients"""
    pantry = "pantry"
    refrigerated = "refrigerated"
    frozen = "frozen"
    cool_dry = "cool_dry"


# ===== CORE DATA MODELS =====

class StoreInfo(BaseModel):
    """Store information and layout data"""
    id: str
    name: str
    store_chain: Optional[str] = None
    location: Optional[str] = None
    layout_data: Dict[str, Any] = Field(default_factory=dict)  # Aisle/section mappings
    avg_prices_data: Dict[str, float] = Field(default_factory=dict)  # Ingredient price averages
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class ProductCategory(BaseModel):
    """Product category for store organization"""
    id: str
    category_name: str
    parent_category_id: Optional[str] = None
    typical_aisle: Optional[str] = None
    sort_order: int = 0
    created_at: datetime = Field(default_factory=datetime.now)


class SourceRecipeInfo(BaseModel):
    """Information about ingredient source from recipes"""
    recipe_id: str
    recipe_name: str
    original_quantity: float
    unit: str


class IngredientConsolidation(BaseModel):
    """Details of ingredient consolidation across recipes"""
    id: str
    shopping_optimization_id: str
    consolidated_ingredient_name: str

    # Source recipes and quantities
    source_recipes: List[SourceRecipeInfo]
    total_consolidated_quantity: float
    final_unit: str

    # Cost and optimization data
    unit_cost: float = 0.0
    total_cost: float = 0.0
    bulk_discount_available: bool = False
    suggested_package_size: Optional[float] = None
    suggested_package_unit: Optional[str] = None

    # Store location data
    product_category_id: Optional[str] = None
    typical_aisle: Optional[str] = None
    store_section: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.now)

    @validator('source_recipes', pre=True)
    def validate_source_recipes(cls, v):
        """Ensure at least one source recipe"""
        if not v or len(v) == 0:
            raise ValueError("At least one source recipe is required")
        return v


class BulkBuyingSuggestion(BaseModel):
    """Bulk buying opportunity and recommendation"""
    id: str
    shopping_optimization_id: str
    ingredient_consolidation_id: str

    # Bulk buying details
    suggestion_type: SuggestionType
    current_needed_quantity: float
    suggested_bulk_quantity: float
    bulk_unit: str

    # Cost analysis
    regular_unit_price: float
    bulk_unit_price: float
    immediate_savings: float = 0.0
    cost_per_unit_savings: float = 0.0

    # Storage and usage considerations
    storage_requirements: StorageRequirement = StorageRequirement.pantry
    estimated_usage_timeframe_days: int
    perishability_risk: PerishabilityRisk = PerishabilityRisk.low

    # Recommendation scoring
    recommendation_score: float = Field(default=0.0, ge=0.0, le=1.0)
    user_preference_match: float = Field(default=0.5, ge=0.0, le=1.0)

    created_at: datetime = Field(default_factory=datetime.now)

    @validator('immediate_savings', 'cost_per_unit_savings')
    def calculate_savings(cls, v, values):
        """Auto-calculate savings if not provided"""
        if v == 0.0 and 'regular_unit_price' in values and 'bulk_unit_price' in values:
            regular = values.get('regular_unit_price', 0)
            bulk = values.get('bulk_unit_price', 0)
            quantity = values.get('suggested_bulk_quantity', 0)

            if regular > 0 and bulk > 0 and quantity > 0:
                if 'immediate_savings' in values:
                    return (regular - bulk) * quantity
                else:  # cost_per_unit_savings
                    return regular - bulk
        return v


class ShoppingPathSegment(BaseModel):
    """Segment of optimized shopping path through store"""
    id: str
    shopping_optimization_id: str
    segment_order: int

    # Store navigation data
    store_section: str
    aisle_number: Optional[str] = None
    section_description: Optional[str] = None

    # Items to collect in this segment
    ingredient_consolidation_ids: List[str]
    estimated_time_minutes: int = 0

    # Navigation guidance
    navigation_notes: Optional[str] = None
    previous_segment_id: Optional[str] = None
    next_segment_id: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.now)


class UserShoppingPreferences(BaseModel):
    """User's shopping preferences and behavior patterns"""
    user_id: str

    # Store preferences
    preferred_stores: List[str] = Field(default_factory=list)
    budget_conscious_level: float = Field(default=0.5, ge=0.0, le=1.0)  # 0.0 = convenience, 1.0 = cost focused
    bulk_buying_preference: float = Field(default=0.5, ge=0.0, le=1.0)

    # Shopping behavior patterns
    average_shopping_frequency_days: int = 7
    typical_shopping_time_minutes: int = 45
    prefers_organic: bool = False
    prefers_name_brands: bool = False

    # Optimization preferences
    prioritize_cost_savings: bool = True
    prioritize_shopping_time: bool = False
    prioritize_ingredient_quality: bool = False

    # Learning from behavior
    actual_vs_estimated_accuracy: float = Field(default=0.0, ge=0.0, le=1.0)
    cost_prediction_accuracy: float = Field(default=0.0, ge=0.0, le=1.0)
    time_prediction_accuracy: float = Field(default=0.0, ge=0.0, le=1.0)

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class ShoppingOptimization(BaseModel):
    """Main shopping optimization entity"""
    id: str
    user_id: str
    optimization_name: str
    recipe_ids: List[str]

    # Consolidation data
    total_unique_ingredients: int = 0
    consolidation_opportunities: int = 0
    consolidated_ingredients: List[IngredientConsolidation] = Field(default_factory=list)

    # Cost optimization data
    estimated_total_cost: float = 0.0
    bulk_buying_opportunities: List[BulkBuyingSuggestion] = Field(default_factory=list)
    cost_savings_potential: float = 0.0
    cost_per_serving: float = 0.0

    # Store optimization data
    preferred_store_id: Optional[str] = None
    shopping_path_optimization: List[ShoppingPathSegment] = Field(default_factory=list)
    estimated_shopping_time_minutes: int = 0

    # Status and metadata
    optimization_status: OptimizationStatus = OptimizationStatus.pending
    optimization_score: float = Field(default=0.0, ge=0.0, le=1.0)

    created_at: datetime = Field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None

    @validator('recipe_ids')
    def validate_recipe_ids(cls, v):
        """Ensure at least one recipe ID"""
        if not v or len(v) == 0:
            raise ValueError("At least one recipe ID is required for shopping optimization")
        return v


class ShoppingOptimizationAnalytics(BaseModel):
    """Analytics data for shopping optimization performance"""
    id: str
    shopping_optimization_id: str
    user_id: Optional[str] = None

    # Performance metrics
    optimization_generation_time_ms: float = 0.0
    consolidation_efficiency_score: float = Field(default=0.0, ge=0.0, le=1.0)
    cost_prediction_accuracy: float = Field(default=0.0, ge=0.0, le=1.0)
    time_prediction_accuracy: float = Field(default=0.0, ge=0.0, le=1.0)

    # User feedback
    user_satisfaction_rating: Optional[int] = Field(None, ge=1, le=5)
    used_bulk_suggestions: bool = False
    followed_shopping_path: bool = False
    reported_issues: List[str] = Field(default_factory=list)

    # Actual outcomes
    actual_total_cost: Optional[float] = None
    actual_shopping_time_minutes: Optional[int] = None
    items_not_found: int = 0
    substitutions_made: int = 0

    created_at: datetime = Field(default_factory=datetime.now)


# ===== API REQUEST/RESPONSE MODELS =====

class ShoppingOptimizationRequest(BaseModel):
    """Request to create shopping optimization"""
    recipe_ids: List[str] = Field(..., min_items=1)
    optimization_name: Optional[str] = None
    preferred_store_id: Optional[str] = None
    prioritize_cost: bool = True
    prioritize_time: bool = False
    prioritize_quality: bool = False
    include_bulk_suggestions: bool = True
    include_path_optimization: bool = True

    @validator('optimization_name', pre=True, always=True)
    def generate_name_if_empty(cls, v, values):
        """Generate optimization name if not provided"""
        if not v and 'recipe_ids' in values:
            recipe_count = len(values['recipe_ids'])
            return f"Shopping List for {recipe_count} Recipe{'s' if recipe_count != 1 else ''}"
        return v


class ShoppingOptimizationResponse(BaseModel):
    """Response containing shopping optimization results"""
    optimization: ShoppingOptimization
    consolidation_summary: Dict[str, Any]
    cost_breakdown: Dict[str, float]
    time_estimate: Dict[str, int]
    bulk_opportunities_count: int
    path_segments_count: int

    # Additional metadata
    generation_time_ms: float
    cache_key: Optional[str] = None


class ShoppingListRequest(BaseModel):
    """Request to generate simple shopping list (legacy compatibility)"""
    recipe_ids: List[str] = Field(..., min_items=1)
    consolidate_ingredients: bool = True
    include_quantities: bool = True
    group_by_category: bool = True


class ShoppingListItem(BaseModel):
    """Individual item in shopping list"""
    ingredient_name: str
    total_quantity: float
    unit: str
    category: Optional[str] = None
    aisle: Optional[str] = None
    estimated_cost: Optional[float] = None
    source_recipes: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class ShoppingListResponse(BaseModel):
    """Simple shopping list response (legacy compatibility)"""
    items: List[ShoppingListItem]
    total_estimated_cost: float = 0.0
    total_items: int = 0
    categories: List[str] = Field(default_factory=list)

    # Task 9 related comment: Enhanced shopping list with basic consolidation
    consolidation_applied: bool = False
    consolidation_savings: float = 0.0


class BulkBuyingAnalysis(BaseModel):
    """Analysis of bulk buying opportunities"""
    ingredient_name: str
    current_need: Dict[str, float]  # {"quantity": 2.0, "unit": "cups"}
    bulk_option: Dict[str, Any]  # Bulk package details
    savings_analysis: Dict[str, float]  # Cost savings breakdown
    recommendation: str  # "recommended", "optional", "not_recommended"
    reasoning: str


class StoreLayoutOptimization(BaseModel):
    """Store layout optimization results"""
    store_id: str
    store_name: str
    optimized_path: List[Dict[str, Any]]  # Shopping path segments
    estimated_time_minutes: int
    efficiency_score: float = Field(ge=0.0, le=1.0)

    # Task 9 related comment: Store navigation optimization for efficient shopping


# ===== UTILITY MODELS =====

class ConsolidationResult(BaseModel):
    """Result of ingredient consolidation process"""
    original_ingredients_count: int
    consolidated_ingredients_count: int
    consolidation_rate: float = Field(ge=0.0, le=1.0)
    unit_conversions_applied: int = 0
    consolidation_details: List[IngredientConsolidation]


class CostOptimizationResult(BaseModel):
    """Result of cost optimization analysis"""
    base_cost_estimate: float
    optimized_cost_estimate: float
    potential_savings: float
    savings_percentage: float = Field(ge=0.0, le=1.0)
    bulk_opportunities: List[BulkBuyingSuggestion]


class ShoppingPathResult(BaseModel):
    """Result of shopping path optimization"""
    store_id: str
    path_segments: List[ShoppingPathSegment]
    total_estimated_time: int
    efficiency_improvement: float = Field(ge=0.0)  # Time saved vs random shopping

    # Task 9 related comment: Optimized shopping route through store layout


# ===== TASK 11 API MODELS =====

class ShoppingOptimizationRequest(BaseModel):
    """Request for shopping list optimization"""
    recipe_ids: List[str] = Field(..., min_items=1, description="List of recipe IDs to include in optimization")
    preferred_store_id: Optional[str] = Field(None, description="Preferred store for optimization")
    optimization_name: Optional[str] = Field(None, description="Custom name for the optimization")
    optimization_preferences: Optional[Dict[str, Any]] = Field(default_factory=dict, description="User preferences for optimization")

    # Task 11 related comment: API request model for multi-recipe shopping optimization


class ShoppingOptimizationResponse(BaseModel):
    """Response with complete shopping optimization results"""
    optimization_id: str = Field(..., description="Unique identifier for the optimization")
    optimization_name: str = Field(..., description="Name of the optimization")
    recipe_ids: List[str] = Field(..., description="Recipe IDs included in optimization")
    consolidated_ingredients: List[IngredientConsolidation] = Field(..., description="Consolidated ingredient list")
    optimization_metrics: Dict[str, Any] = Field(..., description="Performance metrics and statistics")
    bulk_suggestions: Optional[List[BulkBuyingSuggestion]] = Field(default_factory=list, description="Bulk buying opportunities")
    shopping_path: Optional[List[ShoppingPathSegment]] = Field(default_factory=list, description="Optimized shopping route")
    estimated_total_cost: Optional[float] = Field(None, description="Estimated total cost")
    estimated_savings: Optional[float] = Field(None, description="Estimated savings from optimization")
    created_at: Optional[datetime] = Field(None, description="When optimization was created")
    expires_at: Optional[datetime] = Field(None, description="When optimization expires")

    # Task 11 related comment: Complete shopping optimization response with consolidation results


class ConsolidatedIngredientResponse(BaseModel):
    """Individual consolidated ingredient in response"""
    id: str = Field(..., description="Unique identifier for consolidated ingredient")
    name: str = Field(..., description="Consolidated ingredient name")
    total_quantity: float = Field(..., gt=0, description="Total consolidated quantity")
    unit: str = Field(..., description="Unit of measurement")
    source_recipes: List[Dict[str, Any]] = Field(..., description="Source recipe information")
    estimated_cost: Optional[float] = Field(None, description="Estimated cost for this ingredient")
    bulk_discount_available: bool = Field(False, description="Whether bulk discount is available")
    category: Optional[str] = Field(None, description="Ingredient category")
    store_location: Optional[str] = Field(None, description="Typical store location/aisle")

    # Task 11 related comment: Detailed consolidated ingredient response model


class OptimizationMetrics(BaseModel):
    """Optimization performance metrics"""
    total_original_ingredients: int = Field(..., ge=0, description="Original ingredient count across all recipes")
    total_consolidated_ingredients: int = Field(..., ge=0, description="Final consolidated ingredient count")
    consolidation_opportunities: int = Field(..., ge=0, description="Number of consolidations performed")
    efficiency_score: float = Field(..., ge=0.0, le=1.0, description="Consolidation efficiency score")
    ingredients_reduced_percent: float = Field(..., ge=0.0, le=100.0, description="Percentage of ingredients reduced")
    estimated_cost: float = Field(0.0, ge=0.0, description="Estimated total cost")
    optimization_score: float = Field(0.0, ge=0.0, le=1.0, description="Overall optimization quality score")

    # Task 11 related comment: Comprehensive optimization performance metrics