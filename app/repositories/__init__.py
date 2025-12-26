"""
Repository module
Provides data access layer abstraction for all entities
"""
from app.repositories.base import Repository
from app.repositories.connection import connection_manager
from app.repositories.user_repository import UserRepository
# Phase 3: ProductRepository and MealPlanRepository will be integrated after UserRepository validation
# from app.repositories.product_repository import ProductRepository
# from app.repositories.meal_plan_repository import MealPlanRepository

__all__ = [
    "Repository",
    "connection_manager",
    "UserRepository",
    # "ProductRepository",
    # "MealPlanRepository",
]
