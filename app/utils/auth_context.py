"""
Authentication context utilities for extracting user information from requests.
Provides optional user context for routes that don't require authentication.
"""

from typing import Optional
from fastapi import Request, HTTPException, status
import jwt
import logging

logger = logging.getLogger(__name__)

async def get_user_context(request: Request) -> Optional[str]:
    """
    Extract user ID from JWT token if present, otherwise return anonymous user ID.
    
    This allows routes to work with both authenticated and anonymous users.
    Anonymous users get a temporary session-based ID for data isolation.
    
    Args:
        request: FastAPI request object
        
    Returns:
        User ID string or "anonymous" if no valid token
    """
    try:
        # Check for Authorization header
        authorization: str = request.headers.get("Authorization")
        if not authorization:
            return "anonymous"
        
        # Extract token from "Bearer <token>" format
        if not authorization.startswith("Bearer "):
            return "anonymous"
        
        token = authorization.split(" ")[1]
        
        # Import JWT secret from config
        from app.config import config
        
        # Decode JWT token (without verification for now to avoid dependency issues)
        try:
            secret = getattr(config, "secret_key", None) or getattr(config, "JWT_SECRET", None)
            if not secret:
                logger.debug("JWT secret not configured")
                return "anonymous"

            payload = jwt.decode(token, secret, algorithms=["HS256"])
            user_id = payload.get("sub") or payload.get("user_id")

            if user_id:
                logger.debug(f"Extracted user ID from JWT: {user_id}")
                return str(user_id)
            return "anonymous"
                
        except jwt.InvalidTokenError as e:
            logger.debug(f"Invalid JWT token: {e}")
            return "anonymous"
    
    except Exception as e:
        logger.debug(f"Error extracting user context: {e}")
        return "anonymous"

    return "anonymous"


async def get_authenticated_user_id(request: Request) -> str:
    """
    Extract user ID from JWT token, raising exception if not authenticated.
    
    Use this for routes that require authentication.
    
    Args:
        request: FastAPI request object
        
    Returns:
        User ID string
        
    Raises:
        HTTPException: If no valid authentication token
    """
    user_id = await get_user_context(request)
    
    if user_id == "anonymous":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    return user_id


async def get_session_user_id(request: Request) -> str:
    """
    Get a user ID that works for both authenticated and anonymous users.
    
    For anonymous users, creates a session-based ID from IP address and User-Agent.
    This provides basic session isolation without requiring authentication.
    
    Args:
        request: FastAPI request object
        
    Returns:
        User ID string (authenticated user ID or session-based anonymous ID)
    """
    user_id = await get_user_context(request)
    
    if user_id != "anonymous":
        return user_id
    
    # Create session-based ID for anonymous users
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "unknown")
    
    # Create a simple hash-based session ID
    import hashlib
    session_data = f"{client_ip}:{user_agent}"
    session_id = hashlib.md5(session_data.encode()).hexdigest()
    session_user_id = f"anon_{session_id[:12]}"
    
    logger.debug(f"Generated session user ID: {session_user_id}")
    return session_user_id
