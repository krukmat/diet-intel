"""
Unified Intelligent Flow models.

Provides typed contracts for the end-to-end IA pipeline that links
Food Vision, Recipe AI, and Smart Diet services.
"""

from __future__ import annotations

import base64
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any

from pydantic import BaseModel, Field, validator

from app.models.food_vision import VisionLogResponse, IdentifiedIngredient
from app.models.recipe import GeneratedRecipeResponse
from app.models.smart_diet import SmartDietResponse, SmartDietContext


class FlowStepStatus(str, Enum):
    """Execution outcome for a single pipeline step."""
    SUCCESS = "success"
    SKIPPED = "skipped"
    ERROR = "error"


class FlowExecutionStatus(str, Enum):
    """High level outcome for the full intelligent flow."""
    COMPLETE = "complete"
    PARTIAL = "partial"
    FAILED = "failed"


class FlowStepTiming(BaseModel):
    """Timing and status metadata for a flow step."""
    started_at: datetime = Field(..., description="UTC timestamp when the step started")
    duration_ms: float = Field(..., ge=0.0, description="Execution time in milliseconds")
    status: FlowStepStatus = Field(..., description="Execution status")
    error_message: Optional[str] = Field(None, description="Optional error details if status=error")


class FlowMetadata(BaseModel):
    """Aggregated metadata describing the orchestrated run."""
    user_id: str = Field(..., description="User identifier used for the flow")
    meal_type: str = Field(..., description="Meal context associated to the flow")
    total_duration_ms: float = Field(..., ge=0.0, description="Total duration of all executed steps")
    warnings: List[str] = Field(default_factory=list, description="Non-blocking warnings collected during execution")


class IntelligentFlowRecipePreferences(BaseModel):
    """
    Recipe AI preferences used when orchestrating the flow.

    These fields are purposefully aligned with EngineRequest so the orchestrator
    can translate them without requiring the caller to know low-level details.
    """

    cuisine_preferences: List[str] = Field(default_factory=list, description="Preferred cuisines")
    dietary_restrictions: List[str] = Field(default_factory=list, description="Dietary restrictions")
    difficulty_preference: str = Field("easy", description="Recipe difficulty target (easy|medium|hard|any)")
    meal_type: Optional[str] = Field(None, description="Meal type for recipe targeting")
    servings: int = Field(2, ge=1, le=12, description="Desired servings per recipe")
    target_calories_per_serving: Optional[float] = Field(None, ge=0.0, description="Calories target per serving")
    target_protein_g: Optional[float] = Field(None, ge=0.0, description="Protein target per serving")
    target_carbs_g: Optional[float] = Field(None, ge=0.0, description="Carb target per serving")
    target_fat_g: Optional[float] = Field(None, ge=0.0, description="Fat target per serving")
    max_prep_time_minutes: Optional[int] = Field(None, ge=5, le=240, description="Maximum preparation time")
    max_cook_time_minutes: Optional[int] = Field(None, ge=0, le=360, description="Maximum cooking time")
    preferred_ingredients: List[str] = Field(default_factory=list, description="User preferred ingredients")
    excluded_ingredients: List[str] = Field(default_factory=list, description="Ingredients to exclude")
    include_identified_ingredients: bool = Field(
        True,
        description="When true, automatically include ingredients detected by Food Vision"
    )

    def build_available_ingredients(self, identified: List[IdentifiedIngredient]) -> List[str]:
        """Return de-duplicated ingredient names mixing user preferences and vision analysis."""
        candidate_names: List[str] = []
        if self.include_identified_ingredients:
            candidate_names.extend([ingredient.name for ingredient in identified])
        candidate_names.extend(self.preferred_ingredients)

        deduped: Dict[str, None] = {}
        for name in candidate_names:
            normalized = name.strip()
            if normalized:
                deduped[normalized] = None
        return list(deduped.keys())


class IntelligentFlowSmartDietConfig(BaseModel):
    """Smart Diet configuration used by the orchestrated flow."""

    context_type: SmartDietContext = Field(
        SmartDietContext.TODAY,
        description="Smart Diet context to request (today|optimize|discover|insights)"
    )
    meal_context: Optional[str] = Field(None, description="Meal to optimize (breakfast|lunch|dinner|snack)")
    include_optimizations: bool = Field(True, description="Whether Smart Diet should include optimizations")
    include_recommendations: bool = Field(True, description="Whether Smart Diet should include discovery recommendations")
    max_suggestions: int = Field(10, ge=1, le=50, description="Number of suggestions to fetch")
    min_confidence: float = Field(0.3, ge=0.0, le=1.0, description="Minimum confidence threshold")
    dietary_restrictions: List[str] = Field(default_factory=list, description="Dietary restrictions for Smart Diet")
    cuisine_preferences: List[str] = Field(default_factory=list, description="Cuisine preferences")
    excluded_ingredients: List[str] = Field(default_factory=list, description="Ingredients to avoid")
    calorie_budget: Optional[float] = Field(None, ge=0.0, description="Optional calorie budget used for personalization")
    lang: str = Field("en", description="Language for Smart Diet content")


class IntelligentFlowRequest(BaseModel):
    """Input contract for the unified intelligent flow."""

    user_id: str = Field(..., description="Identifier of the user requesting the flow")
    image_base64: str = Field(..., description="Meal image encoded as base64 (JPEG/PNG/WebP)")
    meal_type: str = Field("lunch", description="Meal type associated with the photo")
    user_context: Optional[Dict[str, Any]] = Field(None, description="Additional context (weight, goals, etc.)")
    recipe_preferences: Optional[IntelligentFlowRecipePreferences] = Field(
        None,
        description="Optional recipe preferences to pass through the flow"
    )
    smart_diet_config: IntelligentFlowSmartDietConfig = Field(
        default_factory=IntelligentFlowSmartDietConfig,
        description="Smart Diet configuration defaults"
    )

    @validator("image_base64")
    def validate_base64(cls, value: str) -> str:
        """Ensure base64 data can be decoded before delegating to the orchestrator."""
        if not value:
            raise ValueError("image_base64 cannot be empty")
        try:
            base64.b64decode(value, validate=True)
        except Exception as exc:  # pragma: no cover - validation path
            raise ValueError("image_base64 is not valid base64 data") from exc
        return value


class IntelligentFlowResponse(BaseModel):
    """Output contract returned by the unified intelligent flow."""

    status: FlowExecutionStatus = Field(..., description="Overall flow status")
    vision_result: VisionLogResponse = Field(..., description="Output from Food Vision analysis")
    recipe_result: Optional[GeneratedRecipeResponse] = Field(
        None, description="Recipe AI result generated during the flow"
    )
    smart_diet_result: Optional[SmartDietResponse] = Field(
        None, description="Smart Diet response generated during the flow"
    )
    timings: Dict[str, FlowStepTiming] = Field(default_factory=dict, description="Timing breakdown per step")
    metadata: FlowMetadata = Field(..., description="Aggregated metadata for the flow run")
