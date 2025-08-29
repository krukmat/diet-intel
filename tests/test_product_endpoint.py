import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime
from httpx import AsyncClient
from fastapi.testclient import TestClient
from main import app
from app.models.product import ProductResponse, Nutriments


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_openfoodfacts_response():
    return {
        "status": 1,
        "product": {
            "product_name": "Test Product",
            "brands": "Test Brand",
            "image_url": "https://example.com/image.jpg",
            "serving_size": "100g",
            "nutriments": {
                "energy-kcal_100g": 250.0,
                "proteins_100g": 10.0,
                "fat_100g": 5.0,
                "carbohydrates_100g": 40.0,
                "sugars_100g": 15.0,
                "salt_100g": 1.2
            }
        }
    }


@pytest.fixture
def expected_product_response():
    return {
        "source": "OpenFoodFacts",
        "barcode": "1234567890123",
        "name": "Test Product",
        "brand": "Test Brand",
        "image_url": "https://example.com/image.jpg",
        "serving_size": "100g",
        "nutriments": {
            "energy_kcal_per_100g": 250.0,
            "protein_g_per_100g": 10.0,
            "fat_g_per_100g": 5.0,
            "carbs_g_per_100g": 40.0,
            "sugars_g_per_100g": 15.0,
            "salt_g_per_100g": 1.2
        }
    }


@pytest.mark.asyncio
async def test_successful_product_lookup(client, mock_openfoodfacts_response, expected_product_response):
    barcode = "1234567890123"
    
    with patch("app.services.cache.cache_service.get", return_value=None), \
         patch("app.services.cache.cache_service.set", return_value=True), \
         patch("app.services.openfoodfacts.openfoodfacts_service.client") as mock_client:
        
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_openfoodfacts_response
        mock_client.get.return_value = mock_response
        
        response = client.post("/product/by-barcode", json={"barcode": barcode})
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["source"] == expected_product_response["source"]
        assert data["barcode"] == expected_product_response["barcode"]
        assert data["name"] == expected_product_response["name"]
        assert data["brand"] == expected_product_response["brand"]
        assert data["image_url"] == expected_product_response["image_url"]
        assert data["serving_size"] == expected_product_response["serving_size"]
        assert data["nutriments"] == expected_product_response["nutriments"]
        assert "fetched_at" in data


@pytest.mark.asyncio
async def test_product_not_found_404(client):
    barcode = "0000000000000"
    
    with patch("app.services.cache.cache_service.get", return_value=None), \
         patch("app.services.openfoodfacts.openfoodfacts_service.client") as mock_client:
        
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": 0}
        mock_client.get.return_value = mock_response
        
        response = client.post("/product/by-barcode", json={"barcode": barcode})
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()


@pytest.mark.asyncio
async def test_cached_product_response(client, expected_product_response):
    barcode = "1234567890123"
    
    cached_data = expected_product_response.copy()
    cached_data["fetched_at"] = datetime.now().isoformat()
    
    with patch("app.services.cache.cache_service.get", return_value=cached_data):
        response = client.post("/product/by-barcode", json={"barcode": barcode})
        
        assert response.status_code == 200
        data = response.json()
        assert data["barcode"] == barcode
        assert data["source"] == "OpenFoodFacts"


@pytest.mark.asyncio
async def test_empty_barcode_validation(client):
    response = client.post("/product/by-barcode", json={"barcode": ""})
    
    assert response.status_code == 400
    data = response.json()
    assert "empty" in data["detail"].lower()


@pytest.mark.asyncio
async def test_network_timeout_error(client):
    barcode = "1234567890123"
    
    with patch("app.services.cache.cache_service.get", return_value=None), \
         patch("app.services.openfoodfacts.openfoodfacts_service.get_product") as mock_get_product:
        
        from httpx import TimeoutException
        mock_get_product.side_effect = TimeoutException("Request timeout")
        
        response = client.post("/product/by-barcode", json={"barcode": barcode})
        
        assert response.status_code == 408
        data = response.json()
        assert "timeout" in data["detail"].lower()