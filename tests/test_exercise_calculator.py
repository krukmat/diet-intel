import pytest

from app.services.exercise_calculator import ExerciseCalculator
from app.models.exercise_suggestion import ExerciseRecommendation, ExerciseAnalysis


@pytest.fixture
def calculator():
    return ExerciseCalculator()


def test_calculate_calorie_deficit(calculator):
    assert calculator.calculate_calorie_deficit(consumed=1500, target=2000) == 500


def test_suggest_exercise_no_deficit(calculator):
    assert calculator.suggest_exercise(0, {"weight_kg": 80}) == []


def test_suggest_exercise_small_deficit(calculator):
    suggestions = calculator.suggest_exercise(150, {"weight_kg": 70})
    assert len(suggestions) == 1
    suggestion = suggestions[0]
    assert suggestion["activity_type"] == "walking"
    assert suggestion["intensity_level"] == "moderate"
    assert suggestion["estimated_calories_burned"] > 0


def test_suggest_exercise_medium_deficit(calculator):
    suggestions = calculator.suggest_exercise(300, {"weight_kg": 70})
    assert len(suggestions) == 1
    suggestion = suggestions[0]
    assert suggestion["activity_type"] == "brisk_walking"
    assert suggestion["duration_minutes"] == 50


def test_suggest_exercise_large_deficit(calculator):
    suggestions = calculator.suggest_exercise(600, {"weight_kg": 70})
    assert len(suggestions) == 2
    activities = {s["activity_type"] for s in suggestions}
    assert activities == {"running", "swimming"}


def test_estimate_calories_burned(calculator):
    burned = calculator.estimate_calories_burned("running", 30, 70)
    assert pytest.approx(burned, rel=1e-3) == calculator.activity_rates["running"] * 0.5 * 70


def test_estimate_calories_burned_handles_error(caplog, calculator):
    value = calculator.estimate_calories_burned("__test_error__", 30, 70)
    assert value == 0.0


def test_exercise_recommendation_validators():
    rec = ExerciseRecommendation(
        activity="walking",
        duration_min=30,
        calories_burn=120,
        intensity="moderate",
        reasoning="Sample",
    )
    assert rec.activity == "walking"

    with pytest.raises(ValueError):
        ExerciseRecommendation(
            activity="invalid",
            duration_min=30,
            calories_burn=120,
            intensity="moderate",
            reasoning="bad activity",
        )

    with pytest.raises(ValueError):
        ExerciseRecommendation(
            activity="walking",
            duration_min=30,
            calories_burn=120,
            intensity="extreme",
            reasoning="bad intensity",
        )


def test_exercise_analysis_forward_refs():
    rec = ExerciseRecommendation(
        activity="walking",
        duration_min=30,
        calories_burn=120,
        intensity="low",
        reasoning="Example",
    )
    analysis = ExerciseAnalysis(deficit_calories=200, recommended_activities=[rec])
    assert analysis.deficit_calories == 200
    assert analysis.recommended_activities[0].activity == "walking"
