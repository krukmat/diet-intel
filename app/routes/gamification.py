# EPIC_A.A5: Gamification routes for points and badges API

from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from typing import List, Dict

from app.models.user import User
from app.services.auth import get_current_user
from app.utils.feature_flags import assert_feature_enabled
from app.services.gamification.points_service import PointsService
from app.services.gamification.badge_service import BadgeService

router = APIRouter()


class UserPointsResponse(BaseModel):
    total_points: int
    current_level: int
    next_level_threshold: int
    points_needed: int
    recent_transactions: List[Dict]


class LeaderboardResponse(BaseModel):
    entries: List[Dict]


class BadgeResponse(BaseModel):
    badges: List[Dict]


class BadgeDefinitionsResponse(BaseModel):
    definitions: Dict


@router.get("/user/{user_id}", response_model=UserPointsResponse)
async def get_user_gamification_data(user_id: str, current_user: User = Depends(get_current_user)):
    """
    Get gamification data for a user (own data or if public).

    Shows points, level, and recent transactions.
    """
    # For now, only allow viewing own data (extend for public profiles later)
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only view own gamification data")

    assert_feature_enabled("gamification_enabled")

    try:
        data = PointsService.get_user_points(user_id)
        return UserPointsResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get gamification data: {str(e)}")


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    limit: int = Query(default=50, ge=1, le=100, description="Maximum users to return"),
    time_range: str = Query(default="weekly", regex="^(weekly|monthly|all_time)$", description="Time period for ranking")
):
    """
    Get leaderboard of top users by points.

    Supports weekly, monthly, and all-time rankings.
    """
    assert_feature_enabled("gamification_enabled")

    try:
        entries = PointsService.get_leaderboard(limit=limit, time_range=time_range)
        return LeaderboardResponse(entries=entries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get leaderboard: {str(e)}")


@router.get("/badges", response_model=BadgeDefinitionsResponse)
async def get_badge_definitions():
    """
    Get all available badge definitions and rules.
    """
    assert_feature_enabled("gamification_enabled")

    try:
        definitions = BadgeService.get_badge_definitions()
        return BadgeDefinitionsResponse(definitions=definitions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get badge definitions: {str(e)}")


@router.get("/badges/user/{user_id}", response_model=BadgeResponse)
async def get_user_badges(user_id: str, current_user: User = Depends(get_current_user)):
    """
    Get badges earned by a user.
    """
    # For now, only allow viewing own badges (extend for public profiles later)
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only view own badges")

    assert_feature_enabled("gamification_enabled")

    try:
        badges = BadgeService.get_user_badges(user_id)
        return BadgeResponse(badges=badges)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user badges: {str(e)}")


@router.post("/badges/recalculate/{user_id}")
async def recalculate_user_badges(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Admin endpoint to recalculate badges for a user.

    Awards any badges the user should have earned but missed.
    """
    # TODO: Add admin role check
    if user_id != current_user.id:  # Temporary: only own data
        raise HTTPException(status_code=403, detail="Not authorized")

    assert_feature_enabled("gamification_enabled")

    try:
        earned_badges = BadgeService.recalculate_user_badges(user_id)
        return {
            "message": f"Recalculation completed",
            "newly_earned_badges": earned_badges,
            "count": len(earned_badges)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to recalculate badges: {str(e)}")


# Legacy alias routes for backward compatibility
@router.get("/gamification/summary", response_model=UserPointsResponse)
async def get_user_summary(current_user: User = Depends(get_current_user)):
    """Legacy endpoint for user gamification summary"""
    return await get_user_gamification_data(current_user.id, current_user)


@router.get("/gamification/me/points", response_model=UserPointsResponse)
async def get_my_points(current_user: User = Depends(get_current_user)):
    """Legacy endpoint for current user's points"""
    return await get_user_gamification_data(current_user.id, current_user)


@router.get("/gamification/me/level")
async def get_my_level(current_user: User = Depends(get_current_user)):
    """Legacy endpoint for current user's level"""
    assert_feature_enabled("gamification_enabled")

    data = PointsService.get_user_points(current_user.id)
    return {
        "level": data["current_level"],
        "points_total": data["total_points"]
    }


@router.get("/gamification/me/badges", response_model=BadgeResponse)
async def get_my_badges(current_user: User = Depends(get_current_user)):
    """Legacy endpoint for current user's badges"""
    return await get_user_badges(current_user.id, current_user)


@router.get("/leaderboards/weekly", response_model=LeaderboardResponse)
async def get_weekly_leaderboard():
    """Legacy endpoint for weekly leaderboard"""
    return await get_leaderboard(time_range="weekly")
