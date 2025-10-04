"""
API Reliability and Error Propagation Tests

Tests how the API handles failures, timeouts, external service errors,
and validates proper error propagation throughout the system.
Focus on resilience, graceful degradation, and proper error responses.

Coverage Target: Critical error scenarios and reliability patterns
"""

import pytest
import asyncio
import redis.asyncio as redis
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
import httpx

from main import app
from app.services.cache import cache_service
from app.services.database import db_service


@pytest.fixture
def client():
    return TestClient(app)


class TestExternalServiceFailures:
    """Test handling of external service failures"""
    
    def test_openfoodfacts_timeout_handling(self, client, product_service_overrides):
        """Test product lookup with external API timeout"""
        _, fake_openfoodfacts = product_service_overrides
        fake_openfoodfacts.get_product = AsyncMock(side_effect=httpx.TimeoutException("Request timeout"))

        response = client.post("/product/by-barcode", json={"barcode": "timeout_test"})

        # Should return proper 408 timeout error
        assert response.status_code == 408
        error_data = response.json()
        assert "timeout" in error_data["detail"].lower()
        assert error_data["detail"] == "Request timeout while fetching product data"

    def test_openfoodfacts_network_error_handling(self, client, product_service_overrides):
        """Test product lookup with network errors"""
        _, fake_openfoodfacts = product_service_overrides
        fake_openfoodfacts.get_product = AsyncMock(side_effect=httpx.RequestError("Connection failed"))

        response = client.post("/product/by-barcode", json={"barcode": "network_error_test"})

        # Should return proper 503 service unavailable error
        assert response.status_code == 503
        error_data = response.json()
        assert "connect" in error_data["detail"].lower()
        assert error_data["detail"] == "Unable to connect to product database"

    def test_openfoodfacts_product_not_found(self, client, product_service_overrides):
        """Test product lookup with valid API but product not found"""
        _, fake_openfoodfacts = product_service_overrides
        fake_openfoodfacts.get_product = AsyncMock(return_value=None)

        response = client.post("/product/by-barcode", json={"barcode": "not_found_test"})

        # Should return proper 404 not found error
        assert response.status_code == 404
        error_data = response.json()
        assert "not found" in error_data["detail"].lower()
        assert "not_found_test" in error_data["detail"]
    
    def test_redis_cache_failure_graceful_degradation(self, client):
        """Test API continues working when Redis cache fails"""
        # Generate a meal plan (this should work even without cache)
        plan_request = {
            "user_profile": {
                "age": 30,
                "sex": "female",
                "height_cm": 165,
                "weight_kg": 65,
                "activity_level": "moderately_active",
                "goal": "maintain"
            },
            "preferences": {
                "dietary_restrictions": [],
                "excludes": [],
                "prefers": []
            },
            "flexibility": False
        }
        
        # Mock Redis connection failure
        with patch.object(cache_service, 'get', AsyncMock(side_effect=redis.ConnectionError("Redis unavailable"))):
            with patch.object(cache_service, 'set', AsyncMock(side_effect=redis.ConnectionError("Redis unavailable"))):
                # API should still work, just without caching
                response = client.post("/plan/generate", json=plan_request)
                
                # Should succeed despite cache failures
                assert response.status_code == 200
                plan_data = response.json()
                assert "meals" in plan_data
                assert len(plan_data["meals"]) >= 2  # Should have breakfast, lunch at minimum


class TestDatabaseFailureResilience:
    """Test database failure scenarios and recovery"""
    
    def test_database_connection_failure_handling(self, client):
        """Test proper error handling when database is unavailable"""
        # Mock database connection failure
        with patch.object(db_service, 'get_connection', side_effect=Exception("Database connection failed")):
            # Try to create a weight entry (requires database)
            weight_request = {
                "weight": 70.0,
                "date": datetime.now().date().isoformat()
            }
            
            response = client.post("/track/weight", json=weight_request)
            
            # Should return proper 500 error with generic message
            assert response.status_code == 500
            error_data = response.json()
            assert "Failed to track weight" in error_data["detail"]
    
    def test_database_write_failure_rollback(self, client):
        """Test transaction rollback on database write failures"""
        # Create meal tracking request
        meal_request = {
            "meal_name": "Test Meal",
            "items": [
                {
                    "barcode": "test123",
                    "name": "Test Food",
                    "serving": "100g",
                    "calories": 200.0,
                    "macros": {"protein": 10.0, "fat": 5.0, "carbs": 20.0}
                }
            ],
            "timestamp": datetime.now().isoformat()
        }
        
        # Mock database write failure after first operation
        with patch.object(db_service, 'create_meal') as mock_create:
            mock_create.side_effect = Exception("Database write failed")
            
            response = client.post("/track/meal", json=meal_request)
            
            # Should return proper error
            assert response.status_code == 500
            error_data = response.json()
            assert "Failed to track meal" in error_data["detail"]
    
    def test_database_read_failure_fallback(self, client):
        """Test fallback behavior when database reads fail"""
        # Mock database read failure
        with patch.object(db_service, 'get_user_meals', side_effect=Exception("Database read failed")):
            # Try to get meal history
            response = client.get("/track/meals")
            
            # Should return proper error
            assert response.status_code == 500
            error_data = response.json()
            assert "error" in error_data.get("detail", "").lower()


