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