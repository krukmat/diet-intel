# EPIC_A.A5: Post routes for UGC content API

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from app.models.user import User
from app.models.social.post import PostDetail, PostCreate, CommentCreate, ReactionType
from app.services.auth import get_current_user
from app.services.social.post_service import PostService
from app.services.social.reaction_service import ReactionService
from app.services.social.comment_service import CommentService
from app.utils.feature_flags import assert_feature_enabled

router = APIRouter()


class PostResponse(BaseModel):
    post: PostDetail


class ReactionResponse(BaseModel):
    liked: bool
    likes_count: int


class CommentResponse(BaseModel):
    comment: dict  # CommentDetail
    comments_count: int


class CommentsListResponse(BaseModel):
    comments: List[dict]  # List[CommentDetail]


@router.post("/posts", response_model=PostResponse)
async def create_post(
    post: PostCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new post.

    - Validates content length (max 500 chars)
    - Checks daily rate limits (10 posts/day)
    - Awards gamification points on success
    """
    assert_feature_enabled("social_enabled")

    try:
        created_post = PostService.create_post(current_user.id, post)
        return PostResponse(post=created_post)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a single post with stats and like status for current user"""
    assert_feature_enabled("social_enabled")

    try:
        post = PostService.get_post(post_id, current_user.id)
        return PostResponse(post=post)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/users/{user_id}/posts")
async def get_user_posts(
    user_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    cursor: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user)
):
    """Get paginated posts by a specific user"""
    assert_feature_enabled("social_enabled")

    try:
        posts = PostService.list_user_posts(user_id, limit, cursor)
        # Return posts with basic info (simplified response)
        return {
            "posts": [
                {
                    "id": p.id,
                    "author_id": p.author_id,
                    "text": p.text,
                    "media": p.media,
                    "stats": {
                        "likes_count": p.stats.likes_count,
                        "comments_count": p.stats.comments_count
                    },
                    "visibility": p.visibility,
                    "created_at": p.created_at,
                    "updated_at": p.updated_at
                }
                for p in posts
            ]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/posts/{post_id}/react", response_model=ReactionResponse)
async def toggle_reaction(
    post_id: str,
    reaction_type: ReactionType = ReactionType.LIKE,
    current_user: User = Depends(get_current_user)
):
    """Toggle like/unlike on a post"""
    assert_feature_enabled("social_enabled")

    try:
        result = ReactionService.toggle_reaction(post_id, current_user.id, reaction_type)
        return ReactionResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/posts/{post_id}/comments", response_model=CommentResponse)
async def create_comment(
    post_id: str,
    comment: CommentCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a comment on a post"""
    assert_feature_enabled("social_enabled")

    try:
        result = CommentService.create_comment(post_id, current_user.id, comment)
        return CommentResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/posts/{post_id}/comments", response_model=CommentsListResponse)
async def get_comments(
    post_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    cursor: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user)
):
    """Get paginated comments for a post"""
    assert_feature_enabled("social_enabled")

    try:
        comments = CommentService.get_comments(post_id, limit, cursor)
        return CommentsListResponse(comments=[c.dict() for c in comments])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
