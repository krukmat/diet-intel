# Barcode Lookup Service Documentation

## Overview

The `barcode_lookup` service provides async barcode-to-product mapping using the Open Food Facts API with Redis caching. It's designed for production use with comprehensive error handling, rate limiting, and field mapping fallbacks.

## Quick Start

```python
from app.services.barcode_lookup import lookup_by_barcode

# Basic usage
product = await lookup_by_barcode("737628064502")
if product:
    print(f"Found: {product.name} by {product.brand}")
    print(f"Calories: {product.nutriments.energy_kcal_per_100g}/100g")
else:
    print("Product not found")
```

## Architecture

### Components

1. **BarcodeService**: Main orchestrator class
2. **BarcodeAPIClient**: HTTP client with retry logic and rate limiting
3. **BarcodeRedisCache**: Redis caching layer with TTL management
4. **BarcodeFieldMapper**: Field mapping with fallback heuristics

### Flow Diagram

```
lookup_by_barcode(barcode)
    ↓
[Input Validation] → Return None if invalid
    ↓
[Redis Cache Check] → Return cached if found
    ↓
[Open Food Facts API Call] → Handle errors/retries
    ↓
[Field Mapping] → Apply fallback heuristics
    ↓
[Cache Result] → Store for 24h TTL
    ↓
Return ProductResponse
```

## Field Mapping Rules

### Product Name
**Priority Order:**
1. `product_name`
2. `product_name_en`
3. `generic_name`
4. `abbreviated_product_name`

```python
# Example mapping
{
    "product_name": "",
    "product_name_en": "Organic Cereal",
    "generic_name": "Breakfast Cereal"
}
# → Result: "Organic Cereal"
```

### Brand Information
**Processing Rules:**
- Split comma-separated brands: `"Brand A, Brand B"` → `"Brand A"`
- Trim whitespace and take first brand
- Return `None` if empty or invalid

### Energy (kcal) Conversion
**Priority Order:**
1. `energy-kcal_100g` (direct kcal)
2. `energy_kcal_100g` (alternative field)
3. `energy-kcal_value` (fallback)
4. Convert from `energy_100g` (kJ): `kJ ÷ 4.184 = kcal`
5. Convert from `energy-kj_100g` (alternative kJ field)

```python
# Example: kJ to kcal conversion
{
    "nutriments": {
        "energy_100g": 1046.0  # kJ
    }
}
# → 1046 ÷ 4.184 = 250.0 kcal
```

### Nutrient Extraction
**Field Patterns for each nutrient:**
- `{nutrient}_100g` (e.g., `proteins_100g`)
- `{nutrient}-{nutrient}_100g` (e.g., `proteins-proteins_100g`)
- `{nutrient}_value` (e.g., `proteins_value`)
- `{nutrient}` (base field)

### Serving Size
**Priority Order:**
1. `serving_size` (direct field)
2. Construct from `serving_quantity` + `serving_quantity_unit`

```python
# Example construction
{
    "serving_quantity": 30.0,
    "serving_quantity_unit": "g"
}
# → "30g"
```

### Image URL
**Priority Order:**
1. `image_front_url`
2. `image_url`
3. `selected_images.front.display`

## Error Handling

### API Errors

| Error Type | Status Code | Action |
|------------|-------------|---------|
| Product Not Found | 404 | Return `None` |
| Rate Limited | 429 | Retry with exponential backoff |
| Server Error | 5xx | Retry up to max attempts |
| Network Error | - | Retry with exponential backoff |
| Timeout | - | Retry with exponential backoff |

### Cache Errors

| Error Type | Action |
|------------|--------|
| Redis Connection Failed | Log error, continue without cache |
| Redis Read Error | Log error, fallback to API |
| Redis Write Error | Log error, continue (data still returned) |
| Serialization Error | Log error, fallback to API |

### Graceful Degradation

The service is designed to never fail completely:

1. **Cache Unavailable**: Falls back to API calls
2. **API Unavailable**: Returns `None` (logged as error)
3. **Partial Data**: Maps available fields, sets missing to `None`
4. **Invalid Input**: Returns `None` with warning log

## Performance Characteristics

### Latency

| Scenario | Typical Latency |
|----------|----------------|
| Cache Hit | < 5ms |
| Cache Miss + API Success | 100-300ms |
| API Retry (Rate Limited) | 1-5s |
| API Timeout | 10s |

### Throughput

- **With Cache**: ~1000 requests/second
- **Without Cache**: Limited by API rate limits (~10 requests/second)
- **Mixed Load**: Depends on cache hit ratio

### Memory Usage

- **Per Product**: ~2-5KB cached data
- **Connection Pools**: ~1MB base overhead
- **Total**: Scales with cache size

## Rate Limiting

### Default Configuration

- **Minimum Delay**: 0.1s between requests
- **Exponential Backoff**: Base 1.0s, max 3 retries
- **Rate Limit Response**: Wait and retry

### Customization

```python
# Via environment variables
export OFF_RATE_LIMIT_DELAY=0.2  # 200ms between requests
export OFF_MAX_RETRIES=5         # More retries
export OFF_RETRY_DELAY=2.0       # Longer base delay
```

## Caching Strategy

### Cache Keys

