"""
Database Service Comprehensive Tests - Phase 5.1

Tests database service reliability, performance, and robustness.
Focuses on connection management, transaction integrity, and error recovery.

Target: Database service coverage 30% → 55% (+25 lines)
"""

import pytest
import sqlite3
import asyncio
import threading
import tempfile
import os
import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

from app.services.database import DatabaseService, db_service
from app.models.tracking import MealTrackingRequest, WeightTrackingRequest, MealItem
from app.models.reminder import ReminderRequest, ReminderType
from app.models.meal_plan import MealPlanResponse


class TestDatabaseConnectionManagement:
    """Test database connection handling and reliability"""
    
    def test_connection_pool_efficiency(self):
        """Test SQLite connection reuse and threading safety"""
        # Create temporary database for isolated testing
        with tempfile.NamedTemporaryFile(delete=False, suffix='.db') as tmp_file:
            temp_db_path = tmp_file.name
        
        try:
            # Initialize database service with temporary database
            test_service = DatabaseService(db_path=temp_db_path)
            
            # Test multiple concurrent connection requests
            connections_used = []
            
            def get_connection_info():
                with test_service.get_connection() as conn:
                    connections_used.append(id(conn))
                    # Simulate some work
                    cursor = conn.cursor()
                    cursor.execute("SELECT 1")
                    return cursor.fetchone()
            
            # Execute multiple concurrent operations
            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = [executor.submit(get_connection_info) for _ in range(10)]
                results = [future.result() for future in futures]
            
            # Verify all operations completed successfully
            assert all(result[0] == 1 for result in results), f"Unexpected results: {results}"
            assert len(results) == 10
            
            # Verify connections were properly managed
            assert len(connections_used) == 10
            
        finally:
            # Cleanup temporary database
            if os.path.exists(temp_db_path):
                os.unlink(temp_db_path)
    
    def test_connection_recovery_logic(self):
        """Test database recovery from connection failures"""
        with tempfile.NamedTemporaryFile(delete=False, suffix='.db') as tmp_file:
            temp_db_path = tmp_file.name
        
        try:
            test_service = DatabaseService(db_path=temp_db_path)
            
            # Test normal operation first
            with test_service.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM users")
                initial_count = cursor.fetchone()[0]
            
            # Simulate database file corruption by making it read-only
            os.chmod(temp_db_path, 0o444)
            
            # Attempt operation that should fail
            with pytest.raises((sqlite3.OperationalError, PermissionError)):
                with test_service.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("INSERT INTO users VALUES ('test', 'test@example.com', 'hash', 'Test', NULL, 0, 'standard', 1, 0, datetime('now'), datetime('now'))")
            
            # Restore write permissions
            os.chmod(temp_db_path, 0o644)
            
            # Verify recovery - should work again
            with test_service.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM users")
                recovered_count = cursor.fetchone()[0]
                assert recovered_count == initial_count
            
        finally:
            # Restore permissions and cleanup
            if os.path.exists(temp_db_path):
                os.chmod(temp_db_path, 0o644)
                os.unlink(temp_db_path)
    
    def test_database_lock_handling(self):
        """Test SQLite database locking in concurrent scenarios"""
        with tempfile.NamedTemporaryFile(delete=False, suffix='.db') as tmp_file:
            temp_db_path = tmp_file.name
        
        try:
            test_service = DatabaseService(db_path=temp_db_path)
            
            # Test concurrent write operations
            def write_operation(user_id):
                try:
                    with test_service.get_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute("""
                            INSERT OR REPLACE INTO users 
                            VALUES (?, ?, ?, ?, NULL, 0, 'standard', 1, 0, datetime('now'), datetime('now'))
                        """, (user_id, f"{user_id}@example.com", "hash", f"User {user_id}"))
                        conn.commit()
                        return True
                except sqlite3.OperationalError as e:
                    if "database is locked" in str(e):
                        return False
                    raise
            
            # Execute concurrent write operations
            with ThreadPoolExecutor(max_workers=3) as executor:
                user_ids = [f"user_{i}" for i in range(5)]
                futures = [executor.submit(write_operation, user_id) for user_id in user_ids]
                results = [future.result() for future in futures]
            
            # Verify most operations succeeded (some might fail due to locking)
            successful_operations = sum(results)
            assert successful_operations >= 3  # At least 3 out of 5 should succeed
            
            # Verify data integrity - check actual records created
            with test_service.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM users WHERE id LIKE 'user_%'")
                user_count = cursor.fetchone()[0]
                assert user_count == successful_operations
            
        finally:
            if os.path.exists(temp_db_path):
                os.unlink(temp_db_path)


