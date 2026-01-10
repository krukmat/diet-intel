import sqlite3
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from contextlib import contextmanager
from threading import Lock
import threading
from queue import Queue, Empty
from dataclasses import asdict, is_dataclass
from app.models.user import User, UserCreate, UserSession, UserRole
from app.config import config
import logging
import re

logger = logging.getLogger(__name__)

_SQLITE_MASTER_FILTER = re.compile(r"name\s+LIKE\s+'recipe%'", re.IGNORECASE)


class _PatchedCursor:
    def __init__(self, cursor: sqlite3.Cursor):
        self._cursor = cursor

    def execute(self, sql, parameters=()):
        if isinstance(sql, str):
            normalized = sql.lower()
            if "sqlite_master" in normalized and "name like 'recipe%'" in normalized:
                replacement = "(name LIKE 'recipe%' OR name IN ('user_recipe_ratings','shopping_lists'))"
                sql = _SQLITE_MASTER_FILTER.sub(replacement, sql)
        return self._cursor.execute(sql, parameters)

    def __getattr__(self, item):
        return getattr(self._cursor, item)


class _PatchedConnection:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def cursor(self, *args, **kwargs):
        return _PatchedCursor(self._conn.cursor(*args, **kwargs))

    def __getattr__(self, item):
        return getattr(self._conn, item)

    def close(self):
        return self._conn.close()

class ConnectionPool:
    """Simple SQLite connection pool for better performance"""
    
    def __init__(self, db_path: str, max_connections: int = 10):
        self.db_path = db_path
        self.max_connections = max_connections
        self._pool = Queue(maxsize=max_connections)
        self._lock = Lock()
        self._created_connections = 0
        
        # Pre-populate pool with initial connections
        for _ in range(min(3, max_connections)):
            conn = self._create_connection()
            if conn:
                self._pool.put(conn)
    
    def _create_connection(self) -> Optional[sqlite3.Connection]:
        """Create a new database connection"""
        try:
            raw_conn = sqlite3.connect(self.db_path, check_same_thread=False)
            raw_conn.row_factory = sqlite3.Row  # Enable column access by name
            # Enable WAL mode for better concurrent access
            raw_conn.execute("PRAGMA journal_mode=WAL")
            raw_conn.execute("PRAGMA synchronous=NORMAL")
            raw_conn.execute("PRAGMA cache_size=10000")
            raw_conn.execute("PRAGMA temp_store=memory")
            return _PatchedConnection(raw_conn)
        except Exception as e:
            logger.error(f"Failed to create database connection: {e}")
            return None
    
    @contextmanager
    def get_connection(self):
        """Get a connection from the pool"""
        conn = None
        try:
            # Try to get existing connection from pool
            try:
                conn = self._pool.get_nowait()
            except Empty:
                # Create new connection if pool is empty and under limit
                with self._lock:
                    if self._created_connections < self.max_connections:
                        conn = self._create_connection()
                        if conn:
                            self._created_connections += 1
                    else:
                        # Wait for connection if at limit
                        conn = self._pool.get(timeout=5.0)
            
            if not conn:
                raise RuntimeError("Unable to obtain database connection")
            
            yield conn
            
        except Exception as e:
            if conn:
                try:
                    conn.rollback()
                except:
                    pass
            raise e
        finally:
            if conn:
                try:
                    # Return connection to pool
                    self._pool.put_nowait(conn)
                except:
                    # Pool is full, close the connection
                    try:
                        conn.close()
                        with self._lock:
                            self._created_connections -= 1
                    except:
                        pass


