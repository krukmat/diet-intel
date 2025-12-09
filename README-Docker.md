# DietIntel Docker Setup

This document explains how to run DietIntel using Docker containers instead of your local machine.

## Quick Start

1. **Copy environment configuration:**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

2. **Start development environment:**
   ```bash
   ./scripts/start-dev.sh
   ```

3. **Access the application:**
   - API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs
   - Interactive API: http://localhost:8000/redoc

## Architecture Overview

DietIntel is a comprehensive nutrition tracking API built with a modern microservices architecture using Docker containers. The system provides intelligent food recognition, meal planning, and nutritional analysis capabilities.

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DietIntel Architecture                                │
└─────────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   Client Apps   │
                    │ Web/Mobile/CLI  │
                    └─────────┬───────┘
                              │ HTTP/HTTPS
                              │ REST API
                    ┌─────────▼───────┐
                    │     Nginx       │
                    │  Reverse Proxy  │
                    │ Load Balancer   │
                    └─────────┬───────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    ┌─────▼─────┐       ┌─────▼─────┐       ┌─────▼─────┐
    │ FastAPI   │       │ FastAPI   │       │ FastAPI   │
    │Instance 1 │       │Instance 2 │       │Instance N │
    │(Port 8000)│       │(Port 8001)│       │(Port 800N)│
    └─────┬─────┘       └─────┬─────┘       └─────┬─────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
  ┌─────▼─────┐         ┌─────▼─────┐         ┌─────▼─────┐
  │PostgreSQL │         │   Redis   │         │ External  │
  │ Database  │         │   Cache   │         │    APIs   │
  │(Port 5432)│         │(Port 6379)│         │           │
  └───────────┘         └───────────┘         └─────┬─────┘
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              │                     │                     │
                        ┌─────▼─────┐         ┌─────▼─────┐         ┌─────▼─────┐
                        │OpenFood   │         │  Mindee   │         │  GPT-4o   │
                        │Facts API  │         │ OCR API   │         │ Vision    │
                        │           │         │           │         │   API     │
                        └───────────┘         └───────────┘         └───────────┘
```

### Container Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Docker Environment                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

      dietintel_network (Bridge Network)
    ┌─────────────────────────────────────────┐
    │                                         │
    │  ┌──────────────┐    ┌──────────────┐   │    ┌──────────────┐
    │  │   api:8000   │    │  db:5432     │   │    │ redis:6379   │
    │  │              │◄──►│              │   │    │              │
    │  │ FastAPI App  │    │ PostgreSQL   │   │    │ Redis Cache  │
    │  │              │    │              │   │    │              │
    │  │ • REST API   │    │ • User Data  │   │    │ • API Cache  │
    │  │ • OCR Engine │    │ • Meal Plans │   │    │ • Sessions   │
    │  │ • ML Models  │    │ • Products   │   │◄──►│ • Rate Limit │
    │  │ • Auth       │    │ • Logs       │   │    │              │
    │  └──────────────┘    └──────────────┘   │    └──────────────┘
    │                                         │
    │         ┌──────────────┐                │
    │         │ pgadmin:8080 │                │    ┌──────────────┐
    │         │              │                │    │              │
    │         │ DB Interface │                │    │   Volumes    │
    │         │ (Optional)   │                │    │              │
    │         └──────────────┘                │    │ postgres_data│
    │                                         │    │ redis_data   │
    └─────────────────────────────────────────┘    │ pgadmin_data │
                                                   └──────────────┘
```

## How It Works

### 1. Request Flow Architecture

```
User Request → Nginx → FastAPI → Database/Cache → External APIs → Response

┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Client  │───►│ Nginx   │───►│FastAPI  │───►│Database │───►│Response │
│         │    │         │    │         │    │ Layer   │    │         │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                     │              ▲
                                     ▼              │
                              ┌─────────┐    ┌─────────┐
                              │External │    │ Redis   │
                              │APIs     │    │ Cache   │
                              └─────────┘    └─────────┘
```

### 2. Data Flow Patterns

