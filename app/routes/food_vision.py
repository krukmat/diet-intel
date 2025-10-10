"""
Food Vision API Routes - Endpoints for photo-based food analysis

Part of FEAT-PROPORTIONS implementation
Provides REST API for food image analysis and exercise suggestions
"""

import logging
import os
from typing import Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.services.food_vision_service import food_vision_service
from app.models.food_vision import VisionLogResponse, ErrorResponse
from app.services.database import db_service
from app.services import auth as auth_module
from app.utils.image_processor import ImageProcessor

router = APIRouter(prefix="/api/v1/food/vision", tags=["food-vision"])
security = HTTPBearer(auto_error=False)

logger = logging.getLogger(__name__)

@router.post("/analyze", response_model=VisionLogResponse)
async def analyze_food_image(
    file: UploadFile = File(...),
    meal_type: str = Form("lunch", description="Tipo de comida: breakfast|lunch|dinner"),
    current_weight_kg: Optional[float] = Form(None, description="Peso actual en kg"),
    activity_level: Optional[str] = Form(None, description="Nivel de actividad"),
    goal: Optional[str] = Form(None, description="Objetivo: lose_weight|maintain|gain_weight"),
    current_context: auth_module.RequestContext = Depends(auth_module.get_current_request_context),
) -> VisionLogResponse:
    """
    Analyze food image and return nutritional breakdown with exercise suggestions

    MVP Implementation:
    - Accepts JPEG/PNG/WebP images up to 10MB
    - Performs computer vision analysis
    - Returns nutritional estimates and exercise suggestions
    - Authenticated users get personalized recommendations
    """

    # Validate input
    if not file:
        raise HTTPException(status_code=400, detail="No image file provided")

    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are supported")

    # Enforce JWT authentication
    user_id = current_context.user_id
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required for analysis")

    # Read and validate file
    try:
        content = await file.read()
        file_size = len(content)

        # Check file size (10MB limit)
        if file_size > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image too large. Maximum 10MB allowed")

        # Basic image validation
        if not ImageProcessor.validate_image_format(content):
            raise HTTPException(status_code=400, detail="Invalid image format")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing uploaded file: {e}")
        raise HTTPException(status_code=400, detail="Could not process image file")

    # Prepare user context for analysis
    user_context = {}
    if current_weight_kg:
        user_context["current_weight_kg"] = current_weight_kg
    if activity_level:
        user_context["activity_level"] = activity_level
    if goal:
        user_context["goal"] = goal

    try:
        # Perform food analysis
        result = await food_vision_service.analyze_food_image(
            image_data=content,
            user_id=user_id,
            meal_type=meal_type,
            user_context=user_context if user_context else None
        )

        # Persistir análisis después de obtener resultado
        try:
            persisted_response = await food_vision_service.save_analysis(user_id, result)
            logger.info(f"Analysis persisted for user {user_id}: {persisted_response.id}")
        except Exception as persist_error:
            logger.error(f"Failed to persist analysis but continuing: {persist_error}")
            persisted_response = result

        # Log successful analysis
        logger.info(f"Food analysis completed for user {user_id}: {len(persisted_response.identified_ingredients)} ingredients, {persisted_response.estimated_portions.get('total_calories', 0)} calories")

        return persisted_response

    except Exception as e:
        logger.error(f"Error in food image analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

@router.get("/history", response_model=Dict[str, Any])
async def get_user_analysis_history(
    limit: int = Query(20, ge=1, le=100, description="Number of records to return"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_context: auth_module.RequestContext = Depends(auth_module.get_current_request_context),
) -> Dict[str, Any]:
    """
    Retrieve user's food analysis history

    MVP Implementation:
    - Returns empty list until database is implemented
    - Supports basic pagination (no auth required for MVP)
    """

    # Enforce JWT authentication
    user_id = current_context.user_id
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required for history")

    try:
        # Get user history con filtering
        history = await food_vision_service.get_user_history(
            user_id=user_id,
            limit=limit,
            offset=offset,
            date_from=date_from,
            date_to=date_to
        )

        logger.info(f"Retrieved analysis history for user {user_id}: {len(history.get('logs', []))} records")

        return history

    except Exception as e:
        logger.error(f"Error retrieving user history: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Could not retrieve history: {str(e)}"
        )

@router.post("/correction", response_model=Dict[str, Any])
async def submit_analysis_correction(
    log_id: str = Form(..., description="Analysis ID to correct"),
    corrected_calories: Optional[str] = Form(None, description="Corrected calorie count"),
    corrected_protein_g: Optional[str] = Form(None, description="Corrected protein in grams"),
    corrected_fat_g: Optional[str] = Form(None, description="Corrected fat in grams"),
    corrected_carbs_g: Optional[str] = Form(None, description="Corrected carbs in grams"),
    correction_notes: Optional[str] = Form("", description="Additional correction notes"),
    feedback_type: str = Form("portion_correction", description="Type of correction feedback"),
    current_context: auth_module.RequestContext = Depends(auth_module.get_current_request_context),
) -> Dict[str, Any]:
    """
    Submit user correction for improving future analysis

    MVP Implementation:
    - Accepts correction data
    - Logs correction for future improvements (no auth required for MVP)
    """

    # Cambiar ruta para requerir auth
    user_id = current_context.user_id
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required for corrections")

    # Validate log_id with uuid.UUID
    try:
        import uuid
        uuid.UUID(log_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid analysis log ID format")

    # Validate log_id format (basic UUID check)
    import re
    if not re.match(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$', log_id):
        raise HTTPException(status_code=400, detail="Invalid analysis log ID format")

    # Prepare correction data
    correction_data = {
        "feedback_type": feedback_type,
        "correction_notes": correction_notes or "",
        "original_data": {}  # TODO: Fetch from database when implemented
    }

    # Add numeric corrections if provided
    if any([corrected_calories, corrected_protein_g, corrected_fat_g, corrected_carbs_g]):
        corrected_portions = {}
        try:
            if corrected_calories:
                corrected_portions["actual_calories"] = float(corrected_calories)
            if corrected_protein_g:
                corrected_portions["actual_protein_g"] = float(corrected_protein_g)
            if corrected_fat_g:
                corrected_portions["actual_fat_g"] = float(corrected_fat_g)
            if corrected_carbs_g:
                corrected_portions["actual_carbs_g"] = float(corrected_carbs_g)

            correction_data["corrected_portions"] = corrected_portions
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid numeric value in correction data")

    # Submit correction
    try:
        result = await food_vision_service.submit_correction(
            log_id=log_id,
            user_id=user_id,
            correction_data=correction_data
        )

        logger.info(f"Correction submitted for analysis {log_id} by user {user_id}")

        return result

    except Exception as e:
        logger.error(f"Error submitting correction: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Correction submission failed: {str(e)}"
        )

@router.get("/health", response_model=Dict[str, Any])
async def health_check():
    """
    Health check endpoint for vision analysis service

    Returns service status and version information
    """
    return {
        "status": "healthy",
        "service": "food-vision",
        "version": "MVP_v1.0",
        "features": [
            "image_analysis",
            "nutritional_estimation",
            "exercise_suggestions",
            "user_corrections"
        ],
        "supported_formats": ["JPEG", "PNG", "WebP"],
        "max_file_size_mb": 10
    }
