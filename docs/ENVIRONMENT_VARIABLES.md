# Environment Variables Configuration

This document describes the environment variables used by the DietIntel API for configuring external service connections and behavior.

## Required Variables

### Redis Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL for caching |
| `REDIS_CACHE_TTL_HOURS` | `24` | Cache TTL in hours for product data |
| `REDIS_MAX_CONNECTIONS` | `10` | Maximum Redis connection pool size |

**Example:**
```bash
export REDIS_URL="redis://localhost:6379"
export REDIS_CACHE_TTL_HOURS=24
export REDIS_MAX_CONNECTIONS=10
```

### Open Food Facts API Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OFF_BASE_URL` | `https://world.openfoodfacts.org` | Open Food Facts API base URL |
| `OFF_TIMEOUT` | `10.0` | Request timeout in seconds |
| `OFF_RATE_LIMIT_DELAY` | `0.1` | Minimum delay between requests (seconds) |
| `OFF_MAX_RETRIES` | `3` | Maximum retry attempts for failed requests |
| `OFF_RETRY_DELAY` | `1.0` | Base delay between retries with exponential backoff |

**Example:**
```bash
export OFF_BASE_URL="https://world.openfoodfacts.org"
export OFF_TIMEOUT=10.0
export OFF_RATE_LIMIT_DELAY=0.1
export OFF_MAX_RETRIES=3
export OFF_RETRY_DELAY=1.0
```

## Optional Variables

### Logging Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |

**Example:**
```bash
export LOG_LEVEL=DEBUG
```

## Environment Setup Examples

### Development Environment

```bash
# .env file for development
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL_HOURS=1
OFF_TIMEOUT=15.0
OFF_RATE_LIMIT_DELAY=0.05
LOG_LEVEL=DEBUG
```

### Production Environment

```bash
# Production environment variables
REDIS_URL=redis://prod-redis:6379
REDIS_CACHE_TTL_HOURS=24
REDIS_MAX_CONNECTIONS=50
OFF_TIMEOUT=10.0
OFF_RATE_LIMIT_DELAY=0.2
OFF_MAX_RETRIES=5
OFF_RETRY_DELAY=2.0
LOG_LEVEL=INFO
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  api:
    build: .
    environment:
      - REDIS_URL=redis://redis:6379
      - REDIS_CACHE_TTL_HOURS=24
      - OFF_TIMEOUT=10.0
      - OFF_RATE_LIMIT_DELAY=0.1
      - LOG_LEVEL=INFO
    depends_on:
      - redis
  
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

## Configuration Validation

The application validates configuration on startup. If invalid values are provided:

1. **Redis Connection**: Will log warnings and attempt graceful degradation
2. **OFF API Settings**: Will use defaults for invalid numeric values
3. **Missing Variables**: Will use documented default values

## Performance Tuning

### High-Traffic Scenarios

For high-traffic production environments, consider:

```bash
# Increase Redis connection pool
REDIS_MAX_CONNECTIONS=100

# Longer cache TTL to reduce API calls
REDIS_CACHE_TTL_HOURS=48

# More aggressive rate limiting
OFF_RATE_LIMIT_DELAY=0.5

# More retries for reliability
OFF_MAX_RETRIES=5
OFF_RETRY_DELAY=2.0
```

### Low-Latency Requirements

For low-latency scenarios:

```bash
# Shorter timeouts
OFF_TIMEOUT=5.0

# Less aggressive rate limiting
OFF_RATE_LIMIT_DELAY=0.05

# Fewer retries for faster failure
OFF_MAX_RETRIES=2
OFF_RETRY_DELAY=0.5
```

## Security Considerations

1. **Redis URL**: If using Redis with authentication, include credentials in URL:
   ```bash
   REDIS_URL=redis://username:password@redis-host:6379/0
   ```

2. **SSL/TLS**: For production Redis connections:
   ```bash
   REDIS_URL=rediss://redis-host:6380
   ```

3. **Network Security**: Ensure Redis and API endpoints are accessible only from application servers.

## Troubleshooting

### Redis Connection Issues

```bash
# Test Redis connectivity
redis-cli -u $REDIS_URL ping

# Check Redis logs
docker logs redis-container
```

### Open Food Facts API Issues

```bash
# Test API connectivity
curl -i "$OFF_BASE_URL/api/v0/product/737628064502.json"

# Check API rate limits (should return 429 if exceeded)
```

### Configuration Debugging

Enable debug logging to see configuration values:

```bash
export LOG_LEVEL=DEBUG
python main.py
```

This will log the loaded configuration values on startup.

## Environment Variable Loading

The application uses `pydantic` settings for configuration management:

1. Environment variables are loaded automatically
2. Defaults are applied for missing variables
3. Type validation is performed on startup
4. Invalid values will cause startup errors with clear messages

For more details, see `app/config.py`.