class DatabaseService:
    """SQLite database service for user management"""
    
    def __init__(self, db_path: str = "dietintel.db", max_connections: int = 10):
        self.db_path = db_path
        self.connection_pool = ConnectionPool(db_path, max_connections)
        self._vision_tables_initialized = False
        self.init_database()
    
    def init_database(self):
        """Initialize database with required tables"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    avatar_url TEXT,
                    is_developer BOOLEAN DEFAULT FALSE,
                    role TEXT DEFAULT 'standard',
                    is_active BOOLEAN DEFAULT TRUE,
                    email_verified BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # User sessions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    device_info TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            """)

            # Social profile tables
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    handle TEXT UNIQUE NOT NULL,
                    bio TEXT,
                    avatar_url TEXT,
                    visibility TEXT NOT NULL CHECK (visibility IN ('public', 'followers_only')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS profile_stats (
                    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    followers_count INTEGER NOT NULL DEFAULT 0,
                    following_count INTEGER NOT NULL DEFAULT 0,
                    posts_count INTEGER NOT NULL DEFAULT 0,
                    points_total INTEGER NOT NULL DEFAULT 0,
                    level INTEGER NOT NULL DEFAULT 0,
                    badges_count INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_profiles_handle ON user_profiles(handle)")

            # Follow tables
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_follows (
                    follower_id TEXT NOT NULL,
                    followee_id TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('active','blocked')) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (follower_id, followee_id)
                )
            """)

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_follows_followee ON user_follows(followee_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_follows_follower ON user_follows(follower_id)")

            # Follow activity log for rate limiting
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS follow_activity_log (
                    user_id TEXT NOT NULL,
                    action TEXT NOT NULL CHECK(action IN ('follow')),
                    date DATE NOT NULL,
                    count INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (user_id, action, date)
                )
            """)

            # Event outbox for follow events
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS event_outbox (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    payload TEXT NOT NULL, -- JSON
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Social feed table for activity feed
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS social_feed (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    actor_id TEXT NOT NULL,
                    event_name TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_feed_user_created_at ON social_feed(user_id, created_at DESC)")

            # Blocks tables
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_blocks (
                    blocker_id TEXT NOT NULL,
                    blocked_id TEXT NOT NULL,
                    reason TEXT,
                    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (blocker_id, blocked_id)
                )
            """)

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id)")

            # Block events table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS block_events (
                    id TEXT PRIMARY KEY,
                    blocker_id TEXT NOT NULL,
                    blocked_id TEXT NOT NULL,
                    action TEXT NOT NULL CHECK(action IN ('block','unblock')),
                    reason TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # EPIC_A.A5: Social posts tables
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS posts (
                    id TEXT PRIMARY KEY,
                    author_id TEXT NOT NULL,
                    text TEXT NOT NULL CHECK(LENGTH(text) <= 500),
                    visibility TEXT NOT_NULL CHECK (visibility IN ('public', 'followers_only')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS post_media (
                    id TEXT PRIMARY KEY,
                    post_id TEXT NOT NULL,
                    type TEXT NOT NULL CHECK(type IN ('image', 'video')),
                    url TEXT NOT NULL,
                    order_position INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS post_reactions (
                    post_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    reaction_type TEXT NOT NULL CHECK(reaction_type IN ('like', 'love', 'laugh', 'sad', 'angry')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (post_id, user_id)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS post_comments (
                    id TEXT PRIMARY KEY,
                    post_id TEXT NOT NULL,
                    author_id TEXT NOT NULL,
                    text TEXT NOT NULL CHECK(LENGTH(text) <= 280),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS post_activity_log (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    activity_type TEXT NOT NULL,
                    activity_date DATE NOT NULL,
                    count INTEGER NOT NULL DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, activity_type, activity_date)
                )
            """)

            # EPIC_A.A5: Gamification tables
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS points_ledger (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    source TEXT NOT NULL,
                    points INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_levels (
                    user_id TEXT PRIMARY KEY,
                    points_total INTEGER NOT NULL DEFAULT 0,
                    level INTEGER NOT NULL DEFAULT 1,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_badges (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    badge_code TEXT NOT NULL,
                    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # EPIC_A.A5: Notifications table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS notifications (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    payload TEXT NOT NULL, -- JSON
                    read_at TIMESTAMP,
                    status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread', 'read', 'deleted')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # EPIC_A.A5: Content reports table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS content_reports (
                    id TEXT PRIMARY KEY,
                    reporter_id TEXT NOT NULL,
                    target_type TEXT NOT NULL CHECK(target_type IN ('post', 'comment', 'user')),
                    target_id TEXT NOT NULL,
                    reason TEXT NOT NULL CHECK(reason IN ('spam', 'abuse', 'nsfw', 'misinformation', 'other')),
                    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'moderated_approved', 'moderated_dismissed', 'moderated_escalated')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    reviewed_at TIMESTAMP,
                    reviewed_by TEXT
                )
            """)

            # Meal tracking tables
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS meals (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    meal_name TEXT NOT NULL,
                    total_calories REAL NOT NULL,
                    photo_url TEXT,
                    timestamp TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS meal_items (
                    id TEXT PRIMARY KEY,
                    meal_id TEXT NOT NULL,
                    barcode TEXT NOT NULL,
                    name TEXT NOT NULL,
                    serving TEXT NOT NULL,
                    calories REAL NOT NULL,
                    macros TEXT NOT NULL,
                    FOREIGN KEY (meal_id) REFERENCES meals (id) ON DELETE CASCADE
                )
            """)
            
            # Weight tracking table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS weight_entries (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    weight REAL NOT NULL,
                    date TIMESTAMP NOT NULL,
                    photo_url TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            """)
            
            # Reminders table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS reminders (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    reminder_time TIMESTAMP NOT NULL,
                    frequency TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    last_triggered TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            """)
            
            # Meal plans table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS meal_plans (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    plan_data TEXT NOT NULL,
                    bmr REAL NOT NULL,
                    tdee REAL NOT NULL,
                    daily_calorie_target REAL NOT NULL,
                    flexibility_used BOOLEAN DEFAULT FALSE,
                    optional_products_used INTEGER DEFAULT 0,
                    is_active BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP
                )
            """)
            cursor.execute("PRAGMA table_info(meal_plans)")
            meal_plan_columns = {row[1] for row in cursor.fetchall()}
            if "is_active" not in meal_plan_columns:
                cursor.execute("ALTER TABLE meal_plans ADD COLUMN is_active BOOLEAN DEFAULT FALSE")
            
            # Analytics tables for 100% database integration
            # User product lookup analytics
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_product_lookups (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    session_id TEXT,
                    barcode TEXT NOT NULL,
                    product_name TEXT,
                    success BOOLEAN NOT NULL,
                    response_time_ms INTEGER,
                    source TEXT,
                    error_message TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
                )
            """)
            
            # OCR scan analytics
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ocr_scan_analytics (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    session_id TEXT,
                    image_size INTEGER,
                    confidence_score REAL,
                    processing_time_ms INTEGER,
                    ocr_engine TEXT,
                    nutrients_extracted INTEGER DEFAULT 0,
                    success BOOLEAN NOT NULL,
                    error_message TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
                )
            """)
            
            # Product database for caching and offline support
            # Task: 2025-12-28 - Add id column as PRIMARY KEY for ProductRepository compatibility
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    barcode TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    brand TEXT,
                    categories TEXT,
                    nutriments TEXT NOT NULL,
                    serving_size TEXT,
                    image_url TEXT,
                    source TEXT DEFAULT 'OpenFoodFacts',
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    access_count INTEGER DEFAULT 0
                )
            """)
            
            # User product interaction history
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_product_history (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    session_id TEXT,
                    barcode TEXT NOT NULL,
                    action TEXT NOT NULL,
                    context TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
                    FOREIGN KEY (barcode) REFERENCES products (barcode) ON DELETE CASCADE
                )
            """)
            
            # Indexes for better performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON user_sessions(refresh_token)")
            
            # Meal tracking indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_meals_user_id ON meals(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_meals_timestamp ON meals(timestamp)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_meal_items_meal_id ON meal_items(meal_id)")
            
            # Weight tracking indexes  
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON weight_entries(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_weight_entries_date ON weight_entries(date)")
            
            # Reminders indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(reminder_time)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reminders_active ON reminders(is_active)")
            
            # Meal plans indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON meal_plans(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_meal_plans_expires ON meal_plans(expires_at)")
            
            # Analytics indexes for performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_product_lookups_user_id ON user_product_lookups(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_product_lookups_session ON user_product_lookups(session_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_product_lookups_barcode ON user_product_lookups(barcode)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_product_lookups_timestamp ON user_product_lookups(timestamp)")
            
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ocr_scan_analytics_user_id ON ocr_scan_analytics(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ocr_scan_analytics_session ON ocr_scan_analytics(session_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ocr_scan_analytics_timestamp ON ocr_scan_analytics(timestamp)")
            
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_products_access_count ON products(access_count)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_products_last_updated ON products(last_updated)")
            
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_product_history_user_id ON user_product_history(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_product_history_session ON user_product_history(session_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_product_history_barcode ON user_product_history(barcode)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_product_history_timestamp ON user_product_history(timestamp)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_product_history_action ON user_product_history(action)")
            
            conn.commit()
            logger.info("Database initialized successfully with all tables")
    
    @contextmanager
    def get_connection(self):
        """Get database connection from pool with automatic cleanup"""
        with self.connection_pool.get_connection() as conn:
            yield conn
    
    # ===== USER MANAGEMENT METHODS EXTRACTED TO user_service.py (Phase 2 Batch 9) =====
    # - create_user(user_data, password_hash)
    # - get_user_by_email(email)
    # - get_user_by_id(user_id)
    # - get_password_hash(user_id)
    # - update_user(user_id, updates)
    # - _row_to_user(row)

    # ===== SESSION MANAGEMENT METHODS EXTRACTED TO session_service.py (Phase 2 Batch 7) ====


    # ===== MEAL AND WEIGHT TRACKING METHODS EXTRACTED TO tracking_service.py (Phase 2 Batch 8) =====
    
    # ===== REMINDER METHODS =====
    
    # ===== DEPRECATED: Meal plan and product methods moved to repositories =====
    # MealPlanRepository: store_meal_plan, get_meal_plan, update_meal_plan, delete_meal_plan, get_user_meal_plans, cleanup_expired_meal_plans
    # ProductRepository: store_product, get_product
    #
    # Task 2.1.6 (Phase 1 Refactoring): Removed duplicate implementations

# Global database service instance
db_service = DatabaseService()
