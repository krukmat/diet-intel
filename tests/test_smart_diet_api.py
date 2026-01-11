import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from httpx import AsyncClient
import json

from main import app
from app.models.smart_diet import (
    SmartDietRequest, SmartDietResponse, SmartSuggestion, 
    SuggestionFeedback, SmartDietContext, SuggestionType, SuggestionCategory,
    SmartDietInsights
)
from app.models.meal_plan import MealPlanResponse, Meal, MealItem, MealItemMacros, DailyMacros, ChangeLogEntry

@pytest.mark.integration
class TestSmartDietAPI:
    """Integration tests for Smart Diet API endpoints."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)
    
    @pytest.fixture
    async def async_client(self):
        """Create async test client."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac
    
    @pytest.fixture
    def mock_auth_user(self):
        """Mock authenticated user."""
        return "test_user_123"
    
    @pytest.fixture
    def sample_smart_suggestion(self):
        """Sample Smart Diet suggestion."""
        return SmartSuggestion(
            id="suggestion_001",
            type="food_discovery",
            title="Greek Yogurt with Berries",
            description="High-protein breakfast option",
            confidence_score=0.85,
            nutritional_impact="Improves protein intake by 15g",
            food_items=[
                {
                    "name": "Greek Yogurt",
                    "barcode": "1234567890123",
                    "quantity": "1 cup",
                    "calories": 100,
                    "protein": 15,
                    "carbs": 6,
                    "fat": 0
                }
            ],
            metadata={
                "reasons": ["High protein content", "Low calories"],
                "meal_timing": "breakfast"
            }
        )
    
    @patch('app.utils.auth_context.get_session_user_id')
    @patch('app.services.smart_diet.smart_diet_engine.get_smart_suggestions')
    def test_get_smart_diet_suggestions_success(self, mock_get_suggestions, mock_auth, client):
        """Test successful Smart Diet suggestions retrieval."""
        # Mock auth
        mock_auth.return_value = "test_user_123"
        
        # Create sample suggestion for testing
        sample_suggestion = SmartSuggestion(
            id="test_suggestion_001",
            suggestion_type=SuggestionType.RECOMMENDATION,
            category=SuggestionCategory.DISCOVERY,
            title="Greek Yogurt with Berries",
            description="High-protein breakfast option",
            reasoning="Great source of protein and probiotics",
            suggested_item={"name": "Greek Yogurt", "barcode": "1234567890123"},
            confidence_score=0.85,
            planning_context=SmartDietContext.TODAY
        )
        
        # Mock response
        mock_response = SmartDietResponse(
            user_id="test_user_123",
            context_type=SmartDietContext.TODAY,
            suggestions=[sample_suggestion],
            optimizations=[],
            discoveries=[],
            insights=[],
            total_suggestions=1,
            avg_confidence=0.85,
            nutritional_summary={
                "total_calories": 100,
                "macro_distribution": {"protein_percent": 60.0}
            }
        )
        mock_get_suggestions.return_value = mock_response
        
        # Make request
        response = client.get("/smart-diet/suggestions?context=today&max_suggestions=5")
        
        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == "test_user_123"
        assert data["total_suggestions"] == 1
        assert data["avg_confidence"] == 0.85
        
        # Verify service was called
        mock_get_suggestions.assert_called_once()
        
    @patch('app.utils.auth_context.get_session_user_id')
    @patch('app.services.smart_diet.smart_diet_engine.get_smart_suggestions')
    def test_get_smart_diet_suggestions_no_auth(self, mock_get_suggestions, mock_auth, client):
        """Test Smart Diet suggestions for anonymous sessions."""
        mock_auth.return_value = "anon_test_user"

        mock_response = SmartDietResponse(
            user_id="anon_test_user",
            context_type=SmartDietContext.TODAY,
            suggestions=[],
            optimizations=[],
            discoveries=[],
            insights=[],
            total_suggestions=0,
            avg_confidence=0.0,
            nutritional_summary={}
        )
        mock_get_suggestions.return_value = mock_response

        response = client.get("/smart-diet/suggestions")

        assert response.status_code == 200
        assert response.json()["user_id"] == "anon_test_user"
        mock_get_suggestions.assert_called_once()
    
    def test_get_smart_diet_suggestions_invalid_context(self, client):
        """Test Smart Diet suggestions with invalid context."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth:
            mock_auth.return_value = "test_user_123"

            response = client.get("/smart-diet/suggestions?context=invalid")

            # Route performs domain validation and returns 400
            assert response.status_code == 400
    
    def test_get_smart_diet_suggestions_optimization_no_meal_plan(self, client):
        """Test optimization context without meal plan ID."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth:
            mock_auth.return_value = "test_user_123"

            response = client.get("/smart-diet/suggestions?context=optimize")

            # Domain validation sends HTTP 400 for missing plan ID
            assert response.status_code == 400
    
    def test_get_smart_diet_suggestions_invalid_parameters(self, client):
        """Test Smart Diet suggestions with invalid parameters."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth:
            mock_auth.return_value = "test_user_123"
            
            # Test invalid max_suggestions
            response = client.get("/smart-diet/suggestions?max_suggestions=100")
            assert response.status_code == 400
            
            # Test invalid min_confidence
            response = client.get("/smart-diet/suggestions?min_confidence=1.5")
            assert response.status_code == 400
            
            # Test invalid meal_context
            response = client.get("/smart-diet/suggestions?meal_context=invalid")
            assert response.status_code == 400
    
    def test_submit_smart_diet_feedback_success(self, client):
        """Test successful Smart Diet feedback submission."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth, \
             patch('app.services.smart_diet.smart_diet_engine.process_suggestion_feedback') as mock_feedback:
            
            mock_auth.return_value = "test_user_123"
            mock_feedback.return_value = True
            
            feedback_data = {
                "user_id": "test_user_123",
                "suggestion_id": "suggestion_001",
                "action": "accepted",
                "satisfaction_rating": 5,
                "meal_context": "breakfast"
            }
            
            response = client.post("/smart-diet/feedback", json=feedback_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["message"] == "Smart Diet feedback recorded successfully"
            assert data["suggestion_id"] == "suggestion_001"
            assert data["action"] == "accepted"
    
    def test_submit_smart_diet_feedback_no_auth(self, client):
        """Test Smart Diet feedback without authentication."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth:
            mock_auth.return_value = None
            
            feedback_data = {
                "user_id": "test_user_123",
                "suggestion_id": "suggestion_001",
                "action": "accepted"
            }
            
            response = client.post("/smart-diet/feedback", json=feedback_data)
            
            assert response.status_code == 401
            assert "Authentication required" in response.json()["detail"]
    
    def test_submit_smart_diet_feedback_user_mismatch(self, client):
        """Test Smart Diet feedback with mismatched user ID."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth:
            mock_auth.return_value = "different_user_456"

            feedback_data = {
                "user_id": "test_user_123",
                "suggestion_id": "suggestion_001",
                "action": "accepted"
            }

            response = client.post("/smart-diet/feedback", json=feedback_data)

            # Domain validation enforces 400 for mismatch
            assert response.status_code == 400

    @patch('app.utils.auth_context.get_session_user_id')
    @patch('app.routes.smart_diet.plan_storage.update_plan', new_callable=AsyncMock)
    @patch('app.routes.smart_diet.plan_storage.get_plan', new_callable=AsyncMock)
    @patch('app.routes.smart_diet.plan_customizer.customize_plan', new_callable=AsyncMock)
    def test_apply_optimizations_swap_success(
        self,
        mock_customize_plan,
        mock_get_plan,
        mock_update_plan,
        mock_auth,
        client
    ):
        """Test applying a swap optimization to a plan."""
        mock_auth.return_value = "test_user_123"

        plan = MealPlanResponse(
            bmr=1500,
            tdee=2000,
            daily_calorie_target=1800,
            meals=[
                Meal(
                    name="Breakfast",
                    target_calories=500,
                    actual_calories=400,
                    items=[
                        MealItem(
                            barcode="old_123",
                            name="Old Item",
                            serving="1 serving",
                            calories=200,
                            macros=MealItemMacros(
                                protein_g=10,
                                fat_g=5,
                                carbs_g=20
                            ),
                        )
                    ],
                )
            ],
            metrics=DailyMacros(
                total_calories=1800,
                protein_g=100,
                fat_g=60,
                carbs_g=200,
                sugars_g=20,
                salt_g=5,
                protein_percent=20,
                fat_percent=30,
                carbs_percent=50,
            ),
            plan_id="plan_123",
            flexibility_used=False,
            optional_products_used=0,
            is_active=True,
        )

        mock_get_plan.return_value = plan
        mock_update_plan.return_value = True
        mock_customize_plan.return_value = (
            plan,
            [ChangeLogEntry(change_type="swap", description="Swapped item")]
        )

        response = client.post("/smart-diet/optimizations/apply", json={
            "plan_id": "plan_123",
            "changes": [
                {
                    "change_type": "meal_swap",
                    "old_barcode": "old_123",
                    "new_barcode": "new_456"
                }
            ]
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["applied"] == 1
        assert len(data["change_log"]) == 1
    
    def test_submit_smart_diet_feedback_invalid_data(self, client):
        """Test Smart Diet feedback with invalid data."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth:
            mock_auth.return_value = "test_user_123"

            # Test invalid action
            feedback_data = {
                "user_id": "test_user_123",
                "suggestion_id": "suggestion_001",
                "action": "invalid_action"
            }

            response = client.post("/smart-diet/feedback", json=feedback_data)
            assert response.status_code == 400

            # Test invalid satisfaction rating
            feedback_data = {
                "user_id": "test_user_123",
                "suggestion_id": "suggestion_001",
                "action": "accepted",
                "satisfaction_rating": 6
            }

            response = client.post("/smart-diet/feedback", json=feedback_data)
            # Pydantic bounds trigger standard FastAPI validation (422)
            assert response.status_code == 422
    
    def test_get_diet_insights_success(self, client):
        """Test successful diet insights retrieval."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth, \
             patch('app.services.smart_diet.smart_diet_engine.get_diet_insights') as mock_insights:
            
            mock_auth.return_value = "test_user_123"
            
            # Mock insights response using SmartDietInsights model
            mock_insights.return_value = SmartDietInsights(
                user_id="test_user_123",
                period="week",
                successful_suggestions=[],
                priority_improvements=[],
                improvement_score=0.75
            )
            
            response = client.get("/smart-diet/insights?period=week")
            
            assert response.status_code == 200
            # Further assertions would depend on actual SmartDietInsights model
    
    def test_get_diet_insights_no_auth(self, client):
        """Test diet insights without authentication."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth:
            mock_auth.return_value = None
            
            response = client.get("/smart-diet/insights")
            
            assert response.status_code == 401
            assert "Authentication required" in response.json()["detail"]
    
    def test_get_diet_insights_invalid_period(self, client):
        """Test diet insights with invalid period."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth:
            mock_auth.return_value = "test_user_123"

            response = client.get("/smart-diet/insights?period=invalid")

            # Endpoint normalizes errors as 400
            assert response.status_code == 400
    
    def test_apply_optimization_suggestion_success(self, client):
        """Test successful optimization application."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth:
            mock_auth.return_value = "test_user_123"
            
            response = client.post("/smart-diet/apply-optimization?suggestion_id=optimization_001")
            
            assert response.status_code == 200
            data = response.json()
            assert data["message"] == "Optimization applied successfully"
            assert data["suggestion_id"] == "optimization_001"
            assert data["meal_plan_updated"] is True
    
    def test_apply_optimization_suggestion_no_auth(self, client):
        """Test optimization application without authentication."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth:
            mock_auth.return_value = None
            
            response = client.post("/smart-diet/apply-optimization?suggestion_id=optimization_001")
            
            assert response.status_code == 401
            assert "Authentication required" in response.json()["detail"]
    
    def test_apply_optimization_suggestion_no_id(self, client):
        """Test optimization application without suggestion ID."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth:
            mock_auth.return_value = "test_user_123"
            
            response = client.post("/smart-diet/apply-optimization")
            
            assert response.status_code == 422  # FastAPI validation error
    
    def test_get_smart_diet_metrics_success(self, client):
        """Test successful Smart Diet metrics retrieval."""
        with patch.object(app.smart_diet_engine, 'suggestion_history', []):
            response = client.get("/smart-diet/metrics?days=30")
            
            assert response.status_code == 200
            data = response.json()
            assert "period_days" in data
            assert "total_suggestions" in data
            assert "unique_users" in data
            assert "overall_acceptance_rate" in data
    
    def test_get_smart_diet_metrics_invalid_days(self, client):
        """Test Smart Diet metrics with invalid days parameter."""
        response = client.get("/smart-diet/metrics?days=400")

        # Metrics endpoint returns 400 for invalid ranges
        assert response.status_code == 400
    
    def test_legacy_generate_endpoint_deprecated(self, client):
        """Test deprecated legacy generate endpoint."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth, \
             patch('app.services.smart_diet.smart_diet_engine.get_smart_suggestions') as mock_suggestions:
            
            mock_auth.return_value = "test_user_123"
            mock_suggestions.return_value = SmartDietResponse(
                user_id="test_user_123",
                context_type=SmartDietContext.DISCOVER,
                suggestions=[],
                total_suggestions=0,
                optimizations=[],
                discoveries=[],
                insights=[],
                avg_confidence=0.0
            )
            
            legacy_request = {
                "user_id": "test_user_123",
                "context": "general",
                "max_recommendations": 5,
                "min_confidence": 0.3
            }
            
            response = client.post("/smart-diet/generate", json=legacy_request)
            
            assert response.status_code == 200
            # Should work but be marked as deprecated

@pytest.mark.integration
class TestSmartDietAPIErrorHandling:
    """Integration tests for Smart Diet API error handling."""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_suggestions_service_error(self, client):
        """Test handling of service errors in suggestions endpoint."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth, \
             patch('app.services.smart_diet.smart_diet_engine.get_smart_suggestions') as mock_suggestions:
            
            mock_auth.return_value = "test_user_123"
            mock_suggestions.side_effect = Exception("Service unavailable")
            
            response = client.get("/smart-diet/suggestions")
            
            assert response.status_code == 500
            assert "Error generating Smart Diet suggestions" in response.json()["detail"]
    
    def test_feedback_service_error(self, client):
        """Test handling of service errors in feedback endpoint."""
        with patch('app.utils.auth_context.get_session_user_id') as mock_auth, \
             patch('app.services.smart_diet.smart_diet_engine.process_suggestion_feedback') as mock_feedback:
            
            mock_auth.return_value = "test_user_123"
            mock_feedback.side_effect = Exception("Feedback processing failed")
            
            feedback_data = {
                "user_id": "test_user_123",
                "suggestion_id": "suggestion_001",
                "action": "accepted"
            }
            
            response = client.post("/smart-diet/feedback", json=feedback_data)
            
            assert response.status_code == 500
            assert "Error processing Smart Diet feedback" in response.json()["detail"]
