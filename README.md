# DietIntel API

A comprehensive FastAPI application for nutrition tracking with barcode product lookup, OCR label scanning, and AI-powered daily meal planning.

## Features

- **POST /product/by-barcode**: Lookup product information by barcode
- **POST /product/scan-label**: OCR nutrition label scanning with image upload
- **POST /product/scan-label-external**: OCR with external service fallback
- **POST /plan/generate**: Generate personalized daily meal plans
- **Redis Caching**: 24-hour cache for successful responses
- **Local OCR**: Tesseract + OpenCV preprocessing for nutrition text extraction
- **Confidence Scoring**: Smart confidence assessment for OCR results
- **BMR/TDEE Calculations**: Mifflin-St Jeor equation with activity level adjustments
- **Meal Planning**: Greedy algorithm with flexible constraints and macro tracking
- **Error Handling**: Proper HTTP status codes and error messages
- **Async Implementation**: Full async support with timeouts
- **Comprehensive Testing**: Unit tests for all core functionality
- **Logging**: Request latency, OCR processing time, and cache hit/miss metrics

## Architecture Overview

DietIntel is built with a modern microservices architecture providing intelligent food recognition, meal planning, and nutritional analysis capabilities.

### System Architecture

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
                    │   FastAPI App   │
                    │  (Port 8000)    │
                    └─────────┬───────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
  ┌─────▼─────┐         ┌─────▼─────┐         ┌─────▼─────┐
  │PostgreSQL │         │   Redis   │         │ External  │
  │ Database  │         │   Cache   │         │    APIs   │
  │           │         │           │         │           │
  └───────────┘         └───────────┘         └─────┬─────┘
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              │                     │                     │
                        ┌─────▼─────┐         ┌─────▼─────┐         ┌─────▼─────┐
                        │OpenFood   │         │  Mindee   │         │  GPT-4o   │
                        │Facts API  │         │ OCR API   │         │ Vision    │
                        └───────────┘         └───────────┘         └───────────┘
```

### Data Flow Patterns

#### **Product Barcode Lookup Flow**
```
1. Client scans barcode → POST /product/by-barcode
2. FastAPI validates barcode format
3. Check Redis cache for existing product (< 5ms if cached)
4. If not cached:
   a. Query PostgreSQL products table
   b. If not in DB → call OpenFoodFacts API
   c. Parse and normalize product data
   d. Store in PostgreSQL + Cache in Redis (24h TTL)
5. Return structured product response
```

#### **OCR Nutrition Label Processing Flow**
```
1. Client uploads image → POST /product/scan-label
2. FastAPI receives multipart/form-data
3. Image preprocessing pipeline (OpenCV):
   a. Grayscale conversion
   b. Noise reduction  
   c. Adaptive thresholding
   d. Image upscaling for accuracy
4. Local OCR processing (Tesseract/EasyOCR):
   a. Text extraction with confidence scoring
   b. Multilingual support (English/Spanish/French)
5. If confidence < 70% → trigger external OCR fallback
6. Nutrition text parsing:
   a. Regex pattern matching with OCR error tolerance
   b. Unit normalization and value validation
7. Store OCR processing log in PostgreSQL
8. Return structured nutrition data with confidence score
```

#### **AI Meal Plan Generation Flow**
```
1. Client requests meal plan → POST /plan/generate
2. FastAPI validates user profile and dietary preferences
3. Calculate BMR using Mifflin-St Jeor equation
4. Calculate TDEE with activity level multiplier
5. Query PostgreSQL for suitable products:
   a. Filter by dietary restrictions
   b. Exclude allergens
   c. Match nutritional targets
6. Generate balanced meal distribution:
   a. Breakfast: 25% calories
   b. Lunch: 35% calories
   c. Dinner: 30% calories
   d. Snacks: 10% calories
