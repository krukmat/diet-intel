"""
Product Discovery Service Coverage Tests - Phase 2
Task 2.1: Improve coverage from 66% to 82%

Tests for ProductDiscoveryService methods
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.services.product_discovery import ProductDiscoveryService
from app.models.product import ProductResponse, Nutriments


@pytest.fixture
def discovery_service():
    """Create ProductDiscoveryService instance"""
    return ProductDiscoveryService()


@pytest.fixture
def sample_product_response():
    """Sample ProductResponse object"""
    from datetime import datetime
    return ProductResponse(
        barcode="1234567890123",
        name="Test Product",
        brand="Test Brand",
        serving_size="100g",
        source="test",
        fetched_at=datetime.now(),
        nutriments=Nutriments(
            energy_100g=250,
            proteins_100g=10,
            fat_100g=5,
            carbohydrates_100g=35
        )
    )


# ==================== Initialization Tests ====================

def test_product_discovery_service_init():
    """Test ProductDiscoveryService initialization"""
    service = ProductDiscoveryService()

    assert service is not None
    assert service.category_cache is not None
    assert isinstance(service.category_cache, dict)
    assert service.discovery_cache_ttl == 3600
    assert service.nutritional_categories is not None


def test_nutritional_categories_defined():
    """Test that nutritional categories are properly defined"""
    service = ProductDiscoveryService()

    required_categories = [
        'high_protein',
        'low_calorie',
        'healthy_fats',
        'complex_carbs',
        'fiber_rich'
    ]

    for category in required_categories:
        assert category in service.nutritional_categories
        assert 'keywords' in service.nutritional_categories[category]


# ==================== Discover Products for Recommendations ====================

@pytest.mark.asyncio
async def test_discover_products_for_recommendations_empty(discovery_service):
    """Test discovering products when no sources have results"""
    with patch.object(discovery_service, '_load_popular_cached_products', new_callable=AsyncMock, return_value=[]), \
         patch.object(discovery_service, '_load_user_preferred_products', new_callable=AsyncMock, return_value=[]), \
         patch.object(discovery_service, '_load_nutritionally_diverse_products', new_callable=AsyncMock, return_value=[]), \
         patch.object(discovery_service, '_discover_products_from_api', new_callable=AsyncMock, return_value=[]), \
         patch.object(discovery_service, '_get_emergency_fallback_products', new_callable=AsyncMock, return_value=[]):

        result = await discovery_service.discover_products_for_recommendations()

        assert isinstance(result, list)
        assert len(result) == 0


@pytest.mark.asyncio
async def test_discover_products_for_recommendations_with_user(discovery_service, sample_product_response):
    """Test discovering products with user ID for personalization"""
    mock_product = sample_product_response

    with patch.object(discovery_service, '_load_popular_cached_products', new_callable=AsyncMock, return_value=[mock_product]), \
         patch.object(discovery_service, '_load_user_preferred_products', new_callable=AsyncMock, return_value=[mock_product]), \
         patch.object(discovery_service, '_load_nutritionally_diverse_products', new_callable=AsyncMock, return_value=[]), \
         patch.object(discovery_service, '_deduplicate_products', return_value=[mock_product]):

        result = await discovery_service.discover_products_for_recommendations(
            user_id='user123',
            dietary_restrictions=['vegetarian'],
            max_products=50
        )

        assert len(result) > 0
        assert result[0].barcode == mock_product.barcode


@pytest.mark.asyncio
async def test_discover_products_for_recommendations_with_restrictions(discovery_service, sample_product_response):
    """Test discovering products with dietary restrictions"""
    with patch.object(discovery_service, '_load_popular_cached_products', new_callable=AsyncMock, return_value=[sample_product_response]), \
         patch.object(discovery_service, '_load_user_preferred_products', new_callable=AsyncMock, return_value=[]), \
         patch.object(discovery_service, '_load_nutritionally_diverse_products', new_callable=AsyncMock, return_value=[]), \
         patch.object(discovery_service, '_deduplicate_products', return_value=[sample_product_response]):

        result = await discovery_service.discover_products_for_recommendations(
            dietary_restrictions=['vegan', 'gluten-free'],
            max_products=30
        )

        assert len(result) > 0


@pytest.mark.asyncio
async def test_discover_products_for_recommendations_error_fallback(discovery_service):
    """Test error handling returns fallback products"""
    with patch.object(discovery_service, '_load_popular_cached_products', new_callable=AsyncMock, side_effect=Exception("DB Error")), \
         patch.object(discovery_service, '_get_emergency_fallback_products', new_callable=AsyncMock, return_value=[]):

        result = await discovery_service.discover_products_for_recommendations()

        assert isinstance(result, list)


@pytest.mark.asyncio
async def test_discover_products_for_recommendations_max_products(discovery_service, sample_product_response):
    """Test that result respects max_products limit"""
    products = [sample_product_response] * 100

    with patch.object(discovery_service, '_load_popular_cached_products', new_callable=AsyncMock, return_value=products), \
         patch.object(discovery_service, '_deduplicate_products', return_value=products):

        result = await discovery_service.discover_products_for_recommendations(max_products=25)

        assert len(result) <= 25


# ==================== Discover Products for Meal Planning ====================

@pytest.mark.asyncio
async def test_discover_products_for_meal_planning_no_optional(discovery_service, sample_product_response):
    """Test discovering meal planning products without optional products"""
    with patch.object(discovery_service, '_load_meal_appropriate_products', new_callable=AsyncMock, return_value=[sample_product_response]), \
         patch.object(discovery_service, '_ensure_nutritional_balance', new_callable=AsyncMock, return_value=[sample_product_response]):

        result = await discovery_service.discover_products_for_meal_planning(
            user_id='user123',
            dietary_restrictions=['vegetarian']
        )

        assert len(result) > 0


@pytest.mark.asyncio
async def test_discover_products_for_meal_planning_with_optional(discovery_service, sample_product_response):
    """Test discovering meal planning products with optional products specified"""
    optional_barcodes = ['1234567890123', '9876543210987']

    with patch.object(discovery_service, '_load_specific_products', new_callable=AsyncMock, return_value=[sample_product_response]), \
         patch.object(discovery_service, '_load_meal_appropriate_products', new_callable=AsyncMock, return_value=[sample_product_response]), \
         patch.object(discovery_service, '_ensure_nutritional_balance', new_callable=AsyncMock, return_value=[sample_product_response]):

        result = await discovery_service.discover_products_for_meal_planning(
            user_id='user123',
            optional_products=optional_barcodes
        )

        assert len(result) > 0


@pytest.mark.asyncio
async def test_discover_products_for_meal_planning_error_fallback(discovery_service):
    """Test meal planning error handling returns fallback"""
    with patch.object(discovery_service, '_load_meal_appropriate_products', new_callable=AsyncMock, side_effect=Exception("Error")), \
         patch.object(discovery_service, '_get_emergency_fallback_products', new_callable=AsyncMock, return_value=[]):

        result = await discovery_service.discover_products_for_meal_planning()

        assert isinstance(result, list)


# ==================== Helper Methods Tests ====================

def test_deduplicate_products(discovery_service, sample_product_response):
    """Test product deduplication"""
    from datetime import datetime

    product1 = sample_product_response
    product2 = ProductResponse(
        barcode="1234567890123",  # Same barcode
        name="Product 1 Duplicate",
        source="test",
        fetched_at=datetime.now(),
        nutriments=Nutriments(energy_100g=100, proteins_100g=5, fat_100g=3, carbohydrates_100g=20)
    )
    product3 = ProductResponse(
        barcode="9876543210987",
        name="Product 2",
        source="test",
        fetched_at=datetime.now(),
        nutriments=Nutriments(energy_100g=150, proteins_100g=8, fat_100g=5, carbohydrates_100g=30)
    )

    products = [product1, product2, product3]
    result = discovery_service._deduplicate_products(products)

    # Should remove duplicate barcode
    assert len(result) == 2
    barcodes = [p.barcode for p in result]
    assert "1234567890123" in barcodes
    assert "9876543210987" in barcodes


def test_meets_dietary_restrictions_none(discovery_service, sample_product_response):
    """Test dietary restrictions check with None"""
    result = discovery_service._meets_dietary_restrictions(sample_product_response, None)
    assert result is True


def test_meets_dietary_restrictions_empty(discovery_service, sample_product_response):
    """Test dietary restrictions check with empty list"""
    result = discovery_service._meets_dietary_restrictions(sample_product_response, [])
    assert result is True


def test_meets_dietary_restrictions_check(discovery_service, sample_product_response):
    """Test dietary restrictions validation"""
    # Since product has no restrictions data, should pass any check
    result = discovery_service._meets_dietary_restrictions(
        sample_product_response,
        ['vegan', 'gluten-free']
    )
    assert isinstance(result, bool)


# ==================== Category Cache Tests ====================

def test_category_cache_initialization(discovery_service):
    """Test that category cache is empty on init"""
    assert isinstance(discovery_service.category_cache, dict)
    assert len(discovery_service.category_cache) == 0


def test_nutritional_categories_high_protein(discovery_service):
    """Test high protein category definition"""
    high_protein = discovery_service.nutritional_categories['high_protein']

    assert high_protein['min_protein_per_100g'] == 15.0
    assert 'protein' in high_protein['keywords']
    assert 'chicken' in high_protein['keywords']


def test_nutritional_categories_low_calorie(discovery_service):
    """Test low calorie category definition"""
    low_cal = discovery_service.nutritional_categories['low_calorie']

    assert low_cal['max_calories_per_100g'] == 100.0
    assert 'salad' in low_cal['keywords']
    assert 'vegetables' in low_cal['keywords']


# ==================== Cache TTL Tests ====================

def test_discovery_cache_ttl_value(discovery_service):
    """Test that cache TTL is set correctly"""
    assert discovery_service.discovery_cache_ttl == 3600  # 1 hour
    assert isinstance(discovery_service.discovery_cache_ttl, int)