#### **A. Product Barcode Lookup**
```
1. Client scans barcode → POST /product/by-barcode
2. FastAPI validates barcode format
3. Check Redis cache for existing product
4. If cached → return cached data (< 5ms)
5. If not cached:
   a. Query PostgreSQL products table
   b. If not in DB → call OpenFoodFacts API
   c. Parse and normalize product data
   d. Store in PostgreSQL for persistence
   e. Cache in Redis (24h TTL)
6. Return structured product response
```

#### **B. OCR Nutrition Label Processing**
```
1. Client uploads image → POST /product/scan-label
2. FastAPI receives multipart/form-data
3. Save image to temporary storage
4. Image preprocessing pipeline:
   a. OpenCV: grayscale, denoise, threshold
   b. Upscale for better OCR accuracy
5. Local OCR processing:
   a. Tesseract/EasyOCR text extraction
   b. Confidence scoring
6. If confidence < 70% → trigger external OCR:
   a. Call Mindee/GPT-4o/Azure APIs
   b. Enhanced text extraction
7. Nutrition text parsing:
   a. Multilingual regex patterns
   b. Unit normalization
   c. Value validation
8. Store OCR log in PostgreSQL
9. Return structured nutrition data
```

#### **C. Meal Plan Generation**
```
1. Client requests meal plan → POST /plan/generate
2. FastAPI validates user profile and goals
3. Calculate BMR/TDEE using Mifflin-St Jeor equation
4. Query PostgreSQL for suitable products:
   a. Filter by dietary restrictions
   b. Exclude allergies
   c. Match nutritional targets
5. Generate balanced meal distribution:
   a. Breakfast: 25% calories
   b. Lunch: 35% calories
   c. Dinner: 30% calories
   d. Snacks: 10% calories
6. Store meal plan in PostgreSQL
7. Return structured meal plan response
```

### 3. Service Communication Patterns

#### **Synchronous Communication**
- **HTTP REST APIs** between client and FastAPI
- **Database queries** (PostgreSQL) with connection pooling
- **Cache operations** (Redis) with async/await patterns

#### **Asynchronous Processing**
- **OCR processing** runs in background threads
- **External API calls** with timeout and retry logic
- **Batch operations** for multiple barcode lookups

#### **Error Handling & Resilience**
```python
# Circuit Breaker Pattern
External API Call
├── Success → Cache result → Return data
├── Timeout → Retry with exponential backoff (3x)
├── Rate Limit → Wait and retry
└── Failure → Return cached/default data

# Graceful Degradation
PostgreSQL Down → Continue with Redis cache only
Redis Down → Direct database queries (slower)
External APIs Down → Return local data only
```

### 4. Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Security Layers                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────┐
│ API Gateway │  ← Rate limiting, IP filtering
└─────────────┘
       │
┌─────────────┐
│ JWT Auth    │  ← Token-based authentication
└─────────────┘
       │
┌─────────────┐
│ FastAPI     │  ← Request validation, CORS, HTTPS
└─────────────┘
       │
┌─────────────┐
│ Database    │  ← Connection pooling, SQL injection prevention
└─────────────┘
```

- **JWT Authentication**: Stateless token-based auth
- **Password Hashing**: bcrypt with salt rounds
- **SQL Injection Protection**: SQLAlchemy ORM with parameterized queries
- **CORS Configuration**: Controlled cross-origin access
- **Environment Secrets**: Secure credential management
- **Container Isolation**: Network segregation between services

### 5. Performance Optimization

#### **Caching Strategy**
```
L1 Cache: Application Memory (FastAPI process)
L2 Cache: Redis (shared across instances)
L3 Cache: PostgreSQL query cache
L4 Storage: Persistent database storage

Cache Hierarchy:
┌─────────────┐ Hit Rate: ~95%
│ Memory      │ Latency: < 1ms
└─────────────┘
       │ Miss
┌─────────────┐ Hit Rate: ~80%
│ Redis       │ Latency: < 5ms  
└─────────────┘
       │ Miss  
┌─────────────┐ Hit Rate: ~60%
│ PostgreSQL  │ Latency: < 50ms
└─────────────┘
       │ Miss
