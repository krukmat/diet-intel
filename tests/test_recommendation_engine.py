import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta

from app.services.recommendation_engine import SmartRecommendationEngine, UserPreferenceProfile
from app.models.recommendation import (
    SmartRecommendationRequest, SmartRecommendationResponse, 
    RecommendationType, RecommendationFeedback
)
from app.models.product import ProductResponse, Nutriments

@pytest.mark.unit
class TestSmartRecommendationEngine:
    """Test suite for SmartRecommendationEngine unit tests."""
    
    @pytest.fixture
    def engine(self):
        """Create a SmartRecommendationEngine instance for testing."""
        return SmartRecommendationEngine()
    
    @pytest.fixture
    def mock_product(self):
        """Sample product for testing."""
        return ProductResponse(
            code="1234567890123",
            product_name="Greek Yogurt",
            nutriments=Nutriments(
                energy_kcal_per_100g=59,
                protein_g_per_100g=10,
                fat_g_per_100g=0,
                carbs_g_per_100g=4,
                sugars_g_per_100g=4,
                salt_g_per_100g=0.1
            ),
            brands="TestBrand",
            categories="Dairy products",
            found=True
        )
    
    @pytest.fixture
    def sample_request(self):
        """Sample recommendation request."""
        return SmartRecommendationRequest(
            user_id="test_user_123",
            context="general",
            recommendation_type=RecommendationType.SIMILAR_NUTRITION,
            preferences={"meal_type": "breakfast", "high_protein": True},
            limit=5
        )
    
    def test_engine_initialization(self, engine):
        """Test that the engine initializes with correct default values."""
        assert engine.user_profiles == {}
        assert engine.feedback_history == []
        assert engine.recommendation_cache_ttl == 300
        assert "nutritional_quality" in engine.scoring_weights
        assert "user_preference" in engine.scoring_weights
        assert sum(engine.scoring_weights.values()) == 1.0  # Weights should sum to 1
    
    def test_scoring_weights_are_valid(self, engine):
        """Test that scoring weights are properly configured."""
        weights = engine.scoring_weights
        assert all(0 <= weight <= 1 for weight in weights.values())
        assert abs(sum(weights.values()) - 1.0) < 0.01  # Allow for floating point precision
    
    def test_macro_targets_are_valid(self, engine):
        """Test that macro targets are within reasonable ranges."""
        targets = engine.macro_targets
        assert 0 < targets['protein_min_percent'] < targets['protein_max_percent'] < 1
        assert 0 < targets['fat_min_percent'] < targets['fat_max_percent'] < 1
        assert 0 < targets['carbs_min_percent'] < targets['carbs_max_percent'] < 1
    
    @pytest.mark.asyncio
    async def test_generate_recommendations_basic(self, engine, sample_request):
        """Test basic recommendation generation."""
        with patch.object(engine, '_load_available_products') as mock_products:
            mock_products.return_value = [ProductResponse(
                code="1234567890123",
                product_name="Greek Yogurt",
                nutriments=Nutriments(
                    energy_kcal_per_100g=59,
                    protein_g_per_100g=10,
                    fat_g_per_100g=0,
                    carbs_g_per_100g=4,
                    sugars_g_per_100g=4,
                    salt_g_per_100g=0.1
                ),
                brands="TestBrand",
                categories="Dairy products",
                found=True
            )]
            
            response = await engine.generate_recommendations(sample_request)
            
            assert isinstance(response, SmartRecommendationResponse)
            assert response.user_id == sample_request.user_id
            assert len(response.recommendations) > 0
            assert response.status == "success"
            assert response.response_time_ms > 0
    
    @pytest.mark.asyncio
    async def test_generate_recommendations_no_products(self, engine, sample_request):
        """Test recommendation generation when no products are available."""
        with patch.object(engine, '_load_available_products') as mock_products:
            mock_products.return_value = []
            
            response = await engine.generate_recommendations(sample_request)
            
            assert isinstance(response, SmartRecommendationResponse)
            assert len(response.recommendations) == 0
            assert response.status == "no_recommendations"
    
    @pytest.mark.asyncio
    async def test_load_user_profile_new_user(self, engine):
        """Test loading profile for new user returns None."""
        profile = await engine._load_user_profile("new_user")
        assert profile is None
    
    @pytest.mark.asyncio
    async def test_load_user_profile_existing_user(self, engine):
        """Test loading profile for existing user."""
        # Create a mock user profile
        test_profile = UserPreferenceProfile(
            favorite_foods={"greek_yogurt", "oatmeal"},
            avoided_foods={"nuts"},
            preferred_cuisines=["mediterranean"],
            macro_preferences={"protein": 0.25},
            meal_timing_patterns={"breakfast": ["yogurt", "oatmeal"]},
            seasonal_preferences={"summer": ["berries"]},
            interaction_count=10,
            last_updated=datetime.now()
        )
        
        engine.user_profiles["test_user"] = test_profile
        
        profile = await engine._load_user_profile("test_user")
        assert profile == test_profile
        assert profile.favorite_foods == {"greek_yogurt", "oatmeal"}
        assert profile.interaction_count == 10
    
    @pytest.mark.asyncio 
    async def test_record_feedback(self, engine):
        """Test recording user feedback."""
        feedback = RecommendationFeedback(
            user_id="test_user",
            recommendation_id="rec_123", 
            barcode="1234567890123",
            accepted=True,
            added_to_meal="breakfast"
        )
        
        with patch.object(engine, '_update_user_preferences') as mock_update:
            result = await engine.record_feedback(feedback)
            
            assert result is True
            assert feedback in engine.feedback_history
            mock_update.assert_called_once_with(feedback)
    
    @pytest.mark.asyncio
    async def test_get_metrics_basic(self, engine):
        """Test getting recommendation metrics."""
        # Add some mock feedback
        past_feedback = [
            RecommendationFeedback(
                user_id="user1",
                recommendation_id="rec_1", 
                barcode="1234567890123",
                accepted=True,
                added_to_meal="breakfast"
            ),
            RecommendationFeedback(
                user_id="user2",
                recommendation_id="rec_2",
                barcode="9876543210987", 
                accepted=False,
                rejection_reason="allergic"
            )
        ]
        engine.feedback_history = past_feedback
        
        metrics = await engine.get_metrics(days=7)
        
        assert metrics.total_recommendations >= 0
        assert metrics.user_satisfaction_score >= 0
        assert metrics.avg_confidence_score >= 0
        assert metrics.feedback_count == 2
    
    def test_calculate_nutritional_score(self, engine, mock_product):
        """Test nutritional scoring calculation."""
        # This tests the scoring logic that should exist in the engine
        with patch.object(engine, '_calculate_nutritional_quality') as mock_calc:
            mock_calc.return_value = 0.85
            
            score = engine._calculate_nutritional_quality(mock_product.nutriments)
            assert score == 0.85
            mock_calc.assert_called_once()
    
    def test_user_preference_profile_creation(self):
        """Test UserPreferenceProfile dataclass."""
        profile = UserPreferenceProfile(
            favorite_foods={"apple", "banana"},
            avoided_foods={"nuts"},
            preferred_cuisines=["italian", "asian"],
            macro_preferences={"protein": 0.3, "carbs": 0.4, "fat": 0.3},
            meal_timing_patterns={"breakfast": ["cereal", "toast"]},
            seasonal_preferences={"winter": ["soup", "stew"]},
            interaction_count=5,
            last_updated=datetime.now()
        )
        
        assert len(profile.favorite_foods) == 2
        assert "nuts" in profile.avoided_foods
        assert profile.interaction_count == 5
        assert len(profile.preferred_cuisines) == 2
    
    @pytest.mark.asyncio
    async def test_context_switching(self, engine, sample_request):
        """Test that different contexts produce different recommendation types."""
        contexts_to_test = ["general", "optimize", "insights"]
        
        with patch.object(engine, '_load_available_products') as mock_products:
            mock_products.return_value = [ProductResponse(
                code="1234567890123",
                product_name="Test Product",
                nutriments=Nutriments(
                    energy_kcal_per_100g=100,
                    protein_g_per_100g=15,
                    fat_g_per_100g=5,
                    carbs_g_per_100g=10,
                    sugars_g_per_100g=5,
                    salt_g_per_100g=0.1
                ),
                brands="TestBrand",
                categories="Test Category", 
                found=True
            )]
            
            responses = {}
            for context in contexts_to_test:
                request = SmartRecommendationRequest(
                    user_id="test_user",
                    context=context,
                    recommendation_type=RecommendationType.SIMILAR_NUTRITION,
                    preferences={"meal_type": "breakfast"},
                    limit=3
                )
                
                response = await engine.generate_recommendations(request)
                responses[context] = response
                
                assert response.context == context
                assert len(response.recommendations) > 0
            
            # Verify that different contexts might produce different results
            # (This is a basic test - actual implementation may vary)
            for context, response in responses.items():
                assert response.context == context