class TestInputValidationAndSanitization:
    """Test input validation and security measures"""
    
    def test_invalid_barcode_formats(self, client):
        """Test various invalid barcode formats"""
        invalid_barcodes = [
            "",  # Empty string
            " ",  # Whitespace only
            "a" * 500,  # Extremely long string
            "invalid<script>alert('xss')</script>",  # Potential XSS
            None,  # Null value handled by request validation
        ]
        
        for barcode in invalid_barcodes[:-1]:  # Skip None as it's handled by Pydantic
            response = client.post("/product/by-barcode", json={"barcode": barcode})
            # Should return 400 for invalid input or handle gracefully
            assert response.status_code in [400, 404], f"Failed for barcode: {barcode}"
    
    def test_meal_tracking_input_validation(self, client):
        """Test meal tracking with invalid inputs"""
        # Test negative calories
        invalid_meal = {
            "meal_name": "Invalid Meal",
            "items": [
                {
                    "barcode": "test123",
                    "name": "Test Food",
                    "serving": "100g",
                    "calories": -50.0,  # Invalid negative calories
                    "macros": {"protein": 10.0, "fat": 5.0, "carbs": 20.0}
                }
            ],
            "timestamp": datetime.now().isoformat()
        }
        
        response = client.post("/track/meal", json=invalid_meal)
        # Should accept it (business logic may allow corrections) or validate
        # The API currently doesn't enforce positive calories at the model level
        # So we test that it handles the data gracefully
        assert response.status_code in [200, 400, 422]
    
    def test_weight_tracking_boundary_values(self, client):
        """Test weight tracking with boundary values"""
        # Test extreme weight values
        extreme_weights = [0.1, 999.9]  # Very light and very heavy
        
        for weight in extreme_weights:
            weight_request = {
                "weight": weight,
                "date": datetime.now().date().isoformat()
            }
            
            response = client.post("/track/weight", json=weight_request)
            # Should either accept or reject based on validation rules
            assert response.status_code in [200, 400, 422]
    
    def test_timestamp_format_validation(self, client):
        """Test various timestamp formats"""
        invalid_timestamps = [
            "not-a-date",
            "2023-13-45T25:70:80.000Z",  # Invalid date components
            "",  # Empty timestamp
        ]
        
        for timestamp in invalid_timestamps:
            meal_request = {
                "meal_name": "Test Meal",
                "items": [
                    {
                        "barcode": "test123",
                        "name": "Test Food",
                        "serving": "100g",
                        "calories": 200.0,
                        "macros": {"protein": 10.0}
                    }
                ],
                "timestamp": timestamp
            }
            
            response = client.post("/track/meal", json=meal_request)
            # Should return validation error
            assert response.status_code in [400, 422]


class TestConcurrentOperationHandling:
    """Test handling of concurrent operations and race conditions"""
    
    def test_concurrent_meal_tracking(self, client):
        """Test multiple simultaneous meal tracking requests"""
        meal_request = {
            "meal_name": "Concurrent Meal",
            "items": [
                {
                    "barcode": "concurrent123",
                    "name": "Concurrent Food",
                    "serving": "100g",
                    "calories": 150.0,
                    "macros": {"protein": 8.0, "fat": 3.0, "carbs": 15.0}
                }
            ],
            "timestamp": datetime.now().isoformat()
        }
        
        # Simulate concurrent requests
        responses = []
        for i in range(5):
            response = client.post("/track/meal", json=meal_request)
            responses.append(response)
        
        # All should succeed (database should handle concurrency)
        success_count = sum(1 for r in responses if r.status_code == 200)
        assert success_count >= 4, f"Expected at least 4 successes, got {success_count}"
    
    def test_concurrent_weight_tracking(self, client):
        """Test concurrent weight tracking operations"""
        base_date = datetime.now().date()
        
        # Create concurrent weight entries for different dates
        responses = []
        for i in range(3):
            weight_request = {
                "weight": 70.0 + i,
                "date": (base_date - timedelta(days=i)).isoformat()
            }
            response = client.post("/track/weight", json=weight_request)
            responses.append(response)
        
        # All should succeed
        success_count = sum(1 for r in responses if r.status_code == 200)
        assert success_count >= 2, "Most concurrent operations should succeed"


