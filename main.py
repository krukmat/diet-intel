from fastapi import FastAPI
from app.routes.product import router as product_router
from app.routes.plan import router as plan_router
from logging_config import setup_logging

setup_logging()

app = FastAPI(title="DietIntel API", version="1.0.0")

app.include_router(product_router, prefix="/product", tags=["products"])
app.include_router(plan_router, prefix="/plan", tags=["meal-planning"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)