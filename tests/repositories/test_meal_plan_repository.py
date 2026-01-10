"""
Test suite for MealPlanRepository
Task 2.1.1.1: Repository tests for meal plan CRUD operations
Target Coverage: 100% of MealPlanRepository methods
"""
import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import patch
from app.repositories.meal_plan_repository import MealPlanRepository, MealPlan


class TestMealPlanRepository:
    """Test MealPlanRepository CRUD operations"""

    @pytest.fixture
    def meal_plan_repo(self, mock_connection_manager):
        """Create repository with mocked connection manager"""
        with patch('app.repositories.meal_plan_repository.connection_manager', mock_connection_manager):
            repo = MealPlanRepository()
            return repo, mock_connection_manager

    @pytest.mark.asyncio
    async def test_create_meal_plan(self, meal_plan_repo):
        """Test creating a new meal plan - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        # Create test meal plan
        plan_data = {"days": {"day1": {"breakfast": 500, "lunch": 600, "dinner": 700}}}
        plan = MealPlan(
            user_id="user_123",
            plan_data=plan_data,
            bmr=1500.0,
            tdee=2250.0,
            daily_calorie_target=1800.0,
            flexibility_used=False,
            optional_products_used=0
        )

        # Create the plan
        created = await repo.create(plan)

        # Verify
        assert created is not None
        assert created.id is not None
        assert created.user_id == "user_123"
        assert created.bmr == 1500.0
        assert created.tdee == 2250.0
        assert created.daily_calorie_target == 1800.0

    @pytest.mark.asyncio
    async def test_get_meal_plan_by_id(self, meal_plan_repo):
        """Test retrieving meal plan by ID - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        # Create a meal plan
        plan_data = {"days": {"day1": {"meals": ["meal1", "meal2"]}}}
        plan = MealPlan(
            user_id="user_456",
            plan_data=plan_data,
            bmr=1600.0,
            tdee=2400.0,
            daily_calorie_target=1900.0
        )
        created = await repo.create(plan)
        plan_id = created.id

        # Retrieve it
        retrieved = await repo.get_by_id(plan_id)

        # Verify
        assert retrieved is not None
        assert retrieved.id == plan_id
        assert retrieved.user_id == "user_456"
        assert retrieved.bmr == 1600.0

    @pytest.mark.asyncio
    async def test_get_meal_plan_not_found(self, meal_plan_repo):
        """Test retrieving non-existent meal plan returns None - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        # Try to get non-existent plan
        result = await repo.get_by_id("non_existent_id")

        # Verify
        assert result is None

    @pytest.mark.asyncio
    async def test_get_meal_plans_by_user(self, meal_plan_repo):
        """Test retrieving all meal plans for a user - Task 2.1.1.1"""
        from uuid import uuid4
        repo, conn_mgr = meal_plan_repo

        user_id = str(uuid4())  # Use unique user ID

        # Create multiple plans
        plans = [
            MealPlan(user_id=user_id, plan_data={"plan": 1}, bmr=1500.0, tdee=2250.0, daily_calorie_target=1800.0),
            MealPlan(user_id=user_id, plan_data={"plan": 2}, bmr=1600.0, tdee=2400.0, daily_calorie_target=1900.0),
        ]

        created_ids = []
        for plan in plans:
            created = await repo.create(plan)
            created_ids.append(created.id)

        # Retrieve user's plans
        user_plans = await repo.get_by_user_id(user_id, limit=10)

        # Verify - should get exactly the 2 we created
        assert len(user_plans) == 2
        assert all(p.user_id == user_id for p in user_plans)

    @pytest.mark.asyncio
    async def test_update_meal_plan(self, meal_plan_repo):
        """Test updating a meal plan - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        # Create a plan
        plan = MealPlan(
            user_id="user_update",
            plan_data={"original": True},
            bmr=1500.0,
            tdee=2250.0,
            daily_calorie_target=1800.0
        )
        created = await repo.create(plan)
        plan_id = created.id

        # Update it
        updates = {
            "plan_data": {"updated": True},
            "bmr": 1600.0,
            "daily_calorie_target": 1900.0
        }
        updated = await repo.update(plan_id, updates)

        # Verify
        assert updated is not None
        assert updated.id == plan_id
        assert updated.plan_data == {"updated": True}
        assert updated.bmr == 1600.0

    @pytest.mark.asyncio
    async def test_update_non_existent_plan(self, meal_plan_repo):
        """Test updating non-existent plan returns None - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        # Try to update non-existent plan
        result = await repo.update("non_existent", {"bmr": 2000.0})

        # Verify
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_meal_plan(self, meal_plan_repo):
        """Test deleting a meal plan - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        # Create a plan
        plan = MealPlan(
            user_id="user_delete",
            plan_data={"to_delete": True},
            bmr=1500.0,
            tdee=2250.0,
            daily_calorie_target=1800.0
        )
        created = await repo.create(plan)
        plan_id = created.id

        # Delete it
        result = await repo.delete(plan_id)

        # Verify
        assert result is True

        # Verify it's gone
        retrieved = await repo.get_by_id(plan_id)
        assert retrieved is None

    @pytest.mark.asyncio
    async def test_get_all_meal_plans(self, meal_plan_repo):
        """Test getting all meal plans with pagination - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        # Create plans
        for i in range(3):
            plan = MealPlan(
                user_id=f"user_{i}",
                plan_data={"plan_num": i},
                bmr=1500.0 + i * 100,
                tdee=2250.0 + i * 100,
                daily_calorie_target=1800.0 + i * 100
            )
            await repo.create(plan)

        # Get all plans
        all_plans = await repo.get_all(limit=10, offset=0)

        # Verify
        assert len(all_plans) >= 3

    @pytest.mark.asyncio
    async def test_get_all_with_pagination(self, meal_plan_repo):
        """Test pagination for get_all - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        # Create many plans
        for i in range(5):
            plan = MealPlan(
                user_id=f"user_page_{i}",
                plan_data={"page_num": i},
                bmr=1500.0,
                tdee=2250.0,
                daily_calorie_target=1800.0
            )
            await repo.create(plan)

        # Get first page
        page1 = await repo.get_all(limit=2, offset=0)
        assert len(page1) <= 2

        # Get second page
        page2 = await repo.get_all(limit=2, offset=2)
        assert len(page2) <= 2

    @pytest.mark.asyncio
    async def test_count_meal_plans(self, meal_plan_repo):
        """Test counting meal plans - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        # Create some plans
        for i in range(3):
            plan = MealPlan(
                user_id=f"user_count_{i}",
                plan_data={"count": i},
                bmr=1500.0,
                tdee=2250.0,
                daily_calorie_target=1800.0
            )
            await repo.create(plan)

        # Count
        count = await repo.count()

        # Verify
        assert count >= 3

    @pytest.mark.asyncio
    async def test_meal_plan_with_complex_data(self, meal_plan_repo):
        """Test meal plan with complex plan_data - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        complex_data = {
            "days": {
                "monday": {"breakfast": 500, "lunch": 600, "dinner": 700},
                "tuesday": {"breakfast": 480, "lunch": 620, "dinner": 720}
            },
            "nutrients": {
                "protein": 150,
                "carbs": 200,
                "fat": 60
            }
        }

        plan = MealPlan(
            user_id="user_complex",
            plan_data=complex_data,
            bmr=1500.0,
            tdee=2250.0,
            daily_calorie_target=1800.0
        )

        created = await repo.create(plan)
        retrieved = await repo.get_by_id(created.id)

        # Verify
        assert retrieved.plan_data == complex_data

    @pytest.mark.asyncio
    async def test_update_empty_updates_dict(self, meal_plan_repo):
        """Test updating with empty dict returns plan unchanged - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        plan = MealPlan(
            user_id="user_empty",
            plan_data={"original": True},
            bmr=1500.0,
            tdee=2250.0,
            daily_calorie_target=1800.0
        )
        created = await repo.create(plan)
        original_id = created.id

        # Update with empty dict
        result = await repo.update(original_id, {})

        # Verify
        assert result is not None
        assert result.id == original_id
        assert result.plan_data == {"original": True}

    @pytest.mark.asyncio
    async def test_meal_plan_with_expires_at(self, meal_plan_repo):
        """Test meal plan with expiration date - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        expires = datetime.now() + timedelta(days=30)
        plan = MealPlan(
            user_id="user_expires",
            plan_data={"temp": True},
            bmr=1500.0,
            tdee=2250.0,
            daily_calorie_target=1800.0,
            expires_at=expires
        )

        created = await repo.create(plan)
        retrieved = await repo.get_by_id(created.id)

        # Verify
        assert retrieved is not None
        assert retrieved.expires_at is not None

    @pytest.mark.asyncio
    async def test_meal_plan_flexibility_and_products(self, meal_plan_repo):
        """Test meal plan with flexibility and optional products tracking - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        plan = MealPlan(
            user_id="user_flex",
            plan_data={"flexible": True},
            bmr=1500.0,
            tdee=2250.0,
            daily_calorie_target=1800.0,
            flexibility_used=True,
            optional_products_used=3
        )

        created = await repo.create(plan)
        retrieved = await repo.get_by_id(created.id)

        # Verify
        assert retrieved.flexibility_used is True
        assert retrieved.optional_products_used == 3

    @pytest.mark.asyncio
    async def test_row_to_entity_json_parsing(self, meal_plan_repo):
        """Test row_to_entity properly parses JSON plan_data - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        plan_data = {"complex": {"nested": {"data": [1, 2, 3]}}}
        plan = MealPlan(
            user_id="user_json",
            plan_data=plan_data,
            bmr=1500.0,
            tdee=2250.0,
            daily_calorie_target=1800.0
        )

        created = await repo.create(plan)
        retrieved = await repo.get_by_id(created.id)

        # Verify JSON was properly parsed
        assert retrieved.plan_data == plan_data
        assert retrieved.plan_data["complex"]["nested"]["data"] == [1, 2, 3]

    @pytest.mark.asyncio
    async def test_get_table_name(self, meal_plan_repo):
        """Test get_table_name returns correct table - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        # Verify
        assert repo.get_table_name() == "meal_plans"

    @pytest.mark.asyncio
    async def test_deactivate_plans_for_user(self, meal_plan_repo):
        """Test deactivating all plans for a user."""
        repo, conn_mgr = meal_plan_repo

        user_id = "user_active"
        plan_active = MealPlan(
            user_id=user_id,
            plan_data={"active": True},
            bmr=1500.0,
            tdee=2250.0,
            daily_calorie_target=1800.0,
            is_active=True
        )
        plan_inactive = MealPlan(
            user_id=user_id,
            plan_data={"active": False},
            bmr=1600.0,
            tdee=2400.0,
            daily_calorie_target=1900.0,
            is_active=True
        )

        created_active = await repo.create(plan_active)
        created_inactive = await repo.create(plan_inactive)

        await repo.deactivate_plans_for_user(user_id)

        plans = await repo.get_by_user_id(user_id, limit=10)
        assert len(plans) == 2
        assert all(plan.is_active is False for plan in plans)

    @pytest.mark.asyncio
    async def test_get_active_plan_for_user(self, meal_plan_repo):
        """Test retrieving only the active plan for a user."""
        repo, conn_mgr = meal_plan_repo

        user_id = "user_active_plan"
        inactive_plan = MealPlan(
            user_id=user_id,
            plan_data={"active": False},
            bmr=1500.0,
            tdee=2250.0,
            daily_calorie_target=1800.0,
            is_active=False
        )
        await repo.create(inactive_plan)

        active_plan = MealPlan(
            user_id=user_id,
            plan_data={"active": True},
            bmr=1600.0,
            tdee=2300.0,
            daily_calorie_target=1900.0,
            is_active=True
        )
        created_active = await repo.create(active_plan)

        result = await repo.get_active_plan_for_user(user_id)
        assert result is not None
        assert result.id == created_active.id
        assert result.is_active is True

    @pytest.mark.asyncio
    async def test_meal_plan_timestamps(self, meal_plan_repo):
        """Test created_at timestamp is set - Task 2.1.1.1"""
        repo, conn_mgr = meal_plan_repo

        plan = MealPlan(
            user_id="user_timestamps",
            plan_data={},
            bmr=1500.0,
            tdee=2250.0,
            daily_calorie_target=1800.0
        )

        created = await repo.create(plan)
        retrieved = await repo.get_by_id(created.id)

        # Verify
        assert retrieved is not None
        assert retrieved.created_at is not None
