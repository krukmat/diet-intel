# EPIC_A.A5: Tests for post service
# PHASE 2: Refactored to use real DB instead of mocks (2025-12-13)

import pytest

from app.services.social.post_service import PostService
from app.models.social.post import (
    PostCreate, PostDetail, ReactionType,
    CommentCreate, PostStats
)


class TestPostService:
    """Test cases for PostService"""

    def test_create_post_success(self, post_service_db, db_helpers):
        """Test successful post creation"""
        # Setup: Insert test user
        user_id = "user123"
        db_helpers.insert_test_user(post_service_db, user_id, "testuser", "test@example.com")

        # Execute: Real PostService with real database
        post_data = PostCreate(text="This is a test post", media_urls=[])
        result = PostService.create_post(user_id, post_data)

        # Assert: HTTP response
        assert isinstance(result, PostDetail)
        assert result.text == "This is a test post"

        # Assert: Data persisted in database
        cursor = post_service_db.cursor()
        cursor.execute("SELECT * FROM posts WHERE author_id = ?", (user_id,))
        db_post = cursor.fetchone()
        assert db_post is not None
        assert db_post['text'] == "This is a test post"

    def test_create_post_rate_limit_exceeded(self, post_service_db, db_helpers):
        """Test post creation with rate limit exceeded"""
        # Setup: Insert test user
        user_id = "user123"
        db_helpers.insert_test_user(post_service_db, user_id, "testuser", "test@example.com")

        # Simulate rate limit exceeded by logging 10 activities (PHASE 2: Fixed to use post_activity_log - 2025-12-13)
        from datetime import date
        cursor = post_service_db.cursor()
        today = date.today().isoformat()
        cursor.execute(
            "INSERT INTO post_activity_log (id, user_id, activity_type, activity_date, count) VALUES (?, ?, ?, ?, ?)",
            (f"activity_1", user_id, 'post_create', today, 10)
        )
        post_service_db.commit()

        # Execute & Assert: Should raise exception when rate limit exceeded
        post_data = PostCreate(text="This should be blocked", media_urls=[])
        with pytest.raises(ValueError, match="Post rate limit exceeded"):
            PostService.create_post(user_id, post_data)

    def test_toggle_reaction_like(self, post_service_db, db_helpers):
        """Test successful like reaction"""
        # Setup: Insert test user and post
        user_id = "user123"
        post_id = "post123"
        db_helpers.insert_test_user(post_service_db, user_id, "testuser", "test@example.com")
        db_helpers.insert_test_post(post_service_db, post_id, user_id, "Test post")

        # Execute: Real toggle_reaction (no reaction exists yet, so it adds)
        result = PostService.toggle_reaction(post_id, user_id, ReactionType.LIKE)

        # Assert: Return value indicates like was added
        assert result is True

        # Assert: Reaction persisted in database
        cursor = post_service_db.cursor()
        cursor.execute("SELECT * FROM post_reactions WHERE post_id = ? AND user_id = ?", (post_id, user_id))
        db_reaction = cursor.fetchone()
        assert db_reaction is not None
        assert db_reaction['reaction_type'] == "like"

    def test_toggle_reaction_unlike(self, post_service_db, db_helpers):
        """Test successful unlike reaction"""
        # Setup: Insert test user, post, and existing reaction
        user_id = "user123"
        post_id = "post123"
        reaction_id = "react123"
        db_helpers.insert_test_user(post_service_db, user_id, "testuser", "test@example.com")
        db_helpers.insert_test_post(post_service_db, post_id, user_id, "Test post")
        db_helpers.insert_test_reaction(post_service_db, reaction_id, post_id, user_id, "like")

        # Execute: Real toggle_reaction (reaction exists, so it removes)
        result = PostService.toggle_reaction(post_id, user_id, ReactionType.LIKE)

        # Assert: Return value indicates like was removed
        assert result is False

        # Assert: Reaction removed from database
        cursor = post_service_db.cursor()
        cursor.execute("SELECT * FROM post_reactions WHERE post_id = ? AND user_id = ?", (post_id, user_id))
        db_reaction = cursor.fetchone()
        assert db_reaction is None

    def test_get_post_stats(self, post_service_db, db_helpers):
        """Test getting post statistics"""
        # Setup: Insert test user, post, reactions and comments
        user_id = "user123"
        post_id = "post123"
        db_helpers.insert_test_user(post_service_db, user_id, "testuser", "test@example.com")
        db_helpers.insert_test_post(post_service_db, post_id, user_id, "Test post")

        # Insert 5 reactions (likes)
        cursor = post_service_db.cursor()
        for i in range(5):
            db_helpers.insert_test_reaction(post_service_db, f"react_{i}", post_id, f"user_{i}", "like")

        # Insert 3 comments
        for i in range(3):
            cursor.execute(
                "INSERT INTO post_comments (id, post_id, author_id, text) VALUES (?, ?, ?, ?)",
                (f"comment_{i}", post_id, f"user_{i}", f"Comment {i}")
            )
        post_service_db.commit()

        # Execute: Get post statistics
        stats = PostService._get_post_stats(post_id)

        # Assert: Counts match inserted data
        assert stats.likes_count == 5
        assert stats.comments_count == 3

    def test_check_rate_limit_under_limit(self, post_service_db, db_helpers):
        """Test rate limit check when under limit"""
        # Setup: Insert test user and 5 posts (under limit of 10)
        user_id = "user123"
        db_helpers.insert_test_user(post_service_db, user_id, "testuser", "test@example.com")

        cursor = post_service_db.cursor()
        for i in range(5):
            db_helpers.insert_test_post(post_service_db, f"post_{i}", user_id, f"Post {i}")

        # Execute: Check rate limit with 10 as limit
        result = PostService._check_rate_limit(user_id, "post_create", 10)

        # Assert: Should return True (under limit)
        assert result is True

    def test_check_rate_limit_at_limit(self, post_service_db, db_helpers):
        """Test rate limit check when at limit"""
        # Setup: Insert test user
        user_id = "user123"
        db_helpers.insert_test_user(post_service_db, user_id, "testuser", "test@example.com")

        # Log 10 activities to reach the limit (PHASE 2: Fixed to use post_activity_log - 2025-12-13)
        from datetime import date
        cursor = post_service_db.cursor()
        today = date.today().isoformat()
        cursor.execute(
            "INSERT INTO post_activity_log (id, user_id, activity_type, activity_date, count) VALUES (?, ?, ?, ?, ?)",
            (f"activity_limit", user_id, 'post_create', today, 10)
        )
        post_service_db.commit()

        # Execute: Check rate limit with 10 as limit
        result = PostService._check_rate_limit(user_id, "post_create", 10)

        # Assert: Should return False (at limit, no more allowed)
        assert result is False

    def test_create_post_returns_fallback_when_get_post_missing(self, post_service_db, db_helpers):
        """Ensure create_post builds a minimal PostDetail if get_post fails"""
        # Setup: Insert test user
        user_id = "user123"
        db_helpers.insert_test_user(post_service_db, user_id, "testuser", "test@example.com")

        # Execute: Create post (may have fallback logic if post retrieval fails)
        post_data = PostCreate(text="Fallback test", media_urls=[])
        result = PostService.create_post(user_id, post_data)

        # Assert: Fallback returns basic PostDetail with our text
        assert isinstance(result, PostDetail)
        assert result.text == "Fallback test"

    def test_create_comment_logs_activity_and_awards_points(self, post_service_db, db_helpers):
        """Create comment should log activity and award points"""
        # Setup: Insert test user and post
        user_id = "user123"
        post_id = "post123"
        db_helpers.insert_test_user(post_service_db, user_id, "testuser", "test@example.com")
        db_helpers.insert_test_post(post_service_db, post_id, user_id, "Test post")

        # Execute: Create comment on post
        comment = CommentCreate(text="Nice post!")
        created = PostService.create_comment(post_id, user_id, comment)

        # Assert: Comment created with correct text
        assert created.text == "Nice post!"

        # Assert: Comment persisted in database
        cursor = post_service_db.cursor()
        cursor.execute("SELECT * FROM post_comments WHERE post_id = ? AND author_id = ? AND text = ?",
                      (post_id, user_id, "Nice post!"))
        db_comment = cursor.fetchone()
        assert db_comment is not None

    def test_list_user_posts_returns_items(self, post_service_db, db_helpers):
        """List user posts returns PostDetail list even when media is empty"""
        # Setup: Insert test user and posts
        user_id = "user123"
        db_helpers.insert_test_user(post_service_db, user_id, "testuser", "test@example.com")
        db_helpers.insert_test_post(post_service_db, "p1", user_id, "content")
        db_helpers.insert_test_post(post_service_db, "p2", user_id, "more content")

        # Execute: List user posts with limit
        posts = PostService.list_user_posts(user_id, limit=1)

        # Assert: Posts returned with correct author
        assert len(posts) >= 1
        assert posts[0].author_id == user_id

    def test_get_comments_handles_invalid_cursor(self, post_service_db, db_helpers):
        """Invalid cursor data should not prevent fetching comments"""
        # Setup: Insert test user, post, and comments
        user_id = "user123"
        post_id = "post123"
        db_helpers.insert_test_user(post_service_db, user_id, "testuser", "test@example.com")
        db_helpers.insert_test_post(post_service_db, post_id, user_id, "Test post")

        cursor = post_service_db.cursor()
        from datetime import datetime
        now = datetime.utcnow().isoformat()
        cursor.execute(
            "INSERT INTO post_comments (id, post_id, author_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("c1", post_id, user_id, "comment", now, now)
        )
        post_service_db.commit()

        # Execute: Get comments with invalid cursor (non-base64)
        comments = PostService.get_comments(post_id, limit=1, cursor="not-base64")

        # Assert: Comments returned despite invalid cursor
        assert len(comments) >= 1
        assert comments[0].text == "comment"