7. Apply greedy algorithm for optimal macro balance
8. Store meal plan in PostgreSQL with change tracking
9. Return structured meal plan with nutritional analysis
```

### Technology Stack

#### **Backend Services**
- **FastAPI** - High-performance async web framework
- **PostgreSQL** - Primary database for users, meal plans, products
- **Redis** - High-speed cache for API responses and session management
- **SQLAlchemy** - ORM with async support and connection pooling
- **Alembic** - Database migrations and schema management

#### **OCR & Image Processing**
- **Tesseract** - Local OCR engine with multilingual support
- **EasyOCR** - Alternative OCR engine for better accuracy
- **OpenCV** - Image preprocessing and enhancement
- **PIL (Pillow)** - Image format handling and manipulation

#### **External Integrations**
- **OpenFoodFacts API** - Global product database with nutritional information
- **Mindee OCR API** - Professional OCR service for nutrition labels
- **GPT-4o Vision** - AI-powered image analysis and text extraction
- **Azure Computer Vision** - Microsoft's OCR and image analysis service

#### **Development & Deployment**
- **Docker** - Containerization for consistent environments
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Reverse proxy and load balancing (production)
- **pytest** - Comprehensive testing framework with async support

### Performance Characteristics

#### **Caching Strategy (Multi-Tier)**
```
L1 Cache: Application Memory    → Hit Rate: ~95% | Latency: < 1ms
L2 Cache: Redis                → Hit Rate: ~80% | Latency: < 5ms  
L3 Cache: PostgreSQL           → Hit Rate: ~60% | Latency: < 50ms
L4 Storage: External APIs      → Latency: 100-300ms
```

#### **Response Times**
- **Cached Barcode Lookup**: < 5ms
- **Fresh Barcode Lookup**: 100-300ms (OpenFoodFacts API call)
- **Local OCR Processing**: 2-5 seconds
- **External OCR Processing**: 3-10 seconds
- **Meal Plan Generation**: 500ms-2s (depending on complexity)

#### **Scalability**
- **Horizontal Scaling**: Multiple FastAPI instances behind load balancer
- **Database Scaling**: PostgreSQL with read replicas and connection pooling
- **Cache Scaling**: Redis cluster with data partitioning
- **Auto-scaling**: Based on CPU/memory usage and response times

### Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Security Layers                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────┐
│ API Gateway │  ← Rate limiting, IP filtering, DDoS protection
└─────────────┘
       │
┌─────────────┐
│ JWT Auth    │  ← Token-based authentication, refresh tokens
└─────────────┘
       │
┌─────────────┐
│ FastAPI     │  ← Request validation, CORS, input sanitization
└─────────────┘
       │
┌─────────────┐
│ Database    │  ← Connection pooling, parameterized queries
└─────────────┘
```

#### **Security Features**
- **JWT Authentication**: Stateless token-based authentication with refresh
- **Password Security**: bcrypt hashing with configurable salt rounds
- **SQL Injection Prevention**: SQLAlchemy ORM with parameterized queries
- **CORS Configuration**: Controlled cross-origin resource sharing
- **Input Validation**: Pydantic models with strict type checking
- **Container Security**: Isolated Docker containers with minimal attack surface
- **Environment Secrets**: Secure credential management and rotation

### Error Handling & Resilience

#### **Circuit Breaker Pattern**
```
External API Call
├── Success → Cache result → Return data
├── Timeout → Retry with exponential backoff (max 3 attempts)
├── Rate Limit → Wait and retry with jitter
└── Failure → Return cached data or graceful degradation
```

#### **Graceful Degradation**
- **PostgreSQL Down** → Continue with Redis cache only (read-only mode)
- **Redis Down** → Direct database queries (slower but functional)
- **External APIs Down** → Return local/cached data with warning
- **OCR Processing Failed** → Return partial results with low confidence flag

### Monitoring & Observability

#### **Health Monitoring**
- **Application Health**: `/health` endpoint with dependency checks
- **Database Health**: PostgreSQL connection status and query performance
- **Cache Health**: Redis availability, hit rates, and memory usage
- **External API Health**: Response times and error rates for external services

#### **Key Metrics Tracked**
- **Response Times**: P50, P95, P99 latencies by endpoint
- **Cache Performance**: Hit/miss ratios, eviction rates, memory usage
- **Error Rates**: 4xx/5xx HTTP status codes, exception frequencies
- **Business Metrics**: OCR accuracy, meal plan success rates, user engagement
- **Resource Usage**: CPU, memory, disk I/O, network throughput per service

