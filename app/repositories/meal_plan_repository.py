"""
Meal Plan Repository for CRUD operations
Replaces meal plan-related functions from database.py
"""
import logging
from typing import Optional, List, Dict, Any
from app.repositories.base import Repository
from app.repositories.connection import connection_manager
from app.models.meal_plan import MealPlan

logger = logging.getLogger(__name__)


class MealPlanRepository(Repository[MealPlan]):
    """Repository for MealPlan entity"""

    def get_table_name(self) -> str:
        """Return table name"""
        return "meal_plans"

    def row_to_entity(self, row: Dict[str, Any]) -> MealPlan:
        """Convert database row to MealPlan model"""
        return MealPlan(
            id=row.get("id"),
            user_id=row["user_id"],
            name=row.get("name"),
            description=row.get("description"),
            target_calories=row.get("target_calories"),
            start_date=row.get("start_date"),
            end_date=row.get("end_date"),
            meals=row.get("meals", {}),
            is_active=bool(row.get("is_active", 1))
        )

    def entity_to_dict(self, entity: MealPlan) -> Dict[str, Any]:
        """Convert MealPlan to dict for database"""
        return {
            "user_id": entity.user_id,
            "name": entity.name or "",
            "description": entity.description or "",
            "target_calories": entity.target_calories or 0,
            "start_date": entity.start_date,
            "end_date": entity.end_date,
            "meals": entity.meals or {},
            "is_active": int(entity.is_active)
        }

    async def get_by_id(self, plan_id: int) -> Optional[MealPlan]:
        """Get meal plan by ID"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM meal_plans WHERE id = ?",
                (plan_id,)
            )
            row = cursor.fetchone()
            return self.row_to_entity(dict(row)) if row else None

    async def get_by_user_id(self, user_id: int, limit: int = 10) -> List[MealPlan]:
        """Get all active meal plans for a user"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM meal_plans WHERE user_id = ? AND is_active = 1 LIMIT ?",
                (user_id, limit)
            )
            rows = cursor.fetchall()
            return [self.row_to_entity(dict(row)) for row in rows]

    async def create(self, plan: MealPlan) -> MealPlan:
        """Create new meal plan"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO meal_plans
                (user_id, name, description, target_calories, start_date, end_date, meals, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    plan.user_id,
                    plan.name or "",
                    plan.description or "",
                    plan.target_calories or 0,
                    plan.start_date,
                    plan.end_date,
                    plan.meals or {},
                    int(plan.is_active)
                )
            )
            plan_id = cursor.lastrowid
            created = await self.get_by_id(plan_id)
            self.logger.info(f"Meal plan created: {plan_id}")
            return created

    async def update(self, plan_id: int, updates: Dict[str, Any]) -> Optional[MealPlan]:
        """Update meal plan fields"""
        if not updates:
            return await self.get_by_id(plan_id)

        set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
        values = list(updates.values()) + [plan_id]

        async with connection_manager.get_connection() as conn:
            conn.execute(
                f"UPDATE meal_plans SET {set_clause} WHERE id = ?",
                values
            )
            self.logger.info(f"Meal plan updated: {plan_id}")

        return await self.get_by_id(plan_id)

    async def delete(self, plan_id: int) -> bool:
        """Soft delete meal plan (set is_active = 0)"""
        result = await self.update(plan_id, {"is_active": 0})
        self.logger.info(f"Meal plan deleted (soft): {plan_id}")
        return result is not None

    async def get_all(self, limit: int = 100, offset: int = 0) -> List[MealPlan]:
        """Get all active meal plans with pagination"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM meal_plans WHERE is_active = 1 LIMIT ? OFFSET ?",
                (limit, offset)
            )
            rows = cursor.fetchall()
            return [self.row_to_entity(dict(row)) for row in rows]

    async def count(self) -> int:
        """Count total active meal plans"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM meal_plans WHERE is_active = 1")
            return cursor.fetchone()[0]
