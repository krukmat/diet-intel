import pytest
import json
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime
from fastapi.testclient import TestClient

from main import app
from app.services.recipe_ai_engine import GeneratedRecipe, RecipeIngredient, RecipeInstruction, RecipeNutrition
from app.models.recipe import UserTasteProfileResponse
from app.models.user import User, UserRole


@pytest.fixture
def client():
    """Provide synchronous TestClient for each test."""
    with TestClient(app) as test_client:
        yield test_client


class TestRecipeAIAPI:
    """Test Recipe AI API endpoints"""

    def setup_method(self):
        """Set up test fixtures"""

        # Create mock user for authentication
        self.mock_user = User(
            id="test_user_123",
            email="test@example.com",
            full_name="Test User",
            is_developer=True,
            role=UserRole.DEVELOPER,
            is_active=True,
            email_verified=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Create sample generated recipe for testing
        self.sample_recipe = GeneratedRecipe(
            id="test_recipe_api_123",
            name="API Test Mediterranean Bowl",
            description="A healthy Mediterranean bowl for API testing",
            cuisine_type="mediterranean",
            difficulty_level="easy",
            prep_time_minutes=20,
            cook_time_minutes=10,
            servings=4,
            ingredients=[
                RecipeIngredient(
                    name="Mixed Greens",
                    quantity=200.0,
                    unit="g",
                    calories_per_unit=20,
                    protein_g_per_unit=2,
                    fat_g_per_unit=0,
                    carbs_g_per_unit=4
                ),
                RecipeIngredient(
                    name="Chickpeas",
                    quantity=150.0,
                    unit="g",
                    calories_per_unit=164,
                    protein_g_per_unit=8,
                    fat_g_per_unit=3,
                    carbs_g_per_unit=27
                )
            ],
            instructions=[
                RecipeInstruction(
                    step_number=1,
                    instruction="Wash and prepare the mixed greens",
                    cooking_method="prep"
                ),
                RecipeInstruction(
                    step_number=2,
                    instruction="Drain and rinse the chickpeas",
                    cooking_method="prep"
                ),
                RecipeInstruction(
                    step_number=3,
                    instruction="Combine greens and chickpeas in a bowl",
                    cooking_method="assembly"
                )
            ],
            nutrition=RecipeNutrition(
                calories_per_serving=171.0,
                protein_g_per_serving=10.0,
                fat_g_per_serving=3.0,
                carbs_g_per_serving=31.0,
                fiber_g_per_serving=8.0,
                sugar_g_per_serving=2.0,
                sodium_mg_per_serving=200.0,
                recipe_score=0.85
            ),
            created_by="ai_generated",
            confidence_score=0.88,
            generation_time_ms=1200.0,
            tags=["mediterranean", "healthy", "vegetarian", "high_protein"]
        )
        self.client = TestClient(app)

    def teardown_method(self):
        """Tear down TestClient after each test."""
        if hasattr(self, "client"):
            self.client.close()
    
    def test_health_check(self, client):
        """Test Recipe AI health check endpoint"""
        response = client.get("/recipe/health")
        
        assert response.status_code == 200
        health_data = response.json()
        assert "recipe_ai_engine" in health_data
        assert "database_connection" in health_data
        assert "version" in health_data
        assert "timestamp" in health_data
        assert health_data["recipe_ai_engine"] == "healthy"
        assert health_data["database_connection"] == "healthy"
    
    @patch('app.routes.recipe_ai.get_current_user')
    @patch('app.routes.recipe_ai.recipe_engine.generate_recipe')
    @patch('app.routes.recipe_ai.recipe_db_service.create_recipe')
    def test_generate_recipe_success(self, mock_create_recipe, mock_generate, mock_auth, client):
        """Test successful recipe generation"""
        # Mock authentication
        mock_auth.return_value = self.mock_user

        # Mock recipe generation
        mock_generate.return_value = self.sample_recipe
        mock_create_recipe.return_value = "test_recipe_api_123"

        # Test request
        request_data = {
            "cuisine_preferences": ["mediterranean"],
            "dietary_restrictions": ["vegetarian"],
            "difficulty_preference": "easy",
            "servings": 4,
            "target_calories_per_serving": 400,
            "cooking_skill_level": "beginner"
        }

        response = client.post(
            "/recipe/generate",
            json=request_data,
            headers={"Authorization": "Bearer fake_token"}
        )
        
        assert response.status_code == 200
        recipe_data = response.json()
        assert recipe_data["name"] == "API Test Mediterranean Bowl"
        assert recipe_data["cuisine_type"] == "mediterranean"
        assert recipe_data["difficulty_level"] == "easy"
        assert recipe_data["servings"] == 4
        assert len(recipe_data["ingredients"]) == 2
        assert len(recipe_data["instructions"]) == 3
        assert "nutrition" in recipe_data
        assert recipe_data["confidence_score"] == 0.88
    
    @patch('app.routes.recipe_ai.get_current_user')
    def test_generate_recipe_unauthorized(self, mock_auth, client):
        """Test recipe generation without authentication"""
        response = client.post("/recipe/generate", json={})

        assert response.status_code == 401

    @patch('app.routes.recipe_ai.get_current_user')
    @patch('app.routes.recipe_ai.recipe_engine.optimize_existing_recipe')
    @patch('app.routes.recipe_ai.recipe_db_service.create_recipe')
    def test_optimize_recipe_success(self, mock_create_recipe, mock_optimize, mock_auth, client):
        """Test successful recipe optimization"""
        # Mock authentication
        mock_auth.return_value = self.mock_user

        # Mock recipe optimization
        optimized_recipe = self.sample_recipe
        optimized_recipe.tags.append("optimized")
        mock_optimize.return_value = optimized_recipe
        mock_create_recipe.return_value = "optimized_recipe_123"

        request_data = {
            "recipe_data": {
                "name": "Original Recipe",
                "ingredients": [{"name": "ingredient1", "quantity": 100, "unit": "g"}]
            },
            "optimization_goal": "weight_loss",
            "dietary_restrictions": ["vegetarian"]
        }

        response = client.post(
            "/recipe/optimize",
            json=request_data,
            headers={"Authorization": "Bearer fake_token"}
        )
        
        assert response.status_code == 200
        recipe_data = response.json()
        assert "optimized" in recipe_data["tags"] or "mediterranean" in recipe_data["tags"]
    
    @patch('app.routes.recipe_ai.get_current_user')
    @patch('app.routes.recipe_ai.recipe_db_service.search_recipes')
    def test_get_recipe_suggestions(self, mock_search, mock_auth, client):
        """Test getting recipe suggestions"""
        # Mock authentication
        mock_auth.return_value = self.mock_user

        # Mock search results
        mock_search.return_value = [
            {
                "id": "suggestion_1",
                "name": "Suggested Recipe 1",
                "cuisine_type": "mediterranean"
            },
            {
                "id": "suggestion_2",
                "name": "Suggested Recipe 2",
                "cuisine_type": "italian"
            }
        ]

        response = client.get(
            "/recipe/suggestions?context=breakfast&limit=5",
            headers={"Authorization": "Bearer fake_token"}
        )
        
        assert response.status_code == 200
        suggestions_data = response.json()
        assert "suggestions" in suggestions_data
        assert suggestions_data["context"] == "breakfast"
        assert suggestions_data["count"] == 2
        assert len(suggestions_data["suggestions"]) == 2
    
    @patch('app.routes.recipe_ai.recipe_db_service.get_recipe')
    def test_get_recipe_by_id_success(self, mock_get_recipe, client):
        """Test getting recipe by ID"""
        # Mock recipe retrieval
        mock_get_recipe.return_value = self.sample_recipe

        response = client.get("/recipe/test_recipe_api_123")

        assert response.status_code == 200
        recipe_data = response.json()
        assert recipe_data["id"] == "test_recipe_api_123"
        assert recipe_data["name"] == "API Test Mediterranean Bowl"

    @patch('app.routes.recipe_ai.recipe_db_service.get_recipe')
    def test_get_recipe_by_id_not_found(self, mock_get_recipe, client):
        """Test getting non-existent recipe"""
        # Mock recipe not found
        mock_get_recipe.return_value = None

        response = client.get("/recipe/nonexistent_recipe")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    @patch('app.routes.recipe_ai.recipe_db_service.search_recipes')
    def test_search_recipes(self, mock_search, client):
        """Test recipe search functionality"""
        # Mock search results
        mock_search.return_value = [
            {
                "id": "search_result_1",
                "name": "Mediterranean Salad",
                "cuisine_type": "mediterranean",
                "difficulty_level": "easy"
            }
        ]

        response = client.get(
            "/recipe/search?cuisine_type=mediterranean&difficulty_level=easy&page=1&page_size=10"
        )

        assert response.status_code == 200
        search_data = response.json()
        assert "recipes" in search_data
        assert search_data["page"] == 1
        assert search_data["page_size"] == 10
        assert len(search_data["recipes"]) == 1
    
    @patch('app.routes.recipe_ai.get_current_user')
    @patch('app.routes.recipe_ai.recipe_db_service.get_recipe')
    @patch('app.routes.recipe_ai.recipe_db_service.rate_recipe')
    def test_rate_recipe_success(self, mock_rate_recipe, mock_get_recipe, mock_auth, client):
        """Test rating a recipe"""
        # Mock authentication
        mock_auth.return_value = self.mock_user

        # Mock recipe exists
        mock_get_recipe.return_value = self.sample_recipe
        mock_rate_recipe.return_value = "rating_123"

        rating_data = {
            "rating": 5,
            "review": "Excellent recipe!",
            "made_modifications": False,
            "would_make_again": True
        }

        response = client.post(
            "/recipe/test_recipe_api_123/rate",
            json=rating_data,
            headers={"Authorization": "Bearer fake_token"}
        )

        assert response.status_code == 200
        result = response.json()
        assert result["rating"] == 5
        assert result["recipe_id"] == "test_recipe_api_123"
        assert "successfully" in result["message"]

    @patch('app.routes.recipe_ai.recipe_db_service.get_recipe_ratings')
    def test_get_recipe_ratings(self, mock_get_ratings, client):
        """Test getting recipe ratings statistics"""
        # Mock rating statistics
        mock_get_ratings.return_value = {
            "total_ratings": 10,
            "average_rating": 4.5,
            "would_make_again_percentage": 80.0
        }

        response = client.get("/recipe/test_recipe_api_123/ratings")

        assert response.status_code == 200
        ratings_data = response.json()
        assert ratings_data["total_ratings"] == 10
        assert ratings_data["average_rating"] == 4.5
        assert ratings_data["would_make_again_percentage"] == 80.0

    @patch('app.routes.recipe_ai.get_current_user')
    @patch('app.routes.recipe_ai.recipe_engine.generate_shopping_list')
    @patch('app.routes.recipe_ai.recipe_db_service.create_shopping_list')
    def test_generate_shopping_list(self, mock_create_list, mock_generate_list, mock_auth, client):
        """Test shopping list generation"""
        # Mock authentication
        mock_auth.return_value = self.mock_user

        # Mock shopping list generation
        mock_generate_list.return_value = {
            "ingredients": [
                {"name": "Mixed Greens", "total_quantity": 200, "unit": "g"},
                {"name": "Chickpeas", "total_quantity": 150, "unit": "g"}
            ],
            "estimated_cost": 8.50
        }
        mock_create_list.return_value = "shopping_list_123"

        request_data = {
            "name": "Weekly Shopping List",
            "recipe_ids": ["recipe_1", "recipe_2"]
        }

        response = client.post(
            "/recipe/shopping-list",
            json=request_data,
            headers={"Authorization": "Bearer fake_token"}
        )

        assert response.status_code == 200
        shopping_data = response.json()
        assert shopping_data["name"] == "Weekly Shopping List"
        assert len(shopping_data["recipe_ids"]) == 2
        assert "ingredients" in shopping_data

    def test_analyze_recipe_nutrition(self, client):
        """Test recipe nutrition analysis"""
        recipe_data = {
            "name": "Test Recipe",
            "ingredients": [
                {"name": "ingredient1", "quantity": 100, "unit": "g"}
            ]
        }

        response = client.post("/recipe/nutrition-analysis", json=recipe_data)

        assert response.status_code == 200
        analysis_data = response.json()
        assert "analysis" in analysis_data
        assert analysis_data["recipe_data_received"] == True
    
    @patch('app.routes.recipe_ai.get_current_user')
    @patch('app.routes.recipe_ai.recipe_db_service.get_recipe_analytics')
    def test_get_analytics_success(self, mock_get_analytics, mock_auth):
        """Test getting analytics (developer only)"""
        # Mock authentication as developer
        mock_auth.return_value = self.mock_user
        
        # Mock analytics data
        mock_get_analytics.return_value = {
            "period_days": 30,
            "generation_stats": {
                "total_requests": 100,
                "successful_requests": 95,
                "success_rate": 0.95
            },
            "popular_cuisines": [
                {"cuisine_type": "mediterranean", "count": 25}
            ],
            "rating_stats": {
                "average_rating": 4.2,
                "total_ratings": 50
            }
        }
        
        response = self.client.get(
            "/recipe/analytics?days=30",
            headers={"Authorization": "Bearer fake_token"}
        )
        
        assert response.status_code == 200
        analytics_data = response.json()
        assert analytics_data["period_days"] == 30
        assert "generation_stats" in analytics_data
        assert "popular_cuisines" in analytics_data
        assert "rating_stats" in analytics_data
    
    @patch('app.routes.recipe_ai.get_current_user')
    def test_get_analytics_unauthorized(self, mock_auth):
        """Test analytics access denied for non-developers"""
        # Mock authentication as regular user
        regular_user = self.mock_user
        regular_user.is_developer = False
        mock_auth.return_value = regular_user
        
        response = self.client.get(
            "/recipe/analytics",
            headers={"Authorization": "Bearer fake_token"}
        )
        
        assert response.status_code == 403
        assert "denied" in response.json()["detail"].lower()
    
    @patch('app.routes.recipe_ai.get_current_user')
    def test_submit_feedback(self, mock_auth):
        """Test submitting recipe feedback"""
        # Mock authentication
        mock_auth.return_value = self.mock_user
        
        feedback_data = {
            "recipe_id": "test_recipe_123",
            "feedback_type": "improvement",
            "comments": "Great recipe, could use more spice"
        }
        
        response = self.client.post(
            "/recipe/feedback",
            json=feedback_data,
            headers={"Authorization": "Bearer fake_token"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert "feedback_id" in result
        assert result["status"] == "received"
    
    def test_api_validation_errors(self):
        """Test API validation for invalid requests"""
        # Test invalid recipe generation request
        invalid_request = {
            "servings": -1,  # Invalid negative servings
            "difficulty_preference": "impossible"  # Invalid difficulty
        }
        
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth:
            mock_auth.return_value = self.mock_user
            
            response = self.client.post(
                "/recipe/generate",
                json=invalid_request,
                headers={"Authorization": "Bearer fake_token"}
            )
            
            assert response.status_code == 422  # Validation error
    
    def test_error_handling(self):
        """Test API error handling"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.recipe_engine.generate_recipe') as mock_generate:
            
            mock_auth.return_value = self.mock_user
            mock_generate.side_effect = Exception("Recipe generation failed")
            
            request_data = {
                "cuisine_preferences": ["italian"],
                "difficulty_preference": "easy"
            }
            
            response = self.client.post(
                "/recipe/generate",
                json=request_data,
                headers={"Authorization": "Bearer fake_token"}
            )
            
            assert response.status_code == 500
            error_data = response.json()
            assert "error_code" in error_data["detail"]
            assert "suggestions" in error_data["detail"]

    def test_learn_user_preferences_success(self):
        """Test taste learning path when data is available"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.taste_learning_service.analyze_cuisine_preferences', new_callable=AsyncMock) as mock_analyze_cuisine, \
             patch('app.routes.recipe_ai.taste_learning_service.update_cuisine_preferences_in_db', new_callable=AsyncMock) as mock_update_cuisine, \
             patch('app.routes.recipe_ai.taste_learning_service.analyze_ingredient_preferences', new_callable=AsyncMock) as mock_analyze_ingredients, \
             patch('app.routes.recipe_ai.taste_learning_service.update_ingredient_preferences_in_db', new_callable=AsyncMock) as mock_update_ingredients, \
             patch('app.routes.recipe_ai.recipe_db_service.create_or_update_user_taste_profile', new_callable=AsyncMock) as mock_save_profile:

            mock_auth.return_value = self.mock_user
            mock_analyze_cuisine.return_value = {
                "confidence_score": 0.75,
                "total_ratings_analyzed": 12,
                "cuisine_preferences": {
                    "mediterranean": {"raw_score": 0.82, "total_ratings": 6}
                }
            }
            mock_analyze_ingredients.return_value = {
                "ingredient_preferences": {
                    "tomato": {"raw_score": 0.9, "total_occurrences": 5},
                    "pepper": {"raw_score": -0.6, "total_occurrences": 3}
                },
                "categorized_ingredients": {
                    "loved": ["tomato"],
                    "liked": [],
                    "disliked": ["pepper"],
                    "avoided": []
                },
                "error": False
            }

            response = self.client.post(
                "/recipe/learn-preferences",
                json={"user_id": self.mock_user.id, "learning_data": {"dummy": True}},
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 200
            payload = response.json()
            assert payload["user_id"] == self.mock_user.id
            assert payload["profile_confidence"] == 0.75
            mock_save_profile.assert_awaited_once()

    def test_learn_user_preferences_insufficient_data(self):
        """Should return 400 when cuisine learning cannot proceed"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.taste_learning_service.analyze_cuisine_preferences', new_callable=AsyncMock) as mock_analyze_cuisine:
            mock_auth.return_value = self.mock_user
            mock_analyze_cuisine.return_value = {"error": "need more ratings"}

            response = self.client.post(
                "/recipe/learn-preferences",
                json={"user_id": self.mock_user.id},
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 400
            assert "Insufficient data" in response.json()["detail"]

    def test_get_user_taste_profile_triggers_learning_when_missing(self):
        """Fall back to taste learning when profile is absent"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.recipe_db_service.get_user_taste_profile', new_callable=AsyncMock) as mock_get_profile, \
             patch('app.routes.recipe_ai.learn_user_preferences', new_callable=AsyncMock) as mock_learn:

            mock_auth.return_value = self.mock_user
            mock_get_profile.return_value = None
            profile_payload = UserTasteProfileResponse(
                user_id=self.mock_user.id,
                profile_confidence=0.65,
                total_ratings_analyzed=7,
                cuisine_preferences=[],
                difficulty_preferences={},
                liked_ingredients=[],
                disliked_ingredients=[],
                cooking_method_preferences={},
                preferred_prep_time_minutes=30,
                preferred_cook_time_minutes=45,
                quick_meal_preference=0.5,
                preferred_calories_per_serving=420.0,
                preferred_protein_ratio=0.25,
                preferred_carb_ratio=0.45,
                preferred_fat_ratio=0.3,
                modification_tendency=0.2,
                repeat_cooking_tendency=0.4,
                last_learning_update=datetime.now(),
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            mock_learn.return_value = profile_payload

            response = self.client.get(
                f"/recipe/preferences/{self.mock_user.id}",
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 200
            assert response.json()["user_id"] == self.mock_user.id
            mock_learn.assert_awaited_once()

    def test_get_user_learning_progress_initializes_record(self):
        """Should create baseline progress record when none exists"""
        class _DummyCursor:
            def execute(self, *args, **kwargs):
                return None

        class _DummyConnection:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def cursor(self):
                return _DummyCursor()

            def commit(self):
                return None

        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.recipe_db_service.get_user_learning_progress', new_callable=AsyncMock) as mock_progress, \
             patch('app.routes.recipe_ai.recipe_db_service.get_connection', return_value=_DummyConnection()):

            mock_auth.return_value = self.mock_user
            mock_progress.return_value = None

            response = self.client.get(
                f"/recipe/preferences/{self.mock_user.id}/progress",
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 200
            assert response.json()["ratings_milestone"] == 0

    def test_generate_personalized_recipe_applies_taste_profile(self):
        """Ensure personalized generation extends base request with learned data"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.recipe_db_service.get_user_taste_profile', new_callable=AsyncMock) as mock_profile, \
             patch('app.routes.recipe_ai.recipe_engine.generate_recipe', new_callable=AsyncMock) as mock_generate, \
             patch('app.routes.recipe_ai.recipe_db_service.create_recipe', new_callable=AsyncMock) as mock_create_recipe:

            mock_auth.return_value = self.mock_user
            mock_profile.return_value = {
                "profile_confidence": 0.8,
                "preferred_prep_time_minutes": 25,
                "preferred_cook_time_minutes": 30,
                "preferred_calories_per_serving": 360,
                "cuisine_preferences": [{"cuisine": "mediterranean", "score": 0.9}],
                "disliked_ingredients": [{"ingredient": "garlic", "preference": -0.7}],
                "liked_ingredients": [{"ingredient": "tomato", "preference": 0.95}],
            }
            mock_generate.return_value = self.sample_recipe
            mock_create_recipe.return_value = "personalized_recipe_id"

            payload = {
                "user_id": self.mock_user.id,
                "use_taste_profile": True,
                "base_request": {
                    "cuisine_preferences": [],
                    "dietary_restrictions": [],
                    "difficulty_preference": "easy",
                    "meal_type": "lunch",
                    "servings": 2,
                    "preferred_ingredients": [],
                    "excluded_ingredients": [],
                    "max_prep_time_minutes": None,
                    "max_cook_time_minutes": None,
                    "target_calories_per_serving": None,
                    "target_protein_g": None,
                    "target_carbs_g": None,
                    "target_fat_g": None,
                    "target_language": "en",
                    "cooking_skill_level": "beginner",
                    "available_equipment": []
                }
            }

            response = self.client.post(
                "/recipe/generate-personalized",
                json=payload,
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 200
            engine_request = mock_generate.await_args.args[0]
            assert "garlic" in engine_request.excluded_ingredients
            assert "tomato" in engine_request.available_ingredients
            mock_create_recipe.assert_awaited_once()
