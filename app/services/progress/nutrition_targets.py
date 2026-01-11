"""Nutrition Targets - Strategy Pattern for obtaining nutritional targets.

FASE 2.b: Refactorización de TrackingService
Patrón Strategy: Encapsula obtención de metas nutricionales.
"""

from typing import Dict, Any, Optional, Union
from dataclasses import dataclass
from abc import ABC, abstractmethod


@dataclass
class NutritionTargets:
    """Container for nutritional targets."""
    calories: float
    protein: float
    fat: float
    carbs: float
    
    def to_dict(self) -> Dict[str, float]:
        """Convert to dictionary."""
        return {
            "calories": self.calories,
            "protein": self.protein,
            "fat": self.fat,
            "carbs": self.carbs,
        }


class NutritionTargetsStrategy(ABC):
    """Abstract base class for nutrition target strategies."""
    
    @abstractmethod
    async def get_targets(self, user_id: str) -> NutritionTargets:
        """Get nutritional targets for a user.
        
        Args:
            user_id: User ID to get targets for
            
        Returns:
            NutritionTargets with daily goals
        """
        ...


class DefaultNutritionTargetsStrategy(NutritionTargetsStrategy):
    """Default nutrition targets strategy.
    
    Uses hardcoded default values when user profile
    is not available.
    """
    
    # Default targets based on standard recommendations
    DEFAULT_TARGETS = NutritionTargets(
        calories=2000.0,
        protein=120.0,
        fat=65.0,
        carbs=250.0
    )
    
    async def get_targets(self, user_id: str) -> NutritionTargets:
        """Get default nutrition targets.
        
        Args:
            user_id: User ID (not used in this strategy)
            
        Returns:
            Default NutritionTargets
        """
        return self.DEFAULT_TARGETS


class UserProfileNutritionTargetsStrategy(NutritionTargetsStrategy):
    """Nutrition targets based on user profile.
    
    Fetches targets from user profile or calculates
    them based on user characteristics.
    """
    
    def __init__(self, profile_service: Optional[Any] = None):
        """Initialize with optional profile service.
        
        Args:
            profile_service: Service to fetch user profiles
        """
        self._profile_service = profile_service
    
    async def get_targets(self, user_id: str) -> NutritionTargets:
        """Get nutrition targets from user profile.
        
        Args:
            user_id: User ID to fetch profile for
            
        Returns:
            NutritionTargets based on user profile
        """
        # Try to get from user profile
        if self._profile_service:
            try:
                profile = await self._profile_service.get_profile(user_id)
                if profile:
                    return self._calculate_from_profile(profile)
            except Exception:
                pass  # Fall back to defaults
        
        # Fall back to defaults if profile not available
        return DefaultNutritionTargetsStrategy().DEFAULT_TARGETS
    
    def _calculate_from_profile(self, profile: Any) -> NutritionTargets:
        """Calculate targets from user profile.
        
        Args:
            profile: User profile with age, weight, height, etc.
            
        Returns:
            Calculated NutritionTargets
        """
        # Basic BMR calculation (Mifflin-St Jeor)
        # This is a simplified version - in production, 
        # you'd use more sophisticated calculations
        try:
            weight = getattr(profile, 'weight_kg', 70) or 70
            height = getattr(profile, 'height_cm', 170) or 170
            age = getattr(profile, 'age', 30) or 30
            sex = getattr(profile, 'sex', 'male')
            activity = getattr(profile, 'activity_level', 'moderately_active')
            
            # Simplified BMR
            if sex == 'male':
                bmr = 10 * weight + 6.25 * height - 5 * age + 5
            else:
                bmr = 10 * weight + 6.25 * height - 5 * age - 161
            
            # Activity multipliers
            activity_multipliers = {
                'sedentary': 1.2,
                'lightly_active': 1.375,
                'moderately_active': 1.55,
                'very_active': 1.725,
                'extra_active': 1.9
            }
            
            multiplier = activity_multipliers.get(activity, 1.2)
            tdee = bmr * multiplier
            
            # Macro distribution (balanced)
            # Protein: 30%, Fat: 25%, Carbs: 45%
            protein_calories = tdee * 0.30 / 4  # 4 cal per gram
            fat_calories = tdee * 0.25 / 9      # 9 cal per gram
            carbs_calories = tdee * 0.45 / 4    # 4 cal per gram
            
            return NutritionTargets(
                calories=round(tdee, 0),
                protein=round(protein_calories, 0),
                fat=round(fat_calories, 0),
                carbs=round(carbs_calories, 0)
            )
            
        except (AttributeError, TypeError):
            # Return defaults if calculation fails
            return DefaultNutritionTargetsStrategy().DEFAULT_TARGETS


class NutritionTargetsProvider:
    """Context class that provides nutrition targets.
    
    FASE 2.b: Main entry point for getting nutritional targets.
    Uses Strategy Pattern to allow different target sources.
    """
    
    def __init__(
        self,
        strategy: Optional[NutritionTargetsStrategy] = None
    ):
        """Initialize provider with optional custom strategy.
        
        Args:
            strategy: Target strategy (defaults to UserProfile)
        """
        self._strategy = strategy or UserProfileNutritionTargetsStrategy()
    
    def set_strategy(self, strategy: NutritionTargetsStrategy) -> None:
        """Change the target strategy at runtime.
        
        Args:
            strategy: New strategy to use
        """
        self._strategy = strategy
    
    async def get_targets(self, user_id: str) -> NutritionTargets:
        """Get nutrition targets using current strategy.
        
        Args:
            user_id: User ID to get targets for
            
        Returns:
            NutritionTargets with daily goals
        """
        return await self._strategy.get_targets(user_id)
    
    async def get_targets_as_dict(self, user_id: str) -> Dict[str, float]:
        """Get nutrition targets as dictionary.
        
        Args:
            user_id: User ID to get targets for
            
        Returns:
            Dictionary with nutrient names as keys
        """
        targets = await self.get_targets(user_id)
        return targets.to_dict()


# Default provider instance for easy imports
default_targets_provider = NutritionTargetsProvider()