┌─────────────┐
│ External    │ Latency: 100-300ms
│ APIs        │
└─────────────┘
```

#### **Database Optimization**
- **Connection Pooling**: 5-20 concurrent connections
- **Async I/O**: Non-blocking database operations
- **Query Optimization**: Indexes on frequently queried columns
- **Batch Processing**: Bulk operations for multiple records

#### **API Performance**
- **Parallel Processing**: Concurrent external API calls
- **Request Compression**: Gzip compression for responses
- **Background Tasks**: Non-critical processing moved to background
- **Resource Limits**: Container memory and CPU constraints

### 6. Monitoring & Observability

```
┌─────────────────────────────────────────────────────────────────┐
│                    Observability Stack                         │
└─────────────────────────────────────────────────────────────────┘

Application Logs    System Metrics    Business Metrics
      │                    │                 │
      ▼                    ▼                 ▼
┌─────────────┐    ┌─────────────┐   ┌─────────────┐
│ Structured  │    │ Docker      │   │ User        │
│ JSON Logs   │    │ Stats       │   │ Analytics   │
└─────────────┘    └─────────────┘   └─────────────┘
      │                    │                 │
      └────────────────────┼─────────────────┘
                           │
                    ┌─────────────┐
                    │ Health      │
                    │ Checks      │
                    └─────────────┘
```

#### **Health Monitoring**
- **Application Health**: `/health` endpoint with dependency checks
- **Database Health**: PostgreSQL connection status
- **Cache Health**: Redis availability and performance
- **External API Health**: OpenFoodFacts API status

#### **Key Performance Indicators**
- **Response Times**: P50, P95, P99 latencies
- **Cache Hit Ratios**: Redis and application-level caching
- **Error Rates**: 4xx/5xx HTTP status codes
- **Throughput**: Requests per second by endpoint
- **Resource Usage**: CPU, memory, disk, network per container

### 7. Scalability Patterns

#### **Horizontal Scaling**
```
Load Balancer (Nginx)
├── FastAPI Instance 1 (Container)
├── FastAPI Instance 2 (Container)  
├── FastAPI Instance 3 (Container)
└── FastAPI Instance N (Container)
         │
    Shared Database Layer
    ├── PostgreSQL (Primary/Replica)
    └── Redis Cluster
```

#### **Vertical Scaling**
- **Container Resources**: CPU/memory limits per service
- **Database Optimization**: Connection pooling, query optimization
- **Cache Optimization**: Memory allocation, eviction policies

#### **Auto-scaling Triggers**
- **CPU Usage** > 70% for 5 minutes
- **Memory Usage** > 80% for 5 minutes  
- **Response Time** > 500ms average for 2 minutes
- **Error Rate** > 5% for 1 minute

This architecture provides a robust, scalable, and maintainable foundation for the DietIntel nutrition tracking platform, with clear separation of concerns and comprehensive error handling throughout the system.

## Services

### Core Services

```bash
# Start all core services
docker-compose up -d

# Start with logs visible
docker-compose up

# Start specific service
docker-compose up api
```

### Development Tools

```bash
# Start with development tools (pgAdmin, etc.)
docker-compose --profile tools up -d

# Access pgAdmin at http://localhost:8080
# Email: admin@dietintel.com
# Password: admin_password
```

### Production

```bash
# Production environment
docker-compose -f docker-compose.prod.yml up -d
```

## Database

### Initial Setup

The PostgreSQL database is automatically initialized with:
- User management tables
- Product catalog tables  
- Meal planning tables
- OCR processing logs
- Sample demo user account

### Database Connection

**From Host:**
```
Host: localhost
Port: 5432
Database: dietintel
Username: dietintel_user
Password: dietintel_password
```

**From Container:**
```
DATABASE_URL=postgresql://dietintel_user:dietintel_password@db:5432/dietintel
```

### pgAdmin Setup

1. Start with tools profile: `docker-compose --profile tools up -d`
2. Go to http://localhost:8080
3. Login with admin@dietintel.com / admin_password
4. Add server connection:
   - Name: DietIntel
   - Host: db
   - Port: 5432
   - Username: dietintel_user
   - Password: dietintel_password

## Redis Cache

Redis is used for caching OpenFoodFacts API responses:

**Configuration:**
- URL: redis://:dietintel_redis_password@localhost:6379/0
- TTL: 24 hours (configurable)
- Max Connections: 20 (configurable)

**Redis CLI Access:**
```bash
# Connect to Redis
docker-compose exec redis redis-cli
auth dietintel_redis_password

