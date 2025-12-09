# EPIC_A.A5: Moderation routes for content reports

from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, validator
from typing import List, Dict

from app.models.user import User
from app.services.auth import get_current_user
from app.utils.feature_flags import assert_feature_enabled
from app.services.social.report_service import ReportService

router = APIRouter()


class CreateReportRequest(BaseModel):
    target_type: str  # 'post', 'comment', 'user'
    target_id: str
    reason: str  # 'spam', 'abuse', 'nsfw', 'misinformation', 'other'
    additional_context: Optional[str] = None

    @validator('target_type')
    def validate_target_type(cls, v):
        if v not in ReportService.VALID_TARGET_TYPES:
            raise ValueError(f"Invalid target_type: {v}")
        return v

    @validator('reason')
    def validate_reason(cls, v):
        if v not in ReportService.VALID_REPORT_REASONS:
            raise ValueError(f"Invalid reason: {v}")
        return v


class ReportResponse(BaseModel):
    id: str
    target_type: str
    target_id: str
    reason: str
    status: str
    created_at: str


class ModerationActionRequest(BaseModel):
    action: str  # 'approve', 'dismiss', 'escalate'
    notes: Optional[str] = None

    @validator('action')
    def validate_action(cls, v):
        if v not in ['approve', 'dismiss', 'escalate']:
            raise ValueError(f"Invalid action: {v}")
        return v


class ReportStatsResponse(BaseModel):
    total_reports: int
    reports_by_status: Dict[str, int]
    reports_by_reason: Dict[str, int]
    recent_reports_24h: int


class UserReportsResponse(BaseModel):
    reports: List[Dict]


# User endpoints (anyone can report)
@router.post("/reports", response_model=ReportResponse)
async def create_report(
    request: CreateReportRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Create a content report.

    Users can report posts, comments, or other users for violations.
    """
    assert_feature_enabled("social_enabled")

    try:
        report = ReportService.create_report(
            reporter_id=current_user.id,
            target_type=request.target_type,
            target_id=request.target_id,
            reason=request.reason,
            additional_context=request.additional_context
        )

        return ReportResponse(**report)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create report: {str(e)}")


@router.get("/reports/my-reports")
async def get_my_reports(
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user)
):
    """
    Get reports submitted by the current user.

    Shows status of user's submitted reports.
    """
    assert_feature_enabled("social_enabled")

    try:
        reports = ReportService.get_user_reports(current_user.id, limit)
        return UserReportsResponse(reports=reports)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get reports: {str(e)}")


# Admin/moderation endpoints (require admin role check)
@router.get("/admin/reports")
async def get_reports_for_moderation(
    status: Optional[str] = Query(default="pending", description="Report status filter"),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """
    Get reports pending moderation review.

    Admin/moderator endpoint for reviewing content reports.
    """
    # TODO: Add proper admin/moderator role check
    assert_feature_enabled("social_enabled")

    try:
        reports = ReportService.get_reports_for_moderation(status, limit)
        return {"reports": reports}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get reports: {str(e)}")


@router.post("/admin/reports/{report_id}/moderate")
async def moderate_report(
    report_id: str,
    request: ModerationActionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Moderate a content report.

    Admin/moderator action to handle reported content.
    """
    # TODO: Add proper admin/moderator role check
    assert_feature_enabled("social_enabled")

    try:
        success = ReportService.moderate_report(
            report_id=report_id,
            moderator_id=current_user.id,
            action=request.action,
            notes=request.notes
        )

        if not success:
            raise HTTPException(status_code=404, detail="Report not found")

        return {
            "success": True,
            "message": f"Report moderated: {request.action}",
            "moderated_by": current_user.id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to moderate report: {str(e)}")


@router.get("/admin/reports/stats", response_model=ReportStatsResponse)
async def get_report_statistics(
    current_user: User = Depends(get_current_user)
):
    """
    Get moderation statistics.

    Overall stats about reporting and moderation activity.
    """
    # TODO: Add proper admin/moderator role check
    assert_feature_enabled("social_enabled")

    try:
        stats = ReportService.get_report_stats()
        return ReportStatsResponse(**stats)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")
