"""
Taste Learning Service Coverage Tests - Phase 3
Task 3.4: Improve coverage from 77% to 85%

Tests for TasteLearningService with cuisine/ingredient preference analysis
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime
from statistics import mean, variance
from app.services.taste_learning import TasteLearningService
from app.services.recipe_database import RecipeDatabaseService


@pytest.fixture
def mock_db_service():
    """Create mock database service"""
    mock_db = AsyncMock(spec=RecipeDatabaseService)
    return mock_db


@pytest.fixture
def taste_service(mock_db_service):
    """Create TasteLearningService with mocked database"""
    return TasteLearningService(db_service=mock_db_service)


@pytest.fixture
def sample_ratings():
    """Create sample rating data"""
    return [
        {
            'recipe_id': 'recipe-1',
            'cuisine_type': 'italian',
            'rating': 5.0,
            'would_make_again': True,
            'made_modifications': False,
            'ingredients': [
                {'name': 'pasta'},
                {'name': 'tomato sauce'},
                {'name': 'basil'}
            ]
        },
        {
            'recipe_id': 'recipe-2',
            'cuisine_type': 'italian',
            'rating': 4.0,
            'would_make_again': True,
            'made_modifications': False,
            'ingredients': [
                {'name': 'pasta'},
                {'name': 'olive oil'},
                {'name': 'garlic'}
            ]
        },
        {
            'recipe_id': 'recipe-3',
            'cuisine_type': 'thai',
            'rating': 3.0,
            'would_make_again': False,
            'made_modifications': True,
            'ingredients': [
                {'name': 'rice'},
                {'name': 'chili'},
                {'name': 'lemongrass'}
            ]
        },
        {
            'recipe_id': 'recipe-4',
            'cuisine_type': 'spanish',
            'rating': 4.5,
            'would_make_again': True,
            'made_modifications': False,
            'ingredients': [
                {'name': 'olive oil'},
                {'name': 'peppers'},
                {'name': 'tomato'}
            ]
        }
    ]


# ==================== Initialization Tests ====================

def test_taste_learning_service_init_with_db(mock_db_service):
    """Test TasteLearningService initialization with database"""
    service = TasteLearningService(db_service=mock_db_service)

    assert service is not None
    assert service.db_service == mock_db_service


def test_taste_learning_service_init_default_db():
    """Test TasteLearningService creates default database"""
    with patch('app.services.taste_learning.RecipeDatabaseService'):
        service = TasteLearningService()

        assert service is not None
        assert service.db_service is not None


# ==================== Cuisine Preference Tests ====================

@pytest.mark.asyncio
async def test_analyze_cuisine_preferences_success(taste_service, mock_db_service, sample_ratings):
    """Test analyzing cuisine preferences with valid data"""
    mock_db_service.get_user_ratings_for_learning = AsyncMock(return_value=sample_ratings)

    result = await taste_service.analyze_cuisine_preferences("user-123", min_ratings=1)

    assert result is not None
    assert result['user_id'] == "user-123"
    assert result['total_ratings_analyzed'] == 4
    assert result['cuisines_analyzed'] > 0
    assert 'confidence_score' in result
    assert isinstance(result['confidence_score'], float)


@pytest.mark.asyncio
async def test_analyze_cuisine_preferences_insufficient_data(taste_service, mock_db_service):
    """Test analyzing cuisine preferences with insufficient data"""
    mock_db_service.get_user_ratings_for_learning = AsyncMock(return_value=[])

    result = await taste_service.analyze_cuisine_preferences("user-123", min_ratings=3)

    assert result['confidence_score'] == 0.0
    assert result['cuisines_analyzed'] == 0
    assert 'error' in result


@pytest.mark.asyncio
async def test_analyze_cuisine_preferences_error_handling(taste_service, mock_db_service):
    """Test analyze_cuisine_preferences returns empty result on error"""
    mock_db_service.get_user_ratings_for_learning = AsyncMock(side_effect=Exception("DB Error"))

    result = await taste_service.analyze_cuisine_preferences("user-123")

    assert result['confidence_score'] == 0.0
    assert 'error' in result


@pytest.mark.asyncio
async def test_analyze_cuisine_preferences_normalized_scores(taste_service, mock_db_service, sample_ratings):
    """Test that cuisine preferences are normalized"""
    mock_db_service.get_user_ratings_for_learning = AsyncMock(return_value=sample_ratings)

    result = await taste_service.analyze_cuisine_preferences("user-123", min_ratings=1)

    # All cuisines should have normalized_score
    for cuisine, data in result.get('cuisine_preferences', {}).items():
        assert 'normalized_score' in data
        assert -1.0 <= data['normalized_score'] <= 1.0


# ==================== Single Cuisine Analysis Tests ====================

def test_analyze_single_cuisine_basic(taste_service):
    """Test analyzing a single cuisine"""
    ratings = [
        {'rating': 5.0, 'would_make_again': True, 'made_modifications': False},
        {'rating': 4.0, 'would_make_again': True, 'made_modifications': False},
        {'rating': 4.5, 'would_make_again': True, 'made_modifications': False},
    ]

    result = taste_service._analyze_single_cuisine("italian", ratings)

    assert result is not None
    assert 'raw_score' in result
    assert 'weight' in result
    assert 'confidence' in result
    assert 'average_rating' in result
    assert -1.0 <= result['raw_score'] <= 1.0


def test_analyze_single_cuisine_empty(taste_service):
    """Test analyzing cuisine with empty ratings"""
    result = taste_service._analyze_single_cuisine("italian", [])

    assert result['raw_score'] == 0.0
    assert result['weight'] == 0
    assert result['confidence'] == 0.0


def test_analyze_single_cuisine_weight_calculation(taste_service):
    """Test cuisine weight is based on number of ratings"""
    ratings = [
        {'rating': 5.0, 'would_make_again': True, 'made_modifications': False},
        {'rating': 4.0, 'would_make_again': True, 'made_modifications': False},
        {'rating': 4.5, 'would_make_again': True, 'made_modifications': False},
    ]

    result = taste_service._analyze_single_cuisine("italian", ratings)

    assert result['weight'] == 3


# ==================== Cuisine Confidence Tests ====================

def test_calculate_cuisine_confidence_sufficient_data(taste_service):
    """Test confidence calculation with sufficient data"""
    preferences = {
        'italian': {'raw_score': 0.8, 'weight': 5, 'confidence': 0.9},
        'spanish': {'raw_score': 0.6, 'weight': 4, 'confidence': 0.8},
        'thai': {'raw_score': -0.2, 'weight': 3, 'confidence': 0.5},
    }

    result = taste_service._calculate_cuisine_confidence(preferences, total_ratings=50)

    assert isinstance(result, float)
    assert 0.0 <= result <= 1.0


def test_calculate_cuisine_confidence_insufficient_data(taste_service):
    """Test confidence is low with insufficient data"""
    preferences = {'italian': {'raw_score': 0.8, 'weight': 2, 'confidence': 0.5}}

    result = taste_service._calculate_cuisine_confidence(preferences, total_ratings=3)

    assert result == 0.0


# ==================== Cuisine Pattern Detection Tests ====================

@pytest.mark.asyncio
async def test_detect_cuisine_patterns_success(taste_service, mock_db_service, sample_ratings):
    """Test detecting cuisine patterns"""
    mock_db_service.get_user_ratings_for_learning = AsyncMock(return_value=sample_ratings)

    result = await taste_service.detect_cuisine_patterns("user-123")

    assert result is not None
    assert 'detected_patterns' in result
    assert 'regional_preferences' in result['detected_patterns']
    assert 'complexity_preference' in result['detected_patterns']


@pytest.mark.asyncio
async def test_detect_cuisine_patterns_empty_data(taste_service, mock_db_service):
    """Test pattern detection with empty data"""
    mock_db_service.get_user_ratings_for_learning = AsyncMock(return_value=[])

    result = await taste_service.detect_cuisine_patterns("user-123")

    assert 'error' in result


# ==================== Ingredient Preference Tests ====================

@pytest.mark.asyncio
async def test_analyze_ingredient_preferences_success(taste_service, mock_db_service, sample_ratings):
    """Test analyzing ingredient preferences"""
    mock_db_service.get_user_ratings_for_learning = AsyncMock(return_value=sample_ratings)

    result = await taste_service.analyze_ingredient_preferences("user-123", min_occurrences=1)

    assert result is not None
    assert result['user_id'] == "user-123"
    assert result['total_ratings_analyzed'] == 4
    assert 'ingredients_analyzed' in result
    assert 'categorized_ingredients' in result


@pytest.mark.asyncio
async def test_analyze_ingredient_preferences_insufficient_data(taste_service, mock_db_service):
    """Test ingredient analysis with insufficient data"""
    mock_db_service.get_user_ratings_for_learning = AsyncMock(return_value=[])

    result = await taste_service.analyze_ingredient_preferences("user-123")

    assert result['ingredients_analyzed'] == 0
    assert 'error' in result


@pytest.mark.asyncio
async def test_analyze_ingredient_preferences_error_handling(taste_service, mock_db_service):
    """Test ingredient analysis error handling"""
    mock_db_service.get_user_ratings_for_learning = AsyncMock(side_effect=Exception("DB Error"))

    result = await taste_service.analyze_ingredient_preferences("user-123")

    assert result['confidence_score'] == 0.0
    assert 'error' in result


# ==================== Single Ingredient Analysis Tests ====================

def test_analyze_single_ingredient_basic(taste_service):
    """Test analyzing a single ingredient"""
    ratings = [
        {'rating': 5.0, 'would_make_again': True, 'made_modifications': False, 'recipe_id': 'r1'},
        {'rating': 4.0, 'would_make_again': True, 'made_modifications': False, 'recipe_id': 'r2'},
        {'rating': 4.5, 'would_make_again': True, 'made_modifications': False, 'recipe_id': 'r3'},
    ]

    result = taste_service._analyze_single_ingredient("olive oil", ratings)

    assert result is not None
    assert 'raw_score' in result
    assert 'weight' in result
    assert 'confidence' in result
    assert -1.0 <= result['raw_score'] <= 1.0


def test_analyze_single_ingredient_empty(taste_service):
    """Test analyzing ingredient with empty ratings"""
    result = taste_service._analyze_single_ingredient("olive oil", [])

    assert result['raw_score'] == 0.0
    assert result['weight'] == 0


# ==================== Ingredient Categorization Tests ====================

def test_categorize_ingredients_loved(taste_service):
    """Test categorizing loved ingredients"""
    preferences = {
        'pasta': {'raw_score': 0.8},
        'olive oil': {'raw_score': 0.7},
        'garlic': {'raw_score': 0.65},
    }

    result = taste_service._categorize_ingredients(preferences)

    assert 'loved' in result
    assert len(result['loved']) == 3


def test_categorize_ingredients_avoided(taste_service):
    """Test categorizing avoided ingredients"""
    preferences = {
        'liver': {'raw_score': -0.8},
        'olives': {'raw_score': -0.75},
        'anchovies': {'raw_score': -0.7},
    }

    result = taste_service._categorize_ingredients(preferences)

    assert 'avoided' in result
    assert len(result['avoided']) == 3


def test_categorize_ingredients_mixed(taste_service):
    """Test categorizing mixed ingredients"""
    preferences = {
        'pasta': {'raw_score': 0.8},           # loved
        'rice': {'raw_score': 0.5},            # liked
        'water': {'raw_score': 0.0},           # neutral
        'brussel sprouts': {'raw_score': -0.4},  # disliked
        'liver': {'raw_score': -0.8},          # avoided
    }

    result = taste_service._categorize_ingredients(preferences)

    assert len(result['loved']) == 1
    assert len(result['liked']) == 1
    assert len(result['neutral']) == 1
    assert len(result['disliked']) == 1
    assert len(result['avoided']) == 1


# ==================== Ingredient Confidence Tests ====================

def test_calculate_ingredient_confidence_sufficient_data(taste_service):
    """Test ingredient confidence with sufficient data"""
    preferences = {
        'pasta': {'confidence': 0.9, 'raw_score': 0.8},
        'olive oil': {'confidence': 0.85, 'raw_score': 0.7},
        'tomato': {'confidence': 0.8, 'raw_score': 0.6},
    }

    result = taste_service._calculate_ingredient_confidence(preferences, total_ratings=30)

    assert isinstance(result, float)
    assert 0.0 <= result <= 1.0


def test_calculate_ingredient_confidence_insufficient_data(taste_service):
    """Test ingredient confidence with insufficient data"""
    preferences = {'pasta': {'confidence': 0.5, 'raw_score': 0.8}}

    result = taste_service._calculate_ingredient_confidence(preferences, total_ratings=2)

    assert result == 0.0


# ==================== Ingredient Pattern Detection Tests ====================

@pytest.mark.asyncio
async def test_detect_ingredient_patterns_success(taste_service, mock_db_service, sample_ratings):
    """Test detecting ingredient patterns"""
    mock_db_service.get_user_ratings_for_learning = AsyncMock(return_value=sample_ratings)

    result = await taste_service.detect_ingredient_patterns("user-123")

    assert result is not None
    assert 'detected_patterns' in result


@pytest.mark.asyncio
async def test_detect_ingredient_patterns_empty_data(taste_service, mock_db_service):
    """Test ingredient pattern detection with empty data"""
    mock_db_service.get_user_ratings_for_learning = AsyncMock(return_value=[])

    result = await taste_service.detect_ingredient_patterns("user-123")

    assert 'error' in result


# ==================== Pattern Detection Helper Tests ====================

def test_detect_protein_patterns(taste_service):
    """Test protein pattern detection"""
    preferences = {
        'chicken': {'raw_score': 0.8},
        'beef': {'raw_score': 0.7},
        'tofu': {'raw_score': -0.5},
        'beans': {'raw_score': 0.2},
    }

    result = taste_service._detect_protein_patterns(preferences)

    assert 'animal' in result or 'plant' in result


def test_detect_vegetable_patterns(taste_service):
    """Test vegetable pattern detection"""
    preferences = {
        'spinach': {'raw_score': 0.8},
        'carrot': {'raw_score': 0.7},
        'broccoli': {'raw_score': 0.6},
    }

    result = taste_service._detect_vegetable_patterns(preferences)

    assert isinstance(result, dict)


def test_detect_spice_patterns_high_tolerance(taste_service):
    """Test spice tolerance detection - high"""
    preferences = {
        'chili': {'raw_score': 0.8},
        'pepper': {'raw_score': 0.7},
        'jalapeño': {'raw_score': 0.9},
    }

    result = taste_service._detect_spice_patterns(preferences)

    assert result == 'high_tolerance'


def test_detect_spice_patterns_low_tolerance(taste_service):
    """Test spice tolerance detection - low"""
    preferences = {
        'chili': {'raw_score': -0.8},
        'pepper': {'raw_score': -0.7},
    }

    result = taste_service._detect_spice_patterns(preferences)

    assert result == 'low_tolerance'


def test_detect_spice_patterns_unknown(taste_service):
    """Test spice tolerance detection - unknown"""
    preferences = {
        'pasta': {'raw_score': 0.8},
    }

    result = taste_service._detect_spice_patterns(preferences)

    assert result == 'unknown'


def test_detect_fat_patterns(taste_service):
    """Test fat preference detection"""
    preferences = {
        'olive oil': {'raw_score': 0.8},
        'butter': {'raw_score': 0.2},
    }

    result = taste_service._detect_fat_patterns(preferences)

    assert isinstance(result, dict)


def test_detect_dietary_ingredient_patterns_vegetarian(taste_service):
    """Test dietary pattern detection - vegetarian"""
    categorized = {
        'loved': ['tofu', 'beans', 'lentils'],
        'liked': ['pasta'],
        'neutral': [],
        'disliked': [],
        'avoided': []
    }

    result = taste_service._detect_dietary_ingredient_patterns(categorized)

    assert 'vegetarian_leaning' in result


def test_detect_dietary_ingredient_patterns_health_conscious(taste_service):
    """Test dietary pattern detection - health conscious"""
    categorized = {
        'loved': ['spinach', 'kale', 'avocado'],
        'liked': [],
        'neutral': [],
        'disliked': [],
        'avoided': []
    }

    result = taste_service._detect_dietary_ingredient_patterns(categorized)

    assert 'health_conscious' in result


# ==================== Empty Analysis Results Tests ====================

def test_create_empty_cuisine_analysis(taste_service):
    """Test creating empty cuisine analysis"""
    result = taste_service._create_empty_cuisine_analysis()

    assert result['cuisines_analyzed'] == 0
    assert result['cuisine_preferences'] == {}
    assert result['confidence_score'] == 0.0
    assert 'error' in result


def test_create_empty_ingredient_analysis(taste_service):
    """Test creating empty ingredient analysis"""
    result = taste_service._create_empty_ingredient_analysis()

    assert result['ingredients_analyzed'] == 0
    assert result['ingredient_preferences'] == {}
    assert result['confidence_score'] == 0.0
    assert 'error' in result


# ==================== Database Update Tests ====================

@pytest.mark.asyncio
async def test_update_cuisine_preferences_success(taste_service, mock_db_service):
    """Test updating cuisine preferences in database"""
    mock_db_service.update_cuisine_preference = AsyncMock(return_value=True)

    analysis = {
        'cuisine_preferences': {
            'italian': {
                'raw_score': 0.8,
                'total_ratings': 5,
                'would_make_again_ratio': 0.8,
                'average_rating': 4.5,
                'modification_ratio': 0.0
            }
        }
    }

    result = await taste_service.update_cuisine_preferences_in_db("user-123", analysis)

    assert result is True
    assert mock_db_service.update_cuisine_preference.called


@pytest.mark.asyncio
async def test_update_cuisine_preferences_no_data(taste_service, mock_db_service):
    """Test updating cuisine preferences with no data"""
    analysis = {'cuisine_preferences': {}}

    result = await taste_service.update_cuisine_preferences_in_db("user-123", analysis)

    assert result is False


@pytest.mark.asyncio
async def test_update_ingredient_preferences_success(taste_service, mock_db_service):
    """Test updating ingredient preferences in database"""
    mock_db_service.update_ingredient_preference = AsyncMock(return_value=True)

    analysis = {
        'ingredient_preferences': {
            'olive oil': {
                'raw_score': 0.8,
                'confidence': 0.9,
                'recipe_count': 5,
                'would_make_again_ratio': 0.8,
                'average_rating': 4.5,
                'modification_ratio': 0.0
            }
        }
    }

    result = await taste_service.update_ingredient_preferences_in_db("user-123", analysis)

    assert result is True


@pytest.mark.asyncio
async def test_update_ingredient_preferences_error_handling(taste_service, mock_db_service):
    """Test ingredient preference update error handling"""
    mock_db_service.update_ingredient_preference = AsyncMock(side_effect=Exception("DB Error"))

    analysis = {
        'ingredient_preferences': {
            'olive oil': {
                'raw_score': 0.8,
                'confidence': 0.9,
                'recipe_count': 5,
                'would_make_again_ratio': 0.8,
                'average_rating': 4.5,
                'modification_ratio': 0.0
            }
        }
    }

    result = await taste_service.update_ingredient_preferences_in_db("user-123", analysis)

    assert result is False


# ==================== Global Instance Tests ====================

def test_taste_learning_service_global_instance():
    """Test global taste_learning_service instance exists"""
    from app.services.taste_learning import taste_learning_service

    assert taste_learning_service is not None
    assert isinstance(taste_learning_service, TasteLearningService)