This architecture provides a robust, scalable foundation for intelligent nutrition tracking with comprehensive error handling, security, and performance optimization throughout the system.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Install OCR dependencies:
```bash
# Check what's needed for your system
python install_ocr_deps.py

# macOS
brew install tesseract

# Ubuntu/Debian
sudo apt install tesseract-ocr tesseract-ocr-eng
```

3. Start Redis (required for caching):
```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Or install Redis locally
```

4. Run the application:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

## API Documentation

Once running, visit `http://localhost:8000/docs` for interactive API documentation.

## Testing

Run tests with pytest:
```bash
pytest
```

## Example Usage

### Barcode Lookup
```bash
curl -X POST "http://localhost:8000/product/by-barcode" \
     -H "Content-Type: application/json" \
     -d '{"barcode": "737628064502"}'
```

### Nutrition Label Scanning
```bash
curl -X POST "http://localhost:8000/product/scan-label" \
     -F "image=@nutrition_label.jpg"
```

### Meal Plan Generation
```bash
curl -X POST "http://localhost:8000/plan/generate" \
     -H "Content-Type: application/json" \
     -d '{
       "user_profile": {
         "age": 30,
         "sex": "male",
         "height_cm": 180,
         "weight_kg": 75,
         "activity_level": "moderately_active",
         "goal": "maintain"
       },
       "preferences": {
         "dietary_restrictions": ["vegetarian"],
         "excludes": ["nuts"],
         "prefers": ["organic"]
       },
       "optional_products": ["737628064502"],
       "flexibility": true
     }'
```

## Response Format

### Barcode Response
```json
{
  "source": "OpenFoodFacts",
  "barcode": "737628064502",
  "name": "Product Name",
  "brand": "Brand Name", 
  "image_url": "https://...",
  "serving_size": "100g",
  "nutriments": {
    "energy_kcal_per_100g": 250.0,
    "protein_g_per_100g": 10.0,
    "fat_g_per_100g": 5.0,
    "carbs_g_per_100g": 40.0,
    "sugars_g_per_100g": 15.0,
    "salt_g_per_100g": 1.2
  },
  "fetched_at": "2024-01-01T12:00:00.000Z"
}
```

### OCR Scan Response (High Confidence ≥0.7)
```json
{
  "source": "Local OCR",
  "confidence": 0.83,
  "raw_text": "Energy: 250 kcal Protein: 10g...",
  "serving_size": "100g",
  "nutriments": {
    "energy_kcal_per_100g": 250.0,
    "protein_g_per_100g": 10.0,
    "fat_g_per_100g": 5.0,
    "carbs_g_per_100g": 40.0,
    "sugars_g_per_100g": 15.0,
    "salt_g_per_100g": 1.2
  },
  "scanned_at": "2024-01-01T12:00:00.000Z"
}
```

### OCR Scan Response (Low Confidence <0.7)
```json
{
  "low_confidence": true,
  "confidence": 0.33,
  "raw_text": "unclear nutrition text...",
  "partial_parsed": {
    "energy_kcal": 250.0,
    "protein_g": 10.0,
    "fat_g": null,
    "carbs_g": null,
    "sugars_g": null,
    "salt_g": null
  },
  "suggest_external_ocr": true,
  "scanned_at": "2024-01-01T12:00:00.000Z"
}
```

### Meal Plan Response
```json
{
  "bmr": 1730.0,
  "tdee": 2681.5,
  "daily_calorie_target": 2681.5,
  "meals": [
    {
      "name": "Breakfast",
      "target_calories": 670.4,
      "actual_calories": 650.0,
      "items": [
        {
          "barcode": "000000000001",
          "name": "Oatmeal",
          "serving": "50g",
          "calories": 175.0,
          "macros": {
            "protein_g": 8.5,
            "fat_g": 3.0,
            "carbs_g": 30.0,
            "sugars_g": 1.0,
            "salt_g": 0.0
          }
        }
      ]
    }
  ],
  "metrics": {
    "total_calories": 2650.0,
    "protein_g": 132.5,
    "fat_g": 88.3,
    "carbs_g": 331.2,
    "sugars_g": 45.1,
    "salt_g": 8.2,
    "protein_percent": 20.0,
    "fat_percent": 30.0,
    "carbs_percent": 50.0
  },
  "created_at": "2024-01-01T12:00:00.000Z",
  "flexibility_used": true,
  "optional_products_used": 2
}
```