import json
from datetime import datetime
from unittest.mock import AsyncMock

import pytest

from app.models.food_vision import (
    IdentifiedIngredient,
    NutritionalAnalysis,
    VisionLogResponse,
    VisionLogWithExerciseResponse
)
from app.services import food_vision_service
from app.services.food_vision_service import FoodVisionService


class FakeAnalyzer:
    def __init__(self, result):
        self.result = result
        self.calls = []

    async def analyze_image(self, image_data):
        self.calls.append(image_data)
        return self.result


class FakeExerciseCalculator:
    def __init__(self, result=None, fail=False):
        self.result = result or []
        self.fail = fail

    def suggest_exercise(self, deficit, user_context):
        if self.fail:
            raise RuntimeError("exercise aggr")
        return self.result


@pytest.mark.asyncio
async def test_analyze_food_image_without_exercise():
    analysis = {
        "identified_ingredients": [],
        "estimated_portions": {
            "total_calories": 1800,
            "total_protein_g": 40,
            "total_fat_g": 50,
            "total_carbs_g": 120,
            "confidence_score": 0.8
        }
    }

    service = FoodVisionService()
    service.vision_analyzer = FakeAnalyzer(analysis)
    service.exercise_calculator = FakeExerciseCalculator()

    response = await service.analyze_food_image(b"raw", "user1")

    assert isinstance(response, VisionLogResponse)
    assert not isinstance(response, VisionLogWithExerciseResponse)
    assert response.exercise_suggestions == []
    assert response.nutritional_analysis.total_calories == 0


@pytest.mark.asyncio
async def test_analyze_food_image_handles_analyzer_error(monkeypatch):
    service = FoodVisionService()

    async def _fail(image_data):
        raise RuntimeError("vision error")

    monkeypatch.setattr(service.vision_analyzer, "analyze_image", _fail)

    with pytest.raises(Exception, match="Analysis failed"):
        await service.analyze_food_image(b"raw", "user-error")


def test_build_nutritional_analysis_with_identified_foods():
    service = FoodVisionService()
    analysis = {
        "identified_ingredients": [
            {
                "name": "chicken",
                "category": "proteína",
                "estimated_grams": 120,
                "confidence_score": 0.95,
                "visual_markers": [],
                "nutrition_per_100g": {}
            }
        ],
        "estimated_portions": {
            "total_calories": 1800,
            "total_protein_g": 30,
            "total_fat_g": 60,
            "total_carbs_g": 90,
            "confidence_score": 0.8
        }
    }

    built = service._build_nutritional_analysis(analysis)
    assert built["total_calories"] == 1800
    assert built["macro_distribution"]["protein_percent"] >= 0


@pytest.mark.asyncio
async def test_analyze_food_image_with_exercise(monkeypatch):
    analysis = {
        "identified_ingredients": [],
        "estimated_portions": {
            "total_calories": 2300,
            "total_protein_g": 60,
            "total_fat_g": 70,
            "total_carbs_g": 150,
            "confidence_score": 0.9
        }
    }

    service = FoodVisionService()
    service.vision_analyzer = FakeAnalyzer(analysis)
    analysis["identified_ingredients"] = [
        {
            "name": "beef",
            "category": "proteína",
            "estimated_grams": 150,
            "confidence_score": 0.95,
            "visual_markers": [],
            "nutrition_per_100g": {}
        }
    ]

    suggestions_mock = AsyncMock(return_value=[{
        "activity_type": "walking",
        "duration_minutes": 30,
        "estimated_calories_burned": 300,
        "intensity_level": "moderate",
        "reasoning": "Burn calories",
        "health_benefits": ["cardio"]
    }])
    monkeypatch.setattr(service, "_get_exercise_suggestions", suggestions_mock)

    response = await service.analyze_food_image(b"raw", "user2", user_context={"weight": 70})

    assert suggestions_mock.await_count == 1


