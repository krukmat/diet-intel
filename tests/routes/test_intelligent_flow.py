import base64
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from main import app
from app.models.food_vision import IdentifiedIngredient, NutritionalAnalysis, VisionLogResponse
from app.models.intelligent_flow import (
    IntelligentFlowResponse,
    FlowExecutionStatus,
    FlowMetadata,
    FlowStepTiming,
    FlowStepStatus,
)
from app.models.recipe import GeneratedRecipeResponse, DifficultyLevel, RecipeNutritionResponse
from app.models.smart_diet import (
    SmartDietResponse,
    SmartDietContext,
    SmartSuggestion,
    SuggestionType,
    SuggestionCategory,
)


@pytest.fixture
def client():
    return TestClient(app)


def _build_sample_response(user_id: str, meal_type: str = "lunch") -> IntelligentFlowResponse:
    vision_result = VisionLogResponse(
        id="vision-xyz",
        user_id=user_id,
        image_url="https://example.com/image.jpg",
        meal_type=meal_type,
        identified_ingredients=[
            IdentifiedIngredient(
                name="Chicken Breast",
                category="protein",
                estimated_grams=150,
                confidence_score=0.92,
                visual_markers=[],
                nutrition_per_100g={"protein": 31},
            )
        ],
        estimated_portions={"total_calories": 450},
        nutritional_analysis=NutritionalAnalysis(
            total_calories=450,
            macro_distribution={"protein_percent": 40, "fat_percent": 30, "carbs_percent": 30},
            food_quality_score=0.8,
            health_benefits=["lean_protein"],
        ),
        exercise_suggestions=[],
        created_at=datetime.utcnow(),
        processing_time_ms=1100,
    )

    recipe_result = GeneratedRecipeResponse(
        id="recipe-xyz",
        name="Mediterranean Chicken Bowl",
        description="High protein lunch bowl",
        cuisine_type="mediterranean",
        difficulty_level=DifficultyLevel.EASY,
        prep_time_minutes=20,
        cook_time_minutes=25,
        servings=2,
        ingredients=[
            {
                "name": "Chicken Breast",
                "quantity": 2,
                "unit": "pieces",
                "calories_per_unit": 165,
                "protein_g_per_unit": 31,
                "fat_g_per_unit": 3.6,
                "carbs_g_per_unit": 0,
                "is_optional": False,
            }
        ],
        instructions=[
            {
                "step_number": 1,
                "instruction": "Season chicken",
                "cooking_method": "pan_fry",
            }
        ],
        nutrition=RecipeNutritionResponse(
            calories_per_serving=400,
            protein_g_per_serving=42,
            fat_g_per_serving=12,
            carbs_g_per_serving=18,
            fiber_g_per_serving=6,
            sugar_g_per_serving=4,
            sodium_mg_per_serving=520,
            recipe_score=0.82,
        ),
        created_by="ai_generated",
        confidence_score=0.87,
        generation_time_ms=2300,
        tags=["high_protein"],
        personalization=None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    suggestion = SmartSuggestion(
        id="suggestion-xyz",
        user_id=user_id,
        suggestion_type=SuggestionType.RECOMMENDATION,
        category=SuggestionCategory.DISCOVERY,
        title="Add leafy greens",
        description="Balance the dish with a spinach salad",
        reasoning="Increase micronutrient diversity",
        suggested_item={"name": "Spinach"},
        nutritional_benefit={"iron": 15},
        calorie_impact=35,
        macro_impact={"fiber_percent": 12},
        confidence_score=0.71,
        planning_context=SmartDietContext.TODAY,
        implementation_complexity="simple",
        created_at=datetime.utcnow(),
    )

    smart_diet_result = SmartDietResponse(
        user_id=user_id,
        context_type=SmartDietContext.TODAY,
        suggestions=[suggestion],
        today_highlights=[suggestion],
        optimizations=[],
        discoveries=[suggestion],
        insights=[],
        nutritional_summary={"fiber_gain": 5},
        personalization_factors=[],
        total_suggestions=1,
        avg_confidence=0.71,
        generation_time_ms=1400,
    )

    timings = {
        "vision": FlowStepTiming(
            started_at=datetime.utcnow(),
            duration_ms=1100,
            status=FlowStepStatus.SUCCESS,
        ),
        "recipe": FlowStepTiming(
            started_at=datetime.utcnow(),
            duration_ms=2300,
            status=FlowStepStatus.SUCCESS,
        ),
        "smart_diet": FlowStepTiming(
            started_at=datetime.utcnow(),
            duration_ms=1400,
            status=FlowStepStatus.SUCCESS,
        ),
    }

    metadata = FlowMetadata(
        user_id=user_id,
        meal_type=meal_type,
        total_duration_ms=4800,
        warnings=[],
    )

    return IntelligentFlowResponse(
        status=FlowExecutionStatus.COMPLETE,
        vision_result=vision_result,
        recipe_result=recipe_result,
        smart_diet_result=smart_diet_result,
        timings=timings,
        metadata=metadata,
    )


def test_intelligent_flow_feature_disabled(client, test_auth_data, monkeypatch):
    monkeypatch.setattr("app.config.config.intelligent_flow_enabled", False, raising=False)

    payload = {
        "image_base64": base64.b64encode(b"sample").decode("utf-8"),
        "meal_type": "lunch",
    }

    response = client.post(
        "/intelligent-flow",
        headers={"Authorization": f"Bearer {test_auth_data['access_token']}"},
        json=payload,
    )

    assert response.status_code == 404


def test_intelligent_flow_success(client, test_auth_data, monkeypatch):
    monkeypatch.setattr("app.config.config.intelligent_flow_enabled", True, raising=False)

    sample_response = _build_sample_response(test_auth_data["user"].id, meal_type="dinner")
    mock_run_flow = AsyncMock(return_value=sample_response)
    monkeypatch.setattr(
        "app.routes.intelligent_flow.intelligent_flow_service.run_flow",
        mock_run_flow,
    )

    payload = {
        "image_base64": base64.b64encode(b"sample-image").decode("utf-8"),
        "meal_type": "dinner",
        "user_context": {"goal": "lose_weight"},
    }

    response = client.post(
        "/intelligent-flow",
        headers={"Authorization": f"Bearer {test_auth_data['access_token']}"},
        json=payload,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == FlowExecutionStatus.COMPLETE.value
    assert body["metadata"]["meal_type"] == "dinner"

    called_request = mock_run_flow.await_args.args[0]
    assert called_request.user_id == test_auth_data["user"].id
    assert called_request.meal_type == "dinner"


def test_intelligent_flow_async_mode_returns_job(client, test_auth_data, monkeypatch):
    monkeypatch.setattr("app.config.config.intelligent_flow_enabled", True, raising=False)

    dummy_job = SimpleNamespace(
        id="job-123",
        status="queued",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        result=None,
        error=None,
        user_id=test_auth_data["user"].id,
    )

    async def fake_enqueue(service, request):  # pylint: disable=unused-argument
        return dummy_job

    monkeypatch.setattr(
        "app.routes.intelligent_flow.intelligent_flow_queue.enqueue",
        fake_enqueue,
    )

    payload = {
        "image_base64": base64.b64encode(b"sample-image").decode("utf-8"),
        "meal_type": "lunch",
    }

    response = client.post(
        "/intelligent-flow?async_mode=true",
        headers={"Authorization": f"Bearer {test_auth_data['access_token']}"},
        json=payload,
    )

    assert response.status_code == 202
    body = response.json()
    assert body["job_id"] == dummy_job.id
    assert body["status"] == "queued"


def test_get_intelligent_flow_job_returns_result(client, test_auth_data, monkeypatch):
    monkeypatch.setattr("app.config.config.intelligent_flow_enabled", True, raising=False)

    sample_response = _build_sample_response(test_auth_data["user"].id)
    completed_job = SimpleNamespace(
        id="job-456",
        status="completed",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        result=sample_response,
        error=None,
        user_id=test_auth_data["user"].id,
    )

    async def fake_get(job_id):  # pylint: disable=unused-argument
        return completed_job

    monkeypatch.setattr(
        "app.routes.intelligent_flow.intelligent_flow_queue.get",
        fake_get,
    )

    response = client.get(
        f"/intelligent-flow/{completed_job.id}",
        headers={"Authorization": f"Bearer {test_auth_data['access_token']}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["result"]["status"] == sample_response.status.value