class TestDatabaseTransactionIntegrity:
    """Test transaction rollback and data consistency"""
    
    @pytest.fixture
    def temp_db_service(self):
        """Create temporary database service for testing"""
        with tempfile.NamedTemporaryFile(delete=False, suffix='.db') as tmp_file:
            temp_db_path = tmp_file.name
        
        test_service = DatabaseService(db_path=temp_db_path)
        yield test_service
        
        # Cleanup
        if os.path.exists(temp_db_path):
            os.unlink(temp_db_path)
    
    def test_transaction_rollback_scenarios(self, temp_db_service):
        """Test transaction rollback on errors"""
        # Create a test user first
        user_id = "test_user_rollback"
        
        # Test meal creation with intentional failure
        meal_request = MealTrackingRequest(
            meal_name="Test Meal",
            items=[
                MealItem(
                    barcode="test123",
                    name="Test Food",
                    serving="100g",
                    calories=200.0,
                    macros={"protein": 10.0, "fat": 5.0, "carbs": 20.0}
                )
            ],
            timestamp=datetime.now().isoformat()
        )
        
        # Mock create_meal to simulate partial failure
        original_get_connection = temp_db_service.get_connection
        
        def failing_connection():
            conn = original_get_connection()
            
            # Mock execute to fail after first insert
            original_execute = conn.execute
            execute_count = [0]
            
            def counting_execute(*args, **kwargs):
                execute_count[0] += 1
                if execute_count[0] > 2:  # Fail after a few operations
                    raise sqlite3.IntegrityError("Simulated failure")
                return original_execute(*args, **kwargs)
            
            conn.execute = counting_execute
            return conn
        
        # Test that partial failure doesn't leave inconsistent data
        with patch.object(temp_db_service, 'get_connection', failing_connection):
            try:
                # This should fail and rollback
                asyncio.run(temp_db_service.create_meal(user_id, meal_request))
                assert False, "Expected operation to fail"
            except sqlite3.IntegrityError:
                pass  # Expected failure
        
        # Verify no partial data was left behind
        with temp_db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM meals WHERE user_id = ?", (user_id,))
            meal_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM meal_items")
            item_count = cursor.fetchone()[0]
            
            # Should have no orphaned data
            assert meal_count == 0
            assert item_count == 0
    
    def test_atomic_operations_validation(self, temp_db_service):
        """Test complex multi-table operations"""
        user_id = "test_user_atomic"
        
        # Test meal creation (involves meals + meal_items tables)
        meal_request = MealTrackingRequest(
            meal_name="Atomic Test Meal",
            items=[
                MealItem(
                    barcode="atomic1",
                    name="Food 1",
                    serving="100g",
                    calories=150.0,
                    macros={"protein": 8.0, "fat": 3.0, "carbs": 15.0}
                ),
                MealItem(
                    barcode="atomic2",
                    name="Food 2",
                    serving="50g",
                    calories=100.0,
                    macros={"protein": 5.0, "fat": 2.0, "carbs": 10.0}
                )
            ],
            timestamp=datetime.now().isoformat()
        )
        
        # Perform atomic operation
        meal_id = asyncio.run(temp_db_service.create_meal(user_id, meal_request))
        
        # Verify both tables were updated consistently
        with temp_db_service.get_connection() as conn:
            cursor = conn.cursor()
            
            # Check meal record
            cursor.execute("SELECT * FROM meals WHERE id = ?", (meal_id,))
            meal_record = cursor.fetchone()
            assert meal_record is not None
            assert meal_record[1] == user_id  # user_id
            assert meal_record[2] == "Atomic Test Meal"  # meal_name
            assert meal_record[4] == 250.0  # total_calories
            
            # Check meal items
            cursor.execute("SELECT COUNT(*) FROM meal_items WHERE meal_id = ?", (meal_id,))
            item_count = cursor.fetchone()[0]
            assert item_count == 2
            
            # Verify foreign key integrity
            cursor.execute("""
                SELECT mi.name, mi.calories 
                FROM meal_items mi 
                WHERE mi.meal_id = ? 
                ORDER BY mi.calories
            """, (meal_id,))
            items = cursor.fetchall()
            assert len(items) == 2
            assert items[0][0] == "Food 2"  # 100 calories
            assert items[1][0] == "Food 1"  # 150 calories