def test_determine_health_benefits_handles_categories():
    service = FoodVisionService()
    ingredients = [
        {"name": "Chicken breast", "category": "proteína"},
        {"name": "Spinach", "category": "verdura"},
        {"name": "Apple", "category": "fruta"}
    ]

    benefits = service._determine_health_benefits(ingredients)

    assert "Alto contenido de proteína" in benefits
    assert any("vitaminas" in benefit for benefit in benefits)
    assert any("antioxidantes" in benefit for benefit in benefits)


def test_normalize_helpers_fill_defaults():
    service = FoodVisionService()
    normalized = service._normalize_ingredient({"name": "Tomato"})
    assert normalized["estimated_grams"] == 0
    assert normalized["visual_markers"] == []

    nutrients = service._normalize_nutritional_analysis({})
    assert nutrients["total_calories"] == 0
    assert nutrients["macro_distribution"]["protein"] == 0.0


@pytest.mark.asyncio
async def test_get_exercise_suggestions_handles_calculator_failures():
    service = FoodVisionService()
    service.exercise_calculator = FakeExerciseCalculator(fail=True)

    result = await service._get_exercise_suggestions(500, {})

    assert result == []


@pytest.mark.asyncio
async def test_get_exercise_suggestions_returns_models():
    service = FoodVisionService()
    service.exercise_calculator = FakeExerciseCalculator(result=[{
        "activity_type": "walking",
        "duration_minutes": 20,
        "estimated_calories_burned": 200,
        "intensity_level": "moderate",
        "reasoning": "Lowers sugar",
        "health_benefits": ["cardio"]
    }])

    suggestions = await service._get_exercise_suggestions(400, {"weight": 65})
    assert suggestions
    assert suggestions[0].activity == "walking"


@pytest.mark.asyncio
async def test_save_analysis_persists(monkeypatch):
    service = FoodVisionService()
    ingredient = IdentifiedIngredient(
        name="broccoli",
        category="vegetal",
        estimated_grams=100,
        confidence_score=0.9,
        visual_markers=[],
        nutrition_per_100g={"protein": 2}
    )

    analysis = VisionLogResponse(
        id="log-1",
        user_id="user-save",
        image_url="/img/1",
        meal_type="dinner",
        identified_ingredients=[ingredient],
        estimated_portions={"total_calories": 150},
        nutritional_analysis=NutritionalAnalysis(
            total_calories=150,
            macro_distribution={"protein_percent": 20, "fat_percent": 30, "carbs_percent": 50},
            food_quality_score=0.8,
            health_benefits=["good"]
        ),
        exercise_suggestions=[],
        created_at=datetime.utcnow(),
        processing_time_ms=10
    )

    async def fake_create(record):
        return {**record}

    service.vision_service = AsyncMock()
    service.vision_service.create_vision_log = AsyncMock(side_effect=fake_create)

    persisted = await service.save_analysis("user-save", analysis)

    assert persisted.user_id == "user-save"
    assert persisted.id == "log-1"


@pytest.mark.asyncio
async def test_save_analysis_handles_db_failure(monkeypatch):
    service = FoodVisionService()
    response = VisionLogResponse(
        id="save-err",
        user_id="user-save",
        image_url="/img/err",
        meal_type="lunch",
        identified_ingredients=[],
        estimated_portions={"total_calories": 0, "confidence_score": 0},
        nutritional_analysis=NutritionalAnalysis(
            total_calories=0,
            macro_distribution={"protein_percent": 0, "fat_percent": 0, "carbs_percent": 0},
            food_quality_score=0.0,
            health_benefits=[]
        ),
        exercise_suggestions=[],
        created_at=datetime.utcnow().isoformat(),
        processing_time_ms=1
    )

    service.vision_service = AsyncMock()
    service.vision_service.create_vision_log = AsyncMock(side_effect=RuntimeError("boom"))

    with pytest.raises(RuntimeError):
        await service.save_analysis("user-save", response)


@pytest.mark.asyncio
async def test_submit_correction_missing_log(monkeypatch):
    service = FoodVisionService()
    service.vision_service = AsyncMock()
    service.vision_service.get_vision_log = AsyncMock(return_value=None)

    with pytest.raises(Exception, match="not found"):
        await service.submit_correction("missing", "user-x", {})


