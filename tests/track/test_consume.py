"""Tests for consume_plan_item endpoint.

FASE 3: Backend - Consumir Item del Plan
Tests de integración para el endpoint POST /track/plan-item/{id}/consume
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
import uuid


class TestConsumePlanItem:
    """Test cases for consume_plan_item functionality."""

    @pytest.mark.asyncio
    async def test_consume_plan_item_creates_meal(self):
        """Test that consuming a plan item creates a meal entry."""
        from app.models.tracking import (
            PlanProgress, PlanMealItem, DayProgress, DayProgressSummary
        )
        from app.services.tracking_service import TrackingService
        
        item_id = str(uuid.uuid4())
        user_id = "test-user-123"
        
        plan_item = PlanMealItem(
            id=item_id,
            barcode="123456",
            name="Chicken Breast",
            serving="100g",
            calories=165,
            macros={"protein": 31, "fat": 3.6, "carbs": 0},
            meal_type="lunch",
            is_consumed=False
        )
        
        active_plan = PlanProgress(
            plan_id="plan-123",
            daily_calorie_target=2000,
            meals=[plan_item],
            created_at=datetime.now()
        )
        
        mock_repository = MagicMock()
        mock_repository.cache.get = AsyncMock(return_value=[])
        mock_repository.cache.set = AsyncMock()
        
        service = TrackingService(repository=mock_repository)
        
        with patch.object(service, 'get_active_plan', new_callable=AsyncMock) as mock_get_plan:
            mock_get_plan.return_value = active_plan
            
            with patch.object(service, 'get_consumed_plan_items', new_callable=AsyncMock) as mock_get_consumed:
                mock_get_consumed.return_value = []
                
                with patch.object(service, 'create_meal', new_callable=AsyncMock) as mock_create_meal:
                    mock_create_meal.return_value = "meal-id-123"
                    
                    with patch.object(service, 'calculate_day_progress', new_callable=AsyncMock) as mock_calc:
                        mock_calc.return_value = DayProgressSummary(
                            calories=DayProgress(consumed=165, planned=2000, percentage=8.25),
                            protein=DayProgress(consumed=31, planned=120, percentage=25.8),
                            fat=DayProgress(consumed=3.6, planned=65, percentage=5.5),
                            carbs=DayProgress(consumed=0, planned=250, percentage=0)
                        )
                        
                        result = await service.consume_plan_item(
                            user_id=user_id,
                            item_id=item_id,
                            consumed_at=datetime.now().isoformat()
                        )
                        
                        assert result["success"] is True
                        assert result["item_id"] == item_id
                        assert "marked as consumed" in result["message"]
                        mock_create_meal.assert_called_once()

    @pytest.mark.asyncio
    async def test_consume_item_not_in_plan(self):
        """Test that consuming a non-existent item returns error."""
        from app.models.tracking import PlanProgress, PlanMealItem
        from app.services.tracking_service import TrackingService
        
        user_id = "test-user-123"
        item_id = "non-existent-item"
        
        plan_item = PlanMealItem(
            id="item-1",
            barcode="123456",
            name="Chicken Breast",
            serving="100g",
            calories=165,
            macros={},
            meal_type="lunch",
            is_consumed=False
        )
        
        active_plan = PlanProgress(
            plan_id="plan-123",
            daily_calorie_target=2000,
            meals=[plan_item],
            created_at=datetime.now()
        )
        
        mock_repository = MagicMock()
        service = TrackingService(repository=mock_repository)
        
        with patch.object(service, 'get_active_plan', new_callable=AsyncMock) as mock_get_plan:
            mock_get_plan.return_value = active_plan
            
            result = await service.consume_plan_item(
                user_id=user_id,
                item_id=item_id,
                consumed_at=datetime.now().isoformat()
            )
            
            assert result["success"] is False
            assert "not found in plan" in result["message"]

    @pytest.mark.asyncio
    async def test_consume_item_already_consumed(self):
        """Test that consuming an already consumed item returns error."""
        from app.models.tracking import PlanProgress, PlanMealItem
        from app.services.tracking_service import TrackingService
        
        user_id = "test-user-123"
        item_id = "item-1"
        
        plan_item = PlanMealItem(
            id=item_id,
            barcode="123456",
            name="Chicken Breast",
            serving="100g",
            calories=165,
            macros={},
            meal_type="lunch",
            is_consumed=False
        )
        
        active_plan = PlanProgress(
            plan_id="plan-123",
            daily_calorie_target=2000,
            meals=[plan_item],
            created_at=datetime.now()
        )
        
        mock_repository = MagicMock()
        service = TrackingService(repository=mock_repository)
        
        with patch.object(service, 'get_active_plan', new_callable=AsyncMock) as mock_get_plan:
            mock_get_plan.return_value = active_plan
            
            with patch.object(service, 'get_consumed_plan_items', new_callable=AsyncMock) as mock_get_consumed:
                mock_get_consumed.return_value = [item_id]
                
                result = await service.consume_plan_item(
                    user_id=user_id,
                    item_id=item_id,
                    consumed_at=datetime.now().isoformat()
                )
                
                assert result["success"] is False
                assert "already consumed" in result["message"]

    @pytest.mark.asyncio
    async def test_consume_item_no_active_plan(self):
        """Test that consuming without an active plan returns error."""
        from app.services.tracking_service import TrackingService
        
        user_id = "test-user-123"
        item_id = "item-1"
        
        mock_repository = MagicMock()
        service = TrackingService(repository=mock_repository)
        
        with patch.object(service, 'get_active_plan', new_callable=AsyncMock) as mock_get_plan:
            mock_get_plan.return_value = None
            
            result = await service.consume_plan_item(
                user_id=user_id,
                item_id=item_id,
                consumed_at=datetime.now().isoformat()
            )
            
            assert result["success"] is False
            assert "No active meal plan found" in result["message"]


class TestConsumeEndpoint:
    """Test cases for the consume endpoint."""

    def test_consume_endpoint_exists(self):
        """Test that the endpoint is registered."""
        from app.routes.track.router import router
        
        route_paths = [route.path for route in router.routes]
        assert any("/plan-item/" in path for path in route_paths)
        assert any("consume" in path for path in route_paths)


class TestConsumeModels:
    """Test cases for ConsumePlanItemRequest and Response models."""

    def test_consume_request_model(self):
        """Test ConsumePlanItemRequest validation."""
        from app.models.tracking import ConsumePlanItemRequest
        
        request = ConsumePlanItemRequest(
            consumed_at=datetime.now().isoformat()
        )
        
        assert request.consumed_at is not None
        assert isinstance(request.consumed_at, str)

    def test_consume_response_model(self):
        """Test ConsumePlanItemResponse validation."""
        from app.models.tracking import ConsumePlanItemResponse, DayProgress, DayProgressSummary
        
        progress = DayProgressSummary(
            calories=DayProgress(consumed=165, planned=2000, percentage=8.25),
            protein=DayProgress(consumed=31, planned=120, percentage=25.8),
            fat=DayProgress(consumed=3.6, planned=65, percentage=5.5),
            carbs=DayProgress(consumed=0, planned=250, percentage=0)
        )
        
        response = ConsumePlanItemResponse(
            success=True,
            item_id="item-123",
            message="Item marked as consumed",
            updated_progress=progress
        )
        
        assert response.success is True
        assert response.item_id == "item-123"
        assert response.updated_progress is not None
        assert response.updated_progress.calories.consumed == 165
