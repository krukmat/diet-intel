"""
Product Repository for CRUD operations
Replaces product-related functions from database.py
Task 2.1.5: Added JSON serialization for nutriments
"""
import logging
import json
from typing import Optional, List, Dict, Any
from app.repositories.base import Repository
from app.repositories.connection import connection_manager
from app.models.product import Product

logger = logging.getLogger(__name__)


class ProductRepository(Repository[Product]):
    """Repository for Product entity"""

    def __init__(self):
        """Initialize ProductRepository (uses connection_manager, not db_path)"""
        self.logger = logging.getLogger(self.__class__.__name__)

    def get_table_name(self) -> str:
        """Return table name"""
        return "products"

    def row_to_entity(self, row: Dict[str, Any]) -> Product:
        """Convert database row to Product model"""
        # Parse nutriments JSON if it's a string
        nutriments = row.get("nutriments", {})
        if isinstance(nutriments, str):
            try:
                nutriments = json.loads(nutriments)
            except (json.JSONDecodeError, TypeError):
                nutriments = {}

        return Product(
            id=row.get("id"),
            barcode=row["barcode"],
            name=row["name"],
            brand=row.get("brand"),
            serving_size=row.get("serving_size"),
            nutriments=nutriments
        )

    def entity_to_dict(self, entity: Product) -> Dict[str, Any]:
        """Convert Product to dict for database"""
        return {
            "barcode": entity.barcode,
            "name": entity.name,
            "brand": entity.brand or "",
            "serving_size": entity.serving_size or "100g",
            "nutriments": entity.nutriments or {}
        }

    async def get_by_id(self, product_id: int) -> Optional[Product]:
        """Get product by ID"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM products WHERE id = ?",
                (product_id,)
            )
            row = cursor.fetchone()
            return self.row_to_entity(dict(row)) if row else None

    async def get_by_barcode(self, barcode: str) -> Optional[Product]:
        """Get product by barcode"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM products WHERE barcode = ?",
                (barcode,)
            )
            row = cursor.fetchone()
            return self.row_to_entity(dict(row)) if row else None

    async def create(self, product: Product) -> Product:
        """Create new product - Task 2.1.5"""
        async with connection_manager.get_connection() as conn:
            # Serialize nutriments to JSON
            nutriments_json = json.dumps(product.nutriments or {})

            cursor = conn.execute(
                """
                INSERT INTO products (barcode, name, brand, serving_size, nutriments)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    product.barcode,
                    product.name,
                    product.brand or "",
                    product.serving_size or "100g",
                    nutriments_json
                )
            )
            product_id = cursor.lastrowid
            self.logger.info(f"Product created: {product_id}")

        # Task 2.1.5: Call get_by_id AFTER commit (outside context manager)
        return await self.get_by_id(product_id)

    async def update(self, product_id: int, updates: Dict[str, Any]) -> Optional[Product]:
        """Update product fields"""
        if not updates:
            return await self.get_by_id(product_id)

        # Serialize nutriments if present in updates
        processed_updates = updates.copy()
        if "nutriments" in processed_updates:
            processed_updates["nutriments"] = json.dumps(processed_updates["nutriments"] or {})

        set_clause = ", ".join([f"{k} = ?" for k in processed_updates.keys()])
        values = list(processed_updates.values()) + [product_id]

        async with connection_manager.get_connection() as conn:
            conn.execute(
                f"UPDATE products SET {set_clause} WHERE id = ?",
                values
            )
            self.logger.info(f"Product updated: {product_id}")

        return await self.get_by_id(product_id)

    async def delete(self, product_id: int) -> bool:
        """Delete product"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM products WHERE id = ?",
                (product_id,)
            )
            self.logger.info(f"Product deleted: {product_id}")
            return cursor.rowcount > 0

    async def get_all(self, limit: int = 100, offset: int = 0) -> List[Product]:
        """Get all products with pagination"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM products LIMIT ? OFFSET ?",
                (limit, offset)
            )
            rows = cursor.fetchall()
            return [self.row_to_entity(dict(row)) for row in rows]

    async def count(self) -> int:
        """Count total products"""
        async with connection_manager.get_connection() as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM products")
            return cursor.fetchone()[0]
