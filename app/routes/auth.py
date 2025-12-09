from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPAuthorizationCredentials
from app.models.user import UserCreate, UserLogin, UserResponse, Token, RefreshToken, ChangePassword, UserUpdate
from app.services import auth as auth_module
from app.services.database import db_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

auth_service = auth_module.auth_service


async def _get_current_user_dependency(
    credentials: HTTPAuthorizationCredentials = Depends(auth_module.security),
):
    return await auth_module.get_current_user(credentials)


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserCreate):
    """
    Register a new user account
    
    - **email**: Valid email address (will be verified)
    - **password**: Password (min 8 characters) 
    - **full_name**: User's full name
    - **developer_code**: Optional code for developer access ("DIETINTEL_DEV_2024")
    
    Returns JWT tokens for immediate authentication.
    """
    try:
        return await auth_service.register_user(user_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@router.post("/login", response_model=Token)
async def login_user(login_data: UserLogin):
    """
    Authenticate user with email and password
    
    - **email**: User's email address
    - **password**: User's password
    
    Returns JWT tokens for API access.
    """
    try:
        return await auth_service.login_user(login_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@router.post("/refresh", response_model=Token)
async def refresh_token(refresh_data: RefreshToken):
    """
    Refresh access token using refresh token
    
    - **refresh_token**: Valid refresh token
    
    Returns new JWT tokens.
    """
    try:
        return await auth_service.refresh_access_token(refresh_data.refresh_token)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_user(refresh_data: RefreshToken):
    """
    Logout user by invalidating refresh token
    
    - **refresh_token**: Refresh token to invalidate
    """
    try:
        await auth_service.logout_user(refresh_data.refresh_token)
    except Exception as e:
        logger.error(f"Logout error: {e}")
        # Don't raise error for logout - best effort


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user = Depends(_get_current_user_dependency)):
    """
    Get current user profile information
    
    Requires: Valid JWT access token
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        avatar_url=current_user.avatar_url,
        is_developer=current_user.is_developer,
        role=current_user.role,
        is_active=current_user.is_active,
        email_verified=current_user.email_verified,
        created_at=current_user.created_at
    )


@router.put("/me", response_model=UserResponse)
async def update_user_profile(
    user_updates: UserUpdate,
    current_user = Depends(_get_current_user_dependency)
):
    """
    Update current user profile
    
    - **full_name**: Updated full name (optional)
    - **avatar_url**: Updated avatar URL (optional)
    
    Requires: Valid JWT access token
    """
    try:
        updates = {}
        if user_updates.full_name is not None:
            updates['full_name'] = user_updates.full_name
        if user_updates.avatar_url is not None:
            updates['avatar_url'] = user_updates.avatar_url
        
        if not updates:
            # No updates provided, return current user
            return UserResponse(
                id=current_user.id,
                email=current_user.email,
                full_name=current_user.full_name,
                avatar_url=current_user.avatar_url,
                is_developer=current_user.is_developer,
                role=current_user.role,
                is_active=current_user.is_active,
                email_verified=current_user.email_verified,
                created_at=current_user.created_at
            )
        
        updated_user = await db_service.update_user(current_user.id, updates)
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return UserResponse(
            id=updated_user.id,
            email=updated_user.email,
            full_name=updated_user.full_name,
            avatar_url=updated_user.avatar_url,
            is_developer=updated_user.is_developer,
            role=updated_user.role,
            is_active=updated_user.is_active,
            email_verified=updated_user.email_verified,
            created_at=updated_user.created_at
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Profile update error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile update failed"
        )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    password_data: ChangePassword,
    current_user = Depends(_get_current_user_dependency)
):
    """
    Change user password
    
    - **current_password**: Current password for verification
    - **new_password**: New password (min 8 characters)
    
    Requires: Valid JWT access token
    """
    try:
        # Get current password hash
        current_hash = await db_service.get_password_hash(current_user.id)
        if not current_hash:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Verify current password
        if not auth_service.verify_password(password_data.current_password, current_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        # Hash new password
        new_hash = auth_service.hash_password(password_data.new_password)
        
        # Update password
        await db_service.update_user(current_user.id, {'password_hash': new_hash})
        
        # Invalidate all user sessions (force re-login)
        await db_service.delete_user_sessions(current_user.id)
        
        logger.info(f"Password changed for user: {current_user.email}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password change error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )
