"""
Badge Service Coverage Tests - Phase 1
Task 1.2: Improve coverage from 60% to 85%

Tests for BadgeService methods:
- evaluate_badges
- get_user_badges
- get_badge_definitions
- _is_badge_earned
- _check_badge_eligibility
- _evaluate_rule
- _award_badge
- recalculate_user_badges
"""

import pytest
from unittest.mock import patch, MagicMock, call
from datetime import datetime
from app.services.gamification.badge_service import BadgeService


# ==================== FIXTURES ====================

@pytest.fixture
def mock_db_connection():
    """Mock database connection"""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    mock_conn.__enter__ = MagicMock(return_value=mock_conn)
    mock_conn.__exit__ = MagicMock(return_value=None)
    return mock_conn


@pytest.fixture
def sample_user_id():
    """Sample user ID for testing"""
    return "test_user_123"


@pytest.fixture
def sample_badge_code():
    """Sample badge code"""
    return "starter"


# ==================== Badge Definitions Tests ====================

def test_badge_definitions_exist():
    """Test that badge definitions are present"""
    defs = BadgeService.get_badge_definitions()
    assert defs is not None
    assert len(defs) > 0
    assert isinstance(defs, dict)


def test_badge_definitions_have_required_fields():
    """Test that each badge has all required fields"""
    defs = BadgeService.get_badge_definitions()

    required_fields = ['name', 'description', 'icon', 'rule_type', 'rule_params']

    for badge_code, badge_def in defs.items():
        assert isinstance(badge_code, str), f"Badge code should be string: {badge_code}"
        for field in required_fields:
            assert field in badge_def, f"Badge {badge_code} missing field: {field}"


def test_starter_badge_definition():
    """Test that starter badge is properly defined"""
    defs = BadgeService.get_badge_definitions()

    assert 'starter' in defs
    starter = defs['starter']
    assert starter['name'] == 'Starter'
    assert starter['description'] == 'Create your first post'
    assert starter['rule_type'] == 'action_count'
    assert starter['rule_params']['source'] == 'post_create'
    assert starter['rule_params']['count'] == 1


def test_badge_definitions_copy():
    """Test that get_badge_definitions returns a copy"""
    defs1 = BadgeService.get_badge_definitions()
    defs2 = BadgeService.get_badge_definitions()

    assert defs1 == defs2
    assert defs1 is not defs2  # Should be different objects


# ==================== Get User Badges Tests ====================

@patch('app.services.gamification.badge_service.db_service')
def test_get_user_badges_empty(mock_db, sample_user_id):
    """Test get_user_badges when user has no badges"""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_db.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_db.get_connection.return_value.__exit__ = MagicMock(return_value=None)
    mock_conn.cursor.return_value = mock_cursor
    mock_cursor.fetchall.return_value = []

    result = BadgeService.get_user_badges(sample_user_id)

    assert result == []


@patch('app.services.gamification.badge_service.db_service')
def test_get_user_badges_with_badges(mock_db, sample_user_id):
    """Test get_user_badges when user has badges"""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_db.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_db.get_connection.return_value.__exit__ = MagicMock(return_value=None)
    mock_conn.cursor.return_value = mock_cursor

    mock_badge_row = MagicMock()
    mock_badge_row.__getitem__ = MagicMock(side_effect=lambda x: 'starter' if x == 'badge_code' else '2025-01-01T10:00:00')
    mock_cursor.fetchall.return_value = [mock_badge_row]

    result = BadgeService.get_user_badges(sample_user_id)

    assert len(result) == 1
    assert result[0]['code'] == 'starter'
    assert result[0]['name'] == 'Starter'
    assert result[0]['description'] == 'Create your first post'
    assert 'icon' in result[0]
    assert 'earned_at' in result[0]


@patch('app.services.gamification.badge_service.db_service')
def test_get_user_badges_database_error(mock_db, sample_user_id):
    """Test get_user_badges handles database errors gracefully"""
    mock_db.get_connection.return_value.__enter__ = MagicMock(side_effect=Exception("DB Error"))

    result = BadgeService.get_user_badges(sample_user_id)

    assert result == []


# ==================== Is Badge Earned Tests ====================

@patch('app.services.gamification.badge_service.db_service')
def test_is_badge_earned_true(mock_db, sample_user_id, sample_badge_code):
    """Test _is_badge_earned returns True when badge is earned"""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_db.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_db.get_connection.return_value.__exit__ = MagicMock(return_value=None)
    mock_conn.cursor.return_value = mock_cursor
    mock_cursor.fetchone.return_value = (1,)  # Row exists

    result = BadgeService._is_badge_earned(sample_user_id, sample_badge_code)

    assert result is True


@patch('app.services.gamification.badge_service.db_service')
def test_is_badge_earned_false(mock_db, sample_user_id, sample_badge_code):
    """Test _is_badge_earned returns False when badge is not earned"""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_db.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_db.get_connection.return_value.__exit__ = MagicMock(return_value=None)
    mock_conn.cursor.return_value = mock_cursor
    mock_cursor.fetchone.return_value = None  # No row

    result = BadgeService._is_badge_earned(sample_user_id, sample_badge_code)

    assert result is False


@patch('app.services.gamification.badge_service.db_service')
def test_is_badge_earned_database_error(mock_db, sample_user_id, sample_badge_code):
    """Test _is_badge_earned returns False on database error"""
    mock_db.get_connection.return_value.__enter__ = MagicMock(side_effect=Exception("DB Error"))

    result = BadgeService._is_badge_earned(sample_user_id, sample_badge_code)

    assert result is False


# ==================== Check Badge Eligibility Tests ====================

@patch('app.services.gamification.badge_service.BadgeService._evaluate_rule')
def test_check_badge_eligibility_valid_badge(mock_eval, sample_user_id, sample_badge_code):
    """Test _check_badge_eligibility with valid badge"""
    mock_eval.return_value = True

    result = BadgeService._check_badge_eligibility(sample_user_id, sample_badge_code, 'post_create', {})

    assert result is True
    assert mock_eval.called


@patch('app.services.gamification.badge_service.BadgeService._evaluate_rule')
def test_check_badge_eligibility_invalid_badge(mock_eval, sample_user_id):
    """Test _check_badge_eligibility with invalid badge code"""
    result = BadgeService._check_badge_eligibility(sample_user_id, 'invalid_badge', 'post_create', {})

    assert result is False
    assert not mock_eval.called


@patch('app.services.gamification.badge_service.BadgeService._evaluate_rule')
def test_check_badge_eligibility_error(mock_eval, sample_user_id, sample_badge_code):
    """Test _check_badge_eligibility handles errors"""
    mock_eval.side_effect = Exception("Error")

    result = BadgeService._check_badge_eligibility(sample_user_id, sample_badge_code, 'post_create', {})

    assert result is False


# ==================== Evaluate Rule Tests ====================

@patch('app.services.gamification.badge_service.db_service')
def test_evaluate_rule_action_count_meets_threshold(mock_db, sample_user_id):
    """Test _evaluate_rule for action_count rule when user meets threshold"""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_db.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_db.get_connection.return_value.__exit__ = MagicMock(return_value=None)
    mock_conn.cursor.return_value = mock_cursor

    mock_row = {'total': 5}
    mock_cursor.fetchone.return_value = mock_row

    rule_params = {'source': 'post_create', 'count': 3}
    result = BadgeService._evaluate_rule(sample_user_id, 'action_count', rule_params, 'post_create', {})

    assert result is True


@patch('app.services.gamification.badge_service.db_service')
def test_evaluate_rule_action_count_below_threshold(mock_db, sample_user_id):
    """Test _evaluate_rule for action_count rule when user below threshold"""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_db.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_db.get_connection.return_value.__exit__ = MagicMock(return_value=None)
    mock_conn.cursor.return_value = mock_cursor

    mock_row = {'total': 2}
    mock_cursor.fetchone.return_value = mock_row

    rule_params = {'source': 'post_create', 'count': 5}
    result = BadgeService._evaluate_rule(sample_user_id, 'action_count', rule_params, 'post_create', {})

    assert result is False


@patch('app.services.gamification.badge_service.db_service')
def test_evaluate_rule_follower_count(mock_db, sample_user_id):
    """Test _evaluate_rule for follower_count rule"""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_db.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_db.get_connection.return_value.__exit__ = MagicMock(return_value=None)
    mock_conn.cursor.return_value = mock_cursor

    mock_row = {'followers_count': 10}
    mock_cursor.fetchone.return_value = mock_row

    rule_params = {'count': 5}
    result = BadgeService._evaluate_rule(sample_user_id, 'follower_count', rule_params, '', {})

    assert result is True


@patch('app.services.gamification.badge_service.db_service')
def test_evaluate_rule_activity_streak(mock_db, sample_user_id):
    """Test _evaluate_rule for activity_streak rule"""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_db.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_db.get_connection.return_value.__exit__ = MagicMock(return_value=None)
    mock_conn.cursor.return_value = mock_cursor

    mock_row = {'active_days': 7}
    mock_cursor.fetchone.return_value = mock_row

    rule_params = {'days': 7}
    result = BadgeService._evaluate_rule(sample_user_id, 'activity_streak', rule_params, '', {})

    assert result is True


@patch('app.services.gamification.badge_service.db_service')
def test_evaluate_rule_unknown_type(mock_db, sample_user_id):
    """Test _evaluate_rule with unknown rule type"""
    mock_conn = MagicMock()
    mock_db.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_db.get_connection.return_value.__exit__ = MagicMock(return_value=None)
    mock_conn.cursor.return_value = MagicMock()

    result = BadgeService._evaluate_rule(sample_user_id, 'unknown_type', {}, '', {})

    assert result is False


@patch('app.services.gamification.badge_service.db_service')
def test_evaluate_rule_database_error(mock_db, sample_user_id):
    """Test _evaluate_rule handles database errors"""
    mock_db.get_connection.return_value.__enter__ = MagicMock(side_effect=Exception("DB Error"))

    result = BadgeService._evaluate_rule(sample_user_id, 'action_count', {'source': 'test', 'count': 1}, '', {})

    assert result is False


# ==================== Award Badge Tests ====================

@patch('app.services.gamification.badge_service.db_service')
def test_award_badge_success(mock_db, sample_user_id, sample_badge_code):
    """Test _award_badge successfully awards badge"""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_db.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_db.get_connection.return_value.__exit__ = MagicMock(return_value=None)
    mock_conn.cursor.return_value = mock_cursor
    mock_cursor.fetchone.return_value = None  # Badge not already awarded

    with patch('app.services.gamification.points_service.PointsService.add_points'):
        result = BadgeService._award_badge(sample_user_id, sample_badge_code)

        assert result is True
        assert mock_conn.commit.called


@patch('app.services.gamification.badge_service.db_service')
def test_award_badge_already_awarded(mock_db, sample_user_id, sample_badge_code):
    """Test _award_badge when badge already awarded"""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_db.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_db.get_connection.return_value.__exit__ = MagicMock(return_value=None)
    mock_conn.cursor.return_value = mock_cursor
    mock_cursor.fetchone.return_value = (1,)  # Badge already exists

    result = BadgeService._award_badge(sample_user_id, sample_badge_code)

    assert result is False


@patch('app.services.gamification.badge_service.db_service')
def test_award_badge_database_error(mock_db, sample_user_id, sample_badge_code):
    """Test _award_badge handles database errors"""
    mock_db.get_connection.return_value.__enter__ = MagicMock(side_effect=Exception("DB Error"))

    result = BadgeService._award_badge(sample_user_id, sample_badge_code)

    assert result is False


# ==================== Evaluate Badges Tests ====================

@patch('app.services.gamification.badge_service.BadgeService._is_badge_earned')
@patch('app.services.gamification.badge_service.BadgeService._check_badge_eligibility')
@patch('app.services.gamification.badge_service.BadgeService._award_badge')
def test_evaluate_badges_awards_new_badge(mock_award, mock_check, mock_is_earned, sample_user_id):
    """Test evaluate_badges awards new badge when eligible"""
    mock_is_earned.return_value = False  # Badge not earned yet
    mock_check.return_value = True  # User is eligible
    mock_award.return_value = True  # Award successful

    result = BadgeService.evaluate_badges(sample_user_id, 'post_create')

    assert len(result) > 0
    assert 'starter' in result  # Should award starter badge


@patch('app.services.gamification.badge_service.BadgeService._is_badge_earned')
def test_evaluate_badges_skips_earned_badges(mock_is_earned, sample_user_id):
    """Test evaluate_badges skips already earned badges"""
    mock_is_earned.return_value = True  # All badges already earned

    result = BadgeService.evaluate_badges(sample_user_id, 'post_create')

    assert result == []


@patch('app.services.gamification.badge_service.BadgeService._is_badge_earned')
@patch('app.services.gamification.badge_service.BadgeService._check_badge_eligibility')
def test_evaluate_badges_not_eligible(mock_check, mock_is_earned, sample_user_id):
    """Test evaluate_badges doesn't award badges when not eligible"""
    mock_is_earned.return_value = False
    mock_check.return_value = False  # User not eligible

    result = BadgeService.evaluate_badges(sample_user_id, 'some_action')

    assert result == []


# ==================== Recalculate User Badges Tests ====================

@patch('app.services.gamification.badge_service.BadgeService._is_badge_earned')
@patch('app.services.gamification.badge_service.BadgeService._check_badge_eligibility')
@patch('app.services.gamification.badge_service.BadgeService._award_badge')
def test_recalculate_user_badges(mock_award, mock_check, mock_is_earned, sample_user_id):
    """Test recalculate_user_badges recalculates all badges"""
    mock_is_earned.return_value = False  # No badges earned yet
    mock_check.return_value = True  # User eligible for all
    mock_award.return_value = True  # Awards succeed

    result = BadgeService.recalculate_user_badges(sample_user_id)

    assert len(result) > 0
    assert isinstance(result, list)


@patch('app.services.gamification.badge_service.BadgeService._is_badge_earned')
def test_recalculate_user_badges_skips_earned(mock_is_earned, sample_user_id):
    """Test recalculate_user_badges skips earned badges"""
    mock_is_earned.return_value = True  # All badges already earned

    result = BadgeService.recalculate_user_badges(sample_user_id)

    assert result == []
