"""
Meal Plan Repository for CRUD operations
Replaces meal plan-related functions from database.py
"""
import logging
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.repositories.base import Repository
from app.repositories.connection import connection_manager

logger = logging.getLogger(__name__)


class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder for datetime objects - Task: Fix JSON serialization"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


# Data class representing MealPlan entity (not a Pydantic model)
class MealPlan:
    """Data class for meal plan"""
    def __init__(self, user_id: str, plan_data: Dict[str, Any], bmr: float, tdee: float,
                 daily_calorie_target: float, flexibility_used: bool = False,
                 optional_products_used: int = 0, created_at: Optional[datetime] = None,
                 expires_at: Optional[datetime] = None, id: Optional[str] = None):
        self.id = id
        self.user_id = user_id
        self.plan_data = plan_data or {}
        self.bmr = bmr
        self.tdee = tdee
        self.daily_calorie_target = daily_calorie_target
        self.flexibility_used = flexibility_used
        self.optional_products_used = optional_products_used
        self.created_at = created_at or datetime.now()
        self.expires_at = expires_at


class MealPlanRepository(Repository[MealPlan]):
    """Repository for MealPlan entity"""

    def __init__(self):
        """Initialize MealPlanRepository (uses connection_manager, not db_path)"""
        self.logger = logging.getLogger(self.__class__.__name__)

    def get_table_name(self) -> str:
        """Return table name"""
        return "meal_plans"

    def row_to_entity(self, row: Dict[str, Any]) -> MealPlan:
        """Convert database row to MealPlan model"""
        plan_data = row.get("plan_data", {})
        if isinstance(plan_data, str):
            try:
                plan_data = json.loads(plan_data)
            except (json.JSONDecodeError, TypeError):
                plan_data = {}

        return MealPlan(
            id=row.get("id"),
            user_id=row.get("user_id"),
            plan_data=plan_data,
            bmr=row.get("bmr", 0),
            tdee=row.get("tdee", 0),
            daily_calorie_target=row.get("daily_calorie_target", 0),
            flexibility_used=bool(row.get("flexibility_used", 0)),
            optional_products_used=int(row.get("optional_products_used", 0)),
            created_at=datetime.fromisoformat(row["created_at"]) if isinstance(row.get("created_at"), str) else row.get("created_at"),
            expires_at=datetime.fromisoformat(row["expires_at"]) if isinstance(row.get("expires_at"), str) else row.get("expires_at")
        )

    def entity_to_dict(self, entity: MealPlan) -> Dict[str, Any]:
        """Convert MealPlan to dict for database - Task: Use DateTimeEncoder"""
        return {
            "user_id": entity.user_id,
            "plan_data": json.dumps(entity.plan_data, cls=DateTimeEncoder) if isinstance(entity.plan_data, dict) else entity.plan_data,
            "bmr": entity.bmr,
            "tdee": entity.tdee,
            "daily_calorie_target": entity.daily_calorie_target,
            "flexibility_used": int(entity.flexibility_used),
            "optional_products_used": entity.optional_products_used,
            "expires_at": entity.expires_at.isoformat() if entity.expires_at else None
        }

    async def get_by_id(self, plan_id: str) -> Optional[MealPlan]:
        """Get meal plan by ID"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM meal_plans WHERE id = ?",
                (plan_id,)
            )
            row = cursor.fetchone()
            return self.row_to_entity(dict(row)) if row else None

    async def get_by_user_id(self, user_id: str, limit: int = 10) -> List[MealPlan]:
        """Get all meal plans for a user"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM meal_plans WHERE user_id = ? LIMIT ?",
                (user_id, limit)
            )
            rows = cursor.fetchall()
            return [self.row_to_entity(dict(row)) for row in rows]

    async def create(self, plan: MealPlan) -> MealPlan:
        """Create new meal plan - Task: Use DateTimeEncoder for datetime serialization"""
        from uuid import uuid4

        plan_id = plan.id or str(uuid4())
        plan_data_json = json.dumps(plan.plan_data, cls=DateTimeEncoder)

        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO meal_plans
                (id, user_id, plan_data, bmr, tdee, daily_calorie_target, flexibility_used, optional_products_used, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    plan_id,
                    plan.user_id,
                    plan_data_json,
                    plan.bmr,
                    plan.tdee,
                    plan.daily_calorie_target,
                    int(plan.flexibility_used),
                    plan.optional_products_used,
                    plan.expires_at.isoformat() if plan.expires_at else None
                )
            )
            self.logger.info(f"Meal plan created: {plan_id}")

        created = await self.get_by_id(plan_id)
        return created

    async def update(self, plan_id: str, updates: Dict[str, Any]) -> Optional[MealPlan]:
        """Update meal plan fields"""
        if not updates:
            return await self.get_by_id(plan_id)

        # Convert plan_data to JSON if present - Task: Use DateTimeEncoder
        if "plan_data" in updates and isinstance(updates["plan_data"], dict):
            updates["plan_data"] = json.dumps(updates["plan_data"], cls=DateTimeEncoder)

        # Convert datetime fields to ISO format
        if "expires_at" in updates and isinstance(updates["expires_at"], datetime):
            updates["expires_at"] = updates["expires_at"].isoformat()

        set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
        values = list(updates.values()) + [plan_id]

        async with connection_manager.get_connection() as conn:
            conn.execute(
                f"UPDATE meal_plans SET {set_clause} WHERE id = ?",
                values
            )
            self.logger.info(f"Meal plan updated: {plan_id}")

        return await self.get_by_id(plan_id)

    async def delete(self, plan_id: str) -> bool:
        """Delete meal plan"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM meal_plans WHERE id = ?",
                (plan_id,)
            )
            self.logger.info(f"Meal plan deleted: {plan_id}")
            return cursor.rowcount > 0

    async def get_all(self, limit: int = 100, offset: int = 0) -> List[MealPlan]:
        """Get all meal plans with pagination"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM meal_plans LIMIT ? OFFSET ?",
                (limit, offset)
            )
            rows = cursor.fetchall()
            return [self.row_to_entity(dict(row)) for row in rows]

    async def count(self) -> int:
        """Count total meal plans"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM meal_plans")
            return cursor.fetchone()[0]
