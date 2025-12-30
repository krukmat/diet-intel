"""
Repository module
Provides data access layer abstraction for all entities
Phase 2: Database Repository Pattern Migration
"""
from app.repositories.base import Repository
from app.repositories.connection import connection_manager
from app.repositories.user_repository import UserRepository
from app.repositories.meal_plan_repository import MealPlanRepository
from app.repositories.tracking_repository import TrackingRepository
from app.repositories.reminder_repository import ReminderRepository
# Phase 2.1.3: ProductRepository integration pending (requires Product model definition)
# from app.repositories.product_repository import ProductRepository

__all__ = [
    "Repository",
    "connection_manager",
    "UserRepository",
    "MealPlanRepository",
    "TrackingRepository",
    "ReminderRepository",
    # "ProductRepository",
]
