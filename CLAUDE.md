# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DietIntel is a FastAPI application for nutrition tracking with product lookup, OCR label scanning, and AI-powered meal planning.

## Development Setup

1. Install dependencies: `pip install -r requirements.txt`
2. Start Redis: `docker run -d -p 6379:6379 redis:alpine`
3. Run the application: `python main.py`
4. Run tests: `pytest`

## Architecture

- **FastAPI**: Web framework with automatic OpenAPI documentation
- **Pydantic Models**: Request/response validation in `app/models/`
- **Service Layer**: Business logic in `app/services/`
  - `openfoodfacts.py`: External API integration with timeout handling
  - `cache.py`: Redis caching with 24-hour TTL
  - `ocr.py`: Image processing and nutrition text extraction
  - `nutrition_calculator.py`: BMR/TDEE calculations using Mifflin-St Jeor
  - `meal_planner.py`: Daily meal planning algorithm
- **Routes**: API endpoints in `app/routes/`
- **Async/Await**: Full async implementation for non-blocking operations

## Key Endpoints

- `POST /product/by-barcode`: Product lookup via barcode using OpenFoodFacts API
- `POST /product/scan-label`: OCR nutrition label scanning (local OCR)
- `POST /product/scan-label-external`: OCR with external service fallback
- `POST /plan/generate`: Generate daily meal plans based on user profile and goals
- `GET /plan/config`: Get meal planning configuration settings

## Commands

- Start server: `python main.py` or `uvicorn main:app --reload`
- Run tests: `pytest`
- Test coverage: `pytest --cov=app`
- Check OCR deps: `python install_ocr_deps.py`
- API docs: `http://localhost:8000/docs`

## External Dependencies

- **OpenFoodFacts API**: `https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
- **Redis**: Required for caching (default: `redis://localhost:6379`)
- **Tesseract OCR**: Required for image text extraction (`brew install tesseract`)
- **OpenCV**: Image preprocessing (installed via pip)

## Error Handling

- 404: Product not found in OpenFoodFacts
- 408: Request timeout (10s timeout configured)
- 413: Image file too large (>10MB)
- 503: Network/service unavailable

## OCR Features

- **Local OCR**: Uses Tesseract + OpenCV preprocessing (grayscale, denoise, adaptive threshold)
- **Confidence Scoring**: `found_fields / total_required_fields` (energy, protein, fat, carbs, sugars, salt)
- **High Confidence (≥0.7)**: Returns canonical nutriments JSON
- **Low Confidence (<0.7)**: Returns partial data + suggests external OCR
- **External OCR Hook**: Stub function `call_external_ocr()` for paid services integration

## Meal Planning Features

- **BMR Calculation**: Uses Mifflin-St Jeor equation (sex-specific formulas)
- **TDEE Calculation**: BMR × activity level multipliers (1.2 to 1.9)
- **Goal Adjustments**: Lose weight (-500 kcal), maintain (0), gain weight (+300 kcal)
- **Meal Distribution**: Configurable percentages (default: 25% breakfast, 40% lunch, 35% dinner)
- **Greedy Selection Algorithm**: Prioritizes optional products, max 3 items per meal (5 with flexibility)
- **Calorie Tolerance**: ±5% strict mode, ±15% flexible mode
- **Macro Tracking**: Complete nutritional analysis with percentage breakdowns
- always evaluate the diagrams in the readme files to show the correct architecture on the platform
- enable plan on. always show the plan before start execution.
- before implement a feature or fix a bug always add a task list and make it approved.
- in every new feature the screenshots and the explanation should be in the root readme
- when a new feature or fix is promoted in github, the readme should be completed with the date of push