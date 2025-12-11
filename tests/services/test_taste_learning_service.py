import asyncio
from datetime import datetime

import pytest

from app.services.taste_learning import TasteLearningService


class FakeRecipeDB:
    def __init__(self, ratings):
        self.ratings = ratings
        self.cuisine_updates = []
        self.ingredient_updates = []

    async def get_user_ratings_for_learning(self, user_id, limit=100):
        return self.ratings

    async def update_cuisine_preference(self, user_id, cuisine, data):
        self.cuisine_updates.append((user_id, cuisine, data))
        return True

    async def update_ingredient_preference(self, user_id, ingredient, data):
        self.ingredient_updates.append((user_id, ingredient, data))
        return True


@pytest.fixture
def minimal_ratings():
    return [
        {'rating': 4, 'cuisine_type': 'mexican', 'would_make_again': True, 'made_modifications': False, 'ingredients': [{'name': 'chicken', 'recipe_id': 'r1'}], 'recipe_id': 'r1'},
        {'rating': 3, 'cuisine_type': 'mexican', 'would_make_again': False, 'made_modifications': True, 'ingredients': [{'name': 'beans', 'recipe_id': 'r1'}], 'recipe_id': 'r1'}
    ]

@pytest.fixture
def ingredient_ratings():
    return [
        {'rating': 5, 'cuisine_type': 'italian', 'would_make_again': True, 'made_modifications': False, 'ingredients': [{'name': 'tomato', 'recipe_id': 'r2'}, {'name': 'basil', 'recipe_id': 'r2'}], 'recipe_id': 'r2'},
        {'rating': 4, 'cuisine_type': 'mexican', 'would_make_again': True, 'made_modifications': False, 'ingredients': [{'name': 'chicken', 'recipe_id': 'r3'}], 'recipe_id': 'r3'},
        {'rating': 2, 'cuisine_type': 'american', 'would_make_again': False, 'made_modifications': True, 'ingredients': [{'name': 'beef', 'recipe_id': 'r4'}], 'recipe_id': 'r4'}
    ]


@pytest.mark.asyncio
async def test_analyze_cuisine_preferences_reports_empty_when_insufficient(minimal_ratings):
    db = FakeRecipeDB(minimal_ratings[:1])
    service = TasteLearningService(db_service=db)

    result = await service.analyze_cuisine_preferences('user-x', min_ratings=3)

    assert result['total_ratings_analyzed'] == 0
    assert result['cuisines_analyzed'] == 0
    assert result['confidence_score'] == 0.0
    assert result['error'] == 'Insufficient data for analysis'


@pytest.mark.asyncio
async def test_analyze_cuisine_preferences_returns_scores_and_top_cuisine(ingredient_ratings):
    db = FakeRecipeDB(ingredient_ratings + [{'rating': 5, 'cuisine_type': 'mexican', 'would_make_again': True, 'made_modifications': False, 'ingredients': [{'name': 'tortilla', 'recipe_id': 'r5'}], 'recipe_id': 'r5'}])
    service = TasteLearningService(db_service=db)

    # Force low variance data to get normalized scores
    result = await service.analyze_cuisine_preferences('user-y', min_ratings=2)

    assert result['total_ratings_analyzed'] >= 3
    assert result['cuisines_analyzed'] >= 1
    assert result['top_cuisine'] is not None
    assert 'confidence_score' in result
    assert result['confidence_score'] >= 0.0

    patterns = await service.detect_cuisine_patterns('user-y')
    assert 'detected_patterns' in patterns
    assert 'regional_preferences' in patterns['detected_patterns']


@pytest.mark.asyncio
async def test_analyze_ingredient_preferences_insufficient_data(minimal_ratings):
    db = FakeRecipeDB(minimal_ratings[:1])
    service = TasteLearningService(db_service=db)

    result = await service.analyze_ingredient_preferences('user-z', min_occurrences=2)

    assert result['ingredients_analyzed'] == 0
    assert result['top_loved_ingredient'] is None
    assert result['error'] == 'Insufficient data for ingredient analysis'


@pytest.mark.asyncio
async def test_analyze_ingredient_preferences_produces_categories(ingredient_ratings):
    db = FakeRecipeDB(ingredient_ratings + [{'rating': 4, 'cuisine_type': 'italian', 'would_make_again': True, 'made_modifications': False, 'ingredients': [{'name': 'basil', 'recipe_id': 'r5'}, {'name': 'olive oil', 'recipe_id': 'r5'}], 'recipe_id': 'r5'}])
    service = TasteLearningService(db_service=db)

    result = await service.analyze_ingredient_preferences('user-w')

    assert result['ingredients_analyzed'] >= 1
    assert result['confidence_score'] >= 0.0
    cats = result['categorized_ingredients']
    assert isinstance(cats['loved'], list)

    patterns = await service.detect_ingredient_patterns('user-w')
    assert 'protein_preferences' in patterns['detected_patterns']
    assert 'spice_tolerance' in patterns['detected_patterns']

    # Ensure categorization respects raw scores
    categories = service._categorize_ingredients({
        'basil': {'raw_score': 0.7},
        'beef': {'raw_score': -0.8},
        'tomato': {'raw_score': 0.1}
    })
    assert 'basil' in categories['loved']
    assert 'beef' in categories['avoided']
    assert 'tomato' in categories['neutral']


@pytest.mark.asyncio
async def test_update_preferences_reuses_db_service(ingredient_ratings):
    db = FakeRecipeDB(ingredient_ratings)
    service = TasteLearningService(db_service=db)

    ingredient_analysis = await service.analyze_ingredient_preferences('user-update', min_occurrences=1)
    assert await service.update_ingredient_preferences_in_db('user-update', ingredient_analysis)
    assert db.ingredient_updates

    cuisine_analysis = await service.analyze_cuisine_preferences('user-update', min_ratings=1)
    assert await service.update_cuisine_preferences_in_db('user-update', cuisine_analysis)
    assert db.cuisine_updates


def test_calculate_cuisine_confidence_requires_data():
    service = TasteLearningService()
    confidence = service._calculate_cuisine_confidence({}, 3)
    assert confidence == 0.0


def test_create_empty_cuisine_analysis_structure():
    service = TasteLearningService()
    empty = service._create_empty_cuisine_analysis()
    assert empty['cuisines_analyzed'] == 0
    assert empty['confidence_score'] == 0.0
    assert 'analysis_timestamp' in empty
    assert 'error' in empty


def test_detect_flavor_patterns_prefers_spicy():
    service = TasteLearningService()
    preferences = {
        'mexican': {'normalized_score': 0.9},
        'thai': {'normalized_score': 0.8},
        'british': {'normalized_score': 0.1},
        'american': {'normalized_score': 0.2}
    }
    assert service._detect_flavor_patterns(preferences) == 'spicy'
