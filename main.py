from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.product import router as product_router
from app.routes.plan import router as plan_router
from app.routes.track import router as track_router
from app.routes.reminder import router as reminder_router
from app.routes.auth import router as auth_router
from app.routes.analytics import router as analytics_router
from app.routes.recommendations import router as recommendations_router
from app.routes.smart_diet import router as smart_diet_router
from app.routes.recipe_ai import router as recipe_ai_router
from app.routes.translation import router as translation_router
from logging_config import setup_logging

setup_logging()

app = FastAPI(
    title="DietIntel API", 
    version="1.0.0",
    description="A comprehensive nutrition tracking API with authentication, meal planning, and progress tracking"
)

# CORS middleware for web/mobile clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://10.0.2.2:3000"],  # React web app + Android emulator
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/auth", tags=["authentication"])
app.include_router(product_router, prefix="/product", tags=["products"])
app.include_router(plan_router, prefix="/plan", tags=["meal-planning"])
app.include_router(recommendations_router, prefix="/recommendations", tags=["smart-recommendations"])
app.include_router(smart_diet_router, prefix="/smart-diet", tags=["smart-diet"])
app.include_router(recipe_ai_router, prefix="/recipe-ai", tags=["recipe-ai"])
# Legacy alias to preserve `/recipe` endpoints used by older clients/tests
app.include_router(recipe_ai_router, prefix="/recipe", tags=["recipe-ai"], include_in_schema=False)
app.include_router(track_router, prefix="/track", tags=["tracking"])
app.include_router(reminder_router, prefix="/reminder", tags=["reminders"])
app.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
app.include_router(translation_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