# View cached keys
keys barcode:*

# Check cache stats
info stats
```

## Development Workflow

### Hot Reloading

The development container mounts your source code, so changes are automatically reloaded:

```bash
# Edit code in your editor
# API automatically reloads
# Check logs: docker-compose logs -f api
```

### Running Tests

```bash
# Run tests inside container
docker-compose exec api python -m pytest tests/ -v

# Run specific test file
docker-compose exec api python -m pytest tests/test_barcode_lookup.py -v

# Run with coverage
docker-compose exec api python -m pytest tests/ --cov=app --cov-report=html
```

### Database Migrations

```bash
# Generate migration
docker-compose exec api alembic revision --autogenerate -m "Description"

# Apply migrations
docker-compose exec api alembic upgrade head

# View migration history
docker-compose exec api alembic history
```

## Troubleshooting

### Container Issues

```bash
# View container logs
docker-compose logs api
docker-compose logs db
docker-compose logs redis

# Rebuild containers
docker-compose up --build

# Reset everything
docker-compose down -v  # WARNING: Deletes data volumes
docker-compose up --build
```

### Database Issues

```bash
# Check database connection
docker-compose exec api python -c "
from app.config import config
print(f'Database URL: {config.database_url}')
"

# Check PostgreSQL status
docker-compose exec db pg_isready -U dietintel_user -d dietintel

# View database logs
docker-compose logs db
```

### Redis Issues

```bash
# Check Redis connection
docker-compose exec redis redis-cli ping

# View Redis logs
docker-compose logs redis

# Clear Redis cache
docker-compose exec redis redis-cli flushall
```

### Performance Issues

```bash
# Check container resources
docker stats

# View API performance
docker-compose exec api python -c "
import asyncio
from app.services.barcode_lookup import lookup_by_barcode
print(asyncio.run(lookup_by_barcode('737628064502')))
"
```

## Environment Variables

Key environment variables (see `.env.example`):

### Database
- `DATABASE_URL` - PostgreSQL connection string
- `POSTGRES_DB` - Database name
- `POSTGRES_USER` - Database username  
- `POSTGRES_PASSWORD` - Database password

### Redis
- `REDIS_URL` - Redis connection string
- `REDIS_PASSWORD` - Redis password
- `REDIS_CACHE_TTL_HOURS` - Cache expiration (hours)

### API
- `SECRET_KEY` - JWT token secret
- `LOG_LEVEL` - Logging level (DEBUG, INFO, WARNING, ERROR)
- `ENVIRONMENT` - Environment name (development, production)

### OpenFoodFacts
- `OFF_BASE_URL` - API base URL
- `OFF_TIMEOUT` - Request timeout
- `OFF_RATE_LIMIT_DELAY` - Delay between requests

## Production Deployment

For production deployment:

1. **Use production compose file:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Set secure environment variables:**
   ```bash
   # Generate secure secret key
   SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
   
   # Set strong passwords
   POSTGRES_PASSWORD=$(openssl rand -base64 32)
   REDIS_PASSWORD=$(openssl rand -base64 32)
   ```

3. **Configure reverse proxy:**
   - Add SSL certificates to `nginx/ssl/`
   - Update `nginx/prod.conf` with your domain
   - Enable HTTPS redirect

4. **Monitor services:**
   ```bash
   # Check service health
   docker-compose -f docker-compose.prod.yml ps
   
   # View production logs
   docker-compose -f docker-compose.prod.yml logs -f
   ```

## Data Persistence

Docker volumes ensure data persistence:

- `postgres_data` - Database files
- `redis_data` - Redis persistence
- `pgadmin_data` - pgAdmin settings

**Backup:**
```bash
# Backup database
docker-compose exec db pg_dump -U dietintel_user dietintel > backup.sql

# Backup Redis
docker-compose exec redis redis-cli save
```

## Networking

All services communicate through the `dietintel_network` bridge:

- Services can reach each other by container name
- External access only through exposed ports
- Production setup restricts external database access