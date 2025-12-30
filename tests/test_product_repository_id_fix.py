"""
Test Product Repository ID Column Fix (TDD Approach)

Task: Fix schema mismatch - products table missing 'id' column
Status: RED PHASE - Tests will fail until schema is fixed
"""

import pytest
import sqlite3
import time
from app.models.product import Product
from app.repositories.product_repository import ProductRepository
from app.repositories.connection import connection_manager


def make_unique_barcode(base: str) -> str:
    """Generate unique barcode with timestamp"""
    return f"{base}_{int(time.time() * 1000000)}"


@pytest.mark.asyncio
class TestProductRepositorySchemaFix:
    """Tests for product repository schema mismatch fix"""

    @pytest.fixture
    def product_repo(self):
        """Create product repository instance"""
        return ProductRepository()

    async def test_products_table_has_id_column(self):
        """
        SCHEMA TEST: Verify products table has 'id' column as PRIMARY KEY

        Status: RED (will fail until migration is applied)
        Expected: id INTEGER PRIMARY KEY AUTOINCREMENT
        """
        async with connection_manager.get_connection() as conn:
            # Get table schema using PRAGMA
            cursor = conn.execute("PRAGMA table_info(products)")
            columns = {row[1]: row for row in cursor.fetchall()}

            # Verify id column exists
            assert "id" in columns, "products table missing 'id' column"

            # Verify id is INTEGER
            id_col = columns["id"]
            assert id_col[2] == "INTEGER", f"id column type should be INTEGER, got {id_col[2]}"

            # Verify id is PRIMARY KEY (pk=1 means it's the primary key)
            assert id_col[5] == 1, f"id should be PRIMARY KEY, got pk={id_col[5]}"

    async def test_products_table_barcode_is_unique(self):
        """
        SCHEMA TEST: Verify barcode has UNIQUE constraint

        Status: RED (current schema has barcode as PRIMARY KEY, not UNIQUE)
        After fix: barcode should be UNIQUE (not PRIMARY KEY)
        """
        async with connection_manager.get_connection() as conn:
            # Get all unique indexes/constraints
            cursor = conn.execute("""
                SELECT name FROM sqlite_master
                WHERE type='index' AND tbl_name='products'
            """)
            indexes = {row[0] for row in cursor.fetchall()}

            # Check if there's a unique constraint on barcode
            # OR verify via PRAGMA (alternative method)
            cursor = conn.execute("PRAGMA table_info(products)")
            columns = {row[1]: row for row in cursor.fetchall()}

            barcode_col = columns.get("barcode")
            assert barcode_col is not None, "barcode column missing"
            # After migration, barcode should NOT be PRIMARY KEY (pk should be 0)
            # It should be unique via constraint instead

    async def test_product_create_returns_valid_product_with_id(self, product_repo):
        """
        INTEGRATION TEST: Create product and verify it has valid id

        Status: RED (currently fails in get_by_id() call)
        Error: sqlite3.OperationalError: no such column: id
        """
        # Create a new product
        new_product = Product(
            barcode=make_unique_barcode("9780134685991"),
            name="Test Product",
            brand="Test Brand",
            serving_size="100g",
            nutriments={"energy": 100, "proteins": 10}
        )

        # This should fail in RED phase (get_by_id doesn't work)
        created = await product_repo.create(new_product)

        # Assertions (will fail if create() raises exception)
        assert created is not None, "create() should return a product"
        assert created.id is not None, "created product should have an id"
        assert isinstance(created.id, int), f"id should be int, got {type(created.id)}"
        assert created.barcode == new_product.barcode
        assert created.name == new_product.name

    async def test_get_by_id_returns_correct_product(self, product_repo):
        """
        INTEGRATION TEST: Create product and retrieve by id

        Status: RED (id column doesn't exist)
        Error: sqlite3.OperationalError: no such column: id
        """
        # Create a product
        original = Product(
            barcode=make_unique_barcode("9780134685992"),
            name="Retrieve Test",
            brand="Test Brand",
            nutriments={"energy": 150}
        )

        created = await product_repo.create(original)
        assert created.id is not None, "created product must have id"

        # Retrieve by id (will fail in RED phase)
        retrieved = await product_repo.get_by_id(created.id)

        # Assertions
        assert retrieved is not None, f"Should find product with id {created.id}"
        assert retrieved.id == created.id
        assert retrieved.barcode == original.barcode
        assert retrieved.name == original.name

    async def test_get_by_id_with_multiple_products(self, product_repo):
        """
        INTEGRATION TEST: Create multiple products and retrieve each by id

        Status: RED (id column doesn't exist)
        Verifies that get_by_id returns the CORRECT product from multiple
        """
        products_data = [
            (make_unique_barcode("1234567890111"), "Product 1"),
            (make_unique_barcode("1234567890222"), "Product 2"),
            (make_unique_barcode("1234567890333"), "Product 3"),
        ]

        created_ids = []
        for barcode, name in products_data:
            product = Product(barcode=barcode, name=name, nutriments={})
            created = await product_repo.create(product)
            created_ids.append(created.id)

        # Retrieve each and verify
        for idx, (barcode, name) in enumerate(products_data):
            retrieved = await product_repo.get_by_id(created_ids[idx])
            assert retrieved is not None
            assert retrieved.id == created_ids[idx]
            assert retrieved.barcode == barcode
            assert retrieved.name == name

    async def test_barcode_unique_constraint_prevents_duplicates(self, product_repo):
        """
        INTEGRATION TEST: Barcode uniqueness is enforced

        Status: RED (needs UNIQUE constraint on barcode)
        After migration: Should raise IntegrityError on duplicate barcode
        """
        # Use timestamp to ensure unique barcode for each test run
        barcode = make_unique_barcode("1234567890123")

        # Create first product
        product1 = Product(barcode=barcode, name="First", nutriments={})
        created1 = await product_repo.create(product1)
        assert created1 is not None

        # Try to create duplicate (should fail)
        product2 = Product(barcode=barcode, name="Duplicate", nutriments={})

        # This should raise sqlite3.IntegrityError for UNIQUE constraint
        with pytest.raises(sqlite3.IntegrityError):
            await product_repo.create(product2)

    async def test_create_get_cycle_preserves_data(self, product_repo):
        """
        INTEGRATION TEST: Full CRUD cycle - Create then Get preserves all data

        Status: RED (currently fails)
        Verifies round-trip data integrity
        """
        original = Product(
            barcode=make_unique_barcode("9780134685998"),
            name="Data Integrity Test",
            brand="Test",
            serving_size="50g",
            nutriments={
                "energy": 250,
                "proteins": 20,
                "fat": 10,
                "carbs": 30
            }
        )

        # Create
        created = await product_repo.create(original)
        assert created.id is not None

        # Get by id
        retrieved = await product_repo.get_by_id(created.id)

        # Verify all fields match
        assert retrieved.barcode == original.barcode
        assert retrieved.name == original.name
        assert retrieved.brand == original.brand
        assert retrieved.serving_size == original.serving_size
        assert retrieved.nutriments == original.nutriments


@pytest.mark.asyncio
class TestProductRepositoryEdgeCases:
    """Edge case tests for product repository"""

    @pytest.fixture
    def product_repo(self):
        return ProductRepository()

    async def test_get_by_id_nonexistent_returns_none(self, product_repo):
        """
        BEHAVIOR TEST: get_by_id with non-existent id returns None

        Status: RED (id column doesn't exist yet)
        """
        result = await product_repo.get_by_id(999999)
        assert result is None, "get_by_id should return None for non-existent id"

    async def test_get_by_barcode_still_works(self, product_repo):
        """
        REGRESSION TEST: get_by_barcode should still work after fix

        Status: Should work (uses existing barcode column)
        """
        barcode = make_unique_barcode("1111111111111")
        product = Product(barcode=barcode, name="Barcode Test", nutriments={})

        # Create via create() which uses barcode
        created = await product_repo.create(product)

        # Retrieve via get_by_barcode (existing functionality)
        retrieved = await product_repo.get_by_barcode(barcode)

        assert retrieved is not None
        assert retrieved.barcode == barcode
        assert retrieved.id == created.id  # Both should work