@pytest.mark.asyncio
async def test_submit_correction_unauthorized(monkeypatch):
    service = FoodVisionService()
    service.vision_service = AsyncMock()
    service.vision_service.get_vision_log = AsyncMock(return_value={"user_id": "other"})

    with pytest.raises(Exception, match="Unauthorized"):
        await service.submit_correction("log-1", "user-x", {})


@pytest.mark.asyncio
async def test_get_user_history_parses_rows(monkeypatch):
    service = FoodVisionService()
    now = datetime.utcnow()
    row = {
        "id": "history-1",
        "user_id": "user-h",
        "image_url": "/img/99",
        "meal_type": "lunch",
        "identified_ingredients": json.dumps([{"name": "chicken", "category": "proteína"}]),
        "estimated_portions": json.dumps({"total_calories": 200}),
        "nutritional_analysis": json.dumps({"total_calories": 200, "macro_distribution": {}}),
        "exercise_suggestions": json.dumps([]),
        "created_at": now,
        "processing_time_ms": 25
    }

    async def fake_list(*args, **kwargs):
        return ([row], 1)

    service.vision_service = AsyncMock()
    service.vision_service.list_vision_logs = AsyncMock(side_effect=fake_list)

    history = await service.get_user_history("user-h")

    assert history["total_count"] == 1
    assert history["logs"][0]["user_id"] == "user-h"
    assert isinstance(history["logs"][0]["identified_ingredients"], list)


@pytest.mark.asyncio
async def test_get_user_history_parses_string_fields(monkeypatch):
    service = FoodVisionService()
    sample_row = {
        "id": "row-1",
        "user_id": "user-s",
        "image_url": "/img/10",
        "meal_type": "breakfast",
        "identified_ingredients": json.dumps([{"name": "egg", "category": "proteína"}]),
        "estimated_portions": json.dumps({"total_calories": 300}),
        "nutritional_analysis": json.dumps({"total_calories": 300}),
        "exercise_suggestions": json.dumps([{
            "activity_type": "walk",
            "duration_minutes": 10,
            "estimated_calories_burned": 80,
            "intensity_level": "low",
            "reasoning": "boost",
            "health_benefits": []
        }]),
        "created_at": datetime.utcnow(),
        "processing_time_ms": 12
    }

    async def fake_list(*args, **kwargs):
        return ([sample_row], 1)

    service.vision_service = AsyncMock()
    service.vision_service.list_vision_logs = AsyncMock(side_effect=fake_list)

    history = await service.get_user_history("user-s")

    assert history["total_count"] == 1
    log = history["logs"][0]
    assert log["meal_type"] == "breakfast"
    assert isinstance(log["identified_ingredients"], list)
    assert log["estimated_portions"]["total_calories"] == 300
    assert log["exercise_suggestions"][0]["activity_type"] == "walk"


@pytest.mark.asyncio
async def test_submit_correction_success(monkeypatch):
    service = FoodVisionService()
    log = {"id": "corr-1", "user_id": "user-c"}

    async def fake_get(log_id):
        return log

    async def fake_create(correction):
        return {"id": "correction-1", **correction}

    service.vision_service = AsyncMock()
    service.vision_service.get_vision_log = AsyncMock(side_effect=fake_get)
    service.vision_service.create_vision_correction = AsyncMock(side_effect=fake_create)
    monkeypatch.setattr(service, "_calculate_improvement_score", lambda data: 0.5)

    result = await service.submit_correction("corr-1", "user-c", {"feedback_type": "general"})

    assert result["success"]
    assert result["improvement_score"] == 0.5

def test_calculate_improvement_score_with_bonus():
    service = FoodVisionService()
    score = service._calculate_improvement_score({
        "feedback_type": "ingredient_misidentification",
        "corrected_portions": True,
        "correction_notes": "note"
    })
    assert score == pytest.approx(0.8)