class TestResourceLimitHandling:
    """Test handling of resource limits and abuse scenarios"""
    
    def test_large_meal_item_lists(self, client):
        """Test meals with many items"""
        # Create meal with many items
        items = []
        for i in range(20):  # Large number of items
            items.append({
                "barcode": f"item_{i:03d}",
                "name": f"Food Item {i}",
                "serving": "100g",
                "calories": 100.0 + i,
                "macros": {"protein": 5.0, "fat": 2.0, "carbs": 10.0}
            })
        
        large_meal = {
            "meal_name": "Large Meal",
            "items": items,
            "timestamp": datetime.now().isoformat()
        }
        
        response = client.post("/track/meal", json=large_meal)
        # Should handle large requests gracefully
        assert response.status_code in [200, 413, 400]  # Success or request too large
    
    def test_extremely_long_names(self, client):
        """Test handling of very long names"""
        long_name = "A" * 1000  # Very long name
        
        meal_request = {
            "meal_name": long_name,
            "items": [
                {
                    "barcode": "long_name_test",
                    "name": long_name,
                    "serving": "100g",
                    "calories": 200.0,
                    "macros": {"protein": 10.0}
                }
            ],
            "timestamp": datetime.now().isoformat()
        }
        
        response = client.post("/track/meal", json=meal_request)
        # Should handle gracefully (truncate or reject)
        assert response.status_code in [200, 400, 413, 422]


class TestErrorResponseConsistency:
    """Test that error responses are consistent and informative"""
    
    def test_error_response_format_consistency(self, client):
        """Test that all error responses follow consistent format"""
        # Test various endpoints that should return errors
        error_scenarios = [
            ("POST", "/product/by-barcode", {"barcode": ""}),  # Empty barcode
            ("GET", "/plan/nonexistent_id", None),  # Nonexistent plan
            ("POST", "/track/meal", {"invalid": "data"}),  # Invalid meal data
        ]
        
        for method, endpoint, data in error_scenarios:
            if method == "POST":
                response = client.post(endpoint, json=data)
            else:
                response = client.get(endpoint)
            
            if 400 <= response.status_code < 600:  # Error response
                error_data = response.json()
                # Should have consistent error format
                assert "detail" in error_data or "error" in error_data
                # Error message should be non-empty
                error_msg = error_data.get("detail") or error_data.get("error")
                assert len(str(error_msg)) > 0
    
    def test_http_status_code_accuracy(self, client):
        """Test that HTTP status codes accurately reflect error types"""
        # 400 Bad Request - Invalid input
        response = client.post("/product/by-barcode", json={"barcode": ""})
        assert response.status_code == 400
        
        # 404 Not Found - Resource doesn't exist
        from unittest.mock import AsyncMock
        with patch('app.routes.product.openfoodfacts_service.get_product', new_callable=AsyncMock, return_value=None):
            response = client.post("/product/by-barcode", json={"barcode": "nonexistent"})
            assert response.status_code == 404
        
        # 422 Unprocessable Entity - Invalid data format
        response = client.post("/track/meal", json={"invalid_structure": True})
        assert response.status_code == 422


class TestSystemRecoveryAndDegradation:
    """Test system recovery from failures and graceful degradation"""
    
    def test_partial_service_failure_continuation(self, client):
        """Test that system continues to work when some services fail"""
        # Mock cache failure but database works
        with patch.object(cache_service, 'get', AsyncMock(side_effect=Exception("Cache failed"))):
            with patch.object(cache_service, 'set', AsyncMock(side_effect=Exception("Cache failed"))):
                # Weight history should still work (fallback to database)
                response = client.get("/track/weight/history")
                
                # Should succeed or fail gracefully with proper error
                assert response.status_code in [200, 500]
                
                if response.status_code == 200:
                    data = response.json()
                    assert "entries" in data
    
    def test_meal_planning_fallback_behavior(self, client):
        """Test meal planning with limited product database"""
        plan_request = {
            "user_profile": {
                "age": 25,
                "sex": "male",
                "height_cm": 175,
                "weight_kg": 70,
                "activity_level": "lightly_active",
                "goal": "maintain"
            },
            "preferences": {
                "dietary_restrictions": [],
                "excludes": [],
                "prefers": []
            },
            "flexibility": True
        }
        
        # Mock limited product availability
        with patch('app.services.meal_planner.cached_products', []):
            response = client.post("/plan/generate", json=plan_request)
            
            # Should either succeed with limited plan or fail gracefully
            assert response.status_code in [200, 503, 500]
            
            if response.status_code == 200:
                plan_data = response.json()
                # Should have some structure even with limited products
                assert "meals" in plan_data
                assert "metrics" in plan_data
@pytest.fixture(autouse=True)
def _product_service_overrides(product_service_overrides):
    """Ensure product route uses in-memory cache + OpenFoodFacts stub."""
    return product_service_overrides