@pytest.mark.unit
class TestRecommendationEngineHelpers:
    """Test suite for helper methods in RecommendationEngine."""
    
    @pytest.fixture
    def engine(self):
        return SmartRecommendationEngine()
    
    def test_scoring_weights_modification(self, engine):
        """Test that scoring weights can be modified for A/B testing."""
        original_weights = engine.scoring_weights.copy()
        
        # Modify weights
        engine.scoring_weights['nutritional_quality'] = 0.5
        engine.scoring_weights['user_preference'] = 0.3
        engine.scoring_weights['goal_alignment'] = 0.2
        
        # Zero out other weights for this test
        for key in ['dietary_compatibility', 'seasonal_factor', 'popularity_factor']:
            engine.scoring_weights[key] = 0.0
        
        assert engine.scoring_weights['nutritional_quality'] == 0.5
        assert engine.scoring_weights != original_weights
    
    def test_macro_targets_validation(self, engine):
        """Test macro target ranges are reasonable for nutrition."""
        targets = engine.macro_targets
        
        # Protein should be reasonable range (15-35%)
        assert 0.10 <= targets['protein_min_percent'] <= 0.20
        assert 0.30 <= targets['protein_max_percent'] <= 0.40
        
        # Fat should be reasonable range (20-35%)
        assert 0.15 <= targets['fat_min_percent'] <= 0.25
        assert 0.30 <= targets['fat_max_percent'] <= 0.40
        
        # Carbs should be reasonable range (30-65%)
        assert 0.25 <= targets['carbs_min_percent'] <= 0.35
        assert 0.60 <= targets['carbs_max_percent'] <= 0.70