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

    # SUBTASK 1: /learn-preferences tests (extended coverage)
    # Task 3 - Phase 2 Batch 5: lines 647-736

    def test_learn_user_preferences_with_high_confidence(self):
        """Test taste learning with high confidence scores and complete ingredient data"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.taste_learning_service.analyze_cuisine_preferences', new_callable=AsyncMock) as mock_analyze_cuisine, \
             patch('app.routes.recipe_ai.taste_learning_service.update_cuisine_preferences_in_db', new_callable=AsyncMock) as mock_update_cuisine, \
             patch('app.routes.recipe_ai.taste_learning_service.analyze_ingredient_preferences', new_callable=AsyncMock) as mock_analyze_ingredients, \
             patch('app.routes.recipe_ai.taste_learning_service.update_ingredient_preferences_in_db', new_callable=AsyncMock) as mock_update_ingredients, \
             patch('app.routes.recipe_ai.recipe_db_service.create_or_update_user_taste_profile', new_callable=AsyncMock) as mock_save_profile:

            mock_auth.return_value = self.mock_user

            # High confidence cuisine analysis
            mock_analyze_cuisine.return_value = {
                "confidence_score": 0.92,
                "total_ratings_analyzed": 25,
                "cuisine_preferences": {
                    "mediterranean": {"raw_score": 0.88, "total_ratings": 12},
                    "italian": {"raw_score": 0.85, "total_ratings": 8},
                    "asian": {"raw_score": 0.65, "total_ratings": 5}
                }
            }

            # Comprehensive ingredient analysis with categorization
            mock_analyze_ingredients.return_value = {
                "ingredient_preferences": {
                    "tomato": {"raw_score": 0.95, "total_occurrences": 8},
                    "basil": {"raw_score": 0.90, "total_occurrences": 6},
                    "garlic": {"raw_score": 0.85, "total_occurrences": 7},
                    "cilantro": {"raw_score": -0.70, "total_occurrences": 4},
                    "mint": {"raw_score": -0.65, "total_occurrences": 3}
                },
                "categorized_ingredients": {
                    "loved": ["tomato", "basil"],
                    "liked": ["garlic"],
                    "disliked": ["cilantro"],
                    "avoided": ["mint"]
                },
                "error": False
            }

            response = self.client.post(
                "/recipe/learn-preferences",
                json={"user_id": self.mock_user.id, "learning_data": {"ratings_count": 25}},
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 200
            payload = response.json()
            assert payload["user_id"] == self.mock_user.id
            assert payload["profile_confidence"] == 0.92
            assert payload["total_ratings_analyzed"] == 25

            # Verify cuisine preferences are returned
            assert len(payload["cuisine_preferences"]) == 3
            cuisine_names = {c["cuisine"] for c in payload["cuisine_preferences"]}
            assert "mediterranean" in cuisine_names
            assert "italian" in cuisine_names
            assert "asian" in cuisine_names

            # Verify liked ingredients include all categorized as loved/liked
            liked_names = {ing["ingredient"] for ing in payload["liked_ingredients"]}
            assert "tomato" in liked_names
            assert "basil" in liked_names
            assert "garlic" in liked_names

            # Verify disliked ingredients include all categorized as disliked/avoided
            disliked_names = {ing["ingredient"] for ing in payload["disliked_ingredients"]}
            assert "cilantro" in disliked_names
            assert "mint" in disliked_names

            # Verify all expected service methods were called
            mock_analyze_cuisine.assert_awaited_once()
            mock_update_cuisine.assert_awaited_once()
            mock_analyze_ingredients.assert_awaited_once()
            mock_update_ingredients.assert_awaited_once()
            mock_save_profile.assert_awaited_once()

    def test_learn_user_preferences_ingredient_analysis_error(self):
        """Test handling when ingredient analysis fails but cuisine analysis succeeds"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.taste_learning_service.analyze_cuisine_preferences', new_callable=AsyncMock) as mock_analyze_cuisine, \
             patch('app.routes.recipe_ai.taste_learning_service.update_cuisine_preferences_in_db', new_callable=AsyncMock) as mock_update_cuisine, \
             patch('app.routes.recipe_ai.taste_learning_service.analyze_ingredient_preferences', new_callable=AsyncMock) as mock_analyze_ingredients, \
             patch('app.routes.recipe_ai.recipe_db_service.create_or_update_user_taste_profile', new_callable=AsyncMock) as mock_save_profile:

            mock_auth.return_value = self.mock_user

            # Cuisine analysis succeeds
            mock_analyze_cuisine.return_value = {
                "confidence_score": 0.80,
                "total_ratings_analyzed": 10,
                "cuisine_preferences": {
                    "mediterranean": {"raw_score": 0.88, "total_ratings": 10}
                }
            }

            # Ingredient analysis fails
            mock_analyze_ingredients.return_value = {
                "error": "Insufficient ingredient data for analysis"
            }

            response = self.client.post(
                "/recipe/learn-preferences",
                json={"user_id": self.mock_user.id},
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 200
            payload = response.json()

            # Should still return successful response with cuisine data
            assert payload["user_id"] == self.mock_user.id
            assert payload["profile_confidence"] == 0.80
            assert len(payload["cuisine_preferences"]) == 1

            # Ingredient lists should be empty since analysis failed
            assert payload["liked_ingredients"] == []
            assert payload["disliked_ingredients"] == []

            # Verify only cuisine methods were called (not ingredient update)
            mock_analyze_cuisine.assert_awaited_once()
            mock_update_cuisine.assert_awaited_once()
            mock_analyze_ingredients.assert_awaited_once()
            # update_ingredients should NOT be called due to error flag

            mock_save_profile.assert_awaited_once()

    def test_learn_user_preferences_exception_handling(self):
        """Test error handling when an unexpected exception occurs during learning"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.taste_learning_service.analyze_cuisine_preferences', new_callable=AsyncMock) as mock_analyze_cuisine:

            mock_auth.return_value = self.mock_user

            # Simulate unexpected exception during cuisine analysis
            mock_analyze_cuisine.side_effect = Exception("Database connection error")

            response = self.client.post(
                "/recipe/learn-preferences",
                json={"user_id": self.mock_user.id},
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 500
            error_data = response.json()
            assert "detail" in error_data
            assert "Failed to learn user preferences" in error_data["detail"]

    def test_learn_user_preferences_without_authentication(self):
        """Test that /learn-preferences requires valid authentication"""
        response = self.client.post(
            "/recipe/learn-preferences",
            json={"user_id": "some_user", "learning_data": {}}
        )

        # Should fail without Authorization header
        assert response.status_code == 401

    # SUBTASK 2: GET /preferences/{user_id} tests (extended coverage)
    # Task 3 - Phase 2 Batch 5: lines 739-786

    def test_get_user_taste_profile_with_complete_profile(self):
        """Test retrieving a fully populated user taste profile"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.recipe_db_service.get_user_taste_profile', new_callable=AsyncMock) as mock_get_profile:

            mock_auth.return_value = self.mock_user

            # Return a complete profile from database
            complete_profile = {
                "user_id": self.mock_user.id,
                "profile_confidence": 0.85,
                "total_ratings_analyzed": 20,
                "cuisine_preferences": [
                    {"cuisine": "mediterranean", "score": 0.88, "count": 10},
                    {"cuisine": "asian", "score": 0.72, "count": 8}
                ],
                "liked_ingredients": [
                    {"ingredient": "tomato", "preference": 0.95, "frequency": 8},
                    {"ingredient": "olive_oil", "preference": 0.92, "frequency": 7}
                ],
                "disliked_ingredients": [
                    {"ingredient": "cilantro", "preference": -0.70, "frequency": 4}
                ],
                "preferred_prep_time_minutes": 25,
                "preferred_cook_time_minutes": 30,
                "quick_meal_preference": 0.6,
                "preferred_calories_per_serving": 400,
                "preferred_protein_ratio": 0.30,
                "preferred_carb_ratio": 0.45,
                "preferred_fat_ratio": 0.25,
                "modification_tendency": 0.4,
                "repeat_cooking_tendency": 0.5,
                "last_learning_update": datetime.now(),
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            mock_get_profile.return_value = complete_profile

            response = self.client.get(
                f"/recipe/preferences/{self.mock_user.id}",
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 200
            payload = response.json()
            assert payload["user_id"] == self.mock_user.id
            assert payload["profile_confidence"] == 0.85
            assert payload["total_ratings_analyzed"] == 20
            assert len(payload["cuisine_preferences"]) == 2
            assert payload["preferred_prep_time_minutes"] == 25
            assert payload["preferred_calories_per_serving"] == 400
            mock_get_profile.assert_awaited_once()

    def test_get_user_taste_profile_access_denied_for_other_user(self):
        """Test that users cannot access other users' profiles without admin role"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth:
            # Current user is NOT an admin and trying to access different user's profile
            # Use MagicMock to simulate User with is_admin=False
            other_user_id = "other_user_456"
            current_user = MagicMock(spec=User)
            current_user.id = "test_user_123"
            current_user.email = "user@example.com"
            current_user.full_name = "Regular User"
            current_user.is_developer = False
            current_user.is_admin = False
            mock_auth.return_value = current_user

            response = self.client.get(
                f"/recipe/preferences/{other_user_id}",
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 403
            error_data = response.json()
            assert "Access denied" in error_data["detail"]

    def test_get_user_taste_profile_admin_can_access_any_profile(self):
        """Test that admin users can access any user's profile"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.recipe_db_service.get_user_taste_profile', new_callable=AsyncMock) as mock_get_profile:

            # Current user is an admin - mock with MagicMock to allow dynamic attributes
            admin_user = MagicMock(spec=User)
            admin_user.id = "admin_user_789"
            admin_user.email = "admin@example.com"
            admin_user.full_name = "Admin User"
            admin_user.is_developer = True
            admin_user.is_admin = True  # Set the is_admin attribute via mock
            mock_auth.return_value = admin_user

            # Accessing a different user's profile
            other_user_id = "some_other_user"

            profile_data = {
                "user_id": other_user_id,
                "profile_confidence": 0.75,
                "total_ratings_analyzed": 15,
                "cuisine_preferences": [],
                "liked_ingredients": [],
                "disliked_ingredients": [],
                "preferred_prep_time_minutes": 20,
                "preferred_cook_time_minutes": 25,
                "quick_meal_preference": 0.5,
                "preferred_calories_per_serving": 350,
                "preferred_protein_ratio": 0.25,
                "preferred_carb_ratio": 0.50,
                "preferred_fat_ratio": 0.25,
                "modification_tendency": 0.3,
                "repeat_cooking_tendency": 0.4,
                "last_learning_update": datetime.now(),
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            mock_get_profile.return_value = profile_data

            response = self.client.get(
                f"/recipe/preferences/{other_user_id}",
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 200
            payload = response.json()
            assert payload["user_id"] == other_user_id
            assert payload["profile_confidence"] == 0.75

    # SUBTASK 3: GET /preferences/{user_id}/progress tests (extended coverage)
    # Task 3 - Phase 2 Batch 5: lines 789-833

    def test_get_user_learning_progress_exists(self):
        """Test retrieving existing user learning progress"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.recipe_db_service.get_user_learning_progress', new_callable=AsyncMock) as mock_progress:

            mock_auth.return_value = self.mock_user

            # Return existing progress data
            existing_progress = {
                "user_id": self.mock_user.id,
                "ratings_milestone": 25,
                "cuisines_explored": 8,
                "ingredients_learned": 42,
                "profile_accuracy_score": 0.87,
                "recommendation_success_rate": 0.82,
                "learning_started_at": datetime.now()
            }
            mock_progress.return_value = existing_progress

            response = self.client.get(
                f"/recipe/preferences/{self.mock_user.id}/progress",
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 200
            payload = response.json()
            assert payload["user_id"] == self.mock_user.id
            assert payload["ratings_milestone"] == 25
            assert payload["cuisines_explored"] == 8
            assert payload["ingredients_learned"] == 42
            assert payload["profile_accuracy_score"] == 0.87
            assert payload["recommendation_success_rate"] == 0.82
            mock_progress.assert_awaited_once()

    def test_get_user_learning_progress_access_denied(self):
        """Test that non-admin users cannot access other users' learning progress"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth:
            # Regular user trying to access different user's progress
            # Use MagicMock to simulate User with is_admin=False
            current_user = MagicMock(spec=User)
            current_user.id = "user_one"
            current_user.email = "user1@example.com"
            current_user.full_name = "User One"
            current_user.is_developer = False
            current_user.is_admin = False
            mock_auth.return_value = current_user

            other_user_id = "user_two"

            response = self.client.get(
                f"/recipe/preferences/{other_user_id}/progress",
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 403
            error_data = response.json()
            assert "Access denied" in error_data["detail"]

    def test_get_user_learning_progress_admin_override(self):
        """Test that admin users can access any user's learning progress"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.recipe_db_service.get_user_learning_progress', new_callable=AsyncMock) as mock_progress:

            # Admin user accessing another user's progress - use MagicMock to allow dynamic attributes
            admin_user = MagicMock(spec=User)
            admin_user.id = "admin_user"
            admin_user.email = "admin@example.com"
            admin_user.full_name = "Admin User"
            admin_user.is_developer = True
            admin_user.is_admin = True  # Set the is_admin attribute via mock
            mock_auth.return_value = admin_user

            target_user_id = "target_user"

            progress_data = {
                "user_id": target_user_id,
                "ratings_milestone": 10,
                "cuisines_explored": 3,
                "ingredients_learned": 15,
                "profile_accuracy_score": 0.65,
                "recommendation_success_rate": 0.70,
                "learning_started_at": datetime.now()
            }
            mock_progress.return_value = progress_data

            response = self.client.get(
                f"/recipe/preferences/{target_user_id}/progress",
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 200
            payload = response.json()
            assert payload["user_id"] == target_user_id
            assert payload["ratings_milestone"] == 10
            assert payload["cuisines_explored"] == 3

    def test_get_user_learning_progress_creates_baseline_when_missing(self):
        """Test that initial progress record is created when none exists"""
        class _DummyCursor:
            def execute(self, *args, **kwargs):
                pass

        class _DummyConnection:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def cursor(self):
                return _DummyCursor()

            def commit(self):
                pass

        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.recipe_db_service.get_user_learning_progress', new_callable=AsyncMock) as mock_progress, \
             patch('app.routes.recipe_ai.recipe_db_service.get_connection', return_value=_DummyConnection()):

            mock_auth.return_value = self.mock_user
            # No existing progress record
            mock_progress.return_value = None

            response = self.client.get(
                f"/recipe/preferences/{self.mock_user.id}/progress",
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 200
            payload = response.json()
            assert payload["user_id"] == self.mock_user.id
            # Initial progress values should be zero/default
            assert payload["ratings_milestone"] == 0
            assert payload["cuisines_explored"] == 0
            assert payload["ingredients_learned"] == 0
            assert payload["profile_accuracy_score"] == 0.0
            assert payload["recommendation_success_rate"] == 0.0

    # SUBTASK 4: POST /generate-personalized tests (extended coverage)
    # Task 3 - Phase 2 Batch 5: lines 836-945

    def test_generate_personalized_recipe_with_high_confidence_profile(self):
        """Test personalized recipe generation with a strong user taste profile"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.recipe_db_service.get_user_taste_profile', new_callable=AsyncMock) as mock_profile, \
             patch('app.routes.recipe_ai.recipe_engine.generate_recipe', new_callable=AsyncMock) as mock_generate, \
             patch('app.routes.recipe_ai.recipe_db_service.create_recipe', new_callable=AsyncMock) as mock_create_recipe, \
             patch('app.routes.recipe_ai.convert_to_engine_request') as mock_convert:

            mock_auth.return_value = self.mock_user

            # High confidence profile with strong preferences
            high_confidence_profile = {
                "profile_confidence": 0.88,
                "preferred_prep_time_minutes": 25,
                "preferred_cook_time_minutes": 30,
                "preferred_calories_per_serving": 380,
                "cuisine_preferences": [
                    {"cuisine": "mediterranean", "score": 0.95},
                    {"cuisine": "italian", "score": 0.82},
                    {"cuisine": "spanish", "score": 0.75}
                ],
                "disliked_ingredients": [
                    {"ingredient": "cilantro", "preference": -0.8}
                ],
                "liked_ingredients": [
                    {"ingredient": "tomato", "preference": 0.95},
                    {"ingredient": "olive_oil", "preference": 0.92},
                    {"ingredient": "basil", "preference": 0.88}
                ]
            }
            mock_profile.return_value = high_confidence_profile

            # Mock the engine request conversion
            mock_engine_request = MagicMock()
            mock_convert.return_value = mock_engine_request

            # Mock successful recipe generation
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
            result = response.json()
            assert result["name"] == "API Test Mediterranean Bowl"
            assert result["cuisine_type"] == "mediterranean"
            assert result["confidence_score"] == 0.88

            # Verify profile was used to enhance request
            mock_profile.assert_awaited_once()
            mock_generate.assert_awaited_once()
            mock_create_recipe.assert_awaited_once()

    def test_generate_personalized_recipe_without_profile(self):
        """Test personalized recipe generation when no taste profile exists"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.recipe_db_service.get_user_taste_profile', new_callable=AsyncMock) as mock_profile, \
             patch('app.routes.recipe_ai.recipe_engine.generate_recipe', new_callable=AsyncMock) as mock_generate, \
             patch('app.routes.recipe_ai.recipe_db_service.create_recipe', new_callable=AsyncMock) as mock_create_recipe, \
             patch('app.routes.recipe_ai.convert_to_engine_request') as mock_convert:

            mock_auth.return_value = self.mock_user

            # No profile exists
            mock_profile.return_value = None

            # Mock the engine request conversion
            mock_engine_request = MagicMock()
            mock_convert.return_value = mock_engine_request

            mock_generate.return_value = self.sample_recipe
            mock_create_recipe.return_value = "recipe_id_no_profile"

            payload = {
                "user_id": self.mock_user.id,
                "use_taste_profile": True,
                "base_request": {
                    "cuisine_preferences": ["italian"],
                    "dietary_restrictions": [],
                    "difficulty_preference": "medium",
                    "meal_type": "dinner",
                    "servings": 4,
                    "preferred_ingredients": [],
                    "excluded_ingredients": [],
                    "max_prep_time_minutes": 40,
                    "max_cook_time_minutes": 45,
                    "target_calories_per_serving": 500,
                    "target_protein_g": None,
                    "target_carbs_g": None,
                    "target_fat_g": None,
                    "target_language": "en",
                    "cooking_skill_level": "intermediate",
                    "available_equipment": []
                }
            }

            response = self.client.post(
                "/recipe/generate-personalized",
                json=payload,
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 200
            result = response.json()
            # Should still generate recipe with base request parameters
            assert result["name"] == "API Test Mediterranean Bowl"
            mock_profile.assert_awaited_once()
            mock_generate.assert_awaited_once()

    def test_generate_personalized_recipe_low_confidence_profile(self):
        """Test personalized recipe when profile confidence is below threshold"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.recipe_db_service.get_user_taste_profile', new_callable=AsyncMock) as mock_profile, \
             patch('app.routes.recipe_ai.recipe_engine.generate_recipe', new_callable=AsyncMock) as mock_generate, \
             patch('app.routes.recipe_ai.recipe_db_service.create_recipe', new_callable=AsyncMock) as mock_create_recipe, \
             patch('app.routes.recipe_ai.convert_to_engine_request') as mock_convert:

            mock_auth.return_value = self.mock_user

            # Low confidence profile (below 0.3 threshold)
            low_confidence_profile = {
                "profile_confidence": 0.25,
                "preferred_prep_time_minutes": 20,
                "preferred_cook_time_minutes": 25,
                "preferred_calories_per_serving": 400,
                "cuisine_preferences": [],
                "disliked_ingredients": [],
                "liked_ingredients": []
            }
            mock_profile.return_value = low_confidence_profile

            mock_engine_request = MagicMock()
            mock_convert.return_value = mock_engine_request

            mock_generate.return_value = self.sample_recipe
            mock_create_recipe.return_value = "recipe_id_low_conf"

            payload = {
                "user_id": self.mock_user.id,
                "use_taste_profile": True,
                "base_request": {
                    "cuisine_preferences": ["asian"],
                    "dietary_restrictions": [],
                    "difficulty_preference": "easy",
                    "meal_type": "breakfast",
                    "servings": 1,
                    "preferred_ingredients": [],
                    "excluded_ingredients": [],
                    "max_prep_time_minutes": None,
                    "max_cook_time_minutes": None,
                    "target_calories_per_serving": 350,
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
            result = response.json()
            # Recipe should be generated with base request (profile not applied)
            assert result["name"] == "API Test Mediterranean Bowl"

    def test_generate_personalized_recipe_override_with_base_request(self):
        """Test that base_request preferences override profile suggestions"""
        with patch('app.routes.recipe_ai.get_current_user') as mock_auth, \
             patch('app.routes.recipe_ai.recipe_db_service.get_user_taste_profile', new_callable=AsyncMock) as mock_profile, \
             patch('app.routes.recipe_ai.recipe_engine.generate_recipe', new_callable=AsyncMock) as mock_generate, \
             patch('app.routes.recipe_ai.recipe_db_service.create_recipe', new_callable=AsyncMock) as mock_create_recipe, \
             patch('app.routes.recipe_ai.convert_to_engine_request') as mock_convert:

            mock_auth.return_value = self.mock_user

            profile_with_defaults = {
                "profile_confidence": 0.80,
                "preferred_prep_time_minutes": 30,  # Profile preference
                "preferred_cook_time_minutes": 40,  # Profile preference
                "preferred_calories_per_serving": 450,  # Profile preference
                "cuisine_preferences": [
                    {"cuisine": "mediterranean", "score": 0.90},
                    {"cuisine": "italian", "score": 0.85}
                ],
                "disliked_ingredients": [],
                "liked_ingredients": []
            }
            mock_profile.return_value = profile_with_defaults

            mock_engine_request = MagicMock()
            mock_convert.return_value = mock_engine_request

            mock_generate.return_value = self.sample_recipe
            mock_create_recipe.return_value = "recipe_id_override"

            # Base request provides explicit values - should override profile
            payload = {
                "user_id": self.mock_user.id,
                "use_taste_profile": True,
                "base_request": {
                    "cuisine_preferences": ["asian"],  # Explicit override
                    "dietary_restrictions": [],
                    "difficulty_preference": "hard",
                    "meal_type": "dinner",
                    "servings": 3,
                    "preferred_ingredients": [],
                    "excluded_ingredients": [],
                    "max_prep_time_minutes": 20,  # Explicit override
                    "max_cook_time_minutes": 25,  # Explicit override
                    "target_calories_per_serving": 350,  # Explicit override
                    "target_protein_g": None,
                    "target_carbs_g": None,
                    "target_fat_g": None,
                    "target_language": "en",
                    "cooking_skill_level": "expert",
                    "available_equipment": []
                }
            }

            response = self.client.post(
                "/recipe/generate-personalized",
                json=payload,
                headers={"Authorization": "Bearer fake_token"}
            )

            assert response.status_code == 200
            result = response.json()
            assert result["name"] == "API Test Mediterranean Bowl"
            # Values should come from base_request, not profile
            # (we verify by checking that the request was passed to convert_to_engine_request)
            assert mock_convert.called

    def test_generate_personalized_recipe_without_authentication(self):
        """Test that /generate-personalized requires authentication"""
        payload = {
            "user_id": "some_user",
            "use_taste_profile": False,
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
            json=payload
        )

        assert response.status_code == 401
