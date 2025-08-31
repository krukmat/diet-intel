#!/usr/bin/env python3
"""
Minimal FastAPI server for testing authentication endpoints only
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.auth import router as auth_router
from logging_config import setup_logging

setup_logging()

app = FastAPI(
    title="DietIntel API - Auth Only", 
    version="1.0.0",
    description="Authentication-only version for testing Phase 1"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Only include auth router
app.include_router(auth_router, prefix="/auth", tags=["authentication"])

@app.get("/")
async def root():
    return {"message": "DietIntel Auth API - Phase 1", "version": "1.0.0"}

@app.get("/health")  
async def health():
    return {"status": "healthy", "phase": "authentication"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)