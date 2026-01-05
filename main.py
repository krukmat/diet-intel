"""
DietIntel API - Main Application Entry Point

This module contains the FastAPI application configuration and initialization
with improved organization, error handling, and logging.
"""

# =============================================================================
# FASTAPI IMPORTS
# =============================================================================
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# =============================================================================
# ROUTE IMPORTS
# =============================================================================
from app.routes.auth import router as auth_router
from app.routes.profile import router as profile_router
from app.routes.follow import router as follow_router
from app.routes.block import router as block_router
from app.routes.feed import router as feed_router
from app.routes.product import router as product_router
from app.routes.plan import router as plan_router
from app.routes.track import router as track_router
from app.routes.reminder import router as reminder_router
from app.routes.analytics import router as analytics_router
from app.routes.recommendations import router as recommendations_router
from app.routes.smart_diet import router as smart_diet_router
from app.routes.recipe_ai import router as recipe_ai_router
from app.routes.translation import router as translation_router
from app.routes.food_vision import router as food_vision_router
from app.routes.intelligent_flow import router as intelligent_flow_router
from app.routes.posts import router as posts_router
from app.routes.notifications import router as notifications_router
from app.routes.gamification import router as gamification_router
from app.routes.moderation import router as moderation_router

# =============================================================================
# SERVICE AND MODEL IMPORTS
# =============================================================================
from app.services.smart_diet import smart_diet_engine
from app.services.auth import auth_service
from app.models.user import UserCreate

# =============================================================================
# CONFIGURATION AND LOGGING
# =============================================================================
from app.config import config
from logging_config import setup_logging
import logging

# Initialize logging
setup_logging()
logger = logging.getLogger(__name__)

# =============================================================================
# APPLICATION CONFIGURATION
# =============================================================================
app = FastAPI(
    title="DietIntel API", 
    version="1.0.0",
    description="A comprehensive nutrition tracking API with authentication, meal planning, and progress tracking"
)

# =============================================================================
# STARTUP EVENT HANDLERS
# =============================================================================

@app.on_event("startup")
async def seed_demo_user() -> None:
    """
    Seed demo user for development and testing environments.
    
    Creates a demo user account if it doesn't exist and environment is not production.
    This helps with testing and development workflows.
    """
    logger.info("🚀 Starting application initialization...")
    
    # Skip in production environment
    if config.environment == "production":
        logger.info("⏭️  Production environment detected - skipping demo user seed")
        return
    
    # Demo user credentials
    demo_email = "test@example.com"
    demo_password = "password123"
    
    try:
        logger.info(f"🔍 Checking for existing demo user: {demo_email}")
        
        # Check if user already exists
        existing_user = await auth_service.user_service.get_user_by_email(demo_email)
        if existing_user:
            logger.info("✅ Demo user already exists - skipping creation")
            return
        
        # Create demo user
        logger.info("👤 Creating demo user account...")
        await auth_service.register_user(
            UserCreate(
                email=demo_email,
                password=demo_password,
                full_name="Demo User",
                developer_code=None,
            )
        )
        
        logger.info("✅ Demo user created successfully")
        
    except Exception as exc:
        logger.warning(f"⚠️  Demo user seed failed: {exc}")
        logger.info("🔄 Application will continue without demo user")


# =============================================================================
# EXCEPTION HANDLERS
# =============================================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    """
    Handle request validation errors with sanitized error messages.
    
    This handler processes validation errors from Pydantic models and returns
    user-friendly error responses without exposing sensitive information.
    """
    sanitized_errors = []
    
    for error in exc.errors():
        sanitized_errors.append({
            "loc": error.get("loc", []),
            "msg": error.get("msg", "Invalid request"),
            "type": f"validation error.{error.get('type', 'unknown')}"
        })
    
    logger.warning(f"Validation error on {request.url.path}: {len(sanitized_errors)} errors")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": sanitized_errors}
    )


# =============================================================================
# MIDDLEWARE CONFIGURATION
# =============================================================================

def setup_cors_middleware():
    """Configure CORS middleware with environment-based settings."""
    # Get CORS origins from config or use defaults
    cors_origins = getattr(config, 'cors_origins', [
        "http://localhost:3000",  # React web app
        "http://10.0.2.2:3000",  # Android emulator
    ])
    
    logger.info(f"🌐 Configuring CORS for origins: {cors_origins}")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Setup CORS middleware
setup_cors_middleware()

# =============================================================================
# ROUTER CONFIGURATION
# =============================================================================

def include_routers():
    """Include all application routers with proper configuration."""
    
    logger.info("📡 Registering application routers...")
    
    # Authentication and user management
    app.include_router(auth_router, prefix="/auth", tags=["authentication"])
    app.include_router(profile_router, tags=["profiles"])
    
    # Social features
    app.include_router(follow_router, tags=["follows"])
    app.include_router(block_router, tags=["blocks"])
    app.include_router(feed_router, tags=["feed"])
    app.include_router(posts_router, tags=["posts"])
    
    # Core features
    app.include_router(product_router, prefix="/product", tags=["products"])
    app.include_router(plan_router, prefix="/plan", tags=["meal-planning"])
    app.include_router(track_router, prefix="/track", tags=["tracking"])
    app.include_router(reminder_router, prefix="/reminder", tags=["reminders"])
    
    # AI and advanced features
    app.include_router(recommendations_router, prefix="/recommendations", tags=["smart-recommendations"])
    app.include_router(smart_diet_router, prefix="/smart-diet", tags=["smart-diet"])
    app.include_router(recipe_ai_router, prefix="/recipe-ai", tags=["recipe-ai"])
    
    # Legacy compatibility
    app.include_router(recipe_ai_router, prefix="/recipe", tags=["recipe-ai"], include_in_schema=False)
    
    # Additional services
    app.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
    app.include_router(food_vision_router, tags=["food-vision"])
    app.include_router(intelligent_flow_router, prefix="/intelligent-flow", tags=["intelligent-flow"])
    app.include_router(notifications_router, tags=["notifications"])
    app.include_router(gamification_router, prefix="/gamification", tags=["gamification"])
    app.include_router(translation_router)
    app.include_router(moderation_router, tags=["moderation"])
    
    logger.info("✅ All routers registered successfully")

# Include all routers
include_routers()

# =============================================================================
# SERVICE EXPOSURE
# =============================================================================

# Expose key services on the app instance for testing/inspection
app.smart_diet_engine = smart_diet_engine

logger.info("🎯 Key services exposed on app instance")

# =============================================================================
# APPLICATION ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    logger.info("🚀 Starting DietIntel API server...")
    logger.info(f"🌍 Environment: {config.environment}")
    logger.info("📖 API Documentation: http://localhost:8000/docs")
    
    import uvicorn
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        log_config=None  # Use our custom logging configuration
    )
