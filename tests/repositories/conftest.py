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

    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            avatar_url TEXT,
            is_developer INTEGER DEFAULT 0,
            role TEXT DEFAULT 'standard',
            is_active INTEGER DEFAULT 1,
            email_verified INTEGER DEFAULT 0,
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

    conn.commit()


@pytest.fixture
def test_db_path():
    """Create temporary test database"""
    # Create a temporary file
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    yield db_path

    # Cleanup
    if os.path.exists(db_path):
        os.unlink(db_path)


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


@pytest.fixture
def mock_connection_manager(test_db_path):
    """Create ConnectionManager with test database (fresh for each test)"""
    # Create a fresh database for this test
    conn = sqlite3.connect(test_db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row

    create_test_tables(conn)
    conn.close()

    # Create and return the connection manager
    manager = ConnectionManager(test_db_path)

    yield manager

    # Cleanup: database file is cleaned up by test_db_path fixture