Pattern: `barcode:product:{barcode}`

Examples:
- `barcode:product:737628064502`
- `barcode:product:0001234567890`

### TTL Management

- **Default TTL**: 24 hours
- **Configurable**: Via `REDIS_CACHE_TTL_HOURS`
- **Metadata**: Includes cache timestamp

### Cache Invalidation

```python
from app.services.barcode_lookup import barcode_service

# Manual cache invalidation
await barcode_service.cache.delete("737628064502")

# Or clear and refresh
product = await lookup_by_barcode("737628064502")  # Will fetch fresh from API
```

## Advanced Usage

### Custom Configuration

```python
from app.services.barcode_lookup import BarcodeService
from app.config import config

# Override configuration
config.off_timeout = 15.0
config.off_max_retries = 5
config.redis_cache_ttl_hours = 48

service = BarcodeService()
product = await service.lookup_by_barcode("737628064502")
```

### Batch Processing

```python
import asyncio
from app.services.barcode_lookup import lookup_by_barcode

async def batch_lookup(barcodes):
    """Process multiple barcodes concurrently"""
    tasks = [lookup_by_barcode(barcode) for barcode in barcodes]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    products = []
    for barcode, result in zip(barcodes, results):
        if isinstance(result, Exception):
            print(f"Error for {barcode}: {result}")
        elif result:
            products.append(result)
    
    return products

# Usage
barcodes = ["737628064502", "123456789012", "999999999999"]
products = await batch_lookup(barcodes)
```

### Service Lifecycle

```python
from app.services.barcode_lookup import barcode_service

# Application startup - no special initialization needed

# Application shutdown - cleanup connections
async def shutdown():
    await barcode_service.close()

# In FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # Startup
    yield
    # Shutdown
    await barcode_service.close()

app = FastAPI(lifespan=lifespan)
```

## Testing

### Unit Tests

Run the comprehensive test suite:

```bash
pytest tests/test_barcode_lookup.py -v
```

Test coverage includes:
- Field mapping with various data formats
- Cache hit/miss scenarios
- API error conditions
- Rate limiting behavior
- Concurrent request handling
- Edge cases and error conditions

### Integration Testing

```python
# Test against real APIs (for development)
async def test_real_integration():
    # Use a known good barcode
    product = await lookup_by_barcode("737628064502")
    assert product is not None
    assert product.name is not None
    
    # Test cache behavior
    start_time = time.time()
    product2 = await lookup_by_barcode("737628064502")  # Should be cached
    cache_time = time.time() - start_time
    assert cache_time < 0.1  # Should be very fast from cache
```

### Load Testing

```python
import asyncio
import time

async def load_test():
    """Simple load test"""
    barcodes = ["737628064502"] * 100  # Same barcode for cache testing
    
    start_time = time.time()
    tasks = [lookup_by_barcode(barcode) for barcode in barcodes]
    results = await asyncio.gather(*tasks)
    end_time = time.time()
    
    success_count = len([r for r in results if r is not None])
    total_time = end_time - start_time
    
    print(f"Processed {len(barcodes)} requests in {total_time:.2f}s")
    print(f"Success rate: {success_count}/{len(barcodes)}")
    print(f"Throughput: {len(barcodes)/total_time:.0f} req/s")

await load_test()
```

## Monitoring and Observability

### Key Metrics to Track

1. **Cache Hit Ratio**: Higher is better (target: >80%)
2. **API Latency**: Monitor for degradation
3. **Error Rates**: Track by error type
4. **Retry Frequency**: High retries indicate API issues

### Logging

The service provides structured logging:

```python
import logging

# Enable debug logging to see detailed flow
logging.getLogger('app.services.barcode_lookup').setLevel(logging.DEBUG)

# Key log messages:
# - "Cache hit for barcode X (Xms)"
# - "API fetch for barcode X (Xms, cached: true/false)"
# - "Rate limiting: sleeping Xs"
# - "Converted X kJ to X kcal"
```

### Health Checks

```python
async def health_check():
    """Basic health check for the service"""
    try:
        # Test with a known barcode
        result = await lookup_by_barcode("737628064502")
        return {"status": "healthy", "test_passed": result is not None}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
```

## Best Practices

1. **Input Validation**: Always validate barcodes before calling the service
2. **Error Handling**: Handle `None` returns gracefully in your application
3. **Caching Strategy**: Monitor cache hit ratios and adjust TTL as needed
4. **Rate Limiting**: Respect Open Food Facts API limits
5. **Connection Management**: Use the global service instance to share connections
6. **Monitoring**: Track key metrics for performance optimization
7. **Graceful Shutdown**: Always call `close()` on application shutdown

## Migration Guide

### From Existing OpenFoodFacts Service

If migrating from the existing `openfoodfacts.py` service:

```python
# Old usage
from app.services.openfoodfacts import openfoodfacts_service
product = await openfoodfacts_service.get_product(barcode)

# New usage
from app.services.barcode_lookup import lookup_by_barcode
product = await lookup_by_barcode(barcode)
```

**Key Changes:**
- Returns `None` instead of raising exceptions for not found
- Includes comprehensive caching by default
- Better field mapping with fallbacks
- Improved error handling and retry logic