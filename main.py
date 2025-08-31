from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.product import router as product_router
from app.routes.plan import router as plan_router
from app.routes.track import router as track_router
from app.routes.reminder import router as reminder_router
from app.routes.auth import router as auth_router
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
app.include_router(track_router, prefix="/track", tags=["tracking"])
app.include_router(reminder_router, prefix="/reminder", tags=["reminders"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)