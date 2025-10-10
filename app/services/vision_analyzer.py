"""
Vision Analyzer - Core computer vision engine for food image analysis

Part of FEAT-PROPORTIONS implementation
Performs image analysis using OpenCV and basic computer vision techniques
"""

import logging
import cv2
import numpy as np
from PIL import Image
from typing import List, Dict, Any, Optional, Tuple
import io

from app.models.food_vision import IdentifiedIngredient

logger = logging.getLogger(__name__)

class VisionAnalyzer:
    """
    Core computer vision engine for food analysis

    MVP Implementation:
    - Uses OpenCV for basic image processing
    - Implements heuristic-based food recognition
    - No ML required for initial version
    - Expandable to ML models later
    """

    def __init__(self):
        self.min_confidence = 0.6
        self.known_ingredients = self._load_ingredient_database()

        # Color ranges for basic food detection (HSV)
        self.color_ranges = {
            'red_meat': [
                (np.array([0, 150, 100]), np.array([10, 255, 255])),
                (np.array([160, 150, 100]), np.array([180, 255, 255]))
            ],
            'chicken': [
                (np.array([20, 100, 170]), np.array([40, 255, 255]))
            ],
            'vegetables_green': [
                (np.array([35, 50, 50]), np.array([80, 255, 255]))
            ],
            'bread_grain': [
                (np.array([15, 50, 150]), np.array([35, 150, 255]))
            ]
        }

    def _load_ingredient_database(self) -> Dict[str, Dict[str, Any]]:
        """Load base database of known ingredients with visual signatures"""
        return {
            "red_meat": {
                "name": "Carne Roja",
                "category": "Proteína",
                "nutrition_per_100g": {"calories": 250, "protein_g": 26, "fat_g": 17, "carbs_g": 0},
                "visual_features": ["rojo_brillante", "parrilla", "jugoso"],
                "color_signature": "red_meat",
                "confidence_base": 0.75,
                "size_factor": 1.2
            },
            "chicken": {
                "name": "Pollo",
                "category": "Proteína",
                "nutrition_per_100g": {"calories": 165, "protein_g": 31, "fat_g": 3.6, "carbs_g": 0},
                "visual_features": ["blanco_dorado", "piel", "cocido"],
                "color_signature": "chicken",
                "confidence_base": 0.80,
                "size_factor": 1.0
            },
            "rice_cooked": {
                "name": "Arroz Cocido",
                "category": "Carbohidratos",
                "nutrition_per_100g": {"calories": 130, "protein_g": 2.7, "fat_g": 0.3, "carbs_g": 28},
                "visual_features": ["blanco_granular", "cocido", "humedo"],
                "color_signature": "bread_grain",
                "confidence_base": 0.70,
                "size_factor": 0.8
            },
            "broccoli": {
                "name": "Brócoli",
                "category": "Vegetal",
                "nutrition_per_100g": {"calories": 34, "protein_g": 3.7, "fat_g": 0.4, "carbs_g": 7},
                "visual_features": ["verde_oscuro", "arbolito", "compacto"],
                "color_signature": "vegetables_green",
                "confidence_base": 0.85,
                "size_factor": 0.9
            },
            "apple": {
                "name": "Manzana",
                "category": "Fruta",
                "nutrition_per_100g": {"calories": 52, "protein_g": 0.2, "fat_g": 0.2, "carbs_g": 14},
                "visual_features": ["rojo_verde", "redondo", "brillante"],
                "color_signature": "red_meat",  # Similar hue
                "confidence_base": 0.60,
                "size_factor": 0.7
            }
        }

    async def analyze_image(
        self,
        image_data: bytes
    ) -> Dict[str, Any]:
        """
        Main image analysis method

        Args:
            image_data: Raw bytes of the image

        Returns:
            Analysis results with ingredients and portions
        """
        try:
            # Decode image
            image_array = self._decode_image(image_data)
            if image_array is None:
                raise ValueError("Could not decode image")

            # Extract basic features
            features = self._extract_basic_features(image_array)

            # Detect color characteristics
            color_analysis = self._analyze_colors(image_array)

            # Identify ingredients based on visual cues
            identified_ingredients = self._identify_ingredients(color_analysis, features)

            # Estimate portions based on detected ingredients and image size
            portion_estimate = self._estimate_portions(identified_ingredients, image_array.shape)

            return {
                "identified_ingredients": identified_ingredients,
                "portion_estimate": portion_estimate,
                "confidence_score": self._calculate_overall_confidence(identified_ingredients),
                "processing_metadata": {
                    "image_size": f"{image_array.shape[1]}x{image_array.shape[0]}",
                    "identified_count": len(identified_ingredients),
                    "processing_version": "MVP_OpenCV_v1.0"
                }
            }

        except Exception as e:
            logger.error(f"Error analyzing image: {e}", exc_info=True)
            return {
                "identified_ingredients": [],
                "portion_estimate": {
                    "total_calories": 0,
                    "total_protein_g": 0,
                    "total_fat_g": 0,
                    "total_carbs_g": 0,
                    "confidence_score": 0.0
                },
                "confidence_score": 0.0,
                "processing_metadata": {
                    "error": str(e),
                    "identified_count": 0
                }
            }

    def _decode_image(self, image_data: bytes) -> Optional[np.ndarray]:
        """Decode image bytes to numpy array"""
        try:
            # Decode using PIL first, then convert to OpenCV
            pil_image = Image.open(io.BytesIO(image_data))
            cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
            return cv_image
        except Exception as e:
            logger.warning(f"Could not decode image: {e}")
            return None

    def _extract_basic_features(self, image: np.ndarray) -> Dict[str, Any]:
        """Extract basic visual features from the image"""
        # Convert to HSV for better color analysis
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        # Basic statistics
        avg_hsv = np.mean(hsv, axis=(0, 1))
        std_hsv = np.std(hsv, axis=(0, 1))

        # Edge detection
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 100, 200)
        edge_density = np.count_nonzero(edges) / edges.size

        # Brightness and contrast
        brightness = np.mean(gray)
        contrast = np.std(gray)

        # Color histogram
        hist_h = cv2.calcHist([hsv], [0], None, [180], [0, 180])
        hist_h = hist_h.flatten()
        dominant_hue = np.argmax(hist_h)

        return {
            "dominant_hue": dominant_hue,
            "brightness": brightness,
            "contrast": contrast,
            "edge_density": edge_density,
            "avg_hsv": avg_hsv.tolist(),
            "std_hsv": std_hsv.tolist(),
            "image_shape": image.shape
        }

    def _analyze_colors(self, image: np.ndarray) -> Dict[str, Any]:
        """Analyze color composition for food identification"""
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        color_detections = {}

        for color_name, ranges in self.color_ranges.items():
            total_mask = np.zeros(image.shape[:2], dtype=np.uint8)

            for (lower, upper) in ranges:
                mask = cv2.inRange(hsv, lower, upper)
                total_mask = cv2.bitwise_or(total_mask, mask)

            # Calculate coverage
            coverage = np.count_nonzero(total_mask) / total_mask.size
            color_detections[color_name] = coverage

        # Determine dominant food colors
        max_coverage = max(color_detections.values()) if color_detections else 0

        return {
            "color_coverage": color_detections,
            "dominant_food_color": max(color_detections, key=color_detections.get) if max_coverage > 0.01 else None,
            "max_color_coverage": max_coverage
        }

    def _identify_ingredients(
        self,
        color_analysis: Dict[str, Any],
        features: Dict[str, Any]
    ) -> List[IdentifiedIngredient]:
        """
        Identify ingredients based on visual analysis

        MVP Logic:
        - Match dominant colors to known ingredients
        - Use basic heuristics for confidence scoring
        """
        identified = []
        dominant_color = color_analysis.get("dominant_food_color")

        if not dominant_color or color_analysis.get("max_color_coverage", 0) < 0.05:
            # Fallback: try to identify generic protein source
            return self._fallback_identification(features)

        # Match ingredients based on color signatures
        for ingredient_key, ingredient_data in self.known_ingredients.items():
            color_signature = ingredient_data.get("color_signature")
            confidence_base = ingredient_data.get("confidence_base", 0.5)

            if color_signature == dominant_color:
                # Calculate confidence based on color matching and other factors
                confidence = self._calculate_match_confidence(
                    color_analysis, features, ingredient_data
                )

                if confidence > self.min_confidence:
                    # Estimate grams based on visual factors
                    estimated_grams = self._estimate_grams_from_visual(
                        ingredient_data, features
                    )

                    identified.append(IdentifiedIngredient(
                        name=ingredient_data["name"],
                        category=ingredient_data["category"],
                        estimated_grams=estimated_grams,
                        confidence_score=min(confidence, 0.95),  # Cap at 95%
                        visual_markers=ingredient_data.get("visual_features", []),
                        nutrition_per_100g=ingredient_data["nutrition_per_100g"]
                    ))

        return identified

    def _fallback_identification(self, features: Dict[str, Any]) -> List[IdentifiedIngredient]:
        """Fallback identification when color matching fails"""
        # Assume some generic protein source if high edge density (suggests meat texture)
        edge_density = features.get("edge_density", 0)
        brightness = features.get("brightness", 0)

        if edge_density > 0.1 and brightness > 100:
            # Likely cooked protein
            chicken_data = self.known_ingredients["chicken"]
            return [IdentifiedIngredient(
                name=chicken_data["name"],
                category=chicken_data["category"],
                estimated_grams=150,  # Reasonable default
                confidence_score=0.5,  # Low confidence
                visual_markers=["textura_visible", "cocinado"],
                nutrition_per_100g=chicken_data["nutrition_per_100g"]
            )]

        return []

    def _calculate_match_confidence(
        self,
        color_analysis: Dict[str, Any],
        features: Dict[str, Any],
        ingredient_data: Dict[str, Any]
    ) -> float:
        """Calculate identification confidence"""
        base_confidence = ingredient_data.get("confidence_base", 0.5)

        # Boost confidence based on color coverage
        coverage_boost = color_analysis.get("max_color_coverage", 0) * 0.2

        # Reduce confidence if image is too dark/bright
        brightness = features.get("brightness", 128)
        brightness_penalty = 0
        if brightness < 50 or brightness > 200:
            brightness_penalty = 0.1

        # Apply size factor
        size_factor = ingredient_data.get("size_factor", 1.0)

        final_confidence = base_confidence + coverage_boost - brightness_penalty
        return min(max(final_confidence * size_factor, 0.0), 0.99)

    def _estimate_grams_from_visual(
        self,
        ingredient_data: Dict[str, Any],
        features: Dict[str, Any]
    ) -> float:
        """Estimate portion size in grams from visual cues"""
        width, height = features["image_shape"][1], features["image_shape"][0]
        image_area = width * height

        # Base portion in grams (typical serving size)
        base_grams = 150

        # Adjust based on image size (larger image = more food)
        size_multiplier = min(image_area / (640 * 480), 3.0)  # Max 3x multiplier

        # Apply ingredient-specific size factor
        ingredient_factor = ingredient_data.get("size_factor", 1.0)

        return round(base_grams * size_multiplier * ingredient_factor)

    def _estimate_portions(
        self,
        ingredients: List[IdentifiedIngredient],
        image_shape: Tuple[int, int, int]
    ) -> Dict[str, Any]:
        """Estimate total portions for all identified ingredients"""
        if not ingredients:
            return {
                "total_calories": 0,
                "total_protein_g": 0,
                "total_fat_g": 0,
                "total_carbs_g": 0,
                "confidence_score": 0.0
            }

        # Sum nutrients from all ingredients
        total_calories = 0
        total_protein = 0
        total_fat = 0
        total_carbs = 0
        total_confidence = 0

        for ingredient in ingredients:
            grams = ingredient.estimated_grams
            nutrition = ingredient.nutrition_per_100g

            # Calculate for this portion
            factor = grams / 100.0
            total_calories += nutrition["calories"] * factor
            total_protein += nutrition["protein_g"] * factor
            total_fat += nutrition["fat_g"] * factor
            total_carbs += nutrition["carbs_g"] * factor
            total_confidence += ingredient.confidence_score

        # Average confidence across ingredients
        avg_confidence = total_confidence / len(ingredients)

        return {
            "total_calories": round(total_calories),
            "total_protein_g": round(total_protein, 1),
            "total_fat_g": round(total_fat, 1),
            "total_carbs_g": round(total_carbs, 1),
            "confidence_score": round(avg_confidence, 2)
        }

    def _calculate_overall_confidence(self, ingredients: List[IdentifiedIngredient]) -> float:
        """Calculate overall analysis confidence"""
        if not ingredients:
            return 0.0

        # Average confidence, weighted by portion size
        total_confidence = 0
        total_weight = 0

        for ingredient in ingredients:
            weight = ingredient.estimated_grams
            total_confidence += ingredient.confidence_score * weight
            total_weight += weight

        return round(total_confidence / total_weight, 2) if total_weight > 0 else 0.0