class TestDatabasePerformance:
    """Test database performance and optimization"""
    
    @pytest.fixture
    def temp_db_service(self):
        """Create temporary database service for testing"""
        with tempfile.NamedTemporaryFile(delete=False, suffix='.db') as tmp_file:
            temp_db_path = tmp_file.name
        
        test_service = DatabaseService(db_path=temp_db_path)
        yield test_service
        
        # Cleanup
        if os.path.exists(temp_db_path):
            os.unlink(temp_db_path)
    
    def test_query_optimization_paths(self, temp_db_service):
        """Test database query performance with indexes"""
        user_id = "perf_test_user"
        
        # Create multiple meals for performance testing
        meals_created = []
        for i in range(50):
            meal_request = MealTrackingRequest(
                meal_name=f"Performance Test Meal {i}",
                items=[
                    MealItem(
                        barcode=f"perf_{i}",
                        name=f"Food {i}",
                        serving="100g",
                        calories=100.0 + i,
                        macros={"protein": 5.0, "fat": 2.0, "carbs": 10.0}
                    )
                ],
                timestamp=datetime.now().isoformat() - timedelta(days=i)
            )
            
            meal_id = asyncio.run(temp_db_service.create_meal(user_id, meal_request))
            meals_created.append(meal_id)
        
        # Test query performance with timing
        
        # Query with user_id (should use index)
        start_time = time.time()
        user_meals = asyncio.run(temp_db_service.get_user_meals(user_id, limit=25))
        indexed_query_time = time.time() - start_time
        
        assert len(user_meals) == 25
        assert indexed_query_time < 0.1  # Should be fast with index
        
        # Verify query results are properly ordered (most recent first)
        meal_dates = [meal['created_at'] for meal in user_meals]
        for i in range(1, len(meal_dates)):
            assert meal_dates[i-1] >= meal_dates[i], "Meals should be ordered by creation date DESC"
    
    def test_bulk_operation_efficiency(self, temp_db_service):
        """Test bulk data operations performance"""
        user_id = "bulk_test_user"
        
        # Test bulk meal creation
        start_time = time.time()
        
        # Create meals in sequence (simulating bulk operations)
        meal_ids = []
        for i in range(20):
            meal_request = MealTrackingRequest(
                meal_name=f"Bulk Meal {i}",
                items=[
                    MealItem(
                        barcode=f"bulk_{i}_1",
                        name=f"Bulk Food {i}A",
                        serving="100g",
                        calories=150.0,
                        macros={"protein": 8.0, "fat": 3.0, "carbs": 15.0}
                    ),
                    MealItem(
                        barcode=f"bulk_{i}_2",
                        name=f"Bulk Food {i}B",
                        serving="50g",
                        calories=75.0,
                        macros={"protein": 4.0, "fat": 2.0, "carbs": 8.0}
                    )
                ],
                timestamp=datetime.now().isoformat()
            )
            
            meal_id = asyncio.run(temp_db_service.create_meal(user_id, meal_request))
            meal_ids.append(meal_id)
        
        bulk_creation_time = time.time() - start_time
        
        # Verify all meals were created
        assert len(meal_ids) == 20
        
        # Test bulk retrieval performance
        start_time = time.time()
        all_meals = asyncio.run(temp_db_service.get_user_meals(user_id, limit=50))
        bulk_retrieval_time = time.time() - start_time
        
        assert len(all_meals) == 20
        
        # Performance benchmarks (reasonable for SQLite)
        assert bulk_creation_time < 2.0  # 20 meals in under 2 seconds
        assert bulk_retrieval_time < 0.1  # Retrieval should be very fast
        
        # Verify data integrity in bulk operations
        total_items = 0
        for meal in all_meals:
            total_items += len(meal['items'])
        
        assert total_items == 40  # 20 meals × 2 items each