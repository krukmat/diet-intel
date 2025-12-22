"""
Intelligent Flow API Routes

Expose the unified IA pipeline that chains Food Vision, Recipe AI y Smart Diet.
Supports synchronous execution and an asynchronous job mode backed by an
in-memory queue.
"""

from datetime import datetime
from typing import Any, Dict, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field

from app.models.intelligent_flow import (
    IntelligentFlowRequest,
    IntelligentFlowResponse,
    IntelligentFlowRecipePreferences,
    IntelligentFlowSmartDietConfig,
)
from app.models.user import User
from app.services.auth import get_current_user
from app.services.intelligent_flow import (
    intelligent_flow_service,
    IntelligentFlowValidationError,
)
from app.services.intelligent_flow_queue import intelligent_flow_queue
from app.utils.feature_flags import assert_feature_enabled

router = APIRouter(tags=["intelligent-flow"])


class IntelligentFlowPayload(BaseModel):
    """Request payload without user-bound fields (resolved via auth)."""

    image_base64: str = Field(..., description="Meal image in Base64 (JPEG/PNG/WebP)")
    meal_type: str = Field("lunch", description="Meal context (breakfast|lunch|dinner|snack)")
    user_context: Optional[Dict[str, Any]] = Field(None, description="Optional user metadata")
    recipe_preferences: Optional[IntelligentFlowRecipePreferences] = Field(
        None,
        description="Optional preferences to fine-tune Recipe AI",
    )
    smart_diet_config: IntelligentFlowSmartDietConfig = Field(
        default_factory=IntelligentFlowSmartDietConfig,
        description="Optional overrides for Smart Diet",
    )


class IntelligentFlowJobStatus(BaseModel):
    """Public representation of a queued intelligent flow job."""

    job_id: str = Field(..., description="Identifier for the queued job")
    status: str = Field(..., description="queued|running|completed|failed")
    created_at: datetime = Field(..., description="Job creation timestamp (UTC)")
    updated_at: datetime = Field(..., description="Last status update (UTC)")
    result: Optional[IntelligentFlowResponse] = Field(None, description="Flow result when completed")
    error: Optional[str] = Field(None, description="Error message when failed")


@router.post(
    "",
    response_model=Union[IntelligentFlowResponse, IntelligentFlowJobStatus],
    responses={
        202: {"description": "Flow accepted for asynchronous processing"},
        400: {"description": "Invalid request payload"},
        401: {"description": "Authentication required"},
        404: {"description": "Feature disabled"},
        500: {"description": "Intelligent flow execution failed"},
    },
)
async def run_intelligent_flow(
    payload: IntelligentFlowPayload,
    response: Response,
    current_user: User = Depends(get_current_user),
    async_mode: bool = Query(
        False,
        description="When true, enqueue the flow and return immediately with a job_id",
    ),
) -> Union[IntelligentFlowResponse, IntelligentFlowJobStatus]:
    """
    Execute the intelligent flow for the authenticated user.

    Returns the full pipeline output (vision, recipe, smart diet) junto con
    métricas de ejecución y estado agregado. Cuando `async_mode=true`, la ejecución
    se encola y el endpoint devuelve metadata del job.
    """
    assert_feature_enabled("intelligent_flow_enabled")

    request = IntelligentFlowRequest(
        user_id=current_user.id,
        image_base64=payload.image_base64,
        meal_type=payload.meal_type,
        user_context=payload.user_context,
        recipe_preferences=payload.recipe_preferences,
        smart_diet_config=payload.smart_diet_config,
    )

    if async_mode:
        job = await intelligent_flow_queue.enqueue(intelligent_flow_service, request)
        response.status_code = status.HTTP_202_ACCEPTED
        return IntelligentFlowJobStatus(
            job_id=job.id,
            status=job.status,
            created_at=job.created_at,
            updated_at=job.updated_at,
            result=None,
            error=None,
        )

    try:
        return await intelligent_flow_service.run_flow(request)
    except IntelligentFlowValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive catch-all
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Intelligent flow execution failed",
        ) from exc


@router.get(
    "/{job_id}",
    response_model=IntelligentFlowJobStatus,
    responses={
        404: {"description": "Job not found"},
    },
)
async def get_intelligent_flow_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
) -> IntelligentFlowJobStatus:
    """Retrieve the status/result of an enqueued intelligent flow job."""
    assert_feature_enabled("intelligent_flow_enabled")

    job = await intelligent_flow_queue.get(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    if job.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    return IntelligentFlowJobStatus(
        job_id=job.id,
        status=job.status,
        created_at=job.created_at,
        updated_at=job.updated_at,
        result=job.result if job.status == "completed" else None,
        error=job.error,
    )
