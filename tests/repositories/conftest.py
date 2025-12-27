"""
Fixtures for repository tests
Sets up test database with real SQLite connections
Task 2.1.1.1: Test fixtures for repositories
"""
import pytest
import sqlite3
import tempfile
import os
from pathlib import Path
from app.repositories.connection import ConnectionManager


def create_test_tables(conn):
    """Create all required tables in the database"""
    cursor = conn.cursor()

    # Users table - Task 2.1.5: Fixed schema to match actual database (TEXT PRIMARY KEY for UUID)
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

    # Meal plans table (matches actual schema from dietintel.db)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS meal_plans (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            plan_data TEXT NOT NULL,
            bmr REAL NOT NULL,
            tdee REAL NOT NULL,
            daily_calorie_target REAL NOT NULL,
            flexibility_used INTEGER DEFAULT 0,
            optional_products_used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP
        )
    """)

    # Meals table (for tracking)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS meals (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            meal_name TEXT NOT NULL,
            total_calories REAL NOT NULL,
            photo_url TEXT,
            timestamp TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    # Meal items table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS meal_items (
            id TEXT PRIMARY KEY,
            meal_id TEXT NOT NULL,
            barcode TEXT,
            name TEXT NOT NULL,
            serving TEXT,
            calories REAL NOT NULL,
            macros TEXT,
            FOREIGN KEY (meal_id) REFERENCES meals(id)
        )
    """)

    # Weight entries table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS weight_entries (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            weight REAL NOT NULL,
            date TEXT NOT NULL,
            photo_url TEXT,
            created_at TEXT NOT NULL
        )
    """)

    # Reminders table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            reminder_time TEXT NOT NULL,
            frequency TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            last_triggered TEXT,
            created_at TEXT NOT NULL
        )
    """)

    # Products table (Task 2.1.5)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barcode TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            brand TEXT,
            serving_size TEXT DEFAULT '100g',
            nutriments TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()


@pytest.fixture
def test_db_path():
    """Create temporary test database"""
    # Create a temporary file with unique name per test - Task 2.1.5
    fd, db_path = tempfile.mkstemp(suffix=".db", prefix="test_db_")
    os.close(fd)

    # Remove the file so SQLite creates a fresh one
    if os.path.exists(db_path):
        os.unlink(db_path)

    yield db_path

    # Cleanup: remove database and WAL files
    for ext in ['', '-wal', '-shm']:
        file_path = db_path + ext
        if os.path.exists(file_path):
            try:
                os.unlink(file_path)
            except OSError:
                pass  # File might already be deleted


@pytest.fixture
def connection_manager_test(test_db_path):
    """Create connection manager with test database"""
    return ConnectionManager(test_db_path)


@pytest.fixture
def test_db(test_db_path):
    """Create database with all required tables"""
    conn = sqlite3.connect(test_db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row

    create_test_tables(conn)

    yield conn

    # Cleanup
    conn.close()


def cleanup_test_tables(conn):
    """Clean all data from test tables - Task 2.1.5"""
    cursor = conn.cursor()
    tables = [
        'meal_items', 'meals', 'weight_entries', 'reminders',
        'meal_plans', 'products', 'users'
    ]
    for table in tables:
        cursor.execute(f"DELETE FROM {table}")
    conn.commit()
    # Task 2.1.5: Force WAL checkpoint to ensure changes are visible to all connections
    conn.execute("PRAGMA wal_checkpoint(FULL)")
    conn.commit()


@pytest.fixture
def mock_connection_manager(test_db_path, monkeypatch):
    """Create ConnectionManager with test database (fresh for each test)"""
    # Create a fresh database for this test
    conn = sqlite3.connect(test_db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row

    create_test_tables(conn)
    # Task 2.1.5: Ensure database is completely empty before each test
    cleanup_test_tables(conn)
    conn.close()

    # Create and return the connection manager
    manager = ConnectionManager(test_db_path)

    # CRITICAL FIX (Task 2.1.5): Patch connection_manager in ALL repository modules
    # Repositories import connection_manager at module level, so we need to patch where it's used
    from app.repositories import connection
    monkeypatch.setattr(connection, 'connection_manager', manager)

    # Patch in each repository module that imports connection_manager
    from app.repositories import product_repository, user_repository
    monkeypatch.setattr(product_repository, 'connection_manager', manager)
    monkeypatch.setattr(user_repository, 'connection_manager', manager)

    yield manager

    # Cleanup after test: truncate all tables to prevent data leakage
    conn = sqlite3.connect(test_db_path, check_same_thread=False)
    cleanup_test_tables(conn)
    conn.close()
    # Cleanup: database file is cleaned up by test_db_path fixture
